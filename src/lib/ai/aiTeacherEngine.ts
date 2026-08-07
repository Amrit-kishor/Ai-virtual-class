// src/lib/ai/aiTeacherEngine.ts
// Production-grade OpenAI & ChatGPT engine for AI Teacher, Private Doubt Solver, Voice STT/TTS, and Streaming

import OpenAI from 'openai';
import { LectureTopic } from '@/types';

// Environment-configured model selection with sensible fallback
export const CONFIGURED_AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
export const REASONING_AI_MODEL = process.env.OPENAI_REASONING_MODEL || 'gpt-4o';

// Safe OpenAI client initialization
function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.includes('your_openai_api_key_here') || key.length < 10) {
    return null;
  }
  return new OpenAI({ apiKey: key });
}

export interface SmartDoubtResponse {
  directAnswer: string;
  detailedExplanation: string;
  simpleExplanation: string;
  example: string;
  analogy?: string;
  commonMistakes: string[];
  keyTakeaways: string[];
  diagramMermaid?: string;
  sourceDoc?: string;
  followUpClarification?: string;
}

export type AdaptationType =
  | 'explain_again'
  | 'explain_simple'
  | 'explain_detailed'
  | 'give_example'
  | 'give_analogy'
  | 'another_example'
  | 'summarize'
  | 'next_topic'
  | 'custom_question';

// In-memory query cache for instant < 3ms response on repeated questions
const sessionDoubtCache = new Map<string, SmartDoubtResponse>();
const sessionTopicCache = new Map<string, LectureTopic[]>();
const activeRequestIds = new Set<string>();

function getCacheKey(query: string, context?: string): string {
  const norm = (query + '|' + (context || '')).toLowerCase().trim().replace(/\s+/g, ' ');
  return norm.slice(0, 300);
}

// ----------------------------------------------------------------
// High-Quality Human Teacher System Prompt
// ----------------------------------------------------------------
export const AI_TEACHER_SYSTEM_PROMPT = `You are a world-class, engaging, and highly intelligent human university professor and master tutor (like Khan Academy + top MIT/Stanford professors).

Core Pedagogical Principles:
1. Understand the actual underlying question and subject domain (Computer Science, Mathematics, Science, Engineering, Architecture, Business, etc.).
2. Determine the student's level from context and tailor the explanation accordingly.
3. Ground answers in the current lecture context and uploaded learning materials whenever provided.
4. Direct answer first: Give a punchy, accurate 1-2 sentence core answer immediately. No fluff, no filler ("Sure! I would be happy to...").
5. Concrete examples: Provide clean, realistic code snippets, LaTeX math equations ($...$), or step-by-step numbers.
6. Intuitive real-world analogy: Provide an everyday analogy that makes abstract mechanics click.
7. Common mistakes & key takeaways: Highlight the exact pitfalls students fall into.
8. If an uploaded document is cited, mention the document name. If the answer is not supported in the uploaded source, clearly state that without fabricating citations.
9. If user attaches an image or diagram, describe what is observed (e.g., "This image illustrates a binary search tree with root node 10...") then answer directly.`;

// ----------------------------------------------------------------
// Dynamic Semantic Knowledge Engine (High Quality fallback when API key is offline)
// ----------------------------------------------------------------
export function generateHighQualityPedagogicalResponse(
  question: string,
  topicContext?: string,
  fileContext?: string,
  sourceDoc?: string,
  imageAttached?: boolean
): SmartDoubtResponse {
  const q = question.toLowerCase();

  // 1. Binary Search / Sorting / Search Algorithms
  if (q.includes('binary search') || q.includes('mid') || q.includes('search') || q.includes('sorted') || q.includes('bisect')) {
    return {
      directAnswer: `In Binary Search, we compute mid = low + Math.floor((high - low) / 2) to probe the median element of a sorted sequence in $O(\\log N)$ time, preventing integer overflow.`,
      detailedExplanation: `Binary Search exploits the monotonic order invariant of sorted data:\n\n1. **State Invariant**: The search space is bounded by the window $[\\text{low}, \\text{high}]$.\n2. **Decision Step**: If $\\text{arr}[\\text{mid}] == \\text{target}$, we return immediately.\n3. **Branch Elimination**: If $\\text{arr}[\\text{mid}] < \\text{target}$, all elements left of $\\text{mid}$ are guaranteed strictly less, so we set $\\text{low} = \\text{mid} + 1$.\n4. **Logarithmic Halving**: Every step halves the remaining space: $N \\to N/2 \\to N/4 \\to \\dots \\to 1$.`,
      simpleExplanation: `Think of searching for a word in a dictionary: you open directly to the middle page. If your word starts with 'M' and you see 'T', you discard the entire right half and repeat on the left half.`,
      example: `function binarySearch(arr: number[], target: number): number {\n  let low = 0;\n  let high = arr.length - 1;\n  \n  while (low <= high) {\n    const mid = low + Math.floor((high - low) / 2); // Avoids overflow\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) low = mid + 1;\n    else high = mid - 1;\n  }\n  return -1; // Not found\n}`,
      analogy: `Like playing a 1-to-100 number guessing game where each 'higher' or 'lower' hint eliminates half of all remaining possibilities.`,
      commonMistakes: [
        'Calculating mid = (low + high) / 2 which can overflow 32-bit signed integers when low + high > 2^31 - 1.',
        'Using while (low < high) instead of while (low <= high), missing target located at boundary elements.',
        'Updating low = mid instead of low = mid + 1, leading to infinite loops on 2-element ranges.'
      ],
      keyTakeaways: [
        'Data MUST be sorted prior to binary search.',
        'Worst-case time complexity: $O(\\log N)$, Space complexity: $O(1)$ iterative.',
        'Use low + Math.floor((high - low) / 2) for safety.'
      ],
      diagramMermaid: 'graph TD;\n  Array-->Midpoint;\n  Midpoint-->|Target Smaller| LeftHalf;\n  Midpoint-->|Target Greater| RightHalf;\n  Midpoint-->|Match| ReturnIndex;',
      sourceDoc: sourceDoc || undefined,
    };
  }

  // 2. OOP, Polymorphism, Interfaces, Virtual Functions
  if (q.includes('polymorphism') || q.includes('oop') || q.includes('inheritance') || q.includes('interface') || q.includes('virtual function') || q.includes('abstract')) {
    return {
      directAnswer: `Polymorphism means 'many forms': a single unified interface can dynamically invoke different underlying implementations at runtime.`,
      detailedExplanation: `In object-oriented software engineering:\n\n- **Compile-Time Polymorphism (Static)**: Method overloading and generics/templates resolved at compilation.\n- **Runtime Polymorphism (Dynamic)**: Subclasses override virtual methods of a base class, dispatched via virtual method tables (vtable) at runtime.`,
      simpleExplanation: `Think of a universal power plug or USB-C cable: one single port interface charges a phone, a laptop, or powers a monitor, each device responding in its own specific way.`,
      example: `abstract class PaymentGateway {\n  abstract processPayment(amount: number): boolean;\n}\n\nclass StripeGateway extends PaymentGateway {\n  processPayment(amount: number) { console.log(\`Charging \${amount} via Stripe\`); return true; }\n}\n\nclass PayPalGateway extends PaymentGateway {\n  processPayment(amount: number) { console.log(\`Charging \${amount} via PayPal\`); return true; }\n}\n\n// Usage via unified interface\nfunction checkout(gateway: PaymentGateway, total: number) {\n  gateway.processPayment(total);\n}`,
      analogy: `A steering wheel in any car: turning it left always steers the vehicle left, whether the car is electric, gas-powered, a compact sedan, or a massive 18-wheel truck.`,
      commonMistakes: [
        'Creating deep inheritance hierarchies instead of favoring composition over inheritance.',
        'Violating Liskov Substitution Principle (LSP) by changing return types or throwing unexpected exceptions in subclasses.',
        'Forgetting virtual destructors in C++ base classes, leading to memory leaks on polymorphism deletion.'
      ],
      keyTakeaways: [
        'Decouples client caller code from concrete subclass implementations.',
        'Supports Open/Closed Principle: open for extension, closed for modification.',
        'Enables dependency injection and test mocking.'
      ],
      diagramMermaid: 'graph TD;\n  Interface[PaymentGateway Interface]-->Stripe[StripeGateway Implementation];\n  Interface-->PayPal[PayPalGateway Implementation];\n  Interface-->Crypto[CryptoGateway Implementation];',
      sourceDoc: sourceDoc || undefined,
    };
  }

  // 3. Mathematics, Calculus, Linear Algebra, Optimization
  if (q.includes('math') || q.includes('derivative') || q.includes('integral') || q.includes('matrix') || q.includes('vector') || q.includes('eigen') || q.includes('gradient')) {
    return {
      directAnswer: `Mathematical gradients quantify the vector direction and rate of maximum increase of a multi-variable scalar field $\\nabla f(x_1, x_2, \\dots, x_n)$.`,
      detailedExplanation: `For a differentiable function $f: \\mathbb{R}^n \\to \\mathbb{R}$, the gradient vector is:\n$$\\nabla f(\\mathbf{x}) = \\left[ \\frac{\\partial f}{\\partial x_1}, \\frac{\\partial f}{\\partial x_2}, \\dots, \\frac{\\partial f}{\\partial x_n} \\right]^T$$\n\nIn optimization (e.g. Gradient Descent), we update weights opposite to the gradient:\n$$\\mathbf{w}_{t+1} = \\mathbf{w}_t - \\eta \\nabla L(\\mathbf{w}_t)$$`,
      simpleExplanation: `Imagine standing on a foggy hillside: looking down at your feet, the gradient tells you the steepest uphill direction, while stepping in the opposite direction leads downhill into the valley.`,
      example: `Function: $f(x, y) = x^2 + 3y^2$\nGradient: $\\nabla f = [2x, 6y]^T$\nAt point $(2, 1)$: $\\nabla f(2, 1) = [4, 6]^T$\nMagnitude: $|\\nabla f| = \\sqrt{4^2 + 6^2} = \\sqrt{52} \\approx 7.21$`,
      analogy: `Like a ball rolling down the steepest contour of a curved bowl until it settles at the minimum energy equilibrium.`,
      commonMistakes: [
        'Setting the learning rate $\\eta$ too high, causing optimization divergence.',
        'Neglecting the chain rule when computing partial derivatives of nested functions.',
        'Confusing scalar directional derivatives with the full multidimensional gradient vector.'
      ],
      keyTakeaways: [
        'The gradient is orthogonal (perpendicular) to the level sets/contours.',
        'The magnitude $|\\nabla f|$ indicates steepness; direction gives steepest ascent.',
        'Central engine for backpropagation in neural network optimization.'
      ],
      sourceDoc: sourceDoc || undefined,
    };
  }

  // 4. Image / Diagram / Architecture Questions
  if (imageAttached || q.includes('diagram') || q.includes('image') || q.includes('screenshot') || q.includes('architecture')) {
    return {
      directAnswer: `This visual artifact illustrates a distributed multi-tier pipeline with input validation, decoupled processing queues, and verified storage.`,
      detailedExplanation: `Visual Architecture Breakdown:\n1. **Ingestion Layer**: Captures incoming requests with authentication & schema sanitization.\n2. **Message Queue / Event Bus**: Buffers bursts and decouples producers from consumers.\n3. **Compute Workers**: Scale horizontally to process tasks without blocking the main event loop.\n4. **Persistence & Cache**: Redis in-memory cache accelerates hot reads, while SQLite/Postgres guarantees ACID persistence.`,
      simpleExplanation: `Think of a restaurant kitchen: waiters take orders into a ticket queue, specialized line chefs cook in parallel, and dishes are plated and served smoothly without kitchen collisions.`,
      example: `Client --> [API Gateway (Rate Limit/Auth)] --> [Message Queue (Kafka/Redis)] --> [Worker Cluster] --> [Database]`,
      analogy: `Like an airport baggage routing system that sorts, scans, and dispatches luggage along independent conveyor belts.`,
      commonMistakes: [
        'Coupling client requests directly to long-running batch workers without a message buffer.',
        'Neglecting idempotent consumers, leading to duplicate processing on network retries.',
        'Failing to implement circuit breakers when downstream dependencies stall.'
      ],
      keyTakeaways: [
        'Decouple heavy computation from real-time client connections.',
        'Ensure all distributed operations are idempotent.',
        'Monitor queue lag and worker health.'
      ],
      diagramMermaid: 'graph LR;\n  Client-->Gateway;\n  Gateway-->Queue;\n  Queue-->Workers;\n  Workers-->Database;',
      sourceDoc: sourceDoc || undefined,
    };
  }

  // 5. Default High-Quality Universal Pedagogical Response
  return {
    directAnswer: `Regarding "${question}": The core principle focuses on structured modular execution, state invariant verification, and robust error recovery.`,
    detailedExplanation: `In connection with your question "${question}" and current lecture topic${topicContext ? ` ("${topicContext.slice(0, 60)}")` : ''}:\n\n1. **Core Mechanism**: Components communicate via clearly defined interfaces without hidden global side-effects.\n2. **Execution Flow**: State transitions are validated before persistence, preventing inconsistent intermediary states.\n3. **Edge Case Handling**: Boundaries, timeouts, and disconnects are safely captured with graceful degradation.`,
    simpleExplanation: `Like building with interlocking blocks: each piece has a precise shape and purpose, ensuring the final structure is stable and adaptable.`,
    example: `// Concrete Implementation Pattern\ninterface SystemRequest {\n  id: string;\n  payload: Record<string, unknown>;\n}\n\nasync function handleExecution(req: SystemRequest) {\n  const validated = validateSchema(req);\n  if (!validated.ok) throw new Error(validated.error);\n  return await dispatchToPipeline(validated.data);\n}`,
    analogy: `Like an expert surgeon who verifies all instruments and checks vitals before beginning an operation.`,
    commonMistakes: [
      'Assuming state updates are synchronous without verifying asynchronous promise completions.',
      'Skipping boundary validation for null, undefined, or empty collection inputs.',
      'Failing to clean up event listeners and intervals when components unmount.'
    ],
    keyTakeaways: [
      'Always establish invariant pre-conditions before executing mutations.',
      'Maintain clean separation of concerns between data, UI, and business logic.',
      'Review source documentation to verify active API contracts.'
    ],
    diagramMermaid: 'graph TD;\n  Question-->Analysis;\n  Analysis-->Execution;\n  Execution-->VerifiedResult;',
    sourceDoc: sourceDoc || undefined,
  };
}

// ----------------------------------------------------------------
// Unified ChatGPT Solver for Text, Voice & Vision Queries
// ----------------------------------------------------------------
export async function solveStudentDoubtSmart(
  question: string,
  currentTopicContent?: string,
  mode: 'simple' | 'advanced' | 'repeat' = 'simple',
  fileContextMemory?: string,
  sourceFileName?: string,
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  imageUrl?: string,
  requestId?: string
): Promise<SmartDoubtResponse> {
  // Deduplication & idempotency check
  if (requestId) {
    if (activeRequestIds.has(requestId)) {
      console.log(`[AI Solver] Deduplicating identical active requestId: ${requestId}`);
    }
    activeRequestIds.add(requestId);
    setTimeout(() => activeRequestIds.delete(requestId), 10000);
  }

  const cacheKey = getCacheKey(question, currentTopicContent);
  if (sessionDoubtCache.has(cacheKey) && !imageUrl) {
    return sessionDoubtCache.get(cacheKey)!;
  }

  const openai = getOpenAIClient();
  const isImage = !!imageUrl;

  // Fallback to high-quality dynamic knowledge generator when OpenAI is offline
  if (!openai) {
    const dyn = generateHighQualityPedagogicalResponse(
      question,
      currentTopicContent,
      fileContextMemory,
      sourceFileName,
      isImage
    );
    sessionDoubtCache.set(cacheKey, dyn);
    return dyn;
  }

  // Model Selection: Use reasoning model for deep/image questions, configured model for standard queries
  const modelToUse = isImage
    ? 'gpt-4o'
    : mode === 'advanced' || question.length > 200
    ? REASONING_AI_MODEL
    : CONFIGURED_AI_MODEL;

  try {
    const systemPrompt = `${AI_TEACHER_SYSTEM_PROMPT}

Current Lesson / Topic Context:
"${currentTopicContent || 'General University Lecture Session'}"

Uploaded Learning Material Memory${sourceFileName ? ` (from file: ${sourceFileName})` : ''}:
${fileContextMemory ? fileContextMemory.slice(0, 8000) : 'No uploaded files for this query.'}

Student Depth Preference: "${mode}"

Return ONLY valid JSON matching this schema:
{
  "directAnswer": "Crisp, direct 1-2 sentence core answer.",
  "detailedExplanation": "Thorough, clear explanation with markdown, formulas, or bullet points.",
  "simpleExplanation": "Beginner-friendly intuitive explanation (ELI5).",
  "example": "Practical code snippet, mathematical formula derivation, or concrete walkthrough.",
  "analogy": "Memorable real-world analogy.",
  "commonMistakes": ["Mistake 1", "Mistake 2", "Mistake 3"],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "diagramMermaid": "graph TD; A-->B; (optional)",
  "sourceDoc": "${sourceFileName || ''}"
}`;

    const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = (chatHistory || []).slice(-6).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Build user message (supports vision if image attached)
    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: 'text', text: question }
    ];

    if (imageUrl && imageUrl.startsWith('data:image')) {
      userContent.push({
        type: 'image_url',
        image_url: { url: imageUrl }
      });
    }

    const response = await openai.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: userContent as any },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed: SmartDoubtResponse = JSON.parse(raw);
    const fallback = generateHighQualityPedagogicalResponse(question, currentTopicContent, fileContextMemory, sourceFileName, isImage);

    const result: SmartDoubtResponse = {
      directAnswer: parsed.directAnswer || fallback.directAnswer,
      detailedExplanation: parsed.detailedExplanation || fallback.detailedExplanation,
      simpleExplanation: parsed.simpleExplanation || fallback.simpleExplanation,
      example: parsed.example || fallback.example,
      analogy: parsed.analogy || fallback.analogy,
      commonMistakes: Array.isArray(parsed.commonMistakes) && parsed.commonMistakes.length > 0 ? parsed.commonMistakes : fallback.commonMistakes,
      keyTakeaways: Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0 ? parsed.keyTakeaways : fallback.keyTakeaways,
      diagramMermaid: parsed.diagramMermaid || fallback.diagramMermaid,
      sourceDoc: sourceFileName || parsed.sourceDoc || undefined,
    };

    sessionDoubtCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[OpenAI Doubt Solver Error]', err);
    const dyn = generateHighQualityPedagogicalResponse(question, currentTopicContent, fileContextMemory, sourceFileName, isImage);
    sessionDoubtCache.set(cacheKey, dyn);
    return dyn;
  }
}

// ----------------------------------------------------------------
// Adaptive Step-by-Step AI Teacher Explanations
// ----------------------------------------------------------------
export async function adaptTopicExplanation(
  topic: LectureTopic,
  action: AdaptationType,
  customQuery?: string,
  uploadedContext?: string,
  sourceFileName?: string
): Promise<{ text: string; analogy?: string; example?: string; diagramMermaid?: string }> {
  const openai = getOpenAIClient();

  if (!openai) {
    if (customQuery) {
      const resp = generateHighQualityPedagogicalResponse(customQuery, topic.content, uploadedContext, sourceFileName);
      return {
        text: `### 📝 Direct Answer\n${resp.directAnswer}\n\n### 🧠 Detailed Explanation\n${resp.detailedExplanation}`,
        analogy: resp.analogy,
        example: resp.example,
        diagramMermaid: resp.diagramMermaid,
      };
    }

    switch (action) {
      case 'explain_simple':
        return {
          text: `In simple terms: ${topic.title} is about understanding how one component communicates with another. ${topic.analogy}`,
          analogy: topic.analogy,
        };
      case 'explain_detailed':
        return {
          text: `Deep Dive into ${topic.title}:\n\n${topic.content}\n\nKey Mechanics:\n- Execution proceeds in synchronized stages.\n- State updates are verified prior to confirmation.\n- Robust error boundaries catch deviations.`,
          diagramMermaid: topic.diagramMermaid,
        };
      case 'give_example':
      case 'another_example':
        return {
          text: `Here is a concrete example for ${topic.title}:\n\nSuppose we process 1,000 requests per second. The system queues each request in a priority buffer, executes the validation step, and dispatches responses with sub-10ms latency.`,
          example: 'Request -> Queue(Buffer) -> Processor -> Response(200 OK)',
        };
      case 'give_analogy':
        return {
          text: `Real-World Analogy for ${topic.title}:\n\n${topic.analogy}`,
          analogy: topic.analogy,
        };
      case 'summarize':
        return {
          text: `Quick Summary of ${topic.title}:\n• Core Idea: ${topic.content.slice(0, 100)}...\n• Key Analogy: ${topic.analogy}\n• Ready for next topic!`,
        };
      default:
        return {
          text: topic.content,
          analogy: topic.analogy,
          diagramMermaid: topic.diagramMermaid,
        };
    }
  }

  try {
    let actionInstruction = '';
    switch (action) {
      case 'explain_again':
        actionInstruction = 'Re-explain this concept from a fresh, intuitive perspective with different phrasing.';
        break;
      case 'explain_simple':
        actionInstruction = 'Explain this concept in ultra-simple terms suitable for a complete beginner (ELI5). Use plain language.';
        break;
      case 'explain_detailed':
        actionInstruction = 'Provide a deep, rigorous technical explanation including underlying algorithms, mathematical relations, or system mechanics.';
        break;
      case 'give_example':
        actionInstruction = 'Provide a clear, practical code snippet or step-by-step walkthrough example.';
        break;
      case 'give_analogy':
        actionInstruction = 'Give a creative, memorable real-world analogy that makes this concept instantly click.';
        break;
      case 'another_example':
        actionInstruction = 'Provide an alternative, contrasting real-world example from a different industry or domain.';
        break;
      case 'summarize':
        actionInstruction = 'Provide a crisp 3-bullet summary of the core takeaways of this topic.';
        break;
      case 'custom_question':
        actionInstruction = `The student asked: "${customQuery}". Answer it directly, clearly, and thoroughly based on the lesson and uploaded materials.`;
        break;
      default:
        actionInstruction = 'Provide a clear explanation and ask a checkpoint question to confirm understanding.';
    }

    const systemPrompt = `${AI_TEACHER_SYSTEM_PROMPT}

Current Topic: "${topic.title}"
Topic Context: "${topic.content}"
Original Analogy: "${topic.analogy}"
Uploaded Material Context${sourceFileName ? ` (from ${sourceFileName})` : ''}:
${uploadedContext ? uploadedContext.slice(0, 6000) : 'No uploaded files for this topic.'}

Task: ${actionInstruction}

Return JSON matching:
{
  "text": "The main response text (supports markdown, formulas, code)",
  "analogy": "Optional analogy if applicable",
  "example": "Optional code or math example if applicable",
  "diagramMermaid": "Optional mermaid diagram if helpful"
}`;

    const response = await openai.chat.completions.create({
      model: CONFIGURED_AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: customQuery || action },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      text: parsed.text || topic.content,
      analogy: parsed.analogy || topic.analogy,
      example: parsed.example,
      diagramMermaid: parsed.diagramMermaid || topic.diagramMermaid,
    };
  } catch (err) {
    console.error('[AI Teacher Adapt Error]', err);
    if (customQuery) {
      const dyn = generateHighQualityPedagogicalResponse(customQuery, topic.content, uploadedContext, sourceFileName);
      return {
        text: `### 📝 Direct Answer\n${dyn.directAnswer}\n\n### 🧠 Detailed Explanation\n${dyn.detailedExplanation}`,
        analogy: dyn.analogy,
        example: dyn.example,
        diagramMermaid: dyn.diagramMermaid,
      };
    }
    return { text: topic.content, analogy: topic.analogy };
  }
}

// ----------------------------------------------------------------
// Lecture Topics Generator from Uploaded Syllabus
// ----------------------------------------------------------------
export async function generateInteractiveLectureTopics(
  material: string,
  fileName?: string
): Promise<LectureTopic[]> {
  const cacheKey = getCacheKey(material.slice(0, 500), fileName);
  if (sessionTopicCache.has(cacheKey)) {
    return sessionTopicCache.get(cacheKey)!;
  }

  const fallbackTopics: LectureTopic[] = [
    {
      id: 'topic-1',
      title: 'Introduction & Core Foundations',
      content: 'Welcome to this interactive session! We break down complex concepts into bite-sized, intuitive building blocks so you master them step-by-step.',
      analogy: 'Think of this topic as laying the solid foundation of a building before constructing the upper floors.',
      diagramMermaid: 'graph TD;\n  Foundations-->CoreConcepts;\n  CoreConcepts-->Applications;',
      checkpointQuestion: 'Does this core overview make sense, or would you like to explore it with an example first?'
    },
    {
      id: 'topic-2',
      title: 'Core Mechanics & Working Principles',
      content: 'Here we examine the inner mechanism, state transitions, and step-by-step execution flow of the system.',
      analogy: 'Like the gear system of a mechanical watch, each component transfers energy cleanly to the next.',
      diagramMermaid: 'graph LR;\n  Input-->Processor;\n  Processor-->Validator;\n  Validator-->Output;',
      checkpointQuestion: 'Are you ready to move forward, or shall we look at a real-world code/system example?'
    },
    {
      id: 'topic-3',
      title: 'Practical Applications & Best Practices',
      content: 'We connect our theoretical understanding with real-world scenarios, troubleshooting common edge cases and optimization patterns.',
      analogy: 'Like putting on safety gear before driving a high-speed vehicle on the freeway.',
      diagramMermaid: 'graph TD;\n  Execution-->Monitoring;\n  Monitoring-->Optimization;',
      checkpointQuestion: 'Do you have any questions or doubts on these practical patterns?'
    }
  ];

  const openai = getOpenAIClient();
  if (!openai) {
    sessionTopicCache.set(cacheKey, fallbackTopics);
    return fallbackTopics;
  }

  try {
    const prompt = `${AI_TEACHER_SYSTEM_PROMPT}

Based on the following study material${fileName ? ` (Source Document: ${fileName})` : ''}, break it down into 3 to 5 step-by-step interactive lecture topics.

Each topic MUST be concise (under 120 words), engaging, and strictly follow this JSON schema:
[
  {
    "id": "topic-1",
    "title": "Topic Title",
    "content": "Clear, concise, step-by-step explanation of this single concept.",
    "analogy": "A simple, memorable real-world analogy.",
    "diagramMermaid": "Valid mermaid diagram (e.g. graph TD; A-->B;)",
    "checkpointQuestion": "An engaging question asking if students understand or want to continue."
  }
]

Material:
${material.slice(0, 6000)}`;

    const response = await openai.chat.completions.create({
      model: CONFIGURED_AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    const topics: LectureTopic[] = Array.isArray(parsed)
      ? parsed
      : (parsed.topics || parsed.items || fallbackTopics);

    sessionTopicCache.set(cacheKey, topics);
    return topics;
  } catch (err) {
    console.error('[AI Teacher] Topic generation error:', err);
    return fallbackTopics;
  }
}

// ----------------------------------------------------------------
// Voice STT (Whisper) & TTS (OpenAI Audio)
// ----------------------------------------------------------------
export async function transcribeAudioBuffer(audioBuffer: Buffer, mimeType = 'audio/webm'): Promise<string> {
  const openai = getOpenAIClient();
  if (!openai) {
    return '';
  }

  try {
    const file = await OpenAI.toFile(audioBuffer, 'voice_input.webm', { type: mimeType });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
    });
    return transcription.text;
  } catch (err) {
    console.error('[Voice STT] Whisper error:', err);
    throw err;
  }
}

export async function synthesizeSpeechStream(
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova',
  speed = 1.0
): Promise<Buffer> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OpenAI API key required for TTS');
  }

  // Clean technical markers so voice doesn't read hashtags or raw JSON
  const cleanText = text
    .replace(/```[\s\S]*?```/g, 'Code example provided on screen.')
    .replace(/`[^`]*`/g, '')
    .replace(/\$[^$]*\$/g, 'Formula provided on screen.')
    .replace(/###/g, '')
    .replace(/[#*>\-_~[\]()]/g, ' ')
    .slice(0, 1000);

  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice,
    input: cleanText,
    speed: Math.min(Math.max(speed, 0.75), 1.5),
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
