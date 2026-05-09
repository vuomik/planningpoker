'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Player = { name: string; vote: string | null };
type SessionState = { players: Record<string, Player>; isRevealed: boolean };

const FIBONACCI = ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'];

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id;
  const router = useRouter();

  const [name, setName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [state, setState] = useState<SessionState>({ players: {}, isRevealed: false });
  const [myVote, setMyVote] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Check if user is host
    const hostFlag = localStorage.getItem(`host_${sessionId}`);
    if (hostFlag) setIsHost(true);

    // Check if user already has a name stored for this session
    const storedName = localStorage.getItem(`name_${sessionId}`);
    if (storedName) {
      setName(storedName);
      joinSession(storedName);
    }

    return () => {
      if (storedName) leaveSession(storedName);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const joinSession = async (playerName: string) => {
    localStorage.setItem(`name_${sessionId}`, playerName);
    setName(playerName);
    setHasJoined(true);

    await fetch(`/api/session/${sessionId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'join', name: playerName })
    });

    if (!eventSourceRef.current) {
      const source = new EventSource(`/api/session/${sessionId}/events`);
      source.onmessage = (e) => {
        const data = JSON.parse(e.data);
        setState(data);
        if (data.players[playerName]) {
            setMyVote(data.players[playerName].vote);
        }
      };
      eventSourceRef.current = source;
    }

    // Start Ping interval to stay alive
    setInterval(() => {
      fetch(`/api/session/${sessionId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'ping', name: playerName })
      });
    }, 10000);
  };

  const leaveSession = async (playerName: string) => {
    await fetch(`/api/session/${sessionId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'leave', name: playerName })
    });
  };

  const submitVote = async (value: string) => {
    const newVote = myVote === value ? null : value; // toggle vote
    setMyVote(newVote);
    await fetch(`/api/session/${sessionId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'vote', name, vote: newVote })
    });
  };

  const flipCards = async () => {
    await fetch(`/api/session/${sessionId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'flip' })
    });
  };

  const resetRound = async () => {
    await fetch(`/api/session/${sessionId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reset' })
    });
  };

  if (!hasJoined) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel animate-fade-in" style={{ padding: '40px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
          <h2 style={{ marginBottom: '24px' }}>Join Session</h2>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Enter your name" 
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && joinSession(name.trim())}
            style={{ marginBottom: '24px' }}
            autoFocus
          />
          <button 
            className="btn-primary" 
            onClick={() => name.trim() && joinSession(name.trim())}
            style={{ width: '100%' }}
          >
            Join Table
          </button>
        </div>
      </main>
    );
  }

  const players = Object.values(state.players);

  return (
    <main className="container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header className="glass-panel animate-fade-in" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Poker Room</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>ID: {sessionId}</p>
        </div>
        
        {isHost && (
          <div style={{ display: 'flex', gap: '12px' }}>
             <button className="btn-secondary" onClick={resetRound}>Reset</button>
             <button className="btn-primary" onClick={flipCards} disabled={state.isRevealed}>Flip Cards</button>
          </div>
        )}
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '80px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center', maxWidth: '800px' }}>
          {players.map(p => (
            <div key={p.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.3s ease' }}>
              <div 
                className="glass-panel"
                style={{
                  width: '100px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem', fontWeight: 'bold', marginBottom: '12px',
                  background: state.isRevealed 
                    ? (p.vote ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))' : 'rgba(0,0,0,0.2)')
                    : (p.vote ? '#3b82f6' : 'rgba(0,0,0,0.2)'),
                  color: state.isRevealed ? '#fff' : 'transparent',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  transform: state.isRevealed ? 'rotateY(0deg)' : (p.vote ? 'rotateY(180deg)' : 'rotateY(0deg)'),
                  boxShadow: state.isRevealed && p.vote ? '0 0 20px rgba(59, 130, 246, 0.4)' : undefined,
                  border: p.vote ? '1px solid rgba(59, 130, 246, 0.5)' : undefined
                }}
              >
                <span style={{ transform: state.isRevealed ? 'rotateY(0deg)' : 'rotateY(-180deg)', display: 'block', transition: 'all 0.4s' }}>
                  {state.isRevealed ? (p.vote || '⏳') : ''}
                </span>
              </div>
              <span style={{ fontSize: '1rem', fontWeight: 500, color: p.name === name ? '#60a5fa' : '#fff' }}>
                {p.name} {p.name === name && '(You)'}
              </span>
            </div>
          ))}
          {players.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>Waiting for players...</p>
          )}
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '900px', padding: '0 24px', zIndex: 10 }}>
        <div className="glass-panel animate-fade-in" style={{ padding: '20px', display: 'flex', gap: '12px', overflowX: 'auto', justifyContent: 'center' }}>
           {FIBONACCI.map(val => (
              <button 
                key={val}
                onClick={() => !state.isRevealed && submitVote(val)}
                disabled={state.isRevealed}
                className="glass-panel"
                style={{
                  minWidth: '60px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem', fontWeight: 'bold', flexShrink: 0,
                  cursor: state.isRevealed ? 'not-allowed' : 'pointer',
                  background: myVote === val ? 'linear-gradient(135deg, var(--primary), var(--accent))' : undefined,
                  transform: myVote === val ? 'translateY(-10px)' : 'translateY(0)',
                  transition: 'all 0.2s',
                  opacity: state.isRevealed ? 0.5 : 1
                }}
                onMouseOver={e => {
                  if (!state.isRevealed && myVote !== val) e.currentTarget.style.transform = 'translateY(-5px)';
                }}
                onMouseOut={e => {
                  if (!state.isRevealed && myVote !== val) e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {val}
              </button>
           ))}
        </div>
      </div>
    </main>
  );
}
