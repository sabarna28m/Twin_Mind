import { useEffect, useRef, useState } from 'react';
import { WS_URL } from '../lib/config';

/**
 * Connects to the backend WebSocket at /ws/{userId} and returns whether
 * the socket is currently connected. Calls onCheckinUpdate whenever the
 * server broadcasts a checkin_update event. Auto-reconnects on drop.
 */
export function useWebSocket(
  userId: number | undefined,
  token: string | null,
  onCheckinUpdate: () => void,
): boolean {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  // Keep a stable ref so the effect never needs to re-run for callback changes
  const cbRef = useRef(onCheckinUpdate);
  cbRef.current = onCheckinUpdate;

  useEffect(() => {
    if (!userId || !token) return;

    let dead = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (dead) return;
      const ws = new WebSocket(
        `${WS_URL}/ws/${userId}?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string };
          if (msg.type === 'checkin_update') cbRef.current();
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!dead) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      dead = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [userId, token]);

  return connected;
}
