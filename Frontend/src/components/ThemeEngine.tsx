/**
 * ThemeEngine — Full-page immersive ambient effects for every theme.
 *
 * Renders as position:fixed / z-index:-1 / pointer-events:none so it
 * sits behind ALL app content. Pages that use background:var(--bg)
 * (= transparent in the new token set) reveal this layer automatically.
 */

import { useEffect, useRef } from 'react';
import { useTheme, type ThemeId } from '../contexts/ThemeContext';

const rnd   = (lo: number, hi: number) => Math.random() * (hi - lo) + lo;
const rndI  = (lo: number, hi: number) => (Math.random() * (hi - lo + 1) + lo) | 0;
const TAU   = Math.PI * 2;

// ── Background gradients (intensified ~40% over previous) ─────────────────────

const BG: Record<ThemeId, string> = {
  'galaxy-nexus':
    `radial-gradient(ellipse at 20% 60%, rgba(110,0,240,0.68) 0%, transparent 50%),
     radial-gradient(ellipse at 80% 18%, rgba(0,90,240,0.52) 0%, transparent 45%),
     radial-gradient(ellipse at 50% 100%, rgba(0,140,240,0.38) 0%, transparent 40%),
     radial-gradient(ellipse at 5% 10%, rgba(70,0,200,0.42) 0%, transparent 40%),
     radial-gradient(ellipse at 92% 78%, rgba(0,220,255,0.22) 0%, transparent 35%),
     radial-gradient(ellipse at 60% 40%, rgba(40,0,160,0.28) 0%, transparent 45%),
     #000510`,
  'sakura-dream':
    `radial-gradient(ellipse at 25% 8%, rgba(255,200,220,0.82) 0%, transparent 50%),
     radial-gradient(ellipse at 80% 85%, rgba(255,130,170,0.68) 0%, transparent 50%),
     radial-gradient(ellipse at 60% 40%, rgba(210,80,140,0.24) 0%, transparent 55%),
     radial-gradient(ellipse at 10% 75%, rgba(255,160,200,0.42) 0%, transparent 45%),
     radial-gradient(ellipse at 95% 20%, rgba(200,60,120,0.22) 0%, transparent 35%),
     linear-gradient(170deg, #12020a 0%, #1f0513 55%, #14030c 100%)`,
  'inferno':
    `radial-gradient(ellipse at 50% 112%, rgba(255,60,0,0.94) 0%, transparent 50%),
     radial-gradient(ellipse at 15% 90%, rgba(220,30,0,0.72) 0%, transparent 40%),
     radial-gradient(ellipse at 85% 75%, rgba(255,140,0,0.55) 0%, transparent 40%),
     radial-gradient(ellipse at 30% 60%, rgba(200,20,0,0.32) 0%, transparent 50%),
     radial-gradient(ellipse at 70% 50%, rgba(255,100,0,0.26) 0%, transparent 45%),
     radial-gradient(ellipse at 50% 30%, rgba(180,40,0,0.16) 0%, transparent 40%),
     #060100`,
  'arctic-aurora':
    `radial-gradient(ellipse at 50% -5%, rgba(0,255,180,0.42) 0%, transparent 55%),
     radial-gradient(ellipse at 15% 35%, rgba(0,200,255,0.34) 0%, transparent 50%),
     radial-gradient(ellipse at 85% 45%, rgba(100,0,255,0.28) 0%, transparent 45%),
     radial-gradient(ellipse at 50% 72%, rgba(0,230,210,0.18) 0%, transparent 45%),
     radial-gradient(ellipse at 70% 10%, rgba(0,180,255,0.22) 0%, transparent 35%),
     #00060e`,
  'nature-pulse':
    `radial-gradient(ellipse at 15% 85%, rgba(20,140,20,0.72) 0%, transparent 50%),
     radial-gradient(ellipse at 85% 25%, rgba(10,110,10,0.56) 0%, transparent 50%),
     radial-gradient(ellipse at 50% 60%, rgba(5,70,5,0.36) 0%, transparent 55%),
     radial-gradient(ellipse at 70% 85%, rgba(50,170,30,0.32) 0%, transparent 40%),
     radial-gradient(ellipse at 30% 20%, rgba(20,90,10,0.26) 0%, transparent 40%),
     radial-gradient(ellipse at 50% 40%, rgba(10,60,10,0.18) 0%, transparent 45%),
     #010802`,
  'cyberpunk-neo':
    `radial-gradient(ellipse at 50% 50%, rgba(130,0,255,0.26) 0%, transparent 65%),
     radial-gradient(ellipse at 20% 80%, rgba(0,255,65,0.14) 0%, transparent 45%),
     radial-gradient(ellipse at 80% 20%, rgba(255,0,255,0.12) 0%, transparent 45%),
     radial-gradient(ellipse at 50% 0%, rgba(0,120,255,0.10) 0%, transparent 40%),
     radial-gradient(ellipse at 10% 10%, rgba(0,255,200,0.06) 0%, transparent 30%),
     #000000`,
  'ocean-intelligence':
    `radial-gradient(ellipse at 30% 75%, rgba(0,100,200,0.72) 0%, transparent 50%),
     radial-gradient(ellipse at 70% 15%, rgba(0,170,190,0.58) 0%, transparent 50%),
     radial-gradient(ellipse at 50% 50%, rgba(0,70,140,0.32) 0%, transparent 60%),
     radial-gradient(ellipse at 85% 70%, rgba(0,220,220,0.28) 0%, transparent 40%),
     radial-gradient(ellipse at 10% 30%, rgba(0,90,180,0.28) 0%, transparent 40%),
     radial-gradient(ellipse at 50% 90%, rgba(0,150,170,0.18) 0%, transparent 35%),
     #000814`,
  'neural-brain':
    `radial-gradient(ellipse at 50% 50%, rgba(90,0,180,0.58) 0%, transparent 60%),
     radial-gradient(ellipse at 20% 20%, rgba(0,140,220,0.38) 0%, transparent 50%),
     radial-gradient(ellipse at 80% 80%, rgba(120,0,220,0.32) 0%, transparent 50%),
     radial-gradient(ellipse at 50% 0%, rgba(70,0,160,0.28) 0%, transparent 55%),
     radial-gradient(ellipse at 10% 90%, rgba(0,100,200,0.26) 0%, transparent 45%),
     radial-gradient(ellipse at 90% 10%, rgba(100,0,200,0.22) 0%, transparent 40%),
     #020205`,
};

// ── CSS overlay components ────────────────────────────────────────────────────

function AuroraOverlay() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {[
        { top: '1%',  left: '3%',  w: '92%', h: '28%', c: 'rgba(0,255,180,0.34)', dur: '7s',  del: '0s'   },
        { top: '13%', left: '0%',  w: '80%', h: '22%', c: 'rgba(0,170,255,0.28)', dur: '10s', del: '2s'   },
        { top: '25%', left: '18%', w: '70%', h: '16%', c: 'rgba(110,0,255,0.24)', dur: '8s',  del: '4s'   },
        { top: '36%', left: '5%',  w: '84%', h: '14%', c: 'rgba(0,255,200,0.18)', dur: '13s', del: '1.5s' },
        { top: '46%', left: '28%', w: '55%', h: '10%', c: 'rgba(90,0,220,0.14)',  dur: '11s', del: '3s'   },
        { top: '3%',  left: '55%', w: '45%', h: '20%', c: 'rgba(0,200,255,0.22)', dur: '9s',  del: '5s'   },
      ].map((b, i) => (
        <div key={i} style={{
          position: 'absolute', top: b.top, left: b.left,
          width: b.w, height: b.h,
          background: `radial-gradient(ellipse at center, ${b.c} 0%, transparent 70%)`,
          filter: 'blur(24px)',
          animation: `aurora-wave ${b.dur} ease-in-out ${b.del} infinite alternate`,
          borderRadius: '50%',
        }} />
      ))}
    </div>
  );
}

function CyberGridOverlay() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Perspective grid */}
      <div className="cyber-grid-lines" />
      {/* Scan-line sweep */}
      <div className="cyber-scan-line" />
      {/* Data stream vertical lines */}
      {[8, 22, 38, 55, 68, 82].map((x, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: 1,
          background: `linear-gradient(180deg, transparent 0%, rgba(0,255,65,${0.1 + i*0.02}) 30%, rgba(0,255,65,${0.06 + i*0.015}) 60%, transparent 100%)`,
          animation: `cyber-scan ${4 + i * 1.2}s linear ${i * 0.7}s infinite`,
          opacity: 0.9,
        }} />
      ))}
      {/* Corner brackets */}
      {[
        { top: 16, left: 16,   borderTop: '2px solid', borderLeft:  '2px solid' },
        { top: 16, right: 16,  borderTop: '2px solid', borderRight: '2px solid' },
        { bottom: 16, left: 16,  borderBottom: '2px solid', borderLeft:  '2px solid' },
        { bottom: 16, right: 16, borderBottom: '2px solid', borderRight: '2px solid' },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute', width: 44, height: 44, opacity: 0.9,
          ...c, borderColor: '#ff00ff',
        }} />
      ))}
      {/* Central HUD circle */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 100, height: 100, marginLeft: -50, marginTop: -50,
        border: '1px solid rgba(0,255,65,0.18)',
        borderRadius: '50%',
        boxShadow: '0 0 40px rgba(0,255,65,0.12), inset 0 0 40px rgba(0,255,65,0.06)',
        animation: 'brain-pulse 3s ease-in-out infinite',
      }} />
      {/* Secondary HUD ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 180, height: 180, marginLeft: -90, marginTop: -90,
        border: '1px solid rgba(255,0,255,0.08)',
        borderRadius: '50%',
        animation: 'brain-pulse 5s ease-in-out 1s infinite',
      }} />
    </div>
  );
}

function NebulaClouds() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {[
        { top: '5%',  left: '3%',  s: 560, c: 'rgba(90,0,220,0.32)',   dur: '20s', del: '0s'  },
        { top: '25%', left: '55%', s: 480, c: 'rgba(0,90,220,0.28)',   dur: '26s', del: '4s'  },
        { top: '55%', left: '15%', s: 640, c: 'rgba(0,200,255,0.24)',  dur: '16s', del: '8s'  },
        { top: '65%', left: '65%', s: 400, c: 'rgba(140,0,255,0.30)',  dur: '22s', del: '2s'  },
        { top: '-10%',left: '35%', s: 580, c: 'rgba(0,70,200,0.26)',   dur: '30s', del: '6s'  },
        { top: '38%', left: '78%', s: 320, c: 'rgba(0,220,255,0.24)',  dur: '18s', del: '10s' },
        { top: '15%', left: '35%', s: 380, c: 'rgba(60,0,180,0.22)',   dur: '24s', del: '3s'  },
        { top: '45%', left: '42%', s: 500, c: 'rgba(120,0,255,0.18)',  dur: '28s', del: '5s'  },
        { top: '10%', left: '72%', s: 420, c: 'rgba(0,140,255,0.22)',  dur: '22s', del: '12s' },
        { top: '72%', left: '30%', s: 360, c: 'rgba(80,0,200,0.20)',   dur: '20s', del: '7s'  },
      ].map((n, i) => (
        <div key={i} style={{
          position: 'absolute', top: n.top, left: n.left,
          width: n.s, height: n.s,
          background: `radial-gradient(circle, ${n.c} 0%, transparent 70%)`,
          filter: 'blur(42px)',
          animation: `nebula-drift ${n.dur} ease-in-out ${n.del} infinite alternate`,
          borderRadius: '50%',
        }} />
      ))}
    </div>
  );
}

function OceanDepthGlow() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Deep ocean floor glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: '3%', right: '3%', height: '52%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(0,140,220,0.40) 0%, transparent 70%)',
        animation: 'ocean-pulse 5.5s ease-in-out infinite',
      }} />
      {/* Mid-ocean bioluminescent glow */}
      <div style={{
        position: 'absolute', top: '18%', left: '10%', right: '10%', height: '40%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,220,220,0.16) 0%, transparent 70%)',
        animation: 'ocean-pulse 8s ease-in-out 3s infinite',
        filter: 'blur(22px)',
      }} />
      {/* Surface shimmer */}
      <div style={{
        position: 'absolute', top: '3%', left: '15%', right: '15%', height: '20%',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(0,200,240,0.20) 0%, transparent 70%)',
        animation: 'ocean-pulse 6s ease-in-out 1.5s infinite',
        filter: 'blur(18px)',
      }} />
      {/* Side depth columns */}
      <div style={{
        position: 'absolute', top: '10%', bottom: '10%', left: 0, width: '10%',
        background: 'linear-gradient(90deg, rgba(0,90,180,0.26) 0%, transparent 100%)',
        animation: 'ocean-pulse 10s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '10%', bottom: '10%', right: 0, width: '10%',
        background: 'linear-gradient(270deg, rgba(0,90,180,0.22) 0%, transparent 100%)',
        animation: 'ocean-pulse 12s ease-in-out 2s infinite',
      }} />
    </div>
  );
}

function BrainGlow() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Central brain core */}
      <div style={{
        position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(110,0,220,0.30) 0%, transparent 70%)',
        animation: 'brain-pulse 3.5s ease-in-out infinite',
        filter: 'blur(28px)',
      }} />
      {/* Secondary neural glow */}
      <div style={{
        position: 'absolute', top: '28%', left: '25%', right: '25%', bottom: '28%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,170,255,0.22) 0%, transparent 70%)',
        animation: 'brain-pulse 5s ease-in-out 2s infinite',
        filter: 'blur(18px)',
      }} />
      {/* Third glow layer */}
      <div style={{
        position: 'absolute', top: '5%', left: '40%', right: '40%', bottom: '5%',
        background: 'radial-gradient(ellipse at 50% 30%, rgba(60,0,160,0.18) 0%, transparent 70%)',
        animation: 'brain-pulse 7s ease-in-out 1s infinite',
        filter: 'blur(35px)',
      }} />
      {/* Expanding synapse rings */}
      {[0, 1.4, 2.8, 4.2, 5.6, 7.0].map((del, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 180 + i * 80, height: 180 + i * 80,
          marginLeft: -(90 + i * 40), marginTop: -(90 + i * 40),
          border: `1px solid rgba(139,92,246,${0.16 - i * 0.022})`,
          borderRadius: '50%',
          animation: `brain-ring-expand 4s ease-out ${del}s infinite`,
        }} />
      ))}
      {/* Synaptic node orbs — active firing sites */}
      {[
        { top: '22%', left: '20%', sz: 18, c: 'rgba(139,92,246,0.85)', del: '0s'   },
        { top: '30%', left: '74%', sz: 14, c: 'rgba(0,212,255,0.75)',   del: '0.7s' },
        { top: '60%', left: '22%', sz: 16, c: 'rgba(16,185,129,0.70)',  del: '1.3s' },
        { top: '68%', left: '70%', sz: 12, c: 'rgba(139,92,246,0.80)', del: '2.0s' },
        { top: '42%', left: '50%', sz: 22, c: 'rgba(0,212,255,0.65)',   del: '2.5s' },
        { top: '16%', left: '54%', sz: 10, c: 'rgba(124,58,237,0.85)', del: '0.9s' },
        { top: '52%', left: '43%', sz: 8,  c: 'rgba(16,185,129,0.72)', del: '1.6s' },
        { top: '76%', left: '46%', sz: 14, c: 'rgba(0,212,255,0.68)',   del: '2.2s' },
      ].map((n, i) => (
        <div key={`syn-${i}`} style={{
          position: 'absolute',
          top: n.top, left: n.left,
          width: n.sz, height: n.sz,
          marginLeft: -n.sz / 2, marginTop: -n.sz / 2,
          borderRadius: '50%',
          background: n.c,
          boxShadow: `0 0 ${n.sz * 2}px ${n.c}, 0 0 ${n.sz * 4}px ${n.c.replace(/[\d.]+\)$/, '0.28)')}`,
          animation: `brain-pulse 2.5s ease-in-out ${n.del} infinite`,
        }} />
      ))}
    </div>
  );
}

function SakuraBloom() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Warm sunlight bloom from top */}
      <div style={{
        position: 'absolute', top: '-12%', left: '8%', right: '8%', height: '52%',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,220,200,0.24) 0%, transparent 70%)',
        filter: 'blur(48px)',
        animation: 'sakura-bloom 7s ease-in-out infinite alternate',
      }} />
      {/* Pink atmospheric bloom – top left */}
      <div style={{
        position: 'absolute', top: '0%', left: '-6%', width: '50%', height: '60%',
        background: 'radial-gradient(ellipse at 0% 0%, rgba(255,160,200,0.32) 0%, transparent 70%)',
        filter: 'blur(55px)',
        animation: 'sakura-bloom 9s ease-in-out 2s infinite alternate',
      }} />
      {/* Soft pink bloom – bottom right */}
      <div style={{
        position: 'absolute', bottom: '3%', right: '-2%', width: '46%', height: '50%',
        background: 'radial-gradient(ellipse at 100% 100%, rgba(255,140,180,0.28) 0%, transparent 70%)',
        filter: 'blur(52px)',
        animation: 'sakura-bloom 11s ease-in-out 4s infinite alternate',
      }} />
      {/* Centre rose haze */}
      <div style={{
        position: 'absolute', top: '32%', left: '22%', right: '22%', height: '36%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(220,80,140,0.12) 0%, transparent 70%)',
        filter: 'blur(38px)',
        animation: 'sakura-bloom 6s ease-in-out 1s infinite alternate',
      }} />
      {/* Upper-right secondary bloom */}
      <div style={{
        position: 'absolute', top: '5%', right: '5%', width: '30%', height: '30%',
        background: 'radial-gradient(ellipse at 100% 0%, rgba(255,180,210,0.20) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'sakura-bloom 8s ease-in-out 3s infinite alternate',
      }} />
    </div>
  );
}

function InfernoHeat() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Main heat core from bottom */}
      <div style={{
        position: 'absolute', bottom: '-8%', left: '10%', right: '10%', height: '62%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(255,90,0,0.45) 0%, transparent 70%)',
        filter: 'blur(32px)',
        animation: 'inferno-surge 2.8s ease-in-out infinite',
      }} />
      {/* Secondary heat – left */}
      <div style={{
        position: 'absolute', bottom: '0%', left: '-2%', width: '35%', height: '45%',
        background: 'radial-gradient(ellipse at 0% 100%, rgba(220,30,0,0.32) 0%, transparent 70%)',
        filter: 'blur(38px)',
        animation: 'inferno-surge 3.8s ease-in-out 0.7s infinite',
      }} />
      {/* Secondary heat – right */}
      <div style={{
        position: 'absolute', bottom: '0%', right: '-2%', width: '35%', height: '45%',
        background: 'radial-gradient(ellipse at 100% 100%, rgba(255,130,0,0.28) 0%, transparent 70%)',
        filter: 'blur(38px)',
        animation: 'inferno-surge 4.5s ease-in-out 1.4s infinite',
      }} />
      {/* Upper heat haze */}
      <div style={{
        position: 'absolute', top: '18%', left: '18%', right: '18%', height: '35%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(200,60,0,0.16) 0%, transparent 70%)',
        filter: 'blur(46px)',
        animation: 'inferno-surge 5.5s ease-in-out 2s infinite',
      }} />
      {/* Center amber glow */}
      <div style={{
        position: 'absolute', bottom: '20%', left: '30%', right: '30%', height: '25%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(255,180,0,0.12) 0%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'inferno-surge 3.2s ease-in-out 0.4s infinite',
      }} />
      {/* Intense core eruption */}
      <div style={{
        position: 'absolute', bottom: '-5%', left: '35%', right: '35%', height: '48%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(255,220,60,0.28) 0%, rgba(255,80,0,0.20) 40%, transparent 70%)',
        filter: 'blur(22px)',
        animation: 'inferno-surge 1.8s ease-in-out 0.2s infinite',
      }} />
      {/* Wide base heat shimmer */}
      <div style={{
        position: 'absolute', bottom: '0', left: 0, right: 0, height: '22%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(255,60,0,0.22) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'inferno-surge 2.4s ease-in-out 1s infinite',
      }} />
    </div>
  );
}

function NatureRays() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Canopy light rays */}
      {[
        { left: '12%', opacity: 0.9, dur: '5.5s', del: '0s',   rot: '-9deg' },
        { left: '25%', opacity: 0.72, dur: '7.5s', del: '1.1s', rot: '-5deg' },
        { left: '40%', opacity: 0.84, dur: '6.5s', del: '0.4s', rot: '0deg' },
        { left: '56%', opacity: 0.66, dur: '8.5s', del: '1.8s', rot: '5deg' },
        { left: '70%', opacity: 0.78, dur: '5.8s', del: '1.6s', rot: '9deg' },
        { left: '84%', opacity: 0.60, dur: '7s',   del: '2.5s', rot: '13deg' },
      ].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, left: r.left,
          width: 4, height: '70%',
          background: `linear-gradient(180deg, rgba(80,220,60,${r.opacity * 0.28}) 0%, rgba(40,180,30,${r.opacity * 0.14}) 60%, transparent 100%)`,
          filter: 'blur(12px)',
          transform: `rotate(${r.rot})`,
          transformOrigin: 'top center',
          animation: `nature-ray ${r.dur} ease-in-out ${r.del} infinite alternate`,
        }} />
      ))}
      {/* Forest floor ambient glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(10,70,10,0.46) 0%, transparent 70%)',
        filter: 'blur(28px)',
        animation: 'ocean-pulse 7s ease-in-out infinite',
      }} />
      {/* Canopy top ambient */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '20%',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(20,100,10,0.28) 0%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'ocean-pulse 9s ease-in-out 2s infinite',
      }} />
    </div>
  );
}

// ── Canvas particle systems ───────────────────────────────────────────────────

type Cleanup = () => void;

// Galaxy — stars + shooting stars + constellation lines
function startGalaxy(canvas: HTMLCanvasElement): Cleanup {
  const ctx = canvas.getContext('2d')!;
  const N = 300;
  type Star = { x:number;y:number;r:number;op:number;tw:number;twDir:number;color:string };
  const colors = ['#ffffff','#cceeff','#aaddff','#9966ff','#6699ff','#bbaaff','#88ccff'];
  const stars: Star[] = Array.from({length:N},()=>({
    x: rnd(0,canvas.width), y: rnd(0,canvas.height),
    r: rnd(0.3,2.6), op: rnd(0.2,1),
    tw: rnd(0.004,0.018), twDir: Math.random()>0.5?1:-1,
    color: colors[rndI(0,colors.length-1)],
  }));

  // Build a few constellation "edges" between nearby bright stars
  const brightStars = stars.filter(s => s.r > 1.8);
  const constellEdges: [Star,Star][] = [];
  for (let a = 0; a < brightStars.length; a++) {
    for (let b = a+1; b < brightStars.length; b++) {
      const dx = brightStars[a].x - brightStars[b].x;
      const dy = brightStars[a].y - brightStars[b].y;
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d < 130 && constellEdges.length < 30) constellEdges.push([brightStars[a], brightStars[b]]);
    }
  }

  // Shooting star state
  type Shoot = { active:boolean; x:number;y:number;vx:number;vy:number;op:number;timer:number };
  let shoot: Shoot = { active:false, x:0,y:0,vx:0,vy:0,op:0,timer:0 };
  let af = 0;
  function tick() {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Constellation lines (very faint)
    for (const [a,b] of constellEdges) {
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
      ctx.strokeStyle = `rgba(140,160,255,${(a.op + b.op) * 0.025})`;
      ctx.lineWidth = 0.6; ctx.stroke();
    }

    // Stars
    for (const s of stars) {
      s.op = Math.max(0.1,Math.min(1,s.op + s.tw * s.twDir));
      if (s.op>=1||s.op<=0.1) s.twDir*=-1;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,TAU);
      if (s.r>1.5) {
        const g = ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*3.5);
        g.addColorStop(0,s.color); g.addColorStop(1,'transparent');
        ctx.fillStyle=g;
      } else ctx.fillStyle=s.color;
      ctx.globalAlpha=s.op; ctx.fill();
    }

    // Shooting star
    shoot.timer++;
    if (!shoot.active && shoot.timer > rndI(150,500)) {
      shoot = { active:true, x:rnd(0,canvas.width*0.6), y:rnd(0,canvas.height*0.25),
        vx:rnd(7,16), vy:rnd(3,9), op:1, timer:0 };
    }
    if (shoot.active) {
      ctx.globalAlpha=shoot.op;
      const g=ctx.createLinearGradient(shoot.x,shoot.y,shoot.x-shoot.vx*10,shoot.y-shoot.vy*10);
      g.addColorStop(0,'#bbddff'); g.addColorStop(0.5,'rgba(120,180,255,0.4)'); g.addColorStop(1,'transparent');
      ctx.strokeStyle=g; ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.moveTo(shoot.x,shoot.y);
      ctx.lineTo(shoot.x-shoot.vx*10,shoot.y-shoot.vy*10); ctx.stroke();
      shoot.x+=shoot.vx; shoot.y+=shoot.vy; shoot.op-=0.035;
      if (shoot.op<=0) { shoot.active=false; shoot.timer=0; }
    }
    ctx.globalAlpha=1;
    af=requestAnimationFrame(tick);
  }
  tick();
  return ()=>cancelAnimationFrame(af);
}

// Sakura — falling petals (more petals, varied shapes)
function startSakura(canvas: HTMLCanvasElement): Cleanup {
  const ctx = canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  type Petal={ x:number;y:number;vy:number;vx:number;sway:number;sp:number;rot:number;rs:number;sz:number;op:number;hue:number;type:number };
  const make=():Petal=>({
    x:rnd(-60,W+60), y:rnd(-100,H*0.15),
    vy:rnd(0.7,2.4), vx:rnd(-0.5,0.5),
    sway:rnd(0.5,2.0), sp:rnd(0,TAU),
    rot:rnd(0,TAU), rs:rnd(-0.04,0.04),
    sz:rnd(5,14), op:rnd(0.45,0.95), hue:rndI(335,365), type:rndI(0,2),
  });
  const petals:Petal[]=Array.from({length:90},make);
  let af=0;
  function drawPetal(p:Petal){
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
    ctx.beginPath();
    if (p.type===0) {
      ctx.ellipse(0,0,p.sz*0.42,p.sz,0,0,TAU);
    } else if (p.type===1) {
      // Heart-like petal
      ctx.moveTo(0,-p.sz*0.5);
      ctx.bezierCurveTo(p.sz*0.5,-p.sz, p.sz*0.7,-p.sz*0.2, 0, p.sz*0.6);
      ctx.bezierCurveTo(-p.sz*0.7,-p.sz*0.2, -p.sz*0.5,-p.sz, 0,-p.sz*0.5);
    } else {
      ctx.ellipse(0,0,p.sz*0.35,p.sz*0.9,Math.PI*0.2,0,TAU);
    }
    ctx.fillStyle=`hsla(${p.hue%360},75%,84%,${p.op})`;
    ctx.shadowColor=`hsla(${p.hue%360},80%,70%,0.35)`;
    ctx.shadowBlur=8; ctx.fill(); ctx.restore();
  }
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const p of petals){
      p.sp+=0.018; p.x+=Math.sin(p.sp)*p.sway+p.vx; p.y+=p.vy; p.rot+=p.rs;
      if(p.y>H+80) Object.assign(p,make(),{y:-80});
      drawPetal(p);
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// Inferno — fire particles + ember sparks
function startInferno(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  type Ember={ x:number;y:number;vx:number;vy:number;sz:number;life:number;maxLife:number;isFlame:boolean };
  const make=():Ember=>({
    x:rnd(W*0.05,W*0.95), y:H+10,
    vx:rnd(-2.0,2.0), vy:rnd(-3.5,-0.7),
    sz:rnd(1.2,7), life:0, maxLife:rnd(55,150), isFlame:Math.random()>0.4,
  });
  const embers:Ember[]=Array.from({length:220},()=>{const e=make();e.y=rnd(H*0.2,H);return e;});
  let af=0;
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const e of embers){
      e.life++; e.x+=e.vx; e.y+=e.vy; e.vx+=rnd(-0.12,0.12);
      if(e.life>=e.maxLife) Object.assign(e,make());
      const t=e.life/e.maxLife;
      const r=e.sz*(1-t*0.75);
      const alpha=(1-t*0.88)*0.9;
      if (e.isFlame) {
        const g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,r*2.2);
        g.addColorStop(0,`rgba(255,240,100,${alpha})`);
        g.addColorStop(0.3,`rgba(255,100,0,${alpha*0.85})`);
        g.addColorStop(0.7,`rgba(220,30,0,${alpha*0.4})`);
        g.addColorStop(1,'transparent');
        ctx.beginPath(); ctx.arc(e.x,e.y,r*2.2,0,TAU);
        ctx.fillStyle=g; ctx.fill();
      } else {
        // Bright spark
        ctx.beginPath(); ctx.arc(e.x,e.y,r*0.6,0,TAU);
        ctx.fillStyle=`rgba(255,220,80,${alpha*1.2})`;
        ctx.shadowColor='rgba(255,140,0,0.8)'; ctx.shadowBlur=6;
        ctx.fill(); ctx.shadowBlur=0;
      }
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// Arctic Aurora — snow + ice crystals
function startArcticSnow(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  type Flake={ x:number;y:number;vy:number;sway:number;sp:number;r:number;op:number;isCrystal:boolean };
  const make=():Flake=>({
    x:rnd(0,W), y:rnd(-25,H),
    vy:rnd(0.35,1.6), sway:rnd(0.3,1.4), sp:rnd(0,TAU),
    r:rnd(0.8,4), op:rnd(0.3,0.95), isCrystal:Math.random()>0.85,
  });
  const flakes:Flake[]=Array.from({length:150},make);
  let af=0;
  function drawCrystal(x:number,y:number,r:number,op:number){
    ctx.save(); ctx.translate(x,y);
    ctx.strokeStyle=`rgba(180,240,255,${op})`;
    ctx.lineWidth=0.8;
    for(let a=0;a<6;a++){
      ctx.save(); ctx.rotate(a*Math.PI/3);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-r*2.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-r*1.2); ctx.lineTo(r*0.6,-r*1.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-r*1.2); ctx.lineTo(-r*0.6,-r*1.7); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const f of flakes){
      f.sp+=0.014; f.x+=Math.sin(f.sp)*f.sway; f.y+=f.vy;
      if(f.y>H+15) Object.assign(f,make(),{y:-15});
      if (f.isCrystal) {
        drawCrystal(f.x,f.y,f.r,f.op*0.7);
      } else {
        ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,TAU);
        ctx.fillStyle=`rgba(200,240,255,${f.op})`; ctx.fill();
      }
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// Nature — falling leaves (more variety)
function startNature(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  const COLORS=[
    'rgba(34,139,34,0.82)','rgba(56,168,56,0.78)','rgba(80,190,40,0.82)',
    'rgba(120,200,60,0.72)','rgba(200,185,40,0.68)','rgba(140,200,30,0.76)',
    'rgba(45,160,45,0.80)',
  ];
  type Leaf={ x:number;y:number;vx:number;vy:number;sway:number;sp:number;rot:number;rs:number;sz:number;color:string;aspect:number };
  const make=():Leaf=>({
    x:rnd(-40,W+40), y:rnd(-70,H*0.25),
    vx:rnd(-0.7,0.7), vy:rnd(0.5,2.0),
    sway:rnd(0.4,1.8), sp:rnd(0,TAU),
    rot:rnd(0,TAU), rs:rnd(-0.05,0.05),
    sz:rnd(6,16), color:COLORS[rndI(0,COLORS.length-1)],
    aspect: rnd(0.28,0.55),
  });
  const leaves:Leaf[]=Array.from({length:70},make);
  let af=0;
  function drawLeaf(l:Leaf){
    ctx.save(); ctx.translate(l.x,l.y); ctx.rotate(l.rot);
    ctx.beginPath(); ctx.ellipse(0,0,l.sz*l.aspect,l.sz,0,0,TAU);
    ctx.fillStyle=l.color;
    // leaf vein
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,-l.sz); ctx.lineTo(0,l.sz);
    ctx.strokeStyle=`rgba(255,255,255,0.12)`; ctx.lineWidth=0.6; ctx.stroke();
    ctx.restore();
  }
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const l of leaves){
      l.sp+=0.016; l.x+=Math.sin(l.sp)*l.sway+l.vx; l.y+=l.vy; l.rot+=l.rs;
      if(l.y>H+50) Object.assign(l,make(),{y:-50});
      drawLeaf(l);
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// Cyberpunk — digital rain (faster, more vivid)
function startCyberpunk(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  const FS=13; const COLS=Math.ceil(W/FS);
  const drops=Array.from({length:COLS},()=>rnd(0,H/FS)|0);
  const speeds=Array.from({length:COLS},()=>rndI(1,3));
  const CHARS='アイウエオカキクケコサシスセソ01アBCDEF!@#$%^&*<>アイ01ウエ01カ';
  const CHARS2='01ABCDEF01234567890xFFDEAD#@!01ABCDEF';
  let af=0; let frame=0;
  function tick(){
    frame++;
    if(frame%2!==0){af=requestAnimationFrame(tick);return;}
    ctx.fillStyle='rgba(0,0,0,0.055)'; ctx.fillRect(0,0,W,H);
    for(let c=0;c<COLS;c++){
      const y=drops[c]*FS;
      const ch=CHARS[rndI(0,CHARS.length-1)];
      // bright head with glow
      ctx.shadowColor='#00ff41'; ctx.shadowBlur=8;
      ctx.fillStyle='#ccffcc'; ctx.font=`bold ${FS}px monospace`;
      ctx.globalAlpha=0.95; ctx.fillText(ch,c*FS,y);
      ctx.shadowBlur=0;
      // trail
      ctx.fillStyle='#00ff41'; ctx.globalAlpha=0.55;
      ctx.fillText(CHARS2[rndI(0,CHARS2.length-1)],c*FS,y-FS);
      // second trail
      ctx.fillStyle='#00aa22'; ctx.globalAlpha=0.28;
      ctx.fillText(CHARS[rndI(0,CHARS.length-1)],c*FS,y-FS*2);
      ctx.globalAlpha=1;
      if(y>H && Math.random()>0.972) drops[c]=0;
      else drops[c]+=speeds[c];
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// Ocean — rising bubbles + bioluminescent particles
function startOcean(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  type Bubble={ x:number;y:number;vy:number;wob:number;wp:number;r:number;op:number };
  const makeBubble=():Bubble=>({
    x:rnd(0,W), y:H+25,
    vy:rnd(0.25,1.4), wob:rnd(0.5,2.2), wp:rnd(0,TAU),
    r:rnd(2,22), op:rnd(0.08,0.50),
  });
  const bubbles:Bubble[]=Array.from({length:80},()=>{const b=makeBubble();b.y=rnd(0,H);return b;});
  type Biolum={ x:number;y:number;life:number;maxLife:number;sz:number;hue:number };
  const bios:Biolum[]=Array.from({length:45},()=>({
    x:rnd(0,W), y:rnd(0,H), life:rndI(0,120), maxLife:rndI(70,220), sz:rnd(2,10), hue:rndI(168,215),
  }));
  let af=0;
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const b of bubbles){
      b.wp+=0.018; b.x+=Math.sin(b.wp)*b.wob; b.y-=b.vy;
      if(b.y<-35) Object.assign(b,makeBubble());
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,TAU);
      ctx.strokeStyle=`rgba(80,210,240,${b.op})`; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle=`rgba(100,230,255,${b.op*0.12})`; ctx.fill();
      // highlight
      ctx.beginPath(); ctx.arc(b.x-b.r*0.3,b.y-b.r*0.35,b.r*0.22,0,TAU);
      ctx.fillStyle=`rgba(200,240,255,${b.op*0.5})`; ctx.fill();
    }
    for(const bio of bios){
      bio.life++;
      if(bio.life>=bio.maxLife){ bio.life=0; bio.x=rnd(0,W); bio.y=rnd(0,H); }
      const t=bio.life/bio.maxLife;
      const op=Math.sin(t*Math.PI)*0.85;
      const g=ctx.createRadialGradient(bio.x,bio.y,0,bio.x,bio.y,bio.sz*3.5);
      g.addColorStop(0,`hsla(${bio.hue},100%,72%,${op})`);
      g.addColorStop(0.5,`hsla(${bio.hue},90%,55%,${op*0.4})`);
      g.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(bio.x,bio.y,bio.sz*3.5,0,TAU);
      ctx.fillStyle=g; ctx.fill();
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// Neural — animated network of nodes + traveling pulses
function startNeural(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  const NODE_COUNT=60;
  type Node={ x:number;y:number;vx:number;vy:number;sz:number;ph:number;glow:number;glowDir:number };
  type Pulse={ from:number;to:number;prog:number;speed:number;op:number;hue:number };
  const nodes:Node[]=Array.from({length:NODE_COUNT},()=>({
    x:rnd(W*0.04,W*0.96), y:rnd(H*0.04,H*0.96),
    vx:rnd(-0.15,0.15), vy:rnd(-0.15,0.15),
    sz:rnd(1.8,6.5), ph:rnd(0,TAU),
    glow:rnd(0.3,1), glowDir:Math.random()>0.5?1:-1,
  }));
  const MAX_DIST = 270;
  // Build edges
  const edges:[number,number][]=[];
  for(let a=0;a<NODE_COUNT;a++)for(let b=a+1;b<NODE_COUNT;b++){
    const dx=nodes[a].x-nodes[b].x, dy=nodes[a].y-nodes[b].y;
    if(Math.sqrt(dx*dx+dy*dy)<MAX_DIST) edges.push([a,b]);
  }
  const pulses:Pulse[]=[];
  let pTimer=0;
  let af=0;
  function tick(){
    ctx.clearRect(0,0,W,H);

    // Slowly drift nodes
    for(const n of nodes){
      n.x+=n.vx; n.y+=n.vy;
      if(n.x<0||n.x>W) n.vx*=-1;
      if(n.y<0||n.y>H) n.vy*=-1;
    }

    // Edges
    for(const [a,b] of edges){
      const ax=nodes[a].x,ay=nodes[a].y,bx=nodes[b].x,by=nodes[b].y;
      const dx=bx-ax,dy=by-ay,dist=Math.sqrt(dx*dx+dy*dy);
      const alpha=Math.max(0,(MAX_DIST-dist)/MAX_DIST)*0.22;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by);
      ctx.strokeStyle=`rgba(130,70,230,${alpha})`; ctx.lineWidth=0.9; ctx.stroke();
    }

    // Nodes
    for(const n of nodes){
      n.ph+=0.02; n.glow=Math.max(0.2,Math.min(1,n.glow+0.012*n.glowDir));
      if(n.glow>=1||n.glow<=0.2) n.glowDir*=-1;
      const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.sz*4.5);
      g.addColorStop(0,`rgba(170,90,255,${n.glow})`);
      g.addColorStop(0.35,`rgba(90,130,255,${n.glow*0.45})`);
      g.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(n.x,n.y,n.sz*4.5,0,TAU);
      ctx.fillStyle=g; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x,n.y,n.sz,0,TAU);
      ctx.fillStyle=`rgba(210,170,255,${n.glow})`; ctx.fill();
    }

    // Pulses
    pTimer++;
    if(pTimer%15===0 && pulses.length<35 && edges.length>0){
      const [a,b]=edges[rndI(0,edges.length-1)];
      pulses.push({from:a,to:b,prog:0,speed:rnd(0.007,0.024),op:1,hue:rndI(240,300)});
    }
    for(let i=pulses.length-1;i>=0;i--){
      const p=pulses[i]; p.prog+=p.speed;
      if(p.prog>=1){pulses.splice(i,1);continue;}
      const a=nodes[p.from],b=nodes[p.to];
      const px=a.x+(b.x-a.x)*p.prog, py=a.y+(b.y-a.y)*p.prog;
      const g2=ctx.createRadialGradient(px,py,0,px,py,10);
      g2.addColorStop(0,`hsla(${p.hue},100%,72%,${p.op})`);
      g2.addColorStop(0.5,`hsla(${p.hue},80%,55%,${p.op*0.5})`);
      g2.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(px,py,10,0,TAU);
      ctx.fillStyle=g2; ctx.fill();
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// ── Canvas dispatcher ─────────────────────────────────────────────────────────

function startParticles(id: ThemeId, canvas: HTMLCanvasElement): Cleanup {
  switch(id){
    case 'galaxy-nexus':       return startGalaxy(canvas);
    case 'sakura-dream':       return startSakura(canvas);
    case 'inferno':            return startInferno(canvas);
    case 'arctic-aurora':      return startArcticSnow(canvas);
    case 'nature-pulse':       return startNature(canvas);
    case 'cyberpunk-neo':      return startCyberpunk(canvas);
    case 'ocean-intelligence': return startOcean(canvas);
    case 'neural-brain':       return startNeural(canvas);
    default:                   return ()=>{};
  }
}

// ── CSS overlay per theme ─────────────────────────────────────────────────────

function Overlay({ id }: { id: ThemeId }) {
  if (id === 'arctic-aurora')      return <AuroraOverlay />;
  if (id === 'cyberpunk-neo')      return <CyberGridOverlay />;
  if (id === 'galaxy-nexus')       return <NebulaClouds />;
  if (id === 'ocean-intelligence') return <OceanDepthGlow />;
  if (id === 'neural-brain')       return <BrainGlow />;
  if (id === 'sakura-dream')       return <SakuraBloom />;
  if (id === 'inferno')            return <InfernoHeat />;
  if (id === 'nature-pulse')       return <NatureRays />;
  return null;
}

// ── Keyframe injection ────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes aurora-wave {
  0%   { transform: translateX(-10%) scaleY(1)   skewX(-4deg); opacity: 0.55; }
  50%  { transform: translateX(6%)   scaleY(1.4) skewX(5deg);  opacity: 1;    }
  100% { transform: translateX(10%)  scaleY(0.75) skewX(-3deg); opacity: 0.65; }
}
@keyframes nebula-drift {
  0%   { transform: translate(0,0)        scale(1);    opacity: 0.75; }
  33%  { transform: translate(50px,-35px) scale(1.14); opacity: 1;    }
  66%  { transform: translate(-30px,25px) scale(0.88); opacity: 0.68; }
  100% { transform: translate(0,0)        scale(1);    opacity: 0.75; }
}
@keyframes ocean-pulse {
  0%,100% { opacity: 0.55; transform: scaleX(1); }
  50%     { opacity: 1;    transform: scaleX(1.10); }
}
@keyframes brain-pulse {
  0%,100% { opacity: 0.45; transform: scale(1); }
  50%     { opacity: 1;    transform: scale(1.14); }
}
@keyframes brain-ring-expand {
  0%   { transform: scale(0.75); opacity: 0.55; }
  100% { transform: scale(2.8);  opacity: 0;   }
}
@keyframes sakura-bloom {
  0%   { opacity: 0.5;  transform: scale(1)    translateY(0);     }
  50%  { opacity: 1;    transform: scale(1.12) translateY(-12px); }
  100% { opacity: 0.65; transform: scale(1.05) translateY(-5px);  }
}
@keyframes inferno-surge {
  0%,100% { opacity: 0.5;  transform: scaleY(1)    scaleX(1);    }
  50%     { opacity: 1;    transform: scaleY(1.18) scaleX(1.08); }
}
@keyframes nature-ray {
  0%   { opacity: 0.4;  transform: rotate(-7deg) scaleX(0.85); }
  100% { opacity: 0.92; transform: rotate(7deg)  scaleX(1.35); }
}
.cyber-grid-lines {
  position: absolute; inset: 0;
  background:
    linear-gradient(rgba(255,0,255,0.14) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,255,65,0.12) 1px, transparent 1px);
  background-size: 60px 60px;
  transform: perspective(600px) rotateX(35deg);
  transform-origin: 50% 0%;
  opacity: 0.85;
}
.cyber-scan-line {
  position: absolute; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0,255,255,1.0), rgba(0,255,65,0.6), rgba(0,255,255,1.0), transparent);
  animation: cyber-scan 3.5s linear infinite;
  box-shadow: 0 0 24px rgba(0,255,255,0.85), 0 0 48px rgba(0,255,65,0.3);
}
@keyframes cyber-scan {
  0%   { top: -2px; }
  100% { top: 100%; }
}
`;

// ── Main component ────────────────────────────────────────────────────────────

export default function ThemeEngine() {
  const { themeId } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    let cancel = startParticles(themeId, canvas);

    const handleResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      cancel();
      cancel = startParticles(themeId, canvas);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancel();
    };
  }, [themeId]);

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div style={{ position:'fixed', inset:0, zIndex:-1, pointerEvents:'none', overflow:'hidden' }}>
        {/* Background gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: BG[themeId],
          transition: 'background 1s ease',
        }} />

        {/* CSS overlay effects */}
        <Overlay id={themeId} />

        {/* Particle canvas */}
        <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />
      </div>
    </>
  );
}
