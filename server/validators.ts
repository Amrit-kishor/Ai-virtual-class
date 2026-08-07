import { z } from 'zod';

// REST API Validators
export const SignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['TEACHER', 'STUDENT']).default('STUDENT'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const CreateRoomSchema = z.object({
  title: z.string().min(3, 'Classroom title is required'),
  maxParticipants: z.number().min(2).max(50).default(4),
  syllabusText: z.string().optional(),
});

export const CodeRunSchema = z.object({
  code: z.string().min(1, 'Code snippet is required'),
  language: z.string().default('javascript'),
});

// Socket Event Validators
export const JoinRoomPayloadSchema = z.object({
  roomCode: z.string().min(3, 'Room code is required'),
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['TEACHER', 'STUDENT']),
});

export const ChatMessagePayloadSchema = z.object({
  roomCode: z.string().min(1),
  message: z.string().min(1).max(2000, 'Message body too large'),
});

export const ToggleMediaPayloadSchema = z.object({
  roomCode: z.string().min(1),
  type: z.enum(['audio', 'video']),
  value: z.boolean(),
});

export const RaiseHandPayloadSchema = z.object({
  roomCode: z.string().min(1),
  isHandRaised: z.boolean(),
});

export const WhiteboardUpdatePayloadSchema = z.object({
  roomCode: z.string().min(1),
  elements: z.array(z.record(z.unknown())),
});

export const NotesUpdatePayloadSchema = z.object({
  roomCode: z.string().min(1),
  text: z.string(),
});

export const KickParticipantPayloadSchema = z.object({
  roomCode: z.string().min(1),
  targetSocketId: z.string().min(1),
});

export const RemoteMutePayloadSchema = z.object({
  roomCode: z.string().min(1),
  targetSocketId: z.string().min(1),
});
