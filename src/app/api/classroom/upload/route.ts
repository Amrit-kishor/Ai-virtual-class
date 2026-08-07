// src/app/api/classroom/upload/route.ts
// Multi-format classroom file upload and parsing engine for AI Teacher and Doubt Solver

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { extractChunks } from '@/lib/fileParser';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB limit

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.zip',
  '.js',
  '.ts',
  '.py',
  '.java',
  '.cpp',
  '.c',
  '.cs',
  '.go',
  '.rs',
]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds the 25 MB limit. Please upload a smaller file.' },
        { status: 413 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type "${ext}" is not supported. Please upload PDF, DOCX, PPTX, TXT, MD, CSV, Code, or Images.` },
        { status: 415 }
      );
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const storageId = uuidv4();
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const storagePath = path.join(UPLOAD_DIR, `${storageId}${ext}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(storagePath, buffer);

    let extractedText = '';

    try {
      const chunks = await extractChunks(storagePath, file.type || '');
      if (chunks.length > 0) {
        extractedText = chunks.map((c) => c.text).join('\n\n');
      } else {
        // Fallback for text-based or raw readable formats
        if (['.txt', '.md', '.csv', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs'].includes(ext)) {
          extractedText = buffer.toString('utf-8');
        } else if (['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext)) {
          extractedText = `[Image Document: ${file.name}]\nFormat: ${ext}\nSize: ${Math.round(file.size / 1024)} KB\nDescription: Visual diagram / screenshot uploaded for AI classroom analysis.`;
        } else {
          extractedText = `[Document: ${file.name}]\nSize: ${Math.round(file.size / 1024)} KB\nUploaded and indexed for AI Teacher context.`;
        }
      }
    } catch (parseErr) {
      console.warn('[Upload Parser Warning]', parseErr);
      extractedText = buffer.toString('utf-8').slice(0, 5000) || `[Uploaded file: ${file.name}]`;
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || ext,
      extractedText: extractedText.trim(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error processing uploaded file.';
    console.error('[Upload Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
