import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flame, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getLevelColor, getLevelGradient, LEVEL_NAMES } from '../utils/gamification';

// ── Types ──────────────────────────────────────────────────────────────────
interface BattleProgress { value: number; target: number; progress_pct: number }
interface BattleUser { id: number; name: string; is_me: boolean }

interface Battle {
  id: number;
  battle_type: 'quiz' | 'study_hours' | 'streak';
  target_value: number;
  duration: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  invite_code: string;
  is_random: boolean;
  created_at: string;
  expires_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  challenger: BattleUser | null;
  opponent: BattleUser | null;
  winner: BattleUser | null;
  challenger_progress: BattleProgress;
  opponent_progress: BattleProgress | null;
  is_challenger: boolean;
  matched?: boolean;
}

interface LBEntry {
  rank: number;
  user_id: number;
  username: string;
  xp: number;
  level: number;
  level_name: string;
  streak_days: number;
  study_hours: number;
  is_current_user: boolean;
}

type Tab = 'battles' | 'leaderboard';
type LBPeriod = 'weekly' | 'monthly' | 'all_time';
type BattleType = 'quiz' | 'study_hours' | 'streak';
type Duration = '24hr' | '48hr' | '1week';

// ── Config ─────────────────────────────────────────────────────────────────
const TYPE_INFO: Record<BattleType, { icon: string; label: string; unit: string; desc: string; placeholder: string }> = {
  study_hours: { icon: '', label: 'Study Hours', unit: 'h', desc: 'Most study hours logged wins', placeholder: '10' },
  quiz:        { icon: '', label: 'Quiz Score',  unit: '%', desc: 'Highest average quiz score wins', placeholder: '80' },
  streak:      { icon: '', label: 'Streak',      unit: ' days', desc: 'Longest study streak wins', placeholder: '7' },
};

const DUR_INFO: Record<string, { label: string }> = {
  '24hr':  { label: '24 Hours' },
  '48hr':  { label: '48 Hours' },
  '1week': { label: '1 Week' },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtVal(type: BattleType, v: number): string {
  if (type === 'quiz') return `${v.toFixed(1)}%`;
  if (type === 'study_hours') return `${v.toFixed(1)}h`;
  return `${Math.round(v)}d`;
}

function timeLeft(iso: string | null): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); } catch {}
}

// ── BattleCard ─────────────────────────────────────────────────────────────
function BattleCard({ battle, onRefresh }: { battle: Battle; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false);
  const info = TYPE_INFO[battle.battle_type];

  const isActive    = battle.status === 'active';
  const isPending   = battle.status === 'pending';
  const isCompleted = battle.status === 'completed';

  const accentCol = isActive ? '#f97316' : isPending ? '#eab308' : isCompleted ? '#10b981' : '#6b7280';

  const me   = battle.is_challenger ? battle.challenger : battle.opponent;
  const them = battle.is_challenger ? battle.opponent   : battle.challenger;
  const myProg   = battle.is_challenger ? battle.challenger_progress : battle.opponent_progress;
  const theirProg = battle.is_challenger ? battle.opponent_progress  : battle.challenger_progress;

  const inviteLink = `${window.location.origin}/battles?join=${battle.invite_code}`;

  const handleCopy = async (text: string) => {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: `linear-gradient(145deg, ${accentCol}10, transparent)`,
      border: `1px solid ${accentCol}35`,
      borderRadius: '16px', padding: '1.25rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.4rem' }}>{info.icon}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-h)', fontSize: '0.92rem' }}>
              {info.label} Battle
            </p>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text)', marginTop: '0.1rem' }}>
              Target: {fmtVal(battle.battle_type, battle.target_value)} · {DUR_INFO[battle.duration]?.label ?? battle.duration}
            </p>
          </div>
        </div>
        <span style={{
          fontSize: '0.66rem', fontWeight: 700, padding: '0.2rem 0.55rem',
          borderRadius: '99px', color: accentCol,
          background: accentCol + '20', border: `1px solid ${accentCol}40`,
          textTransform: 'uppercase' as const, letterSpacing: '0.05em',
        }}>
          {battle.is_random && isPending ? 'Random · Waiting' : battle.status}
        </span>
      </div>

      {/* Progress bars for active / completed */}
      {(isActive || isCompleted) && myProg && (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem', marginBottom: '0.85rem' }}>
          {([
            { label: (me?.name ?? 'You') + ' (You)', prog: myProg,    isMe: true  },
            { label: them?.name ?? 'Waiting…',        prog: theirProg, isMe: false },
          ] as { label: string; prog: BattleProgress | null; isMe: boolean }[]).map(({ label, prog, isMe }) => (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.28rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: isMe ? 700 : 500, color: isMe ? '#f97316' : 'var(--text)' }}>
                  {label}
                </span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-h)' }}>
                  {prog ? `${fmtVal(battle.battle_type, prog.value)} / ${fmtVal(battle.battle_type, prog.target)}` : '—'}
                </span>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${prog?.progress_pct ?? 0}%`,
                  background: isMe ? 'linear-gradient(90deg,#f97316,#ef4444)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                  borderRadius: '99px', transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Winner banner */}
      {isCompleted && (
        <div style={{
          padding: '0.5rem 0.75rem', borderRadius: '10px', marginBottom: '0.75rem',
          background: battle.winner?.is_me ? 'rgba(16,185,129,0.12)' : battle.winner ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
          border: `1px solid ${battle.winner?.is_me ? 'rgba(16,185,129,0.3)' : battle.winner ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
          color: battle.winner?.is_me ? '#10b981' : battle.winner ? '#ef4444' : '#818cf8',
          fontSize: '0.82rem', fontWeight: 700, textAlign: 'center' as const,
        }}>
          {battle.winner?.is_me ? 'You Won!' : battle.winner ? `${battle.winner.name} Won` : "It's a Tie!"}
        </div>
      )}

      {/* Time remaining */}
      {isActive && battle.expires_at && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.76rem', color: '#f97316', fontWeight: 600, textAlign: 'center' as const }}>
          <Clock size={13} style={{marginRight:'0.3rem',verticalAlign:'middle'}}/>{timeLeft(battle.expires_at)}
        </p>
      )}

      {/* Invite section for pending */}
      {isPending && (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
          <div style={{
            background: 'var(--border)', borderRadius: '10px',
            padding: '0.65rem 0.85rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text)', marginBottom: '0.15rem' }}>Invite Code</p>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-h)', letterSpacing: '0.18em', fontFamily: 'monospace' }}>
                {battle.invite_code}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                onClick={() => handleCopy(battle.invite_code)}
                style={{ ...btn.sm, background: copied ? '#10b981' : 'linear-gradient(135deg,#f97316,#ef4444)' }}
              >
                {copied ? ' Copied' : 'Copy Code'}
              </button>
            </div>
          </div>
          <button
            onClick={() => handleCopy(inviteLink)}
            style={{ ...btn.ghost, fontSize: '0.72rem', padding: '0.35rem 0.75rem' }}
          >
             Copy Invite Link
          </button>
        </div>
      )}
    </div>
  );
}

// ── LeaderboardRow ─────────────────────────────────────────────────────────
function LBRow({ entry }: { entry: LBEntry }) {
  const medals: Record<number, string> = { 1: '', 2: '', 3: '' };
  const lvColor = getLevelColor(entry.level);
  const maxXP = 3800;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.85rem',
      padding: '0.75rem 0.85rem',
      borderRadius: '12px',
      background: entry.is_current_user ? 'linear-gradient(90deg, rgba(249,115,22,0.08), rgba(239,68,68,0.05))' : 'transparent',
      border: entry.is_current_user ? '1px solid rgba(249,115,22,0.25)' : '1px solid transparent',
      transition: 'background 0.2s',
    }}>
      {/* Rank */}
      <div style={{ width: '32px', textAlign: 'center' as const, flexShrink: 0 }}>
        {medals[entry.rank] ? (
          <span style={{ fontSize: '1.3rem' }}>{medals[entry.rank]}</span>
        ) : (
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>#{entry.rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${lvColor}40, ${lvColor}20)`,
        border: `2px solid ${lvColor}60`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.72rem', fontWeight: 800, color: lvColor,
      }}>
        {initials(entry.username)}
      </div>

      {/* Name + level */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: entry.is_current_user ? 800 : 600, color: entry.is_current_user ? '#f97316' : 'var(--text-h)', fontSize: '0.87rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.username}{entry.is_current_user ? ' (You)' : ''}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: lvColor, padding: '0.05rem 0.35rem', background: lvColor + '18', border: `1px solid ${lvColor}30`, borderRadius: '99px' }}>
            Lv.{entry.level} {entry.level_name}
          </span>
        </div>
      </div>

      {/* XP bar */}
      <div style={{ width: '80px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--text)', fontWeight: 600 }}>
            {entry.xp.toLocaleString()} XP
          </span>
        </div>
        <div style={{ height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.min(100, Math.round((entry.xp / maxXP) * 100))}%`,
            background: getLevelGradient(entry.level), borderRadius: '99px',
          }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '0.85rem', flexShrink: 0 }}>
        <div style={{ textAlign: 'center' as const }}>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#f97316', display: 'flex', alignItems: 'center', gap: '0.15rem' }}><Flame size={12} />{entry.streak_days}</p>
          <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--text)' }}>streak</p>
        </div>
        <div style={{ textAlign: 'center' as const }}>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#6366f1' }}>{entry.study_hours}h</p>
          <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--text)' }}>studied</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Battles() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>('battles');
  const [battles, setBattles] = useState<Battle[]>([]);
  const [lbEntries, setLbEntries] = useState<LBEntry[]>([]);
  const [lbPeriod, setLbPeriod] = useState<LBPeriod>('weekly');
  const [battlesLoading, setBattlesLoading] = useState(true);
  const [lbLoading, setLbLoading] = useState(false);

  // Create battle form
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<BattleType>('study_hours');
  const [createTarget, setCreateTarget] = useState('10');
  const [createDuration, setCreateDuration] = useState<Duration>('48hr');
  const [creating, setCreating] = useState(false);
  const [newBattle, setNewBattle] = useState<Battle | null>(null);

  // Join form
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Random
  const [randoming, setRandoming] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Check for ?join= param in URL
  useEffect(() => {
    const joinParam = searchParams.get('join');
    if (joinParam) {
      setJoinCode(joinParam.toUpperCase());
      setShowJoin(true);
      setShowCreate(false);
    }
  }, [searchParams]);

  const loadBattles = useCallback(async () => {
    setBattlesLoading(true);
    try {
      const { data } = await api.get<Battle[]>('/battles/my-battles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBattles(data);
    } catch {
      setError('Failed to load battles');
    } finally {
      setBattlesLoading(false);
    }
  }, [token]);

  const loadLeaderboard = useCallback(async (period: LBPeriod) => {
    setLbLoading(true);
    try {
      const { data } = await api.get<{ entries: LBEntry[] }>(`/battles/leaderboard?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLbEntries(data.entries);
    } catch {
      setError('Failed to load leaderboard');
    } finally {
      setLbLoading(false);
    }
  }, [token]);

  useEffect(() => { loadBattles(); }, [loadBattles]);
  useEffect(() => {
    if (tab === 'leaderboard') loadLeaderboard(lbPeriod);
  }, [tab, lbPeriod, loadLeaderboard]);

  const handleCreate = async () => {
    const targetNum = parseFloat(createTarget);
    if (!targetNum || targetNum <= 0) { setError('Enter a valid target value'); return; }
    setCreating(true);
    setError('');
    try {
      const { data } = await api.post<Battle>('/battles/create', {
        battle_type: createType,
        target_value: targetNum,
        duration: createDuration,
        is_random: false,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setNewBattle(data);
      setShowCreate(false);
      setSuccessMsg('Battle created! Share your invite code.');
      await loadBattles();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to create battle');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { setError('Enter an invite code'); return; }
    setJoining(true);
    setError('');
    try {
      await api.post('/battles/join', { invite_code: joinCode.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowJoin(false);
      setJoinCode('');
      setSuccessMsg('You joined the battle! Fight hard!');
      await loadBattles();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to join battle');
    } finally {
      setJoining(false);
    }
  };

  const handleRandom = async () => {
    setRandoming(true);
    setError('');
    try {
      const { data } = await api.post<Battle & { matched: boolean }>('/battles/random', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.matched) {
        setSuccessMsg('Matched! A random battle is now active!');
      } else {
        setSuccessMsg('Queued for random match! Waiting for an opponent…');
      }
      await loadBattles();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to start random match');
    } finally {
      setRandoming(false);
    }
  };

  const active    = battles.filter(b => b.status === 'active');
  const pending   = battles.filter(b => b.status === 'pending');
  const completed = battles.filter(b => b.status === 'completed').slice(0, 5);

  return (
    <div style={s.shell}>

      {/* Hero */}
      <div style={s.hero}>
        <div style={s.heroOrb} />
        <span style={s.heroIcon}></span>
        <h1 style={s.heroTitle}>Study Battles</h1>
        <p style={s.heroSub}>Challenge peers, track progress, climb the leaderboard</p>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {(['battles', 'leaderboard'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); }}
            style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}
          >
            {t === 'battles' ? ' My Battles' : ' Leaderboard'}
          </button>
        ))}
      </div>

      <main style={s.main}>
        {/* Flash messages */}
        {error && (
          <div style={s.errorBanner} onClick={() => setError('')}>{error} </div>
        )}
        {successMsg && (
          <div style={s.successBanner}>{successMsg}</div>
        )}

        {/* ── BATTLES TAB ── */}
        {tab === 'battles' && (
          <>
            {/* Action row */}
            <div style={s.actionRow}>
              <button
                onClick={() => { setShowCreate(v => !v); setShowJoin(false); setNewBattle(null); }}
                style={{ ...btn.primary, ...(showCreate ? { opacity: 0.8 } : {}) }}
              >
                {showCreate ? ' Cancel' : '+ Create Battle'}
              </button>
              <button
                onClick={() => { setShowJoin(v => !v); setShowCreate(false); setNewBattle(null); }}
                style={{ ...btn.secondary, ...(showJoin ? { opacity: 0.8 } : {}) }}
              >
                {showJoin ? ' Cancel' : ' Join by Code'}
              </button>
              <button
                onClick={handleRandom}
                disabled={randoming}
                style={{ ...btn.ghost, opacity: randoming ? 0.6 : 1 }}
              >
                {randoming ? 'Searching…' : ' Random Match'}
              </button>
            </div>

            {/* Create Battle Panel */}
            {showCreate && (
              <div style={s.panel}>
                <h3 style={s.panelTitle}> Create a Battle</h3>

                <p style={s.fieldLabel}>Battle Type</p>
                <div style={s.typeGrid}>
                  {(Object.entries(TYPE_INFO) as [BattleType, typeof TYPE_INFO['quiz']][]).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setCreateType(k)}
                      style={{ ...s.typeBtn, ...(createType === k ? s.typeBtnActive : {}) }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>{v.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{v.label}</span>
                      <span style={{ fontSize: '0.67rem', color: 'var(--text)', marginTop: '0.1rem' }}>{v.desc}</span>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const, marginTop: '1rem' }}>
                  <label style={s.fieldWrap}>
                    <span style={s.fieldLabel}>Target ({TYPE_INFO[createType].unit})</span>
                    <input
                      type="number"
                      value={createTarget}
                      onChange={e => setCreateTarget(e.target.value)}
                      placeholder={TYPE_INFO[createType].placeholder}
                      min={0.1}
                      step={0.5}
                      style={s.input}
                    />
                  </label>

                  <label style={s.fieldWrap}>
                    <span style={s.fieldLabel}>Duration</span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {(['24hr', '48hr', '1week'] as Duration[]).map(d => (
                        <button
                          key={d}
                          onClick={() => setCreateDuration(d)}
                          style={{ ...s.durBtn, ...(createDuration === d ? s.durBtnActive : {}) }}
                        >
                          {DUR_INFO[d].label}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={creating}
                  style={{ ...btn.primary, marginTop: '1rem', opacity: creating ? 0.6 : 1 }}
                >
                  {creating ? 'Creating…' : ' Create Battle'}
                </button>
              </div>
            )}

            {/* New battle invite (shown right after creation) */}
            {newBattle && newBattle.status === 'pending' && (
              <div style={{ ...s.panel, border: '1px solid rgba(249,115,22,0.4)', background: 'rgba(249,115,22,0.06)' }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#f97316', fontSize: '0.9rem' }}>
                   Battle created! Share this code:
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-h)', letterSpacing: '0.2em' }}>
                    {newBattle.invite_code}
                  </span>
                  <button
                    onClick={() => copyText(newBattle.invite_code)}
                    style={{ ...btn.sm, background: 'linear-gradient(135deg,#f97316,#ef4444)' }}
                  >
                    Copy Code
                  </button>
                  <button
                    onClick={() => copyText(`${window.location.origin}/battles?join=${newBattle.invite_code}`)}
                    style={btn.ghost}
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            )}

            {/* Join Battle Panel */}
            {showJoin && (
              <div style={s.panel}>
                <h3 style={s.panelTitle}> Join a Battle</h3>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' as const }}>
                  <label style={s.fieldWrap}>
                    <span style={s.fieldLabel}>Invite Code</span>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="e.g. ABCD1234"
                      maxLength={8}
                      style={{ ...s.input, letterSpacing: '0.15em', fontFamily: 'monospace', textTransform: 'uppercase' as const }}
                    />
                  </label>
                  <button
                    onClick={handleJoin}
                    disabled={joining || !joinCode.trim()}
                    style={{ ...btn.primary, opacity: joining || !joinCode.trim() ? 0.6 : 1 }}
                  >
                    {joining ? 'Joining…' : ' Join Battle'}
                  </button>
                </div>
              </div>
            )}

            {/* Battle sections */}
            {battlesLoading ? (
              <div style={s.emptyState}>
                <p style={{ color: 'var(--text)', fontSize: '0.85rem' }}>Loading battles…</p>
              </div>
            ) : (
              <>
                {/* Active */}
                {active.length > 0 && (
                  <section>
                    <h2 style={s.sectionHead}> Active Battles</h2>
                    <div style={s.cardGrid}>
                      {active.map(b => <BattleCard key={b.id} battle={b} onRefresh={loadBattles} />)}
                    </div>
                  </section>
                )}

                {/* Pending */}
                {pending.length > 0 && (
                  <section>
                    <h2 style={s.sectionHead}>Waiting for Opponent</h2>
                    <div style={s.cardGrid}>
                      {pending.map(b => <BattleCard key={b.id} battle={b} onRefresh={loadBattles} />)}
                    </div>
                  </section>
                )}

                {/* Completed */}
                {completed.length > 0 && (
                  <section>
                    <h2 style={s.sectionHead}> Recent Results</h2>
                    <div style={s.cardGrid}>
                      {completed.map(b => <BattleCard key={b.id} battle={b} onRefresh={loadBattles} />)}
                    </div>
                  </section>
                )}

                {battles.length === 0 && (
                  <div style={s.emptyState}>
                    <p style={s.emptyIcon}></p>
                    <p style={s.emptyTitle}>No battles yet</p>
                    <p style={s.emptySub}>Create a battle or join one using an invite code to get started.</p>
                    <button onClick={() => setShowCreate(true)} style={btn.primary}>
                      + Create Your First Battle
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── LEADERBOARD TAB ── */}
        {tab === 'leaderboard' && (
          <>
            {/* Period selector */}
            <div style={s.periodRow}>
              {(['weekly', 'monthly', 'all_time'] as LBPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setLbPeriod(p)}
                  style={{ ...s.periodBtn, ...(lbPeriod === p ? s.periodBtnActive : {}) }}
                >
                  {p === 'weekly' ? ' Weekly' : p === 'monthly' ? ' Monthly' : ' All-Time'}
                </button>
              ))}
            </div>

            {lbLoading ? (
              <div style={s.emptyState}>
                <p style={{ color: 'var(--text)', fontSize: '0.85rem' }}>Loading leaderboard…</p>
              </div>
            ) : lbEntries.length === 0 ? (
              <div style={s.emptyState}>
                <p style={s.emptyIcon}></p>
                <p style={s.emptyTitle}>No data yet</p>
                <p style={s.emptySub}>Start logging study hours and completing quizzes to appear here.</p>
              </div>
            ) : (
              <div style={s.panel}>
                {/* Legend */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', marginBottom: '0.5rem', paddingRight: '0.85rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text)', fontWeight: 600 }}>XP</span>
                  <span style={{ fontSize: '0.65rem', color: '#f97316', fontWeight: 600 }}>Streak</span>
                  <span style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 600 }}>Hours</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' }}>
                  {lbEntries.map(e => <LBRow key={e.user_id} entry={e} />)}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── Button helpers ─────────────────────────────────────────────────────────
const btn: Record<string, React.CSSProperties> = {
  primary: {
    padding: '0.55rem 1.2rem',
    background: 'linear-gradient(135deg,#ef4444,#f97316)',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'opacity 0.2s',
  },
  secondary: {
    padding: '0.55rem 1.2rem',
    background: 'var(--border)', color: 'var(--text-h)',
    border: '1px solid var(--border)', borderRadius: '10px',
    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ghost: {
    padding: '0.5rem 0.9rem',
    background: 'transparent', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: '10px',
    fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sm: {
    padding: '0.3rem 0.75rem',
    background: 'linear-gradient(135deg,#f97316,#ef4444)',
    color: '#fff', border: 'none', borderRadius: '7px',
    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

// ── Styles ─────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },

  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.75rem', height: '60px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 50,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.45rem' },
  navLogo: { fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-h)', letterSpacing: '-0.3px', textDecoration: 'none' },

  hero: {
    position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(145deg, rgba(239,68,68,0.1), rgba(249,115,22,0.06), var(--bg))',
    borderBottom: '1px solid rgba(239,68,68,0.15)',
    padding: '2.5rem 2rem 2rem',
    textAlign: 'center' as const,
  },
  heroOrb: {
    position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 65%)',
    top: '-200px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' as const,
  },
  heroIcon: { fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' },
  heroTitle: { margin: '0 0 0.4rem', fontSize: '2rem', fontWeight: 900, color: 'var(--text-h)', background: 'linear-gradient(135deg,#ef4444,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  heroSub: { margin: 0, color: 'var(--text)', fontSize: '0.88rem' },

  tabBar: {
    display: 'flex', gap: '0.25rem', padding: '0.75rem 2rem 0',
    borderBottom: '1px solid var(--border)', background: 'var(--bg)',
    position: 'sticky', top: '60px', zIndex: 40,
  },
  tabBtn: {
    padding: '0.55rem 1.25rem', borderRadius: '10px 10px 0 0',
    background: 'transparent', border: 'none', color: 'var(--text)',
    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  tabBtnActive: {
    background: 'var(--border)', color: 'var(--text-h)',
    borderBottom: '2px solid #f97316',
  },

  main: {
    flex: 1, padding: '1.75rem 2rem 3rem',
    maxWidth: '900px', width: '100%', margin: '0 auto',
    boxSizing: 'border-box' as const,
    display: 'flex', flexDirection: 'column' as const, gap: '1.25rem',
  },

  actionRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const },

  panel: {
    background: 'var(--bg-surface, var(--border))',
    border: '1px solid var(--border)',
    borderRadius: '16px', padding: '1.25rem',
  },
  panelTitle: { margin: '0 0 1rem', fontWeight: 800, fontSize: '1rem', color: 'var(--text-h)' },

  sectionHead: { margin: '0 0 0.75rem', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' },
  cardGrid: { display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' },

  typeGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.65rem',
  },
  typeBtn: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    gap: '0.25rem', padding: '0.85rem 0.5rem',
    background: 'transparent', border: '1.5px solid var(--border)',
    borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
    color: 'var(--text)', transition: 'all 0.2s',
  },
  typeBtnActive: {
    borderColor: '#f97316', background: 'rgba(249,115,22,0.1)', color: '#f97316',
    boxShadow: '0 0 12px rgba(249,115,22,0.2)',
  },

  durBtn: {
    padding: '0.38rem 0.75rem',
    background: 'transparent', border: '1.5px solid var(--border)',
    borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', transition: 'all 0.2s',
  },
  durBtnActive: {
    borderColor: '#f97316', background: 'rgba(249,115,22,0.1)', color: '#f97316',
  },

  fieldWrap: { display: 'flex', flexDirection: 'column' as const, gap: '0.35rem' },
  fieldLabel: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', margin: 0 },
  input: {
    padding: '0.5rem 0.75rem',
    background: 'var(--bg)', border: '1.5px solid var(--border)',
    borderRadius: '9px', color: 'var(--text-h)',
    fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
    width: '130px',
  },

  periodRow: { display: 'flex', gap: '0.5rem' },
  periodBtn: {
    padding: '0.45rem 1rem', borderRadius: '99px',
    background: 'transparent', border: '1.5px solid var(--border)',
    color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
  },
  periodBtnActive: {
    background: 'linear-gradient(135deg,#ef4444,#f97316)',
    borderColor: 'transparent', color: '#fff',
  },

  emptyState: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    gap: '0.5rem', padding: '3rem 1rem', textAlign: 'center' as const,
  },
  emptyIcon: { fontSize: '2.5rem', margin: 0 },
  emptyTitle: { margin: 0, fontWeight: 700, color: 'var(--text-h)', fontSize: '1rem' },
  emptySub: { margin: 0, color: 'var(--text)', fontSize: '0.82rem', maxWidth: '320px' },

  errorBanner: {
    padding: '0.7rem 1rem', borderRadius: '10px',
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#ef4444', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
  },
  successBanner: {
    padding: '0.7rem 1rem', borderRadius: '10px',
    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
    color: '#10b981', fontSize: '0.82rem', fontWeight: 600,
  },
};
