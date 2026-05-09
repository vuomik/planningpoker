export type Player = {
  name: string;
  vote: string | null;
  lastSeen: number;
};

export type SessionState = {
  players: Record<string, Player>;
  isRevealed: boolean;
};

export type Session = SessionState & {
  subscribers: Array<(state: SessionState) => void>;
};

// Use global to maintain state across hot-reloads in Next.js dev mode
const globalAny: any = global;
if (!globalAny.pokerSessions) {
  globalAny.pokerSessions = {} as Record<string, Session>;
}

export const sessions: Record<string, Session> = globalAny.pokerSessions;

export function getSession(id: string): Session {
  if (!sessions[id]) {
    sessions[id] = {
      players: {},
      isRevealed: false,
      subscribers: []
    };
  }
  return sessions[id];
}

export function notifySubscribers(id: string) {
  const session = sessions[id];
  if (!session) return;
  
  const statePayload: SessionState = {
    players: session.players,
    isRevealed: session.isRevealed
  };
  
  session.subscribers.forEach(sub => sub(statePayload));
}

// Clean up stale players (longer than 1 minute without action/refresh)
setInterval(() => {
  const now = Date.now();
  for (const sessionId in sessions) {
    const session = sessions[sessionId];
    let changed = false;
    for (const playerId in session.players) {
      if (now - session.players[playerId].lastSeen > 60000) {
        delete session.players[playerId];
        changed = true;
      }
    }
    if (changed) {
      notifySubscribers(sessionId);
    }
  }
}, 15000);
