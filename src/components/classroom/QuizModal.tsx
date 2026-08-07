'use client';

import React, { useState } from 'react';
import { QuizData, QuizQuestion } from '@/types';
import { Award, CheckCircle2, XCircle, Clock, Trophy, X, Sparkles } from 'lucide-react';

interface QuizModalProps {
  quiz: QuizData;
  onClose: () => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({ quiz, onClose }) => {
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const handleSelectOption = (qId: string, answer: string) => {
    if (isSubmitted) return;
    setUserAnswers({ ...userAnswers, [qId]: answer });
  };

  const handleSubmit = () => {
    let s = 0;
    quiz.questions.forEach((q) => {
      if (userAnswers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
        s += 1;
      }
    });
    setScore(s);
    setIsSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl max-w-2xl w-full p-6 flex flex-col gap-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={20} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Trophy size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{quiz.title}</h2>
            <p className="text-xs text-slate-400">AI-Generated Assessment & Instant Evaluation</p>
          </div>
        </div>

        {/* Questions */}
        <div className="flex flex-col gap-5 my-2">
          {quiz.questions.map((q, idx) => {
            const isCorrect = userAnswers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
            return (
              <div key={q.id} className="bg-slate-950/60 p-4 rounded-xl border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                  <span>Question {idx + 1} ({q.type.toUpperCase()})</span>
                  {isSubmitted && (
                    <span className={isCorrect ? 'text-emerald-400 flex items-center gap-1' : 'text-red-400 flex items-center gap-1'}>
                      {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {isCorrect ? 'Correct (+1)' : 'Incorrect'}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-100 font-semibold">{q.question}</p>

                {/* Options for MCQ / True False */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                    {q.options.map((opt) => {
                      const isSelected = userAnswers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => handleSelectOption(q.id, opt)}
                          disabled={isSubmitted}
                          className={`p-2.5 rounded-lg text-xs text-left transition font-medium border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                              : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Text / Coding Input */}
                {(!q.options || q.options.length === 0) && (
                  <textarea
                    value={userAnswers[q.id] || ''}
                    onChange={(e) => handleSelectOption(q.id, e.target.value)}
                    disabled={isSubmitted}
                    placeholder="Type code solution or answer..."
                    className="w-full h-20 bg-slate-900 p-2.5 rounded-lg font-mono text-xs text-emerald-400 border border-white/10 focus:outline-none focus:border-indigo-500"
                  />
                )}

                {/* Explanation */}
                {isSubmitted && (
                  <div className="bg-slate-900 p-3 rounded-lg border border-white/10 text-xs text-slate-300">
                    <span className="font-bold text-indigo-400 block mb-1">Explanation:</span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Evaluation Banner */}
        {isSubmitted ? (
          <div className="bg-gradient-to-r from-indigo-900/80 to-violet-900/80 p-4 rounded-xl border border-indigo-500/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award size={32} className="text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Quiz Evaluation Score</h3>
                <p className="text-xs text-indigo-200">
                  You scored <span className="font-mono font-bold text-amber-300">{score}</span> out of {quiz.questions.length}!
                </p>
              </div>
            </div>
            <button onClick={onClose} className="bg-white text-slate-950 font-bold px-4 py-2 rounded-xl text-xs hover:bg-indigo-50 transition">
              Done & Return
            </button>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(userAnswers).length === 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-xs transition"
          >
            Submit Answers & View Evaluation
          </button>
        )}
      </div>
    </div>
  );
};
