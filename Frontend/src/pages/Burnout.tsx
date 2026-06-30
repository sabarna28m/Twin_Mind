import { useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────

interface BurnoutEntry {
  id: number;
  date: string;
  study_hours: number;
  sleep_hours: number;
  breaks_taken: number;
  study_streak_days: number;
  mood_rating: number;
  energy_level: number;
  burnout_score: number;
  risk_level: string;
  created_at: string;
}

interface BurnoutAnalysis {
  entry: BurnoutEntry;
  recommendations: string[];
  twin_message: string;
  alerts: string[];
}

interface TrendPoint {
  date: string;
  burnout_score: number;
  risk_level: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

function riskColor(risk: string) {
  if (risk === 'high')   return '#ef4444';
  if (risk === 'medium') return '#f59e0b';
  return '#10b981';
}

function riskLabel(risk: string) {
  if (risk === 'high')   return 'High Risk';
  if (risk === 'medium') return 'Medium Risk';
  return 'Low Risk';
}

function riskEmoji(risk: string) {
  if (risk === 'high')   return '🔴';
  if (risk === 'medium') return '🟡';
  return '🟢';
}

function calcBurnout(
  studyH: number, sleepH: number, breaks: number,
  streak: number, mood: number, energy: number,
): { score: number; risk: string } {
  let score = 0;
  if (studyH > 8)   score += 20;
  if (sleepH < 6)   score += 25;
  if (breaks < 2)   score += 15;
  if (mood <= 2)    score += 15;
  if (energy <= 2)  score += 15;
  if (streak > 10)  score += 10;
  score = Math.min(100, score);
  const risk = score < 40 ? 'low' : score < 70 ? 'medium' : 'high';
  return { score, risk };
}

function getRecommendations(
  studyH: number, sleepH: number, breaks: number,
  mood: number, energy: number, streak: number,
): { icon: string; title: string; text: string }[] {
  const recs: { icon: string; title: string; text: string }[] = [];
  if (studyH > 8 && sleepH < 6) {
    recs.push({ icon: '😴', title: 'Sleep & Study Balance', text: `Reduce study time by 1–2 hours and aim for at least 7 hours of sleep tonight. Sleep debt compounds quickly.` });
  } else if (studyH > 8) {
    recs.push({ icon: '📚', title: 'Study Load', text: `${studyH.toFixed(0)}h of study is intensive. Cap tomorrow's session at 6–7h for sustainable learning.` });
  } else if (sleepH < 6) {
    recs.push({ icon: '😴', title: 'Sleep Deficit', text: `Only ${sleepH.toFixed(0)}h of sleep reduces memory consolidation. Prioritise 7–8 hours tonight.` });
  }
  if (breaks < 2) {
    recs.push({ icon: '☕', title: 'Take More Breaks', text: 'Use the Pomodoro technique: 25 min focused work, 5 min break. A 15-min break every 90 minutes keeps you sharp.' });
  }
  if (mood <= 2) {
    recs.push({ icon: '💛', title: 'Mood Support', text: 'Shift to lighter revision tasks today — re-reading notes rather than tackling new material. Gentle progress counts.' });
  }
  if (energy <= 2) {
    recs.push({ icon: '⚡', title: 'Energy Recovery', text: 'A 20-minute walk or light stretching restores mental clarity better than caffeine. Try it before your next session.' });
  }
  if (streak > 10) {
    recs.push({ icon: '🗓', title: 'Rest Day Needed', text: `${streak} consecutive study days is impressive. Schedule one planned rest day this week — recovery accelerates retention.` });
  }
  if (recs.length === 0) {
    recs.push({ icon: '✅', title: 'Great Balance', text: 'Your metrics look healthy. Consistent, sustainable effort compounds over time. Keep your current routine.' });
    recs.push({ icon: '💧', title: 'Stay Hydrated', text: 'Stay hydrated and take short movement breaks to sustain energy and focus throughout your sessions.' });
  }
  return recs;
}

const MOOD_EMOJIS = ['😔', '😕', '😐', '😊', '😄'];
const ENERGY_ICONS = ['🪫', '🔋', '⚡', '⚡⚡', '🚀'];

// ── Circular Progress SVG ──────────────────────────────────────────────

function CircularMeter({ score, risk, isDark }: { score: number; risk: string; isDark: boolean }) {
  const R = 70;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - score / 100);
  const color = riskColor(risk);
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" style={{ display: 'block', margin: '0 auto' }}>
      {/* Track */}
      <circle cx="90" cy="90" r={R} fill="none" stroke={isDark ? "rgba(255,255,255,0.07)" : "#E5E7EB"} strokeWidth="12" />
      {/* Progress arc */}
      <circle
        cx="90" cy="90" r={R}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform="rotate(-90 90 90)"
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1), stroke 0.5s' }}
      />
      {/* Glow filter */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Score text */}
      <text x="90" y="82" textAnchor="middle" fill={color} fontSize="48" fontWeight="800" fontFamily="inherit">
        {score}
      </text>
      <text x="90" y="102" textAnchor="middle" fill={isDark ? "rgba(255,255,255,0.5)" : "#6B7280"} fontSize="11" fontFamily="inherit">
        / 100
      </text>
      <text x="90" y="120" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="inherit">
        {riskLabel(risk).toUpperCase()}
      </text>
    </svg>
  );
}

// ── Custom Recharts Tooltip ────────────────────────────────────────────

function BurnoutTooltip({ active, payload, label, isDark }: {
  active?: boolean; payload?: { value: number; payload: TrendPoint }[]; label?: string; isDark?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const { burnout_score, risk_level } = payload[0].payload;
  return (
    <div style={{
      background: isDark ? 'rgba(15,23,42,0.95)' : '#FFFFFF', border: `1px solid ${riskColor(risk_level)}40`,
      borderRadius: '10px', padding: '0.65rem 0.9rem',
      boxShadow: isDark ? `0 8px 24px rgba(0,0,0,0.4)` : `0 4px 20px rgba(0,0,0,0.05)`,
    }}>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: riskColor(risk_level) }}>
        {burnout_score} <span style={{ fontSize: '0.72rem', fontWeight: 400 }}>/ 100</span>
      </p>
      <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: riskColor(risk_level) }}>
        {riskEmoji(risk_level)} {riskLabel(risk_level)}
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function Burnout() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const p = getStyles(isDark);

  // Form state
  const [studyH, setStudyH]     = useState(6);
  const [sleepH, setSleepH]     = useState(7);
  const [breaks, setBreaks]     = useState(2);
  const [streak, setStreak]     = useState(0);
  const [mood, setMood]         = useState(3);
  const [energy, setEnergy]     = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr]   = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Analysis state
  const [analysis, setAnalysis]   = useState<BurnoutAnalysis | null>(null);
  const [latest, setLatest]       = useState<BurnoutEntry | null>(null);
  const [trend, setTrend]         = useState<TrendPoint[]>([]);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [notifications, setNotifications]   = useState<{ id: number; icon: string; text: string }[]>([]);
  const [loading, setLoading]     = useState(true);

  // Live preview
  const preview = calcBurnout(studyH, sleepH, breaks, streak, mood, energy);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [latestRes, trendRes] = await Promise.all([
          api.get('/burnout/latest').catch(() => ({ data: null })),
          api.get(`/burnout/trend?days=${trendDays}`).catch(() => ({ data: [] })),
        ]);
        setLatest(latestRes.data);
        setTrend(trendRes.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, trendDays]);

  // Build notifications from latest entry
  useEffect(() => {
    if (!latest) return;
    const notes: { id: number; icon: string; text: string }[] = [];
    if (latest.risk_level === 'high') {
      notes.push({ id: 1, icon: '🔔', text: 'Burnout Risk Increased — your latest check-in shows high risk.' });
    }
    if (latest.sleep_hours < 6) {
      notes.push({ id: 2, icon: '🔔', text: `Sleep Deficit Detected — only ${latest.sleep_hours}h of sleep recorded.` });
    }
    if (latest.study_hours > 9) {
      notes.push({ id: 3, icon: '🔔', text: `Recovery Break Recommended — ${latest.study_hours}h study session detected.` });
    }
    setNotifications(notes);
  }, [latest]);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr('');
    setSubmitting(true);
    try {
      const res = await api.post('/burnout/check-in', {
        date: today,
        study_hours: studyH,
        sleep_hours: sleepH,
        breaks_taken: breaks,
        study_streak_days: streak,
        mood_rating: mood,
        energy_level: energy,
      });
      setAnalysis(res.data);
      setLatest(res.data.entry);
      setAlertDismissed(false);
      setSubmitted(true);
      // Refresh trend
      const tr = await api.get(`/burnout/trend?days=${trendDays}`).catch(() => ({ data: [] }));
      setTrend(tr.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormErr(msg ?? 'Failed to save check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const displayed = analysis?.entry ?? latest;
  const displayedRisk = displayed?.risk_level ?? preview.risk;
  const displayedScore = displayed?.burnout_score ?? (submitted ? preview.score : null);
  const displayedAlerts = analysis?.alerts ?? [];
  const displayedRecs = analysis?.recommendations ?? [];
  const displayedTwin = analysis?.twin_message ?? '';

  const showAlertBanner = !alertDismissed && displayedRisk === 'high' && (displayedAlerts.length > 0 || displayed != null);
  const alertMsg = displayedAlerts[0] ?? '⚠️ Your burnout risk is high. Consider taking a break today.';

  const trendFormatted = trend.map(p => ({
    ...p,
    dateLabel: new Date(p.date + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div style={p.page}>
      {/* ── Animated background orbs ── */}
      {isDark && (
        <>
          <div style={p.orb1} />
          <div style={p.orb2} />
        </>
      )}


      <div style={p.content}>

        {/* ── Alert Banner ── */}
        {showAlertBanner && (
          <div style={p.alertBanner} className="animate-slide-up">
            <div style={p.alertLeft}>
              <span style={p.alertIcon}>⚠️</span>
              <div>
                <p style={p.alertTitle}>{t('burnout_alert_title')}</p>
                <p style={p.alertMsg}>{alertMsg}</p>
              </div>
            </div>
            <div style={p.alertActions}>
              <button
                style={p.alertViewBtn}
                onClick={() => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' })}
              >
                {t('burnout_view_recs')}
              </button>
              <button style={p.alertDismissBtn} onClick={() => setAlertDismissed(true)}>✕</button>
            </div>
          </div>
        )}

        {/* ── Score + Form row ── */}
        <div style={p.twoCol} className="burnout-two-col">

          {/* Left: Score widget */}
          <section style={p.card}>
            <div style={p.cardHead}>
              <h2 style={p.cardTitle}>{t('burnout_score_title')}</h2>
              {displayed && (
                <span style={{ ...p.riskBadge, background: `${riskColor(displayedRisk)}22`, color: riskColor(displayedRisk), border: `1px solid ${riskColor(displayedRisk)}44` }}>
                  {riskEmoji(displayedRisk)} {riskLabel(displayedRisk)}
                </span>
              )}
            </div>

            {loading ? (
              <div style={p.loadWrap}>
                <div style={p.spinner} className="spin" />
                <p style={p.loadText}>Loading your data…</p>
              </div>
            ) : (
              <>
                <CircularMeter
                  score={displayedScore ?? preview.score}
                  risk={displayed ? displayedRisk : preview.risk}
                  isDark={isDark}
                />

                {/* Risk breakdown */}
                <div style={p.riskRow}>
                  {(['low', 'medium', 'high'] as const).map(r => (
                    <div key={r} style={{
                      ...p.riskPill,
                      background: displayedRisk === r ? `${riskColor(r)}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${displayedRisk === r ? riskColor(r) : 'rgba(255,255,255,0.08)'}44`,
                      color: displayedRisk === r ? riskColor(r) : 'var(--text)',
                    }}>
                      {riskEmoji(r)} {riskLabel(r)}
                    </div>
                  ))}
                </div>

                {/* Risk scale legend */}
                <div style={p.scaleLegend}>
                  <div style={{ ...p.scaleBar, background: 'linear-gradient(90deg,#10b981,#f59e0b,#ef4444)' }} />
                  <div style={p.scaleLabels}>
                    <span>0</span><span>40</span><span>70</span><span>100</span>
                  </div>
                  <div style={p.scaleTicks}>
                    <span style={{ color: '#10b981' }}>Low</span>
                    <span style={{ color: '#f59e0b' }}>Medium</span>
                    <span style={{ color: '#ef4444' }}>High</span>
                  </div>
                </div>

                {displayed && (
                  <p style={p.lastUpdated}>
                    Last updated: {new Date(displayed.created_at).toLocaleString('en', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}

                {!displayed && (
                  <p style={p.previewNote}>Live preview — submit a check-in to save</p>
                )}
              </>
            )}
          </section>

          {/* Right: Check-in form */}
          <section style={p.card}>
            <div style={p.cardHead}>
              <h2 style={p.cardTitle}>{t('burnout_checkin_title')}</h2>
              <span style={p.dateBadge}>{new Date().toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>

            <form onSubmit={handleSubmit} style={p.form}>

              {/* Study Hours */}
              <div style={p.field}>
                <div style={p.fieldHead}>
                  <label style={p.fieldLabel}>📚 {t('burnout_study_h')}</label>
                  <span style={p.fieldVal}>{studyH.toFixed(1)}h {studyH > 8 && <span style={p.warnTag}>⚠ High</span>}</span>
                </div>
                <input type="range" min={0} max={16} step={0.5} value={studyH}
                  onChange={e => setStudyH(parseFloat(e.target.value))} style={p.slider} />
                <div style={p.sliderHints}><span>0h</span><span>8h</span><span>16h</span></div>
              </div>

              {/* Sleep Hours */}
              <div style={p.field}>
                <div style={p.fieldHead}>
                  <label style={p.fieldLabel}>😴 {t('burnout_sleep_h')}</label>
                  <span style={p.fieldVal}>{sleepH.toFixed(1)}h {sleepH < 6 && <span style={p.warnTag}>⚠ Low</span>}</span>
                </div>
                <input type="range" min={0} max={12} step={0.5} value={sleepH}
                  onChange={e => setSleepH(parseFloat(e.target.value))} style={p.slider} />
                <div style={p.sliderHints}><span>0h</span><span>6h</span><span>12h</span></div>
              </div>

              {/* Breaks */}
              <div style={p.field}>
                <div style={p.fieldHead}>
                  <label style={p.fieldLabel}>☕ {t('burnout_breaks')}</label>
                  <span style={p.fieldVal}>{breaks} {breaks < 2 && <span style={p.warnTag}>⚠ Low</span>}</span>
                </div>
                <div style={p.counter}>
                  <button type="button" style={p.counterBtn} onClick={() => setBreaks(b => Math.max(0, b - 1))}>−</button>
                  <span style={p.counterVal}>{breaks}</span>
                  <button type="button" style={p.counterBtn} onClick={() => setBreaks(b => Math.min(20, b + 1))}>+</button>
                </div>
              </div>

              {/* Mood */}
              <div style={p.field}>
                <div style={p.fieldHead}>
                  <label style={p.fieldLabel}>💛 {t('burnout_mood')}</label>
                  <span style={p.fieldVal}>{mood}/5</span>
                </div>
                <div style={p.emojiRow}>
                  {MOOD_EMOJIS.map((em, i) => (
                    <button
                      key={i} type="button"
                      style={{ ...p.emojiBtn, background: mood === i + 1 ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)', border: `1px solid ${mood === i + 1 ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`, transform: mood === i + 1 ? 'scale(1.18)' : 'scale(1)' }}
                      onClick={() => setMood(i + 1)}
                    >{em}</button>
                  ))}
                </div>
              </div>

              {/* Energy */}
              <div style={p.field}>
                <div style={p.fieldHead}>
                  <label style={p.fieldLabel}>⚡ {t('burnout_energy')}</label>
                  <span style={p.fieldVal}>{energy}/5</span>
                </div>
                <div style={p.emojiRow}>
                  {ENERGY_ICONS.map((ic, i) => (
                    <button
                      key={i} type="button"
                      style={{ ...p.emojiBtn, background: energy === i + 1 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${energy === i + 1 ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`, transform: energy === i + 1 ? 'scale(1.18)' : 'scale(1)' }}
                      onClick={() => setEnergy(i + 1)}
                    >{ic}</button>
                  ))}
                </div>
              </div>

              {/* Streak */}
              <div style={p.field}>
                <div style={p.fieldHead}>
                  <label style={p.fieldLabel}>🔥 {t('burnout_streak_days')}</label>
                  <span style={p.fieldVal}>{streak}d {streak > 10 && <span style={p.warnTag}>⚠ Long</span>}</span>
                </div>
                <div style={p.counter}>
                  <button type="button" style={p.counterBtn} onClick={() => setStreak(s => Math.max(0, s - 1))}>−</button>
                  <span style={p.counterVal}>{streak}</span>
                  <button type="button" style={p.counterBtn} onClick={() => setStreak(s => s + 1)}>+</button>
                </div>
              </div>

              {/* Live score preview */}
              <div style={{ ...p.previewBar, borderColor: `${riskColor(preview.risk)}44`, background: `${riskColor(preview.risk)}0d` }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text)' }}>Live score estimate:</span>
                <span style={{ fontWeight: 800, color: riskColor(preview.risk), fontSize: '0.95rem' }}>
                  {preview.score}/100 — {riskEmoji(preview.risk)} {riskLabel(preview.risk)}
                </span>
              </div>

              {formErr && <p style={p.errorBox}>{formErr}</p>}

              <button type="submit" disabled={submitting} style={{ ...p.submitBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? t('loading') : t('burnout_submit')}
              </button>
            </form>
          </section>
        </div>

        {/* ── AI Recommendations ── */}
        <section id="recommendations" style={p.card}>
          <h2 style={p.cardTitle}>💡 {t('burnout_recs')}</h2>
          <div style={p.recGrid} className="burnout-rec-grid">
            {(displayedRecs.length > 0
              ? displayedRecs.map((r, i) => ({ icon: ['😴','☕','💛','⚡','🗓','📚','✅','💧'][i % 8], title: ['Wellbeing Tip', 'Recovery', 'Focus', 'Energy', 'Rest Day', 'Study Load', 'Great Work', 'Hydration'][i % 8], text: r }))
              : getRecommendations(studyH, sleepH, breaks, mood, energy, streak)
            ).map((rec, i) => (
              <div key={i} style={p.recCard} className="animate-slide-up">
                <div style={p.recIconWrap}><span style={{ fontSize: '1.5rem' }}>{rec.icon}</span></div>
                <h3 style={p.recTitle}>{rec.title}</h3>
                <p style={p.recText}>{rec.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── AI Twin Message ── */}
        {(displayedTwin || displayed) && (
          <section style={p.card}>
            <div style={p.twinHead}>
              <div style={p.twinAvatar}>◈</div>
              <div>
                <h2 style={p.cardTitle}>{t('burnout_twin_says')}</h2>
                <p style={p.twinSub}>{t('twin_title')}</p>
              </div>
            </div>
            <div style={p.twinBubble}>
              <span style={p.twinQuote}>"</span>
              <p style={p.twinText}>
                {displayedTwin || getTwinPreview(preview.risk, studyH, sleepH, streak)}
              </p>
              <div style={p.twinAttrib}>— Your AI Twin</div>
            </div>
          </section>
        )}

        {/* ── Burnout Trend ── */}
        <section style={p.card}>
          <div style={p.cardHead}>
            <h2 style={p.cardTitle}>📈 {t('burnout_trend')}</h2>
            <div style={p.toggleGroup}>
              {([7, 30] as const).map(d => (
                <button key={d} style={{ ...p.toggleBtn, background: trendDays === d ? 'rgba(99,102,241,0.25)' : 'transparent', color: trendDays === d ? '#818cf8' : 'var(--text)', border: `1px solid ${trendDays === d ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}` }}
                  onClick={() => setTrendDays(d)}>
                  {d} Days
                </button>
              ))}
            </div>
          </div>

          {trendFormatted.length === 0 ? (
            <div style={p.emptyChart}>
              <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>📊</p>
              <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.9rem' }}>No trend data yet.</p>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--text)', fontSize: '0.8rem', opacity: 0.6 }}>Submit a check-in to start tracking your burnout trend.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendFormatted} margin={{ top: 10, right: 16, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="burnoutGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="40%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.15)"} strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" tick={{ fill: isDark ? 'rgba(255,255,255,0.4)' : '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: isDark ? 'rgba(255,255,255,0.4)' : '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<BurnoutTooltip isDark={isDark} />} cursor={{ stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)', strokeWidth: 1 }} />
                <ReferenceLine y={40} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.5} />
                <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="burnout_score"
                  stroke="url(#burnoutGrad)"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle key={payload.date} cx={cx} cy={cy} r={4}
                        fill={riskColor(payload.risk_level)}
                        stroke="var(--bg)" strokeWidth={2} />
                    );
                  }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--bg)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {trendFormatted.length > 0 && (
            <div style={p.trendLegend}>
              <span style={p.trendLegItem}><span style={{ color: '#10b981' }}>——</span> Low (&lt;40)</span>
              <span style={p.trendLegItem}><span style={{ color: '#f59e0b' }}>- -</span> Medium threshold (40)</span>
              <span style={p.trendLegItem}><span style={{ color: '#ef4444' }}>- -</span> High threshold (70)</span>
            </div>
          )}
        </section>

        {/* ── Notifications ── */}
        {notifications.length > 0 && (
          <section style={p.card}>
            <h2 style={p.cardTitle}>🔔 Notifications</h2>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
              {notifications.map(n => (
                <div key={n.id} style={p.notifCard}>
                  <span style={p.notifIcon}>{n.icon}</span>
                  <p style={p.notifText}>{n.text}</p>
                  <button style={p.notifDismiss} onClick={() => setNotifications(ns => ns.filter(x => x.id !== n.id))}>✕</button>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

function getTwinPreview(risk: string, studyH: number, sleepH: number, streak: number): string {
  if (risk === 'high') {
    if (studyH > 8 && sleepH < 6) return `${studyH.toFixed(0)}h of study paired with only ${sleepH.toFixed(0)}h of sleep creates a compounding deficit. Your brain consolidates learning during rest — every hour of sleep is an investment in tomorrow's performance.`;
    if (streak > 10) return `An unbroken streak of ${streak} days shows real discipline. But even elite athletes have recovery days. A strategic rest today will make the next ten days significantly more productive.`;
    return "Significant burnout indicators detected. A short, intentional break now prevents a much longer forced pause later.";
  }
  if (risk === 'medium') return "Your burnout indicators are beginning to climb. One restful evening can reset your trajectory — treat recovery as productive work, because it genuinely is.";
  return "Your wellbeing metrics look healthy. The balance you're maintaining — study, rest, and breaks — is exactly what drives long-term retention.";
}

// ── Styles ─────────────────────────────────────────────────────────────

function getStyles(isDark: boolean): Record<string, React.CSSProperties> {
  return {
    page: {
      minHeight: '100vh',
      background: isDark ? 'var(--bg)' : '#FFFFFF',
      color: isDark ? 'var(--text-h)' : '#111827',
      fontFamily: 'inherit',
      position: 'relative',
      overflow: 'hidden',
    },
    orb1: {
      position: 'fixed', top: '-10%', right: '-5%',
      width: '500px', height: '500px', borderRadius: '50%',
      background: 'radial-gradient(circle,rgba(239,68,68,0.07) 0%,transparent 70%)',
      pointerEvents: 'none', zIndex: 0,
    },
    orb2: {
      position: 'fixed', bottom: '5%', left: '-10%',
      width: '400px', height: '400px', borderRadius: '50%',
      background: 'radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 70%)',
      pointerEvents: 'none', zIndex: 0,
    },
    topBar: {
      position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.85rem 1.75rem',
      background: isDark ? 'rgba(6,11,24,0.85)' : 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`,
    },
    topBarCenter: {
      display: 'flex', alignItems: 'center', gap: '0.5rem',
    },
    topIcon: { fontSize: '1.25rem' },
    pageTitle: {
      margin: 0, fontSize: isDark ? '1.05rem' : '32px', fontWeight: isDark ? 800 : 700,
      color: isDark ? undefined : '#111827',
      background: isDark ? 'linear-gradient(135deg,#ef4444,#f59e0b)' : 'none',
      WebkitBackgroundClip: isDark ? 'text' : undefined,
      WebkitTextFillColor: isDark ? 'transparent' : undefined,
    },
    homeLink: {
      fontSize: '0.8rem', fontWeight: 600,
      color: isDark ? 'var(--accent)' : '#4F46E5',
      textDecoration: 'none', padding: '0.3rem 0.75rem',
      background: isDark ? 'rgba(99,102,241,0.12)' : '#F3F4F6',
      border: `1px solid ${isDark ? 'rgba(99,102,241,0.25)' : '#E5E7EB'}`,
      borderRadius: '8px',
    },
    content: {
      position: 'relative', zIndex: 1,
      maxWidth: '1100px', margin: '0 auto',
      padding: '1.5rem 1.5rem 4rem',
      display: 'flex', flexDirection: 'column' as const, gap: '1.25rem',
    },

    // Alert Banner
    alertBanner: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: '1rem', padding: '1rem 1.25rem',
      background: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
      border: `1px solid ${isDark ? 'rgba(239,68,68,0.4)' : '#FCA5A5'}`,
      borderRadius: '14px',
      backdropFilter: isDark ? 'blur(12px)' : 'none',
      boxShadow: isDark ? '0 4px 24px rgba(239,68,68,0.18)' : '0 4px 12px rgba(239,68,68,0.05)',
    },
    alertLeft: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1 },
    alertIcon: { fontSize: '1.25rem', flexShrink: 0, marginTop: '1px' },
    alertTitle: { margin: '0 0 0.2rem', fontSize: '0.9rem', fontWeight: 800, color: isDark ? '#fca5a5' : '#B91C1C' },
    alertMsg:   { margin: 0, fontSize: '0.8rem', color: isDark ? 'rgba(252,165,165,0.8)' : '#DC2626', lineHeight: 1.5 },
    alertActions: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 },
    alertViewBtn: {
      padding: '0.4rem 0.9rem',
      background: isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2',
      border: `1px solid ${isDark ? 'rgba(239,68,68,0.45)' : '#FCA5A5'}`,
      borderRadius: '8px',
      color: isDark ? '#fca5a5' : '#B91C1C',
      fontSize: '0.78rem', fontWeight: 700,
      cursor: 'pointer', fontFamily: 'inherit',
    },
    alertDismissBtn: {
      padding: '0.4rem 0.6rem', background: 'transparent',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#FCA5A5'}`,
      borderRadius: '8px',
      color: isDark ? 'rgba(255,255,255,0.5)' : '#B91C1C',
      fontSize: '0.85rem',
      cursor: 'pointer', fontFamily: 'inherit',
    },

    // Two-col layout
    twoCol: {
      display: 'grid',
      gridTemplateColumns: 'minmax(280px,360px) 1fr',
      gap: '1.25rem',
      alignItems: 'start',
    },

    // Card
    card: {
      background: isDark ? 'var(--glass-bg, rgba(255,255,255,0.04))' : '#FFFFFF',
      backdropFilter: isDark ? 'blur(24px)' : 'none',
      border: isDark ? '1px solid var(--glass-border, rgba(255,255,255,0.08))' : '1px solid #E5E7EB',
      borderRadius: isDark ? '20px' : '18px',
      padding: isDark ? '1.5rem' : '24px',
      boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.25)' : '0 4px 20px rgba(0,0,0,0.05)',
    },
    cardHead: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: '1.25rem',
    },
    cardTitle: {
      margin: 0, fontSize: isDark ? '0.95rem' : '18px', fontWeight: isDark ? 800 : 600,
      color: isDark ? 'var(--text-h)' : '#1F2937',
    },
    riskBadge: {
      padding: '0.25rem 0.7rem', borderRadius: '99px',
      fontSize: '0.75rem', fontWeight: 700,
    },

    // Loading
    loadWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '0.75rem', padding: '3rem 1rem' },
    spinner: { width: '32px', height: '32px', border: `3px solid ${isDark ? 'rgba(99,102,241,0.2)' : '#E5E7EB'}`, borderTop: `3px solid ${isDark ? '#818cf8' : '#4F46E5'}`, borderRadius: '50%' },
    loadText: { margin: 0, fontSize: '0.82rem', color: isDark ? 'var(--text)' : '#6B7280' },

    // Risk pills
    riskRow: { display: 'flex', gap: '0.4rem', justifyContent: 'center', margin: '0.75rem 0 0.5rem', flexWrap: 'wrap' as const },
    riskPill: { padding: '0.25rem 0.65rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.3s' },

    // Scale legend
    scaleLegend: { marginTop: '1rem' },
    scaleBar: { height: '6px', borderRadius: '99px', marginBottom: '0.35rem' },
    scaleLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: isDark ? 'var(--text)' : '#6B7280', opacity: isDark ? 0.5 : 1, marginBottom: '0.2rem' },
    scaleTicks: { display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 600, paddingLeft: '8%', paddingRight: '2%' },

    lastUpdated: { margin: '0.75rem 0 0', fontSize: '0.72rem', color: isDark ? 'var(--text)' : '#6B7280', opacity: isDark ? 0.5 : 1, textAlign: 'center' as const },
    previewNote: { margin: '0.75rem 0 0', fontSize: '0.72rem', color: isDark ? '#818cf8' : '#4F46E5', textAlign: 'center' as const, fontStyle: 'italic' },
    dateBadge: { fontSize: '0.73rem', color: isDark ? 'var(--text)' : '#6B7280', opacity: isDark ? 0.6 : 1 },

    // Form
    form: { display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
    field: { display: 'flex', flexDirection: 'column' as const, gap: '0.45rem' },
    fieldHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    fieldLabel: { fontSize: '0.82rem', fontWeight: 600, color: isDark ? 'var(--text-h)' : '#374151' },
    fieldVal: { fontSize: '0.82rem', fontWeight: 700, color: isDark ? 'var(--accent)' : '#4F46E5', display: 'flex', alignItems: 'center', gap: '0.4rem' },
    warnTag: { fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '0.1rem 0.4rem', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.3)' },
    slider: { width: '100%', accentColor: isDark ? '#6366f1' : '#4F46E5', cursor: 'pointer', height: '4px' },
    sliderHints: { display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: isDark ? 'var(--text)' : '#6B7280', opacity: isDark ? 0.45 : 1 },

    counter: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
    counterBtn: {
      width: '32px', height: '32px', borderRadius: '8px',
      background: isDark ? 'rgba(99,102,241,0.15)' : '#F3F4F6',
      border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : '#E5E7EB'}`,
      color: isDark ? '#818cf8' : '#4F46E5',
      fontSize: '1.15rem', cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    counterVal: { fontSize: '1.15rem', fontWeight: 800, color: isDark ? 'var(--text-h)' : '#111827', minWidth: '2rem', textAlign: 'center' as const },

    emojiRow: { display: 'flex', gap: '0.5rem' },
    emojiBtn: {
      flex: 1, padding: '0.55rem 0', borderRadius: '10px',
      fontSize: '1.3rem', cursor: 'pointer', fontFamily: 'inherit',
      transition: 'all 0.2s', lineHeight: 1,
    },

    previewBar: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid',
    },
    errorBox: {
      padding: '0.6rem 0.9rem', borderRadius: '10px',
      background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2',
      border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#FCA5A5'}`,
      color: isDark ? '#fca5a5' : '#B91C1C',
      fontSize: '0.82rem', margin: 0,
    },
    submitBtn: {
      padding: '0.75rem 1.5rem',
      background: isDark ? 'linear-gradient(135deg,#ef4444,#f59e0b)' : '#111827',
      border: 'none', borderRadius: '12px', color: '#fff',
      fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer',
      fontFamily: 'inherit', width: '100%',
      boxShadow: isDark ? '0 4px 20px rgba(239,68,68,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
      transition: 'opacity 0.2s',
    },

    // Recommendations
    recGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '0.85rem',
      marginTop: '1rem',
    },
    recCard: {
      background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB'}`,
      borderRadius: '14px', padding: '1.1rem',
    },
    recIconWrap: { marginBottom: '0.6rem' },
    recTitle: { margin: '0 0 0.4rem', fontSize: '0.83rem', fontWeight: 700, color: isDark ? 'var(--text-h)' : '#111827' },
    recText: { margin: 0, fontSize: '0.78rem', color: isDark ? 'var(--text)' : '#374151', lineHeight: 1.6 },

    // Twin
    twinHead: { display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' },
    twinAvatar: {
      width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.2rem', color: '#fff', fontWeight: 800,
      boxShadow: '0 0 16px rgba(99,102,241,0.4)',
    },
    twinSub: { margin: '0.1rem 0 0', fontSize: '0.72rem', color: isDark ? 'var(--text)' : '#6B7280', opacity: isDark ? 0.6 : 1 },
    twinBubble: {
      position: 'relative' as const,
      background: isDark ? 'rgba(99,102,241,0.06)' : '#EEF2FF',
      border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : '#C7D2FE'}`,
      borderRadius: '16px', padding: '1.25rem 1.5rem',
    },
    twinQuote: { position: 'absolute' as const, top: '0.5rem', left: '1rem', fontSize: '2.5rem', color: isDark ? 'rgba(99,102,241,0.25)' : '#C7D2FE', lineHeight: 1 },
    twinText: { margin: '0 0 0.85rem', fontSize: '0.9rem', color: isDark ? 'var(--text-h)' : '#374151', lineHeight: 1.7, paddingLeft: '1rem', fontStyle: 'italic' },
    twinAttrib: { textAlign: 'right' as const, fontSize: '0.75rem', color: isDark ? '#818cf8' : '#4F46E5', fontWeight: 600 },

    // Trend chart
    toggleGroup: { display: 'flex', gap: '0.4rem' },
    toggleBtn: {
      padding: '0.3rem 0.75rem', borderRadius: '8px',
      fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'all 0.2s',
    },
    emptyChart: { textAlign: 'center' as const, padding: '3rem 1rem', color: isDark ? 'var(--text)' : '#6B7280' },
    trendLegend: { display: 'flex', gap: '1.25rem', marginTop: '0.75rem', flexWrap: 'wrap' as const },
    trendLegItem: { fontSize: '0.7rem', color: isDark ? 'var(--text)' : '#6B7280', opacity: isDark ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.35rem' },

    // Notifications
    notifCard: {
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.75rem 1rem',
      background: isDark ? 'rgba(99,102,241,0.07)' : '#F3F4F6',
      border: `1px solid ${isDark ? 'rgba(99,102,241,0.18)' : '#E5E7EB'}`,
      borderRadius: '10px',
    },
    notifIcon: { fontSize: '1.1rem', flexShrink: 0 },
    notifText: { margin: 0, flex: 1, fontSize: '0.82rem', color: isDark ? 'var(--text-h)' : '#374151' },
    notifDismiss: {
      background: 'transparent', border: 'none', color: isDark ? 'var(--text)' : '#9CA3AF',
      opacity: isDark ? 0.45 : 1, fontSize: '0.85rem', cursor: 'pointer', padding: '0.2rem',
      flexShrink: 0,
    },
  };
}
