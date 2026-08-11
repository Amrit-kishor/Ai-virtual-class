'use client';

import React, { useState } from 'react';
import { Play, Sparkles, Terminal, Code2, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { safeFetchJson } from '@/lib/utils';

type ExecutionStatus = 'success' | 'compile_error' | 'runtime_error' | 'timeout' | 'compiler_unavailable' | 'execution_error' | null;

interface RunResult {
  status: ExecutionStatus;
  output: string;
  stderr: string;
  executionTimeMs: number;
  aiReview: string;
}


export const CodingPlayground: React.FC = () => {
  const [language, setLanguage] = useState<'javascript' | 'python' | 'cpp' | 'java'>('javascript');
  const [code, setCode] = useState<string>(
    '// JavaScript Coding Mode\nfunction solveProblem(arr) {\n  let sum = 0;\n  for (let x of arr) {\n    sum += x;\n  }\n  return sum;\n}\n\nconsole.log("Sum:", solveProblem([10, 20, 30, 40]));'
  );
  const [result, setResult] = useState<RunResult | null>(null);
  const [aiReview, setAiReview] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stdin, setStdin] = useState<string>('');

  const handleLanguageChange = (lang: 'javascript' | 'python' | 'cpp' | 'java') => {
    setLanguage(lang);
    // Only reset code when language changes — never on error
    if (lang === 'javascript') {
      setCode('// JavaScript Coding Mode\nfunction solveProblem(arr) {\n  let sum = 0;\n  for (let x of arr) {\n    sum += x;\n  }\n  return sum;\n}\n\nconsole.log("Sum:", solveProblem([10, 20, 30, 40]));');
    } else if (lang === 'python') {
      setCode('# Python 3 Coding Mode\ndef solve_problem(arr):\n    return sum(arr)\n\nprint("Sum:", solve_problem([10, 20, 30, 40]))');
    } else if (lang === 'cpp') {
      setCode('// C++17 Coding Mode\n#include <iostream>\n#include <vector>\n#include <numeric>\n\nint main() {\n    std::vector<int> arr = {10, 20, 30, 40};\n    int total = std::accumulate(arr.begin(), arr.end(), 0);\n    std::cout << "Sum: " << total << std::endl;\n    return 0;\n}');
    } else if (lang === 'java') {
      setCode('// Java Coding Mode\npublic class Main {\n    public static void main(String[] args) {\n        int[] arr = {10, 20, 30, 40};\n        int sum = 0;\n        for(int x : arr) sum += x;\n        System.out.println("Sum: " + sum);\n    }\n}');
    }
    setResult(null);
    setAiReview('');
  };

  const handleRunCode = async () => {
    if (isRunning) return; // duplicate-submit guard
    setIsRunning(true);
    setResult(null);
    setAiReview('');

    try {
      const res = await safeFetchJson<RunResult>('/api/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, stdin }),
      });

      if (res.ok && res.data) {
        setResult(res.data);
        setAiReview(res.data.aiReview || '');
      } else {
        setResult({
          status: 'execution_error',
          output: '',
          stderr: res.error || 'Unknown execution error.',
          executionTimeMs: 0,
          aiReview: '',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Execution error';
      setResult({
        status: 'execution_error',
        output: '',
        stderr: message,
        executionTimeMs: 0,
        aiReview: '',
      });
    } finally {
      setIsRunning(false);
    }
  };

  // ── Status badge config ──────────────────────────────────────────
  const statusConfig: Record<
    NonNullable<ExecutionStatus>,
    { label: string; icon: React.ReactNode; color: string; outputColor: string }
  > = {
    success:              { label: '✓ Success',               icon: <CheckCircle2 size={13} />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', outputColor: 'text-emerald-300' },
    compile_error:        { label: '⛔ Compile Error',        icon: <XCircle size={13} />,      color: 'text-red-400 bg-red-500/10 border-red-500/30',             outputColor: 'text-red-300' },
    runtime_error:        { label: '⚠ Runtime Error',        icon: <AlertTriangle size={13} />,color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',       outputColor: 'text-amber-300' },
    timeout:              { label: '⏱ Timed Out',            icon: <Clock size={13} />,        color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',    outputColor: 'text-orange-300' },
    compiler_unavailable: { label: '⚙ Compiler Unavailable',  icon: <AlertTriangle size={13} />,color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',       outputColor: 'text-amber-300' },
    execution_error:      { label: '✕ Error',                 icon: <XCircle size={13} />,      color: 'text-red-400 bg-red-500/10 border-red-500/30',             outputColor: 'text-red-300' },
  };


  const currentStatus = result?.status ? statusConfig[result.status] : null;

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl p-3 border border-white/10 overflow-hidden gap-3">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
          <Code2 size={16} className="text-emerald-400" />
          <span>Interactive Coding Mode</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select
            value={language}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              handleLanguageChange(e.target.value as 'javascript' | 'python' | 'cpp' | 'java')
            }
            className="bg-slate-900 text-xs text-slate-200 px-2.5 py-1 rounded-lg border border-white/10 font-mono"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>

          {/* Run Code Button */}
          <button
            id="coding-run-btn"
            onClick={handleRunCode}
            disabled={isRunning}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1.5 transition"
          >
            {isRunning ? (
              <span className="animate-spin">🌀 Running...</span>
            ) : (
              <>
                <Play size={13} className="fill-slate-950" /> Run Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Body: Code Editor + Terminal / AI Output */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
        {/* Code Editor Area */}
        <div className="flex flex-col bg-slate-950 rounded-xl border border-white/10 overflow-hidden">
          <div className="bg-slate-900/80 px-3 py-1.5 border-b border-white/10 text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <span>
              main.
              {language === 'javascript' ? 'js' : language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : 'java'}
            </span>
            <span>Syntax Highlighting Active</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 bg-transparent p-3 font-mono text-xs text-emerald-400 focus:outline-none resize-none leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Stdin Input */}
        <div className="bg-slate-950 rounded-xl border border-white/10 overflow-hidden" style={{ maxHeight: '100px' }}>
          <div className="bg-slate-900/80 px-3 py-1 border-b border-white/10 text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Terminal size={10} /> stdin (optional custom input)
          </div>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Enter program input here (e.g. 5\n1 2 3 4 5)"
            className="w-full bg-transparent p-2 font-mono text-xs text-slate-300 focus:outline-none resize-none placeholder:text-slate-600"
            rows={3}
            spellCheck={false}
          />
        </div>

        {/* Output Console & AI Review */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Terminal Console */}
          <div className="flex-1 bg-slate-950 rounded-xl border border-white/10 p-3 font-mono text-xs overflow-y-auto flex flex-col gap-2">
            {/* Status badge */}
            {currentStatus && (
              <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded border self-start ${currentStatus.color}`}>
                {currentStatus.icon}
                {currentStatus.label}
                {result?.executionTimeMs ? ` — ${result.executionTimeMs}ms` : ''}
              </div>
            )}

            <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
              <Terminal size={12} /> Execution Console Output
            </div>

            {/* stdout */}
            {result ? (
              result.output ? (
                <pre className={`whitespace-pre-wrap flex-1 ${currentStatus?.outputColor ?? 'text-slate-300'}`}>
                  {result.output}
                </pre>
              ) : null
            ) : (
              <pre className="whitespace-pre-wrap flex-1 text-slate-500">
                Click &quot;Run Code&quot; to execute script and inspect output.
              </pre>
            )}

            {/* stderr — compile/runtime errors */}
            {result?.stderr && (
              <>
                <div className="text-[10px] text-slate-500 font-bold uppercase mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  {result.status === 'compile_error' ? 'Compiler Output' : 'Error Output'}
                </div>
                <pre className="whitespace-pre-wrap text-red-300 bg-red-950/30 border border-red-500/20 rounded p-2 text-[11px] leading-relaxed">
                  {result.stderr}
                </pre>
              </>
            )}

            {/* Timeout specific message */}
            {result?.status === 'timeout' && (
              <p className="text-orange-300 text-[11px] mt-1">
                ⚠ Your program was terminated after exceeding the 5-second execution limit. Check for infinite loops or blocking operations.
              </p>
            )}
          </div>

          {/* AI Code Review Panel */}
          {aiReview && (
            <div className="bg-indigo-950/60 border border-indigo-500/30 p-3 rounded-xl text-xs text-indigo-100 overflow-y-auto max-h-[140px]">
              <div className="font-bold text-indigo-300 flex items-center gap-1.5 mb-1 text-[11px]">
                <Sparkles size={13} /> AI Code Optimization Review
              </div>
              <div className="whitespace-pre-wrap text-[11px] leading-relaxed opacity-90">{aiReview}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

