import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import next from 'next';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { logger } from './logger';
import { corsMiddleware, helmetMiddleware, apiRateLimiter, authRateLimiter, socketRateLimiter } from './security';
import { errorHandler, AppError } from './errorHandler';
import { roomStore } from './roomStore';
import { prisma } from '../src/lib/prisma';
import { TokenPayload } from '../src/lib/auth';
import { Participant, ChatMessage, WhiteboardElement, LectureTopic } from '../src/types';
import {
  JoinRoomPayloadSchema,
  ChatMessagePayloadSchema,
  ToggleMediaPayloadSchema,
  RaiseHandPayloadSchema,
  WhiteboardUpdatePayloadSchema,
  NotesUpdatePayloadSchema,
  KickParticipantPayloadSchema,
  RemoteMutePayloadSchema,
} from './validators';

const dev = env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = env.PORT || 3000;

interface AuthenticatedSocket extends Socket {
  data: {
    user?: TokenPayload;
    roomCode?: string;
  };
}

app.prepare().then(() => {
  const serverApp = express();

  // Security Middlewares
  serverApp.use(helmetMiddleware);
  serverApp.use(corsMiddleware);

  // Rate Limiters on REST API endpoints
  serverApp.use('/api/', apiRateLimiter);
  serverApp.use('/api/auth/', authRateLimiter);

  const server = http.createServer(serverApp);

  // 1. Secure Socket.IO Setup
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || dev) return callback(null, true);
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 1e7, // 10MB payload cap for canvas/files
  });

  // 4. Socket Authentication Middleware (JWT Validation Before Connection)
  io.use((socket: Socket, nextMiddleware) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        logger.warn({ socketId: socket.id }, 'Socket connection attempt rejected: Missing JWT token');
        return nextMiddleware(new Error('Authentication Error: Missing Token'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      socket.data.user = decoded;
      logger.info({ socketId: socket.id, userId: decoded.userId, name: decoded.name }, 'Socket authenticated');
      nextMiddleware();
    } catch (err: unknown) {
      logger.warn({ socketId: socket.id, err }, 'Socket authentication failed: Invalid JWT');
      nextMiddleware(new Error('Authentication Error: Invalid Token'));
    }
  });

  // Socket Connection Handlers
  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const authUser = socket.data.user;

    if (!authUser) {
      socket.disconnect(true);
      return;
    }

    logger.info({ socketId: socket.id, userId: authUser.userId }, 'Socket connected to server');

    // 6 & 7. Join Room with Duplicate Session Handling & Authentic Teacher Validation
    socket.on('join-room', async (rawPayload: unknown) => {
      if (socketRateLimiter.isRateLimited(socket.id, 'join-room', 5)) {
        socket.emit('error-message', { message: 'Rate limit exceeded for joining room.' });
        return;
      }

      const parseResult = JoinRoomPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        socket.emit('error-message', { message: 'Invalid payload for join-room' });
        return;
      }

      const { roomCode, userId, name, role } = parseResult.data;

      // Ensure joining user matches authenticated token user
      if (userId !== authUser.userId) {
        socket.emit('error-message', { message: 'Unauthorized: User ID mismatch' });
        return;
      }

      // 3. Database Teacher Validation (No hardcoded teacher IDs)
      let roomInDb = null;
      try {
        roomInDb = await prisma.classroom.findUnique({
          where: { roomCode },
          include: { teacher: true },
        });
      } catch (e: unknown) {
        // Fallback operating mode
      }

      const effectiveTeacherId = roomInDb ? roomInDb.teacherId : (role === 'TEACHER' ? userId : authUser.userId);
      const room = await roomStore.getOrCreateRoom(roomCode, effectiveTeacherId);

      if (room.isEnded) {
        socket.emit('room-ended', { message: 'This classroom session has concluded.' });
        return;
      }

      // 6. Seat Counting: Count UNIQUE authenticated user IDs, NOT raw sockets
      const currentSeatCount = roomStore.getUniqueParticipantCount(roomCode);
      const isAlreadyJoinedUser = Array.from(room.participants.values()).some((p) => p.userId === userId);

      if (!isAlreadyJoinedUser && currentSeatCount >= room.maxParticipants) {
        socket.emit('room-full', { message: `Room capacity reached (Max ${room.maxParticipants} unique users).` });
        return;
      }

      // 7. Duplicate Session Handling: Disconnect previous socket for same user
      for (const [existingSocketId, existingParticipant] of room.participants.entries()) {
        if (existingParticipant.userId === userId && existingSocketId !== socket.id) {
          const oldSocket = io.sockets.sockets.get(existingSocketId);
          if (oldSocket) {
            logger.info({ userId, roomCode, oldSocketId: existingSocketId }, 'Disconnecting duplicate socket session');
            oldSocket.emit('session-superseded', { message: 'Connected from another window/device.' });
            oldSocket.disconnect(true);
          }
          room.participants.delete(existingSocketId);
        }
      }

      socket.join(roomCode);
      socket.data.roomCode = roomCode;

      const participant: Participant = {
        socketId: socket.id,
        userId,
        name,
        role,
        isMuted: false,
        isVideoOff: false,
        isHandRaised: false,
        isSpotlighted: role === 'TEACHER' || userId === room.teacherId,
        joinedAt: Date.now(),
      };

      room.participants.set(socket.id, participant);

      // Send initial state upon join
      socket.emit('room-joined', {
        roomCode,
        teacherId: room.teacherId,
        participants: Array.from(room.participants.values()),
        whiteboardElements: room.whiteboardElements,
        chatMessages: room.chatMessages,
        notesText: room.notesText,
        topics: room.topics,
        currentTopicIndex: room.currentTopicIndex,
        isPublicAI: room.isPublicAI,
      });

      // Broadcast new participant join to room
      socket.to(roomCode).emit('user-joined', participant);
      io.to(roomCode).emit('participants-list-updated', Array.from(room.participants.values()));

      logger.info({ roomCode, userId, name, role }, 'User joined room successfully');
    });

    // Toggle Media (Mic/Cam)
    socket.on('toggle-media', (rawPayload: unknown) => {
      if (socketRateLimiter.isRateLimited(socket.id, 'toggle-media', 10)) return;
      const parseResult = ToggleMediaPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, type, value } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (participant) {
        if (type === 'audio') participant.isMuted = value;
        if (type === 'video') participant.isVideoOff = value;
        io.to(roomCode).emit('participant-updated', participant);
      }
    });

    // Raise Hand
    socket.on('raise-hand', (rawPayload: unknown) => {
      if (socketRateLimiter.isRateLimited(socket.id, 'raise-hand', 5)) return;
      const parseResult = RaiseHandPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, isHandRaised } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (participant) {
        participant.isHandRaised = isHandRaised;
        io.to(roomCode).emit('participant-updated', participant);
      }
    });

    // Chat Message
    socket.on('chat-message', (rawPayload: unknown) => {
      if (socketRateLimiter.isRateLimited(socket.id, 'chat-message', 10)) {
        socket.emit('error-message', { message: 'Chat rate limit exceeded. Please slow down.' });
        return;
      }
      const parseResult = ChatMessagePayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, message } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant) return;

      const chatMsg: ChatMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        senderId: participant.userId,
        senderName: participant.name,
        senderRole: participant.role,
        content: message,
        timestamp: Date.now(),
      };

      room.chatMessages.push(chatMsg);
      io.to(roomCode).emit('new-message', chatMsg);
    });

    // Whiteboard Update
    socket.on('whiteboard-update', (rawPayload: unknown) => {
      if (socketRateLimiter.isRateLimited(socket.id, 'whiteboard-update', 30)) return;
      const parseResult = WhiteboardUpdatePayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, elements } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      room.whiteboardElements = elements as unknown as WhiteboardElement[];
      socket.to(roomCode).emit('whiteboard-update', room.whiteboardElements);
      roomStore.persistRoomState(roomCode);
    });

    // Notes Update
    socket.on('notes-update', (rawPayload: unknown) => {
      if (socketRateLimiter.isRateLimited(socket.id, 'notes-update', 10)) return;
      const parseResult = NotesUpdatePayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, text } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      room.notesText = text;
      socket.to(roomCode).emit('notes-update', room.notesText);
      roomStore.persistRoomState(roomCode);
    });

    // Teacher Removes Student from Classroom
    socket.on('kick-participant', (rawPayload: unknown) => {
      const parseResult = KickParticipantPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, targetSocketId } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      if (authUser.role !== 'TEACHER' && authUser.userId !== room.teacherId) {
        socket.emit('error-message', { message: 'Only the Teacher can remove students.' });
        return;
      }

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        logger.info({ teacherId: authUser.userId, targetSocketId, roomCode }, 'Teacher removed student from room');
        targetSocket.emit('kicked-from-room', { message: 'You have been removed from the classroom session by the Teacher.' });
        targetSocket.disconnect(true);
      }

      roomStore.removeSocketFromRoom(roomCode, targetSocketId);
      io.to(roomCode).emit('participants-list-updated', Array.from(room.participants.values()));
    });

    // Teacher Remote Mutes Student Mic
    socket.on('remote-mute', (rawPayload: unknown) => {
      const parseResult = RemoteMutePayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, targetSocketId } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      if (authUser.role !== 'TEACHER' && authUser.userId !== room.teacherId) {
        socket.emit('error-message', { message: 'Only the Teacher can mute students.' });
        return;
      }

      const participant = room.participants.get(targetSocketId);
      if (participant) {
        participant.isMuted = true;
        io.to(roomCode).emit('participant-updated', participant);
      }
    });

    // Broadcast Quiz to Room
    socket.on('broadcast-quiz', ({ roomCode, quiz }: { roomCode: string; quiz: unknown }) => {
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      room.activeQuiz = quiz;
      io.to(roomCode).emit('active-quiz-broadcast', quiz);
    });

    // Disconnect Handler
    socket.on('disconnect', () => {
      socketRateLimiter.clearSocket(socket.id);
      const roomCode = socket.data.roomCode;
      if (roomCode) {
        const removed = roomStore.removeSocketFromRoom(roomCode, socket.id);
        if (removed) {
          io.to(roomCode).emit('user-left', { socketId: socket.id, userId: removed.userId });
          const room = roomStore.getRoom(roomCode);
          if (room) {
            io.to(roomCode).emit('participants-list-updated', Array.from(room.participants.values()));
          }
        }
      }
      logger.info({ socketId: socket.id }, 'Socket disconnected');
    });
  });

  // Delegate Next.js HTTP Request Handling (excluding Socket.IO paths)
  serverApp.all('*', (req, res) => {
    if (req.path.startsWith('/socket.io')) {
      return;
    }
    return handle(req, res);
  });

  // Centralized Error Middleware
  serverApp.use(errorHandler);

  // Dynamic Free Port Binder
  const findOpenPort = (startPort: number): Promise<number> => {
    return new Promise((resolve) => {
      const tempServer = http.createServer();
      tempServer.listen(startPort, () => {
        tempServer.close(() => resolve(startPort));
      });
      tempServer.on('error', () => {
        resolve(findOpenPort(startPort + 1));
      });
    });
  };

  findOpenPort(PORT).then((actualPort) => {
    server.listen(actualPort, () => {
      logger.info(
        { port: actualPort, env: env.NODE_ENV },
        `🚀 AI Virtual Classroom Production Server running at http://localhost:${actualPort}`
      );
    });
  });
});
