/**
 * scene-research.ts — 浏览海量文档 → 产出最佳计划（Research → Plan → Align）
 *
 * 叙事：R/P/A 三相骨架居中；散落的文档卡 + 信息粒子经一段延后、
 * 放慢的漂浮收集 → 合流到底部「*.plan.md」——浏览海量资料，产出最佳计划。
 * scrub 驱动（更慢）+ 进入视口后的 idle 微循环。
 */
import { gsap, ScrollTrigger, prefersReduced } from '../motion';
import { el, svgRoot, seeded } from '../svg';

const CYAN = '#62D8E6';

export function initResearchScene() {
  const host = document.getElementById('scene-research');
  if (!host) return;

  const svg = svgRoot('0 0 500 400', host);
  const rnd = seeded(20260908);

  /* ---------- R / P / A 骨架（居中；中文在上、英文在下） ---------- */
  const anchors: Array<{ x: number; y: number; zh: string; en: string }> = [
    { x: 138, y: 165, zh: '调研', en: 'RESEARCH' },
    { x: 250, y: 135, zh: '规划', en: 'PLAN' },
    { x: 362, y: 165, zh: '对齐', en: 'ALIGN' },
  ];
  const nodeGroup = el('g', {}, svg);
  const nodes = anchors.map((a) => {
    const g = el('g', { opacity: 0 }, nodeGroup);
    el('circle', { cx: a.x, cy: a.y, r: 9, fill: '#121514', stroke: CYAN, 'stroke-width': 1.2 }, g);
    const core = el('circle', { cx: a.x, cy: a.y, r: 3.2, fill: CYAN }, g);
    el('text', {
      x: a.x, y: a.y - 20, 'text-anchor': 'middle',
      fill: '#E9EAE3', 'font-size': 12, 'font-weight': 500, 'font-family': 'Space Grotesk, PingFang SC, sans-serif',
    }, g, a.zh);
    el('text', {
      x: a.x, y: a.y + 26, 'text-anchor': 'middle',
      class: 'scene-label', fill: '#6B7069',
    }, g, a.en);
    return { g, core, a };
  });
  const flow = el('path', {
    d: `M 138 165 C 200 125 300 125 362 165`,
    fill: 'none', stroke: CYAN, 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.7,
  }, svg);

  /* ---------- 最终计划卡 *.plan.md（从下往上入场） ---------- */
  const planC = { x: 250, y: 270 };
  const planG = el('g', { opacity: 0 }, svg);
  el('rect', { x: planC.x - 46, y: planC.y - 27, width: 92, height: 54, rx: 7, fill: '#121514', stroke: CYAN, 'stroke-width': 1.3 }, planG);
  const planLines = [[-34, -15, 52], [-34, -6, 40], [-34, 3, 46], [-34, 12, 28]].map(([dx, dy, w]) => {
    const r = el('rect', { x: planC.x + dx, y: planC.y + dy, width: 0, height: 2, rx: 1, fill: CYAN, opacity: 0.6 }, planG);
    return { r, w };
  });
  el('text', {
    x: planC.x, y: planC.y + 42, 'text-anchor': 'middle',
    class: 'scene-label', fill: '#6B7069',
  }, planG, '*.plan.md');

  /* ---------- 文档卡 + 信息粒子（延后、放慢地漂浮收集 → 合流） ---------- */
  const fieldG = el('g', {}, svg);
  const docs: Array<{ g: SVGGElement; mid: [number, number]; plan: [number, number] }> = [];
  for (let i = 0; i < 8; i++) {
    const x = 56 + rnd() * 388;
    const y = 55 + rnd() * 180;
    const rot = (rnd() - 0.5) * 14;
    const g = el('g', { opacity: 0 }, fieldG);
    el('rect', { x: -12, y: -8.5, width: 24, height: 17, rx: 2.5, fill: '#121514', stroke: CYAN, 'stroke-width': 1, 'stroke-opacity': 0.45 }, g);
    [[-8, -4, 14], [-8, 0, 11], [-8, 4, 12]].forEach(([dx, dy, w]) =>
      el('rect', { x: dx, y: dy, width: w, height: 1.5, rx: 0.75, fill: CYAN, opacity: 0.5 }, g)
    );
    gsap.set(g, { x, y, rotation: rot, transformOrigin: '50% 50%' });
    docs.push({ g, mid: [x + (rnd() - 0.5) * 36, y + (rnd() - 0.5) * 20], plan: [planC.x + (rnd() - 0.5) * 6, planC.y] });
  }
  const dots: Array<{ node: SVGCircleElement; mid: [number, number]; plan: [number, number]; r0: number }> = [];
  for (let i = 0; i < 22; i++) {
    const x = 44 + rnd() * 412;
    const y = 50 + rnd() * 190;
    const r0 = 1.1 + rnd() * 1.4;
    const node = el('circle', { cx: x, cy: y, r: r0, fill: CYAN, opacity: 0 }, fieldG);
    dots.push({ node, mid: [x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 26], plan: [planC.x + (rnd() - 0.5) * 6, planC.y], r0 });
  }

  /* ---------- scrub 主时间线（延后、放慢） ---------- */
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: prefersReduced()
      ? undefined
      : { trigger: host, start: 'top 88%', end: 'bottom 52%', scrub: 1.6 },
  });

  // ① 骨架（延后到 0.2，放慢）
  tl.fromTo(flow, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.28, ease: 'power2.out' }, 0.2);
  nodes.forEach((n, i) => {
    tl.fromTo(n.g, { opacity: 0, scale: 0.4, transformOrigin: 'center' }, { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(2)' }, 0.2 + i * 0.08);
  });
  // ② 粒子浮现 + 漂浮收集（前半段只有 dot）
  dots.forEach((d, i) => {
    tl.to(d.node, { opacity: 0.75, duration: 0.14 }, 0.32 + (i % 11) * 0.025);
    tl.to(d.node, { attr: { cx: d.mid[0], cy: d.mid[1] }, duration: 0.2, ease: 'sine.inOut' }, 0.38 + (i % 11) * 0.025);
  });
  // ③ 文档卡浮现（汇聚时才出现）+ 合流到计划
  docs.forEach((d, i) => {
    tl.to(d.g, { opacity: 0.8, duration: 0.14 }, 0.54 + (i % 8) * 0.02);
    tl.to(d.g, { x: d.plan[0], y: d.plan[1], rotation: 0, scale: 0.25, opacity: 0, duration: 0.18, ease: 'power2.in' }, 0.6 + (i % 8) * 0.018);
  });
  dots.forEach((d, i) => {
    tl.to(d.node, { attr: { cx: d.plan[0], cy: d.plan[1] }, opacity: 0, duration: 0.16, ease: 'power2.in' }, 0.58 + (i % 11) * 0.018);
  });
  // ④ 最终计划从下往上入场
  tl.fromTo(planG, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, 0.74);
  // ⑤ 计划 hairlines 逐行书写（慢、顺序）
  planLines.forEach((l, i) => {
    tl.to(l.r, { attr: { width: l.w }, duration: 0.1, ease: 'none' }, 0.8 + i * 0.06);
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
