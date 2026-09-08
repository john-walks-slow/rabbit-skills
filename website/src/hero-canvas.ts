/**
 * hero-canvas.ts — Hero 背景动效：三条工作流电流
 *
 * 三条贝塞尔泳道（对应三大工作流配色），粒子沿泳道流动，
 * 泳道上两道「置信闸门」缓慢脉动——隐喻工作流的 gate。
 *
 * 低端护栏（调研结论落地）：DPR ≤ 1.5（移动端 1）、30fps 上限、
 * 离屏 / hidden 自动暂停、prefers-reduced-motion 完全静态。
 */
import { gsap } from 'gsap';
import { prefersReduced, isMobile } from './motion';

interface Lane {
  /** 归一化三次贝塞尔 P0..P3 */
  p: Array<[number, number]>;
  color: string;
  rgb: [number, number, number];
}

/** 泳道定义（归一化坐标；x: -0.06 → 1.06，y ∈ 0..1） */
const LANES: Lane[] = [
  { p: [[-0.06, 0.3], [0.32, 0.16], [0.68, 0.38], [1.06, 0.22]], color: '#62D8E6', rgb: [98, 216, 230] }, // research · cyan
  { p: [[-0.06, 0.56], [0.36, 0.66], [0.64, 0.46], [1.06, 0.6]], color: '#FF8075', rgb: [255, 128, 117] }, // troubleshoot · coral
  { p: [[-0.06, 0.8], [0.3, 0.68], [0.7, 0.86], [1.06, 0.74]], color: '#82DF8D', rgb: [130, 223, 141] }, // implement · green
];

/** 每条泳道的闸门 t 值（置信闸门） */
const GATES = [0.42, 0.74];

interface Particle {
  lane: number;
  t: number;
  speed: number;
  amp: number;
  freq: number;
  phase: number;
  size: number;
  alpha: number;
}

function bezPoint(p: Lane['p'], t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0],
    a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1],
  ];
}

function bezTangent(p: Lane['p'], t: number): [number, number] {
  const u = 1 - t;
  const a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
  return [
    a * (p[1][0] - p[0][0]) + b * (p[2][0] - p[1][0]) + c * (p[3][0] - p[2][0]),
    a * (p[1][1] - p[0][1]) + b * (p[2][1] - p[1][1]) + c * (p[3][1] - p[2][1]),
  ];
}

export class HeroCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  private visible = true;
  private readonly reduced = prefersReduced();
  private dpr = 1;
  private w = 0;
  private h = 0;
  /** 泳道显现进度 0→1（入场用） */
  private reveal = 0;
  private ro: ResizeObserver;
  private io?: IntersectionObserver;
  private t = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;

    const reduced = this.reduced;
    const mobile = isMobile();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement!);

    if (!reduced) {
      this.io = new IntersectionObserver(
        (entries) => {
          this.visible = entries[0]?.isIntersecting ?? true;
          this.sync();
        },
        { threshold: 0 }
      );
      this.io.observe(canvas.parentElement!);
      document.addEventListener('visibilitychange', this.onVis);
    }

    this.spawn(mobile ? 42 : 104);
    this.resize();

    if (reduced) {
      // 静态：只画泳道与闸门，不画粒子
      this.reveal = 1;
      this.drawStatic();
    } else {
      gsap.to(this, { reveal: 1, duration: 1.6, delay: 0.7, ease: 'power2.out' });
      this.start();
    }
  }

  private onVis = () => {
    this.sync();
  };

  private sync() {
    const should = this.visible && !document.hidden && !prefersReduced();
    if (should && !this.running) this.start();
    else if (!should && this.running) this.stop();
  }

  private spawn(n: number) {
    this.particles = Array.from({ length: n }, () => this.make(Math.random()));
  }

  private make(t: number): Particle {
    return {
      lane: Math.floor(Math.random() * LANES.length),
      t,
      speed: 0.016 + Math.random() * 0.028, // 全程 3~6s
      amp: 4 + Math.random() * 12,
      freq: 1.2 + Math.random() * 2.4,
      phase: Math.random() * Math.PI * 2,
      size: 0.9 + Math.random() * 1.4,
      alpha: 0.25 + Math.random() * 0.5,
    };
  }

  private resize() {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1 : 1.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (prefersReduced()) this.drawStatic();
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    // 30fps 上限
    this.acc += dt;
    if (this.acc >= 1 / 30) {
      this.t += this.acc;
      this.acc = 0;
      this.step();
      this.draw();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private step() {
    for (const p of this.particles) {
      p.t += p.speed * (1 / 30);
      if (p.t > 1.12) Object.assign(p, this.make(-0.1));
    }
  }

  private draw() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    this.drawLanes();
    this.drawGates();
    this.drawParticles();
  }

  private drawStatic() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    this.drawLanes();
    this.drawGates();
  }

  private drawLanes() {
    const { ctx, w, h } = this;
    const steps = 48;
    for (let li = 0; li < LANES.length; li++) {
      const lane = LANES[li];
      const [r, g, b] = lane.rgb;
      ctx.beginPath();
      const upto = Math.ceil(steps * this.reveal);
      for (let i = 0; i <= upto; i++) {
        const t = Math.min(i / steps, 1);
        const [x, y] = bezPoint(lane.p, t);
        if (i === 0) ctx.moveTo(x * w, y * h);
        else ctx.lineTo(x * w, y * h);
      }
      ctx.strokeStyle = `rgba(${r},${g},${b},${0.13 * this.reveal})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private drawGates() {
    const { ctx, w, h, t } = this;
    const reduced = this.reduced; // 每帧缓存读取，避免重复构造 matchMedia
    for (const lane of LANES) {
      for (const gt of GATES) {
        const [x, y] = bezPoint(lane.p, gt);
        const pulse = reduced ? 0 : (Math.sin(t * 1.4 + gt * 8) + 1) / 2; // 0..1
        const [r, g, b] = lane.rgb;
        const cx = x * w, cy = y * h;
        const base = 3.2;
        // 脉冲光晕
        if (pulse > 0.05) {
          ctx.beginPath();
          ctx.arc(cx, cy, base + pulse * 7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${0.1 * pulse * this.reveal})`;
          ctx.fill();
        }
        // 菱形闸门
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        const s = base * (1 + pulse * 0.28);
        ctx.fillStyle = `rgba(${r},${g},${b},${(0.55 + pulse * 0.4) * this.reveal})`;
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.restore();
      }
    }
  }

  private drawParticles() {
    const { ctx, w, h } = this;
    for (const p of this.particles) {
      if (p.t < -0.05 || p.t > 1.1) continue;
      const lane = LANES[p.lane];
      const [bx, by] = bezPoint(lane.p, p.t);
      const [tx, ty] = bezTangent(lane.p, p.t);
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len, ny = tx / len; // 法向
      const off = Math.sin(p.t * p.freq * Math.PI * 2 + p.phase) * p.amp;
      const x = bx * w + nx * off;
      const y = by * h + ny * off;
      const [r, g, b] = lane.rgb;
      // 头部亮点
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha})`;
      ctx.fill();
      // 尾迹（短线段）
      const tail = 10 + p.speed * 260;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (tx / len) * tail, y - (ty / len) * tail);
      ctx.strokeStyle = `rgba(${r},${g},${b},${p.alpha * 0.28})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  destroy() {
    this.stop();
    this.ro.disconnect();
    this.io?.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
  }
}

export function initHeroCanvas(): HeroCanvas | null {
  const canvas = document.getElementById('hero-canvas') as HTMLCanvasElement | null;
  if (!canvas) return null;
  return new HeroCanvas(canvas);
}
