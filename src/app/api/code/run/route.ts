import { NextResponse } from 'next/server';
import { reviewCodeSnippet } from '@/lib/ai/openai';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// ── Runtime availability detection (cached per process) ──────────
const _runtimeCache: Record<string, boolean> = {};
function runtimeAvailable(cmd: string): boolean {
  if (_runtimeCache[cmd] === undefined) {
    try {
      if (cmd === 'g++' || cmd === 'gcc' || cmd === 'clang++' || cmd === 'python3' || cmd === 'python' || cmd === 'node') {
        execSync(`${cmd} --version`, { stdio: 'ignore' });
      } else if (cmd === 'javac' || cmd === 'java') {
        execSync(`${cmd} -version`, { stdio: 'ignore' });
      } else {
        execSync(`which ${cmd}`, { stdio: 'ignore' });
      }
      _runtimeCache[cmd] = true;
    } catch {
      _runtimeCache[cmd] = false;
    }
  }
  return _runtimeCache[cmd];
}

// ── C++ compiler detection (g++ preferred, clang++ fallback) ─────
function getCppCompiler(): string | null {
  if (runtimeAvailable('g++')) return 'g++';
  if (runtimeAvailable('clang++')) return 'clang++';
  return null;
}

// Serverless-safe sandbox directory in /tmp
const TEMP_DIR = path.join(os.tmpdir(), 'classroom_code_sandbox');

try {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
} catch {
  // Ignore in restricted environments
}

// ── Resource limits ────────────────────────────────────────────────
const COMPILE_TIMEOUT_MS = 8000;       // compiler (g++/javac) can be slow on first run
const RUN_TIMEOUT_MS     = 5000;       // hard wall-clock cap for user code execution
const MAX_OUTPUT_BYTES   = 512 * 1024; // 512 KB stdout/stderr cap prevents memory exhaustion

// ── Structured response type ───────────────────────────────────────
type ExecutionStatus = 'success' | 'compile_error' | 'runtime_error' | 'timeout' | 'compiler_unavailable' | 'execution_error';


// ── Shared exec options with security limits ───────────────────────
function execOptions(timeoutMs: number) {
  return {
    timeout: timeoutMs,
    maxBuffer: MAX_OUTPUT_BYTES,
    killSignal: 'SIGKILL' as const,
    encoding: 'utf8' as const,
  };
}

// ── Platform-safe binary invocation ───────────────────────────────
// On Windows: use path directly. On Unix: wrap in quotes (spaces in path).
function binaryCmd(binPath: string): string {
  return os.platform() === 'win32' ? `"${binPath}"` : `"${binPath}"`;
}

// ── Truncate runaway output ────────────────────────────────────────
function truncate(s: string, max = 8000): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n\n[... output truncated at ${max} characters ...]`;
}

// ── Safe recursive cleanup ─────────────────────────────────────────
function safeUnlink(...paths: string[]) {
  for (const p of paths) {
    try { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { code, language, stdin } = body as { code?: unknown; language?: unknown; stdin?: unknown };

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: 'Code content is required.' }, { status: 400 });
    }

    const lang = (typeof language === 'string' ? language : 'javascript').toLowerCase();
    const stdinInput = typeof stdin === 'string' ? stdin : '';
    const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Optional: Forward to dedicated backend code execution server if configured
    const remoteBackend =
      process.env.CODE_EXECUTION_BACKEND_URL ||
      process.env.NEXT_PUBLIC_CODE_EXECUTION_URL ||
      process.env.BACKEND_URL;

    if (remoteBackend && typeof remoteBackend === 'string' && !remoteBackend.includes('localhost') && !remoteBackend.includes('127.0.0.1')) {
      try {
        const remoteRes = await fetch(`${remoteBackend.replace(/\/$/, '')}/api/code/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language: lang, stdin: stdinInput }),
        });
        if (remoteRes.ok) {
          const remoteData = await remoteRes.json();
          return NextResponse.json(remoteData);
        }
      } catch (remoteErr) {
        console.error('[Remote Code Execution Forward Failed, falling back to local runner]', remoteErr);
      }
    }

    let status: ExecutionStatus = 'success';
    let stdout = '';
    let stderr = '';

    // Helper: exec with optional stdin pipe.
    // Returns { stdout: string, stderr: string } always.
    async function execWithStdin(
      cmd: string,
      opts: object,
      input?: string
    ): Promise<{ stdout: string; stderr: string }> {
      const execOpts = opts as Parameters<typeof execAsync>[1];
      let raw: { stdout: string | Buffer; stderr: string | Buffer };
      if (!input || !input.trim()) {
        raw = await execAsync(cmd, execOpts);
      } else {
        // Pipe stdin by writing it to a temp file and using shell redirection
        const stdinFile = path.join(TEMP_DIR, `stdin_${fileId}.txt`);
        fs.writeFileSync(stdinFile, input, 'utf-8');
        try {
          raw = await execAsync(`${cmd} < "${stdinFile}"`, execOpts);
        } finally {
          safeUnlink(stdinFile);
        }
      }
      return {
        stdout: raw.stdout?.toString() ?? '',
        stderr: raw.stderr?.toString() ?? '',
      };
    }

    // ── JavaScript / Node.js ─────────────────────────────────────────
    if (lang === 'javascript' || lang === 'js' || lang === 'node') {
      const filePath = path.join(TEMP_DIR, `script_${fileId}.js`);
      try {
        fs.writeFileSync(filePath, code, 'utf-8');
        const result = await execWithStdin(`node "${filePath}"`, execOptions(RUN_TIMEOUT_MS), stdinInput);
        stdout = result.stdout || '';
        stderr = result.stderr || '';
        status = 'success';
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; killed?: boolean };
        stdout = e.stdout || '';
        stderr = e.stderr || '';
        status = e.killed ? 'timeout' : 'runtime_error';
      } finally {
        safeUnlink(filePath);
      }

    // ── Python ────────────────────────────────────────────────────────
    } else if (lang === 'python' || lang === 'py') {
      const pythonCmd = runtimeAvailable('python3') ? 'python3' : runtimeAvailable('python') ? 'python' : null;
      if (!pythonCmd) {
        return NextResponse.json({
          status: 'compiler_unavailable',
          output: '',
          stderr: 'Python interpreter (python3/python) is not installed on this server environment.',
          executionTimeMs: Date.now() - startTime,
          aiReview: '',
        });
      }
      const filePath = path.join(TEMP_DIR, `script_${fileId}.py`);
      try {
        fs.writeFileSync(filePath, code, 'utf-8');
        const result = await execWithStdin(`${pythonCmd} "${filePath}"`, execOptions(RUN_TIMEOUT_MS), stdinInput);
        stdout = result.stdout || '';
        stderr = result.stderr || '';
        status = 'success';
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; killed?: boolean };
        stdout = e.stdout || '';
        stderr = e.stderr || '';
        status = e.killed ? 'timeout' : 'runtime_error';
      } finally {
        safeUnlink(filePath);
      }

    // ── C++ ───────────────────────────────────────────────────────────
    } else if (lang === 'cpp' || lang === 'c++') {
      const srcPath = path.join(TEMP_DIR, `main_${fileId}.cpp`);
      const binPath = path.join(TEMP_DIR, `bin_${fileId}`);
      try {
        fs.writeFileSync(srcPath, code, 'utf-8');

        // Step 1: Compile — auto-detect compiler
        const compiler = getCppCompiler();
        if (!compiler) {
          return NextResponse.json({
            status: 'compiler_unavailable',
            output: '',
            stderr: 'No C++ compiler found on this server. Neither g++ nor clang++ is installed in this environment.',
            executionTimeMs: Date.now() - startTime,
            aiReview: '',
          });
        }
        try {
          const compileResult = await execAsync(
            `${compiler} -std=c++17 -O2 "${srcPath}" -o "${binPath}"`,
            execOptions(COMPILE_TIMEOUT_MS)
          );
          stderr = compileResult.stderr || ''; // warnings even on success
        } catch (compileErr: unknown) {
          const ce = compileErr as { stdout?: string; stderr?: string; killed?: boolean };
          return NextResponse.json({
            status: ce.killed ? 'timeout' : 'compile_error',
            output: ce.stdout || '',
            stderr: truncate(ce.stderr || 'C++ compilation failed.'),
            executionTimeMs: Date.now() - startTime,
            aiReview: '',
          });
        }

        // Step 2: Run the compiled binary
        try {
          const runResult = await execWithStdin(binaryCmd(binPath), execOptions(RUN_TIMEOUT_MS), stdinInput);
          stdout = runResult.stdout || '';
          stderr += runResult.stderr || '';
          status = 'success';
        } catch (runErr: unknown) {
          const re = runErr as { stdout?: string; stderr?: string; killed?: boolean };
          stdout = re.stdout || '';
          stderr += re.stderr || '';
          status = re.killed ? 'timeout' : 'runtime_error';
        }
      } finally {
        safeUnlink(srcPath, binPath);
      }

    // ── Java ──────────────────────────────────────────────────────────
    } else if (lang === 'java') {
      // Check Java runtime availability before attempting compilation
      if (!runtimeAvailable('javac') || !runtimeAvailable('java')) {
        return NextResponse.json({
          status: 'compiler_unavailable',
          output: '',
          stderr: 'Java Development Kit (javac/java) is not installed or available on this server environment.',
          executionTimeMs: Date.now() - startTime,
          aiReview: '',
        });
      }

      const classNameMatch = code.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const className = classNameMatch ? classNameMatch[1] : 'Main';
      const javaDir = path.join(TEMP_DIR, `java_${fileId}`);
      fs.mkdirSync(javaDir, { recursive: true });
      const javaSrc = path.join(javaDir, `${className}.java`);

      try {
        fs.writeFileSync(javaSrc, code, 'utf-8');

        // Step 1: Compile — surface real javac errors
        try {
          const compileResult = await execAsync(
            `javac "${javaSrc}"`,
            { ...execOptions(COMPILE_TIMEOUT_MS), cwd: javaDir }
          );
          stderr = compileResult.stderr || '';
        } catch (compileErr: unknown) {
          const ce = compileErr as { stdout?: string; stderr?: string; killed?: boolean };
          safeUnlink(javaDir);
          return NextResponse.json({
            status: ce.killed ? 'timeout' : 'compile_error',
            output: ce.stdout || '',
            stderr: truncate(ce.stderr || 'javac compilation failed.'),
            executionTimeMs: Date.now() - startTime,
            aiReview: '',
          });
        }

        // Step 2: Run
        try {
          const runResult = await execWithStdin(
            `java "${className}"`,
            { ...execOptions(RUN_TIMEOUT_MS), cwd: javaDir },
            stdinInput
          );
          stdout = runResult.stdout || '';
          stderr += runResult.stderr || '';
          status = 'success';
        } catch (runErr: unknown) {
          const re = runErr as { stdout?: string; stderr?: string; killed?: boolean };
          stdout = re.stdout || '';
          stderr += re.stderr || '';
          status = re.killed ? 'timeout' : 'runtime_error';
        }
      } finally {
        safeUnlink(javaDir);
      }

    // ── Unsupported language ──────────────────────────────────────────
    } else {
      return NextResponse.json({
        status: 'execution_error',
        output: '',
        stderr: `Language "${lang}" is not supported. Supported: javascript, python, cpp, java.`,
        executionTimeMs: Date.now() - startTime,
        aiReview: '',
      });
    }

    const executionTimeMs = Date.now() - startTime;

    // Only request AI review on successful runs — a review of broken code is misleading
    const aiReview = status === 'success'
      ? await reviewCodeSnippet(code, lang).catch(() => '')
      : '';

    return NextResponse.json({
      status,
      output: truncate(stdout),
      stderr: truncate(stderr),
      executionTimeMs,
      aiReview,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Code execution engine error.';
    return NextResponse.json(
      { status: 'execution_error', output: '', stderr: message, executionTimeMs: Date.now() - startTime, aiReview: '' },
      { status: 500 }
    );
  }
}
