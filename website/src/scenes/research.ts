/**
 * scene-research.ts — 星图收敛（Research → Plan → Align）
 *
 * 叙事：散落的调研信息点 → 汇聚成结构（三个锚点 + 流线）
 * → 95% 置信仪表充满 —— 工作流的置信闸门可视化。
 * scrub 驱动 + 进入视口后的 idle 微循环（轨道旋转 / 星点呼吸）。
 */
import { gsap, ScrollTrigger, prefersReduced } from '../motion';
import { el, svgRoot, seeded } from '../svg';

const CYAN = '#62D8E6';

interface Dot {
  node: SVGCircleElement;
  from: [number, number];
  to: [number, number];
}

export function initResearchScene() {
  const host = document.getElementById('scene-research');
  if (!host) return;

  const svg = svgRoot('0 0 500 400', host);
  const rnd = seeded(20260908);

  /* ---------- 轨道（装饰层，idle 旋转） ---------- */
  const orbitGroup = el('g', { opacity: 0.35 }, svg);
  const orbits = [
    { rx: 172, ry: 72 },
    { rx: 132, ry: 54 },
    { rx: 92, ry: 36 },
  ].map(({ rx, ry }) =>
    el('ellipse', {
      cx: 250, cy: 158, rx, ry,
      fill: 'none',
      stroke: CYAN,
      'stroke-opacity': 0.14,
      'stroke-width': 1,
      'stroke-dasharray': '1 5',
    }, orbitGroup)
  );

  /* ---------- 三个锚点：R / P / A ---------- */
  const anchors: Array<{ x: number; y: number; label: string }> = [
    { x: 138, y: 152, label: 'RESEARCH' },
    { x: 250, y: 112, label: 'PLAN' },
    { x: 362, y: 152, label: 'ALIGN' },
  ];

  const nodeGroup = el('g', {}, svg);
  const nodes = anchors.map((a) => {
    const g = el('g', { opacity: 0 }, nodeGroup);
    el('circle', { cx: a.x, cy: a.y, r: 10, fill: '#121514', stroke: CYAN, 'stroke-width': 1.2 }, g);
    const core = el('circle', { cx: a.x, cy: a.y, r: 3.4, fill: CYAN }, g);
    el('text', {
      x: a.x, y: a.y + 30, 'text-anchor': 'middle',
      class: 'scene-label', fill: '#A4A89D',
    }, g, a.label);
    return { g, core, a };
  });

  /* ---------- 流线 R → P → A ---------- */
  const flow = el('path', {
    d: `M 138 152 C 172 118 214 112 250 112 C 286 112 328 118 362 152`,
    fill: 'none', stroke: CYAN, 'stroke-width': 1.4, 'stroke-linecap': 'round',
  }, svg);

  /* ---------- 散点（信息星图） ---------- */
  const dotGroup = el('g', {}, svg);
  const dots: Dot[] = [];
  for (let i = 0; i < 26; i++) {
    const x = 58 + rnd() * 384;
    const y = 38 + rnd() * 196;
    const nearest = anchors.reduce((best, a) => {
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      return d < best.d ? { a, d } : best;
    }, { a: anchors[0], d: Infinity }).a;
    const node = el('circle', { cx: x, cy: y, r: 1.1 + rnd() * 1.3, fill: CYAN, opacity: 0.75 }, dotGroup);
    dots.push({ node, from: [x, y], to: [nearest.x, nearest.y] });
  }

  /* ---------- 95% 置信仪表 ---------- */
  const dialC = { x: 250, y: 308, r: 25 };
  const dial = el('g', { opacity: 0 }, svg);
  el('path', {
    d: `M ${dialC.x} ${dialC.y - dialC.r} a ${dialC.r} ${dialC.r} 0 1 1 -0.01 0`,
    fill: 'none', stroke: 'rgba(233,234,227,0.14)', 'stroke-width': 3,
  }, dial);
  const dialArc = el('path', {
    d: `M ${dialC.x} ${dialC.y - dialC.r} a ${dialC.r} ${dialC.r} 0 1 1 -0.01 0`,
    fill: 'none', stroke: CYAN, 'stroke-width': 3, 'stroke-linecap': 'round',
  }, dial);
  const dialNum = el('text', {
    x: dialC.x, y: dialC.y + 2, 'text-anchor': 'middle',
    fill: '#E9EAE3', 'font-family': 'JetBrains Mono, monospace', 'font-size': 15, 'font-weight': 500,
  }, dial, '0');
  el('text', {
    x: dialC.x, y: dialC.y + 16, 'text-anchor': 'middle',
    fill: '#6B7069', 'font-family': 'JetBrains Mono, monospace', 'font-size': 7,
  }, dial, 'PERCENT');
  el('text', {
    x: dialC.x, y: dialC.y + 52, 'text-anchor': 'middle',
    class: 'scene-label', fill: '#6B7069',
  }, dial, 'CONFIDENCE GATE · 置信闸门');

  /* ---------- scrub 主时间线 ---------- */
  const counter = { v: 0 };
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: prefersReduced()
      ? undefined
      : {
          trigger: host,
          start: 'top 88%',
          end: 'bottom 52%',
          scrub: 0.7,
        },
  });

  // 散点汇聚
  dots.forEach((d, i) => {
    tl.to(d.node, {
      attr: { cx: d.to[0], cy: d.to[1] },
      opacity: 0.14,
      duration: 0.22,
    }, 0.08 + (i % 9) * 0.03);
  });
  // 流线
  tl.fromTo(flow, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.24, ease: 'power2.out' }, 0.42);
  // 节点
  nodes.forEach((n, i) => {
    tl.fromTo(n.g, { opacity: 0, scale: 0.4, transformOrigin: 'center' }, { opacity: 1, scale: 1, duration: 0.14, ease: 'back.out(2)' }, 0.46 + i * 0.07);
  });
  // 仪表
  tl.to(dial, { opacity: 1, duration: 0.08 }, 0.68)
    .fromTo(dialArc, { drawSVG: '0%' }, { drawSVG: '95%', duration: 0.24, ease: 'power2.out' }, 0.7)
    .to(counter, {
      v: 95, duration: 0.24, ease: 'power2.out',
      onUpdate: () => (dialNum.textContent = String(Math.round(counter.v))),
    }, 0.7);

  if (prefersReduced()) {
    tl.progress(1);
    return;
  }

  /* ---------- idle 微循环（进入视口才跑） ---------- */
  const idle = gsap.timeline({ repeat: -1, paused: true });
  // 轨道各自方向旋转
  orbits.forEach((o, i) => {
    idle.to(o, { rotation: i % 2 ? -360 : 360, transformOrigin: '50% 50%', duration: 40 + i * 10, ease: 'none', repeat: -1 }, 0);
  });
  // 星点呼吸（动 r 不动 opacity —— opacity 由 scrub 独占）
  dots.forEach((d) => {
    const r0 = Number(d.node.getAttribute('r'));
    idle.to(d.node, { attr: { r: r0 * 0.45 }, duration: 0.9 + rnd(), yoyo: true, repeat: -1, ease: 'sine.inOut' }, rnd() * 2);
  });
  // 节点核心脉冲
  nodes.forEach((n) => {
    idle.to(n.core, { attr: { r: 4.6 }, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }, 0.2);
  });
  idle.pause();

  ScrollTrigger.create({
    trigger: host,
    start: 'top 95%',
    end: 'bottom 5%',
    onToggle: (self) => (self.isActive ? idle.play() : idle.pause()),
  });
}
