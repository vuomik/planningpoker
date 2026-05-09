'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const createSession = () => {
    setIsCreating(true);
    // Generate an obfuscated session length (e.g. 10 chars)
    const sessionId = Math.random().toString(36).substring(2, 12);
    // Setup host flag in memory for this client before redirecting
    if (typeof window !== 'undefined') {
      localStorage.setItem(`host_${sessionId}`, 'true');
    }
    router.push(`/session/${sessionId}`);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '40px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '16px', background: 'linear-gradient(to right, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Planning Poker
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '32px', lineHeight: '1.6' }}>
          Real-time, peer-to-peer estimation. 
          No accounts, no database, perfectly synced.
        </p>
        <button 
          className="btn-primary" 
          onClick={createSession} 
          disabled={isCreating}
          style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
        >
          {isCreating ? 'Creating Session...' : 'Create New Session'}
        </button>
      </div>
    </main>
  );
}
