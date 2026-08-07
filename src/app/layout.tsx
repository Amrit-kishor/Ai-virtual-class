import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Virtual Classroom | Real-Time Collaborative Studio',
  description: 'Production-ready AI Virtual Classroom supporting real-time video WebRTC, interactive whiteboards, OpenAI tutor, private doubt resolution, code runner, and automated quizzes.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {children}
      </body>
    </html>
  );
}
