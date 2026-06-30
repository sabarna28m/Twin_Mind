import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WS_URL } from '../lib/config';

export default function GlobalNotificationListener() {
  const { user, token } = useAuth();
  const [toast, setToast] = useState<{ title: string; message: string; visible: boolean } | null>(null);

  useEffect(() => {
    if (!user?.id || !token) return;

    let dead = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (dead) return;
      ws = new WebSocket(`${WS_URL}/ws/${user.id}?token=${encodeURIComponent(token)}`);

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'event_reminder') {
            // Trigger sound
            playNotificationSound();
            
            // Show toast
            setToast({
              title: msg.title,
              message: msg.message,
              visible: true
            });
            
            // Auto hide toast after 10s
            setTimeout(() => setToast(prev => prev ? { ...prev, visible: false } : null), 10000);
            
            // Show browser notification
            if (Notification.permission === 'granted') {
              new Notification(`Reminder: ${msg.title}`, {
                body: msg.message,
                icon: '/favicon.ico'
              });
            }
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        if (!dead) reconnectTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      dead = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [user?.id, token]);

  const playNotificationSound = () => {
    try {
      // A simple synthetic beep if no mp3 is available
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio disabled or blocked');
    }
  };

  if (!toast || !toast.visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: 'var(--bg-elevated)',
      borderLeft: '4px solid #3b82f6',
      padding: '16px 20px',
      borderRadius: '8px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
      zIndex: 99999,
      animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      maxWidth: '350px'
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-h)' }}>{toast.title}</h4>
        <button 
          onClick={() => setToast(prev => prev ? { ...prev, visible: false } : null)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-m)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
        >
          ×
        </button>
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.4 }}>{toast.message}</p>
    </div>
  );
}
