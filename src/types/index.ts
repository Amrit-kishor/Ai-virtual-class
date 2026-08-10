export type UserRole = 'TEACHER' | 'STUDENT';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
}

export interface ClassroomInfo {
  id: string;
  roomCode: string;
  title: string;
  description?: string;
  teacherId: string;
  teacherName?: string;
  isEnded: boolean;
  maxParticipants: number;
  syllabusText?: string;
  createdAt: string;
}

export interface Participant {
  socketId: string;
  userId: string;
  name: string;
  role: UserRole;
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  isSpotlighted: boolean;
  joinedAt: number;
}

// WebRTC Signaling Types
export interface SignalPayload {
  to: string;
  from: string;
  signal: unknown;
}

// Chat Message Types
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  timestamp: number;
  isAI?: boolean;
  isPublicAI?: boolean;
  replyToId?: string;
  replyToSnippet?: string;
  fileUrl?: string;
  fileName?: string;
  codeSnippet?: {
    language: string;
    code: string;
  };
  pinned?: boolean;
  readBy?: string[];
}

// Whiteboard Element Types
export type ToolType = 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text' | 'sticky' | 'laser';

export interface WhiteboardElement {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  text?: string;
  bgColor?: string;
}

// AI Lecture Topic
export interface LectureTopic {
  id: string;
  title: string;
  content: string;
  analogy: string;
  diagramMermaid?: string;
  checkpointQuestion: string;
}

// AI Doubt Message
export interface DoubtMessage {
  id: string;
  studentId: string;
  question: string;
  answer: string;
  relatedTopicId?: string;
  timestamp: number;
  isPublic?: boolean;
}

// Quiz Question
export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'coding' | 'true_false' | 'fill_blank';
  question: string;
  options?: string[];
  correctAnswer: string;
  starterCode?: string;
  explanation: string;
}

export interface QuizData {
  id: string;
  title: string;
  topic?: string;
  quizType?: 'ai' | 'custom';
  questionCount?: number;
  questions: QuizQuestion[];
}

export interface SummaryData {
  summary: string;
  keyPoints: string[];
  formulas: string[];
  quiz: QuizQuestion[];
}

export interface DetailedQuestionReview {
  id: string;
  type: 'mcq' | 'coding' | 'true_false' | 'fill_blank';
  question: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer: string;
  isCorrect: boolean;
  isUnanswered: boolean;
  explanation: string;
}

export interface QuizEvaluationResult {
  submissionId: string;
  quizId: string;
  title: string;
  topic?: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  timeTakenSeconds?: number;
  aiFeedback?: string;
  review: DetailedQuestionReview[];
  submittedAt: string;
}

export interface QuizHistoryItem {
  id: string;
  quizId: string;
  title: string;
  topic?: string;
  quizType: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTaken?: number;
  aiFeedback?: string;
  submittedAt: string;
}

export const SUGGESTED_QUIZ_TOPICS = [
  'Data Structures',
  'Algorithms',
  'C++ OOP',
  'Java Core',
  'Python Programming',
  'DBMS & SQL',
  'Operating Systems',
  'Computer Networks',
  'Web Development',
  'Mathematics (Calculus & Linear Algebra)',
  'Physics (Mechanics & Electromagnetism)',
  'System Design & Architecture',
  'Machine Learning Basics',
  'Cybersecurity & Cryptography',
];

export interface QuizSubmissionResult {
  submissionId: string;
  quizId: string;
  userId: string;
  userName: string;
  score: number;
  total: number;
  answers: Record<string, string>;
  submittedAt: string;
}

// Attendance Record
export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  joinTime: number;
  exitTime?: number;
  totalDurationSeconds: number;
  reconnectCount: number;
  isIdle: boolean;
}

// Reconnection State Backup
export interface SessionBackupState {
  roomCode: string;
  userId: string;
  role: UserRole;
  isMuted: boolean;
  isVideoOff: boolean;
  chatMessages: ChatMessage[];
  whiteboardElements: WhiteboardElement[];
  notesText: string;
  currentTopicIndex: number;
}
