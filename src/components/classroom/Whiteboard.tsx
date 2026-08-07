'use client';

import React, { useRef, useState, useEffect } from 'react';
import { WhiteboardElement, ToolType } from '@/types';
import {
  Pencil,
  Eraser,
  Square,
  Circle as CircleIcon,
  Minus,
  Type,
  StickyNote,
  Pointer,
  ZoomIn,
  ZoomOut,
  Trash2,
  Check,
} from 'lucide-react';

interface WhiteboardProps {
  elements: WhiteboardElement[];
  onUpdateElements: (elements: WhiteboardElement[]) => void;
  onEmitLaser: (x: number, y: number) => void;
}

interface InlineInputState {
  id: string;
  type: 'text' | 'sticky';
  x: number; // Canvas relative X
  y: number; // Canvas relative Y
  screenX: number; // Pixel X relative to container
  screenY: number; // Pixel Y relative to container
  text: string;
  color: string;
  strokeWidth: number;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  elements,
  onUpdateElements,
  onEmitLaser,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#6366f1');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);

  // Direct Inline Text Editing on Canvas State
  const [inlineInput, setInlineInput] = useState<InlineInputState | null>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Auto focus textarea when opened
  useEffect(() => {
    if (inlineInput && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [inlineInput]);

  // Redraw canvas on elements update or zoom change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle canvas dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(panOffset.x, panOffset.y);

    // Draw grid background pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < canvas.width / zoom; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height / zoom);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height / zoom; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width / zoom, y);
      ctx.stroke();
    }

    // Render all elements
    const allElements = currentElement ? [...elements, currentElement] : elements;

    allElements.forEach((el) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.bgColor || el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'pen' || el.type === 'eraser') {
        if (el.type === 'eraser') {
          ctx.strokeStyle = '#090d16'; // background eraser
          ctx.lineWidth = el.strokeWidth * 4;
        }
        if (el.points && el.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
          }
          ctx.stroke();
        }
      } else if (el.type === 'rectangle') {
        ctx.beginPath();
        ctx.rect(el.x, el.y, el.width || 0, el.height || 0);
        ctx.stroke();
      } else if (el.type === 'circle') {
        ctx.beginPath();
        const radius = Math.sqrt((el.width || 0) ** 2 + (el.height || 0) ** 2);
        ctx.arc(el.x, el.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + (el.width || 0), el.y + (el.height || 0));
        ctx.stroke();
      } else if (el.type === 'text') {
        const fontSize = Math.max(16, el.strokeWidth * 6);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = el.color;
        const lines = (el.text || 'Text').split('\n');
        lines.forEach((line, lineIdx) => {
          ctx.fillText(line, el.x, el.y + lineIdx * (fontSize + 4));
        });
      } else if (el.type === 'sticky') {
        ctx.fillStyle = el.bgColor || 'rgba(251, 191, 36, 0.2)';
        ctx.fillRect(el.x, el.y, 160, 110);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(el.x, el.y, 160, 110);
        ctx.fillStyle = '#fef3c7';
        ctx.font = '13px sans-serif';
        const lines = (el.text || 'Sticky Note').split('\n');
        lines.forEach((line, lineIdx) => {
          ctx.fillText(line, el.x + 10, el.y + 25 + lineIdx * 16);
        });
      }
    });

    ctx.restore();
  }, [elements, currentElement, zoom, panOffset]);

  const handleFinalizeInlineText = () => {
    if (!inlineInput) return;
    if (inlineInput.text.trim()) {
      const newEl: WhiteboardElement = {
        id: inlineInput.id,
        type: inlineInput.type,
        x: inlineInput.x,
        y: inlineInput.y,
        color: inlineInput.color,
        strokeWidth: inlineInput.strokeWidth,
        text: inlineInput.text.trim(),
        bgColor: inlineInput.type === 'sticky' ? 'rgba(251, 191, 36, 0.25)' : undefined,
      };
      onUpdateElements([...elements, newEl]);
    }
    setInlineInput(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - panOffset.x;
    const y = (e.clientY - rect.top) / zoom - panOffset.y;

    if (tool === 'laser') {
      onEmitLaser(x, y);
      return;
    }

    // If an inline input is currently open, finalize it before starting a new action
    if (inlineInput) {
      handleFinalizeInlineText();
    }

    // Direct Inline Canvas Text Area
    if (tool === 'text' || tool === 'sticky') {
      setInlineInput({
        id: 'el_' + Date.now(),
        type: tool,
        x,
        y,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
        text: '',
        color,
        strokeWidth,
      });
      return;
    }

    setIsDrawing(true);

    const newEl: WhiteboardElement = {
      id: 'el_' + Date.now(),
      type: tool,
      x,
      y,
      color,
      strokeWidth,
      points: [{ x, y }],
    };

    setCurrentElement(newEl);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - panOffset.x;
    const y = (e.clientY - rect.top) / zoom - panOffset.y;

    if (tool === 'laser') {
      onEmitLaser(x, y);
      return;
    }

    if (!isDrawing || !currentElement) return;

    if (tool === 'pen' || tool === 'eraser') {
      setCurrentElement({
        ...currentElement,
        points: [...(currentElement.points || []), { x, y }],
      });
    } else {
      setCurrentElement({
        ...currentElement,
        width: x - currentElement.x,
        height: y - currentElement.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentElement) {
      const updated = [...elements, currentElement];
      onUpdateElements(updated);
      setCurrentElement(null);
    }
    setIsDrawing(false);
  };

  const handleClear = () => {
    onUpdateElements([]);
    setInlineInput(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full glass-panel rounded-2xl border border-white/10 overflow-hidden flex flex-col select-none"
    >
      {/* Top Toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 shadow-2xl flex items-center gap-1.5 text-slate-300">
        <button
          onClick={() => {
            if (inlineInput) handleFinalizeInlineText();
            setTool('pen');
          }}
          className={`p-2 rounded-lg transition ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          title="Pen"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => {
            if (inlineInput) handleFinalizeInlineText();
            setTool('eraser');
          }}
          className={`p-2 rounded-lg transition ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          title="Eraser"
        >
          <Eraser size={15} />
        </button>
        <button
          onClick={() => {
            if (inlineInput) handleFinalizeInlineText();
            setTool('rectangle');
          }}
          className={`p-2 rounded-lg transition ${tool === 'rectangle' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          title="Rectangle"
        >
          <Square size={15} />
        </button>
        <button
          onClick={() => {
            if (inlineInput) handleFinalizeInlineText();
            setTool('circle');
          }}
          className={`p-2 rounded-lg transition ${tool === 'circle' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          title="Circle"
        >
          <CircleIcon size={15} />
        </button>
        <button
          onClick={() => {
            if (inlineInput) handleFinalizeInlineText();
            setTool('line');
          }}
          className={`p-2 rounded-lg transition ${tool === 'line' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          title="Line"
        >
          <Minus size={15} />
        </button>
        <button
          onClick={() => {
            if (inlineInput) handleFinalizeInlineText();
            setTool('text');
          }}
          className={`p-2 rounded-lg transition ${tool === 'text' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          title="Text (Click on canvas to type)"
        >
          <Type size={15} />
        </button>
        <button
          onClick={() => {
            if (inlineInput) handleFinalizeInlineText();
            setTool('sticky');
          }}
          className={`p-2 rounded-lg transition ${tool === 'sticky' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          title="Sticky Note (Click on canvas to place note)"
        >
          <StickyNote size={15} />
        </button>
        <button
          onClick={() => {
            if (inlineInput) handleFinalizeInlineText();
            setTool('laser');
          }}
          className={`p-2 rounded-lg transition ${tool === 'laser' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          title="Laser Pointer"
        >
          <Pointer size={15} />
        </button>

        <div className="w-[1px] h-6 bg-white/10 mx-1" />

        {/* Colors */}
        {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ffffff'].map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-5 h-5 rounded-full border border-white/20 transition transform ${
              color === c ? 'scale-125 ring-2 ring-indigo-400' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}

        <div className="w-[1px] h-6 bg-white/10 mx-1" />

        {/* Zoom & Clear */}
        <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-1.5 hover:bg-slate-800 rounded">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-1.5 hover:bg-slate-800 rounded">
          <ZoomOut size={14} />
        </button>
        <button onClick={handleClear} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded" title="Clear Canvas">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Canvas Area */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="w-full h-full cursor-crosshair relative z-10"
      />

      {/* Direct Canvas Text Area Overlay - Stops Propagation */}
      {inlineInput && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 transform -translate-x-2 -translate-y-2 flex flex-col gap-1"
          style={{
            left: `${inlineInput.screenX}px`,
            top: `${inlineInput.screenY}px`,
          }}
        >
          {inlineInput.type === 'sticky' ? (
            <div className="bg-amber-200 border-2 border-amber-400 p-2.5 rounded-xl shadow-2xl w-48 h-36 flex flex-col gap-1.5">
              <textarea
                ref={textareaRef}
                value={inlineInput.text}
                onChange={(e) => setInlineInput({ ...inlineInput, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    handleFinalizeInlineText();
                  }
                }}
                placeholder="Type sticky note..."
                className="w-full flex-1 bg-transparent font-sans text-xs font-semibold text-slate-900 focus:outline-none resize-none leading-relaxed"
              />
              <button
                onClick={handleFinalizeInlineText}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1 rounded text-[10px] flex items-center justify-center gap-1 shadow"
              >
                <Check size={12} /> Save Sticky Note
              </button>
            </div>
          ) : (
            <div className="bg-slate-900/95 border-2 border-indigo-500 p-2 rounded-xl shadow-2xl flex flex-col gap-1.5 min-w-[180px]">
              <textarea
                ref={textareaRef}
                value={inlineInput.text}
                onChange={(e) => setInlineInput({ ...inlineInput, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleFinalizeInlineText();
                  }
                }}
                placeholder="Type directly on canvas..."
                className="w-full bg-transparent font-sans text-xs font-bold focus:outline-none resize-none leading-relaxed min-h-[40px]"
                style={{
                  color: inlineInput.color,
                  fontSize: `${Math.max(14, inlineInput.strokeWidth * 5)}px`,
                }}
              />
              <button
                onClick={handleFinalizeInlineText}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1 rounded text-[10px] flex items-center justify-center gap-1 shadow"
              >
                <Check size={12} /> Add Text to Whiteboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
