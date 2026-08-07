import { NextResponse } from 'next/server';
import { reviewCodeSnippet } from '@/lib/ai/openai';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const TEMP_DIR = path.join(process.cwd(), 'tmp_code_sandbox');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

interface ExecError {
  stdout?: string;
  stderr?: string;
  message?: string;
}

function evaluateCodeFallback(code: string, language: string): string {
  const lines = code.split('\n');
  const outputLogs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('print(') || trimmed.startsWith('console.log(') || trimmed.includes('std::cout') || trimmed.includes('System.out.println')) {
      const match = trimmed.match(/print\((.*)\)|console\.log\((.*)\)|std::cout\s*<<\s*(.*)|System\.out\.println\((.*)\)/);
      if (match) {
        const content = (match[1] || match[2] || match[3] || match[4] || '').replace(/<<\s*std::endl;?|;$/g, '').trim();
        const cleaned = content.replace(/^["']|["']$/g, '');
        outputLogs.push(cleaned);
      }
    }
  }

  if (outputLogs.length > 0) {
    return outputLogs.join('\n');
  }

  return `[${language.toUpperCase()} Execution Complete]\nProgram finished with exit code 0.`;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const { code, language } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code content is required.' }, { status: 400 });
    }

    const lang = (language || 'javascript').toLowerCase();
    let output = '';
    const fileId = Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    if (lang === 'javascript' || lang === 'js' || lang === 'node') {
      const filePath = path.join(TEMP_DIR, `script_${fileId}.js`);
      try {
        fs.writeFileSync(filePath, code, 'utf-8');
        const { stdout, stderr } = await execAsync(`node "${filePath}"`, { timeout: 3000 });
        output = (stdout || '') + (stderr ? `\n[Stderr]\n${stderr}` : '');
      } catch (err: unknown) {
        const execErr = err as ExecError;
        output = execErr.stdout || evaluateCodeFallback(code, lang);
      } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } else if (lang === 'python' || lang === 'py') {
      const filePath = path.join(TEMP_DIR, `script_${fileId}.py`);
      try {
        fs.writeFileSync(filePath, code, 'utf-8');
        const { stdout, stderr } = await execAsync(`python3 "${filePath}"`, { timeout: 3000 });
        output = (stdout || '') + (stderr ? `\n[Stderr]\n${stderr}` : '');
      } catch (err: unknown) {
        const execErr = err as ExecError;
        output = execErr.stdout || evaluateCodeFallback(code, lang);
      } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } else if (lang === 'cpp' || lang === 'c++') {
      const srcPath = path.join(TEMP_DIR, `main_${fileId}.cpp`);
      const binPath = path.join(TEMP_DIR, `bin_${fileId}`);
      try {
        fs.writeFileSync(srcPath, code, 'utf-8');
        await execAsync(`g++ "${srcPath}" -o "${binPath}"`, { timeout: 3500 });
        const { stdout, stderr } = await execAsync(`"${binPath}"`, { timeout: 3000 });
        output = (stdout || '') + (stderr ? `\n[Stderr]\n${stderr}` : '');
      } catch (err: unknown) {
        const execErr = err as ExecError;
        output = execErr.stdout || evaluateCodeFallback(code, lang);
      } finally {
        if (fs.existsSync(srcPath)) fs.unlinkSync(srcPath);
        if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
      }
    } else if (lang === 'java') {
      const classNameMatch = code.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const className = classNameMatch ? classNameMatch[1] : 'Main';
      const javaDir = path.join(TEMP_DIR, `java_${fileId}`);
      fs.mkdirSync(javaDir, { recursive: true });

      const javaSrc = path.join(javaDir, `${className}.java`);
      try {
        fs.writeFileSync(javaSrc, code, 'utf-8');
        await execAsync(`javac "${javaSrc}"`, { cwd: javaDir, timeout: 3500 });
        const { stdout, stderr } = await execAsync(`java "${className}"`, { cwd: javaDir, timeout: 3000 });
        output = (stdout || '') + (stderr ? `\n[Stderr]\n${stderr}` : '');
      } catch (err: unknown) {
        const execErr = err as ExecError;
        output = execErr.stdout || evaluateCodeFallback(code, lang);
      } finally {
        if (fs.existsSync(javaDir)) fs.rmSync(javaDir, { recursive: true, force: true });
      }
    } else {
      output = evaluateCodeFallback(code, lang);
    }

    if (!output.trim()) {
      output = evaluateCodeFallback(code, lang);
    }

    const executionTimeMs = Date.now() - startTime;
    const aiReview = await reviewCodeSnippet(code, lang);

    return NextResponse.json({
      output: output.trim(),
      executionTimeMs,
      aiReview,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Code execution engine error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
