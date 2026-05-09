import { getSession } from '@/lib/store';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // In Next.js 15, params is a Promise as per new async APIs
) {
  const { id } = await params;
  
  const stream = new ReadableStream({
    start(controller) {
      const session = getSession(id);
      
      const encoder = new TextEncoder();
      
      const sendUpdate = (state: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`));
        } catch (e) {
          // In case the stream is cancelled on the client side
        }
      };

      // Send initial state
      sendUpdate({
        players: session.players,
        isRevealed: session.isRevealed
      });

      // Subscribe to updates
      session.subscribers.push(sendUpdate);

      // Keep alive interval to prevent connection timeout
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`:\n\n`));
        } catch (e) {
          clearInterval(keepAlive);
        }
      }, 15000);

      // Cleanup
      req.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        session.subscribers = session.subscribers.filter(sub => sub !== sendUpdate);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
