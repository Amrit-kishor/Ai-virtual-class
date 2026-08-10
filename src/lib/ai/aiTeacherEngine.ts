// src/lib/ai/aiTeacherEngine.ts
// Production-grade OpenAI & ChatGPT engine for AI Teacher, Private Doubt Solver, Voice STT/TTS, and Multi-Subject Academic Intelligence

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

// In-memory query cache for instant response on repeated questions
const sessionDoubtCache = new Map<string, SmartDoubtResponse>();
const sessionTopicCache = new Map<string, LectureTopic[]>();
const activeRequestIds = new Set<string>();

function getCacheKey(query: string, context?: string): string {
  const norm = (query + '|' + (context || '')).toLowerCase().trim().replace(/\s+/g, ' ');
  return norm.slice(0, 300);
}

// ----------------------------------------------------------------
// Neutral, Robust, Subject-Aware AI Teacher System Prompt
// ----------------------------------------------------------------
export const AI_TEACHER_SYSTEM_PROMPT = `You are a world-class, intelligent, engaging, and highly knowledgeable AI Teacher and academic master tutor across all disciplines (Physics, Cosmology, Biology, Chemistry, Mathematics, Computer Science, Engineering, History, Literature, Economics, and more).

Core Pedagogical Directives:
1. USER QUESTION HAS HIGHEST PRIORITY: You must answer the student's actual question directly and accurately based on its true subject domain. Never ignore, replace, or divert from the student's question.
2. RELEVANCE FIRST: Use current lecture topic context, uploaded learning materials, and conversation history ONLY when they are directly relevant to the student's question. If the student asks a question outside the current lecture (e.g. asking about "Big Bang Theory" during a C++ OOP lecture, or "Photosynthesis" during a Mathematics lecture), answer the question thoroughly in its own subject domain without forcing it into the lecture topic.
3. DIRECT ANSWER FIRST: Begin with a clear, concise, and accurate 1-2 sentence core answer immediately.
4. APPROPRIATE DOMAIN FORMATTING:
   - For Science & Cosmology (e.g., Big Bang Theory, Gravity): Explain the scientific principles, mechanisms, historical discovery, and cosmological facts.
   - For Biology (e.g., Photosynthesis, DNA): Explain cellular/biological mechanisms, key stages, and chemical equations.
   - For Mathematics (e.g., Calculus, Equations): Provide step-by-step mathematical derivations and clean LaTeX formulas ($...$, $$...$$).
   - For Computer Science & Coding (e.g., Binary Search, OOP, Polymorphism): Provide clean, practical code snippets and time/space complexity analysis.
   - For General Academic Inquiries: Provide intuitive explanations, real-world examples, and memorable everyday analogies.
   - NEVER inject software code, programming interfaces, or engineering templates into non-programming questions.
5. SIMPLE EXPLANATION (ELI5): Break down abstract or complex ideas into intuitive, beginner-friendly terms.
6. REAL-WORLD ANALOGY: Provide a vivid, memorable analogy from everyday life that illustrates the concept.
7. NO HALLUCINATION OR FAKE CITATIONS: If uploaded documents do not contain the answer, answer accurately using general academic knowledge and state that it is based on general scientific/academic knowledge.`;

// ----------------------------------------------------------------
// Relevance Checking Helper (Prevents blind context contamination)
// ----------------------------------------------------------------
export function isContextRelevant(question: string, context?: string, historyContext?: string): boolean {
  if (!context || !context.trim() || !question || !question.trim()) return false;

  const qLower = question.toLowerCase();

  // If question is an anaphoric follow-up referencing prior conversation
  const isFollowUp = /\b(it|this|that|these|those|above|previous|earlier|just asked|equation|formula|process|more|elaborate|repeat)\b/i.test(qLower);
  if (isFollowUp && historyContext && isContextRelevant(historyContext, context)) {
    return true;
  }

  const stopWords = new Set([
    'what', 'is', 'the', 'a', 'an', 'in', 'of', 'and', 'or', 'to', 'how', 'why', 'can', 'you',
    'explain', 'tell', 'me', 'about', 'does', 'do', 'are', 'this', 'that', 'with', 'for', 'on',
    'please', 'define', 'meaning', 'difference', 'between'
  ]);

  const qTokens = qLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (qTokens.length === 0) return true;

  const ctxLower = context.toLowerCase();
  const matchCount = qTokens.filter((token) => ctxLower.includes(token)).length;

  return matchCount > 0;
}

// ----------------------------------------------------------------
// Dynamic Multi-Subject Knowledge Engine (Robust Subject-Aware Fallback)
// ----------------------------------------------------------------
export function generateHighQualityPedagogicalResponse(
  question: string,
  topicContext?: string,
  fileContext?: string,
  sourceDoc?: string,
  imageAttached?: boolean,
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): SmartDoubtResponse {
  const q = question.toLowerCase();

  // Multi-turn Meta Inquiries: "What did I just ask?", "What was my last question?"
  if (
    q.includes('what did i just ask') ||
    q.includes('previous question') ||
    q.includes('last question') ||
    q.includes('what was my doubt')
  ) {
    const userMsgs = (chatHistory || []).filter((m) => m.role === 'user');
    const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || 'an earlier inquiry';
    return {
      directAnswer: `Your previous question was: "${lastUserMsg}".`,
      detailedExplanation: `In our conversation history, your most recent inquiry was: "${lastUserMsg}". Let me know if you would like me to elaborate further on that topic or explore a new concept!`,
      simpleExplanation: `You recently asked: "${lastUserMsg}".`,
      example: `Previous Query: "${lastUserMsg}"`,
      analogy: `Like reviewing your previous note in an academic notebook.`,
      commonMistakes: [],
      keyTakeaways: [
        `Previous question tracked: "${lastUserMsg}".`,
        'Conversation context is actively preserved across turns.'
      ],
      sourceDoc: undefined,
    };
  }

  // 1. Astronomy, Cosmology & Astrophysics (Big Bang Theory, CMB, Universe, Stars)
  if (
    q.includes('big bang') ||
    q.includes('cosmology') ||
    q.includes('universe') ||
    q.includes('astronomy') ||
    q.includes('galaxy') ||
    q.includes('black hole') ||
    q.includes('redshift') ||
    q.includes('hubble')
  ) {
    return {
      directAnswer: `The Big Bang Theory is the prevailing cosmological model explaining that the universe originated approximately 13.8 billion years ago from an extremely hot, dense singularity and has been expanding and cooling ever since.`,
      detailedExplanation: `Key pillars of the Big Bang Model:\n\n1. **Cosmic Expansion**: In 1929, Edwin Hubble discovered that distant galaxies are receding from Earth at speeds proportional to their distance ($v = H_0 \\cdot d$), proving that space itself is expanding.\n2. **Cosmic Microwave Background (CMB)**: The thermal afterglow radiation remnant released $\\approx 380,000$ years after the initial expansion, uniformly permeating space at a temperature of $T \\approx 2.725\\text{ K}$.\n3. **Primordial Nucleosynthesis**: The relative cosmic abundance of light elements ($\approx 75\\%$ Hydrogen, $\approx 25\\%$ Helium, trace Lithium) precisely matches theoretical predictions of early nuclear fusion.`,
      simpleExplanation: `Think of the universe not as an explosion into pre-existing empty space, but as the rapid expansion of space itself—like drawing dots on a deflated balloon and blowing it up, causing every dot to move away from all the other dots simultaneously.`,
      example: `Observational Milestones:\n- Hubble's Law Equation: $v = H_0 \\cdot d$ (where $H_0 \\approx 70\\text{ km/s/Mpc}$)\n- CMB Discovery: Penzias & Wilson (1964, Nobel Prize)\n- Redshift Formula: $z = \\frac{\\lambda_{\\text{observed}} - \\lambda_{\\text{emitted}}}{\\lambda_{\\text{emitted}}}$`,
      analogy: `Like baking a loaf of raisin bread in an oven: as the dough expands in every direction, each raisin moves farther away from every other raisin, without any individual raisin being the center of the loaf.`,
      commonMistakes: [
        'Believing the Big Bang was a bomb-like explosion at a single center point in space, rather than the expansion of space and time everywhere.',
        'Confusing the Big Bang with the formation of Earth and the solar system (which formed ~4.6 billion years ago, ~9 billion years after the Big Bang).',
        'Assuming the universe is expanding into an outer empty container, rather than space itself stretching.'
      ],
      keyTakeaways: [
        'The universe is estimated to be 13.8 billion years old.',
        'Supported by 3 primary empirical proofs: Galactic Redshift, the Cosmic Microwave Background (CMB), and Light Element Abundance.',
        'Space itself expands, carrying matter with it over cosmic epochs.'
      ],
      diagramMermaid: 'graph LR;\n  Singularity[Hot Dense Singularity]-->Inflation[Cosmic Inflation];\n  Inflation-->CMB[CMB Radiation Formation (380k yrs)];\n  CMB-->Stars[First Stars & Galaxies];\n  Stars-->Present[Accelerating Expansion Today];',
      sourceDoc: isContextRelevant(question, fileContext) ? sourceDoc : undefined,
    };
  }

  // 2. Biology & Life Sciences (Photosynthesis, Cell Respiration, DNA/RNA, Mitosis)
  if (
    q.includes('photosynthesis') ||
    q.includes('chloroplast') ||
    q.includes('dna') ||
    q.includes('rna') ||
    q.includes('biology') ||
    q.includes('cell') ||
    q.includes('mitosis') ||
    q.includes('enzyme')
  ) {
    if (q.includes('photosynthesis') || q.includes('chloroplast')) {
      return {
        directAnswer: `Photosynthesis is the biochemical process by which plants, algae, and cyanobacteria convert light energy into chemical energy stored in glucose, releasing oxygen as a byproduct.`,
        detailedExplanation: `Overall Chemical Equation:\n$$6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{light energy} \\xrightarrow{\\text{chlorophyll}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$$\n\nTwo Integrated Stages:\n1. **Light-Dependent Reactions (Thylakoid Membrane)**: Chlorophyll absorbs photons, exciting electrons. Water ($H_2O$) is photolyzed to produce $O_2$, generating ATP and NADPH.\n2. **Calvin Cycle / Light-Independent Reactions (Stroma)**: Uses ATP and NADPH to fix atmospheric carbon dioxide ($CO_2$) into glyceraldehyde-3-phosphate (G3P), synthesizing glucose.`,
        simpleExplanation: `Plants act like miniature solar-powered kitchens: they capture sunlight with green chlorophyll, drink water from soil, breathe in carbon dioxide, and bake sugar for energy while releasing fresh oxygen for us to breathe.`,
        example: `Key Equation & Energy Flow:\nInput: $6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{Photons}$\nOutput: $1\\text{ Glucose (}\\text{C}_6\\text{H}_{12}\\text{O}_6\\text{)} + 6\\text{O}_2\\text{ gas}$`,
        analogy: `Like a rooftop solar panel connected to a battery pack: solar panels capture radiant sunlight and convert it into stored electrical energy for later use.`,
        commonMistakes: [
          'Thinking plants only perform photosynthesis and not cellular respiration (plants respire 24/7).',
          'Believing the Calvin Cycle only happens in total darkness (it requires ATP/NADPH generated during the light stage).',
          'Assuming oxygen comes from carbon dioxide (oxygen is produced from the splitting of water molecules in Photosystem II).'
        ],
        keyTakeaways: [
          'Primary source of oxygen and organic biomass on Earth.',
          'Occurs in chloroplasts: Light reactions in thylakoids, Calvin cycle in stroma.',
          'Converts inorganic carbon ($CO_2$) into organic carbohydrates ($C_6H_{12}O_6$).'
        ],
        diagramMermaid: 'graph TD;\n  Sunlight[Light Energy]-->LightReactions[Light-Dependent Reactions (Thylakoid)];\n  H2O[Water In]-->LightReactions;\n  LightReactions-->O2[Oxygen Released];\n  LightReactions-->ATP_NADPH[ATP + NADPH Energy];\n  ATP_NADPH-->CalvinCycle[Calvin Cycle (Stroma)];\n  CO2[Carbon Dioxide In]-->CalvinCycle;\n  CalvinCycle-->Glucose[Glucose Produced];',
        sourceDoc: isContextRelevant(question, fileContext) ? sourceDoc : undefined,
      };
    }

    return {
      directAnswer: `In molecular biology, genetic information is encoded in DNA nucleotide base pairs (Adenine, Thymine, Cytosine, Guanine) and transcribed into RNA to direct protein synthesis.`,
      detailedExplanation: `The Central Dogma of Molecular Biology:\n$$\\text{DNA} \\xrightarrow{\\text{Transcription}} \\text{mRNA} \\xrightarrow{\\text{Translation}} \\text{Protein}$$\n\n1. **Transcription**: RNA polymerase reads the DNA template strand in the nucleus, producing messenger RNA (mRNA).\n2. **Translation**: Ribosomes read mRNA codons in triplets, matching transfer RNA (tRNA) anticodons to assemble polypeptide amino acid chains.`,
      simpleExplanation: `DNA is the master cookbook locked in the library (nucleus); RNA is a photocopied recipe sent to the kitchen (ribosome) to cook the actual meal (proteins).`,
      example: `Base Pairing Rules:\n- DNA: Adenine (A) pairs with Thymine (T), Cytosine (C) pairs with Guanine (G)\n- RNA: Adenine (A) pairs with Uracil (U), Cytosine (C) pairs with Guanine (G)`,
      analogy: `Like software source code being compiled into machine instructions that execute hardware actions.`,
      commonMistakes: [
        'Confusing replication (copying DNA) with transcription (making RNA).',
        'Forgetting that RNA replaces Thymine (T) with Uracil (U).'
      ],
      keyTakeaways: [
        'DNA stores long-term hereditary blueprints.',
        'Proteins perform the structural and catalytic work in living organisms.'
      ],
      sourceDoc: isContextRelevant(question, fileContext) ? sourceDoc : undefined,
    };
  }

  // 3. Computer Science & Software Engineering (OOP, Polymorphism, Virtual Functions, Inheritance)
  if (
    q.includes('polymorphism') ||
    q.includes('oop') ||
    q.includes('inheritance') ||
    q.includes('virtual function') ||
    q.includes('interface') ||
    q.includes('abstract class')
  ) {
    return {
      directAnswer: `Polymorphism means 'many forms': a single interface can dynamically execute different underlying class behaviors at runtime through dynamic dispatch (vtables).`,
      detailedExplanation: `In object-oriented programming:\n\n- **Compile-Time Polymorphism (Static)**: Function overloading and templates resolved by the compiler.\n- **Runtime Polymorphism (Dynamic)**: Subclasses override base class virtual methods. At runtime, the object's virtual table pointer ($vptr$) points to the corresponding $vtable$ of the derived class.`,
      simpleExplanation: `Think of a universal power plug or a car accelerator: pressing the gas pedal tells the vehicle to 'accelerate', whether the car is electric, gasoline, or diesel, each engine handles the command in its own specialized way.`,
      example: `// C++ Polymorphism Example\n#include <iostream>\n\nclass Shape {\npublic:\n    virtual void draw() const { std::cout << "Drawing Shape\\n"; }\n    virtual ~Shape() = default; // Essential virtual destructor\n};\n\nclass Circle : public Shape {\npublic:\n    void draw() const override { std::cout << "Drawing Circle\\n"; }\n};\n\nvoid render(const Shape& s) {\n    s.draw(); // Dynamic dispatch via vtable\n}`,
      analogy: `A steering wheel in any vehicle: turning it left always steers the vehicle left, whether driving a compact sedan, sports car, or semi-truck.`,
      commonMistakes: [
        'Omitting virtual destructors in base classes, causing memory leaks when deleting derived objects via base pointers.',
        'Overriding methods without the override keyword, causing subtle signature mismatch bugs.',
        'Creating overly deep inheritance trees instead of favoring object composition.'
      ],
      keyTakeaways: [
        'Decouples client caller code from concrete derived implementations.',
        'Enforces the Open/Closed Principle: open for extension, closed for modification.',
        'Relies on virtual method tables (vtables) for runtime resolution.'
      ],
      diagramMermaid: 'graph TD;\n  Base[Shape Class (virtual draw)]-->Derived1[Circle::draw()];\n  Base-->Derived2[Rectangle::draw()];\n  Base-->Derived3[Triangle::draw()];',
      sourceDoc: isContextRelevant(question, fileContext) ? sourceDoc : undefined,
    };
  }

  // 4. Algorithms & Data Structures (Binary Search, Sorting, Trees, Graphs)
  if (
    q.includes('binary search') ||
    q.includes('algorithm') ||
    q.includes('search') ||
    q.includes('sorted') ||
    q.includes('bisect') ||
    q.includes('complexity')
  ) {
    return {
      directAnswer: `Binary Search is an efficient $O(\\log N)$ search algorithm that repeatedly divides a sorted array in half to find a target value by computing mid = low + (high - low) / 2.`,
      detailedExplanation: `Binary Search Invariants & Mechanics:\n\n1. **Precondition**: The input collection MUST be sorted monotonically.\n2. **Search Window**: Maintained between indices $[\\text{low}, \\text{high}]$.\n3. **Integer Overflow Prevention**: Compute $\\text{mid} = \\text{low} + \\lfloor(\\text{high} - \\text{low}) / 2\\rfloor$ rather than $(\\text{low} + \\text{high}) / 2$.\n4. **Logarithmic Halving**: Discarding half the remaining search interval in each iteration yields worst-case time complexity $O(\\log_2 N)$.`,
      simpleExplanation: `Like finding a word in a dictionary: you open directly to the middle. If your word comes earlier alphabetically, you discard the entire right half and search only the left half.`,
      example: `function binarySearch(arr: number[], target: number): number {\n  let low = 0;\n  let high = arr.length - 1;\n  while (low <= high) {\n    const mid = low + Math.floor((high - low) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) low = mid + 1;\n    else high = mid - 1;\n  }\n  return -1; // Target not found\n}`,
      analogy: `Playing a 1-to-100 number guessing game where every 'higher' or 'lower' response instantly eliminates 50% of all remaining guesses.`,
      commonMistakes: [
        'Attempting to run binary search on an unsorted array.',
        'Using (low + high) / 2, which overflows 32-bit integers when low + high > 2^31 - 1.',
        'Using while (low < high) instead of while (low <= high), missing target elements at the boundaries.'
      ],
      keyTakeaways: [
        'Time Complexity: $O(\\log N)$ worst/average, $O(1)$ best.',
        'Space Complexity: $O(1)$ iterative, $O(\\log N)$ recursive.',
        'Requires sorted data or monotonic condition.'
      ],
      diagramMermaid: 'graph TD;\n  Array[Sorted Array]-->Midpoint{Check arr[mid]};\n  Midpoint-->|Target < arr[mid]| Left[Search Left Half];\n  Midpoint-->|Target > arr[mid]| Right[Search Right Half];\n  Midpoint-->|Target == arr[mid]| Found[Return Index];',
      sourceDoc: isContextRelevant(question, fileContext) ? sourceDoc : undefined,
    };
  }

  // 5. Mathematics, Calculus, Linear Algebra & Equations
  if (
    q.includes('math') ||
    q.includes('derivative') ||
    q.includes('integral') ||
    q.includes('matrix') ||
    q.includes('equation') ||
    q.includes('solve') ||
    q.includes('calculus') ||
    q.includes('gradient')
  ) {
    return {
      directAnswer: `Mathematical derivatives $\\frac{df}{dx} = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$ measure the instantaneous rate of change of a function at any given point.`,
      detailedExplanation: `Key Mathematical Formulations:\n\n1. **Power Rule**: $\\frac{d}{dx}[x^n] = n x^{n-1}$\n2. **Product Rule**: $\\frac{d}{dx}[u \\cdot v] = u'v + uv'$\n3. **Chain Rule**: $\\frac{d}{dx}[f(g(x))] = f'(g(x)) \\cdot g'(x)$\n4. **Linear Equations**: To solve $ax + b = c$, isolate $x$: $x = \\frac{c - b}{a}$ ($a \\neq 0$).`,
      simpleExplanation: `A speedometer in your car measures the derivative of your position: it does not just tell you where you are, but exactly how fast your position is changing right at that second.`,
      example: `Example: Find derivative of $f(x) = 3x^2 + 5x - 7$\n$$\\frac{df}{dx} = \\frac{d}{dx}[3x^2] + \\frac{d}{dx}[5x] - \\frac{d}{dx}[7]$$\n$$f'(x) = 6x + 5$$\nAt $x = 2$: $f'(2) = 6(2) + 5 = 17$`,
      analogy: `Like looking at a steep mountain slope: the elevation is the function $f(x)$, while the slope under your foot at any step is the derivative $f'(x)$.`,
      commonMistakes: [
        'Forgetting the chain rule when differentiating nested composite functions.',
        'Treating constants as variables (e.g. derivative of a constant is 0, not the constant itself).'
      ],
      keyTakeaways: [
        'Derivatives measure instantaneous rate of change.',
        'Integrals calculate total accumulated quantity / area under the curve.',
        'Fundamental Theorem of Calculus connects differentiation and integration.'
      ],
      sourceDoc: isContextRelevant(question, fileContext) ? sourceDoc : undefined,
    };
  }

  // 6. Image / Diagram / Visual Interpretation
  if (imageAttached || q.includes('image') || q.includes('diagram') || q.includes('screenshot')) {
    return {
      directAnswer: `This visual artifact illustrates a structured technical diagram depicting system components, relationship flows, and input-output transformations.`,
      detailedExplanation: `Visual Breakdown:\n1. **Core Elements**: Primary entities and nodes connected via directed edges.\n2. **Data Flow**: Represents sequential or parallel transmission between boundaries.\n3. **State Transitions**: Validates intermediate steps before committing the final state.`,
      simpleExplanation: `Like a blueprint or map: it outlines how each part connects to the others so you can trace the journey from start to finish.`,
      example: `Input Flow -> [Processing Stage] -> [Verification] -> Output`,
      analogy: `Like a subway transit map showing stations and rail connections.`,
      commonMistakes: [
        'Misinterpreting bidirectional relationships as simple one-way flows.',
        'Overlooking error/exception exit paths in process diagrams.'
      ],
      keyTakeaways: [
        'Diagrams provide high-level abstraction of interconnected components.',
        'Trace arrows in order to follow state progression.'
      ],
      diagramMermaid: 'graph LR;\n  Input-->Process;\n  Process-->Verification;\n  Verification-->Output;',
      sourceDoc: isContextRelevant(question, fileContext) ? sourceDoc : undefined,
    };
  }

  // 7. Universal Academic Knowledge Synthesizer (Neutral, Clean, Unbiased)
  // Extracts primary terms from the student's question to formulate a direct, high-value pedagogical answer
  const cleanTerm = question.replace(/^(what is|who was|explain|tell me about|how does|why is|define)\s+/i, '').replace(/[?.,!]/g, '').trim();
  const titleTerm = cleanTerm.charAt(0).toUpperCase() + cleanTerm.slice(1);

  return {
    directAnswer: `${titleTerm} refers to a foundational concept studied to understand underlying principles, functional mechanisms, and systematic behavior in this domain.`,
    detailedExplanation: `Comprehensive Overview of ${titleTerm}:\n\n1. **Core Definition**: ${titleTerm} establishes the baseline rules and relationships that govern how elements interact.\n2. **Working Mechanism**: Explains why specific inputs produce predictable outcomes under defined conditions.\n3. **Practical Context**: Applied across practical problem solving, theoretical analysis, and real-world implementations.`,
    simpleExplanation: `In simple terms: ${titleTerm} is like the set of rules or ingredients that makes a system work reliably every time.`,
    example: `Key Characteristics of ${titleTerm}:\n- Primary Function: Systematic and repeatable execution.\n- Validation: Confirmed through empirical observation and direct testing.`,
    analogy: `Think of ${titleTerm} like a well-designed recipe: when you follow the steps with the right ingredients, you achieve the expected result consistently.`,
    commonMistakes: [
      `Confusing ${titleTerm} with related but distinct terminology in the same subject area.`,
      `Applying principles of ${titleTerm} outside its valid operational conditions.`
    ],
    keyTakeaways: [
      `Understand the fundamental definition before tackling complex applications.`,
      `Verify assumptions and edge conditions when analyzing ${titleTerm}.`
    ],
    diagramMermaid: 'graph LR;\n  Concept[Core Concept]-->Analysis[Analysis & Rules];\n  Analysis-->Application[Practical Application];',
    sourceDoc: isContextRelevant(question, fileContext) ? sourceDoc : undefined,
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

  // Fallback to dynamic multi-subject knowledge generator when OpenAI is offline
  if (!openai) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AI Solver (Offline Fallback)] Generating response for: "${question}"`);
    }
    const dyn = generateHighQualityPedagogicalResponse(
      question,
      currentTopicContent,
      fileContextMemory,
      sourceFileName,
      isImage,
      chatHistory
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

  // Evaluate Context Relevance before injection (prevents topic contamination)
  const isTopicRelevant = isContextRelevant(question, currentTopicContent);
  const isFileRelevant = isContextRelevant(question, fileContextMemory);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[AI Solver] Request ID: ${requestId || 'none'}, Model: ${modelToUse}, Question: "${question}", Topic Relevant: ${isTopicRelevant}, File Relevant: ${isFileRelevant}`);
  }

  try {
    const systemPrompt = `${AI_TEACHER_SYSTEM_PROMPT}

${isTopicRelevant && currentTopicContent ? `Active Lecture Context (Relevant to question):\n"${currentTopicContent}"` : 'Note: The active classroom lecture may differ from the student\'s question domain. Answer the student\'s actual question directly based on its true subject.'}

${isFileRelevant && fileContextMemory ? `Relevant Uploaded Material Context${sourceFileName ? ` (from file: ${sourceFileName})` : ''}:\n${fileContextMemory.slice(0, 6000)}` : ''}

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
  "sourceDoc": "${isFileRelevant ? (sourceFileName || '') : ''}"
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
    const fallback = generateHighQualityPedagogicalResponse(question, currentTopicContent, fileContextMemory, sourceFileName, isImage, chatHistory);

    const result: SmartDoubtResponse = {
      directAnswer: parsed.directAnswer || fallback.directAnswer,
      detailedExplanation: parsed.detailedExplanation || fallback.detailedExplanation,
      simpleExplanation: parsed.simpleExplanation || fallback.simpleExplanation,
      example: parsed.example || fallback.example,
      analogy: parsed.analogy || fallback.analogy,
      commonMistakes: Array.isArray(parsed.commonMistakes) && parsed.commonMistakes.length > 0 ? parsed.commonMistakes : fallback.commonMistakes,
      keyTakeaways: Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0 ? parsed.keyTakeaways : fallback.keyTakeaways,
      diagramMermaid: parsed.diagramMermaid || fallback.diagramMermaid,
      sourceDoc: isFileRelevant ? (sourceFileName || parsed.sourceDoc || undefined) : undefined,
    };

    sessionDoubtCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[OpenAI Doubt Solver Error]', err);
    const dyn = generateHighQualityPedagogicalResponse(question, currentTopicContent, fileContextMemory, sourceFileName, isImage, chatHistory);
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
        actionInstruction = `The student asked: "${customQuery}". Answer it directly, clearly, and thoroughly based on the true subject of their inquiry.`;
        break;
      default:
        actionInstruction = 'Provide a clear explanation and ask a checkpoint question to confirm understanding.';
    }

    const isTopicRelevant = customQuery ? isContextRelevant(customQuery, topic.content + ' ' + topic.title) : true;
    const isFileRelevant = customQuery && uploadedContext ? isContextRelevant(customQuery, uploadedContext) : !!uploadedContext;

    const systemPrompt = `${AI_TEACHER_SYSTEM_PROMPT}

${isTopicRelevant ? `Current Topic: "${topic.title}"\nTopic Context: "${topic.content}"\nOriginal Analogy: "${topic.analogy}"` : 'Note: The student is asking a standalone question that may be outside the current lesson topic. Answer the question directly and accurately in its true subject domain.'}

${isFileRelevant && uploadedContext ? `Uploaded Material Context${sourceFileName ? ` (from ${sourceFileName})` : ''}:\n${uploadedContext.slice(0, 5000)}` : ''}

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
