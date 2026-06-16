import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import BackButton from '../components/BackButton';
import { BarChart2, Trophy, Zap, Target, Star, TrendingUp, Lock, Play, CheckCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────
interface SkillNode {
  id: string;
  parent_id: string | null;
  level: number;
  name: string;
  icon: string;
  description: string;
  xp_required: number;
  unlock_threshold: number;
  x: number;
  y: number;
  status: 'locked' | 'available' | 'in_progress' | 'mastered';
  completion_pct: number;
  xp_earned: number;
  lessons_completed: number;
  quizzes_completed: number;
}

interface XPInfo {
  level: number;
  total_xp: number;
  xp_in_level: number;
  xp_for_next: number;
  span: number;
  progress_pct: number;
}

interface Achievement {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  xp_bonus: number;
  earned: boolean;
}

interface TreeData {
  nodes: SkillNode[];
  xp: XPInfo;
  weekly_xp: number;
  achievements: Achievement[];
}

interface XPPopup {
  id: number;
  amount: number;
  x: number;
  y: number;
}

type Tab = 'tree' | 'analytics' | 'achievements';

// ── Node visual config ─────────────────────────────────────────────────
const NODE_R = { 0: 44, 1: 36, 2: 28 } as Record<number, number>;

const STATUS_STYLES = {
  locked: { fill: '#1a1f2e', stroke: '#2d3748', glow: 'none', textColor: '#4a5568' },
  available: { fill: '#0d1b3e', stroke: '#00D4FF', glow: '#00D4FF', textColor: '#00D4FF' },
  in_progress: { fill: '#0d2040', stroke: '#7c3aed', glow: '#7c3aed', textColor: '#a78bfa' },
  mastered: { fill: '#1a0a30', stroke: '#f59e0b', glow: '#f59e0b', textColor: '#fbbf24' },
};

function NodeCircle({
  node, selected, onClick, animTime,
}: {
  node: SkillNode;
  selected: boolean;
  onClick: () => void;
  animTime: number;
}) {
  const r = NODE_R[node.level] ?? 28;
  const st = STATUS_STYLES[node.status];
  const isLocked = node.status === 'locked';
  const pulse = node.status === 'available';
  const spin = node.status === 'in_progress';

  const glowId = `glow-${node.id}`;
  const gradId = `grad-${node.id}`;
  const maskId = `mask-${node.id}`;

  // pulsing scale for available nodes
  const scale = pulse ? 1 + 0.06 * Math.sin(animTime * 2.5) : 1;

  return (
    <g
      transform={`translate(${node.x},${node.y}) scale(${scale})`}
      onClick={isLocked ? undefined : onClick}
      style={{ cursor: isLocked ? 'default' : 'pointer' }}
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={st.stroke} stopOpacity={selected ? 0.5 : 0.2} />
          <stop offset="100%" stopColor={st.fill} stopOpacity={1} />
        </radialGradient>
        {st.glow !== 'none' && (
          <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation={selected ? 8 : 4} result="blur" />
            <feColorMatrix in="blur" type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
        {node.status === 'mastered' && (
          <linearGradient id={`spin-${node.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        )}
        {node.completion_pct > 0 && (
          <clipPath id={maskId}>
            <rect x={-r} y={r - 2 * r * node.completion_pct / 100} width={2 * r} height={2 * r} />
          </clipPath>
        )}
      </defs>

      {/* Outer glow ring for non-locked */}
      {st.glow !== 'none' && (
        <circle
          r={r + 6}
          fill="none"
          stroke={st.stroke}
          strokeWidth={selected ? 2 : 1}
          strokeOpacity={0.3 + 0.2 * Math.sin(animTime * 1.5)}
          filter={`url(#${glowId})`}
        />
      )}

      {/* Spinning dashed ring for in_progress */}
      {spin && (
        <circle
          r={r + 10}
          fill="none"
          stroke={st.stroke}
          strokeWidth={2}
          strokeDasharray="8 6"
          strokeOpacity={0.6}
          transform={`rotate(${animTime * 30})`}
        />
      )}

      {/* Mastered animated ring */}
      {node.status === 'mastered' && (
        <circle
          r={r + 14}
          fill="none"
          stroke={`url(#spin-${node.id})`}
          strokeWidth={3}
          strokeDasharray="20 10"
          strokeOpacity={0.8}
          transform={`rotate(${-animTime * 20})`}
        />
      )}

      {/* Main circle */}
      <circle
        r={r}
        fill={`url(#${gradId})`}
        stroke={selected ? '#fff' : st.stroke}
        strokeWidth={selected ? 3 : node.level === 0 ? 3 : 2}
        filter={st.glow !== 'none' ? `url(#${glowId})` : undefined}
      />

      {/* Completion fill overlay */}
      {node.completion_pct > 0 && node.completion_pct < 100 && (
        <circle
          r={r - 3}
          fill={st.stroke}
          fillOpacity={0.12}
          clipPath={`url(#${maskId})`}
        />
      )}

      {/* Icon */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={node.level === 0 ? 22 : node.level === 1 ? 18 : 14}
        y={-4}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        opacity={isLocked ? 0.3 : 1}
      >
        {isLocked ? '🔒' : node.icon}
      </text>

      {/* Name */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={r + 14}
        fontSize={node.level === 0 ? 11 : 9}
        fill={st.textColor}
        fontWeight="600"
        style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'system-ui' }}
      >
        {node.name.length > 14 ? node.name.slice(0, 13) + '…' : node.name}
      </text>

      {/* Completion % for in_progress */}
      {node.status === 'in_progress' && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          y={8}
          fontSize={8}
          fill="#a78bfa"
          fontWeight="700"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {Math.round(node.completion_pct)}%
        </text>
      )}

      {/* Mastered checkmark */}
      {node.status === 'mastered' && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          y={9}
          fontSize={10}
          fill="#fbbf24"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          ✓
        </text>
      )}
    </g>
  );
}

// ── Connector path ──────────────────────────────────────────────────────
function Connector({ from, to, status }: {
  from: SkillNode;
  to: SkillNode;
  status: string;
}) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2 - 20;
  const d = `M${from.x},${from.y} Q${mx},${my} ${to.x},${to.y}`;
  const col = status === 'locked' ? '#1e2535'
    : status === 'mastered' ? '#f59e0b'
    : status === 'in_progress' ? '#7c3aed'
    : '#00D4FF';
  return (
    <path
      d={d}
      fill="none"
      stroke={col}
      strokeWidth={status === 'locked' ? 1 : 2}
      strokeOpacity={status === 'locked' ? 0.4 : 0.7}
      strokeDasharray={status === 'locked' ? '5 4' : undefined}
    />
  );
}

// ── XP Popup ────────────────────────────────────────────────────────────
function XPPopupOverlay({ popups }: { popups: XPPopup[] }) {
  return (
    <>
      {popups.map(p => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: p.x,
            top: p.y,
            pointerEvents: 'none',
            animation: 'xpFloat 1.4s ease-out forwards',
            fontWeight: 800,
            fontSize: '1.1rem',
            color: '#fbbf24',
            textShadow: '0 0 12px #f59e0b',
            zIndex: 9999,
            whiteSpace: 'nowrap',
          }}
        >
          +{p.amount} XP ✨
        </div>
      ))}
    </>
  );
}

// ── Node Detail Panel ───────────────────────────────────────────────────
function NodePanel({
  node, onClose, onActivity, loading,
}: {
  node: SkillNode;
  onClose: () => void;
  onActivity: (type: string) => void;
  loading: boolean;
}) {
  const st = STATUS_STYLES[node.status];
  const activities = [
    { type: 'lesson', label: 'Start Lesson', icon: '📖', xp: 20, color: '#06b6d4' },
    { type: 'quiz', label: 'Take Quiz', icon: '❓', xp: 50, color: '#8b5cf6' },
    { type: 'task', label: 'Complete Task', icon: '✅', xp: 30, color: '#10b981' },
    { type: 'challenge', label: 'Challenge', icon: '⚔️', xp: 100, color: '#f59e0b' },
  ];

  const rankName = node.completion_pct >= 100 ? 'Master'
    : node.completion_pct >= 70 ? 'Advanced'
    : node.completion_pct >= 40 ? 'Intermediate'
    : node.completion_pct > 0 ? 'Beginner'
    : 'Not Started';

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 340,
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderLeft: `1px solid ${st.stroke}40`,
      boxShadow: `-4px 0 40px ${st.stroke}20`,
      display: 'flex', flexDirection: 'column',
      zIndex: 200, overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '1.25rem 1.25rem 1rem',
        borderBottom: `1px solid ${st.stroke}25`,
        background: `linear-gradient(135deg,${st.stroke}15,transparent)`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>{node.icon}</div>
            <h2 style={{ margin: 0, color: st.textColor, fontSize: '1.1rem', fontWeight: 800 }}>
              {node.name}
            </h2>
            <p style={{ margin: '0.3rem 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>
              {node.description}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64748b',
            cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem',
          }}>✕</button>
        </div>
      </div>

      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {/* Status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.3rem 0.8rem', borderRadius: 20,
          background: st.stroke + '20', border: `1px solid ${st.stroke}50`,
          color: st.textColor, fontSize: '0.75rem', fontWeight: 700, alignSelf: 'flex-start',
        }}>
          {node.status === 'locked' && <><Lock size={11} /> Locked</>}
          {node.status === 'available' && <><Play size={11} /> Available</>}
          {node.status === 'in_progress' && <><Clock size={11} /> In Progress</>}
          {node.status === 'mastered' && <><CheckCircle size={11} /> Mastered</>}
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Completion</span>
            <span style={{ color: st.textColor, fontSize: '0.72rem', fontWeight: 700 }}>
              {Math.round(node.completion_pct)}%
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#1e2535', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${node.completion_pct}%`,
              background: node.status === 'mastered'
                ? 'linear-gradient(90deg,#f59e0b,#8b5cf6)'
                : `linear-gradient(90deg,${st.stroke},${st.stroke}90)`,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          {[
            { label: 'XP Earned', value: node.xp_earned, icon: '⚡' },
            { label: 'Rank', value: rankName, icon: '🏅' },
            { label: 'Lessons', value: node.lessons_completed, icon: '📖' },
            { label: 'Quizzes', value: node.quizzes_completed, icon: '❓' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '0.6rem', borderRadius: 8,
              background: '#0d1526', border: '1px solid #1e2535',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1rem' }}>{s.icon}</div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem' }}>{s.value}</div>
              <div style={{ color: '#64748b', fontSize: '0.65rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* XP required */}
        <div style={{ padding: '0.6rem 0.8rem', borderRadius: 8, background: '#0d1526', border: '1px solid #1e2535' }}>
          <span style={{ color: '#64748b', fontSize: '0.72rem' }}>XP Required to Unlock: </span>
          <span style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: 700 }}>{node.xp_required} XP</span>
        </div>

        {/* Activities */}
        {node.status !== 'locked' && (
          <div>
            <p style={{ margin: '0 0 0.6rem', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
              Activities
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {activities.map(a => (
                <button
                  key={a.type}
                  onClick={() => onActivity(a.type)}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.6rem 0.9rem', borderRadius: 8,
                    background: a.color + '15', border: `1px solid ${a.color}40`,
                    color: a.color, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                    transition: 'all 0.2s', textAlign: 'left', opacity: loading ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{a.icon}</span>
                  <span style={{ flex: 1 }}>{a.label}</span>
                  <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>+{a.xp} XP</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {node.status === 'locked' && (
          <div style={{
            padding: '0.8rem', borderRadius: 8, background: '#0d1526',
            border: '1px solid #2d3748', textAlign: 'center',
          }}>
            <Lock size={20} color="#4a5568" style={{ marginBottom: 6 }} />
            <p style={{ margin: 0, color: '#4a5568', fontSize: '0.78rem' }}>
              Complete {node.unlock_threshold}% of parent node to unlock
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Analytics Panel ─────────────────────────────────────────────────────
function AnalyticsPanel({ data }: { data: TreeData }) {
  const { xp, achievements } = data;
  const nodes = data.nodes;
  const mastered = nodes.filter(n => n.status === 'mastered').length;
  const inProgress = nodes.filter(n => n.status === 'in_progress').length;
  const total = nodes.length;

  const subjectNodes = nodes.filter(n => n.level === 1);
  const chartData = subjectNodes.map(n => ({
    name: n.name.slice(0, 8),
    xp: n.xp_earned,
    pct: Math.round(n.completion_pct),
  }));

  return (
    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      {/* XP Level card */}
      <div style={{
        padding: '1.2rem', borderRadius: 12,
        background: 'linear-gradient(135deg,#0d1b3e,#1a0a30)',
        border: '1px solid #7c3aed40',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 0.2rem', color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1 }}>Current Level</p>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fbbf24' }}>Lv.{xp.level}</div>
            <p style={{ margin: '0.2rem 0 0', color: '#a78bfa', fontSize: '0.8rem' }}>{xp.total_xp.toLocaleString()} Total XP</p>
          </div>
          <Zap size={32} color="#fbbf24" />
        </div>
        <div style={{ marginTop: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Progress to Lv.{xp.level + 1}</span>
            <span style={{ color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700 }}>{xp.progress_pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#1e2535', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3, width: `${xp.progress_pct}%`,
              background: 'linear-gradient(90deg,#7c3aed,#fbbf24)',
              transition: 'width 0.6s ease',
            }} />
          </div>
          <p style={{ margin: '0.3rem 0 0', color: '#64748b', fontSize: '0.68rem' }}>
            {(xp.xp_for_next - xp.total_xp).toLocaleString()} XP to next level
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.7rem' }}>
        {[
          { label: 'Mastered', value: mastered, color: '#fbbf24', icon: '⭐' },
          { label: 'In Progress', value: inProgress, color: '#7c3aed', icon: '🔄' },
          { label: 'Weekly XP', value: data.weekly_xp, color: '#00D4FF', icon: '📈' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '0.75rem 0.5rem', borderRadius: 10,
            background: '#0d1526', border: `1px solid ${s.color}30`,
            textAlign: 'center',
          }}>
            <div>{s.icon}</div>
            <div style={{ color: s.color, fontWeight: 800, fontSize: '1.2rem' }}>{s.value}</div>
            <div style={{ color: '#64748b', fontSize: '0.65rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tree completion */}
      <div style={{ padding: '0.9rem', borderRadius: 10, background: '#0d1526', border: '1px solid #1e2535' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>Skill Tree Completion</span>
          <span style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 800 }}>
            {Math.round(mastered / total * 100)}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#1e2535', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${Math.round(mastered / total * 100)}%`,
            background: 'linear-gradient(90deg,#10b981,#06b6d4)',
            transition: 'width 0.6s ease',
          }} />
        </div>
        <p style={{ margin: '0.4rem 0 0', color: '#64748b', fontSize: '0.68rem' }}>
          {mastered} / {total} nodes mastered
        </p>
      </div>

      {/* Subject XP bar chart */}
      <div style={{ padding: '0.9rem', borderRadius: 10, background: '#0d1526', border: '1px solid #1e2535' }}>
        <p style={{ margin: '0 0 0.8rem', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>
          <BarChart2 size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          Subject Progress
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0d1526', border: '1px solid #1e2535', borderRadius: 6, fontSize: '0.75rem' }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#00D4FF' }}
            />
            <Bar dataKey="pct" fill="#7c3aed" radius={[3, 3, 0, 0]} name="Completion %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Achievements */}
      <div>
        <p style={{ margin: '0 0 0.7rem', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          <Trophy size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          Achievements
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {achievements.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.6rem 0.8rem', borderRadius: 8,
              background: a.earned ? a.color + '15' : '#0d1526',
              border: `1px solid ${a.earned ? a.color + '40' : '#1e2535'}`,
              opacity: a.earned ? 1 : 0.5,
            }}>
              <span style={{ fontSize: '1.2rem' }}>{a.earned ? a.icon : '🔒'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, color: a.earned ? a.color : '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>
                  {a.name}
                </p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.68rem' }}>{a.description}</p>
              </div>
              <span style={{ color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                +{a.xp_bonus} XP
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────
export default function SkillTree() {
  const { token } = useAuth();
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('tree');
  const [actLoading, setActLoading] = useState(false);
  const [popups, setPopups] = useState<XPPopup[]>([]);
  const [popupCounter, setPopupCounter] = useState(0);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);

  // Pan/zoom state
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);
  const [animTime, setAnimTime] = useState(0);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchTree = useCallback(async () => {
    try {
      const r = await api.get<TreeData>('/skill-tree/tree', { headers });
      setTreeData(r.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  // Animation loop
  useEffect(() => {
    let frame: number;
    const tick = () => {
      setAnimTime(t => t + 0.016);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    animRef.current = frame;
    return () => cancelAnimationFrame(frame);
  }, []);

  const selectedNode = treeData?.nodes.find(n => n.id === selected) ?? null;

  const handleActivity = async (type: string) => {
    if (!selected || actLoading) return;
    setActLoading(true);
    try {
      const r = await api.post('/skill-tree/activity', { node_id: selected, activity_type: type }, { headers });
      const { xp_gained, new_achievements } = r.data;

      // Show XP popup near node
      const node = treeData!.nodes.find(n => n.id === selected)!;
      const svgRect = svgRef.current?.getBoundingClientRect();
      const px = svgRect ? svgRect.left + (node.x * zoom + pan.x) : window.innerWidth / 2;
      const py = svgRect ? svgRect.top + (node.y * zoom + pan.y) : 200;

      const id = popupCounter + 1;
      setPopupCounter(id);
      setPopups(prev => [...prev, { id, amount: xp_gained, x: px, y: py }]);
      setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 1500);

      if (new_achievements?.length) {
        setNewAchievement(new_achievements[0]);
        setTimeout(() => setNewAchievement(null), 3500);
      }

      await fetchTree();
    } catch {
      // silently fail
    } finally {
      setActLoading(false);
    }
  };

  // Pan handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-node]')) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  };
  const onPointerUp = () => { dragging.current = false; };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(2.0, z - e.deltaY * 0.001)));
  };

  if (loading) return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌳</div>
        <p style={{ color: '#00D4FF', fontWeight: 700 }}>Loading Skill Tree...</p>
      </div>
    </div>
  );

  const nodes = treeData?.nodes ?? [];
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  const edges = nodes
    .filter(n => n.parent_id !== null)
    .map(n => ({ from: nodeMap[n.parent_id!], to: n, status: n.status }))
    .filter(e => e.from && e.to);

  const xp = treeData?.xp;

  return (
    <div style={{ minHeight: '100svh', background: 'transparent', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif' }}>
      <style>{`
        @keyframes xpFloat {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-80px) scale(1.3); }
        }
        @keyframes achSlide {
          0%   { transform: translateX(120%); opacity: 0; }
          15%  { transform: translateX(0); opacity: 1; }
          85%  { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        @keyframes pulse-dot {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.9rem 1.25rem',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <BackButton />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '1.4rem' }}>🌳</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f1f5f9' }}>
              Skill Tree
            </h1>
            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>
              Communication Mastery Map
            </p>
          </div>
        </div>

        {/* XP strip */}
        {xp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Zap size={14} color="#fbbf24" />
              <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.85rem' }}>
                {xp.total_xp.toLocaleString()} XP
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.25rem 0.7rem', borderRadius: 20,
              background: 'linear-gradient(135deg,#7c3aed30,#fbbf2420)',
              border: '1px solid #7c3aed50',
            }}>
              <Star size={12} color="#fbbf24" />
              <span style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: 800 }}>
                Lv.{xp.level}
              </span>
            </div>
            <div style={{ width: 80 }}>
              <div style={{ height: 4, borderRadius: 2, background: '#1e2535', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${xp.progress_pct}%`,
                  background: 'linear-gradient(90deg,#7c3aed,#fbbf24)',
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Tab buttons */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['tree', 'analytics', 'achievements'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '0.35rem 0.75rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
              border: '1px solid',
              borderColor: tab === t ? '#00D4FF' : '#1e2535',
              background: tab === t ? '#00D4FF20' : 'transparent',
              color: tab === t ? '#00D4FF' : '#64748b',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}>
              {t === 'tree' && <><Target size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />{t}</>}
              {t === 'analytics' && <><TrendingUp size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />{t}</>}
              {t === 'achievements' && <><Trophy size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />{t}</>}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      {tab === 'tree' && (
        <div style={{
          display: 'flex', gap: '1rem', padding: '0.5rem 1.25rem',
          background: '#0a0f1e', borderBottom: '1px solid #1e2535',
          flexWrap: 'wrap',
        }}>
          {[
            { status: 'locked', label: 'Locked', color: '#2d3748' },
            { status: 'available', label: 'Available', color: '#00D4FF' },
            { status: 'in_progress', label: 'In Progress', color: '#7c3aed' },
            { status: 'mastered', label: 'Mastered', color: '#f59e0b' },
          ].map(l => (
            <div key={l.status} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: l.color, boxShadow: `0 0 6px ${l.color}`,
              }} />
              <span style={{ color: '#64748b', fontSize: '0.68rem' }}>{l.label}</span>
            </div>
          ))}
          <span style={{ color: '#1e2535', margin: '0 0.5rem' }}>|</span>
          <span style={{ color: '#4a5568', fontSize: '0.68rem' }}>Drag to pan · Scroll to zoom</span>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {tab === 'tree' && (
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{ flex: 1, cursor: dragging.current ? 'grabbing' : 'grab', display: 'block' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Edges first */}
              {edges.map(e => (
                <Connector key={`${e.from.id}-${e.to.id}`} from={e.from} to={e.to} status={e.status} />
              ))}
              {/* Nodes */}
              {nodes.map(node => (
                <g key={node.id} data-node="1">
                  <NodeCircle
                    node={node}
                    selected={selected === node.id}
                    onClick={() => setSelected(selected === node.id ? null : node.id)}
                    animTime={animTime}
                  />
                </g>
              ))}
            </g>
          </svg>
        )}

        {tab === 'analytics' && treeData && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <AnalyticsPanel data={treeData} />
          </div>
        )}

        {tab === 'achievements' && treeData && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '0.9rem' }}>
              {treeData.achievements.map(a => (
                <div key={a.id} style={{
                  padding: '1.2rem', borderRadius: 12,
                  background: a.earned
                    ? `linear-gradient(145deg,${a.color}15,${a.color}06)`
                    : '#0d1526',
                  border: `1px solid ${a.earned ? a.color + '50' : '#1e2535'}`,
                  boxShadow: a.earned ? `0 0 20px ${a.color}20` : 'none',
                  opacity: a.earned ? 1 : 0.55,
                  transition: 'all 0.3s',
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}>
                    {a.earned ? a.icon : '🔒'}
                  </div>
                  <h3 style={{ margin: '0 0 0.3rem', color: a.earned ? a.color : '#4a5568', fontSize: '0.9rem', fontWeight: 800 }}>
                    {a.name}
                  </h3>
                  <p style={{ margin: '0 0 0.6rem', color: '#64748b', fontSize: '0.73rem' }}>
                    {a.description}
                  </p>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.2rem 0.6rem', borderRadius: 20,
                    background: '#fbbf2415', border: '1px solid #fbbf2430',
                    color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    <Zap size={10} /> +{a.xp_bonus} XP Bonus
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Node detail panel */}
        {selectedNode && tab === 'tree' && (
          <NodePanel
            node={selectedNode}
            onClose={() => setSelected(null)}
            onActivity={handleActivity}
            loading={actLoading}
          />
        )}
      </div>

      {/* Zoom controls */}
      {tab === 'tree' && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: selectedNode ? 360 : '1.5rem',
          display: 'flex', flexDirection: 'column', gap: '0.4rem', zIndex: 100,
          transition: 'right 0.3s',
        }}>
          {[
            { label: '+', fn: () => setZoom(z => Math.min(2.0, z + 0.1)) },
            { label: '⊡', fn: () => { setZoom(0.85); setPan({ x: 60, y: 40 }); } },
            { label: '−', fn: () => setZoom(z => Math.max(0.3, z - 0.1)) },
          ].map(b => (
            <button key={b.label} onClick={b.fn} style={{
              width: 36, height: 36, borderRadius: 8,
              background: '#0d1526', border: '1px solid #1e2535',
              color: '#94a3b8', cursor: 'pointer', fontSize: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700,
            }}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {/* XP floating popups */}
      <XPPopupOverlay popups={popups} />

      {/* New achievement toast */}
      {newAchievement && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg,#0d1b3e,#1a0a30)',
          border: `2px solid ${newAchievement.color}`,
          borderRadius: 12, padding: '0.8rem 1.4rem',
          display: 'flex', alignItems: 'center', gap: '0.8rem',
          boxShadow: `0 0 30px ${newAchievement.color}40`,
          animation: 'achSlide 3.5s ease forwards',
          zIndex: 9998,
        }}>
          <span style={{ fontSize: '1.6rem' }}>{newAchievement.icon}</span>
          <div>
            <p style={{ margin: 0, color: newAchievement.color, fontWeight: 800, fontSize: '0.9rem' }}>
              Achievement Unlocked!
            </p>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.78rem' }}>{newAchievement.name}</p>
          </div>
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.8rem' }}>
            +{newAchievement.xp_bonus} XP
          </span>
        </div>
      )}
    </div>
  );
}
