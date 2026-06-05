import { useEffect, useState } from 'react';
import api from '../services/api';

interface ScenarioResult {
  id: string; label: string; emoji: string; description: string;
  predicted_score: number; risk_level: 'low'|'medium'|'high';
  delta_from_current: number; delta_pct: number;
  key_impacts: string[]; recommendation: string;
}
interface SimData { current_score: number; current_risk: string; scenarios: ScenarioResult[] }

const RISK_COLOR = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const RISK_BG    = { low: 'rgba(16,185,129,0.1)', medium: 'rgba(245,158,11,0.1)', high: 'rgba(239,68,68,0.1)' };

export default function TwinSimulator() {
  const [data,    setData]    = useState<SimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [active,  setActive]  = useState<string | null>(null);

  useEffect(() => {
    api.get<SimData>('/twin/simulate-scenarios')
      .then(r => { setData(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '28px', height: '28px', border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #818cf8', borderRadius: '50%' }} className="spin" />
    </div>
  );

  if (!data) return (
    <p style={{ fontSize: '0.82rem', color: 'rgba(148,163,184,0.5)', textAlign: 'center' as const, padding: '1rem 0' }}>
      Log check-ins to unlock scenario simulation.
    </p>
  );

  const activeScenario = data.scenarios.find(s => s.id === active);

  return (
    <div style={sim.wrap}>
      {/* Scenario cards */}
      <div style={sim.grid}>
        {data.scenarios.map(s => {
          const isActive = active === s.id;
          const dColor = s.delta_from_current > 0 ? '#10b981' : s.delta_from_current < 0 ? '#ef4444' : '#94a3b8';
          return (
            <button
              key={s.id}
              onClick={() => setActive(isActive ? null : s.id)}
              style={{
                ...sim.card,
                borderColor: isActive ? RISK_COLOR[s.risk_level] : 'rgba(255,255,255,0.08)',
                background:  isActive ? RISK_BG[s.risk_level] : 'rgba(255,255,255,0.04)',
                boxShadow:   isActive ? `0 0 20px ${RISK_COLOR[s.risk_level]}25` : 'none',
              }}
            >
              <div style={sim.cardTop}>
                <span style={sim.emoji}>{s.emoji}</span>
                <span style={{ ...sim.riskDot, background: RISK_COLOR[s.risk_level] }} />
              </div>
              <p style={sim.cardLabel}>{s.label}</p>
              <p style={sim.cardDesc}>{s.description}</p>
              <p style={{ ...sim.cardScore, color: RISK_COLOR[s.risk_level] }}>
                {s.predicted_score.toFixed(0)}%
              </p>
              <p style={{ ...sim.delta, color: dColor }}>
                {s.delta_from_current > 0 ? '+' : ''}{s.delta_from_current.toFixed(1)} pts
              </p>
            </button>
          );
        })}
      </div>

      {/* Expanded detail panel */}
      {activeScenario && (
        <div style={sim.detail} className="animate-slide-up">
          <div style={sim.detailHead}>
            <span style={{ fontSize: '1.2rem' }}>{activeScenario.emoji}</span>
            <div>
              <p style={sim.detailTitle}>{activeScenario.label}</p>
              <p style={sim.detailSub}>vs current score: {data.current_score.toFixed(0)}%</p>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' as const }}>
              <p style={{ ...sim.detailScore, color: RISK_COLOR[activeScenario.risk_level] }}>
                {activeScenario.predicted_score.toFixed(0)}%
              </p>
              <span style={{ ...sim.riskBadge, background: RISK_BG[activeScenario.risk_level], color: RISK_COLOR[activeScenario.risk_level], borderColor: `${RISK_COLOR[activeScenario.risk_level]}40` }}>
                {activeScenario.risk_level.toUpperCase()} RISK
              </span>
            </div>
          </div>

          <div style={sim.impactsRow}>
            <div style={{ flex: 1 }}>
              <p style={sim.impactsTitle}>Key Impacts</p>
              {activeScenario.key_impacts.map((impact, i) => (
                <div key={i} style={sim.impactItem}>
                  <span style={{ color: '#00D4FF', fontSize: '0.75rem', flexShrink: 0 }}>→</span>
                  <span style={sim.impactText}>{impact}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, padding: '0 0 0 1rem', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={sim.impactsTitle}>AI Recommendation</p>
              <p style={sim.recText}>{activeScenario.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      <p style={sim.hint}>Click a scenario to expand. All predictions use your actual performance data.</p>
    </div>
  );
}

const sim: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem' },
  card: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    padding: '1rem 0.75rem',
    border: '1px solid', borderRadius: '16px',
    cursor: 'pointer', transition: 'all 0.22s ease',
    background: 'none', fontFamily: 'inherit', gap: '0.25rem',
  },
  cardTop:   { display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.15rem' },
  emoji:     { fontSize: '1.3rem' },
  riskDot:   { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  cardLabel: { margin: 0, fontSize: '0.78rem', fontWeight: 800, color: '#f1f5f9', textAlign: 'center' as const },
  cardDesc:  { margin: 0, fontSize: '0.62rem', color: 'rgba(148,163,184,0.55)', textAlign: 'center' as const, lineHeight: 1.35 },
  cardScore: { margin: 0, fontSize: '1.6rem', fontWeight: 900, lineHeight: 1 },
  delta:     { margin: 0, fontSize: '0.72rem', fontWeight: 700 },
  detail: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: '16px', padding: '1.25rem',
  },
  detailHead:  { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' },
  detailTitle: { margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9' },
  detailSub:   { margin: 0, fontSize: '0.68rem', color: 'rgba(148,163,184,0.5)' },
  detailScore: { margin: 0, fontSize: '1.4rem', fontWeight: 900, lineHeight: 1 },
  riskBadge: {
    display: 'inline-block', padding: '0.15rem 0.5rem',
    borderRadius: '99px', fontSize: '0.58rem', fontWeight: 800,
    border: '1px solid', letterSpacing: '0.07em',
  },
  impactsRow:   { display: 'flex', gap: '1rem' },
  impactsTitle: { margin: '0 0 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
  impactItem:   { display: 'flex', gap: '0.4rem', marginBottom: '0.3rem', alignItems: 'flex-start' },
  impactText:   { fontSize: '0.77rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.45 },
  recText:      { fontSize: '0.77rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.55, margin: 0 },
  hint: {
    margin: 0, fontSize: '0.62rem', color: 'rgba(148,163,184,0.35)',
    textAlign: 'center' as const,
  },
};
