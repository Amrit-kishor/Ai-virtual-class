import express from 'express';
import http from 'http';
import os from 'os';
import { Server, Socket } from 'socket.io';
import next from 'next';
import { parse } from 'url';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { logger } from './logger';
import { corsMiddleware, corsOptions, helmetMiddleware, apiRateLimiter, authRateLimiter, socketRateLimiter } from './security';
import { errorHandler, AppError } from './errorHandler';
import { roomStore } from './roomStore';
import { prisma } from '../src/lib/prisma';
import { TokenPayload } from '../src/lib/auth';
import { Participant, ChatMessage, WhiteboardElement, LectureTopic, RaisedHandRequest } from '../src/types';
import {
  JoinRoomPayloadSchema,
  ChatMessagePayloadSchema,
  ToggleMediaPayloadSchema,
  RaiseHandPayloadSchema,
  LowerHandPayloadSchema,
  AllowStudentQuestionSchema,
  DismissStudentHandSchema,
  CompleteStudentQuestionSchema,
  WhiteboardUpdatePayloadSchema,
  NotesUpdatePayloadSchema,
  KickParticipantPayloadSchema,
  RemoteMutePayloadSchema,
  WebRTCOfferSchema,
  WebRTCAnswerSchema,
  WebRTCIceCandidateSchema,
} from './validators';

// Best-effort discovery of the machine's LAN IPv4 address, purely for the
// startup log message that tells the developer what URL to use from a phone
// or other device on the same network.
function getLanIpAddress(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

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
  serverApp.options('*', corsMiddleware);

  // Production Health Check Endpoints (for Render health monitoring)
  serverApp.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });
  serverApp.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Rate Limiters on REST API endpoints
  serverApp.use('/api/', apiRateLimiter);
  serverApp.use('/api/auth/', authRateLimiter);

  const server = http.createServer(serverApp);

  // 1. Secure Socket.IO Setup
  const io = new Server(server, {
    cors: {
      // Reuse the same validated origin allowlist as the REST API instead of
      // blindly accepting every origin, so arbitrary websites cannot connect
      // to the classroom socket in production.
      origin: corsOptions.origin,
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

      // Send initial state upon join (including active raised hands queue)
      socket.emit('room-joined', {
        roomCode,
        teacherId: room.teacherId,
        participants: Array.from(room.participants.values()),
        raisedHands: roomStore.getRaisedHands(roomCode),
        whiteboardElements: room.whiteboardElements,
        chatMessages: room.chatMessages,
        notesText: room.notesText,
        topics: room.topics,
        currentTopicIndex: room.currentTopicIndex,
        isPublicAI: room.isPublicAI,
      });

      // Broadcast new participant join to room
      socket.to(roomCode).emit('user-joined', { participant });
      io.to(roomCode).emit('participants-list-updated', Array.from(room.participants.values()));

      logger.info({ roomCode, userId, name, role }, 'User joined room successfully');
    });

    // Toggle Media (Mic/Cam)
    socket.on('toggle-media', (rawPayload: unknown) => {
      const parseResult = ToggleMediaPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        logger.warn({ err: parseResult.error, rawPayload }, 'toggle-media validation failed');
        return;
      }

      const { roomCode, type, value } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) {
        logger.warn({ roomCode }, 'toggle-media room not found');
        return;
      }

      const participant = room.participants.get(socket.id);
      if (participant) {
        if (type === 'audio') participant.isMuted = value;
        if (type === 'video') participant.isVideoOff = value;
        logger.info({ roomCode, socketId: socket.id, type, value }, 'Media state toggled');
        io.to(roomCode).emit('participant-updated', { participant });
      } else {
        logger.warn({
          socketId: socket.id,
          roomCode,
          existingKeys: Array.from(room.participants.keys()),
        }, 'Participant not found in room for toggle-media');
      }
    });

    // Raise Hand (Student)
    socket.on('raise-hand', (rawPayload: unknown) => {
      if (socketRateLimiter.isRateLimited(socket.id, 'raise-hand', 5)) return;
      const parseResult = RaiseHandPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant) return;

      const request = roomStore.raiseHand(roomCode, socket.id, {
        userId: participant.userId,
        name: participant.name,
        role: participant.role,
      });

      if (request) {
        logger.info({ roomCode, userId: participant.userId, name: participant.name }, 'Hand raised by student');
        io.to(roomCode).emit('participant-updated', { participant });
        io.to(roomCode).emit('hand-raised-queue-updated', {
          raisedHands: roomStore.getRaisedHands(roomCode),
          latestRequest: request,
        });
        socket.emit('hand-state-changed', { state: 'RAISED', request });
      }
    });

    // Lower Hand (Student initiated)
    socket.on('lower-hand', (rawPayload: unknown) => {
      const parseResult = LowerHandPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant) return;

      roomStore.lowerHand(roomCode, participant.userId);
      logger.info({ roomCode, userId: participant.userId }, 'Hand lowered by student');

      io.to(roomCode).emit('participant-updated', { participant });
      io.to(roomCode).emit('hand-raised-queue-updated', {
        raisedHands: roomStore.getRaisedHands(roomCode),
      });
      socket.emit('hand-state-changed', { state: 'LOWERED' });
    });

    // Allow Student Question (Teacher only)
    socket.on('allow-student-question', (rawPayload: unknown) => {
      const parseResult = AllowStudentQuestionSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, targetUserId } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      const caller = room.participants.get(socket.id);
      if (!caller || caller.role !== 'TEACHER') {
        socket.emit('error-message', { message: 'Unauthorized: Only teachers can allow questions.' });
        return;
      }

      const result = roomStore.allowStudentToSpeak(roomCode, targetUserId);
      if (result) {
        logger.info({ roomCode, teacherId: caller.userId, targetUserId }, 'Teacher allowed student to speak');

        if (result.studentSocketId) {
          io.to(result.studentSocketId).emit('question-allowed', {
            message: 'You may ask your question now.',
            allowedBy: caller.name,
          });
          io.to(result.studentSocketId).emit('hand-state-changed', { state: 'ALLOWED', request: result.request });
        }

        io.to(roomCode).emit('hand-raised-queue-updated', {
          raisedHands: roomStore.getRaisedHands(roomCode),
        });
      }
    });

    // Dismiss Student Hand (Teacher only)
    socket.on('dismiss-student-hand', (rawPayload: unknown) => {
      const parseResult = DismissStudentHandSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, targetUserId } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      const caller = room.participants.get(socket.id);
      if (!caller || caller.role !== 'TEACHER') {
        socket.emit('error-message', { message: 'Unauthorized: Only teachers can dismiss hands.' });
        return;
      }

      const result = roomStore.dismissStudentHand(roomCode, targetUserId);
      if (result) {
        logger.info({ roomCode, teacherId: caller.userId, targetUserId }, 'Teacher dismissed student hand');

        if (result.studentSocketId) {
          io.to(result.studentSocketId).emit('hand-dismissed', {
            message: 'Your hand request was dismissed.',
          });
          io.to(result.studentSocketId).emit('hand-state-changed', { state: 'DISMISSED' });
        }

        io.to(roomCode).emit('hand-raised-queue-updated', {
          raisedHands: roomStore.getRaisedHands(roomCode),
        });
      }
    });

    // Complete Student Question (Teacher or Student)
    socket.on('complete-student-question', (rawPayload: unknown) => {
      const parseResult = CompleteStudentQuestionSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, targetUserId } = parseResult.data;
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      roomStore.completeStudentQuestion(roomCode, targetUserId);
      logger.info({ roomCode, targetUserId }, 'Student question completed');

      for (const [sId, p] of room.participants.entries()) {
        if (p.userId === targetUserId) {
          io.to(sId).emit('hand-state-changed', { state: 'LOWERED' });
          break;
        }
      }

      io.to(roomCode).emit('hand-raised-queue-updated', {
        raisedHands: roomStore.getRaisedHands(roomCode),
      });
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
        io.to(roomCode).emit('participant-updated', { participant });
      }
    });

    // Broadcast Quiz to Room
    socket.on('broadcast-quiz', ({ roomCode, quiz }: { roomCode: string; quiz: unknown }) => {
      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      room.activeQuiz = quiz;
      io.to(roomCode).emit('active-quiz-broadcast', quiz);
    });

    // ==========================================
    // WebRTC Peer-to-Peer Signaling Handlers
    // ==========================================

    // Shared authorization guard for all WebRTC signaling events:
    // both the sender AND the target must be current participants of the SAME room.
    // Prevents a client from targeting an arbitrary socket in another room.
    const authorizeSignaling = (roomCode: string, targetSocketId: string) => {
      const room = roomStore.getRoom(roomCode);
      if (!room) return null;
      if (socket.data.roomCode !== roomCode) return null; // sender must actually be joined to this room
      if (!room.participants.has(socket.id)) return null;
      if (!room.participants.has(targetSocketId)) return null; // target must be in the SAME room
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!targetSocket) return null;
      return targetSocket;
    };

    // Forward WebRTC SDP Offer to Target Peer
    socket.on('webrtc-offer', (rawPayload: unknown) => {
      if (socketRateLimiter.isRateLimited(socket.id, 'webrtc-offer', 20)) return;

      const parseResult = WebRTCOfferSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, targetSocketId, offer } = parseResult.data;
      const targetSocket = authorizeSignaling(roomCode, targetSocketId);
      if (!targetSocket) return;

      targetSocket.emit('webrtc-offer', {
        senderSocketId: socket.id,
        offer,
      });
    });

    // Forward WebRTC SDP Answer to Target Peer
    socket.on('webrtc-answer', (rawPayload: unknown) => {
      if (socketRateLimiter.isRateLimited(socket.id, 'webrtc-answer', 20)) return;

      const parseResult = WebRTCAnswerSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, targetSocketId, answer } = parseResult.data;
      const targetSocket = authorizeSignaling(roomCode, targetSocketId);
      if (!targetSocket) return;

      targetSocket.emit('webrtc-answer', {
        senderSocketId: socket.id,
        answer,
      });
    });

    // Forward WebRTC ICE Candidate to Target Peer
    socket.on('webrtc-ice-candidate', (rawPayload: unknown) => {
      if (socketRateLimiter.isRateLimited(socket.id, 'webrtc-ice-candidate', 60)) return;

      const parseResult = WebRTCIceCandidateSchema.safeParse(rawPayload);
      if (!parseResult.success) return;

      const { roomCode, targetSocketId, candidate } = parseResult.data;
      const targetSocket = authorizeSignaling(roomCode, targetSocketId);
      if (!targetSocket) return;

      targetSocket.emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        candidate,
      });
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
    const parsedUrl = parse(req.url, true);
    return handle(req, res, parsedUrl);
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
    // Bind explicitly to 0.0.0.0 so the server is reachable from other devices
    // on the same LAN (e.g. testing the classroom from a phone), not just localhost.
    server.listen(actualPort, '0.0.0.0', () => {
      const lanIp = getLanIpAddress();
      logger.info(
        { port: actualPort, env: env.NODE_ENV },
        `🚀 AI Virtual Classroom Production Server running`
      );
      // eslint-disable-next-line no-console
      console.log(`\n  Local:    http://localhost:${actualPort}`);
      if (lanIp) {
        // eslint-disable-next-line no-console
        console.log(`  Network:  http://${lanIp}:${actualPort}`);
        // eslint-disable-next-line no-console
        console.log(`\n  For mobile/LAN testing, set NEXT_PUBLIC_SOCKET_URL=http://${lanIp}:${actualPort} in .env\n`);
      }
    });
  });
});
