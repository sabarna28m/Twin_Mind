import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
const DETECT_MS = 600;
const EAR_LOW   = 0.22;
const YAW_HIGH  = 0.20;

type FocusState = 'focused' | 'distracted' | 'tired' | 'away' | 'idle';

const STATE_COLOR: Record<FocusState, string> = {
  focused: '#10b981', distracted: '#ef4444', tired: '#f59e0b', away: '#6b7280', idle: '#6366f1',
};

function eucl(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
function calcEAR(pts: { x: number; y: number }[]): number {
  if (pts.length < 6) return 0.30;
  return (eucl(pts[1], pts[5]) + eucl(pts[2], pts[4])) / (2 * eucl(pts[0], pts[3]) + 1e-9);
}

export interface FocusMetrics {
  score: number;
  state: FocusState;
  facePresent: boolean;
}

interface Props {
  stream: MediaStream | null;
  demoMode: boolean;
  sessionActive: boolean;
  onMetrics: (m: FocusMetrics) => void;
}

export default function IntegrityMonitor({ stream, demoMode, sessionActive, onMetrics }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [score, setScore] = useState(0);
  const [state, setState] = useState<FocusState>('idle');

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        ]);
      } catch { /* fall through — demoMode covers this */ }
      setModelsReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!stream || !videoRef.current) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
  }, [stream]);

  useEffect(() => {
    if (!modelsReady || !stream) return;

    detectRef.current = setInterval(async () => {
      const video = videoRef.current;

      if (demoMode) {
        const t = Date.now() / 1000;
        const s = Math.round(Math.max(20, Math.min(100, 74 + 14 * Math.sin(t / 80) + (Math.random() - 0.5) * 16)));
        const st: FocusState = s >= 70 ? 'focused' : s >= 50 ? 'distracted' : 'tired';
        setScore(s);
        setState(st);
        onMetrics({ score: s, state: st, facePresent: true });
        return;
      }

      if (!video || video.readyState < 2) return;
      try {
        const result = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks(true);

        if (!result) {
          const st: FocusState = sessionActive ? 'away' : 'idle';
          setScore(0);
          setState(st);
          onMetrics({ score: 0, state: st, facePresent: false });
          const cv = canvasRef.current;
          if (cv) cv.getContext('2d')?.clearRect(0, 0, cv.width, cv.height);
          return;
        }

        type P = { x: number; y: number };
        const lm      = result.landmarks;
        const toArr   = (a: unknown) => a as P[];
        const leftEye = toArr(lm.getLeftEye());
        const rightEye= toArr(lm.getRightEye());
        const positions = toArr((lm as unknown as { positions: unknown }).positions);

        const ear = (calcEAR(leftEye) + calcEAR(rightEye)) / 2;
        const lEc = { x: (leftEye[0].x  + leftEye[3].x)  / 2, y: (leftEye[0].y  + leftEye[3].y)  / 2 };
        const rEc = { x: (rightEye[0].x + rightEye[3].x) / 2, y: (rightEye[0].y + rightEye[3].y) / 2 };
        const eyeC = { x: (lEc.x + rEc.x) / 2, y: (lEc.y + rEc.y) / 2 };
        const nose  = positions[30] as P;
        const faceW = eucl(positions[0] as P, positions[16] as P);
        const yaw   = faceW > 0 ? (nose.x - eyeC.x) / faceW : 0;

        let sc = 100;
        if (ear < EAR_LOW)               sc -= Math.min(30, (EAR_LOW - ear) * 250);
        if (Math.abs(yaw) > YAW_HIGH)    sc -= Math.min(35, (Math.abs(yaw) - YAW_HIGH) * 200);
        const s = Math.round(Math.max(0, Math.min(100, sc)));

        const st: FocusState = ear < EAR_LOW ? 'tired' : Math.abs(yaw) > YAW_HIGH || s < 60 ? 'distracted' : 'focused';
        setScore(s);
        setState(st);
        onMetrics({ score: s, state: st, facePresent: true });

        const cv = canvasRef.current;
        if (cv && video.videoWidth > 0) {
          cv.width  = video.clientWidth  || 240;
          cv.height = video.clientHeight || 180;
          const sx = cv.width / video.videoWidth;
          const sy = cv.height / video.videoHeight;
          const ctx = cv.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, cv.width, cv.height);
            const { x, y, width, height } = result.detection.box;
            const col = STATE_COLOR[st];
            ctx.strokeStyle = col;
            ctx.lineWidth   = 1.5;
            ctx.shadowColor = col;
            ctx.shadowBlur  = 6;
            ctx.strokeRect(x * sx, y * sy, width * sx, height * sy);
          }
        }
      } catch { /* retry */ }
    }, DETECT_MS);

    return () => { if (detectRef.current) clearInterval(detectRef.current); };
  }, [modelsReady, stream, demoMode, sessionActive, onMetrics]);

  const color = STATE_COLOR[state];
  const C = 2 * Math.PI * 30;
  const offset = C * (1 - score / 100);

  return (
    <div style={m.wrap}>
      <div style={m.header}>
        <span style={{ ...m.dot, background: stream ? '#10b981' : '#6b7280' }} />
        <span style={m.label}>AI Focus Monitor</span>
        {demoMode && <span style={m.demoBadge}>Demo</span>}
      </div>

      {/* Camera feed */}
      <div style={m.camWrap}>
        {!stream && (
          <div style={m.camPH}>
            <Camera size={24} style={{ opacity: 0.3, color: 'var(--text-m)' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text)', textAlign: 'center' as const }}>Camera feed</span>
          </div>
        )}
        <video ref={videoRef} style={{ ...m.video, opacity: stream ? 1 : 0 }} autoPlay muted playsInline />
        <canvas ref={canvasRef} style={m.canvas} />
      </div>

      {/* Score ring + state */}
      <div style={m.scoreRow}>
        <svg width={76} height={76} viewBox="0 0 76 76">
          <circle cx={38} cy={38} r={30} fill="none" stroke="#e2e8f0" strokeWidth={7} />
          <circle cx={38} cy={38} r={30} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={offset}
            transform="rotate(-90 38 38)"
            style={{ transition: 'stroke-dashoffset 0.5s, stroke 0.3s' }} />
          <text x={38} y={34} textAnchor="middle" fill={color} fontSize={14} fontWeight="800" fontFamily="ui-monospace,monospace">{score}</text>
          <text x={38} y={48} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={7} fontWeight="600" letterSpacing={1}>FOCUS</text>
        </svg>
        <div>
          <p style={{ ...m.stateLabel, color }}>{state.toUpperCase()}</p>
          <p style={m.stateSub}>
            {state === 'focused' ? 'Good focus' : state === 'distracted' ? 'Stay focused' : state === 'tired' ? 'Signs of fatigue' : state === 'away' ? 'Not visible' : 'Monitoring…'}
          </p>
        </div>
      </div>

      {!modelsReady && !demoMode && (
        <p style={m.loading}>Loading AI models…</p>
      )}
    </div>
  );
}

const m: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.6rem 0.85rem', borderBottom: '1px solid #e2e8f0',
  },
  dot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  label: { flex: 1, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-h)' },
  demoBadge: {
    fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem',
    borderRadius: '99px', background: 'rgba(124,58,237,0.15)',
    border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa',
  },
  camWrap: {
    position: 'relative' as const, width: '100%', aspectRatio: '4/3' as unknown as string,
    background: 'rgba(0,0,0,0.6)', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  camPH: { position: 'absolute' as const, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', zIndex: 1 },
  video: { width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block', transform: 'scaleX(-1)' },
  canvas:{ position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'scaleX(-1)' },
  scoreRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.85rem' },
  stateLabel: { margin: 0, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', transition: 'color 0.3s' },
  stateSub:   { margin: 0, fontSize: '0.65rem', color: 'var(--text)', lineHeight: 1.3 },
  loading:    { margin: 0, padding: '0.5rem 0.85rem 0.75rem', fontSize: '0.68rem', color: 'var(--text)', textAlign: 'center' as const },
};
