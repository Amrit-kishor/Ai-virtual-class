'use client';

import React, { useState, useCallback } from 'react';
import { UploadCloud, X, FileText, Image as ImageIcon, FileCode, FileArchive, Loader2, CheckCircle2 } from 'lucide-react';

interface MultiUploadZoneProps {
  onClose: () => void;
  onUploadSuccess: (fileContext: string, fileName: string) => void;
}

export const MultiUploadZone: React.FC<MultiUploadZoneProps> = ({ onClose, onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    setIsUploading(true);
    setUploadStatus(`Analyzing ${file.name}...`);
    setUploadProgress(10);

    // Simulated file parsing (In a real app, this goes to /api/classroom/upload)
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadProgress(40);
      const res = await fetch('/api/classroom/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);

      if (!res.ok) {
        throw new Error('Upload failed. Check file format or size limits.');
      }

      const data = await res.json();
      setUploadProgress(100);
      setUploadStatus(`Successfully parsed ${file.name}!`);

      setTimeout(() => {
        onUploadSuccess(data.extractedText || 'Simulated Extracted Context', file.name);
        onClose();
      }, 1500);

    } catch (err: any) {
      setUploadStatus(`Error: ${err.message || 'Processing failed'}`);
      setUploadProgress(0);
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-lg w-full p-6 flex flex-col shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition">
          <X size={20} />
        </button>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UploadCloud className="text-indigo-400" /> Upload Course Material
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Upload PDFs, Documents, Code, or Images. The AI will instantly read, analyze, and answer questions based on your files.
          </p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${
            isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-950/50'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center w-full">
              <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
              <p className="text-sm font-semibold text-slate-200">{uploadStatus}</p>
              <div className="w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-4 mb-4 opacity-70">
                <FileText size={32} className="text-rose-400" />
                <ImageIcon size={32} className="text-emerald-400" />
                <FileCode size={32} className="text-blue-400" />
                <FileArchive size={32} className="text-amber-400" />
              </div>
              <p className="text-slate-300 font-medium mb-1">Drag and drop files here</p>
              <p className="text-xs text-slate-500 mb-6">Support for PDF, DOCX, PPT, PNG, JPG, ZIP, and Source Code</p>
              
              <label className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl cursor-pointer shadow-lg shadow-indigo-600/30 transition">
                Browse Files
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileInput}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.svg,.webp,.zip,.js,.ts,.py,.java,.cpp,.c,.cs,.go,.rs,text/*,application/pdf"
                />
              </label>
            </>
          )}
        </div>

        {uploadProgress === 100 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
            <CheckCircle2 size={16} />
            <span className="text-xs font-bold">Upload Complete! Context Added to AI Memory.</span>
          </div>
        )}
      </div>
    </div>
  );
};
