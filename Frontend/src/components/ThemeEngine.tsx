/**
 * ThemeEngine — Full-page immersive ambient effects for every theme.
 *
 * Renders as position:fixed / z-index:-1 / pointer-events:none so it
 * sits behind ALL app content. Pages that use background:var(--bg)
 * (= transparent in the new token set) reveal this layer automatically.
 * Feature pages that hardcode a dark background still pick up accent
 * colour, glow, hover, and nav changes from the CSS variable overrides.
 */

import { useEffect, useRef } from 'react';
import { useTheme, type ThemeId } from '../contexts/ThemeContext';

// ── tiny math helpers ─────────────────────────────────────────────────────────

const rnd   = (lo: number, hi: number) => Math.random() * (hi - lo) + lo;
const rndI  = (lo: number, hi: number) => (Math.random() * (hi - lo + 1) + lo) | 0;
const TAU   = Math.PI * 2;

// ── background gradient strings ───────────────────────────────────────────────

const BG: Record<ThemeId, string> = {
  'galaxy-nexus':
    `radial-gradient(ellipse at 20% 60%, rgba(100,0,220,0.52) 0%, transparent 50%),
     radial-gradient(ellipse at 80% 18%, rgba(0,80,220,0.4) 0%, transparent 45%),
     radial-gradient(ellipse at 50% 100%, rgba(0,120,220,0.28) 0%, transparent 40%),
     radial-gradient(ellipse at 5% 10%, rgba(60,0,180,0.3) 0%, transparent 40%),
     radial-gradient(ellipse at 92% 78%, rgba(0,200,255,0.14) 0%, transparent 35%),
     #000510`,
  'sakura-dream':
    `radial-gradient(ellipse at 25% 8%, rgba(255,200,220,0.65) 0%, transparent 50%),
     radial-gradient(ellipse at 80% 85%, rgba(255,130,170,0.48) 0%, transparent 50%),
     radial-gradient(ellipse at 60% 40%, rgba(200,80,130,0.14) 0%, transparent 55%),
     radial-gradient(ellipse at 10% 75%, rgba(255,160,200,0.28) 0%, transparent 45%),
     linear-gradient(170deg, #12020a 0%, #1f0513 55%, #14030c 100%)`,
  'inferno':
    `radial-gradient(ellipse at 50% 112%, rgba(255,60,0,0.8) 0%, transparent 50%),
     radial-gradient(ellipse at 15% 90%, rgba(200,30,0,0.52) 0%, transparent 40%),
     radial-gradient(ellipse at 85% 75%, rgba(255,140,0,0.38) 0%, transparent 40%),
     radial-gradient(ellipse at 30% 60%, rgba(180,20,0,0.22) 0%, transparent 50%),
     radial-gradient(ellipse at 70% 50%, rgba(255,100,0,0.16) 0%, transparent 45%),
     #060100`,
  'arctic-aurora':
    `radial-gradient(ellipse at 50% -5%, rgba(0,255,180,0.3) 0%, transparent 55%),
     radial-gradient(ellipse at 15% 35%, rgba(0,180,255,0.24) 0%, transparent 50%),
     radial-gradient(ellipse at 85% 45%, rgba(80,0,255,0.2) 0%, transparent 45%),
     radial-gradient(ellipse at 50% 72%, rgba(0,220,200,0.12) 0%, transparent 45%),
     #00060e`,
  'nature-pulse':
    `radial-gradient(ellipse at 15% 85%, rgba(82,255,184,0.09) 0%, transparent 50%),
     radial-gradient(ellipse at 85% 15%, rgba(82,255,184,0.07) 0%, transparent 45%),
     radial-gradient(ellipse at 50% 50%, rgba(30,60,40,0.12) 0%, transparent 60%),
     radial-gradient(ellipse at 5% 50%, rgba(82,255,184,0.05) 0%, transparent 40%),
     radial-gradient(ellipse at 95% 55%, rgba(82,255,184,0.04) 0%, transparent 40%),
     #0B0F0E`,
  'cyberpunk-neo':
    `radial-gradient(ellipse at 50% 50%, rgba(120,0,240,0.2) 0%, transparent 65%),
     radial-gradient(ellipse at 20% 80%, rgba(0,255,65,0.09) 0%, transparent 45%),
     radial-gradient(ellipse at 80% 20%, rgba(255,0,255,0.08) 0%, transparent 45%),
     radial-gradient(ellipse at 50% 0%, rgba(0,100,255,0.07) 0%, transparent 40%),
     #000000`,
  'ocean-intelligence':
    `radial-gradient(ellipse at 30% 75%, rgba(0,90,180,0.58) 0%, transparent 50%),
     radial-gradient(ellipse at 70% 15%, rgba(0,150,170,0.45) 0%, transparent 50%),
     radial-gradient(ellipse at 50% 50%, rgba(0,60,120,0.24) 0%, transparent 60%),
     radial-gradient(ellipse at 85% 70%, rgba(0,200,200,0.2) 0%, transparent 40%),
     radial-gradient(ellipse at 10% 30%, rgba(0,80,160,0.2) 0%, transparent 40%),
     #000814`,
  'neural-brain':
    `radial-gradient(ellipse at 50% 50%, rgba(80,0,160,0.45) 0%, transparent 60%),
     radial-gradient(ellipse at 20% 20%, rgba(0,120,200,0.3) 0%, transparent 50%),
     radial-gradient(ellipse at 80% 80%, rgba(100,0,200,0.24) 0%, transparent 50%),
     radial-gradient(ellipse at 50% 0%, rgba(60,0,140,0.2) 0%, transparent 55%),
     radial-gradient(ellipse at 10% 90%, rgba(0,80,180,0.2) 0%, transparent 45%),
     #020205`,
};

// ── CSS overlay components (aurora waves, cyber grid, etc.) ───────────────────

function AuroraOverlay() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {[
        { top: '2%',  left: '5%',  w: '90%', h: '22%', c: 'rgba(0,255,180,0.24)', dur: '8s',  del: '0s'   },
        { top: '14%', left: '0%',  w: '78%', h: '17%', c: 'rgba(0,160,255,0.2)',  dur: '11s', del: '2s'   },
        { top: '26%', left: '20%', w: '68%', h: '13%', c: 'rgba(100,0,255,0.17)', dur: '9s',  del: '4s'   },
        { top: '38%', left: '5%',  w: '82%', h: '11%', c: 'rgba(0,255,200,0.12)', dur: '14s', del: '1.5s' },
        { top: '48%', left: '30%', w: '52%', h: '8%',  c: 'rgba(80,0,200,0.1)',   dur: '12s', del: '3s'   },
      ].map((b, i) => (
        <div key={i} style={{
          position: 'absolute', top: b.top, left: b.left,
          width: b.w, height: b.h,
          background: `radial-gradient(ellipse at center, ${b.c} 0%, transparent 70%)`,
          filter: 'blur(26px)',
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
      {[15, 35, 55, 75, 90].map((x, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: 1,
          background: `linear-gradient(180deg, transparent 0%, rgba(0,255,65,${0.04 + i*0.01}) 30%, transparent 100%)`,
          animation: `cyber-scan ${5 + i * 1.5}s linear ${i * 0.8}s infinite`,
          opacity: 0.5,
        }} />
      ))}
      {/* Corner brackets */}
      {[
        { top: 20, left: 20,   borderTop: '2px solid', borderLeft:  '2px solid' },
        { top: 20, right: 20,  borderTop: '2px solid', borderRight: '2px solid' },
        { bottom: 20, left: 20,  borderBottom: '2px solid', borderLeft:  '2px solid' },
        { bottom: 20, right: 20, borderBottom: '2px solid', borderRight: '2px solid' },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute', width: 36, height: 36, opacity: 0.55,
          ...c, borderColor: '#ff00ff',
        }} />
      ))}
      {/* Central HUD cross */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 80, height: 80, marginLeft: -40, marginTop: -40,
        border: '1px solid rgba(0,255,65,0.12)',
        borderRadius: '50%',
        boxShadow: '0 0 30px rgba(0,255,65,0.08), inset 0 0 30px rgba(0,255,65,0.04)',
        animation: 'brain-pulse 3s ease-in-out infinite',
      }} />
    </div>
  );
}

function NebulaClouds() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {[
        { top: '8%',  left: '5%',  s: 500, c: 'rgba(80,0,200,0.16)',   dur: '22s', del: '0s'  },
        { top: '28%', left: '58%', s: 420, c: 'rgba(0,80,200,0.14)',   dur: '28s', del: '4s'  },
        { top: '58%', left: '18%', s: 580, c: 'rgba(0,180,255,0.1)',   dur: '18s', del: '8s'  },
        { top: '68%', left: '68%', s: 360, c: 'rgba(120,0,255,0.16)',  dur: '25s', del: '2s'  },
        { top: '-8%', left: '38%', s: 520, c: 'rgba(0,60,180,0.13)',   dur: '32s', del: '6s'  },
        { top: '40%', left: '80%', s: 280, c: 'rgba(0,200,255,0.1)',   dur: '20s', del: '10s' },
      ].map((n, i) => (
        <div key={i} style={{
          position: 'absolute', top: n.top, left: n.left,
          width: n.s, height: n.s,
          background: `radial-gradient(circle, ${n.c} 0%, transparent 70%)`,
          filter: 'blur(45px)',
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
        position: 'absolute', bottom: 0, left: '5%', right: '5%', height: '45%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(0,120,200,0.28) 0%, transparent 70%)',
        animation: 'ocean-pulse 6s ease-in-out infinite',
      }} />
      {/* Mid-ocean bioluminescent glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '15%', right: '15%', height: '35%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,200,200,0.1) 0%, transparent 70%)',
        animation: 'ocean-pulse 9s ease-in-out 3s infinite',
        filter: 'blur(25px)',
      }} />
      {/* Surface shimmer */}
      <div style={{
        position: 'absolute', top: '5%', left: '20%', right: '20%', height: '15%',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(0,180,220,0.14) 0%, transparent 70%)',
        animation: 'ocean-pulse 7s ease-in-out 1.5s infinite',
        filter: 'blur(20px)',
      }} />
      {/* Side depth columns */}
      <div style={{
        position: 'absolute', top: '15%', bottom: '15%', left: 0, width: '8%',
        background: 'linear-gradient(90deg, rgba(0,80,160,0.18) 0%, transparent 100%)',
        animation: 'ocean-pulse 11s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '15%', bottom: '15%', right: 0, width: '8%',
        background: 'linear-gradient(270deg, rgba(0,80,160,0.15) 0%, transparent 100%)',
        animation: 'ocean-pulse 13s ease-in-out 2s infinite',
      }} />
    </div>
  );
}

function BrainGlow() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Central brain core */}
      <div style={{
        position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(100,0,200,0.2) 0%, transparent 70%)',
        animation: 'brain-pulse 4s ease-in-out infinite',
        filter: 'blur(30px)',
      }} />
      {/* Secondary neural glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '30%', right: '30%', bottom: '30%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,150,255,0.14) 0%, transparent 70%)',
        animation: 'brain-pulse 6s ease-in-out 2s infinite',
        filter: 'blur(20px)',
      }} />
      {/* Expanding synapse rings */}
      {[0, 1.5, 3].map((del, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 200 + i * 80, height: 200 + i * 80,
          marginLeft: -(100 + i * 40), marginTop: -(100 + i * 40),
          border: `1px solid rgba(139,92,246,${0.12 - i * 0.03})`,
          borderRadius: '50%',
          animation: `brain-ring-expand 4s ease-out ${del}s infinite`,
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
        position: 'absolute', top: '-10%', left: '10%', right: '10%', height: '45%',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,210,190,0.16) 0%, transparent 70%)',
        filter: 'blur(50px)',
        animation: 'sakura-bloom 8s ease-in-out infinite alternate',
      }} />
      {/* Pink atmospheric bloom – top left */}
      <div style={{
        position: 'absolute', top: '0%', left: '-5%', width: '45%', height: '55%',
        background: 'radial-gradient(ellipse at 0% 0%, rgba(255,160,195,0.22) 0%, transparent 70%)',
        filter: 'blur(60px)',
        animation: 'sakura-bloom 10s ease-in-out 2s infinite alternate',
      }} />
      {/* Soft pink bloom – bottom right */}
      <div style={{
        position: 'absolute', bottom: '5%', right: '0%', width: '40%', height: '45%',
        background: 'radial-gradient(ellipse at 100% 100%, rgba(255,140,175,0.18) 0%, transparent 70%)',
        filter: 'blur(55px)',
        animation: 'sakura-bloom 12s ease-in-out 4s infinite alternate',
      }} />
      {/* Gentle centre haze */}
      <div style={{
        position: 'absolute', top: '35%', left: '25%', right: '25%', height: '30%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(200,80,130,0.07) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'sakura-bloom 7s ease-in-out 1s infinite alternate',
      }} />
    </div>
  );
}

function InfernoHeat() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Main heat core from bottom */}
      <div style={{
        position: 'absolute', bottom: '-5%', left: '15%', right: '15%', height: '55%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(255,80,0,0.3) 0%, transparent 70%)',
        filter: 'blur(35px)',
        animation: 'inferno-surge 3s ease-in-out infinite',
      }} />
      {/* Secondary heat – left column */}
      <div style={{
        position: 'absolute', bottom: '0%', left: '0%', width: '30%', height: '40%',
        background: 'radial-gradient(ellipse at 0% 100%, rgba(200,30,0,0.22) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'inferno-surge 4s ease-in-out 0.8s infinite',
      }} />
      {/* Secondary heat – right column */}
      <div style={{
        position: 'absolute', bottom: '0%', right: '0%', width: '30%', height: '40%',
        background: 'radial-gradient(ellipse at 100% 100%, rgba(255,120,0,0.2) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'inferno-surge 5s ease-in-out 1.5s infinite',
      }} />
      {/* Upper heat haze */}
      <div style={{
        position: 'absolute', top: '20%', left: '20%', right: '20%', height: '30%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(180,60,0,0.1) 0%, transparent 70%)',
        filter: 'blur(50px)',
        animation: 'inferno-surge 6s ease-in-out 2s infinite',
      }} />
    </div>
  );
}

function NatureRays() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Primary ambient glow — bottom-left edge */}
      <div style={{
        position: 'absolute', bottom: '-5%', left: '-5%', width: '50%', height: '50%',
        background: 'radial-gradient(ellipse at 0% 100%, rgba(82,255,184,0.1) 0%, transparent 70%)',
        filter: 'blur(70px)',
        animation: 'ocean-pulse 9s ease-in-out infinite',
      }} />
      {/* Secondary ambient glow — top-right edge */}
      <div style={{
        position: 'absolute', top: '-5%', right: '-5%', width: '45%', height: '45%',
        background: 'radial-gradient(ellipse at 100% 0%, rgba(82,255,184,0.07) 0%, transparent 70%)',
        filter: 'blur(80px)',
        animation: 'ocean-pulse 13s ease-in-out 4s infinite',
      }} />
      {/* Subtle centre haze */}
      <div style={{
        position: 'absolute', top: '30%', left: '20%', right: '20%', bottom: '30%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(30,60,40,0.14) 0%, transparent 70%)',
        filter: 'blur(50px)',
        animation: 'ocean-pulse 7s ease-in-out 2s infinite',
      }} />
    </div>
  );
}

// ── Canvas particle systems ───────────────────────────────────────────────────

type Cleanup = () => void;

// Galaxy — stars + shooting star
function startGalaxy(canvas: HTMLCanvasElement): Cleanup {
  const ctx = canvas.getContext('2d')!;
  const N = 220;
  type Star = { x:number;y:number;r:number;op:number;tw:number;twDir:number;color:string };
  const colors = ['#ffffff','#cceeff','#aaddff','#9966ff','#6699ff'];
  const stars: Star[] = Array.from({length:N},()=>({
    x: rnd(0,canvas.width), y: rnd(0,canvas.height),
    r: rnd(0.3,2.2), op: rnd(0.2,1),
    tw: rnd(0.003,0.015), twDir: Math.random()>0.5?1:-1,
    color: colors[rndI(0,colors.length-1)],
  }));
  // Shooting star state
  let shoot = { active:false, x:0,y:0,vx:0,vy:0,len:0,op:0,timer:0 };
  let af = 0;
  function tick() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Stars
    for (const s of stars) {
      s.op = Math.max(0.1,Math.min(1,s.op + s.tw * s.twDir));
      if (s.op>=1||s.op<=0.1) s.twDir*=-1;
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r,0,TAU);
      if (s.r>1.4) {
        const g = ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*3);
        g.addColorStop(0,s.color); g.addColorStop(1,'transparent');
        ctx.fillStyle=g;
      } else ctx.fillStyle=s.color;
      ctx.globalAlpha=s.op; ctx.fill();
    }
    // Shooting star
    shoot.timer++;
    if (!shoot.active && shoot.timer > rndI(180,600)) {
      shoot = { active:true, x:rnd(0,canvas.width*0.6), y:rnd(0,canvas.height*0.3),
        vx:rnd(6,14), vy:rnd(3,8), len:rnd(80,180), op:1, timer:0 };
    }
    if (shoot.active) {
      ctx.globalAlpha=shoot.op;
      const g=ctx.createLinearGradient(shoot.x,shoot.y,shoot.x-shoot.vx*8,shoot.y-shoot.vy*8);
      g.addColorStop(0,'#aaeeff'); g.addColorStop(1,'transparent');
      ctx.strokeStyle=g; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(shoot.x,shoot.y);
      ctx.lineTo(shoot.x-shoot.vx*8,shoot.y-shoot.vy*8); ctx.stroke();
      shoot.x+=shoot.vx; shoot.y+=shoot.vy; shoot.op-=0.04;
      if (shoot.op<=0) { shoot.active=false; shoot.timer=0; }
    }
    ctx.globalAlpha=1;
    af=requestAnimationFrame(tick);
  }
  tick();
  return ()=>cancelAnimationFrame(af);
}

// Sakura — falling petals
function startSakura(canvas: HTMLCanvasElement): Cleanup {
  const ctx = canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  type Petal={ x:number;y:number;vy:number;vx:number;sway:number;sp:number;rot:number;rs:number;sz:number;op:number;hue:number };
  const make=():Petal=>({
    x:rnd(-50,W+50), y:rnd(-80,H*0.2),
    vy:rnd(0.8,2.2), vx:rnd(-0.4,0.4),
    sway:rnd(0.5,1.8), sp:rnd(0,TAU),
    rot:rnd(0,TAU), rs:rnd(-0.03,0.03),
    sz:rnd(5,13), op:rnd(0.5,0.95), hue:rndI(340,360),
  });
  const petals:Petal[]=Array.from({length:60},make);
  let af=0;
  function drawPetal(p:Petal){
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
    ctx.beginPath();
    // Simple oval petal
    ctx.ellipse(0,0,p.sz*0.45,p.sz,0,0,TAU);
    ctx.fillStyle=`hsla(${p.hue},80%,82%,${p.op})`;
    ctx.shadowColor=`hsla(${p.hue},80%,70%,0.3)`;
    ctx.shadowBlur=6; ctx.fill(); ctx.restore();
  }
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const p of petals){
      p.sp+=0.02; p.x+=Math.sin(p.sp)*p.sway+p.vx; p.y+=p.vy; p.rot+=p.rs;
      if(p.y>H+60) Object.assign(p,make(),{y:-60});
      drawPetal(p);
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// Inferno — fire particles
function startInferno(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  type Ember={ x:number;y:number;vx:number;vy:number;sz:number;life:number;maxLife:number };
  const make=():Ember=>({
    x:rnd(W*0.1,W*0.9), y:H+10,
    vx:rnd(-1.5,1.5), vy:rnd(-3,-0.8),
    sz:rnd(1.5,6), life:0, maxLife:rnd(60,140),
  });
  const embers:Ember[]=Array.from({length:150},()=>{const e=make();e.y=rnd(H*0.3,H);return e;});
  let af=0;
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const e of embers){
      e.life++; e.x+=e.vx; e.y+=e.vy; e.vx+=rnd(-0.1,0.1);
      if(e.life>=e.maxLife) Object.assign(e,make());
      const t=e.life/e.maxLife;
      const r=e.sz*(1-t*0.7);
      const alpha=(1-t*0.9)*0.85;
      const h=t<0.3?20:t<0.6?35:50;
      const s=t<0.5?'rgba(255,80,0,':'rgba(255,180,0,';
      const g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,r*2);
      g.addColorStop(0,`rgba(255,240,100,${alpha})`);
      g.addColorStop(0.4,`${s}${alpha*0.8})`);
      g.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(e.x,e.y,r*1.5,0,TAU);
      ctx.fillStyle=g; ctx.fill();
      void h;
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// Arctic Aurora — snow
function startArcticSnow(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  type Flake={ x:number;y:number;vy:number;sway:number;sp:number;r:number;op:number };
  const make=():Flake=>({
    x:rnd(0,W), y:rnd(-20,H),
    vy:rnd(0.4,1.4), sway:rnd(0.3,1.2), sp:rnd(0,TAU),
    r:rnd(1,3.5), op:rnd(0.3,0.9),
  });
  const flakes:Flake[]=Array.from({length:110},make);
  let af=0;
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const f of flakes){
      f.sp+=0.015; f.x+=Math.sin(f.sp)*f.sway; f.y+=f.vy;
      if(f.y>H+10) Object.assign(f,make(),{y:-10});
      ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,TAU);
      ctx.fillStyle=`rgba(200,240,255,${f.op})`; ctx.fill();
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// Nature Pulse OS — slow floating green energy particles
function startNature(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  type Orb={ x:number;y:number;vx:number;vy:number;r:number;op:number;opDir:number;ph:number };
  const make=():Orb=>({
    x:rnd(0,W), y:rnd(0,H),
    vx:rnd(-0.12,0.12), vy:rnd(-0.18,0.06),
    r:rnd(1.5,5), op:rnd(0.08,0.42), opDir:Math.random()>0.5?1:-1,
    ph:rnd(0,TAU),
  });
  const orbs:Orb[]=Array.from({length:75},make);
  let af=0;
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const o of orbs){
      o.ph+=0.007; o.x+=o.vx+Math.sin(o.ph)*0.08; o.y+=o.vy;
      o.op=Math.max(0.04,Math.min(0.45,o.op+0.002*o.opDir));
      if(o.op>=0.45||o.op<=0.04) o.opDir*=-1;
      if(o.y<-8){o.y=H+8;o.x=rnd(0,W);}
      if(o.y>H+8){o.y=-8;o.x=rnd(0,W);}
      if(o.x<-8) o.x=W+8;
      if(o.x>W+8) o.x=-8;
      const g=ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,o.r*3.5);
      g.addColorStop(0,`rgba(82,255,184,${o.op})`);
      g.addColorStop(0.5,`rgba(60,200,130,${o.op*0.35})`);
      g.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(o.x,o.y,o.r*3.5,0,TAU);
      ctx.fillStyle=g; ctx.fill();
    }
    af=requestAnimationFrame(tick);
  }
  tick(); return ()=>cancelAnimationFrame(af);
}

// Cyberpunk — digital rain
function startCyberpunk(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  const FS=14; const COLS=Math.ceil(W/FS);
  const drops=Array.from({length:COLS},()=>rnd(0,H/FS)|0);
  const CHARS='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ01アBCDEF!@#$%^&*<>';
  let af=0; let frame=0;
  function tick(){
    frame++;
    if(frame%2!==0){af=requestAnimationFrame(tick);return;}
    ctx.fillStyle='rgba(0,0,0,0.06)'; ctx.fillRect(0,0,W,H);
    for(let c=0;c<COLS;c++){
      const y=drops[c]*FS;
      const ch=CHARS[rndI(0,CHARS.length-1)];
      // bright head
      ctx.fillStyle='#00ff41'; ctx.font=`bold ${FS}px monospace`;
      ctx.globalAlpha=0.9; ctx.fillText(ch,c*FS,y);
      // trail
      ctx.fillStyle='#00aa22'; ctx.globalAlpha=0.5;
      ctx.fillText(CHARS[rndI(0,CHARS.length-1)],c*FS,y-FS);
      ctx.globalAlpha=1;
      if(y>H && Math.random()>0.975) drops[c]=0;
      else drops[c]++;
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
    x:rnd(0,W), y:H+20,
    vy:rnd(0.3,1.2), wob:rnd(0.5,2), wp:rnd(0,TAU),
    r:rnd(3,20), op:rnd(0.1,0.45),
  });
  const bubbles:Bubble[]=Array.from({length:55},()=>{const b=makeBubble();b.y=rnd(0,H);return b;});
  type Biolum={ x:number;y:number;life:number;maxLife:number;sz:number;hue:number };
  const bios:Biolum[]=Array.from({length:30},()=>({
    x:rnd(0,W), y:rnd(0,H), life:rndI(0,120), maxLife:rndI(80,200), sz:rnd(2,8), hue:rndI(170,210),
  }));
  let af=0;
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const b of bubbles){
      b.wp+=0.02; b.x+=Math.sin(b.wp)*b.wob; b.y-=b.vy;
      if(b.y<-30) Object.assign(b,makeBubble());
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,TAU);
      ctx.strokeStyle=`rgba(80,200,230,${b.op})`; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle=`rgba(100,220,255,${b.op*0.15})`; ctx.fill();
    }
    for(const bio of bios){
      bio.life++;
      if(bio.life>=bio.maxLife){ bio.life=0; bio.x=rnd(0,W); bio.y=rnd(0,H); }
      const t=bio.life/bio.maxLife;
      const op=Math.sin(t*Math.PI)*0.7;
      const g=ctx.createRadialGradient(bio.x,bio.y,0,bio.x,bio.y,bio.sz*3);
      g.addColorStop(0,`hsla(${bio.hue},100%,70%,${op})`);
      g.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(bio.x,bio.y,bio.sz*3,0,TAU);
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
  const NODE_COUNT=40;
  type Node={ x:number;y:number;sz:number;ph:number;glow:number;glowDir:number };
  type Pulse={ from:number;to:number;prog:number;speed:number;op:number };
  const nodes:Node[]=Array.from({length:NODE_COUNT},()=>({
    x:rnd(W*0.05,W*0.95), y:rnd(H*0.05,H*0.95),
    sz:rnd(2,6), ph:rnd(0,TAU),
    glow:rnd(0.3,1), glowDir:Math.random()>0.5?1:-1,
  }));
  // Build edges (connect nodes within 250px)
  const edges:[number,number][]=[];
  for(let a=0;a<NODE_COUNT;a++)for(let b=a+1;b<NODE_COUNT;b++){
    const dx=nodes[a].x-nodes[b].x, dy=nodes[a].y-nodes[b].y;
    if(Math.sqrt(dx*dx+dy*dy)<250) edges.push([a,b]);
  }
  const pulses:Pulse[]=[];
  let pTimer=0;
  let af=0;
  function tick(){
    ctx.clearRect(0,0,W,H);
    // Edges
    for(const [a,b] of edges){
      const ax=nodes[a].x,ay=nodes[a].y,bx=nodes[b].x,by=nodes[b].y;
      const dx=bx-ax,dy=by-ay,dist=Math.sqrt(dx*dx+dy*dy);
      const alpha=Math.max(0,(250-dist)/250)*0.15;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by);
      ctx.strokeStyle=`rgba(120,60,220,${alpha})`; ctx.lineWidth=0.8; ctx.stroke();
    }
    // Nodes
    for(const n of nodes){
      n.ph+=0.02; n.glow=Math.max(0.2,Math.min(1,n.glow+0.01*n.glowDir));
      if(n.glow>=1||n.glow<=0.2) n.glowDir*=-1;
      const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.sz*4);
      g.addColorStop(0,`rgba(160,80,255,${n.glow*0.9})`);
      g.addColorStop(0.3,`rgba(80,120,255,${n.glow*0.4})`);
      g.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(n.x,n.y,n.sz*4,0,TAU);
      ctx.fillStyle=g; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x,n.y,n.sz,0,TAU);
      ctx.fillStyle=`rgba(200,160,255,${n.glow})`; ctx.fill();
    }
    // Pulses
    pTimer++;
    if(pTimer%18===0 && pulses.length<25 && edges.length>0){
      const [a,b]=edges[rndI(0,edges.length-1)];
      pulses.push({from:a,to:b,prog:0,speed:rnd(0.008,0.022),op:0.9});
    }
    for(let i=pulses.length-1;i>=0;i--){
      const p=pulses[i]; p.prog+=p.speed;
      if(p.prog>=1){pulses.splice(i,1);continue;}
      const a=nodes[p.from],b=nodes[p.to];
      const px=a.x+(b.x-a.x)*p.prog, py=a.y+(b.y-a.y)*p.prog;
      const g2=ctx.createRadialGradient(px,py,0,px,py,8);
      g2.addColorStop(0,`rgba(0,200,255,${p.op})`);
      g2.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(px,py,8,0,TAU);
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
  0%   { transform: translateX(-8%) scaleY(1)   skewX(-3deg); opacity: 0.6; }
  50%  { transform: translateX(5%)  scaleY(1.3) skewX(4deg);  opacity: 1;   }
  100% { transform: translateX(8%)  scaleY(0.8) skewX(-2deg); opacity: 0.7; }
}
@keyframes nebula-drift {
  0%   { transform: translate(0,0)       scale(1);    opacity: 0.8; }
  33%  { transform: translate(40px,-30px) scale(1.1); opacity: 1;   }
  66%  { transform: translate(-25px,20px) scale(0.9); opacity: 0.7; }
  100% { transform: translate(0,0)       scale(1);    opacity: 0.8; }
}
@keyframes ocean-pulse {
  0%,100% { opacity: 0.6; transform: scaleX(1); }
  50%     { opacity: 1;   transform: scaleX(1.08); }
}
@keyframes brain-pulse {
  0%,100% { opacity: 0.5; transform: scale(1); }
  50%     { opacity: 1;   transform: scale(1.12); }
}
@keyframes brain-ring-expand {
  0%   { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(2.6); opacity: 0; }
}
@keyframes sakura-bloom {
  0%   { opacity: 0.55; transform: scale(1) translateY(0); }
  50%  { opacity: 1;    transform: scale(1.1) translateY(-10px); }
  100% { opacity: 0.7;  transform: scale(1.04) translateY(-4px); }
}
@keyframes inferno-surge {
  0%,100% { opacity: 0.55; transform: scaleY(1) scaleX(1); }
  50%     { opacity: 1;    transform: scaleY(1.15) scaleX(1.06); }
}
@keyframes nature-ray {
  0%   { opacity: 0.45; transform: rotate(-6deg) scaleX(0.9); }
  100% { opacity: 0.85; transform: rotate(6deg)  scaleX(1.3); }
}
.cyber-grid-lines {
  position: absolute; inset: 0;
  background:
    linear-gradient(rgba(255,0,255,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,0,255,0.07) 1px, transparent 1px);
  background-size: 60px 60px;
  transform: perspective(600px) rotateX(35deg);
  transform-origin: 50% 0%;
  opacity: 0.5;
}
.cyber-scan-line {
  position: absolute; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0,255,255,0.6), transparent);
  animation: cyber-scan 4s linear infinite;
  box-shadow: 0 0 12px rgba(0,255,255,0.4);
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

  // Single effect: handles both theme changes and window resize.
  // Restarting particles on resize ensures particle positions stay within
  // the new canvas bounds (setting canvas.width/height clears the drawing
  // buffer, so without a restart the old particles would draw out of bounds).
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
      {/* Inject theme-specific keyframes once */}
      <style>{KEYFRAMES}</style>

      {/* Fixed layer: z-index -1, covers full viewport, never captures events */}
      <div style={{ position:'fixed', inset:0, zIndex:-1, pointerEvents:'none', overflow:'hidden' }}>
        {/* Background gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: BG[themeId],
          transition: 'background 0.8s ease',
        }} />

        {/* CSS overlay effects */}
        <Overlay id={themeId} />

        {/* Particle canvas */}
        <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />
      </div>
    </>
  );
}
