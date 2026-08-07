// src/lib/fileParser.ts
// Extracts text chunks from uploaded files for RAG indexing

import fs from 'fs';
import path from 'path';

export interface TextChunk {
  text: string;
  page: number;
  paragraph: number;
}

function chunkText(text: string, chunkSize = 500): TextChunk[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 30);
  const chunks: TextChunk[] = [];
  let paraIndex = 0;
  let pageEstimate = 1;
  let charCount = 0;

  for (const para of paragraphs) {
    paraIndex++;
    charCount += para.length;
    if (charCount > 2000) {
      pageEstimate++;
      charCount = 0;
    }
    // Split large paragraphs into sub-chunks
    if (para.length > chunkSize) {
      for (let i = 0; i < para.length; i += chunkSize) {
        chunks.push({
          text: para.slice(i, i + chunkSize).trim(),
          page: pageEstimate,
          paragraph: paraIndex,
        });
      }
    } else {
      chunks.push({ text: para.trim(), page: pageEstimate, paragraph: paraIndex });
    }
  }
  return chunks;
}

export async function extractChunks(filePath: string, mimeType: string): Promise<TextChunk[]> {
  const ext = path.extname(filePath).toLowerCase();

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    // Dynamic import to avoid issues when package not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return chunkText(data.text);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return chunkText(result.value);
  }

  if (mimeType === 'text/plain' || ext === '.txt' || ext === '.md' || ext === '.csv') {
    const text = fs.readFileSync(filePath, 'utf-8');
    return chunkText(text);
  }

  // Code files
  const codeExts = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs', '.rb'];
  if (codeExts.includes(ext)) {
    const text = fs.readFileSync(filePath, 'utf-8');
    return chunkText(text, 800);
  }

  // Images — return empty (vision handled separately via OpenAI vision)
  return [];
}
