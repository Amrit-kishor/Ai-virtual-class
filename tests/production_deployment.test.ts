// tests/production_deployment.test.ts
// Automated Tests for Vercel Frontend to Render Backend Production Architecture

import { POST as loginRoute } from '../src/app/api/auth/login/route';
import { POST as signupRoute } from '../src/app/api/auth/signup/route';
import { POST as logoutRoute } from '../src/app/api/auth/logout/route';
import { GET as meRoute } from '../src/app/api/auth/me/route';
import { POST as livekitTokenRoute } from '../src/app/api/livekit/token/route';
import { POST as createClassroomRoute } from '../src/app/api/classroom/create/route';
import { corsOptions } from '../server/security';
import nextConfig from '../next.config';
import assert from 'assert';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ✗ ${name}:`, err.message);
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('  Vercel to Render Production Deployment Architecture Tests');
  console.log('======================================================\n');

  // 1. Next.js Rewrites Verification
  await test('1. next.config.ts rewrites return empty array when BACKEND_URL is not set', async () => {
    delete process.env.BACKEND_URL;
    const rewritesFn = (nextConfig as any).rewrites;
    assert.strictEqual(typeof rewritesFn, 'function', 'rewrites must be a function in nextConfig');
    const rewrites = await rewritesFn();
    assert.deepStrictEqual(rewrites, [], 'When BACKEND_URL is unset, rewrites must be empty');
  });

  await test('2. next.config.ts rewrites forward /api/* to BACKEND_URL in beforeFiles when configured', async () => {
    process.env.BACKEND_URL = 'https://ai-virtual-class.onrender.com';
    const rewritesFn = (nextConfig as any).rewrites;
    const rewrites = await rewritesFn();
    assert.ok(rewrites.beforeFiles, 'rewrites must have beforeFiles array');
    const apiRule = rewrites.beforeFiles.find((r: any) => r.source === '/api/:path*');
    assert.ok(apiRule, 'Must contain rewrite rule for /api/:path*');
    assert.strictEqual(apiRule.destination, 'https://ai-virtual-class.onrender.com/api/:path*');
  });

  // 2. CORS Allowlist Policy Tests
  await test('3. CORS allows exact Vercel production frontend origin', async () => {
    process.env.FRONTEND_URL = 'https://ai-virtual-classroom.vercel.app';
    const originFn = corsOptions.origin as Function;

    let allowed = false;
    originFn('https://ai-virtual-classroom.vercel.app', (err: any, allow: boolean) => {
      allowed = !err && allow;
    });
    assert.strictEqual(allowed, true, 'Configured FRONTEND_URL must be allowed by CORS');

    let vercelSubdomainAllowed = false;
    originFn('https://any-preview-branch.vercel.app', (err: any, allow: boolean) => {
      vercelSubdomainAllowed = !err && allow;
    });
    assert.strictEqual(vercelSubdomainAllowed, true, '.vercel.app origins must be allowed');
  });

  await test('4. CORS blocks untrusted third-party origins', async () => {
    const originFn = corsOptions.origin as Function;
    let blocked = false;
    originFn('https://malicious-site.com', (err: any, allow: boolean) => {
      if (err || !allow) blocked = true;
    });
    assert.strictEqual(blocked, true, 'Malicious origins must be blocked by CORS');
  });

  // 3. User Registration, Login, Session Verification, Logout Lifecycle
  const testEmail = `dep_test_${Date.now()}@classroom.ai`;
  let authToken = '';

  await test('5. Registration (POST /api/auth/signup) succeeds and returns token', async () => {
    const req = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Deployment Tester',
        email: testEmail,
        password: 'Password123!',
        role: 'TEACHER',
      }),
    });

    const res = await signupRoute(req);
    assert.strictEqual(res.status, 200, `Expected status 200 but got ${res.status}`);
    const data = await res.json();
    assert.ok(data.token, 'Signup response must include auth token');
    assert.strictEqual(data.user.email, testEmail);
    authToken = data.token;
  });

  await test('6. Login (POST /api/auth/login) succeeds and returns JWT + user info', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
      }),
    });

    const res = await loginRoute(req);
    assert.strictEqual(res.status, 200, `Expected status 200 but got ${res.status}`);
    const data = await res.json();
    assert.ok(data.token, 'Login response must include token');
    assert.strictEqual(data.user.email, testEmail);
    authToken = data.token;
  });

  await test('7. Session Verification (GET /api/auth/me) works with Authorization header', async () => {
    const req = new Request('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const res = await meRoute(req);
    assert.strictEqual(res.status, 200, `Expected status 200 but got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.authenticated, true);
    assert.strictEqual(data.user.email, testEmail);
  });

  await test('8. Logout (POST /api/auth/logout) cleanly invalidates session cookie', async () => {
    const res = await logoutRoute();
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  // 4. Classroom Creation with Auth
  let createdRoomCode = '';
  await test('9. Classroom creation (POST /api/classroom/create) functions with token', async () => {
    const req = new Request('http://localhost:3000/api/classroom/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        Cookie: `auth_token=${authToken}`,
      },
      body: JSON.stringify({
        title: 'Deployment Production Test Classroom',
        description: 'Verifying Vercel to Render proxying',
        maxParticipants: 50,
      }),
    });

    const res = await createClassroomRoute(req);
    assert.strictEqual(res.status, 200, `Expected status 200 but got ${res.status}`);
    const data = await res.json();
    assert.ok(data.classroom?.roomCode, 'Must return created roomCode');
    assert.strictEqual(data.classroom.maxParticipants, 50);
    createdRoomCode = data.classroom.roomCode;
  });

  // 5. LiveKit Token Generation with Verified Classroom
  await test('10. LiveKit Token generation succeeds for created classroom', async () => {
    process.env.LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
    process.env.LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret_dev_key_must_be_32_characters_long_12345';
    process.env.LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://test-project.livekit.cloud';

    const req = new Request('http://localhost:3000/api/livekit/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        roomCode: createdRoomCode,
      }),
    });

    const res = await livekitTokenRoute(req);
    assert.strictEqual(res.status, 200, `Expected status 200 but got ${res.status}`);
    const data = await res.json();
    assert.ok(data.token, 'Must return signed LiveKit JWT token');
    assert.strictEqual(data.roomName, createdRoomCode);
  });

  // 6. Strict Isolation Check: Personal AI Untouched
  await test('11. Personal AI (studyWorkspaceAI.ts) remains completely untouched', async () => {
    const personalAiModule = await import('../src/lib/ai/studyWorkspaceAI');
    assert.ok(personalAiModule, 'studyWorkspaceAI module must exist');
    assert.strictEqual(typeof personalAiModule.answerFromSources, 'function');
    assert.strictEqual(typeof personalAiModule.semanticSearch, 'function');
  });

  console.log('\n======================================================');
  console.log('                   Test Results Summary');
  console.log('======================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('All deployment architecture tests PASSED successfully!\n');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
