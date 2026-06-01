import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';

// ── Types ─────────────────────────────────────────────────────────────────

interface HeatmapDay  { date: string; score: number; has_entry: boolean; }
interface WeekSummary {
  week_start: string; week_label: string;
  overall_score: number; study_hours: number; attendance: number;
  sleep_duration: number; stress_level: number; entry_count: number;
}
interface MonthSummary {
  month: string; month_label: string;
  overall_score: number; study_hours: number; attendance: number; entry_count: number;
}
interface SubjectPerf  { subject: string; sessions: number; total_minutes: number; }
interface BestWorstWeek { week_label: string; overall_score: number; }
interface Summary {
  heatmap: HeatmapDay[];
  weekly_summaries: WeekSummary[];
  monthly_summaries: MonthSummary[];
  subject_performance: SubjectPerf[];
  best_week: BestWorstWeek | null;
  worst_week: BestWorstWeek | null;
  total_checkins: number;
  avg_study_hours: number;
  avg_sleep_duration: number;
  avg_stress_level: number;
  current_streak: number;
  longest_streak: number;
}
interface LegacyAnalytics {
  total_sessions: number;
  total_study_minutes: number;
  total_notes: number;
  total_materials: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtMins(m: number) {
  const h = Math.floor(m / 60), min = m % 60;
  return h ? `${h}h${min ? ` ${min}m` : ''}` : `${min}m`;
}

function heatColor(day: { has_entry: boolean; score: number } | null, inFuture: boolean): string {
  if (inFuture || !day || !day.has_entry) return 'rgba(255,255,255,0.05)';
  const s = day.score;
  if (s >= 80) return '#6366f1';
  if (s >= 60) return 'rgba(99,102,241,0.72)';
  if (s >= 40) return 'rgba(99,102,241,0.45)';
  return 'rgba(99,102,241,0.22)';
}

// ── Heatmap ───────────────────────────────────────────────────────────────

function StudyHeatmap({ heatmap }: { heatmap: HeatmapDay[] }) {
  const dateMap = new Map(heatmap.map(d => [d.date, d]));
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Align start to Monday
  const oldest = new Date(today);
  oldest.setDate(today.getDate() - 89);
  const startDate = new Date(oldest);
  const dow = startDate.getDay();
  startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));

  // Build weeks
  type Cell = { date: string; inFuture: boolean; data: HeatmapDay | null };
  const weeks: Cell[][] = [];
  const cur = new Date(startDate);
  while (cur <= today || weeks.length < 13) {
    const week: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const ds = cur.toISOString().slice(0, 10);
      week.push({ date: ds, inFuture: ds > todayStr, data: dateMap.get(ds) ?? null });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur > today && weeks.length >= 13) break;
  }

  // Month labels
  const monthLabels: { col: number; label: string }[] = [];
  let lastM = -1;
  weeks.forEach((week, wi) => {
    const m = new Date(week[0].date + 'T00:00:00').getMonth();
    if (m !== lastM) {
      monthLabels.push({ col: wi, label: new Date(week[0].date + 'T00:00:00').toLocaleDateString('en', { month: 'short' }) });
      lastM = m;
    }
  });

  const CELL = 13, GAP = 3, STEP = CELL + GAP;
  const LEFT = 22, TOP = 20;
  const W = LEFT + weeks.length * STEP;
  const H = TOP + 7 * STEP + 4;
  const DAY_LABELS = ['M', '', 'W', '', 'F', '', 'S'];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {/* Day labels */}
        {DAY_LABELS.map((lbl, i) => lbl && (
          <text key={i} x={LEFT - 4} y={TOP + i * STEP + CELL - 2}
            textAnchor="end" fontSize="9" fill="#475569">{lbl}</text>
        ))}
        {/* Month labels */}
        {monthLabels.map(ml => (
          <text key={ml.label + ml.col} x={LEFT + ml.col * STEP} y={13}
            fontSize="9" fill="#64748b">{ml.label}</text>
        ))}
        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((cell, di) => (
            <rect key={`${wi}-${di}`}
              x={LEFT + wi * STEP} y={TOP + di * STEP}
              width={CELL} height={CELL} rx={2}
              fill={heatColor(cell.data, cell.inFuture)}>
              <title>
                {cell.inFuture ? '' : cell.data?.has_entry
                  ? `${cell.date} · Score ${cell.data.score}`
                  : `${cell.date} · No check-in`}
              </title>
            </rect>
          ))
        )}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', marginLeft: `${LEFT}px` }}>
        <span style={{ fontSize: '0.68rem', color: '#475569' }}>Less</span>
        {['rgba(255,255,255,0.05)', 'rgba(99,102,241,0.22)', 'rgba(99,102,241,0.45)', 'rgba(99,102,241,0.72)', '#6366f1'].map(c => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: '0.68rem', color: '#475569' }}>More</span>
      </div>
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  background: '#0d1426',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '0.78rem',
  padding: '6px 10px',
};

// ── PDF generator ─────────────────────────────────────────────────────────

async function downloadReport(
  userName: string,
  summary: Summary,
  legacy: LegacyAnalytics,
) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  let y = 50;

  const rule = () => {
    doc.setDrawColor(80, 80, 120);
    doc.line(40, y, PW - 40, y);
    y += 14;
  };
  const h1 = (txt: string) => {
    doc.setFontSize(18); doc.setTextColor(99, 102, 241);
    doc.text(txt, 40, y); y += 24;
  };
  const h2 = (txt: string) => {
    doc.setFontSize(11); doc.setTextColor(160, 165, 210);
    doc.text(txt.toUpperCase(), 40, y); y += 4;
    rule();
  };
  const row = (label: string, value: string, indent = 40) => {
    doc.setFontSize(9.5); doc.setTextColor(148, 163, 184);
    doc.text(label, indent, y);
    doc.setTextColor(241, 245, 249);
    doc.text(value, indent + 200, y);
    y += 14;
  };
  const col4 = (cols: [string, string, string, string], bold = false) => {
    const xs = [40, 175, 285, 385];
    doc.setFontSize(9); doc.setTextColor(bold ? 241 : 148, bold ? 245 : 163, bold ? 249 : 184);
    cols.forEach((c, i) => doc.text(c, xs[i], y));
    y += 13;
  };
  const newPage = () => { doc.addPage(); y = 50; };
  const needsPage = (lines: number) => { if (y + lines * 14 > 780) newPage(); };

  // ── Cover ──
  doc.setFillColor(8, 13, 26);
  doc.rect(0, 0, PW, 120, 'F');
  h1('TwinMind Academic Progress Report');
  doc.setFontSize(10); doc.setTextColor(148, 163, 184);
  doc.text(`Student: ${userName}`, 40, y); y += 16;
  doc.text(`Generated: ${new Date().toLocaleDateString('en', { dateStyle: 'long' })}`, 40, y); y += 30;

  // ── Overview ──
  h2('Overview');
  row('Total Check-ins', String(summary.total_checkins));
  row('Current Streak', `${summary.current_streak} day${summary.current_streak !== 1 ? 's' : ''}`);
  row('Longest Streak', `${summary.longest_streak} day${summary.longest_streak !== 1 ? 's' : ''}`);
  row('Avg Study Hours / day', `${summary.avg_study_hours}h`);
  row('Avg Sleep / night', `${summary.avg_sleep_duration}h`);
  row('Avg Stress Level', `${summary.avg_stress_level} / 10`);
  row('Study Sessions (all time)', String(legacy.total_sessions));
  row('Total Study Time (sessions)', fmtMins(legacy.total_study_minutes));
  row('Notes Created', String(legacy.total_notes));
  row('Materials Uploaded', String(legacy.total_materials));
  y += 8;

  // ── Weekly performance ──
  needsPage(4 + summary.weekly_summaries.length);
  h2('Weekly Performance (last 12 weeks)');
  col4(['Week', 'Score', 'Study Hrs', 'Attendance'], true);
  rule();
  summary.weekly_summaries.forEach(w => {
    needsPage(2);
    col4([w.week_label, `${w.overall_score}`, `${w.study_hours}h`, `${w.attendance}%`]);
  });
  y += 8;

  // ── Monthly ──
  needsPage(4 + summary.monthly_summaries.length);
  h2('Monthly Summary (last 6 months)');
  col4(['Month', 'Score', 'Study Hrs', 'Entries'], true);
  rule();
  summary.monthly_summaries.forEach(m => {
    needsPage(2);
    col4([m.month_label, m.entry_count ? `${m.overall_score}` : '—',
      m.entry_count ? `${m.study_hours}h` : '—', String(m.entry_count)]);
  });
  y += 8;

  // ── Best / worst ──
  if (summary.best_week || summary.worst_week) {
    needsPage(6);
    h2('Highlight Weeks');
    if (summary.best_week)  row('Best Week',  `${summary.best_week.week_label}  (${summary.best_week.overall_score})`);
    if (summary.worst_week) row('Needs Work', `${summary.worst_week.week_label}  (${summary.worst_week.overall_score})`);
    y += 8;
  }

  // ── Subjects ──
  if (summary.subject_performance.length > 0) {
    needsPage(4 + summary.subject_performance.length);
    h2('Subject Sessions');
    col4(['Subject', 'Sessions', 'Total Time', ''], true);
    rule();
    summary.subject_performance.forEach(s => {
      needsPage(2);
      col4([s.subject, String(s.sessions), fmtMins(s.total_minutes), '']);
    });
  }

  doc.save(`twinmind-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Main component ────────────────────────────────────────────────────────

export default function Progress() {
  const { user, token } = useAuth();
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [legacy,  setLegacy]    = useState<LegacyAnalytics | null>(null);
  const [loading, setLoading]   = useState(true);
  const [pdfBusy, setPdfBusy]   = useState(false);

  const h = { Authorization: `Bearer ${token}` };

  const refreshData = useCallback(() => {
    Promise.all([
      api.get<Summary>('/analytics/summary', { headers: h }),
      api.get<LegacyAnalytics>('/analytics',  { headers: h }),
    ]).then(([s, l]) => { setSummary(s.data); setLegacy(l.data); }).catch(() => {});
  }, [token]);

  useEffect(() => {
    Promise.all([
      api.get<Summary>('/analytics/summary', { headers: h }),
      api.get<LegacyAnalytics>('/analytics',  { headers: h }),
    ])
      .then(([s, l]) => { setSummary(s.data); setLegacy(l.data); })
      .finally(() => setLoading(false));
  }, []);

  const wsConnected = useWebSocket(user?.id, token, refreshData);

  const avgScore = summary?.weekly_summaries.length
    ? Math.round(summary.weekly_summaries.reduce((a, w) => a + w.overall_score, 0) / summary.weekly_summaries.length)
    : 0;

  const handleDownload = async () => {
    if (!summary || !legacy || !user) return;
    setPdfBusy(true);
    try { await downloadReport(user.full_name ?? 'Student', summary, legacy); }
    finally { setPdfBusy(false); }
  };

  const maxSubjSessions = summary?.subject_performance[0]?.sessions ?? 1;

  return (
    <div style={s.shell}>
      <div style={s.bgOrb} />

      {/* Nav */}
      <header style={s.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <BackButton />
          <span style={{ fontSize: '1rem', color: '#6366f1' }}>◈</span>
          <span style={s.navLogo}>TwinMind</span>
          {wsConnected && <LiveBadge />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleDownload}
            disabled={pdfBusy || !summary}
            style={{
              padding: '0.38rem 0.9rem',
              background: pdfBusy || !summary ? 'rgba(99,102,241,0.1)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '0.78rem', fontWeight: 700, cursor: pdfBusy || !summary ? 'not-allowed' : 'pointer',
              opacity: pdfBusy || !summary ? 0.5 : 1, transition: 'opacity 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {pdfBusy ? 'Generating…' : '↓ Download Report'}
          </button>
        </div>
      </header>

      <main style={s.main}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={s.pageTitle}>Progress & Analytics</h1>
          <p style={{ color: '#475569', fontSize: '0.9rem', margin: 0 }}>Your academic journey, visualised.</p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#475569' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'float 2s ease-in-out infinite' }}>◈</div>
            <p>Loading analytics…</p>
          </div>
        )}

        {!loading && summary && legacy && (
          <>
            {/* ── Overview stat cards ── */}
            <div style={s.statsRow}>
              {[
                { label: 'Total Check-ins',  value: summary.total_checkins,                 sub: 'all time',           grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)' },
                { label: 'Current Streak',   value: `${summary.current_streak}d`,           sub: `Best: ${summary.longest_streak}d`, grad: 'linear-gradient(135deg,#10b981,#06b6d4)' },
                { label: 'Avg Study Hours',  value: `${summary.avg_study_hours}h`,          sub: 'per day',            grad: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
                { label: 'Avg Score',        value: avgScore || '—',                        sub: 'last 12 weeks',      grad: 'linear-gradient(135deg,#f59e0b,#f97316)' },
              ].map(c => (
                <div key={c.label} style={s.statCard}>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</p>
                  <p style={{ margin: '0 0 0.2rem', fontSize: '1.65rem', fontWeight: 800, background: c.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>{c.value}</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#334155' }}>{c.sub}</p>
                </div>
              ))}
            </div>

            {/* ── Study heatmap ── */}
            <div style={{ ...s.card, marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={s.cardTitle}>Study Heatmap</h2>
                <span style={{ fontSize: '0.72rem', color: '#475569' }}>Last 3 months · daily check-ins</span>
              </div>
              {summary.total_checkins === 0 ? (
                <p style={s.empty}>Log your first check-in to start building your heatmap.</p>
              ) : (
                <StudyHeatmap heatmap={summary.heatmap} />
              )}
            </div>

            {/* ── Charts row ── */}
            <div style={s.twoCol}>
              {/* Weekly trend */}
              <div style={s.card}>
                <h2 style={s.cardTitle}>Weekly Score Trend</h2>
                {summary.weekly_summaries.length < 2 ? (
                  <p style={s.empty}>Need at least 2 weeks of data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={summary.weekly_summaries} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="wkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="week_label" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} />
                      <Area type="monotone" dataKey="overall_score" name="Score" stroke="#6366f1" fill="url(#wkGrad)" strokeWidth={2} dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {summary.weekly_summaries.length >= 2 && (
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    {[
                      { lbl: 'Avg Study', val: `${(summary.weekly_summaries.reduce((a,w)=>a+w.study_hours,0)/summary.weekly_summaries.length).toFixed(1)}h/day` },
                      { lbl: 'Avg Attendance', val: `${Math.round(summary.weekly_summaries.reduce((a,w)=>a+w.attendance,0)/summary.weekly_summaries.length)}%` },
                    ].map(m => (
                      <div key={m.lbl}>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.lbl}</p>
                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>{m.val}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Monthly bars */}
              <div style={s.card}>
                <h2 style={s.cardTitle}>Monthly Performance</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summary.monthly_summaries} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="month_label" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} />
                    <Bar dataKey="overall_score" name="Score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="study_hours"   name="Study Hrs" fill="rgba(59,130,246,0.55)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                  {[['#6366f1', 'Avg Score'], ['rgba(59,130,246,0.7)', 'Study Hrs']].map(([c, lbl]) => (
                    <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                      <span style={{ fontSize: '0.7rem', color: '#475569' }}>{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Bottom row: subjects + best/worst ── */}
            <div style={s.twoCol}>
              {/* Subject performance */}
              <div style={s.card}>
                <h2 style={s.cardTitle}>Subject Sessions</h2>
                {summary.subject_performance.length === 0 ? (
                  <p style={s.empty}>No study sessions with subjects recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {summary.subject_performance.slice(0, 7).map(sub => {
                      const pct = Math.round((sub.sessions / maxSubjSessions) * 100);
                      return (
                        <div key={sub.subject}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                            <span style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 500 }}>{sub.subject}</span>
                            <span style={{ fontSize: '0.75rem', color: '#475569' }}>{sub.sessions} session{sub.sessions !== 1 ? 's' : ''} · {fmtMins(sub.total_minutes)}</span>
                          </div>
                          <div className="score-bar-track">
                            <div className="score-bar-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Best / worst week + session stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {summary.best_week && summary.worst_week && (
                  <div style={s.card}>
                    <h2 style={s.cardTitle}>Highlight Weeks</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                      <div style={{ padding: '0.7rem 0.9rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
                        <p style={{ margin: '0 0 0.2rem', fontSize: '0.65rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Best Week</p>
                        <p style={{ margin: '0 0 0.15rem', fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>{summary.best_week.week_label}</p>
                        <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{summary.best_week.overall_score}</p>
                      </div>
                      <div style={{ padding: '0.7rem 0.9rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px' }}>
                        <p style={{ margin: '0 0 0.2rem', fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Needs Focus</p>
                        <p style={{ margin: '0 0 0.15rem', fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>{summary.worst_week.week_label}</p>
                        <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{summary.worst_week.overall_score}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Session stats */}
                <div style={s.card}>
                  <h2 style={s.cardTitle}>Session Stats</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                    {[
                      { lbl: 'Sessions',  val: legacy.total_sessions },
                      { lbl: 'Study Time', val: fmtMins(legacy.total_study_minutes) },
                      { lbl: 'Notes',      val: legacy.total_notes },
                      { lbl: 'Materials',  val: legacy.total_materials },
                    ].map(c => (
                      <div key={c.lbl} style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                        <p style={{ margin: '0 0 0.2rem', fontSize: '0.65rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.lbl}</p>
                        <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f1f5f9' }}>{c.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Sleep & stress averages ── */}
            <div style={{ ...s.card, marginBottom: 0 }}>
              <h2 style={s.cardTitle}>Wellness Averages</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                {[
                  { lbl: 'Avg Sleep', val: `${summary.avg_sleep_duration}h`, sub: 'target: 7–8h', ok: summary.avg_sleep_duration >= 7 && summary.avg_sleep_duration <= 8.5, grad: 'linear-gradient(135deg,#06b6d4,#6366f1)' },
                  { lbl: 'Avg Stress', val: `${summary.avg_stress_level}/10`, sub: 'target: ≤ 5', ok: summary.avg_stress_level <= 5, grad: 'linear-gradient(135deg,#f59e0b,#f97316)' },
                  { lbl: 'Avg Study', val: `${summary.avg_study_hours}h/day`, sub: 'target: ≥ 4h', ok: summary.avg_study_hours >= 4, grad: 'linear-gradient(135deg,#10b981,#06b6d4)' },
                ].map(m => (
                  <div key={m.lbl} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.lbl}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: m.ok ? '#10b981' : '#f59e0b' }}>{m.ok ? '✓' : '!'}</span>
                    </div>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '1.4rem', fontWeight: 800, display: 'inline-block', background: m.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{m.val}</p>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: '#334155' }}>{m.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100svh', display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(180deg,#080d1a 0%,#0a0f20 100%)',
    position: 'relative',
  },
  bgOrb: {
    position: 'fixed', width: '700px', height: '700px', borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(99,102,241,0.05) 0%,transparent 70%)',
    top: '-200px', right: '-200px', pointerEvents: 'none', zIndex: 0,
  },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.75rem', height: '60px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(8,13,26,0.85)', backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50,
  },
  navLogo: { fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px' },
  main: {
    flex: 1, padding: '2.5rem 2rem', maxWidth: '1000px',
    width: '100%', margin: '0 auto', boxSizing: 'border-box', position: 'relative', zIndex: 1,
  },
  pageTitle: { fontSize: '1.9rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px', marginBottom: '0.4rem' },
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
    gap: '1rem', marginBottom: '1.25rem',
  },
  statCard: {
    padding: '1.1rem 1.25rem',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px', backdropFilter: 'blur(20px)',
  },
  card: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px', padding: '1.5rem',
    backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  twoCol: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '1.25rem', marginBottom: '1.25rem',
  },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1rem', letterSpacing: '-0.1px' },
  empty: { margin: 0, fontSize: '0.85rem', color: '#475569' },
};
