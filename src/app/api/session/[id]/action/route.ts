import { pusherServer } from '@/lib/pusher';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Simply relay the action to all clients subscribed to this session
  await pusherServer.trigger(`session-${id}`, 'poker-event', body);

  return NextResponse.json({ success: true });
}
