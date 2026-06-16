/**
 * ParticleEngine — Interactive particle system that reacts to mouse movement.
 *
 * Renders at z-index:-1 (same as ThemeEngine) but appears on top due to DOM
 * order. All 5 styles connect nearby particles with lines, glow, and respond
 * to mouse position. Performance: half particle count on mobile, skip renders
 * when the tab is hidden.
 */

import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useParticles, THEME_PARTICLE_COLORS, type ParticleStyle, type ThemeColors } from '../contexts/ParticleContext';
import type { ThemeId } from '../contexts/ThemeContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const rnd = (lo: number, hi: number) => Math.random() * (hi - lo) + lo;
const rndI = (lo: number, hi: number) => (Math.random() * (hi - lo + 1) + lo) | 0;

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgba(rgb: [number, number, number], a: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`;
}

function lerpRgba(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
  alpha: number,
): string {
  return `rgba(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)},${alpha.toFixed(3)})`;
}

type GetMouse   = () => [number, number];
type GetPaused  = () => boolean;
type Cleanup    = () => void;

// ── Neural Network ────────────────────────────────────────────────────────────

type NNode = {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  glow: number; glowDir: number;
};
type NPulse = { ei: number; prog: number; speed: number };

function startNeuralNetwork(
  canvas: HTMLCanvasElement,
  colors: ThemeColors,
  isMobile: boolean,
  getMouse: GetMouse,
  getPaused: GetPaused,
): Cleanup {
  const ctx = canvas.getContext('2d')!;
  const COUNT       = isMobile ? 28 : 55;
  const CONNECT     = isMobile ? 160 : 210;
  const MOUSE_R     = 130;
  const SKIP_FRAME  = isMobile ? 2 : 1;

  const pRgb = hexToRgb(colors.primary);
  const sRgb = hexToRgb(colors.secondary);

  const nodes: NNode[] = Array.from({ length: COUNT }, () => ({
    x: rnd(0, canvas.width), y: rnd(0, canvas.height),
    vx: rnd(-0.25, 0.25), vy: rnd(-0.25, 0.25),
    r: rnd(2, 5),
    glow: rnd(0.4, 1), glowDir: Math.random() > 0.5 ? 1 : -1,
  }));

  // Build edges once at init
  const edges: [number, number][] = [];
  for (let a = 0; a < COUNT; a++) {
    for (let b = a + 1; b < COUNT; b++) {
      const dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
      if (Math.sqrt(dx * dx + dy * dy) < CONNECT) edges.push([a, b]);
    }
  }

  const pulses: NPulse[] = [];
  let pTimer = 0, frame = 0, af = 0;

  function tick() {
    af = requestAnimationFrame(tick);
    if (getPaused()) return;
    frame++;
    if (frame % SKIP_FRAME !== 0) return;

    const W = canvas.width, H = canvas.height;
    const [mx, my] = getMouse();
    ctx.clearRect(0, 0, W, H);

    for (const n of nodes) {
      n.glow = Math.max(0.2, Math.min(1, n.glow + 0.008 * n.glowDir));
      if (n.glow >= 1 || n.glow <= 0.2) n.glowDir *= -1;

      // Mouse attraction
      const dx = mx - n.x, dy = my - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_R && dist > 1) {
        const f = ((MOUSE_R - dist) / MOUSE_R) * 0.05;
        n.vx += (dx / dist) * f;
        n.vy += (dy / dist) * f;
      }
      n.vx *= 0.985; n.vy *= 0.985;
      n.x = (n.x + n.vx + W) % W;
      n.y = (n.y + n.vy + H) % H;
    }

    // Edges
    for (const [a, b] of edges) {
      const ax = nodes[a].x, ay = nodes[a].y, bx = nodes[b].x, by = nodes[b].y;
      const dx = bx - ax, dy = by - ay;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > CONNECT) continue;
      const t = dist / CONNECT;
      const alpha = (1 - t) * 0.22;
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.strokeStyle = lerpRgba(pRgb, sRgb, t, alpha);
      ctx.lineWidth = 0.7; ctx.stroke();
    }

    // Nodes
    for (const n of nodes) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4.5);
      g.addColorStop(0, rgba(pRgb, n.glow * 0.85));
      g.addColorStop(0.4, rgba(sRgb, n.glow * 0.25));
      g.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 4.5, 0, TAU);
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU);
      ctx.fillStyle = rgba(pRgb, n.glow); ctx.fill();
    }

    // Pulses along edges
    pTimer++;
    if (pTimer % 20 === 0 && pulses.length < (isMobile ? 10 : 22) && edges.length > 0) {
      pulses.push({ ei: rndI(0, edges.length - 1), prog: 0, speed: rnd(0.01, 0.024) });
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i]; p.prog += p.speed;
      if (p.prog >= 1) { pulses.splice(i, 1); continue; }
      const [a, b] = edges[p.ei];
      const na = nodes[a], nb = nodes[b];
      const px = na.x + (nb.x - na.x) * p.prog;
      const py = na.y + (nb.y - na.y) * p.prog;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, 7);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.4, rgba(pRgb, 0.7));
      grd.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU);
      ctx.fillStyle = grd; ctx.fill();
    }
  }

  tick();
  return () => cancelAnimationFrame(af);
}

// ── Constellation ─────────────────────────────────────────────────────────────

type CStar = {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  twinkle: number; twDir: number;
  rgb: [number, number, number];
};

function startConstellation(
  canvas: HTMLCanvasElement,
  colors: ThemeColors,
  isMobile: boolean,
  getMouse: GetMouse,
  getPaused: GetPaused,
): Cleanup {
  const ctx = canvas.getContext('2d')!;
  const COUNT      = isMobile ? 38 : 75;
  const CONNECT    = isMobile ? 140 : 185;
  const MOUSE_R    = 155;
  const SKIP_FRAME = isMobile ? 2 : 1;

  const pRgb = hexToRgb(colors.primary);
  const sRgb = hexToRgb(colors.secondary);

  const stars: CStar[] = Array.from({ length: COUNT }, () => ({
    x: rnd(0, canvas.width), y: rnd(0, canvas.height),
    vx: rnd(-0.12, 0.12), vy: rnd(-0.12, 0.12),
    r: rnd(1, 3.2),
    twinkle: rnd(0.3, 1), twDir: Math.random() > 0.5 ? 1 : -1,
    rgb: Math.random() > 0.65 ? pRgb : (Math.random() > 0.5 ? sRgb : [255, 255, 255] as [number, number, number]),
  }));

  let frame = 0, af = 0;

  function tick() {
    af = requestAnimationFrame(tick);
    if (getPaused()) return;
    frame++;
    if (frame % SKIP_FRAME !== 0) return;

    const W = canvas.width, H = canvas.height;
    const [mx, my] = getMouse();
    ctx.clearRect(0, 0, W, H);

    for (const s of stars) {
      s.twinkle = Math.max(0.15, Math.min(1, s.twinkle + 0.005 * s.twDir));
      if (s.twinkle >= 1 || s.twinkle <= 0.15) s.twDir *= -1;

      const mdx = mx - s.x, mdy = my - s.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      const brightness = mdist < MOUSE_R ? Math.min(1, s.twinkle + 0.35) : s.twinkle;

      s.x = (s.x + s.vx + W) % W;
      s.y = (s.y + s.vy + H) % H;

      if (s.r > 1.8) {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.5);
        g.addColorStop(0, rgba(s.rgb, brightness * 0.5));
        g.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3.5, 0, TAU);
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fillStyle = rgba(s.rgb, brightness); ctx.fill();
    }

    // Connection lines
    for (let a = 0; a < COUNT; a++) {
      for (let b = a + 1; b < COUNT; b++) {
        const dx = stars[a].x - stars[b].x, dy = stars[a].y - stars[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT) {
          ctx.beginPath();
          ctx.moveTo(stars[a].x, stars[a].y);
          ctx.lineTo(stars[b].x, stars[b].y);
          ctx.strokeStyle = rgba(pRgb, (1 - dist / CONNECT) * 0.16);
          ctx.lineWidth = 0.55; ctx.stroke();
        }
      }
    }
  }

  tick();
  return () => cancelAnimationFrame(af);
}

// ── Data Streams ──────────────────────────────────────────────────────────────

type Stream = {
  x: number; y: number;
  vx: number; vy: number;
  speed: number;
  hist: [number, number][];
  histLen: number;
  r: number;
};

function startDataStreams(
  canvas: HTMLCanvasElement,
  colors: ThemeColors,
  isMobile: boolean,
  getMouse: GetMouse,
  getPaused: GetPaused,
): Cleanup {
  const ctx = canvas.getContext('2d')!;
  const COUNT      = isMobile ? 22 : 45;
  const CONNECT    = isMobile ? 120 : 160;
  const MOUSE_R    = 120;
  const HIST_MAX   = 10;
  const SKIP_FRAME = isMobile ? 2 : 1;

  const pRgb = hexToRgb(colors.primary);
  const sRgb = hexToRgb(colors.secondary);

  function makeStream(): Stream {
    const spd = rnd(0.6, 1.8);
    const ang = rnd(-Math.PI * 0.3, Math.PI * 0.3);
    return {
      x: rnd(0, canvas.width), y: rnd(0, canvas.height),
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      speed: spd, hist: [], histLen: rndI(5, HIST_MAX),
      r: rnd(1.5, 3.5),
    };
  }

  const streams: Stream[] = Array.from({ length: COUNT }, makeStream);
  let frame = 0, af = 0;

  function tick() {
    af = requestAnimationFrame(tick);
    if (getPaused()) return;
    frame++;
    if (frame % SKIP_FRAME !== 0) return;

    const W = canvas.width, H = canvas.height;
    const [mx, my] = getMouse();
    ctx.clearRect(0, 0, W, H);

    for (const s of streams) {
      // Mouse deflect
      const dx = s.x - mx, dy = s.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_R && dist > 1) {
        const f = ((MOUSE_R - dist) / MOUSE_R) * 0.07;
        s.vx += (dx / dist) * f; s.vy += (dy / dist) * f;
      }
      const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      if (spd > s.speed * 2.2) { s.vx = s.vx / spd * s.speed * 2.2; s.vy = s.vy / spd * s.speed * 2.2; }

      s.hist.push([s.x, s.y]);
      if (s.hist.length > s.histLen) s.hist.shift();
      s.x += s.vx; s.y += s.vy;

      if (s.x < -25) s.x = W + 25;
      else if (s.x > W + 25) s.x = -25;
      if (s.y < -25) s.y = H + 25;
      else if (s.y > H + 25) s.y = -25;

      // Trail
      for (let i = 1; i < s.hist.length; i++) {
        const t = i / s.hist.length;
        ctx.beginPath();
        ctx.moveTo(s.hist[i - 1][0], s.hist[i - 1][1]);
        ctx.lineTo(s.hist[i][0], s.hist[i][1]);
        ctx.strokeStyle = lerpRgba(sRgb, pRgb, t, t * 0.65);
        ctx.lineWidth = s.r * t * 0.8; ctx.stroke();
      }

      // Head glow
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.5);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.35, rgba(pRgb, 0.65));
      g.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3.5, 0, TAU);
      ctx.fillStyle = g; ctx.fill();
    }

    // Cross-stream connections
    for (let a = 0; a < COUNT; a++) {
      for (let b = a + 1; b < COUNT; b++) {
        const dx = streams[a].x - streams[b].x, dy = streams[a].y - streams[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT) {
          ctx.beginPath();
          ctx.moveTo(streams[a].x, streams[a].y);
          ctx.lineTo(streams[b].x, streams[b].y);
          ctx.strokeStyle = rgba(pRgb, (1 - dist / CONNECT) * 0.13);
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    }
  }

  tick();
  return () => cancelAnimationFrame(af);
}

// ── Floating Orbs ─────────────────────────────────────────────────────────────

type Orb = {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  phase: number;
  pulse: number; pulseDir: number;
  rgb: [number, number, number];
};

function startFloatingOrbs(
  canvas: HTMLCanvasElement,
  colors: ThemeColors,
  isMobile: boolean,
  getMouse: GetMouse,
  getPaused: GetPaused,
): Cleanup {
  const ctx = canvas.getContext('2d')!;
  const COUNT      = isMobile ? 16 : 32;
  const CONNECT    = isMobile ? 170 : 230;
  const MOUSE_R    = 180;
  const SKIP_FRAME = isMobile ? 2 : 1;

  const pRgb = hexToRgb(colors.primary);
  const sRgb = hexToRgb(colors.secondary);
  const aRgb = hexToRgb(colors.accent);
  const palette: [number, number, number][] = [pRgb, sRgb, aRgb];

  const orbs: Orb[] = Array.from({ length: COUNT }, () => ({
    x: rnd(0, canvas.width), y: rnd(0, canvas.height),
    vx: rnd(-0.22, 0.22), vy: rnd(-0.22, 0.22),
    r: rnd(9, 22),
    phase: rnd(0, TAU),
    pulse: rnd(0.4, 0.95), pulseDir: Math.random() > 0.5 ? 1 : -1,
    rgb: palette[rndI(0, 2)],
  }));

  let frame = 0, af = 0;

  function tick() {
    af = requestAnimationFrame(tick);
    if (getPaused()) return;
    frame++;
    if (frame % SKIP_FRAME !== 0) return;

    const W = canvas.width, H = canvas.height;
    const [mx, my] = getMouse();
    ctx.clearRect(0, 0, W, H);

    for (const o of orbs) {
      o.phase += 0.009;
      o.pulse = Math.max(0.3, Math.min(1, o.pulse + 0.005 * o.pulseDir));
      if (o.pulse >= 1 || o.pulse <= 0.3) o.pulseDir *= -1;

      // Mouse repulsion
      const dx = o.x - mx, dy = o.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_R && dist > 1) {
        const f = ((MOUSE_R - dist) / MOUSE_R) * 0.055;
        o.vx += (dx / dist) * f; o.vy += (dy / dist) * f;
      }
      o.vx *= 0.988; o.vy *= 0.988;
      o.x += o.vx + Math.sin(o.phase) * 0.18;
      o.y += o.vy + Math.cos(o.phase * 0.7) * 0.14;

      // Bounce off edges
      if (o.x < o.r)       { o.x = o.r;     o.vx = Math.abs(o.vx); }
      if (o.x > W - o.r)   { o.x = W - o.r; o.vx = -Math.abs(o.vx); }
      if (o.y < o.r)       { o.y = o.r;     o.vy = Math.abs(o.vy); }
      if (o.y > H - o.r)   { o.y = H - o.r; o.vy = -Math.abs(o.vy); }

      // Outer aura
      const gOut = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 4.5);
      gOut.addColorStop(0, rgba(o.rgb, o.pulse * 0.14));
      gOut.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 4.5, 0, TAU);
      ctx.fillStyle = gOut; ctx.fill();

      // Core
      const gCore = ctx.createRadialGradient(
        o.x - o.r * 0.3, o.y - o.r * 0.3, 0, o.x, o.y, o.r,
      );
      gCore.addColorStop(0, rgba([255, 255, 255], o.pulse * 0.55));
      gCore.addColorStop(0.4, rgba(o.rgb, o.pulse * 0.75));
      gCore.addColorStop(1, rgba(o.rgb, 0.08));
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU);
      ctx.fillStyle = gCore; ctx.fill();
    }

    // Connections
    for (let a = 0; a < COUNT; a++) {
      for (let b = a + 1; b < COUNT; b++) {
        const dx = orbs[a].x - orbs[b].x, dy = orbs[a].y - orbs[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT) {
          const alpha = (1 - dist / CONNECT) * 0.11;
          ctx.beginPath();
          ctx.moveTo(orbs[a].x, orbs[a].y);
          ctx.lineTo(orbs[b].x, orbs[b].y);
          ctx.strokeStyle = rgba(orbs[a].rgb, alpha);
          ctx.lineWidth = 0.9; ctx.stroke();
        }
      }
    }
  }

  tick();
  return () => cancelAnimationFrame(af);
}

// ── Cyber Grid ────────────────────────────────────────────────────────────────

type GNode = {
  x: number; y: number;
  baseX: number; baseY: number;
  energy: number; energyDir: number;
  activeTTL: number;
};
type GPulse = { a: number; b: number; prog: number; speed: number };

function startCyberGrid(
  canvas: HTMLCanvasElement,
  colors: ThemeColors,
  isMobile: boolean,
  getMouse: GetMouse,
  getPaused: GetPaused,
): Cleanup {
  const ctx = canvas.getContext('2d')!;
  const COLS       = isMobile ? 7  : 11;
  const ROWS       = isMobile ? 11 : 16;
  const MOUSE_R    = 150;
  const SKIP_FRAME = isMobile ? 2 : 1;

  const pRgb = hexToRgb(colors.primary);
  const sRgb = hexToRgb(colors.secondary);

  // Evenly space nodes with slight jitter
  const nodes: GNode[] = [];
  for (let cx = 0; cx < COLS; cx++) {
    for (let cy = 0; cy < ROWS; cy++) {
      const bx = ((cx + 0.5) / COLS) * canvas.width  + rnd(-14, 14);
      const by = ((cy + 0.5) / ROWS) * canvas.height + rnd(-10, 10);
      nodes.push({
        x: bx, y: by, baseX: bx, baseY: by,
        energy: rnd(0.2, 0.9), energyDir: Math.random() > 0.5 ? 1 : -1,
        activeTTL: 0,
      });
    }
  }

  const CONNECT = Math.max(canvas.width / COLS, canvas.height / ROWS) * 1.65;
  const pulses: GPulse[] = [];
  let pTimer = 0, frame = 0, af = 0;

  function tick() {
    af = requestAnimationFrame(tick);
    if (getPaused()) return;
    frame++;
    if (frame % SKIP_FRAME !== 0) return;

    const W = canvas.width, H = canvas.height;
    const [mx, my] = getMouse();
    ctx.clearRect(0, 0, W, H);

    const N = nodes.length;

    for (const n of nodes) {
      n.energy = Math.max(0.1, Math.min(1, n.energy + 0.006 * n.energyDir));
      if (n.energy >= 1 || n.energy <= 0.1) n.energyDir *= -1;

      const dx = n.baseX - mx, dy = n.baseY - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_R && dist > 1) {
        const push = ((MOUSE_R - dist) / MOUSE_R) * 28;
        n.x += ((n.baseX + (dx / dist) * push) - n.x) * 0.18;
        n.y += ((n.baseY + (dy / dist) * push) - n.y) * 0.18;
        n.activeTTL = 35;
      } else {
        n.x += (n.baseX - n.x) * 0.08;
        n.y += (n.baseY - n.y) * 0.08;
        if (n.activeTTL > 0) n.activeTTL--;
      }
    }

    // Grid lines
    for (let a = 0; a < N; a++) {
      for (let b = a + 1; b < N; b++) {
        const dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > CONNECT) continue;
        const active = nodes[a].activeTTL > 0 || nodes[b].activeTTL > 0;
        const alpha = ((1 - dist / CONNECT) * 0.22 * nodes[a].energy) * (active ? 3.5 : 1);
        ctx.beginPath();
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
        ctx.strokeStyle = active ? rgba(sRgb, alpha) : rgba(pRgb, alpha);
        ctx.lineWidth = active ? 1.3 : 0.6; ctx.stroke();
      }
    }

    // Grid nodes
    for (const n of nodes) {
      const active = n.activeTTL > 0;
      const nr = active ? 5 : 3;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, nr * 4);
      g.addColorStop(0, rgba(pRgb, n.energy * (active ? 1 : 0.55)));
      g.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(n.x, n.y, nr * 4, 0, TAU);
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, nr, 0, TAU);
      ctx.fillStyle = active ? 'rgba(255,255,255,0.95)' : rgba(pRgb, n.energy);
      ctx.fill();
    }

    // Energy pulses
    pTimer++;
    if (pTimer % 22 === 0 && pulses.length < (isMobile ? 8 : 18)) {
      const a = rndI(0, N - 1), b = rndI(0, N - 1);
      if (a !== b) pulses.push({ a, b, prog: 0, speed: rnd(0.015, 0.032) });
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i]; p.prog += p.speed;
      if (p.prog >= 1) { pulses.splice(i, 1); continue; }
      const na = nodes[p.a], nb = nodes[p.b];
      const px = na.x + (nb.x - na.x) * p.prog;
      const py = na.y + (nb.y - na.y) * p.prog;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, 6);
      grd.addColorStop(0, rgba(sRgb, 0.95));
      grd.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU);
      ctx.fillStyle = grd; ctx.fill();
    }

    void W; void H; // suppress unused-variable warnings
  }

  tick();
  return () => cancelAnimationFrame(af);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

function startStyle(
  style: ParticleStyle,
  canvas: HTMLCanvasElement,
  colors: ThemeColors,
  isMobile: boolean,
  getMouse: GetMouse,
  getPaused: GetPaused,
): Cleanup {
  switch (style) {
    case 'neural-network': return startNeuralNetwork(canvas, colors, isMobile, getMouse, getPaused);
    case 'constellation':  return startConstellation(canvas, colors, isMobile, getMouse, getPaused);
    case 'data-streams':   return startDataStreams(canvas, colors, isMobile, getMouse, getPaused);
    case 'floating-orbs':  return startFloatingOrbs(canvas, colors, isMobile, getMouse, getPaused);
    case 'cyber-grid':     return startCyberGrid(canvas, colors, isMobile, getMouse, getPaused);
    default:               return () => {};
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ParticleEngine() {
  const { themeId }       = useTheme();
  const { particleStyle } = useParticles();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mouseRef   = useRef<[number, number]>([-9999, -9999]);
  const pausedRef  = useRef(false);
  // Key changes when either themeId or particleStyle changes
  const depsKey = `${themeId}::${particleStyle}` as `${ThemeId}::${ParticleStyle}`;

  // Global mouse tracker (canvas is pointer-events:none so listen on window)
  useEffect(() => {
    const onMove = (e: MouseEvent) => { mouseRef.current = [e.clientX, e.clientY]; };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Visibility pause
  useEffect(() => {
    const onVis = () => { pausedRef.current = document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Start / restart particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isMobile = window.innerWidth < 768;
    const colors   = THEME_PARTICLE_COLORS[themeId];
    const getMouse = (): [number, number] => mouseRef.current;
    const getPaused = () => pausedRef.current;
    return startStyle(particleStyle, canvas, colors, isMobile, getMouse, getPaused);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    />
  );
}
