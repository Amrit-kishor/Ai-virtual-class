'use client';

import React, { useState } from 'react';
import { QuizData, QuizQuestion } from '@/types';
import { Trophy, Plus, Trash2, Check, X, HelpCircle, Send } from 'lucide-react';

interface CreateQuizModalProps {
  onBroadcastQuiz: (quiz: QuizData) => void;
  onClose: () => void;
}

export const CreateQuizModal: React.FC<CreateQuizModalProps> = ({
  onBroadcastQuiz,
  onClose,
}) => {
  const [quizTitle, setQuizTitle] = useState('Interactive Live Classroom Quiz');
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    {
      id: 'q_1',
      type: 'mcq',
      question: 'Which network protocol enables direct peer-to-peer real-time media streaming?',
      options: ['WebRTC', 'HTTP/1.1', 'FTP', 'SMTP'],
      correctAnswer: 'WebRTC',
      explanation: 'WebRTC provides low-latency peer-to-peer audio/video streaming.',
    },
  ]);

  // Form fields for adding new question
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'mcq' | 'true_false' | 'coding'>('mcq');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [starterCode, setStarterCode] = useState('');
  const [explanation, setExplanation] = useState('');

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    let finalOptions: string[] | undefined = undefined;
    let finalCorrect = correctAnswer;

    if (newQuestionType === 'mcq') {
      finalOptions = [
        optA.trim() || 'Option A',
        optB.trim() || 'Option B',
        optC.trim() || 'Option C',
        optD.trim() || 'Option D',
      ];
      if (!finalCorrect) finalCorrect = finalOptions[0];
    } else if (newQuestionType === 'true_false') {
      finalOptions = ['True', 'False'];
      if (!finalCorrect) finalCorrect = 'True';
    }

    const q: QuizQuestion = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type: newQuestionType,
      question: newQuestionText.trim(),
      options: finalOptions,
      correctAnswer: finalCorrect.trim(),
      starterCode: newQuestionType === 'coding' ? starterCode.trim() : undefined,
      explanation: explanation.trim() || 'Correct answer verified.',
    };

    setQuestions([...questions, q]);

    // Reset inputs
    setNewQuestionText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setCorrectAnswer('');
    setStarterCode('');
    setExplanation('');
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handlePublish = () => {
    if (questions.length === 0) return;
    const finalQuiz: QuizData = {
      id: 'quiz_' + Date.now(),
      title: quizTitle.trim() || 'Teacher Custom Live Quiz',
      questions,
    };
    onBroadcastQuiz(finalQuiz);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-2xl w-full max-h-[90vh] p-6 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
          <div className="p-3 bg-amber-500/20 text-amber-300 rounded-2xl border border-amber-500/30">
            <Trophy size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Teacher Quiz Creator</h2>
            <p className="text-xs text-slate-400">Design custom live quizzes and broadcast them to students</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto pr-1 flex-1">
          {/* Quiz Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-200">Quiz Title</label>
            <input
              type="text"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="e.g. Midterm Concepts Checkpoint"
              className="bg-slate-950 rounded-xl px-3 py-2 text-xs text-slate-100 border border-white/10 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Current Question List */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>Added Questions ({questions.length})</span>
            </label>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-slate-950/70 p-3 rounded-xl border border-white/10 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 truncate flex-1">
                    <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                      Q{idx + 1} [{q.type.toUpperCase()}]
                    </span>
                    <span className="font-medium text-slate-200 truncate">{q.question}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveQuestion(q.id)}
                    className="text-red-400 hover:text-red-300 p-1 rounded"
                    title="Remove Question"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Question Builder Form */}
          <form onSubmit={handleAddQuestion} className="bg-slate-950/90 p-4 rounded-2xl border border-amber-500/20 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300 border-b border-white/10 pb-2">
              <span className="flex items-center gap-1.5">
                <Plus size={14} /> Add New Question
              </span>
              <select
                value={newQuestionType}
                onChange={(e) => setNewQuestionType(e.target.value as 'mcq' | 'true_false' | 'coding')}
                className="bg-slate-900 text-xs text-slate-200 px-2 py-1 rounded-lg border border-white/10 focus:outline-none"
              >
                <option value="mcq">Multiple Choice (MCQ)</option>
                <option value="true_false">True / False</option>
                <option value="coding">Coding Challenge</option>
              </select>
            </div>

            <input
              type="text"
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="Question text..."
              className="bg-slate-900 rounded-xl px-3 py-2 text-xs text-slate-100 border border-white/10 focus:border-amber-500 focus:outline-none"
              required
            />

            {/* MCQ Options Inputs */}
            {newQuestionType === 'mcq' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={optA}
                  onChange={(e) => setOptA(e.target.value)}
                  placeholder="Option A"
                  className="bg-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 border border-white/10"
                />
                <input
                  type="text"
                  value={optB}
                  onChange={(e) => setOptB(e.target.value)}
                  placeholder="Option B"
                  className="bg-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 border border-white/10"
                />
                <input
                  type="text"
                  value={optC}
                  onChange={(e) => setOptC(e.target.value)}
                  placeholder="Option C"
                  className="bg-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 border border-white/10"
                />
                <input
                  type="text"
                  value={optD}
                  onChange={(e) => setOptD(e.target.value)}
                  placeholder="Option D"
                  className="bg-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 border border-white/10"
                />
              </div>
            )}

            {/* Coding Starter Code Input */}
            {newQuestionType === 'coding' && (
              <textarea
                value={starterCode}
                onChange={(e) => setStarterCode(e.target.value)}
                placeholder="Starter Code (e.g. function solve() { return 0; })"
                className="w-full h-16 bg-slate-900 rounded-xl p-2.5 text-xs font-mono text-slate-200 border border-white/10 resize-none focus:outline-none"
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="Correct Answer Text..."
                className="bg-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 border border-white/10"
              />
              <input
                type="text"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explanation (Optional)..."
                className="bg-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 border border-white/10"
              />
            </div>

            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 transition shadow"
            >
              <Plus size={14} /> Add Question to Quiz
            </button>
          </form>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={questions.length === 0}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-slate-950 font-extrabold px-5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/30 transition disabled:opacity-50"
          >
            <Send size={15} /> Broadcast Quiz Live ({questions.length} Qs)
          </button>
        </div>
      </div>
    </div>
  );
};
