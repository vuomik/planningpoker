import { getSession, notifySubscribers } from '@/lib/store';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { action, name, vote } = body;

  const session = getSession(id);
  const now = Date.now();

  switch (action) {
    case 'join':
    case 'ping':
      if (name) {
        if (!session.players[name]) {
          session.players[name] = { name, vote: null, lastSeen: now };
        } else {
          session.players[name].lastSeen = now;
        }
        notifySubscribers(id);
      }
      break;

    case 'vote':
      if (name && session.players[name]) {
        session.players[name].vote = vote;
        session.players[name].lastSeen = now;
        notifySubscribers(id);
      }
      break;

    case 'flip':
      session.isRevealed = true;
      notifySubscribers(id);
      break;

    case 'reset':
      session.isRevealed = false;
      for (const p in session.players) {
        session.players[p].vote = null;
      }
      notifySubscribers(id);
      break;

    case 'leave':
      if (name && session.players[name]) {
        delete session.players[name];
        notifySubscribers(id);
      }
      break;
      
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
