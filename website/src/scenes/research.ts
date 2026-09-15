/**
 * scene-research.ts — 浏览海量文档 → 产出最佳计划（Research → Plan → Align）
 *
 * 叙事：R/P/A 三相骨架（调研→规划→对齐）在上；下方散落许多文档卡，
 * 经一段较长的浏览/扫描 → 文档汇聚到底部「最佳计划」——
 * 浏览了海量文档，产出最佳计划。
 * scrub 驱动 + 进入视口后的 idle 微循环。
 */
import { gsap, ScrollTrigger, prefersReduced } from '../motion';
import { el, svgRoot, seeded } from '../svg';

const CYAN = '#62D8E6';

interface Doc {
  g: SVGGElement;
  mid: [number, number];
  plan: [number, number];
}

export function initResearchScene() {
  const host = document.getElementById('scene-research');
  if (!host) return;

  const svg = svgRoot('0 0 500 400', host);
  const rnd = seeded(20260908);

  /* ---------- R / P / A 骨架 ---------- */
  const anchors: Array<{ x: number; y: number; label: string }> = [
    { x: 138, y: 132, label: 'RESEARCH' },
    { x: 250, y: 96, label: 'PLAN' },
    { x: 362, y: 132, label: 'ALIGN' },
  ];
  const nodeGroup = el('g', {}, svg);
  const nodes = anchors.map((a) => {
    const g = el('g', { opacity: 0 }, nodeGroup);
    el('circle', { cx: a.x, cy: a.y, r: 9, fill: '#121514', stroke: CYAN, 'stroke-width': 1.2 }, g);
    const core = el('circle', { cx: a.x, cy: a.y, r: 3.2, fill: CYAN }, g);
    el('text', {
      x: a.x, y: a.y - 20, 'text-anchor': 'middle',
      class: 'scene-label', fill: '#A4A89D',
    }, g, a.label);
    return { g, core, a };
  });
  const flow = el('path', {
    d: `M 138 132 C 172 100 214 96 250 96 C 286 96 328 100 362 132`,
    fill: 'none', stroke: CYAN, 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.7,
  }, svg);

  /* ---------- 扫描线（浏览感） ---------- */
  const scan = el('rect', {
    x: 30, y: 205, width: 440, height: 1.5, rx: 0.75,
    fill: CYAN, opacity: 0,
  }, svg);

  /* ---------- 文档卡（海量调研材料） ---------- */
  const docGroup = el('g', {}, svg);
  const docs: Doc[] = [];
  for (let i = 0; i < 15; i++) {
    const x = 42 + rnd() * 416;
    const y = 208 + rnd() * 86;
    const rot = (rnd() - 0.5) * 16;
    const g = el('g', { opacity: 0 }, docGroup);
    el('rect', { x: -12, y: -8.5, width: 24, height: 17, rx: 2.5, fill: '#121514', stroke: CYAN, 'stroke-width': 1, 'stroke-opacity': 0.45 }, g);
    [[-8, -4, 14], [-8, 0, 11], [-8, 4, 12]].forEach(([dx, dy, w]) =>
      el('rect', { x: dx, y: dy, width: w, height: 1.5, rx: 0.75, fill: CYAN, opacity: 0.5 }, g)
    );
    gsap.set(g, { x, y, rotation: rot, transformOrigin: '50% 50%' });
    docs.push({ g, mid: [x + (rnd() - 0.5) * 44, y + (rnd() - 0.5) * 22], plan: [250 + (rnd() - 0.5) * 8, 333] });
  }

  /* ---------- 最佳计划卡（汇聚产物） ---------- */
  const planC = { x: 250, y: 333 };
  const planG = el('g', { opacity: 0 }, svg);
  el('rect', { x: planC.x - 46, y: planC.y - 27, width: 92, height: 54, rx: 7, fill: '#121514', stroke: CYAN, 'stroke-width': 1.3 }, planG);
  const planLines = [[-34, -15, 52], [-34, -6, 40], [-34, 3, 46], [-34, 12, 28]].map(([dx, dy, w]) => {
    const r = el('rect', { x: planC.x + dx, y: planC.y + dy, width: 0, height: 2, rx: 1, fill: CYAN, opacity: 0.6 }, planG);
    return { r, w };
  });
  el('text', {
    x: planC.x, y: planC.y + 42, 'text-anchor': 'middle',
    class: 'scene-label', fill: '#6B7069',
  }, planG, 'PLAN · 最佳计划');

  /* ---------- scrub 主时间线 ---------- */
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: prefersReduced()
      ? undefined
      : { trigger: host, start: 'top 88%', end: 'bottom 52%', scrub: 0.7 },
  });

  // ① 骨架
  tl.fromTo(flow, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.16, ease: 'power2.out' }, 0.06);
  nodes.forEach((n, i) => {
    tl.fromTo(n.g, { opacity: 0, scale: 0.4, transformOrigin: 'center' }, { opacity: 1, scale: 1, duration: 0.1, ease: 'back.out(2)' }, 0.06 + i * 0.05);
  });
  // ② 文档浮现 + 浏览（停留更久：长漂移 + 扫描线）
  docs.forEach((d, i) => {
    tl.to(d.g, { opacity: 0.85, duration: 0.12 }, 0.14 + (i % 8) * 0.03);
    tl.to(d.g, { x: d.mid[0], y: d.mid[1], duration: 0.34, ease: 'sine.inOut' }, 0.2 + (i % 8) * 0.03);
  });
  tl.to(scan, { opacity: 0.22, duration: 0.06 }, 0.22)
    .to(scan, { attr: { y: 296 }, duration: 0.3, ease: 'none' }, 0.22)
    .to(scan, { opacity: 0, duration: 0.06 }, 0.5);
  // ③ 文档汇聚到最佳计划（淡入消失，融入计划）
  docs.forEach((d, i) => {
    tl.to(d.g, {
      x: d.plan[0], y: d.plan[1], rotation: 0, scale: 0.25, opacity: 0,
      duration: 0.24, ease: 'power2.in',
    }, 0.56 + (i % 8) * 0.02);
  });
  // ④ 最佳计划浮现
  tl.to(planG, { opacity: 1, duration: 0.1 }, 0.84)
    .fromTo(planG, { scale: 0.7, transformOrigin: '250px 333px' }, { scale: 1, duration: 0.14, ease: 'power2.out' }, 0.84);
  planLines.forEach((l, i) => {
    tl.to(l.r, { attr: { width: l.w }, duration: 0.06, ease: 'power1.out' }, 0.88 + i * 0.02);
  });

  if (prefersReduced()) {
    tl.progress(1);
    return;
  }

  /* ---------- idle 微循环 ---------- */
  const idle = gsap.timeline({ repeat: -1, paused: true });
  nodes.forEach((n) => {
    idle.to(n.core, { attr: { r: 4.4 }, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }, 0.2);
  });
  docs.forEach((d) => {
    idle.to(d.g, { opacity: 0.55, duration: 1.2 + rnd(), yoyo: true, repeat: -1, ease: 'sine.inOut' }, rnd() * 2);
  });
  idle.pause();

  ScrollTrigger.create({
    trigger: host,
    start: 'top 95%',
    end: 'bottom 5%',
    onToggle: (self) => (self.isActive ? idle.play() : idle.pause()),
  });
}
