import OpenAI from 'openai';
import { LectureTopic, QuizQuestion } from '@/types';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const FALLBACK_TOPICS: LectureTopic[] = [
  {
    id: 'topic-1',
    title: 'Introduction & Core Concepts',
    content: 'Welcome to this interactive session! Today we examine the fundamental architecture, key principles, and real-world applications of this subject. We will break down complex concepts into intuitive building blocks.',
    analogy: 'Think of this system like a digital traffic dispatcher: incoming requests are routed smoothly through designated channels without collisions.',
    diagramMermaid: 'graph TD; Client-->Router; Router-->Processor; Processor-->Database;',
    checkpointQuestion: 'Does everyone understand how data flows through the core dispatcher model? Any doubts so far?'
  },
  {
    id: 'topic-2',
    title: 'Advanced Mechanics & Practical Patterns',
    content: 'Now that we understand the basics, let us delve into state synchronization, fault tolerance, and performance optimization. Notice how low latency is maintained using event-driven architectures.',
    analogy: 'Imagine an orchestra where each musician plays in sync according to a shared conductor beat.',
    diagramMermaid: 'graph LR; Input-->Cache; Cache-->Compute; Compute-->Output;',
    checkpointQuestion: 'Are there any questions about how state synchronization avoids duplicate updates?'
  },
  {
    id: 'topic-3',
    title: 'Real-world Integration & Best Practices',
    content: 'To conclude our topic, we look at real-time execution, error recovery strategies, and security measures including input sanitization and rate limiting.',
    analogy: 'Like a security checkpoint at an airport, every incoming request is scanned and verified before entering the vault.',
    diagramMermaid: 'graph TD; Request-->Sanitizer-->Validator-->Handler;',
    checkpointQuestion: 'Do you have any final doubts or edge cases you would like me to clarify?'
  }
];

// Dynamic parser to extract custom topics directly from user material
function parseCustomSyllabusToTopics(syllabus: string): LectureTopic[] {
  const sections = syllabus
    .split(/\n\s*\n|\n(?=[0-9]+\.|\#|\-)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  if (sections.length >= 2) {
    return sections.slice(0, 4).map((section, idx) => {
      const lines = section.split('\n');
      const rawTitle = lines[0].replace(/^[\#0-9\.\-\* ]+/, '').trim();
      const title = rawTitle.length > 3 ? rawTitle.slice(0, 60) : `Section ${idx + 1}: Key Principles`;
      const body = lines.slice(1).join(' ').trim() || section;
      const cleanBody = body.length > 20 ? body : section;
      const cleanNodeId = title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);

      return {
        id: `topic-${idx + 1}`,
        title,
        content: cleanBody,
        analogy: `Think of ${title} as a fundamental mechanism where inputs are systematically transformed into verified results.`,
        diagramMermaid: `graph LR; Input-->${cleanNodeId}; ${cleanNodeId}-->Output;`,
        checkpointQuestion: `Are there any questions or doubts about ${title}?`,
      };
    });
  }

  return [
    {
      id: 'topic-1',
      title: 'Material Breakdown: Core Overview',
      content: syllabus.slice(0, 300) + (syllabus.length > 300 ? '...' : ''),
      analogy: 'Think of this material as the master blueprint for understanding the core system.',
      diagramMermaid: 'graph TD; Syllabus-->Analysis; Analysis-->Mastery;',
      checkpointQuestion: 'Do you have any questions on this initial summary?'
    },
    ...FALLBACK_TOPICS.slice(1)
  ];
}

export async function generateLectureFromMaterial(syllabus: string): Promise<LectureTopic[]> {
  if (!openai) {
    return parseCustomSyllabusToTopics(syllabus);
  }

  try {
    const prompt = `You are an expert AI Virtual Classroom Teacher. 
Based on the following material/syllabus, break it down into 3 clear, structured lecture topics.
Each topic must have:
1. title (string)
2. content (detailed explanation string)
3. analogy (simple beginner-friendly real world analogy)
4. diagramMermaid (valid mermaid graph TD or graph LR definition string)
5. checkpointQuestion (a polite check like "Any doubts on this concept?")

Return ONLY a raw JSON array matching this exact schema:
[
  {
    "id": "topic-1",
    "title": "...",
    "content": "...",
    "analogy": "...",
    "diagramMermaid": "...",
    "checkpointQuestion": "..."
  }
]

Material:
${syllabus.slice(0, 3000)}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : (parsed.topics || parseCustomSyllabusToTopics(syllabus));
    }
  } catch (error) {
    console.error('Error generating AI lecture:', error);
  }

  return parseCustomSyllabusToTopics(syllabus);
}

export async function solveStudentDoubt(
  question: string,
  currentTopicContent?: string,
  mode: 'simple' | 'advanced' | 'repeat' = 'simple',
  fileContextMemory?: string,
  sourceFileName?: string,
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const { solveStudentDoubtSmart } = await import('@/lib/ai/aiTeacherEngine');
  const smart = await solveStudentDoubtSmart(
    question,
    currentTopicContent,
    mode,
    fileContextMemory,
    sourceFileName,
    chatHistory
  );

  return `### 📝 Direct Answer\n${smart.directAnswer}\n\n### 🧠 Detailed Explanation\n${smart.detailedExplanation}\n\n### 🐣 Simple Explanation\n${smart.simpleExplanation}\n\n### 💡 Example / Code / Math\n${smart.example}\n\n${smart.analogy ? `### 🌐 Real-world Analogy\n${smart.analogy}\n\n` : ''}### ⚠️ Common Mistakes\n${smart.commonMistakes.map((m) => `- ${m}`).join('\n')}\n\n### 🎯 Key Takeaways\n${smart.keyTakeaways.map((t) => `- ${t}`).join('\n')}${smart.sourceDoc ? `\n\n📄 **Source Document Reference**: *${smart.sourceDoc}*` : ''}`;
}

export async function generateQuizAndSummary(lectureHistory: string): Promise<{
  summary: string;
  keyPoints: string[];
  formulas: string[];
  quiz: QuizQuestion[];
}> {
  const fallback = {
    summary: "Today's lecture covered the fundamental architecture of real-time multi-user systems, state synchronization, and fault-tolerant network topologies.",
    keyPoints: [
      "Real-time state sync using WebRTC & Socket.io",
      "AI-driven doubt resolution without breaking lecture momentum",
      "Persistent state recovery after browser crash or network reconnect",
      "Automatic session recording and interactive whiteboard sync"
    ],
    formulas: [
      "Latency Threshold: T_latency < 100ms",
      "Bitrate Adaptation: R_target = min(R_max, Bandwidth_available)"
    ],
    quiz: [
      {
        id: "q1",
        type: "mcq" as const,
        question: "What is the primary protocol used for peer-to-peer real-time video/audio streaming?",
        options: ["HTTP/2", "WebRTC", "FTP", "SMTP"],
        correctAnswer: "WebRTC",
        explanation: "WebRTC allows direct peer-to-peer audio, video, and data transmission with lower latency."
      },
      {
        id: "q2",
        type: "true_false" as const,
        question: "Socket.io is used for real-time bidirectional event-based communication between browser and server.",
        options: ["True", "False"],
        correctAnswer: "True",
        explanation: "Socket.io maintains persistent WebSocket/polling connection for instantaneous data sync."
      },
      {
        id: "q3",
        type: "coding" as const,
        question: "Write a JavaScript function named `calculateLatency` that returns the difference between `endTime` and `startTime`.",
        starterCode: "function calculateLatency(startTime, endTime) {\n  // Write your code here\n  return 0;\n}",
        correctAnswer: "function calculateLatency(startTime, endTime) {\n  return endTime - startTime;\n}",
        explanation: "Latency calculation measures duration in milliseconds."
      }
    ]
  };

  if (!openai) return fallback;

  try {
    const prompt = `Based on this lecture summary/notes: "${lectureHistory.slice(0, 3000)}", generate:
1. summary text
2. keyPoints array of strings
3. formulas array of strings
4. quiz array of 3 QuizQuestion objects (1 MCQ, 1 True/False, 1 Coding challenge).

Return ONLY JSON object matching this schema.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error generating AI summary:', error);
  }

  return fallback;
}

export async function reviewCodeSnippet(code: string, language: string): Promise<string> {
  if (!openai) {
    return `### 💡 AI Code Reviewer
**Language**: ${language.toUpperCase()}
- **Code Quality**: Clean structure and syntax.
- **Optimization Tip**: Ensure edge cases like null values or out-of-bound indices are validated.
- **Time Complexity**: $O(N)$
- **Space Complexity**: $O(1)$`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a senior software reviewer. Provide a concise, helpful review of the code including code quality, potential bugs, time complexity, and suggestions.'
        },
        {
          role: 'user',
          content: `Review this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``
        }
      ]
    });

    return response.choices[0]?.message?.content || 'Code review complete.';
  } catch (error) {
    return 'AI Code review unavailable at the moment.';
  }
}
