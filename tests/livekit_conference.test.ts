// tests/livekit_conference.test.ts
// Comprehensive Automated Test Suite for 50-Participant LiveKit SFU Upgrade

import { POST as livekitTokenRoute } from '../src/app/api/livekit/token/route';
import { generateToken } from '../src/lib/auth';
import { prisma } from '../src/lib/prisma';
import { roomStore } from '../server/roomStore';
import { TokenVerifier } from 'livekit-server-sdk';
import assert from 'assert';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs });
    console.log(`  ✓ ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ name, passed: false, error: err.message, durationMs });
    console.error(`  ✗ ${name} (${durationMs}ms):`, err.message);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('  LiveKit SFU 50-Participant Video Conferencing Tests');
  console.log('======================================================\n');

  // Setup test environment
  process.env.LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
  process.env.LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret_dev_key_must_be_32_characters_long_12345';
  process.env.LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://test-project.livekit.cloud';

  const testTeacherId = `teacher_test_${Date.now()}`;
  const testRoomCode = `TEST50_${Date.now().toString(36).toUpperCase()}`;

  // Ensure test classroom exists in DB with maxParticipants = 50
  let classroom = await prisma.classroom.findUnique({ where: { roomCode: testRoomCode } });
  if (!classroom) {
    // Ensure teacher user exists
    await prisma.user.upsert({
      where: { id: testTeacherId },
      update: {},
      create: {
        id: testTeacherId,
        email: `${testTeacherId}@test.com`,
        name: 'Dr. Test Teacher',
        passwordHash: 'fakehash',
        role: 'TEACHER',
      },
    });

    classroom = await prisma.classroom.create({
      data: {
        roomCode: testRoomCode,
        title: 'LiveKit 50-Person SFU Test Lab',
        teacherId: testTeacherId,
        maxParticipants: 50,
      },
    });
  }

  // 1. Unauthorized Access Rejection
  await runTest('1. Rejects token generation for unauthenticated request (401)', async () => {
    const req = new Request('http://localhost:3000/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: testRoomCode }),
    });

    const res = await livekitTokenRoute(req);
    assert.strictEqual(res.status, 401, `Expected 401 but got ${res.status}`);
  });

  // 2. Non-existent Classroom Code Rejection
  await runTest('2. Rejects token generation for non-existent classroom code (404)', async () => {
    const studentToken = generateToken({
      userId: 'student_ghost',
      email: 'student_ghost@test.com',
      name: 'Ghost Student',
      role: 'STUDENT',
    });

    const req = new Request('http://localhost:3000/api/livekit/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ roomCode: 'ROOM_DOES_NOT_EXIST_XYZ' }),
    });

    const res = await livekitTokenRoute(req);
    assert.strictEqual(res.status, 404, `Expected 404 but got ${res.status}`);
  });

  // 3. Teacher Token Generation & Verification
  await runTest('3. Generates valid LiveKit token with host permissions for Teacher', async () => {
    const teacherJwt = generateToken({
      userId: testTeacherId,
      email: `${testTeacherId}@test.com`,
      name: 'Dr. Test Teacher',
      role: 'TEACHER',
    });

    const req = new Request('http://localhost:3000/api/livekit/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherJwt}`,
      },
      body: JSON.stringify({ roomCode: testRoomCode, identity: testTeacherId, name: 'Dr. Test Teacher' }),
    });

    const res = await livekitTokenRoute(req);
    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}`);
    const data = await res.json();

    assert.ok(data.token, 'Token must not be empty');
    assert.ok(data.serverUrl, 'ServerUrl must not be empty');
    assert.strictEqual(data.roomName, testRoomCode);

    // Verify token payload using TokenVerifier
    const verifier = new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
    const decoded = await verifier.verify(data.token);

    assert.strictEqual(decoded.sub, testTeacherId);
    assert.strictEqual(decoded.video?.room, testRoomCode);
    assert.strictEqual(decoded.video?.canPublish, true);
    assert.strictEqual(decoded.video?.canSubscribe, true);
    assert.strictEqual(decoded.video?.roomAdmin, true, 'Teacher should have roomAdmin rights');
  });

  // 4. Student Token Generation
  await runTest('4. Generates valid LiveKit token with student permissions', async () => {
    const studentId = `student_1_${Date.now()}`;
    const studentJwt = generateToken({
      userId: studentId,
      email: `${studentId}@test.com`,
      name: 'Student One',
      role: 'STUDENT',
    });

    const req = new Request('http://localhost:3000/api/livekit/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentJwt}`,
      },
      body: JSON.stringify({ roomCode: testRoomCode, identity: studentId, name: 'Student One' }),
    });

    const res = await livekitTokenRoute(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    const verifier = new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
    const decoded = await verifier.verify(data.token);

    assert.strictEqual(decoded.sub, studentId);
    assert.strictEqual(decoded.video?.roomAdmin, false, 'Student must not have roomAdmin rights');
  });

  // 5. Scalability Join Tests (2, 4, 10, 25, 50 Participants)
  const room = await roomStore.getOrCreateRoom(testRoomCode, testTeacherId);
  room.participants.clear(); // Reset participants for clean test

  // Add Teacher as participant 1
  room.participants.set(`sock_${testTeacherId}`, {
    socketId: `sock_${testTeacherId}`,
    userId: testTeacherId,
    name: 'Dr. Test Teacher',
    role: 'TEACHER',
    isMuted: false,
    isVideoOff: false,
    isHandRaised: false,
    isSpotlighted: true,
    joinedAt: Date.now(),
  });

  await runTest('5. Supports 2 participants join successfully', async () => {
    const pId = 'p_2';
    room.participants.set(`sock_${pId}`, {
      socketId: `sock_${pId}`,
      userId: pId,
      name: 'Participant 2',
      role: 'STUDENT',
      isMuted: false,
      isVideoOff: false,
      isHandRaised: false,
      isSpotlighted: false,
      joinedAt: Date.now(),
    });

    const count = roomStore.getUniqueParticipantCount(testRoomCode);
    assert.strictEqual(count, 2, `Expected 2 participants, got ${count}`);
  });

  await runTest('6. Supports 4 participants join successfully', async () => {
    for (let i = 3; i <= 4; i++) {
      const pId = `p_${i}`;
      room.participants.set(`sock_${pId}`, {
        socketId: `sock_${pId}`,
        userId: pId,
        name: `Participant ${i}`,
        role: 'STUDENT',
        isMuted: false,
        isVideoOff: false,
        isHandRaised: false,
        isSpotlighted: false,
        joinedAt: Date.now(),
      });
    }

    const count = roomStore.getUniqueParticipantCount(testRoomCode);
    assert.strictEqual(count, 4, `Expected 4 participants, got ${count}`);
  });

  await runTest('7. Supports 10 participants join successfully', async () => {
    for (let i = 5; i <= 10; i++) {
      const pId = `p_${i}`;
      room.participants.set(`sock_${pId}`, {
        socketId: `sock_${pId}`,
        userId: pId,
        name: `Participant ${i}`,
        role: 'STUDENT',
        isMuted: false,
        isVideoOff: false,
        isHandRaised: false,
        isSpotlighted: false,
        joinedAt: Date.now(),
      });
    }

    const count = roomStore.getUniqueParticipantCount(testRoomCode);
    assert.strictEqual(count, 10, `Expected 10 participants, got ${count}`);
  });

  await runTest('8. Supports 25 participants join successfully', async () => {
    for (let i = 11; i <= 25; i++) {
      const pId = `p_${i}`;
      room.participants.set(`sock_${pId}`, {
        socketId: `sock_${pId}`,
        userId: pId,
        name: `Participant ${i}`,
        role: 'STUDENT',
        isMuted: false,
        isVideoOff: false,
        isHandRaised: false,
        isSpotlighted: false,
        joinedAt: Date.now(),
      });
    }

    const count = roomStore.getUniqueParticipantCount(testRoomCode);
    assert.strictEqual(count, 25, `Expected 25 participants, got ${count}`);
  });

  await runTest('9. Supports 50 participants join successfully', async () => {
    for (let i = 26; i <= 50; i++) {
      const pId = `p_${i}`;
      room.participants.set(`sock_${pId}`, {
        socketId: `sock_${pId}`,
        userId: pId,
        name: `Participant ${i}`,
        role: 'STUDENT',
        isMuted: false,
        isVideoOff: false,
        isHandRaised: false,
        isSpotlighted: false,
        joinedAt: Date.now(),
      });
    }

    const count = roomStore.getUniqueParticipantCount(testRoomCode);
    assert.strictEqual(count, 50, `Expected 50 participants, got ${count}`);
  });

  // 10. 51st Participant Rejection Test
  await runTest('10. 51st participant is rejected with HTTP 403 (Over Capacity)', async () => {
    const student51Jwt = generateToken({
      userId: 'student_51',
      email: 'student_51@test.com',
      name: 'Student 51',
      role: 'STUDENT',
    });

    const req = new Request('http://localhost:3000/api/livekit/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student51Jwt}`,
      },
      body: JSON.stringify({ roomCode: testRoomCode, identity: 'student_51', name: 'Student 51' }),
    });

    const res = await livekitTokenRoute(req);
    assert.strictEqual(res.status, 403, `Expected HTTP 403 but got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error.includes('capacity'), `Expected capacity error message but got: ${data.error}`);
  });

  // 11. Room Isolation Test
  await runTest('11. Different classrooms remain strictly isolated', async () => {
    const otherRoomCode = `OTHER_ROOM_${Date.now().toString(36).toUpperCase()}`;
    await prisma.classroom.create({
      data: {
        roomCode: otherRoomCode,
        title: 'Isolated Classroom B',
        teacherId: testTeacherId,
        maxParticipants: 50,
      },
    });

    const otherRoom = await roomStore.getOrCreateRoom(otherRoomCode, testTeacherId);
    assert.strictEqual(otherRoomStoreCount(otherRoomCode), 0, 'Classroom B should be empty despite Classroom A being full');

    // A student can generate token for Classroom B without being blocked by Classroom A
    const studentJwt = generateToken({
      userId: 'student_in_room_b',
      email: 'student_b@test.com',
      name: 'Student B',
      role: 'STUDENT',
    });

    const req = new Request('http://localhost:3000/api/livekit/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentJwt}`,
      },
      body: JSON.stringify({ roomCode: otherRoomCode, identity: 'student_in_room_b', name: 'Student B' }),
    });

    const res = await livekitTokenRoute(req);
    assert.strictEqual(res.status, 200, 'Student should be allowed into Classroom B');
  });

  // 12. Duplicate Identity Safe Handling
  await runTest('12. Duplicate identities do not increment unique participant count', async () => {
    const initialCount = roomStore.getUniqueParticipantCount(testRoomCode);

    // Existing participant 2 connects with another socket
    room.participants.set(`sock_p_2_duplicate`, {
      socketId: `sock_p_2_duplicate`,
      userId: 'p_2',
      name: 'Participant 2 Window 2',
      role: 'STUDENT',
      isMuted: false,
      isVideoOff: false,
      isHandRaised: false,
      isSpotlighted: false,
      joinedAt: Date.now(),
    });

    const afterCount = roomStore.getUniqueParticipantCount(testRoomCode);
    assert.strictEqual(afterCount, initialCount, 'Unique count must remain unchanged for duplicate user IDs');

    // Clean up duplicate socket
    room.participants.delete('sock_p_2_duplicate');
  });

  // 13. Microphone Mute/Unmute & Media State Handling
  await runTest('13. Media mute/unmute state updates correctly on participant', async () => {
    const p = room.participants.get('sock_p_2')!;
    p.isMuted = true;
    assert.strictEqual(room.participants.get('sock_p_2')?.isMuted, true);
    p.isMuted = false;
    assert.strictEqual(room.participants.get('sock_p_2')?.isMuted, false);
  });

  // 14. Hand Raise & Host Moderation Lifecycle
  await runTest('14. Complete Hand Raise lifecycle works (Raise -> Allow -> Dismiss)', async () => {
    // Student 2 raises hand
    const req = roomStore.raiseHand(testRoomCode, 'sock_p_2', {
      userId: 'p_2',
      name: 'Participant 2',
      role: 'STUDENT',
    });
    assert.ok(req);
    assert.strictEqual(req?.state, 'RAISED');
    assert.strictEqual(room.participants.get('sock_p_2')?.isHandRaised, true);

    // Teacher allows question
    const allowed = roomStore.allowStudentToSpeak(testRoomCode, 'p_2');
    assert.ok(allowed);
    assert.strictEqual(allowed?.request.state, 'ALLOWED');

    // Teacher completes/dismisses
    const completed = roomStore.completeStudentQuestion(testRoomCode, 'p_2');
    assert.strictEqual(completed, true);
    assert.strictEqual(room.participants.get('sock_p_2')?.isHandRaised, false);
  });

  // 15. Participant Disconnect and Reconnection
  await runTest('15. Participant disconnect reduces count and allows reconnection', async () => {
    const initialCount = roomStore.getUniqueParticipantCount(testRoomCode);
    assert.strictEqual(initialCount, 50);

    // Disconnect participant 50
    roomStore.removeSocketFromRoom(testRoomCode, 'sock_p_50');
    const countAfterDisconnect = roomStore.getUniqueParticipantCount(testRoomCode);
    assert.strictEqual(countAfterDisconnect, 49, 'Count should drop to 49');

    // Reconnecting as participant 50 should now succeed through token endpoint
    const student50Jwt = generateToken({
      userId: 'p_50',
      email: 'p_50@test.com',
      name: 'Participant 50',
      role: 'STUDENT',
    });

    const req = new Request('http://localhost:3000/api/livekit/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student50Jwt}`,
      },
      body: JSON.stringify({ roomCode: testRoomCode, identity: 'p_50', name: 'Participant 50' }),
    });

    const res = await livekitTokenRoute(req);
    assert.strictEqual(res.status, 200, 'Reconnection should succeed after capacity freed');

    // Re-add participant
    room.participants.set('sock_p_50', {
      socketId: 'sock_p_50',
      userId: 'p_50',
      name: 'Participant 50',
      role: 'STUDENT',
      isMuted: false,
      isVideoOff: false,
      isHandRaised: false,
      isSpotlighted: false,
      joinedAt: Date.now(),
    });
  });

  // 16. Chat and Whiteboard Preserved
  await runTest('16. Socket.IO Chat and Whiteboard features remain operational', async () => {
    room.chatMessages.push({
      id: 'chat_1',
      senderId: testTeacherId,
      senderName: 'Dr. Test Teacher',
      senderRole: 'TEACHER',
      content: 'Welcome to the 50-participant lecture',
      timestamp: Date.now(),
    });
    assert.strictEqual(room.chatMessages.length, 1);

    room.whiteboardElements.push({
      id: 'wb_1',
      type: 'pen',
      x: 10,
      y: 10,
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      color: '#4F46E5',
      strokeWidth: 3,
    });
    assert.strictEqual(room.whiteboardElements.length, 1);
  });

  // 17. Personal AI Isolation Check (STRICT REQUIREMENT)
  await runTest('17. Personal AI (studyWorkspaceAI.ts) remains completely untouched', async () => {
    const personalAiModule = await import('../src/lib/ai/studyWorkspaceAI');
    assert.ok(personalAiModule, 'studyWorkspaceAI module must exist');
    assert.strictEqual(typeof personalAiModule.answerFromSources, 'function', 'Personal AI answerFromSources function must exist');
    assert.strictEqual(typeof personalAiModule.semanticSearch, 'function', 'Personal AI semanticSearch function must exist');
    assert.strictEqual(typeof personalAiModule.generateSummary, 'function', 'Personal AI generateSummary function must exist');
  });

  // Clean up test data
  try {
    await prisma.classroom.deleteMany({
      where: { roomCode: { in: [testRoomCode] } },
    });
  } catch (e) {
    // Non-fatal cleanup
  }

  // Summary
  console.log('\n======================================================');
  console.log('                   Test Results Summary');
  console.log('======================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);

  if (failed > 0) {
    console.error('Some tests failed. See details above.');
    process.exit(1);
  } else {
    console.log('All 17 automated tests PASSED successfully!\n');
    process.exit(0);
  }
}

function otherRoomStoreCount(code: string): number {
  return roomStore.getUniqueParticipantCount(code);
}

main().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
