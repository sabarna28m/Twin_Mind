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
    `radial-gradient(ellipse at 15% 55%, rgba(80,0,180,0.35) 0%, transparent 55%),
     radial-gradient(ellipse at 85% 20%, rgba(0,60,200,0.25) 0%, transparent 50%),
     radial-gradient(ellipse at 50% 95%, rgba(0,100,200,0.18) 0%, transparent 45%),
     #000510`,
  'sakura-dream':
    `radial-gradient(ellipse at 30% 15%, rgba(255,180,200,0.45) 0%, transparent 55%),
     radial-gradient(ellipse at 75% 80%, rgba(255,120,160,0.3) 0%, transparent 50%),
     linear-gradient(170deg, #12020a 0%, #1f0513 50%, #14030c 100%)`,
  'inferno':
    `radial-gradient(ellipse at 50% 100%, rgba(220,60,0,0.55) 0%, transparent 55%),
     radial-gradient(ellipse at 20% 80%, rgba(180,30,0,0.3) 0%, transparent 40%),
     radial-gradient(ellipse at 80% 70%, rgba(255,120,0,0.2) 0%, transparent 40%),
     #060100`,
  'arctic-aurora':
    `radial-gradient(ellipse at 50% 0%, rgba(0,220,160,0.18) 0%, transparent 60%),
     radial-gradient(ellipse at 20% 40%, rgba(0,150,255,0.15) 0%, transparent 50%),
     #00060e`,
  'nature-pulse':
    `radial-gradient(ellipse at 20% 80%, rgba(20,100,20,0.4) 0%, transparent 55%),
     radial-gradient(ellipse at 80% 30%, rgba(10,80,10,0.25) 0%, transparent 50%),
     #010802`,
  'cyberpunk-neo':
    `radial-gradient(ellipse at 50% 50%, rgba(100,0,200,0.12) 0%, transparent 70%),
     #000000`,
  'ocean-intelligence':
    `radial-gradient(ellipse at 30% 70%, rgba(0,80,160,0.4) 0%, transparent 55%),
     radial-gradient(ellipse at 70% 20%, rgba(0,130,150,0.3) 0%, transparent 50%),
     #000814`,
  'neural-brain':
    `radial-gradient(ellipse at 50% 50%, rgba(60,0,120,0.3) 0%, transparent 65%),
     radial-gradient(ellipse at 20% 20%, rgba(0,100,180,0.2) 0%, transparent 50%),
     #020205`,
};

// ── CSS overlay components (aurora waves, cyber grid, etc.) ───────────────────

function AuroraOverlay() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {[
        { top: '5%',  left: '10%', w: '80%',  h: '18%', c: 'rgba(0,220,160,0.18)',  dur: '8s',  del: '0s'   },
        { top: '18%', left: '0%',  w: '70%',  h: '14%', c: 'rgba(0,150,255,0.14)',  dur: '11s', del: '2s'   },
        { top: '30%', left: '25%', w: '60%',  h: '10%', c: 'rgba(100,0,255,0.12)',  dur: '9s',  del: '4s'   },
        { top: '42%', left: '5%',  w: '75%',  h: '8%',  c: 'rgba(0,255,200,0.08)',  dur: '14s', del: '1.5s' },
      ].map((b, i) => (
        <div key={i} style={{
          position: 'absolute', top: b.top, left: b.left,
          width: b.w, height: b.h,
          background: `radial-gradient(ellipse at center, ${b.c} 0%, transparent 70%)`,
          filter: 'blur(28px)',
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
      {/* Corner brackets */}
      {[
        { top: 20, left: 20,  bt: '2px solid',  bb: 'none',     bl: '2px solid', br: 'none' },
        { top: 20, right: 20, bt: '2px solid',  bb: 'none',     bl: 'none',      br: '2px solid' },
        { bottom: 20, left: 20,  bt: 'none',    bb: '2px solid',bl: '2px solid', br: 'none' },
        { bottom: 20, right: 20, bt: 'none',    bb: '2px solid',bl: 'none',      br: '2px solid' },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute', width: 30, height: 30, opacity: 0.4,
          ...c,
          borderColor: '#ff00ff',
          top: c.top, left: c.left, bottom: c.bottom, right: c.right,
        }} />
      ))}
    </div>
  );
}

function NebulaClouds() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {[
        { top: '10%',  left: '5%',  s: 400, c: 'rgba(80,0,200,0.12)',   dur: '22s', del: '0s'  },
        { top: '30%',  left: '60%', s: 350, c: 'rgba(0,80,200,0.1)',    dur: '28s', del: '4s'  },
        { top: '60%',  left: '20%', s: 500, c: 'rgba(0,180,255,0.08)',  dur: '18s', del: '8s'  },
        { top: '70%',  left: '70%', s: 300, c: 'rgba(120,0,255,0.12)',  dur: '25s', del: '2s'  },
        { top: '-5%',  left: '40%', s: 450, c: 'rgba(0,60,180,0.1)',    dur: '32s', del: '6s'  },
      ].map((n, i) => (
        <div key={i} style={{
          position: 'absolute', top: n.top, left: n.left,
          width: n.s, height: n.s,
          background: `radial-gradient(circle, ${n.c} 0%, transparent 70%)`,
          filter: 'blur(40px)',
          animation: `nebula-drift ${n.dur} ease-in-out ${n.del} infinite alternate`,
          borderRadius: '50%',
        }} />
      ))}
    </div>
  );
}

function OceanDepthGlow() {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{
        position: 'absolute', bottom: 0, left: '10%', right: '10%', height: '40%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(0,120,200,0.2) 0%, transparent 70%)',
        animation: 'ocean-pulse 6s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '20%', left: '20%', right: '20%', height: '30%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,200,200,0.06) 0%, transparent 70%)',
        animation: 'ocean-pulse 9s ease-in-out 3s infinite',
        filter: 'blur(20px)',
      }} />
    </div>
  );
}

function BrainGlow() {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{
        position: 'absolute', top: '25%', left: '25%', right: '25%', bottom: '25%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(100,0,200,0.15) 0%, transparent 70%)',
        animation: 'brain-pulse 4s ease-in-out infinite',
        filter: 'blur(30px)',
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

// Nature — falling leaves
function startNature(canvas: HTMLCanvasElement): Cleanup {
  const ctx=canvas.getContext('2d')!;
  const W=canvas.width, H=canvas.height;
  const COLORS=['rgba(34,139,34,0.8)','rgba(56,161,56,0.75)','rgba(80,180,40,0.8)','rgba(120,200,60,0.7)','rgba(200,180,40,0.65)'];
  type Leaf={ x:number;y:number;vx:number;vy:number;sway:number;sp:number;rot:number;rs:number;sz:number;color:string };
  const make=():Leaf=>({
    x:rnd(-30,W+30), y:rnd(-60,H*0.3),
    vx:rnd(-0.6,0.6), vy:rnd(0.6,1.8),
    sway:rnd(0.4,1.5), sp:rnd(0,TAU),
    rot:rnd(0,TAU), rs:rnd(-0.04,0.04),
    sz:rnd(6,14), color:COLORS[rndI(0,4)],
  });
  const leaves:Leaf[]=Array.from({length:45},make);
  let af=0;
  function drawLeaf(l:Leaf){
    ctx.save(); ctx.translate(l.x,l.y); ctx.rotate(l.rot);
    ctx.beginPath(); ctx.ellipse(0,0,l.sz*0.4,l.sz,0,0,TAU);
    ctx.fillStyle=l.color; ctx.fill(); ctx.restore();
  }
  function tick(){
    ctx.clearRect(0,0,W,H);
    for(const l of leaves){
      l.sp+=0.018; l.x+=Math.sin(l.sp)*l.sway+l.vx; l.y+=l.vy; l.rot+=l.rs;
      if(l.y>H+40) Object.assign(l,make(),{y:-40});
      drawLeaf(l);
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
  0%   { transform: translate(0,0)      scale(1);    opacity: 0.8; }
  33%  { transform: translate(40px,-30px) scale(1.1); opacity: 1;   }
  66%  { transform: translate(-25px,20px) scale(0.9); opacity: 0.7; }
  100% { transform: translate(0,0)      scale(1);    opacity: 0.8; }
}
@keyframes ocean-pulse {
  0%,100% { opacity: 0.6; transform: scaleX(1); }
  50%     { opacity: 1;   transform: scaleX(1.08); }
}
@keyframes brain-pulse {
  0%,100% { opacity: 0.5; transform: scale(1); }
  50%     { opacity: 1;   transform: scale(1.12); }
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

  // Resize canvas to full viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Start / restart particle system on theme change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cleanup = startParticles(themeId, canvas);
    return cleanup;
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
