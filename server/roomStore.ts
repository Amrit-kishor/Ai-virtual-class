import { Participant, ChatMessage, WhiteboardElement, LectureTopic, RaisedHandRequest } from '../src/types';
import { prisma } from '../src/lib/prisma';
import { logger } from './logger';

export interface RoomState {
  code: string;
  teacherId: string;
  maxParticipants: number;
  isEnded: boolean;
  participants: Map<string, Participant>; // key: socketId
  raisedHands: Map<string, RaisedHandRequest>; // key: userId
  whiteboardElements: WhiteboardElement[];
  chatMessages: ChatMessage[];
  notesText: string;
  topics: LectureTopic[];
  currentTopicIndex: number;
  isPublicAI: boolean;
  activeQuiz: unknown | null;
}

class RoomStoreManager {
  private rooms: Map<string, RoomState> = new Map();
  private roomPromises: Map<string, Promise<RoomState>> = new Map();

  public async getOrCreateRoom(code: string, teacherId: string): Promise<RoomState> {
    if (this.rooms.has(code)) {
      return this.rooms.get(code)!;
    }

    if (this.roomPromises.has(code)) {
      return this.roomPromises.get(code)!;
    }

    const initPromise = (async () => {
      // Attempt DB Lookup for persistent restoration
    let roomInDb = null;
    try {
      roomInDb = await prisma.classroom.findUnique({
        where: { roomCode: code },
        include: { sessionState: true, teacher: true },
      });
    } catch (err: unknown) {
      logger.warn({ code, err }, 'DB lookup failed, operating in resilient mode');
    }

    let actualTeacherId = teacherId;
    let maxParticipants = 4;
    let isEnded = false;
    let whiteboardElements: WhiteboardElement[] = [];
    let notesText = '# AI Classroom Notes\n\n- Class initialized.\n- Auto-notes active.';
    let topics: LectureTopic[] = [];
    let currentTopicIndex = 0;

    if (roomInDb) {
      actualTeacherId = roomInDb.teacherId;
      maxParticipants = roomInDb.maxParticipants;
      isEnded = roomInDb.isEnded;

      if (roomInDb.sessionState) {
        try {
          if (roomInDb.sessionState.whiteboardData) {
            whiteboardElements = JSON.parse(roomInDb.sessionState.whiteboardData);
          }
          if (roomInDb.sessionState.notesData) {
            notesText = roomInDb.sessionState.notesData;
          }
          if (roomInDb.sessionState.lectureHistoryJson) {
            topics = JSON.parse(roomInDb.sessionState.lectureHistoryJson);
          }
        } catch (e: unknown) {
          logger.error({ code, error: e }, 'Failed to parse session state JSON');
        }
      }
    } else {
      // Create DB record if possible
      try {
        const created = await prisma.classroom.create({
          data: {
            roomCode: code,
            title: `Classroom ${code}`,
            teacherId: teacherId,
            maxParticipants,
            sessionState: {
              create: {
                notesData: notesText,
              },
            },
          },
        });
        actualTeacherId = created.teacherId;
      } catch (err: unknown) {
        logger.warn({ code, teacherId }, 'Classroom DB creation bypassed');
      }
    }

      const roomState: RoomState = {
        code,
        teacherId: actualTeacherId,
        maxParticipants,
        isEnded,
        participants: new Map(),
        raisedHands: new Map(),
        whiteboardElements,
        chatMessages: [],
        notesText,
        topics,
        currentTopicIndex,
        isPublicAI: false,
        activeQuiz: null,
      };

      this.rooms.set(code, roomState);
      this.roomPromises.delete(code);
      return roomState;
    })();

    this.roomPromises.set(code, initPromise);
    return initPromise;
  }

  public getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  public raiseHand(roomCode: string, socketId: string, user: { userId: string; name: string; role: 'TEACHER' | 'STUDENT' }): RaisedHandRequest | null {
    const room = this.rooms.get(roomCode);
    if (!room || user.role === 'TEACHER') return null;

    const existing = room.raisedHands.get(user.userId);
    if (existing) {
      existing.socketId = socketId;
      existing.userName = user.name;
      existing.state = 'RAISED';
      return existing;
    }

    const request: RaisedHandRequest = {
      id: `hand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      socketId,
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      state: 'RAISED',
      raisedAt: Date.now(),
    };

    room.raisedHands.set(user.userId, request);

    const participant = room.participants.get(socketId);
    if (participant) {
      participant.isHandRaised = true;
    }

    return request;
  }

  public lowerHand(roomCode: string, userId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const existed = room.raisedHands.delete(userId);

    for (const p of room.participants.values()) {
      if (p.userId === userId) {
        p.isHandRaised = false;
      }
    }

    return existed;
  }

  public allowStudentToSpeak(roomCode: string, targetUserId: string): { request: RaisedHandRequest; studentSocketId: string } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const req = room.raisedHands.get(targetUserId);
    if (!req) return null;

    req.state = 'ALLOWED';

    let activeSocketId = req.socketId;
    for (const [sId, p] of room.participants.entries()) {
      if (p.userId === targetUserId) {
        activeSocketId = sId;
        break;
      }
    }

    return { request: req, studentSocketId: activeSocketId };
  }

  public dismissStudentHand(roomCode: string, targetUserId: string): { studentSocketId: string } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const req = room.raisedHands.get(targetUserId);
    let activeSocketId = req?.socketId || '';

    for (const [sId, p] of room.participants.entries()) {
      if (p.userId === targetUserId) {
        activeSocketId = sId;
        p.isHandRaised = false;
        break;
      }
    }

    room.raisedHands.delete(targetUserId);
    return { studentSocketId: activeSocketId };
  }

  public completeStudentQuestion(roomCode: string, targetUserId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const existed = room.raisedHands.delete(targetUserId);
    for (const p of room.participants.values()) {
      if (p.userId === targetUserId) {
        p.isHandRaised = false;
      }
    }
    return existed;
  }

  public getRaisedHands(roomCode: string): RaisedHandRequest[] {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    return Array.from(room.raisedHands.values()).sort((a, b) => a.raisedAt - b.raisedAt);
  }

  public async persistRoomState(code: string): Promise<void> {
    const room = this.rooms.get(code);
    if (!room) return;

    try {
      await prisma.sessionState.upsert({
        where: { roomId: room.code },
        update: {
          whiteboardData: JSON.stringify(room.whiteboardElements),
          notesData: room.notesText,
          lectureHistoryJson: JSON.stringify(room.topics),
        },
        create: {
          roomId: room.code,
          whiteboardData: JSON.stringify(room.whiteboardElements),
          notesData: room.notesText,
          lectureHistoryJson: JSON.stringify(room.topics),
        },
      });
    } catch (err: unknown) {
      // Non-blocking fallback
    }
  }

  public removeSocketFromRoom(roomCode: string, socketId: string): Participant | undefined {
    const room = this.rooms.get(roomCode);
    if (!room) return undefined;

    const participant = room.participants.get(socketId);
    if (participant) {
      room.participants.delete(socketId);
      logger.info({ roomCode, socketId, userId: participant.userId }, 'Participant socket removed');
    }
    return participant;
  }

  public getUniqueParticipantCount(roomCode: string): number {
    const room = this.rooms.get(roomCode);
    if (!room) return 0;
    const uniqueUserIds = new Set(Array.from(room.participants.values()).map((p) => p.userId));
    return uniqueUserIds.size;
  }
}

export const roomStore = new RoomStoreManager();
