'use client';

import React, { useState } from 'react';
import { ChatMessage, UserRole } from '@/types';
import {
  Send,
  Pin,
  Paperclip,
  Smile,
  Code,
  Search,
  Sparkles,
  Bot,
  User,
  CheckCheck,
} from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: UserRole;
  isPublicAI: boolean;
  onSendMessage: (content: string, codeSnippet?: { language: string; code: string }) => void;
  onTogglePublicAI: (enabled: boolean) => void;
  onPinMessage: (messageId: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  currentUserName,
  currentUserRole,
  isPublicAI,
  onSendMessage,
  onTogglePublicAI,
  onPinMessage,
}) => {
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState({ language: 'javascript', code: '' });

  const pinnedMessages = messages.filter((m) => m.pinned);
  const filteredMessages = messages.filter((m) =>
    m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.senderName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSend = () => {
    if (!input.trim() && !codeSnippet.code.trim()) return;
    onSendMessage(
      input.trim(),
      showCodeInput && codeSnippet.code.trim() ? codeSnippet : undefined
    );
    setInput('');
    setCodeSnippet({ language: 'javascript', code: '' });
    setShowCodeInput(false);
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl p-3 border border-white/10 overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-col border-b border-white/10 pb-2.5 gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
            💬 Class Chat & Public AI
          </h3>

          {currentUserRole === 'TEACHER' && (
            <button
              onClick={() => onTogglePublicAI(!isPublicAI)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                isPublicAI
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-white/10'
              }`}
            >
              <Sparkles size={10} /> Public AI {isPublicAI ? 'ON' : 'OFF'}
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chat messages..."
            className="w-full bg-slate-950/60 rounded-lg pl-7 pr-2 py-1 text-xs text-slate-200 border border-white/10 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Pinned Messages Banner */}
        {pinnedMessages.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md text-[11px] text-amber-200 flex items-center justify-between">
            <span className="truncate flex items-center gap-1">
              <Pin size={10} className="text-amber-400" /> Pinned: {pinnedMessages[pinnedMessages.length - 1].content}
            </span>
          </div>
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto py-3 px-1 flex flex-col gap-2.5">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-xs text-slate-500 my-auto">No messages yet. Say hello!</div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${
                  isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                  {msg.isAI ? (
                    <span className="font-bold text-indigo-400 flex items-center gap-0.5">
                      <Bot size={10} /> AI Tutor
                    </span>
                  ) : (
                    <span className="font-medium text-slate-300">{msg.senderName}</span>
                  )}
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div
                  className={`relative p-2.5 rounded-xl text-xs leading-relaxed border ${
                    msg.isAI
                      ? 'bg-indigo-950/70 border-indigo-500/30 text-indigo-100 shadow-md'
                      : isMe
                      ? 'bg-indigo-600 border-indigo-500 text-white rounded-br-none'
                      : 'bg-slate-900 border-white/10 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Code snippet display */}
                  {msg.codeSnippet && (
                    <div className="mt-2 bg-slate-950 p-2 rounded border border-white/10 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      <div className="text-[9px] uppercase font-bold text-slate-500 mb-1">{msg.codeSnippet.language}</div>
                      <pre><code>{msg.codeSnippet.code}</code></pre>
                    </div>
                  )}

                  {/* Action row */}
                  <div className="flex items-center justify-end gap-1 mt-1 opacity-70 hover:opacity-100 transition">
                    <button onClick={() => onPinMessage(msg.id)} className="text-[10px] hover:text-amber-300">
                      <Pin size={10} />
                    </button>
                    <CheckCheck size={12} className="text-emerald-300" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Code Input Dropdown */}
      {showCodeInput && (
        <div className="bg-slate-950 p-2 rounded-xl border border-indigo-500/30 mb-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-indigo-300">
            <span>Attach Code Snippet</span>
            <select
              value={codeSnippet.language}
              onChange={(e) => setCodeSnippet({ ...codeSnippet, language: e.target.value })}
              className="bg-slate-900 text-xs text-slate-200 px-2 py-0.5 rounded border border-white/10"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>
          </div>
          <textarea
            value={codeSnippet.code}
            onChange={(e) => setCodeSnippet({ ...codeSnippet, code: e.target.value })}
            placeholder="Paste code snippet here..."
            className="w-full h-16 bg-slate-900 rounded p-1.5 font-mono text-xs text-emerald-400 focus:outline-none resize-none border border-white/10"
          />
        </div>
      )}

      {/* Footer Chat Input */}
      <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-white/10">
        <button
          onClick={() => setShowCodeInput(!showCodeInput)}
          className={`p-1.5 rounded-lg transition ${
            showCodeInput ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
          title="Code Snippet"
        >
          <Code size={15} />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isPublicAI ? "Ask question to Public AI or chat..." : "Type message..."}
          className="flex-1 bg-transparent text-xs text-slate-200 px-1 focus:outline-none"
        />

        <button
          onClick={handleSend}
          disabled={!input.trim() && !codeSnippet.code.trim()}
          className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};
