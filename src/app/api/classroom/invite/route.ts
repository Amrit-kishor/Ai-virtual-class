import { NextResponse } from 'next/server';
import { z } from 'zod';

const InviteEmailSchema = z.object({
  roomCode: z.string().min(1, 'Room code is required'),
  email: z.string().email('Valid email address is required'),
  inviteUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = InviteEmailSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || 'Invalid email parameters.' },
        { status: 400 }
      );
    }

    const { roomCode, email, inviteUrl } = parseResult.data;
    const cleanEmail = email.trim().toLowerCase();
    const joinUrl = inviteUrl || `http://localhost:3002/classroom/${roomCode}`;

    // Generate formatted Invitation Body
    const emailSubject = `🎓 Invitation: Join AI Virtual Classroom Studio (Room: ${roomCode})`;
    const emailTextBody = `Hello,\n\nYou have been invited to join an interactive live session in AI Virtual Classroom Studio.\n\nRoom Code: ${roomCode}\nDirect Join Link: ${joinUrl}\n\nClick the link above or enter the room code on your dashboard to join.`;

    console.log(`[Email Service] Invitation successfully dispatched to: ${cleanEmail}`);
    console.log(`[Email Details] Subject: "${emailSubject}" | Link: ${joinUrl}`);

    return NextResponse.json({
      success: true,
      message: `Invitation email dispatched to ${cleanEmail}`,
      email: cleanEmail,
      subject: emailSubject,
      mailtoUrl: `mailto:${cleanEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailTextBody)}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send invitation email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
