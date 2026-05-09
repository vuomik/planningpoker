'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Pusher from 'pusher-js';

type Player = { name: string; vote: string | null; lastSeen?: number };
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

  const isHostRef = useRef(isHost);
  const stateRef = useRef(state);
  const nameRef = useRef(name);

  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { nameRef.current = name; }, [name]);

  useEffect(() => {
    const hostFlag = localStorage.getItem(`host_${sessionId}`);
    if (hostFlag) {
      setIsHost(true);
      const savedState = localStorage.getItem(`state_${sessionId}`);
      if (savedState) {
        try {
          setState(JSON.parse(savedState));
        } catch (e) {
          // invalid JSON
        }
      }
    }

    const storedName = localStorage.getItem(`name_${sessionId}`);
    if (storedName) {
      setName(storedName);
      joinSession(storedName);
    }

    return () => {
      if (storedName) leaveSession(storedName);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!hasJoined) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!
    });

    const channel = pusher.subscribe(`session-${sessionId}`);

    channel.bind('poker-event', (data: any) => {
      if (isHostRef.current) {
        handleEventAsHost(data);
      } else {
        if (data.action === 'sync') {
          setState(data.state);
          if (nameRef.current && data.state.players[nameRef.current]) {
            setMyVote(data.state.players[nameRef.current].vote);
          }
        }
      }
    });

    // Start Ping interval
    const pingInterval = setInterval(() => {
      fetch(`/api/session/${sessionId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'ping', name: nameRef.current })
      });
    }, 10000);

    return () => {
      clearInterval(pingInterval);
      channel.unbind_all();
      pusher.unsubscribe(`session-${sessionId}`);
      pusher.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasJoined, sessionId]);

  const syncState = async (stateToSync: SessionState) => {
    localStorage.setItem(`state_${sessionId}`, JSON.stringify(stateToSync));
    await fetch(`/api/session/${sessionId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'sync', state: stateToSync })
    });
  };

  const handleEventAsHost = (data: any) => {
    // If it's just a sync echoed back to us, ignore it
    if (data.action === 'sync') return;

    const newState = { 
      ...stateRef.current, 
      players: { ...stateRef.current.players } 
    };
    let shouldSync = false;

    switch (data.action) {
      case 'join':
      case 'ping':
        if (data.name) {
          if (!newState.players[data.name]) {
            newState.players[data.name] = { name: data.name, vote: null, lastSeen: Date.now() };
          } else {
            newState.players[data.name].lastSeen = Date.now();
          }
          shouldSync = true;
        }
        break;
      case 'vote':
        if (data.name && newState.players[data.name]) {
          newState.players[data.name].vote = data.vote;
          newState.players[data.name].lastSeen = Date.now();
          shouldSync = true;
        }
        break;
      case 'leave':
        if (data.name && newState.players[data.name]) {
          delete newState.players[data.name];
          shouldSync = true;
        }
        break;
    }

    if (shouldSync) {
      setState(newState);
      syncState(newState);
      
      // Update our own vote state if we were the ones voting
      if (data.name === nameRef.current && data.action === 'vote') {
          setMyVote(data.vote);
      }
    }
  };

  const joinSession = async (playerName: string) => {
    localStorage.setItem(`name_${sessionId}`, playerName);
    setName(playerName);
    setHasJoined(true);

    // If host is joining for the first time, immediately sync state to get started
    if (isHostRef.current) {
        // give it a tiny delay to allow pusher subscription to setup, then we join ourselves.
        setTimeout(async () => {
             await fetch(`/api/session/${sessionId}/action`, {
              method: 'POST',
              body: JSON.stringify({ action: 'join', name: playerName })
            });
        }, 500);
    } else {
        await fetch(`/api/session/${sessionId}/action`, {
          method: 'POST',
          body: JSON.stringify({ action: 'join', name: playerName })
        });
    }
  };

  const leaveSession = async (playerName: string) => {
    await fetch(`/api/session/${sessionId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'leave', name: playerName })
    });
  };

  const submitVote = async (value: string) => {
    const newVote = myVote === value ? null : value; // toggle vote
    // Optimistic UI update (will be corrected by sync if needed)
    setMyVote(newVote);
    await fetch(`/api/session/${sessionId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'vote', name: nameRef.current, vote: newVote })
    });
  };

  const flipCards = async () => {
    const newState = { ...stateRef.current, isRevealed: true };
    setState(newState);
    syncState(newState);
  };

  const resetRound = async () => {
    const newState = { ...stateRef.current, isRevealed: false };
    for (const p in newState.players) {
      newState.players[p].vote = null;
    }
    setState(newState);
    syncState(newState);
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
