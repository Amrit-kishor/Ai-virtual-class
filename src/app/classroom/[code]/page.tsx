'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { getLiveUserMediaStream, getWebRTCConfiguration, createAudioActivityDetector } from '@/lib/media';
import { safeFetchJson } from '@/lib/utils';
import {
  Participant,
  ChatMessage,
  WhiteboardElement,
  LectureTopic,
  DoubtMessage,
  QuizData,
  SummaryData,
  HandState,
  RaisedHandRequest,
} from '@/types';

import { LeftClassroomSidebar } from '@/components/classroom/LeftClassroomSidebar';
import { VideoGrid } from '@/components/classroom/VideoGrid';
import { AITeacherControl } from '@/components/classroom/AITeacherControl';
import { Whiteboard } from '@/components/classroom/Whiteboard';
import { ChatPanel } from '@/components/classroom/ChatPanel';
import { PrivateAIDoubt } from '@/components/classroom/PrivateAIDoubt';
import { CodingPlayground } from '@/components/classroom/CodingPlayground';
import { NotesPanel } from '@/components/classroom/NotesPanel';
import { AIQuizCenterModal } from '@/components/quiz/AIQuizCenterModal';
import { TeacherRaisedHandsPanel } from '@/components/classroom/TeacherRaisedHandsPanel';
import { AttendanceModal } from '@/components/classroom/AttendanceModal';
import { AISummaryModal } from '@/components/classroom/AISummaryModal';
import { InviteMembersModal } from '@/components/classroom/InviteMembersModal';
import { MultiUploadZone } from '@/components/classroom/MultiUploadZone';
import { BackgroundEffectsModal } from '@/components/classroom/BackgroundEffectsModal';
import { BackgroundMode, VideoBackgroundProcessor } from '@/lib/videoBackgroundProcessor';

// Icons
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  Share2,
  PhoneOff,
  Sparkles,
  Layout,
  MessageSquare,
  Bot,
  Code2,
  FileText,
  Users,
  Trophy,
  HelpCircle,
  Maximize2,
  Minimize2,
  UserPlus,
  BookOpen,
  CheckCircle,
  Clock,
  Folder,
  GraduationCap,
  UploadCloud,
  FileCode,
} from 'lucide-react';

export default function ClassroomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params?.code as string)?.toUpperCase() || 'DEMO';

  // User State
  const [user, setUser] = useState<{ id: string; name: string; role: 'TEACHER' | 'STUDENT' }>({
    id: 'usr_' + Math.random().toString(36).substring(2, 9),
    name: 'Student User',
    role: 'STUDENT',
  });

  // Room Connection State
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'loading' | 'synchronizing' | 'connected'>('connecting');
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Active Main Studio View Tab
  const [activeTab, setActiveTab] = useState<'video' | 'whiteboard' | 'coding' | 'teacher'>('video');

  // Active Sidebar Tab
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'doubt' | 'notes' | 'roster' | 'suggestions'>('chat');

  // Left Sidebar State
  const [leftSidebarTab, setLeftSidebarTab] = useState<'course' | 'progress' | 'homework' | 'files'>('course');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);

  // Media Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [handState, setHandState] = useState<HandState>('LOWERED');
  const [raisedHandsQueue, setRaisedHandsQueue] = useState<RaisedHandRequest[]>([]);
  const [handToastMessage, setHandToastMessage] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Media Stream & Permission States
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // WebRTC Remote Streams & Speaking State
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [speakingStates, setSpeakingStates] = useState<Record<string, boolean>>({});

  // WebRTC References (Stored in Refs to prevent React re-render loops & state mutations)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioDetectorsRef = useRef<Map<string, () => void>>(new Map());

  // Virtual Background & Video Segmentation Processor
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('original');
  const [virtualImage, setVirtualImage] = useState<string | null>(null);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const backgroundProcessorRef = useRef<VideoBackgroundProcessor | null>(null);
  const rawCameraStreamRef = useRef<MediaStream | null>(null);

  // Content States synced via Sockets
  const [whiteboardElements, setWhiteboardElements] = useState<WhiteboardElement[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notesText, setNotesText] = useState('# AI Classroom Notes\n\n- Lecture initialized.');
  const [topics, setTopics] = useState<LectureTopic[]>([]);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [isPublicAI, setIsPublicAI] = useState(false);

  // Private Doubts List
  const [privateDoubts, setPrivateDoubts] = useState<DoubtMessage[]>([]);

  // Modals
  const [activeQuiz, setActiveQuiz] = useState<QuizData | null>(null);
  const [showQuizCenterModal, setShowQuizCenterModal] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  // File Context Memory & UI Feedback
  const [fileContextMemory, setFileContextMemory] = useState<string>('');
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Create or Recreate RTCPeerConnection for a Target Peer
  const createPeerConnection = (targetSocketId: string, isInitiator: boolean): RTCPeerConnection => {
    const socket = getSocket();
    const currentStream = localStreamRef.current;

    // Clean up existing peer connection if present
    if (peerConnectionsRef.current.has(targetSocketId)) {
      try {
        peerConnectionsRef.current.get(targetSocketId)?.close();
      } catch (err) {
        console.warn('Closing old peer connection:', err);
      }
      peerConnectionsRef.current.delete(targetSocketId);
    }

    const pc = new RTCPeerConnection(getWebRTCConfiguration());
    peerConnectionsRef.current.set(targetSocketId, pc);

    // Attach all local tracks (video + audio) to the peer connection
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        pc.addTrack(track, currentStream);
      });
    }

    // ICE Candidate Exchange
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', {
          roomCode,
          targetSocketId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Receive Remote MediaStream & Setup Audio Activity Detection
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WebRTC] Received remote stream from ${targetSocketId}:`, {
            audioTracks: remoteStream.getAudioTracks().length,
            videoTracks: remoteStream.getVideoTracks().length,
          });
        }

        setRemoteStreams((prev) => ({
          ...prev,
          [targetSocketId]: remoteStream,
        }));

        // Attach audio activity detector for remote participant
        if (audioDetectorsRef.current.has(targetSocketId)) {
          audioDetectorsRef.current.get(targetSocketId)?.();
        }
        const cleanupDetector = createAudioActivityDetector(remoteStream, (isSpeaking) => {
          setSpeakingStates((prev) => ({ ...prev, [targetSocketId]: isSpeaking }));
        });
        audioDetectorsRef.current.set(targetSocketId, cleanupDetector);
      }
    };

    // Monitor Connection States & Handle ICE Restarts
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        console.warn(`[WebRTC] Connection to ${targetSocketId} failed. Attempting ICE restart...`);
        pc.restartIce();
      }
    };

    // If Initiator, create offer and send to remote peer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription) {
            socket.emit('webrtc-offer', {
              roomCode,
              targetSocketId,
              offer: {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
              },
            });
          }
        })
        .catch((err) => console.error(`[WebRTC Offer Error to ${targetSocketId}]`, err));
    }

    return pc;
  };

  const requestMediaPermissions = async (): Promise<MediaStream | null> => {
    try {
      setMediaError(null);
      const rawStream = await getLiveUserMediaStream({ video: true, audio: true });
      rawCameraStreamRef.current = rawStream;

      let streamToUse = rawStream;

      if (backgroundMode !== 'original' && backgroundProcessorRef.current) {
        try {
          await backgroundProcessorRef.current.start(rawStream);
          const processedTrack = backgroundProcessorRef.current.getProcessedTrack();
          const audioTrack = rawStream.getAudioTracks()[0];
          if (processedTrack) {
            streamToUse = new MediaStream([
              processedTrack,
              ...(audioTrack ? [audioTrack] : [])
            ]);
          }
        } catch (e) {
          console.warn('[Background Processing Error in getUserMedia]', e);
        }
      }

      setLocalStream(streamToUse);
      localStreamRef.current = streamToUse;

      // Attach audio detector for self
      const selfId = user.id;
      if (audioDetectorsRef.current.has(selfId)) {
        audioDetectorsRef.current.get(selfId)?.();
      }
      const cleanupSelf = createAudioActivityDetector(rawStream, (isSpeaking) => {
        setSpeakingStates((prev) => ({ ...prev, [selfId]: isSpeaking }));
      });
      audioDetectorsRef.current.set(selfId, cleanupSelf);

      // Add/Replace tracks in all active peer connections
      peerConnectionsRef.current.forEach((pc) => {
        streamToUse.getTracks().forEach((track) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(console.warn);
          } else {
            pc.addTrack(track, streamToUse);
          }
        });
      });

      return streamToUse;
    } catch (err: unknown) {
      console.warn('Media stream fallback:', err);
      return null;
    }
  };

  useEffect(() => {
    requestMediaPermissions();
  }, []);

  useEffect(() => {
    // Read local user session
    let currentUserSession = { id: user.id, name: user.name, role: user.role };
    const session = localStorage.getItem('user_session');
    if (session) {
      const parsed = JSON.parse(session);
      currentUserSession = {
        id: parsed.id,
        name: parsed.name,
        role: parsed.role || 'STUDENT',
      };
      setUser(currentUserSession);
    }

    // Seed local user immediately into participants if empty
    setParticipants((prev) => {
      if (prev.length === 0) {
        const selfParticipant: Participant = {
          socketId: 'self_' + currentUserSession.id,
          userId: currentUserSession.id,
          name: currentUserSession.name,
          role: currentUserSession.role,
          isMuted: false,
          isVideoOff: false,
          isHandRaised: false,
          isSpotlighted: false,
          joinedAt: Date.now(),
        };
        return [selfParticipant];
      }
      return prev;
    });

    // Step-by-step Connection Indicator Sequence
    setConnectionStatus('connecting');
    const t1 = setTimeout(() => setConnectionStatus('loading'), 400);
    const t2 = setTimeout(() => setConnectionStatus('synchronizing'), 900);
    const t3 = setTimeout(() => setConnectionStatus('connected'), 1400);

    const socket = getSocket();

    // Join socket room
    socket.emit('join-room', {
      roomCode,
      userId: currentUserSession.id,
      name: currentUserSession.name,
      role: currentUserSession.role,
    });

    // Socket Event Listeners
    socket.on('room-joined', (data) => {
      if (data.participants && data.participants.length > 0) {
        setParticipants(data.participants);

        // NOTE: We deliberately do NOT initiate offers to existing participants here.
        // Each existing participant will initiate an offer to us via their own
        // 'user-joined' handler below. If both sides initiated simultaneously
        // (offer collision / "glare"), each side's RTCPeerConnection would end up
        // in 'have-local-offer' state when the other side's offer arrives,
        // producing an invalid signaling state and a failed connection.
        // Keeping offer initiation one-directional (existing -> new) avoids this
        // entirely. Our side's peer connections are created reactively inside
        // the 'webrtc-offer' handler once each existing participant's offer arrives.
      }
      setWhiteboardElements(data.whiteboardElements || []);
      setChatMessages(data.chatMessages || []);
      setNotesText(data.notesText || '# AI Classroom Notes');
      if (data.topics && data.topics.length > 0) {
        setTopics(data.topics);
        setCurrentTopicIndex(data.currentTopicIndex || 0);
      }
      setIsPublicAI(!!data.isPublicAI);

      if (data.raisedHands && Array.isArray(data.raisedHands)) {
        setRaisedHandsQueue(data.raisedHands);
        const myReq = data.raisedHands.find((r: RaisedHandRequest) => r.userId === currentUserSession.id);
        if (myReq) {
          setHandState(myReq.state);
          setIsHandRaised(true);
        }
      }
    });

    socket.on('user-joined', (data: any) => {
      const participant: Participant = data.participant || data;
      if (participant && participant.socketId && participant.socketId !== socket.id) {
        setParticipants((prev) => [...prev.filter((p) => p.socketId !== participant.socketId), participant]);
        // Existing participant creates offer to newly joined participant
        createPeerConnection(participant.socketId, true);
      }
    });

    socket.on('user-left', ({ socketId }: { socketId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));

      // Close and clean up WebRTC peer connection
      if (peerConnectionsRef.current.has(socketId)) {
        try {
          peerConnectionsRef.current.get(socketId)?.close();
        } catch (err) {
          console.warn('Error closing peer connection on user-left:', err);
        }
        peerConnectionsRef.current.delete(socketId);
      }
      pendingCandidatesRef.current.delete(socketId);

      // Clean up audio detector
      if (audioDetectorsRef.current.has(socketId)) {
        audioDetectorsRef.current.get(socketId)?.();
        audioDetectorsRef.current.delete(socketId);
      }

      // Remove from remote streams & speaking states
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });

      setSpeakingStates((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    socket.on('participant-updated', (data: any) => {
      const participant: Participant = data.participant || data;
      if (participant && participant.socketId) {
        setParticipants((prev) =>
          prev.map((p) => (p.socketId === participant.socketId ? { ...p, ...participant } : p))
        );
      }
    });

    // Handle Incoming WebRTC Offer
    socket.on('webrtc-offer', async ({ senderSocketId, offer }: { senderSocketId: string; offer: RTCSessionDescriptionInit }) => {
      try {
        let pc = peerConnectionsRef.current.get(senderSocketId);
        if (!pc || pc.signalingState === 'closed') {
          pc = createPeerConnection(senderSocketId, false);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Flush any buffered ICE candidates for this peer
        const queuedCandidates = pendingCandidatesRef.current.get(senderSocketId) || [];
        for (const candidate of queuedCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
        }
        pendingCandidatesRef.current.delete(senderSocketId);

        // Create Answer and send back
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc-answer', {
          roomCode,
          targetSocketId: senderSocketId,
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
        });
      } catch (err) {
        console.error('[WebRTC Handle Offer Error]', err);
      }
    });

    // Handle Incoming WebRTC Answer
    socket.on('webrtc-answer', async ({ senderSocketId, answer }: { senderSocketId: string; answer: RTCSessionDescriptionInit }) => {
      try {
        const pc = peerConnectionsRef.current.get(senderSocketId);
        if (pc && pc.signalingState !== 'closed') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));

          // Flush any buffered ICE candidates for this peer
          const queuedCandidates = pendingCandidatesRef.current.get(senderSocketId) || [];
          for (const candidate of queuedCandidates) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
          }
          pendingCandidatesRef.current.delete(senderSocketId);
        }
      } catch (err) {
        console.error('[WebRTC Handle Answer Error]', err);
      }
    });

    // Handle Incoming WebRTC ICE Candidate
    socket.on('webrtc-ice-candidate', async ({ senderSocketId, candidate }: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
      try {
        const pc = peerConnectionsRef.current.get(senderSocketId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // Buffer candidate until remote description is set
          const queued = pendingCandidatesRef.current.get(senderSocketId) || [];
          queued.push(candidate);
          pendingCandidatesRef.current.set(senderSocketId, queued);
        }
      } catch (err) {
        console.warn('[WebRTC Add Candidate Error]', err);
      }
    });

    socket.on('whiteboard-update', ({ elements }) => {
      setWhiteboardElements(elements);
    });

    socket.on('whiteboard-clear', () => {
      setWhiteboardElements([]);
    });

    socket.on('new-message', ({ message }) => {
      setChatMessages((prev) => [...prev, message]);
    });

    socket.on('chat-updated', ({ chatMessages }) => {
      setChatMessages(chatMessages);
    });

    socket.on('notes-update', ({ notesText }) => {
      setNotesText(notesText);
    });

    socket.on('lecture-topics-updated', ({ topics, currentTopicIndex }) => {
      setTopics(topics);
      setCurrentTopicIndex(currentTopicIndex);
    });

    socket.on('topic-changed', ({ index }) => {
      setCurrentTopicIndex(index);
    });

    socket.on('public-ai-toggled', ({ enabled }) => {
      setIsPublicAI(enabled);
    });

    socket.on('quiz-started', ({ quiz }) => {
      setActiveQuiz(quiz);
    });

    socket.on('active-quiz-broadcast', (quiz: QuizData) => {
      setActiveQuiz(quiz);
    });

    socket.on('kicked-from-room', ({ message }: { message: string }) => {
      alert(message || 'You have been removed from the classroom session by the Teacher.');
      router.push('/dashboard');
    });

    socket.on('session-ended', ({ message }) => {
      alert(message);
      router.push('/dashboard');
    });

    socket.on('room-full', ({ message }) => {
      alert(message);
      router.push('/dashboard');
    });

    // Real-Time Hand Raise Queue & State Handlers
    socket.on('hand-raised-queue-updated', ({ raisedHands, latestRequest }: { raisedHands: RaisedHandRequest[]; latestRequest?: RaisedHandRequest }) => {
      setRaisedHandsQueue(raisedHands || []);

      if (user.role === 'TEACHER' && latestRequest && latestRequest.userId !== user.id) {
        setHandToastMessage(`✋ ${latestRequest.userName} raised their hand`);
        setTimeout(() => setHandToastMessage(null), 4000);
      }

      const myReq = raisedHands?.find((r: RaisedHandRequest) => r.userId === user.id);
      if (myReq) {
        setHandState(myReq.state);
        setIsHandRaised(myReq.state === 'RAISED' || myReq.state === 'ALLOWED' || myReq.state === 'QUESTIONING');
      } else {
        setHandState('LOWERED');
        setIsHandRaised(false);
      }
    });

    socket.on('hand-state-changed', ({ state }: { state: HandState }) => {
      setHandState(state);
      setIsHandRaised(state === 'RAISED' || state === 'ALLOWED' || state === 'QUESTIONING');
    });

    socket.on('question-allowed', ({ message, allowedBy }: { message: string; allowedBy: string }) => {
      setHandToastMessage(`🎤 ${allowedBy || 'Teacher'} allowed you to speak! You may ask your question.`);
      setHandState('ALLOWED');
      setIsHandRaised(true);
      setTimeout(() => setHandToastMessage(null), 6000);
    });

    socket.on('hand-dismissed', ({ message }: { message: string }) => {
      setHandToastMessage(message || 'Your hand request was dismissed.');
      setHandState('LOWERED');
      setIsHandRaised(false);
      setTimeout(() => setHandToastMessage(null), 4000);
    });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      socket.off('room-joined');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('participant-updated');
      socket.off('hand-raised-queue-updated');
      socket.off('hand-state-changed');
      socket.off('question-allowed');
      socket.off('hand-dismissed');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('whiteboard-update');
      socket.off('whiteboard-clear');
      socket.off('new-message');
      socket.off('chat-updated');
      socket.off('notes-update');
      socket.off('lecture-topics-updated');
      socket.off('topic-changed');
      socket.off('kicked-from-room');
      socket.off('active-quiz-broadcast');

      // Close all active WebRTC peer connections on unmount
      peerConnectionsRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch {
          // ignore
        }
      });
      peerConnectionsRef.current.clear();
      pendingCandidatesRef.current.clear();

      // Stop background segmentation processor
      backgroundProcessorRef.current?.stop();

      // Clean up all audio detectors
      audioDetectorsRef.current.forEach((cleanup) => cleanup());
      audioDetectorsRef.current.clear();
    };
  }, [roomCode, router]);

  // Handler Functions
  const handleToggleMedia = async (type: 'audio' | 'video') => {
    const socket = getSocket();

    if (type === 'audio') {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);

      const stream = localStreamRef.current || localStream;
      if (stream) {
        stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
      } else if (!nextMuted) {
        requestMediaPermissions().then((newStream) => {
          if (newStream) newStream.getAudioTracks().forEach((t) => (t.enabled = true));
        });
      }
      socket.emit('toggle-media', { roomCode, type: 'audio', value: nextMuted });
    } else {
      const nextVideoOff = !isVideoOff;
      setIsVideoOff(nextVideoOff);

      const stream = localStreamRef.current || localStream;
      if (stream) {
        const videoTracks = stream.getVideoTracks();
        const activeLiveTrack = videoTracks.find((t) => t.readyState === 'live');

        if (activeLiveTrack) {
          activeLiveTrack.enabled = !nextVideoOff;
        }

        if (rawCameraStreamRef.current) {
          rawCameraStreamRef.current.getVideoTracks().forEach((t) => {
            t.enabled = !nextVideoOff;
          });
        }
      } else if (!nextVideoOff) {
        requestMediaPermissions();
      }

      socket.emit('toggle-media', { roomCode, type: 'video', value: nextVideoOff });
    }
  };

  const handleSelectBackgroundMode = async (mode: BackgroundMode, virtualImageSrc?: string | null) => {
    setBackgroundMode(mode);
    if (virtualImageSrc) setVirtualImage(virtualImageSrc);

    const rawCamera = rawCameraStreamRef.current;
    if (!rawCamera) {
      console.warn('[Background Effects] No raw camera stream available.');
      return;
    }

    if (!backgroundProcessorRef.current) {
      backgroundProcessorRef.current = new VideoBackgroundProcessor();
    }

    const processor = backgroundProcessorRef.current;
    processor.setMode(mode, virtualImageSrc);

    if (mode === 'original') {
      const originalVideoTrack = rawCamera.getVideoTracks()[0];
      if (originalVideoTrack) {
        originalVideoTrack.enabled = !isVideoOff;
        console.log(`[Background Effects] Restoring original track ID: ${originalVideoTrack.id} to ${peerConnectionsRef.current.size} peer connections`);
        peerConnectionsRef.current.forEach((pc, peerSocketId) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(originalVideoTrack).then(() => {
              console.log(`[Background Effects] Successfully restored original track on peer ${peerSocketId}`);
            }).catch(console.warn);
          }
        });

        const audioTrack = rawCamera.getAudioTracks()[0];
        const newLocalStream = new MediaStream([
          originalVideoTrack,
          ...(audioTrack ? [audioTrack] : [])
        ]);
        localStreamRef.current = newLocalStream;
        setLocalStream(newLocalStream);
      }
    } else {
      setIsBackgroundLoading(true);
      try {
        await processor.start(rawCamera);
        const processedVideoTrack = processor.getProcessedTrack();

        if (processedVideoTrack) {
          processedVideoTrack.enabled = !isVideoOff;
          console.log(`[Background Effects] Swapping to processed track ID: ${processedVideoTrack.id} (kind: ${processedVideoTrack.kind}, readyState: ${processedVideoTrack.readyState}) across ${peerConnectionsRef.current.size} peer connections`);

          peerConnectionsRef.current.forEach((pc, peerSocketId) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(processedVideoTrack).then(() => {
                console.log(`[Background Effects] Successfully replaced track on peer ${peerSocketId} with processed track ${processedVideoTrack.id}`);
              }).catch(console.warn);
            }
          });

          const audioTrack = rawCamera.getAudioTracks()[0];
          const newLocalStream = new MediaStream([
            processedVideoTrack,
            ...(audioTrack ? [audioTrack] : [])
          ]);
          localStreamRef.current = newLocalStream;
          setLocalStream(newLocalStream);
        }
      } catch (err) {
        console.warn('[Background Processing Error]', err);
      } finally {
        setIsBackgroundLoading(false);
      }
    }
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      const socket = getSocket();
      socket.emit('toggle-media', { roomCode, type: 'screen', value: false });

      // Revert video track in all active peer connections back to camera
      const cameraTrack = (backgroundMode !== 'original' && backgroundProcessorRef.current)
        ? backgroundProcessorRef.current.getProcessedTrack()
        : (localStreamRef.current?.getVideoTracks()[0] || rawCameraStreamRef.current?.getVideoTracks()[0] || null);

      if (cameraTrack) {
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(cameraTrack).catch(console.warn);
          }
        });
      }
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setIsScreenSharing(true);
        const socket = getSocket();
        socket.emit('toggle-media', { roomCode, type: 'screen', value: true });

        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) {
          // Replace video track in all active peer connections with screen track
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack).catch(console.warn);
            }
          });

          screenTrack.onended = () => {
            setIsScreenSharing(false);
            socket.emit('toggle-media', { roomCode, type: 'screen', value: false });
            const camTrack = (backgroundMode !== 'original' && backgroundProcessorRef.current)
              ? backgroundProcessorRef.current.getProcessedTrack()
              : (localStreamRef.current?.getVideoTracks()[0] || rawCameraStreamRef.current?.getVideoTracks()[0] || null);
            if (camTrack) {
              peerConnectionsRef.current.forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
                if (sender) {
                  sender.replaceTrack(camTrack).catch(console.warn);
                }
              });
            }
          };
        }
      }
    } catch (err) {
      console.warn('[Screen Share Cancelled / Error]', err);
      setIsScreenSharing(false);
    }
  };

  const handleCopyRoomLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleToggleHand = () => {
    const socket = getSocket();
    if (handState === 'LOWERED' || handState === 'DISMISSED' || handState === 'COMPLETED') {
      setHandState('RAISED');
      setIsHandRaised(true);
      socket.emit('raise-hand', { roomCode });
    } else {
      setHandState('LOWERED');
      setIsHandRaised(false);
      socket.emit('lower-hand', { roomCode });
    }
  };

  const handleAllowStudent = (targetUserId: string) => {
    const socket = getSocket();
    socket.emit('allow-student-question', { roomCode, targetUserId });
  };

  const handleDismissStudent = (targetUserId: string) => {
    const socket = getSocket();
    socket.emit('dismiss-student-hand', { roomCode, targetUserId });
  };

  const handleCompleteQuestion = (targetUserId: string) => {
    const socket = getSocket();
    socket.emit('complete-student-question', { roomCode, targetUserId });
  };

  const handleSpotlight = (targetSocketId: string) => {
    const socket = getSocket();
    socket.emit('spotlight-user', { roomCode, targetSocketId });
  };

  const handleKickParticipant = (targetSocketId: string, targetUserId: string, targetName: string) => {
    if (window.confirm(`Are you sure you want to remove ${targetName} from the classroom session?`)) {
      const socket = getSocket();
      socket.emit('kick-participant', { roomCode, targetSocketId });
    }
  };

  const handleRemoteMute = (targetSocketId: string) => {
    const socket = getSocket();
    socket.emit('remote-mute', { roomCode, targetSocketId });
  };

  const handleBroadcastQuiz = (quiz: QuizData) => {
    const socket = getSocket();
    socket.emit('broadcast-quiz', { roomCode, quiz });
  };

  const handleWhiteboardUpdate = (elements: WhiteboardElement[]) => {
    setWhiteboardElements(elements);
    const socket = getSocket();
    socket.emit('whiteboard-update', { roomCode, elements });
  };

  const handleNotesUpdate = (newNotes: string) => {
    setNotesText(newNotes);
    const socket = getSocket();
    socket.emit('notes-update', { roomCode, notesText: newNotes });
  };

  const handleSendMessage = async (content: string, codeSnippet?: { language: string; code: string }) => {
    const socket = getSocket();
    const msg: ChatMessage = {
      id: 'msg_' + Date.now(),
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      content,
      codeSnippet,
      timestamp: Date.now(),
    };

    socket.emit('send-message', { roomCode, message: msg });

    // If Public AI is enabled and user asks a question, safely process via Question Queue
    if (isPublicAI && content.includes('?')) {
      const publicReqId = 'pub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      try {
        const result = await safeFetchJson<{ answer: string }>('/api/ai/doubt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: content,
            currentTopicContent: topics[currentTopicIndex]?.content,
            fileContextMemory,
            sourceFileName,
            requestId: publicReqId,
          }),
        });
        if (result.ok && result.data?.answer) {
          const aiMsg: ChatMessage = {
            id: 'ai_' + Date.now(),
            senderId: 'ai_tutor',
            senderName: 'AI Public Teacher',
            senderRole: 'TEACHER',
            content: result.data.answer,
            timestamp: Date.now(),
            isAI: true,
          };
          socket.emit('send-message', { roomCode, message: aiMsg });
        }
      } catch (err) {
        console.error('[Public AI Error]', err);
      }
    }
  };

  const handleUploadSyllabus = async (syllabusText: string) => {
    try {
      const result = await safeFetchJson<{ topics: LectureTopic[] }>('/api/ai/lecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syllabusText }),
      });
      if (result.ok && result.data?.topics) {
        setTopics(result.data.topics);
        setCurrentTopicIndex(0);
        const socket = getSocket();
        socket.emit('lecture-topics-updated', { roomCode, topics: result.data.topics });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangeTopicIndex = (index: number) => {
    setCurrentTopicIndex(index);
    const socket = getSocket();
    socket.emit('change-topic-index', { roomCode, index });
  };

  const handleSolvePrivateDoubt = async (
    question: string,
    mode: 'simple' | 'advanced' | 'repeat' = 'simple',
    customFileContext?: string,
    customSourceFile?: string,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    imageUrl?: string,
    requestId?: string
  ) => {
    const doubtReqId = requestId || 'dreq_' + Date.now();
    try {
      const result = await safeFetchJson<{ answer: string; structured?: any }>('/api/ai/doubt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          currentTopicContent: topics[currentTopicIndex]?.content,
          mode,
          fileContextMemory: customFileContext || fileContextMemory,
          sourceFileName: customSourceFile || sourceFileName,
          chatHistory,
          imageUrl,
          requestId: doubtReqId,
        }),
      });
      if (result.ok && result.data?.answer) {
        const doubtObj: DoubtMessage = {
          id: 'd_' + Date.now(),
          studentId: user.id,
          question,
          answer: result.data.answer,
          timestamp: Date.now(),
        };
        setPrivateDoubts((prev) => [...prev, doubtObj]);
      } else {

        throw new Error('Doubt solver returned empty response.');
      }
    } catch (err) {
      console.error('[Private Doubt Error]', err);
      throw err;
    }
  };

  const handleTriggerQuiz = () => {
    setShowQuizCenterModal(true);
  };

  const handleTriggerSummary = async () => {
    try {
      const result = await safeFetchJson<SummaryData>('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lectureHistory: topics.map((t) => t.content).join(' '),
        }),
      });
      if (result.ok && result.data) {
        setSummaryData(result.data);
        setShowSummary(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveRoom = () => {
    if (user.role === 'TEACHER') {
      if (confirm('End session for all participants?')) {
        const socket = getSocket();
        socket.emit('end-session', { roomCode });
        router.push('/dashboard');
      }
    } else {
      router.push('/dashboard');
    }
  };

  const handleUploadSuccess = (extractedContext: string, fileName: string) => {
    setFileContextMemory((prev) => prev + `\n\n[Context from ${fileName}]:\n${extractedContext}`);
    setSourceFileName(fileName);
    // Also notify the class via chat
    const socket = getSocket();
    socket.emit('send-message', {
      roomCode,
      message: `System: File uploaded to classroom context memory: ${fileName}`,
      role: 'TEACHER'
    });
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden relative select-none">
      {/* Top Classroom Bar */}
      <header className="h-14 bg-slate-900/90 border-b border-white/10 px-4 flex items-center justify-between shrink-0">
        {/* Left info & Back to Dashboard */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-white/10 text-xs flex items-center gap-1 transition"
            title="Back to Dashboard"
          >
            ← <span className="hidden sm:inline font-semibold">Dashboard</span>
          </button>

          <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyRoomLink}
                className="text-xs font-bold text-white flex items-center gap-1.5 hover:text-indigo-300 transition"
                title="Click to copy room invitation link"
              >
                <span>Room {roomCode}</span>
                <span className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-1.5 py-0.2 rounded border border-white/10">
                  {copiedLink ? '✓ Copied!' : '📋 Copy'}
                </span>
              </button>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                ● Live ({participants.length}/4)
              </span>
            </div>
            <p className="text-[10px] text-slate-400">AI Virtual Classroom Studio</p>
          </div>
        </div>

        {/* Center Main Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-white/10 text-xs">
          <button
            onClick={() => setActiveTab('video')}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'video' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video size={13} /> Video Grid
          </button>
          <button
            onClick={() => setActiveTab('teacher')}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'teacher' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={13} /> AI Teacher
          </button>
          <button
            onClick={() => setActiveTab('whiteboard')}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'whiteboard' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layout size={13} /> Whiteboard
          </button>
          <button
            onClick={() => setActiveTab('coding')}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'coding' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 size={13} /> Coding Mode
          </button>
        </div>

        {/* Right Tools & Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInviteModal(true)}
            className="text-xs bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
          >
            <UserPlus size={13} /> Invite
          </button>

          <button
            onClick={() => setShowAttendance(true)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-2.5 py-1.5 rounded-lg border border-white/10 flex items-center gap-1 transition"
          >
            <Users size={13} /> Attendance
          </button>

          <button
            onClick={handleTriggerQuiz}
            className="text-xs bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 font-bold px-3 py-1.5 rounded-lg border border-amber-500/40 flex items-center gap-1.5 shadow-sm transition"
          >
            <Trophy size={13} className="text-amber-400" />
            <span>AI Quiz</span>
          </button>

          <button
            onClick={handleTriggerSummary}
            className="text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold px-2.5 py-1.5 rounded-lg border border-indigo-500/30 flex items-center gap-1 transition"
          >
            <FileText size={13} /> Summary
          </button>
        </div>
      </header>

      {/* Studio Workspace Layout */}
      <div className="flex-1 flex min-h-0 p-3 gap-3">
        {/* Left Sidebar Panel (Course Navigation, Progress, Files) */}
        {isLeftSidebarOpen && (
          <LeftClassroomSidebar
            topics={topics}
            currentTopicIndex={currentTopicIndex}
            onChangeTopicIndex={handleChangeTopicIndex}
            isTeacher={user.role === 'TEACHER'}
            onOpenUploadModal={() => setShowUploadModal(true)}
            doubtsCount={privateDoubts.length}
            chatCount={chatMessages.length}
            onUploadSuccess={handleUploadSuccess}
            activeSourceDoc={sourceFileName}
            onSelectSourceDoc={(fileName) => setSourceFileName(fileName)}
          />
        )}

        {/* Main Workspace Stage */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          {/* Toggle Left Sidebar Button */}
          <button
            onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
            className="absolute top-2 -left-3 z-40 bg-slate-800 hover:bg-slate-700 text-slate-300 p-1 rounded-full border border-white/10 shadow-lg"
            title="Toggle Sidebar"
          >
             <Layout size={12} />
          </button>
          {activeTab === 'video' && (
            <VideoGrid
              participants={participants}
              currentUserId={user.id}
              isCurrentUserTeacher={user.role === 'TEACHER'}
              localStream={localStream}
              remoteStreams={remoteStreams}
              speakingStates={speakingStates}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              mediaError={mediaError}
              onRequestMediaPermissions={requestMediaPermissions}
              onSpotlight={handleSpotlight}
              onKickParticipant={handleKickParticipant}
              onRemoteMute={handleRemoteMute}
            />
          )}

          {activeTab === 'teacher' && (
            <AITeacherControl
              topics={topics}
              currentTopicIndex={currentTopicIndex}
              isTeacher={user.role === 'TEACHER'}
              onUploadSyllabus={handleUploadSyllabus}
              onChangeTopicIndex={handleChangeTopicIndex}
              onAskDoubt={(q) => {
                setSidebarTab('doubt');
                handleSolvePrivateDoubt(q, 'simple');
              }}
              fileContextMemory={fileContextMemory}
              sourceFileName={sourceFileName || undefined}
            />
          )}

          {activeTab === 'whiteboard' && (
            <Whiteboard
              elements={whiteboardElements}
              onUpdateElements={handleWhiteboardUpdate}
              onEmitLaser={() => {}}
            />
          )}

          {activeTab === 'coding' && <CodingPlayground />}
        </main>

        {/* Right Sidebar Panel */}
        <aside className="w-80 md:w-96 flex flex-col shrink-0 min-h-0">
          {/* Sidebar Tab Selector */}
          <div className="flex flex-wrap items-center bg-slate-900 p-1 rounded-xl border border-white/10 mb-2 text-[10px] shrink-0 gap-1">
            <button
              onClick={() => setSidebarTab('chat')}
              className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition min-w-[50px] ${
                sidebarTab === 'chat' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare size={12} /> Chat
            </button>
            <button
              onClick={() => setSidebarTab('doubt')}
              className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition min-w-[60px] ${
                sidebarTab === 'doubt' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot size={12} /> Private AI
            </button>
            <button
              onClick={() => setSidebarTab('notes')}
              className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition min-w-[50px] ${
                sidebarTab === 'notes' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText size={12} /> Notes
            </button>
            <button
              onClick={() => setSidebarTab('roster')}
              className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition min-w-[60px] ${
                sidebarTab === 'roster' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users size={12} /> Students
            </button>
            <button
              onClick={() => setSidebarTab('suggestions')}
              className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition min-w-[70px] ${
                sidebarTab === 'suggestions' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={12} /> AI Suggest
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 min-h-0">
            {sidebarTab === 'chat' && (
              <ChatPanel
                messages={chatMessages}
                currentUserId={user.id}
                currentUserName={user.name}
                currentUserRole={user.role}
                isPublicAI={isPublicAI}
                onSendMessage={handleSendMessage}
                onTogglePublicAI={(enabled) => {
                  setIsPublicAI(enabled);
                  getSocket().emit('toggle-public-ai', { roomCode, enabled });
                }}
                onPinMessage={(msgId) => getSocket().emit('pin-message', { roomCode, messageId: msgId })}
              />
            )}

            {sidebarTab === 'doubt' && (
              <PrivateAIDoubt
                currentTopic={topics[currentTopicIndex]}
                doubts={privateDoubts}
                onSolveDoubt={handleSolvePrivateDoubt}
                fileContextMemory={fileContextMemory}
                sourceFileName={sourceFileName || undefined}
              />
            )}

            {sidebarTab === 'notes' && (
              <NotesPanel notesText={notesText} onUpdateNotes={handleNotesUpdate} />
            )}

            {sidebarTab === 'roster' && (
              <div className="flex-1 bg-slate-900/50 rounded-xl border border-white/5 p-4 flex flex-col gap-3 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2"><Users size={14}/> Student Roster & Attendance</h3>
                <div className="space-y-2">
                  {participants.map(p => (
                    <div key={p.socketId} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-[10px]">{p.name.slice(0,2).toUpperCase()}</div>
                         <span className="text-slate-300 font-medium">{p.name} {p.userId === user.id && '(You)'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p.isMuted ? <MicOff size={12} className="text-red-400"/> : <Mic size={12} className="text-emerald-400"/>}
                        {p.isVideoOff ? <VideoOff size={12} className="text-red-400"/> : <Video size={12} className="text-emerald-400"/>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sidebarTab === 'suggestions' && (
              <div className="flex-1 bg-slate-900/50 rounded-xl border border-white/5 p-4 flex flex-col items-center justify-center text-center gap-3">
                <Bot size={32} className="text-indigo-400 opacity-50" />
                <h3 className="text-xs font-bold text-slate-300">Smart AI Suggestions</h3>
                <p className="text-[10px] text-slate-400 px-4">The AI will automatically suggest revisions, recommend videos, and generate examples based on the classroom context here.</p>
                <button className="text-[10px] bg-indigo-600/20 text-indigo-300 font-semibold px-3 py-1.5 rounded-lg border border-indigo-500/30">
                  Analyze Class Understanding
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Primary Floating Controls Dock (Zoom / Meet Standard) */}
      <footer className="h-16 bg-slate-900/95 backdrop-blur-md border-t border-white/10 px-6 flex items-center justify-between shrink-0 shadow-2xl z-30">
        {/* Left Status Indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[11px] text-slate-300">Studio Mesh Connected</span>
        </div>

        {/* Center Primary Media Dock */}
        <div className="flex items-center gap-2.5">
          {/* Primary Microphone Toggle */}
          <button
            onClick={() => handleToggleMedia('audio')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition shadow-lg ${
              isMuted
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
            title={isMuted ? 'Click to Unmute Microphone' : 'Click to Mute Microphone'}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Primary Camera Toggle */}
          <button
            onClick={() => handleToggleMedia('video')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition shadow-lg ${
              isVideoOff
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
            title={isVideoOff ? 'Click to Start Camera Video' : 'Click to Stop Camera Video'}
          >
            {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
            <span>{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
          </button>

          {/* Visual Background Effects (Google Meet style) */}
          <button
            onClick={() => setShowBackgroundModal(true)}
            className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition shadow-lg border ${
              backgroundMode !== 'original'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-400/50 shadow-indigo-600/30 ring-1 ring-indigo-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
            }`}
            title="Visual Background Effects (Blur, Remove, Virtual Backdrop)"
          >
            <Sparkles size={16} className={backgroundMode !== 'original' ? 'text-amber-300 animate-pulse' : 'text-slate-400'} />
            <span className="hidden md:inline">
              {backgroundMode === 'blur' ? 'Blur BG' : backgroundMode === 'remove' ? 'Studio BG' : backgroundMode === 'virtual' ? 'Virtual BG' : 'Background'}
            </span>
          </button>

          {/* Vertical Separator */}
          <div className="w-px h-8 bg-white/10 mx-1"></div>

          {/* Upload Files Control */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="p-2.5 rounded-2xl border font-bold text-xs flex items-center gap-1.5 transition bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10"
            title="Upload Files (PDF, Images, Docs)"
          >
            <UploadCloud size={16} />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* Voice Mode Control */}
          <button
            onClick={() => {
              setActiveTab('teacher');
            }}
            className={`p-2.5 rounded-2xl border font-bold text-xs flex items-center gap-1.5 transition ${
              activeTab === 'teacher'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
            }`}
            title="Switch to AI Teacher with Voice Mode"
          >
            <Bot size={16} />
            <span className="hidden sm:inline">Voice Mode</span>
          </button>

          {/* Screen Share Control */}
          <button
            onClick={handleToggleScreenShare}
            className={`p-2.5 rounded-2xl border font-bold text-xs flex items-center gap-1.5 transition ${
              isScreenSharing
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
            }`}
            title="Toggle Screen Share (WebRTC Display Media)"
          >
            <Share2 size={16} />
            <span className="hidden sm:inline">{isScreenSharing ? 'Sharing' : 'Share'}</span>
          </button>

          {/* Ask Question / Raise Hand Control */}
          <button
            onClick={handleToggleHand}
            className={`p-2.5 rounded-2xl border font-bold text-xs flex items-center gap-1.5 transition ${
              handState === 'ALLOWED'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 animate-pulse'
                : handState === 'RAISED'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
            }`}
            title={handState === 'RAISED' ? 'Click to Lower Hand' : 'Raise Hand / Ask Question'}
          >
            <Hand size={16} className={handState === 'RAISED' ? 'animate-bounce' : ''} />
            <span className="hidden sm:inline">
              {handState === 'ALLOWED' ? '🎤 Speaking Allowed' : handState === 'RAISED' ? '✋ Hand Raised' : 'Ask Question'}
            </span>
          </button>
        </div>

        {/* Right End/Leave Session Action */}
        <button
          onClick={handleLeaveRoom}
          className="bg-red-600/90 hover:bg-red-500 text-white font-bold px-5 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition"
        >
          <PhoneOff size={15} />
          <span>{user.role === 'TEACHER' ? 'End Session' : 'Leave Room'}</span>
        </button>
      </footer>

      {/* Modals */}
      {showInviteModal && (
        <InviteMembersModal
          roomCode={roomCode}
          participants={participants}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {showUploadModal && (
        <MultiUploadZone 
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={handleUploadSuccess}
        />
      )}
      {/* Unified Revamped AI & Custom Quiz Center Modal */}
      <AIQuizCenterModal
        isOpen={showQuizCenterModal || !!activeQuiz}
        onClose={() => {
          setShowQuizCenterModal(false);
          setActiveQuiz(null);
        }}
        initialTopic={topics[currentTopicIndex]?.title || 'Classroom Assessment'}
        initialQuiz={activeQuiz}
        onBroadcastQuiz={handleBroadcastQuiz}
        isTeacher={user.role === 'TEACHER'}
      />
      {showAttendance && <AttendanceModal participants={participants} onClose={() => setShowAttendance(false)} />}
      {showSummary && summaryData && <AISummaryModal summaryData={summaryData} onClose={() => setShowSummary(false)} />}
      
      {/* Visual Background Effects Modal */}
      <BackgroundEffectsModal
        isOpen={showBackgroundModal}
        onClose={() => setShowBackgroundModal(false)}
        currentMode={backgroundMode}
        currentVirtualImage={virtualImage}
        onSelectMode={handleSelectBackgroundMode}
        isLoading={isBackgroundLoading}
      />

      {/* Toast Notification for Hand-Raise events */}
      {handToastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white border border-amber-500/40 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <Hand size={18} className="text-amber-400 animate-bounce" />
          <span className="text-xs font-bold">{handToastMessage}</span>
          <button
            onClick={() => setHandToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Student Question Permission Banner */}
      {user.role === 'STUDENT' && handState === 'ALLOWED' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 border border-emerald-400">
          <Mic size={18} className="animate-pulse text-white" />
          <span className="text-xs font-bold">You may ask your question now!</span>
          {isMuted && (
            <button
              onClick={() => handleToggleMedia('audio')}
              className="px-3 py-1 bg-white text-emerald-950 font-black text-xs rounded-xl hover:bg-slate-100 transition shadow"
            >
              Unmute Mic
            </button>
          )}
          <button
            onClick={handleToggleHand}
            className="px-2.5 py-1 bg-emerald-800/90 hover:bg-emerald-900 text-white text-[11px] font-bold rounded-xl transition"
          >
            Lower Hand
          </button>
        </div>
      )}

      {/* Teacher Raised Hands Floating Queue Panel */}
      {user.role === 'TEACHER' && (
        <TeacherRaisedHandsPanel
          raisedHands={raisedHandsQueue}
          onAllowStudent={handleAllowStudent}
          onDismissStudent={handleDismissStudent}
          onCompleteQuestion={handleCompleteQuestion}
        />
      )}
    </div>
  );
}
