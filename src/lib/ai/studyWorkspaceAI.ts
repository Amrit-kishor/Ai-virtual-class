// src/lib/ai/studyWorkspaceAI.ts
// Citation-based RAG engine for AI Study Workspace
// Answers ONLY from uploaded sources — never hallucinates.

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface Citation {
  documentName: string;
  fileId: string;
  page: number;
  paragraph: number;
  text: string;
}

export interface AIAnswer {
  answer: string;
  explanation: string;
  keyPoints: string[];
  examples: string[];
  citations: Citation[];
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_FOUND';
}

// ----------------------------------------------------------------
// Embedding utilities (cosine similarity, chunking)
// ----------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

// ----------------------------------------------------------------
// Index a file's text content into the Embedding table
// ----------------------------------------------------------------

export async function indexFileChunks(
  notebookId: string,
  fileId: string,
  chunks: Array<{ text: string; page: number; paragraph: number }>
): Promise<void> {
  // Delete old embeddings for this file to allow re-indexing
  await prisma.embedding.deleteMany({ where: { fileId } });

  for (const chunk of chunks) {
    const vector = await getEmbedding(chunk.text);
    await prisma.embedding.create({
      data: {
        notebookId,
        fileId,
        chunk: chunk.text,
        page: chunk.page,
        paragraph: chunk.paragraph,
        vectorJson: JSON.stringify(vector),
      },
    });
  }

  await prisma.notebookFile.update({
    where: { id: fileId },
    data: { indexed: true },
  });
}

// ----------------------------------------------------------------
// Retrieve top-k similar chunks from the notebook
// ----------------------------------------------------------------

async function retrieveRelevantChunks(
  notebookId: string,
  query: string,
  topK = 6
): Promise<Array<{ chunk: string; page: number; paragraph: number; fileId: string; score: number }>> {
  const queryVector = await getEmbedding(query);

  const embeddings = await prisma.embedding.findMany({
    where: { notebookId },
    select: { chunk: true, page: true, paragraph: true, fileId: true, vectorJson: true },
  });

  const scored = embeddings.map((e) => {
    const vec: number[] = JSON.parse(e.vectorJson);
    return { chunk: e.chunk, page: e.page, paragraph: e.paragraph, fileId: e.fileId, score: cosineSimilarity(queryVector, vec) };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

// ----------------------------------------------------------------
// Main chat function — returns structured answer with citations
// ----------------------------------------------------------------

export async function answerFromSources(
  notebookId: string,
  question: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AIAnswer> {
  const chunks = await retrieveRelevantChunks(notebookId, question);

  if (chunks.length === 0 || chunks[0].score < 0.25) {
    return {
      answer: "I couldn't find this information in your uploaded sources.",
      explanation: '',
      keyPoints: [],
      examples: [],
      citations: [],
      confidenceLevel: 'NOT_FOUND',
    };
  }

  // Fetch file names for citations
  const fileIds = [...new Set(chunks.map((c) => c.fileId))];
  const files = await prisma.notebookFile.findMany({
    where: { id: { in: fileIds } },
    select: { id: true, title: true },
  });
  const fileMap = new Map(files.map((f) => [f.id, f.title]));

  const context = chunks
    .map((c, i) => `[Source ${i + 1}] ${fileMap.get(c.fileId) ?? 'Unknown'} | Page ${c.page} | Para ${c.paragraph}:\n${c.chunk}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are an AI study assistant. You ONLY answer from the provided source excerpts below.
If the answer is not in the sources, respond with exactly: "I couldn't find this information in your uploaded sources."
NEVER invent information. ALWAYS cite sources in your response.

SOURCES:
${context}

Respond in this exact JSON format:
{
  "answer": "Direct answer to the question",
  "explanation": "Detailed explanation based on sources",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "examples": ["example from the material"],
  "citations": [{"sourceIndex": 1, "relevantText": "exact quote"}],
  "confidenceLevel": "HIGH|MEDIUM|LOW"
}`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: question },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const raw = completion.choices[0].message.content ?? '{}';
  let parsed: {
    answer?: string;
    explanation?: string;
    keyPoints?: string[];
    examples?: string[];
    citations?: Array<{ sourceIndex: number; relevantText: string }>;
    confidenceLevel?: string;
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  // If the AI flagged not found
  if (!parsed.answer || parsed.answer.includes("couldn't find")) {
    return {
      answer: "I couldn't find this information in your uploaded sources.",
      explanation: '',
      keyPoints: [],
      examples: [],
      citations: [],
      confidenceLevel: 'NOT_FOUND',
    };
  }

  // Build proper citations
  const citations: Citation[] = (parsed.citations ?? []).map((c) => {
    const idx = (c.sourceIndex ?? 1) - 1;
    const chunk = chunks[idx] ?? chunks[0];
    return {
      documentName: fileMap.get(chunk.fileId) ?? 'Unknown',
      fileId: chunk.fileId,
      page: chunk.page,
      paragraph: chunk.paragraph,
      text: c.relevantText ?? chunk.chunk.slice(0, 200),
    };
  });

  return {
    answer: parsed.answer ?? '',
    explanation: parsed.explanation ?? '',
    keyPoints: parsed.keyPoints ?? [],
    examples: parsed.examples ?? [],
    citations,
    confidenceLevel: (parsed.confidenceLevel as AIAnswer['confidenceLevel']) ?? 'MEDIUM',
  };
}

// ----------------------------------------------------------------
// Streaming version for real-time chat
// ----------------------------------------------------------------

export async function streamAnswerFromSources(
  notebookId: string,
  question: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk: (text: string) => void,
  onDone: (answer: AIAnswer) => void
): Promise<void> {
  // Get full structured answer (for citations), then stream the narrative part
  const structured = await answerFromSources(notebookId, question, chatHistory);
  onDone(structured);
  // Stream the combined display text
  const display = `${structured.answer}\n\n${structured.explanation}`;
  for (const char of display) {
    onChunk(char);
    await new Promise((r) => setTimeout(r, 4));
  }
}

// ----------------------------------------------------------------
// Smart study tools — generate from indexed content
// ----------------------------------------------------------------

export async function generateFlashcards(
  notebookId: string,
  count = 10
): Promise<Array<{ question: string; answer: string; sourceRef: string }>> {
  const embeddings = await prisma.embedding.findMany({
    where: { notebookId },
    take: 20,
    select: { chunk: true, page: true, fileId: true },
  });

  if (embeddings.length === 0) return [];

  const content = embeddings.map((e) => e.chunk).join('\n\n');
  const fileIds = [...new Set(embeddings.map((e) => e.fileId))];
  const files = await prisma.notebookFile.findMany({
    where: { id: { in: fileIds } },
    select: { id: true, title: true },
  });
  const fileMap = new Map(files.map((f) => [f.id, f.title]));

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Generate ${count} flashcards from this study material. Return JSON array: [{"question":"...","answer":"...","sourceRef":"..."}]. Only use information from the provided content.`,
      },
      { role: 'user', content: content.slice(0, 6000) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const raw = completion.choices[0].message.content ?? '{"flashcards":[]}';
  const parsed = JSON.parse(raw);
  return (parsed.flashcards ?? parsed.items ?? []).slice(0, count);
}

export async function generateQuiz(
  notebookId: string,
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM',
  count = 5
): Promise<Array<{ question: string; options: string[]; correctAns: string; explanation: string }>> {
  const embeddings = await prisma.embedding.findMany({
    where: { notebookId },
    take: 15,
    select: { chunk: true },
  });

  if (embeddings.length === 0) return [];
  const content = embeddings.map((e) => e.chunk).join('\n\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Generate ${count} MCQ questions at ${difficulty} difficulty from this material. Return JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAns":"A","explanation":"..."}]}. Only use information from the provided content.`,
      },
      { role: 'user', content: content.slice(0, 6000) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const raw = completion.choices[0].message.content ?? '{"questions":[]}';
  const parsed = JSON.parse(raw);
  return (parsed.questions ?? []).slice(0, count);
}

export async function generateSummary(notebookId: string): Promise<string> {
  const embeddings = await prisma.embedding.findMany({
    where: { notebookId },
    take: 30,
    select: { chunk: true },
  });

  if (embeddings.length === 0) return '';
  const content = embeddings.map((e) => e.chunk).join('\n\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Create a comprehensive study summary from the provided material. Use markdown with headings, bullet points, and key takeaways. Only summarize information present in the content.' },
      { role: 'user', content: content.slice(0, 8000) },
    ],
    temperature: 0.2,
  });

  return completion.choices[0].message.content ?? '';
}

export async function semanticSearch(
  notebookId: string,
  query: string
): Promise<Array<{ chunk: string; page: number; paragraph: number; fileId: string; fileName: string; score: number }>> {
  const chunks = await retrieveRelevantChunks(notebookId, query, 10);
  const fileIds = [...new Set(chunks.map((c) => c.fileId))];
  const files = await prisma.notebookFile.findMany({
    where: { id: { in: fileIds } },
    select: { id: true, title: true },
  });
  const fileMap = new Map(files.map((f) => [f.id, f.title]));
  return chunks.map((c) => ({ ...c, fileName: fileMap.get(c.fileId) ?? 'Unknown' }));
}
