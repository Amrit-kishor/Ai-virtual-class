'use client';

import React, { useState } from 'react';
import { Play, Sparkles, Terminal, CheckCircle2, Code2, Copy } from 'lucide-react';
import { safeFetchJson } from '@/lib/utils';

export const CodingPlayground: React.FC = () => {
  const [language, setLanguage] = useState<'javascript' | 'python' | 'cpp' | 'java'>('javascript');
  const [code, setCode] = useState<string>(
    '// JavaScript Coding Mode\nfunction solveProblem(arr) {\n  let sum = 0;\n  for (let x of arr) {\n    sum += x;\n  }\n  return sum;\n}\n\nconsole.log("Sum:", solveProblem([10, 20, 30, 40]));'
  );
  const [output, setOutput] = useState<string>('');
  const [aiReview, setAiReview] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const handleLanguageChange = (lang: 'javascript' | 'python' | 'cpp' | 'java') => {
    setLanguage(lang);
    if (lang === 'javascript') {
      setCode('// JavaScript Coding Mode\nfunction solveProblem(arr) {\n  let sum = 0;\n  for (let x of arr) {\n    sum += x;\n  }\n  return sum;\n}\n\nconsole.log("Sum:", solveProblem([10, 20, 30, 40]));');
    } else if (lang === 'python') {
      setCode('# Python 3 Coding Mode\ndef solve_problem(arr):\n    return sum(arr)\n\nprint("Sum:", solve_problem([10, 20, 30, 40]))');
    } else if (lang === 'cpp') {
      setCode('// C++20 Coding Mode\n#include <iostream>\n#include <vector>\n#include <numeric>\n\nint main() {\n    std::vector<int> arr = {10, 20, 30, 40};\n    int total = std::accumulate(arr.begin(), arr.end(), 0);\n    std::cout << "Sum: " << total << std::endl;\n    return 0;\n}');
    } else if (lang === 'java') {
      setCode('// Java 21 Coding Mode\npublic class Main {\n    public static void main(String[] args) {\n        int[] arr = {10, 20, 30, 40};\n        int sum = 0;\n        for(int x : arr) sum += x;\n        System.out.println("Sum: " + sum);\n    }\n}');
    }
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    try {
      const result = await safeFetchJson<{ output: string; aiReview: string }>('/api/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      if (result.ok && result.data) {
        setOutput(result.data.output || 'Done.');
        setAiReview(result.data.aiReview || '');
      } else {
        setOutput(`Error: ${result.error}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Execution error';
      setOutput(`Error: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

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
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleLanguageChange(e.target.value as 'javascript' | 'python' | 'cpp' | 'java')}
            className="bg-slate-900 text-xs text-slate-200 px-2.5 py-1 rounded-lg border border-white/10 font-mono"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>

          {/* Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1.5 transition"
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
            <span>main.{language === 'javascript' ? 'js' : language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : 'java'}</span>
            <span>Syntax Highlighting Active</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 bg-transparent p-3 font-mono text-xs text-emerald-400 focus:outline-none resize-none leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Output Console & AI Review */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Terminal Console */}
          <div className="flex-1 bg-slate-950 rounded-xl border border-white/10 p-3 font-mono text-xs text-slate-200 overflow-y-auto flex flex-col">
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1.5 flex items-center gap-1">
              <Terminal size={12} /> Execution Console Output
            </div>
            <pre className="whitespace-pre-wrap flex-1 text-slate-300">
              {output || 'Click "Run Code" to execute script and inspect output.'}
            </pre>
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
