'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  QuizData,
  QuizQuestion,
  DetailedQuestionReview,
  QuizEvaluationResult,
  QuizHistoryItem,
} from '@/types';
import { SUGGESTED_QUIZ_TOPICS } from '@/lib/ai/aiQuizEngine';
import {
  Trophy,
  Sparkles,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  Check,
  X,
  BookOpen,
  Send,
  History,
  BrainCircuit,
  Award,
} from 'lucide-react';

type QuizStep =
  | 'HOME'
  | 'CHOOSE_TOPIC'
  | 'CUSTOM_CREATOR'
  | 'SELECT_COUNT'
  | 'TAKING_QUIZ'
  | 'SUBMIT_CONFIRM'
  | 'EVALUATING'
  | 'RESULT_REVIEW'
  | 'HISTORY';

interface AIQuizCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
  initialQuiz?: QuizData | null;
  onBroadcastQuiz?: (quiz: QuizData) => void;
  isTeacher?: boolean;
}

export const AIQuizCenterModal: React.FC<AIQuizCenterModalProps> = ({
  isOpen,
  onClose,
  initialTopic = '',
  initialQuiz = null,
  onBroadcastQuiz,
  isTeacher = false,
}) => {
  // Navigation & Flow State
  const [step, setStep] = useState<QuizStep>('HOME');
  const [quizType, setQuizType] = useState<'ai' | 'custom'>('ai');

  // Topic & Generation State
  const [selectedTopic, setSelectedTopic] = useState(initialTopic || 'Data Structures');
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isCustomCount, setIsCustomCount] = useState(false);
  const [customCountInput, setCustomCountInput] = useState('5');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('Creating questions...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Custom Quiz Creator State
  const [customTitle, setCustomTitle] = useState('My Custom Quiz');
  const [customQuestions, setCustomQuestions] = useState<QuizQuestion[]>([]);
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState<'mcq' | 'true_false'>('mcq');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [newCorrectAnswer, setNewCorrectAnswer] = useState('');
  const [newExplanation, setNewExplanation] = useState('');

  // Active Quiz State
  const [activeQuiz, setActiveQuiz] = useState<QuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showSubmitWarning, setShowSubmitWarning] = useState(false);

  // Evaluation & Review State
  const [evaluationResult, setEvaluationResult] = useState<QuizEvaluationResult | null>(null);
  const [historyItems, setHistoryItems] = useState<QuizHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or handle initial quiz if passed via broadcast
  useEffect(() => {
    if (initialQuiz && isOpen) {
      setActiveQuiz(initialQuiz);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setElapsedSeconds(0);
      setIsTimerRunning(true);
      setStep('TAKING_QUIZ');
    }
  }, [initialQuiz, isOpen]);

  // Quiz Timer
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  if (!isOpen) return null;

  // Format Timer mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  // -------------------------------------------------------------
  // Step 1 & 2: Handlers
  // -------------------------------------------------------------
  const handleStartAIFlow = () => {
    setQuizType('ai');
    setErrorMessage(null);
    setStep('CHOOSE_TOPIC');
  };

  const handleStartCustomFlow = () => {
    setQuizType('custom');
    setErrorMessage(null);
    setCustomQuestions([]);
    setStep('CUSTOM_CREATOR');
  };

  const handleSelectTopic = (topic: string) => {
    setSelectedTopic(topic);
    setCustomTopicInput(topic);
    setErrorMessage(null);
    setStep('SELECT_COUNT');
  };

  const handleCustomTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopicInput.trim()) {
      setErrorMessage('Please enter a topic name.');
      return;
    }
    setSelectedTopic(customTopicInput.trim());
    setErrorMessage(null);
    setStep('SELECT_COUNT');
  };

  // Add Question to Custom Quiz
  const handleAddCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQText.trim()) {
      setErrorMessage('Question text cannot be empty.');
      return;
    }

    let finalOptions: string[] = [];
    let correct = newCorrectAnswer.trim();

    if (newQType === 'mcq') {
      finalOptions = [
        optA.trim() || 'Option A',
        optB.trim() || 'Option B',
        optC.trim() || 'Option C',
        optD.trim() || 'Option D',
      ];
      if (!correct || !finalOptions.includes(correct)) {
        correct = finalOptions[0];
      }
    } else {
      finalOptions = ['True', 'False'];
      if (!correct || !['True', 'False'].includes(correct)) {
        correct = 'True';
      }
    }

    const q: QuizQuestion = {
      id: `custom_q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: newQType,
      question: newQText.trim(),
      options: finalOptions,
      correctAnswer: correct,
      explanation: newExplanation.trim() || 'Verified answer.',
    };

    setCustomQuestions((prev) => [...prev, q]);

    // Reset Form
    setNewQText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setNewCorrectAnswer('');
    setNewExplanation('');
    setErrorMessage(null);
  };

  const handleRemoveCustomQuestion = (id: string) => {
    setCustomQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  // -------------------------------------------------------------
  // Step 3: AI Generation or Custom Quiz Publishing
  // -------------------------------------------------------------
  const handleGenerateAIQuiz = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStatus('Synthesizing academic question pool...');

    const count = isCustomCount ? parseInt(customCountInput, 10) || 5 : questionCount;
    const safeCount = Math.max(1, Math.min(20, count));

    try {
      setGenerationStatus(`Validating ${safeCount} questions for "${selectedTopic}"...`);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic: selectedTopic,
          questionCount: safeCount,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.quiz) {
        throw new Error(data.error || 'Failed to generate questions.');
      }

      setActiveQuiz(data.quiz);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setElapsedSeconds(0);
      setIsTimerRunning(true);
      setStep('TAKING_QUIZ');

      // Optionally broadcast if teacher in classroom
      if (isTeacher && onBroadcastQuiz) {
        onBroadcastQuiz(data.quiz);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI generation error';
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartCustomQuiz = async () => {
    if (customQuestions.length === 0) {
      setErrorMessage('Please add at least 1 question before starting the quiz.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/quiz/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: customTitle.trim() || 'Custom Assessment',
          topic: 'Custom Quiz',
          questions: customQuestions,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.quiz) {
        throw new Error(data.error || 'Failed to save custom quiz.');
      }

      setActiveQuiz(data.quiz);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setElapsedSeconds(0);
      setIsTimerRunning(true);
      setStep('TAKING_QUIZ');

      if (isTeacher && onBroadcastQuiz) {
        onBroadcastQuiz(data.quiz);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to launch custom quiz';
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------
  // Step 4: Taking Quiz Actions
  // -------------------------------------------------------------
  const handleSelectOption = (questionId: string, option: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  };

  const handleNextQuestion = () => {
    if (!activeQuiz) return;
    if (currentQuestionIndex < activeQuiz.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Last question -> verify submit
      checkSubmitConfirmation();
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const checkSubmitConfirmation = () => {
    if (!activeQuiz) return;
    const answeredCount = Object.keys(userAnswers).filter((k) => userAnswers[k]?.trim()).length;
    const total = activeQuiz.questions.length;

    if (answeredCount < total) {
      setShowSubmitWarning(true);
    } else {
      setShowSubmitWarning(false);
    }
    setStep('SUBMIT_CONFIRM');
  };

  // -------------------------------------------------------------
  // Step 5: Deterministic Evaluation & Submission
  // -------------------------------------------------------------
  const handleFinalSubmit = async () => {
    if (!activeQuiz) return;
    setIsTimerRunning(false);
    setStep('EVALUATING');
    setErrorMessage(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          quizId: activeQuiz.id,
          userAnswers,
          timeTakenSeconds: elapsedSeconds,
          questions: activeQuiz.questions,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.result) {
        throw new Error(data.error || 'Evaluation error');
      }

      setEvaluationResult(data.result);
      setStep('RESULT_REVIEW');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      setErrorMessage(message);
      setStep('SUBMIT_CONFIRM');
    }
  };

  // -------------------------------------------------------------
  // History Tab Handler
  // -------------------------------------------------------------
  const handleFetchHistory = async () => {
    setStep('HISTORY');
    setIsLoadingHistory(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/quiz/history', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data.history) {
        setHistoryItems(data.history);
      }
    } catch (e) {
      console.warn('History fetch error', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Retry Handlers
  const handleRetrySameQuiz = () => {
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setElapsedSeconds(0);
    setIsTimerRunning(true);
    setStep('TAKING_QUIZ');
  };

  const handleStartNewQuiz = () => {
    setActiveQuiz(null);
    setUserAnswers({});
    setEvaluationResult(null);
    setStep('HOME');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden text-slate-100">
        
        {/* Top Header */}
        <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
              <Trophy size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">AI Quiz Center</h2>
                {activeQuiz && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {activeQuiz.topic || 'Assessment'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {step === 'TAKING_QUIZ'
                  ? `Question ${currentQuestionIndex + 1} of ${activeQuiz?.questions.length || 0}`
                  : 'Test your knowledge with an AI-generated or custom quiz.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step === 'TAKING_QUIZ' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-white/10 text-amber-300 text-xs font-mono font-bold">
                <Clock size={14} />
                <span>{formatTime(elapsedSeconds)}</span>
              </div>
            )}

            {step !== 'TAKING_QUIZ' && step !== 'EVALUATING' && (
              <button
                onClick={handleFetchHistory}
                className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                  step === 'HISTORY'
                    ? 'bg-indigo-600 text-white border-indigo-400'
                    : 'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700'
                }`}
                title="View Quiz History"
              >
                <History size={16} />
                <span className="hidden sm:inline">History</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Modal Body Container */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 1: QUIZ HOME */}
          {/* ======================================================== */}
          {step === 'HOME' && (
            <div className="flex flex-col gap-6 py-2">
              <div className="text-center max-w-md mx-auto">
                <h3 className="text-xl font-bold text-white mb-1">Choose Your Quiz Mode</h3>
                <p className="text-xs text-slate-400">
                  Select whether you want AI to generate targeted questions or create your own custom assessment.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 🤖 AI Quiz Card */}
                <div
                  onClick={handleStartAIFlow}
                  className="group relative p-6 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 hover:border-indigo-500/60 hover:shadow-2xl hover:shadow-indigo-500/10 cursor-pointer transition-all flex flex-col justify-between gap-6"
                >
                  <div className="flex flex-col gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <BrainCircuit size={26} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition">
                        🤖 AI Generated Quiz
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Generate questions instantly from any topic using academic AI synthesis.
                      </p>
                    </div>
                  </div>

                  <button className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition">
                    <span>Choose Topic</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                {/* ✍ Custom Quiz Card */}
                <div
                  onClick={handleStartCustomFlow}
                  className="group relative p-6 rounded-3xl bg-gradient-to-br from-violet-950/40 via-slate-900 to-slate-900 border border-violet-500/20 hover:border-violet-500/60 hover:shadow-2xl hover:shadow-violet-500/10 cursor-pointer transition-all flex flex-col justify-between gap-6"
                >
                  <div className="flex flex-col gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:scale-110 group-hover:bg-violet-600 group-hover:text-white transition-all">
                      <Edit3 size={26} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white group-hover:text-violet-300 transition">
                        ✍ Custom Quiz
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Create and broadcast a custom quiz using your own questions, options, and explanations.
                      </p>
                    </div>
                  </div>

                  <button className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition">
                    <span>Add Questions</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2A: CHOOSE TOPIC */}
          {/* ======================================================== */}
          {step === 'CHOOSE_TOPIC' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">What do you want to be tested on?</h3>
                  <p className="text-xs text-slate-400">Type any subject or select from the recommended topics.</p>
                </div>
                <button
                  onClick={() => setStep('HOME')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </div>

              {/* Custom Topic Input */}
              <form onSubmit={handleCustomTopicSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={customTopicInput}
                  onChange={(e) => setCustomTopicInput(e.target.value)}
                  placeholder="e.g. Binary Search Trees, C++ OOP, Quantum Physics..."
                  className="flex-1 bg-slate-950 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 outline-none transition"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
                >
                  <span>Next</span>
                  <ArrowRight size={14} />
                </button>
              </form>

              {/* Suggested Topics Chips */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Suggested Topics
                </h4>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUIZ_TOPICS.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleSelectTopic(topic)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-white/10 hover:border-indigo-500/40 transition"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2B: CUSTOM QUIZ CREATOR */}
          {/* ======================================================== */}
          {step === 'CUSTOM_CREATOR' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Create Custom Questions</h3>
                  <p className="text-xs text-slate-400">Add multiple-choice or true/false questions to your quiz.</p>
                </div>
                <button
                  onClick={() => setStep('HOME')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </div>

              {/* Quiz Title */}
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1 block">Quiz Title</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Chapter 4 Midterm Review"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-violet-500"
                />
              </div>

              {/* Add Question Form */}
              <form onSubmit={handleAddCustomQuestion} className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-400 flex items-center gap-1">
                    <Plus size={14} /> Add New Question
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewQType('mcq')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                        newQType === 'mcq' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      MCQ
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewQType('true_false')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                        newQType === 'true_false' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      True/False
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  placeholder="Enter question text here..."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-violet-500"
                />

                {/* MCQ Options */}
                {newQType === 'mcq' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={optA}
                      onChange={(e) => setOptA(e.target.value)}
                      placeholder="Option A"
                      className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                    />
                    <input
                      type="text"
                      value={optB}
                      onChange={(e) => setOptB(e.target.value)}
                      placeholder="Option B"
                      className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                    />
                    <input
                      type="text"
                      value={optC}
                      onChange={(e) => setOptC(e.target.value)}
                      placeholder="Option C"
                      className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                    />
                    <input
                      type="text"
                      value={optD}
                      onChange={(e) => setOptD(e.target.value)}
                      placeholder="Option D"
                      className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                    />
                  </div>
                )}

                {/* Correct Answer & Explanation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newCorrectAnswer}
                    onChange={(e) => setNewCorrectAnswer(e.target.value)}
                    placeholder="Exact Correct Answer string"
                    className="bg-slate-900 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-emerald-300 outline-none"
                  />
                  <input
                    type="text"
                    value={newExplanation}
                    onChange={(e) => setNewExplanation(e.target.value)}
                    placeholder="Explanation (optional)"
                    className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="self-end px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Plus size={14} /> Add to Quiz
                </button>
              </form>

              {/* Added Questions List */}
              {customQuestions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-slate-300">
                    Questions in Pool ({customQuestions.length})
                  </h4>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {customQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-3 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-between text-xs"
                      >
                        <div className="flex-1 pr-3 truncate">
                          <span className="font-bold text-violet-400 mr-2">Q{idx + 1}.</span>
                          <span className="text-slate-200">{q.question}</span>
                          <span className="text-emerald-400 text-[11px] block font-mono">
                            Correct: {q.correctAnswer}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveCustomQuestion(q.id)}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleStartCustomQuiz}
                    disabled={isGenerating}
                    className="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center justify-center gap-2"
                  >
                    <span>Launch Custom Quiz ({customQuestions.length} Questions)</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 3: SELECT QUESTION COUNT & GENERATE */}
          {/* ======================================================== */}
          {step === 'SELECT_COUNT' && (
            <div className="flex flex-col gap-6 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">How many questions?</h3>
                  <p className="text-xs text-slate-400">
                    Topic: <span className="text-indigo-400 font-bold">{selectedTopic}</span>
                  </p>
                </div>
                <button
                  onClick={() => setStep('CHOOSE_TOPIC')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft size={14} /> Change Topic
                </button>
              </div>

              {/* Question Count Selectors */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[5, 10, 15, 20].map((count) => (
                  <button
                    key={count}
                    onClick={() => {
                      setQuestionCount(count);
                      setIsCustomCount(false);
                    }}
                    className={`py-4 rounded-2xl font-bold text-sm border flex flex-col items-center justify-center gap-1 transition ${
                      !isCustomCount && questionCount === count
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 scale-105'
                        : 'bg-slate-950 text-slate-300 border-white/10 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-lg">{count}</span>
                    <span className="text-[10px] uppercase font-normal text-slate-400">Questions</span>
                  </button>
                ))}

                <button
                  onClick={() => setIsCustomCount(true)}
                  className={`py-4 rounded-2xl font-bold text-sm border flex flex-col items-center justify-center gap-1 transition ${
                    isCustomCount
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 scale-105'
                      : 'bg-slate-950 text-slate-300 border-white/10 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-lg">Custom</span>
                  <span className="text-[10px] uppercase font-normal text-slate-400">1 to 20</span>
                </button>
              </div>

              {/* Custom Number Input */}
              {isCustomCount && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-white/10">
                  <label className="text-xs text-slate-400 font-medium">Enter question count (1-20):</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={customCountInput}
                    onChange={(e) => setCustomCountInput(e.target.value)}
                    className="w-20 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none text-center"
                  />
                </div>
              )}

              {/* Generate Action Button */}
              <button
                onClick={handleGenerateAIQuiz}
                disabled={isGenerating}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Sparkles size={16} className="animate-spin text-amber-300" />
                    <span>{generationStatus}</span>
                  </>
                ) : (
                  <>
                    <BrainCircuit size={16} />
                    <span>Generate & Start Quiz</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 4: TAKING QUIZ & QUESTION NAVIGATOR */}
          {/* ======================================================== */}
          {step === 'TAKING_QUIZ' && activeQuiz && (
            <div className="flex flex-col gap-5">
              {/* Question Navigator Grid */}
              <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-2xl bg-slate-950/60 border border-white/10">
                <span className="text-[11px] text-slate-400 font-bold mr-2">Questions:</span>
                {activeQuiz.questions.map((q, idx) => {
                  const isCurrent = idx === currentQuestionIndex;
                  const isAnswered = Boolean(userAnswers[q.id]?.trim());

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                        isCurrent
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md'
                          : isAnswered
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Current Question Body */}
              {(() => {
                const q = activeQuiz.questions[currentQuestionIndex];
                if (!q) return null;
                const currentSelected = userAnswers[q.id];

                return (
                  <div className="p-5 rounded-3xl bg-slate-950/80 border border-white/10 flex flex-col gap-4">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-indigo-400">
                        Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}
                      </span>
                      <span className="text-slate-400 uppercase text-[10px]">
                        {q.type.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-white leading-relaxed">
                      {q.question}
                    </h3>

                    {/* Options (MCQ / True False) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                      {q.options?.map((opt, optIdx) => {
                        const isSelected = currentSelected === opt;
                        const letter = String.fromCharCode(65 + optIdx);

                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelectOption(q.id, opt)}
                            className={`p-3.5 rounded-2xl text-xs text-left transition font-medium border flex items-center gap-3 ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                                : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800/80 hover:border-white/20'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="flex-1">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Bottom Navigation Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handlePrevQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <ArrowLeft size={14} /> Previous
                </button>

                {currentQuestionIndex < activeQuiz.questions.length - 1 ? (
                  <button
                    onClick={handleNextQuestion}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition"
                  >
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={checkSubmitConfirmation}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition"
                  >
                    <Check size={14} /> Submit Quiz
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 5: SUBMIT CONFIRMATION MODAL */}
          {/* ======================================================== */}
          {step === 'SUBMIT_CONFIRM' && activeQuiz && (
            <div className="flex flex-col items-center justify-center text-center gap-5 py-6">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertCircle size={32} />
              </div>

              {(() => {
                const total = activeQuiz.questions.length;
                const answered = Object.keys(userAnswers).filter((k) => userAnswers[k]?.trim()).length;
                const unanswered = total - answered;

                return (
                  <div className="max-w-md flex flex-col gap-2">
                    <h3 className="text-lg font-bold text-white">
                      {unanswered > 0 ? `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}` : 'Ready to Submit?'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {unanswered > 0
                        ? `You have completed ${answered} out of ${total} questions. Are you sure you want to finish the evaluation?`
                        : `All ${total} questions have been answered. Submit now for instant deterministic evaluation and feedback.`}
                    </p>
                  </div>
                );
              })()}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep('TAKING_QUIZ')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Go Back
                </button>
                <button
                  onClick={handleFinalSubmit}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition"
                >
                  Submit Anyway
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 6: EVALUATING */}
          {/* ======================================================== */}
          {step === 'EVALUATING' && (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-12">
              <Sparkles size={36} className="text-indigo-400 animate-spin" />
              <h3 className="text-base font-bold text-white">Evaluating Your Quiz...</h3>
              <p className="text-xs text-slate-400">
                Calculating score, grading answers, and generating actionable performance feedback.
              </p>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 7: RESULT & DETAILED QUESTION REVIEW */}
          {/* ======================================================== */}
          {step === 'RESULT_REVIEW' && evaluationResult && (
            <div className="flex flex-col gap-6">
              {/* Score Header Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-bold text-white shadow-xl ${
                      evaluationResult.percentage >= 70
                        ? 'bg-emerald-600 shadow-emerald-600/20'
                        : evaluationResult.percentage >= 40
                        ? 'bg-amber-600 shadow-amber-600/20'
                        : 'bg-red-600 shadow-red-600/20'
                    }`}
                  >
                    <span className="text-2xl">{evaluationResult.percentage}%</span>
                    <span className="text-[10px] font-normal uppercase opacity-80">Score</span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>🎯 Quiz Complete</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {evaluationResult.title} ({evaluationResult.topic})
                    </p>
                  </div>
                </div>

                {/* Score Stats */}
                <div className="grid grid-cols-3 gap-2 text-center w-full sm:w-auto">
                  <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
                    <span className="text-sm font-bold text-emerald-400 block">{evaluationResult.correctCount}</span>
                    <span className="text-[10px] text-slate-400 uppercase">Correct</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/20">
                    <span className="text-sm font-bold text-red-400 block">{evaluationResult.incorrectCount}</span>
                    <span className="text-[10px] text-slate-400 uppercase">Incorrect</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10">
                    <span className="text-sm font-bold text-amber-400 block">{evaluationResult.unansweredCount}</span>
                    <span className="text-[10px] text-slate-400 uppercase">Skipped</span>
                  </div>
                </div>
              </div>

              {/* AI Performance Feedback Box */}
              {evaluationResult.aiFeedback && (
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-3">
                  <Sparkles size={18} className="text-amber-300 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">
                      AI Performance Summary
                    </h4>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {evaluationResult.aiFeedback}
                    </p>
                  </div>
                </div>
              )}

              {/* Detailed Review Section */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Detailed Question Review
                </h4>

                <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
                  {evaluationResult.review.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
                        item.isCorrect
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : item.isUnanswered
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-red-950/20 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-300">Question {idx + 1}</span>
                        <span
                          className={`flex items-center gap-1 ${
                            item.isCorrect
                              ? 'text-emerald-400'
                              : item.isUnanswered
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {item.isCorrect ? (
                            <>
                              <CheckCircle2 size={14} /> Correct
                            </>
                          ) : item.isUnanswered ? (
                            <>
                              <AlertCircle size={14} /> Unanswered
                            </>
                          ) : (
                            <>
                              <XCircle size={14} /> Incorrect
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-xs text-white font-medium">{item.question}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-white/10">
                          <span className="text-slate-500 block text-[10px]">YOUR ANSWER:</span>
                          <span className={item.isCorrect ? 'text-emerald-400' : 'text-red-400'}>
                            {item.userAnswer || '(None)'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-white/10">
                          <span className="text-slate-500 block text-[10px]">CORRECT ANSWER:</span>
                          <span className="text-emerald-400">{item.correctAnswer}</span>
                        </div>
                      </div>

                      {item.explanation && (
                        <p className="text-[11px] text-slate-400 italic bg-slate-950/40 p-2 rounded-lg">
                          💡 {item.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  onClick={handleRetrySameQuiz}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <RotateCcw size={14} /> Retry Same Quiz
                </button>
                <button
                  onClick={handleStartNewQuiz}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
                >
                  <Plus size={14} /> New Quiz
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 8: QUIZ HISTORY */}
          {/* ======================================================== */}
          {step === 'HISTORY' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History size={18} className="text-indigo-400" /> Recent Quiz Submissions
                </h3>
                <button
                  onClick={() => setStep('HOME')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft size={14} /> Back to Quiz Center
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Sparkles size={16} className="animate-spin text-indigo-400" /> Loading history...
                </div>
              ) : historyItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No completed quizzes found yet. Take a quiz to see your scores here!
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto">
                  {historyItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <h4 className="font-bold text-white">{item.title}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="text-indigo-400">{item.topic}</span>
                          <span>•</span>
                          <span>{item.totalQuestions} Questions</span>
                          <span>•</span>
                          <span>{new Date(item.submittedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-xl text-xs font-bold ${
                            item.percentage >= 70
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : item.percentage >= 40
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {item.score}/{item.totalQuestions} ({item.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
