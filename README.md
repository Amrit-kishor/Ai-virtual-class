# AI Virtual Classroom Studio

Production-Ready Next.js 15 + Socket.io + WebRTC multi-user AI Virtual Classroom supporting real-time video/audio streaming, interactive whiteboard, AI-driven dynamic lectures, private doubt tutor, multi-language code playground, attendance tracking, and automated AI quizzes.

---

## Key Features

1. **WebRTC Video & Audio Grid**:
   - Adaptive video grid up to 4 participants.
   - Spotlight teacher mode, mic/camera toggles, screen sharing, raise hand indicator, picture-in-picture.
2. **AI Interactive Teacher**:
   - Upload syllabus/material (PDF, PPT, DOCX, TXT).
   - Topic-by-topic structured lectures, real-world analogies, flowcharts, and AI voice audio synthesizer with speed control.
3. **Private AI Doubt Tutor**:
   - Private 1-on-1 AI doubt chat without interrupting the main lecture.
   - LaTeX math equations ($E=mc^2$), code snippets, and automated lecture context reference.
4. **Infinite Interactive Whiteboard**:
   - Canvas tools: Pen, Eraser, Rectangle, Circle, Line, Text, Sticky Notes, Laser Pointer.
   - Color picker, stroke widths, undo, redo, zoom in/out, pan, and real-time Socket.io canvas synchronization.
5. **Interactive Coding Mode**:
   - Multi-language support: JavaScript, Python, C++, Java.
   - Code execution runner console and AI Code Optimization Reviewer.
6. **Live AI Quiz & Assessment**:
   - Auto-generated MCQs, True/False, and Coding challenges with instant grading and explanations.
7. **Attendance & Engagement**:
   - Join/exit times, duration tracking, reconnect count, and downloadable CSV attendance report.
8. **JWT Authentication & Protection**:
   - Full signup/login flows, session persistence, role-based authorization (Teacher vs Student).

---

## Project Structure

```
ai-virtual-classroom/
├── prisma/
│   ├── schema.prisma        # Database schema for Postgres/SQLite
│   └── seed.ts              # Initial database seed script
├── server/
│   └── index.ts             # Custom Express + Socket.io Server & Next.js integration
├── src/
│   ├── app/
│   │   ├── page.tsx          # Hero Landing Page
│   │   ├── login/page.tsx    # Auth Page (Login / Signup / Social)
│   │   ├── dashboard/        # Student & Teacher Dashboard
│   │   ├── classroom/[code]/ # Main Interactive AI Studio Page
│   │   └── api/              # API Routes (Auth, Classroom, AI, Code Runner)
│   ├── components/
│   │   └── classroom/        # VideoGrid, AITeacherControl, Whiteboard, Chat, Doubts, Coding, Notes, Modals
│   ├── lib/                  # Prisma client, Auth JWT helpers, OpenAI API engine, Socket client
│   └── types/                # TypeScript interfaces
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Quick Start (Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running with Docker Compose

To spin up PostgreSQL, Redis, and the Node application together:

```bash
docker-compose up --build
```
