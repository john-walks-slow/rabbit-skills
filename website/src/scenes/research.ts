/**
 * scene-research.ts — 浏览海量信息 → 产出最佳计划（Research → Plan → Align）
 *
 * 叙事：R/P/A 三相骨架（调研→规划→对齐）在上；散落的信息粒子
 * 经一段较长的漂浮收集 → 合流到垂直居中的「最佳计划」——
 * 浏览了海量资料，产出最佳计划。
 * scrub 驱动 + 进入视口后的 idle 微循环。
 */
import { gsap, ScrollTrigger, prefersReduced } from '../motion';
import { el, svgRoot, seeded } from '../svg';

const CYAN = '#62D8E6';

interface Dot {
  node: SVGCircleElement;
  mid: [number, number];
  plan: [number, number];
  r0: number;
}

export function initResearchScene() {
  const host = document.getElementById('scene-research');
  if (!host) return;

  const svg = svgRoot('0 0 500 400', host);
  const rnd = seeded(20260908);

  /* ---------- R / P / A 骨架（中英文） ---------- */
  const anchors: Array<{ x: number; y: number; en: string; zh: string }> = [
    { x: 138, y: 118, en: 'RESEARCH', zh: '调研' },
    { x: 250, y: 82, en: 'PLAN', zh: '规划' },
    { x: 362, y: 118, en: 'ALIGN', zh: '对齐' },
  ];
  const nodeGroup = el('g', {}, svg);
  const nodes = anchors.map((a) => {
    const g = el('g', { opacity: 0 }, nodeGroup);
    el('circle', { cx: a.x, cy: a.y, r: 9, fill: '#121514', stroke: CYAN, 'stroke-width': 1.2 }, g);
    const core = el('circle', { cx: a.x, cy: a.y, r: 3.2, fill: CYAN }, g);
    el('text', {
      x: a.x, y: a.y - 20, 'text-anchor': 'middle',
      class: 'scene-label', fill: '#A4A89D',
    }, g, a.en);
    el('text', {
      x: a.x, y: a.y - 9, 'text-anchor': 'middle',
      'font-size': 9.5, fill: 'rgba(164,168,157,0.85)',
      'font-family': 'Space Grotesk, PingFang SC, sans-serif',
    }, g, a.zh);
    return { g, core, a };
  });
  const flow = el('path', {
    d: `M 138 118 C 172 88 214 82 250 82 C 286 82 328 88 362 118`,
    fill: 'none', stroke: CYAN, 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.7,
  }, svg);

  /* ---------- 最佳计划卡（垂直居中，汇聚产物） ---------- */
  const planC = { x: 250, y: 232 };
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

  /* ---------- 信息粒子（漂浮收集 → 合流到计划） ---------- */
  const dotGroup = el('g', {}, svg);
  const dots: Dot[] = [];
  for (let i = 0; i < 26; i++) {
    const x = 44 + rnd() * 412;
    const y = 165 + rnd() * 140;
    const r0 = 1.1 + rnd() * 1.4;
    const node = el('circle', { cx: x, cy: y, r: r0, fill: CYAN, opacity: 0 }, dotGroup);
    dots.push({
      node,
      mid: [x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 26],
      plan: [planC.x + (rnd() - 0.5) * 6, planC.y],
      r0,
    });
  }

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
  // ② 粒子浮现 + 漂浮收集（停留更久：长漂移）
  dots.forEach((d, i) => {
    tl.to(d.node, { opacity: 0.75, duration: 0.1 }, 0.14 + (i % 9) * 0.02);
    tl.to(d.node, {
      attr: { cx: d.mid[0], cy: d.mid[1] },
      duration: 0.34, ease: 'sine.inOut',
    }, 0.2 + (i % 9) * 0.02);
  });
  // ③ 粒子合流到计划（淡入消失）
  dots.forEach((d, i) => {
    tl.to(d.node, {
      attr: { cx: d.plan[0], cy: d.plan[1] },
      opacity: 0,
      duration: 0.24, ease: 'power2.in',
    }, 0.58 + (i % 9) * 0.02);
  });
  // ④ 最佳计划浮现
  tl.to(planG, { opacity: 1, duration: 0.1 }, 0.82)
    .fromTo(planG, { scale: 0.7, transformOrigin: '250px 232px' }, { scale: 1, duration: 0.14, ease: 'power2.out' }, 0.82);
  planLines.forEach((l, i) => {
    tl.to(l.r, { attr: { width: l.w }, duration: 0.06, ease: 'power1.out' }, 0.86 + i * 0.02);
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
  dots.forEach((d) => {
    idle.to(d.node, { attr: { r: d.r0 * 0.45 }, duration: 0.9 + rnd(), yoyo: true, repeat: -1, ease: 'sine.inOut' }, rnd() * 2);
  });
  idle.pause();

  ScrollTrigger.create({
    trigger: host,
    start: 'top 95%',
    end: 'bottom 5%',
    onToggle: (self) => (self.isActive ? idle.play() : idle.pause()),
  });
}
