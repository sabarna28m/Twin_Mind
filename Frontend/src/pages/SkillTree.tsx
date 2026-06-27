import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API = 'http://localhost:8000/api/v1/skill-tree';

// ── Color palette ────────────────────────────────────────────────────────────
const C = {
  bg:       '#0B0F0E',
  card:     'rgba(18,22,20,0.85)',
  border:   'rgba(82,255,184,0.15)',
  accent:   '#52FFB8',
  dim:      '#39c98a',
  glow:     'rgba(82,255,184,0.25)',
  mastered: '#a3ffdc',
  weak:     '#ff4e4e',
  locked:   'rgba(255,255,255,0.12)',
  text:     'rgba(180,220,205,0.9)',
  subtext:  'rgba(120,160,145,0.7)',
};

const STATUS_COLOR: Record<string, string> = {
  locked:      '#1e2a26',
  available:   C.accent,
  in_progress: C.dim,
  mastered:    C.mastered,
  weak:        C.weak,
};

const STATUS_GLOW: Record<string, string> = {
  locked:      'none',
  available:   `0 0 16px ${C.glow}, 0 0 4px ${C.accent}`,
  in_progress: `0 0 12px rgba(57,201,138,0.4)`,
  mastered:    `0 0 20px rgba(163,255,220,0.5)`,
  weak:        `0 0 14px rgba(255,78,78,0.5)`,
};

const STATUS_LABEL: Record<string, string> = {
  locked:      '🔒 Locked',
  available:   '🟢 Available',
  in_progress: '⚡ In Progress',
  mastered:    '⭐ Mastered',
  weak:        '🔴 Weak',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface SkillNode {
  id: string; parent_id: string | null; level: number;
  name: string; icon: string; description: string;
  xp_required: number; unlock_threshold: number;
  x: number; y: number;
  status: string; completion_pct: number; xp_earned: number;
  lessons_completed: number; quizzes_completed: number; health_score: number;
}

interface Achievement {
  id: string; name: string; icon: string; color: string;
  xp_bonus: number; desc: string; earned: boolean;
}

interface XPInfo {
  level: number; level_name: string; total_xp: number;
  xp_in_level: number; xp_for_next: number; span: number; progress_pct: number;
}

interface TreeData {
  career: string; career_key: string; career_icon: string;
  pillars: string[]; nodes: SkillNode[];
  xp: XPInfo; weekly_xp: number;
  achievements: Achievement[];
}

interface Mission {
  id: string; title: string; description: string;
  node_id: string; node_name: string; node_icon: string;
  activity_type: string; xp_reward: number;
  priority: string; completed: boolean;
}

interface Readiness {
  overall: number; technical: number; breadth: number; practice: number;
  breakdown: { name: string; score: number; icon: string }[];
}

interface Insight {
  message: string; weak_area: string;
  recommendations: string[];
  prediction: string;
  current_readiness: number; predicted_readiness: number;
}

interface XPPopup { id: string; amount: number; x: number; y: number }

// ── XP Popup ──────────────────────────────────────────────────────────────────
function XPPopupEl({ popup }: { popup: XPPopup }) {
  return (
    <div style={{
      position: 'fixed', left: popup.x, top: popup.y, zIndex: 9999,
      color: C.accent, fontWeight: 700, fontSize: 18,
      pointerEvents: 'none', animation: 'xpFloat 1.6s ease-out forwards',
      textShadow: `0 0 10px ${C.accent}`,
    }}>+{popup.amount} XP</div>
  );
}

// ── Arc gauge ─────────────────────────────────────────────────────────────────
function ArcGauge({ value, label, color = C.accent, size = 90 }: {
  value: number; label: string; color?: string; size?: number;
}) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={14} fontWeight={700}
          style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
          {Math.round(pct)}%
        </text>
      </svg>
      <span style={{ fontSize: 11, color: C.subtext, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

// ── SVG Tree ─────────────────────────────────────────────────────────────────
const NODE_R: Record<number, number> = { 0: 36, 1: 26, 2: 20 };

function SkillTreeSVG({
  nodes, selected, onSelect,
}: {
  nodes: SkillNode[];
  selected: SkillNode | null;
  onSelect: (n: SkillNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState({ x: -100, y: -20, w: 1300, h: 580 });
  const dragging = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    setVb(v => ({ x: v.x, y: v.y, w: v.w * factor, h: v.h * factor }));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('.svg-node')) return;
    dragging.current = { sx: e.clientX, sy: e.clientY, ox: vb.x, oy: vb.y };
  }, [vb]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = (e.clientX - dragging.current.sx) * (vb.w / (svgRef.current?.clientWidth || 1100));
    const dy = (e.clientY - dragging.current.sy) * (vb.h / (svgRef.current?.clientHeight || 560));
    setVb(v => ({ ...v, x: dragging.current!.ox - dx, y: dragging.current!.oy - dy }));
  }, [vb.w, vb.h]);

  const endDrag = useCallback(() => { dragging.current = null; }, []);

  const edges: React.ReactNode[] = [];
  for (const n of nodes) {
    if (!n.parent_id) continue;
    const p = nodeMap[n.parent_id];
    if (!p) continue;
    const active = n.status !== 'locked';
    edges.push(
      <line key={`e-${n.id}`}
        x1={p.x} y1={p.y} x2={n.x} y2={n.y}
        stroke={active ? C.dim : 'rgba(255,255,255,0.07)'}
        strokeWidth={active ? 2 : 1.5}
        style={{ filter: active ? `drop-shadow(0 0 4px ${C.dim})` : 'none' }}
      />
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      style={{ width: '100%', height: '100%', cursor: 'grab', userSelect: 'none' }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      <defs>
        <filter id="glow-accent">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-weak">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="node-mastered">
          <stop offset="0%" stopColor={C.mastered} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={C.mastered} stopOpacity="0.05"/>
        </radialGradient>
      </defs>

      {edges}

      {nodes.map(n => {
        const r = NODE_R[n.level] ?? 18;
        const sc = STATUS_COLOR[n.status] ?? '#333';
        const sel = selected?.id === n.id;
        const isWeak = n.status === 'weak';
        const isMastered = n.status === 'mastered';
        const isLocked = n.status === 'locked';

        return (
          <g key={n.id} className="svg-node"
            transform={`translate(${n.x},${n.y})`}
            onClick={() => onSelect(n)}
            style={{ cursor: isLocked ? 'not-allowed' : 'pointer' }}>

            {(sel || isMastered) && (
              <circle r={r + 6} fill="none"
                stroke={isMastered ? C.mastered : C.accent}
                strokeWidth={sel ? 2.5 : 1.5}
                strokeDasharray={sel ? 'none' : '4 3'}
                opacity={0.7}
              />
            )}

            {(n.status === 'available' || n.status === 'in_progress') && !sel && (
              <circle r={r + 4} fill="none"
                stroke={sc} strokeWidth={1} opacity={0.35}
                style={{ animation: 'svgPulse 2s ease-in-out infinite' }}
              />
            )}

            <circle r={r}
              fill={isLocked ? '#141c18' : isMastered ? 'url(#node-mastered)' : `${sc}22`}
              stroke={isLocked ? 'rgba(255,255,255,0.08)' : sc}
              strokeWidth={sel ? 2.5 : 1.8}
              filter={isWeak ? 'url(#glow-weak)' : !isLocked ? 'url(#glow-accent)' : undefined}
            />

            {n.level === 2 && n.completion_pct > 0 && (
              <circle r={r}
                fill="none" stroke={sc} strokeWidth={3} opacity={0.6}
                strokeDasharray={`${(n.completion_pct / 100) * 2 * Math.PI * r} ${2 * Math.PI * r}`}
                strokeLinecap="round"
                transform="rotate(-90)"
              />
            )}

            <text textAnchor="middle" dominantBaseline="middle"
              fontSize={n.level === 0 ? 20 : n.level === 1 ? 14 : 12}
              style={{ pointerEvents: 'none' }}>
              {n.icon}
            </text>

            {n.level <= 1 && (
              <text y={r + 14} textAnchor="middle"
                fill={isLocked ? 'rgba(255,255,255,0.25)' : C.text}
                fontSize={n.level === 0 ? 13 : 11}
                fontWeight={n.level === 0 ? 700 : 500}
                style={{ pointerEvents: 'none' }}>
                {n.name}
              </text>
            )}
            {n.level === 2 && (
              <text y={r + 13} textAnchor="middle"
                fill={isLocked ? 'rgba(255,255,255,0.15)' : sc}
                fontSize={10}
                style={{ pointerEvents: 'none' }}>
                {n.name.length > 10 ? n.name.slice(0, 10) + '…' : n.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Node Detail Panel ─────────────────────────────────────────────────────────
function NodeDetail({
  node, onActivity, loading,
}: {
  node: SkillNode; onActivity: (nodeId: string, actType: string) => void; loading: boolean;
}) {
  const sc = STATUS_COLOR[node.status];
  const acts = [
    { type: 'lesson',    label: 'Study Lesson',  icon: '📖', xp: 20  },
    { type: 'quiz',      label: 'Take Quiz',     icon: '📝', xp: 50  },
    { type: 'task',      label: 'Practice Task', icon: '⚙️', xp: 30  },
    { type: 'challenge', label: 'Challenge',     icon: '🏆', xp: 100 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: `${sc}18`, border: `1.5px solid ${sc}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, boxShadow: STATUS_GLOW[node.status],
        }}>{node.icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{node.name}</div>
          <div style={{ fontSize: 12, color: sc, marginTop: 2 }}>{STATUS_LABEL[node.status]}</div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: C.subtext, lineHeight: 1.5, margin: 0 }}>{node.description}</p>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 12, color: C.text }}>Progress</span>
          <span style={{ fontSize: 12, color: sc, fontWeight: 600 }}>{Math.round(node.completion_pct)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
          <div style={{
            height: '100%', borderRadius: 3, background: sc, width: `${node.completion_pct}%`,
            boxShadow: `0 0 8px ${sc}`, transition: 'width 0.5s ease',
          }}/>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'XP Earned', val: node.xp_earned },
          { label: 'Health',    val: `${Math.round(node.health_score)}%` },
          { label: 'Lessons',   val: node.lessons_completed },
          { label: 'Quizzes',   val: node.quizzes_completed },
        ].map(s => (
          <div key={s.label} style={{
            padding: '8px 10px', borderRadius: 10,
            background: 'rgba(82,255,184,0.04)', border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 10, color: C.subtext }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.accent, marginTop: 2 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {node.status !== 'locked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: C.subtext, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Activities
          </div>
          {acts.map(a => (
            <button key={a.type}
              disabled={loading}
              onClick={() => onActivity(node.id, a.type)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10, cursor: loading ? 'wait' : 'pointer',
                background: 'rgba(82,255,184,0.05)', border: `1px solid ${C.border}`,
                color: C.text, fontSize: 13, transition: 'all 0.2s',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseOver={e => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(82,255,184,0.12)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent;
                }
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(82,255,184,0.05)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
              }}>
              <span>{a.icon} {a.label}</span>
              <span style={{ color: C.accent, fontWeight: 700, fontSize: 12 }}>+{a.xp} XP</span>
            </button>
          ))}
        </div>
      )}

      {node.status === 'locked' && (
        <div style={{
          padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center',
          color: C.subtext, fontSize: 13,
        }}>
          🔒 Complete parent skills to unlock this node
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
  readiness, insight, missions, onMissionActivity, loading,
}: {
  readiness: Readiness | null; insight: Insight | null; missions: Mission[];
  onMissionActivity: (nodeId: string, actType: string) => void; loading: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', height: '100%', paddingRight: 4 }}>

      {readiness && (
        <div style={{ padding: 16, borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.subtext, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Career Readiness
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 4 }}>
            <ArcGauge value={readiness.overall}   label="Overall"    color={C.accent} />
            <ArcGauge value={readiness.technical} label="Technical"  color={C.dim}    size={70} />
            <ArcGauge value={readiness.breadth}   label="Breadth"    color={C.mastered} size={70} />
          </div>
        </div>
      )}

      {insight && (
        <div style={{ padding: 16, borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>🧠</span>
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TwinMind Mentor
            </span>
          </div>
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.55, margin: '0 0 10px' }}>{insight.message}</p>
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(82,255,184,0.06)', border: `1px solid rgba(82,255,184,0.1)`,
            fontSize: 12, color: C.subtext, fontStyle: 'italic',
          }}>
            📈 {insight.prediction}
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {insight.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize: 12, color: C.subtext, display: 'flex', gap: 6 }}>
                <span style={{ color: C.accent, flexShrink: 0 }}>→</span> {r}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: 16, borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, color: C.subtext, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Daily Missions
        </div>
        {missions.length === 0 ? (
          <div style={{ fontSize: 12, color: C.subtext, textAlign: 'center', padding: '12px 0' }}>
            Unlock more skills to receive missions
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {missions.map(m => (
              <div key={m.id} style={{
                padding: '10px 12px', borderRadius: 10,
                background: m.priority === 'critical' ? 'rgba(255,78,78,0.06)' : 'rgba(82,255,184,0.04)',
                border: `1px solid ${m.priority === 'critical' ? 'rgba(255,78,78,0.2)' : C.border}`,
                opacity: m.completed ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{m.node_icon} {m.title}</div>
                    <div style={{ fontSize: 11, color: C.subtext, marginTop: 2 }}>{m.description}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, flexShrink: 0 }}>+{m.xp_reward}</div>
                </div>
                {!m.completed && (
                  <button
                    disabled={loading}
                    onClick={() => onMissionActivity(m.node_id, m.activity_type)}
                    style={{
                      marginTop: 8, width: '100%', padding: '6px', borderRadius: 7,
                      background: 'rgba(82,255,184,0.1)', border: `1px solid rgba(82,255,184,0.2)`,
                      color: C.accent, fontSize: 11, cursor: loading ? 'wait' : 'pointer',
                    }}>
                    Start →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ data, readiness }: { data: TreeData; readiness: Readiness | null }) {
  const nodes = data.nodes;
  const mastered = nodes.filter(n => n.status === 'mastered').length;
  const inProg   = nodes.filter(n => n.status === 'in_progress').length;
  const weak     = nodes.filter(n => n.status === 'weak').length;
  const unlocked = nodes.filter(n => n.status !== 'locked').length;

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total XP',       val: data.xp.total_xp,  color: C.accent,   icon: '⚡' },
          { label: 'Level',          val: `${data.xp.level} — ${data.xp.level_name}`, color: C.mastered, icon: '🏅' },
          { label: 'Weekly XP',      val: data.weekly_xp,    color: C.dim,      icon: '📅' },
          { label: 'Nodes Mastered', val: mastered,          color: C.mastered, icon: '⭐' },
          { label: 'In Progress',    val: inProg,            color: C.dim,      icon: '⚡' },
          { label: 'Weak Skills',    val: weak,              color: C.weak,     icon: '🔴' },
          { label: 'Unlocked',       val: `${unlocked} / ${nodes.length}`, color: C.accent, icon: '🔓' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '16px 18px', borderRadius: 14, background: C.card,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: C.subtext, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 20, borderRadius: 16, background: C.card, border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>Level {data.xp.level}: {data.xp.level_name}</span>
          <span style={{ fontSize: 12, color: C.subtext }}>{data.xp.xp_in_level} / {data.xp.span} XP</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${C.dim}, ${C.accent})`,
            width: `${data.xp.progress_pct}%`, boxShadow: `0 0 10px ${C.glow}`,
            transition: 'width 0.8s ease',
          }}/>
        </div>
        <div style={{ fontSize: 12, color: C.subtext, marginTop: 6, textAlign: 'right' }}>
          {data.xp.xp_for_next - data.xp.total_xp} XP to Level {data.xp.level + 1}
        </div>
      </div>

      {readiness && (
        <div style={{ padding: 20, borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Branch Mastery</div>
          {readiness.breakdown.map(b => (
            <div key={b.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: C.text }}>{b.icon} {b.name}</span>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: b.score >= 70 ? C.mastered : b.score >= 35 ? C.dim : C.subtext
                }}>
                  {Math.round(b.score)}%
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  background: b.score >= 70 ? C.mastered : b.score >= 35 ? C.dim : C.accent,
                  width: `${b.score}%`, transition: 'width 0.6s ease',
                }}/>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Achievements Tab ──────────────────────────────────────────────────────────
function AchievementsTab({ achievements }: { achievements: Achievement[] }) {
  const earned = achievements.filter(a => a.earned);
  const locked = achievements.filter(a => !a.earned);

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 14, color: C.subtext, marginBottom: 16 }}>
        {earned.length} / {achievements.length} achievements earned
      </div>
      {earned.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Earned
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {earned.map(a => (
              <div key={a.id} style={{
                padding: '16px 14px', borderRadius: 14, background: C.card,
                border: `1px solid ${a.color}44`, boxShadow: `0 0 16px ${a.color}22`,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ fontSize: 28 }}>{a.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: C.subtext }}>{a.desc}</div>
                <div style={{ fontSize: 12, color: a.color, fontWeight: 700 }}>+{a.xp_bonus} XP</div>
              </div>
            ))}
          </div>
        </>
      )}
      {locked.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: C.subtext, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Locked
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {locked.map(a => (
              <div key={a.id} style={{
                padding: '16px 14px', borderRadius: 14,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                opacity: 0.5, display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ fontSize: 28, filter: 'grayscale(1)' }}>{a.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ achievements, onDismiss }: { achievements: Achievement[]; onDismiss: () => void }) {
  useEffect(() => {
    if (achievements.length > 0) {
      const t = setTimeout(onDismiss, 4000);
      return () => clearTimeout(t);
    }
  }, [achievements, onDismiss]);

  if (achievements.length === 0) return null;
  const a = achievements[0];
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9998,
      padding: '16px 20px', borderRadius: 16,
      background: 'rgba(15,25,20,0.96)', backdropFilter: 'blur(20px)',
      border: `1px solid ${a.color}55`, boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 20px ${a.color}33`,
      display: 'flex', alignItems: 'center', gap: 14, minWidth: 280,
      animation: 'slideUp 0.35s ease',
    }}>
      <div style={{ fontSize: 36 }}>{a.icon}</div>
      <div>
        <div style={{ fontSize: 12, color: a.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Achievement Unlocked!
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 2 }}>{a.name}</div>
        <div style={{ fontSize: 12, color: C.subtext, marginTop: 1 }}>{a.desc}</div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SkillTree() {
  const [treeData, setTreeData]   = useState<TreeData | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [insight, setInsight]     = useState<Insight | null>(null);
  const [missions, setMissions]   = useState<Mission[]>([]);
  const [selected, setSelected]   = useState<SkillNode | null>(null);
  const [tab, setTab]             = useState<'tree' | 'analytics' | 'achievements'>('tree');
  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(true);
  const [xpPopups, setXpPopups]   = useState<XPPopup[]>([]);
  const [toastAchs, setToastAchs] = useState<Achievement[]>([]);
  const [error, setError]         = useState<string | null>(null);

  const token = localStorage.getItem('token');
  const auth  = { headers: { Authorization: `Bearer ${token}` } };

  async function fetchAll() {
    setFetching(true); setError(null);
    try {
      const [treeRes, rdRes, insRes, misRes] = await Promise.all([
        axios.get(`${API}/tree`,      auth),
        axios.get(`${API}/readiness`, auth),
        axios.get(`${API}/insight`,   auth),
        axios.get(`${API}/missions`,  auth),
      ]);
      setTreeData(treeRes.data);
      setReadiness(rdRes.data);
      setInsight(insRes.data);
      setMissions(misRes.data.missions ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to load skill tree');
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleActivity(nodeId: string, actType: string) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/activity`, { node_id: nodeId, activity_type: actType }, auth);
      const { xp_gained, new_achievements } = res.data;

      const pid = `${Date.now()}`;
      setXpPopups(prev => [...prev, { id: pid, amount: xp_gained, x: window.innerWidth / 2 - 30, y: 200 }]);
      setTimeout(() => setXpPopups(prev => prev.filter(p => p.id !== pid)), 1800);

      if (new_achievements?.length) setToastAchs(new_achievements);

      await fetchAll();
    } catch (_e) {
      // silently ignore — node may still be locked
    } finally {
      setLoading(false);
    }
  }

  const TABS = [
    { id: 'tree'          as const, label: 'Skill Tree',   icon: '🌳' },
    { id: 'analytics'     as const, label: 'Analytics',    icon: '📊' },
    { id: 'achievements'  as const, label: 'Achievements', icon: '🏆' },
  ];

  if (fetching) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: `3px solid rgba(82,255,184,0.15)`, borderTopColor: C.accent,
          animation: 'spin 0.8s linear infinite',
        }}/>
        <div style={{ color: C.subtext, fontSize: 14 }}>Building your skill tree…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: C.weak, fontSize: 15, textAlign: 'center' }}>⚠️ {error}</div>
    </div>
  );

  if (!treeData) return null;

  return (
    <>
      <style>{`
        @keyframes xpFloat  { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-50px)} }
        @keyframes svgPulse { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .st-scroll::-webkit-scrollbar { width: 4px }
        .st-scroll::-webkit-scrollbar-track { background: transparent }
        .st-scroll::-webkit-scrollbar-thumb { background: rgba(82,255,184,0.2); border-radius: 2px }
      `}</style>

      {xpPopups.map(p => <XPPopupEl key={p.id} popup={p} />)}
      <Toast achievements={toastAchs} onDismiss={() => setToastAchs([])} />

      <div style={{
        minHeight: '100vh', background: C.bg, color: C.text,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 24px', borderBottom: `1px solid ${C.border}`,
          background: 'rgba(11,15,14,0.95)', backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          position: 'sticky', top: 0, zIndex: 100, flexWrap: 'wrap',
        }}>
          {/* Career */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(82,255,184,0.1)', border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              boxShadow: `0 0 16px ${C.glow}`,
            }}>{treeData.career_icon}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>{treeData.career} Skill Tree</div>
              <div style={{ fontSize: 11, color: C.subtext }}>
                Level {treeData.xp.level} {treeData.xp.level_name} · {treeData.xp.total_xp.toLocaleString()} XP
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 260px' }}>
            <span style={{ fontSize: 11, color: C.subtext, flexShrink: 0 }}>Lv {treeData.xp.level}</span>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{
                height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${C.dim}, ${C.accent})`,
                width: `${treeData.xp.progress_pct}%`, boxShadow: `0 0 8px ${C.glow}`,
                transition: 'width 0.6s ease',
              }}/>
            </div>
            <span style={{ fontSize: 11, color: C.subtext, flexShrink: 0 }}>Lv {treeData.xp.level + 1}</span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '7px 13px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                background: tab === t.id ? 'rgba(82,255,184,0.15)' : 'transparent',
                border: tab === t.id ? `1px solid ${C.accent}` : '1px solid rgba(255,255,255,0.07)',
                color: tab === t.id ? C.accent : C.subtext,
                fontWeight: tab === t.id ? 600 : 400, transition: 'all 0.2s',
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tree tab */}
        {tab === 'tree' && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 74px)' }}>

            {/* Left sidebar */}
            <div className="st-scroll" style={{
              width: 296, flexShrink: 0, padding: '14px 10px 14px 14px',
              borderRight: `1px solid ${C.border}`, overflowY: 'auto',
              background: 'rgba(11,15,14,0.6)',
            }}>
              <Sidebar
                readiness={readiness} insight={insight} missions={missions}
                onMissionActivity={handleActivity} loading={loading}
              />
            </div>

            {/* SVG Tree canvas */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {/* Legend */}
              <div style={{
                position: 'absolute', top: 12, left: 12, zIndex: 10,
                display: 'flex', gap: 8, flexWrap: 'wrap',
              }}>
                {Object.entries(STATUS_LABEL).map(([s, l]) => (
                  <div key={s} style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                    padding: '4px 8px', borderRadius: 20,
                    background: 'rgba(11,15,14,0.85)', border: `1px solid ${C.border}`,
                    color: STATUS_COLOR[s],
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[s], flexShrink: 0 }}/>
                    {l}
                  </div>
                ))}
              </div>

              <div style={{
                position: 'absolute', bottom: 12, right: 12, zIndex: 10,
                fontSize: 11, color: C.subtext, padding: '5px 10px',
                background: 'rgba(11,15,14,0.8)', borderRadius: 8, border: `1px solid ${C.border}`,
              }}>
                Scroll to zoom · Drag to pan
              </div>

              <SkillTreeSVG
                nodes={treeData.nodes}
                selected={selected}
                onSelect={n => setSelected(prev => prev?.id === n.id ? null : n)}
              />
            </div>

            {/* Right detail panel */}
            <div className="st-scroll" style={{
              width: 310, flexShrink: 0, padding: 14,
              borderLeft: `1px solid ${C.border}`,
              background: 'rgba(11,15,14,0.7)', overflowY: 'auto',
            }}>
              {selected ? (
                <NodeDetail node={selected} onActivity={handleActivity} loading={loading} />
              ) : (
                <div style={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                  color: C.subtext, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 40 }}>🌳</div>
                  <div style={{ fontSize: 13 }}>Click any node to explore skills and complete activities</div>
                  <div style={{
                    marginTop: 6, padding: '10px 14px', borderRadius: 12,
                    background: 'rgba(82,255,184,0.04)', border: `1px solid ${C.border}`, fontSize: 12,
                  }}>
                    {treeData.nodes.filter(n => n.status === 'available').length} skills ready to start
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'analytics' && (
          <div className="st-scroll" style={{ flex: 1, overflowY: 'auto' }}>
            <AnalyticsTab data={treeData} readiness={readiness} />
          </div>
        )}

        {tab === 'achievements' && (
          <div className="st-scroll" style={{ flex: 1, overflowY: 'auto' }}>
            <AchievementsTab achievements={treeData.achievements} />
          </div>
        )}
      </div>
    </>
  );
}
