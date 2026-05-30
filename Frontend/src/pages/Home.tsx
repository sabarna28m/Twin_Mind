import { useEffect, useState } from 'react';
import api from '../services/api';

export default function Home() {
  const [status, setStatus] = useState<string>('checking...');

  useEffect(() => {
    api.get('/health')
      .then(res => setStatus(res.data.status))
      .catch(() => setStatus('unreachable'));
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>TwinMind</h1>
      <p>AI-powered educational platform</p>
      <p>API status: <strong>{status}</strong></p>
    </main>
  );
}
