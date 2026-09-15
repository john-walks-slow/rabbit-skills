/**
 * scene-research.ts — 信息收敛与最佳判断（Research → Plan → Align）
 *
 * 叙事：散落的信息点先漂浮收集 → 汇聚到 R/P/A 三锚点 →
 * 粒子从锚点合流到底部「最佳判断」节点。
 * scrub 驱动 + 进入视口后的 idle 微循环（轨道旋转 / 星点呼吸 / 判断点脉冲）。
 */
import { gsap, ScrollTrigger, prefersReduced } from '../motion';
import { el, svgRoot, seeded } from '../svg';

const CYAN = '#62D8E6';

interface Dot {
  node: SVGCircleElement;
  from: [number, number];
  mid: [number, number];
  to: [number, number];
  judge: [number, number];
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

  /* ---------- 判断节点 ---------- */
  const judgeC = { x: 250, y: 338 };
  const judgeG = el('g', { opacity: 0 }, svg);
  el('circle', { cx: judgeC.x, cy: judgeC.y, r: 9, fill: '#121514', stroke: CYAN, 'stroke-width': 1.3 }, judgeG);
  const judgeCore = el('circle', { cx: judgeC.x, cy: judgeC.y, r: 3.4, fill: CYAN }, judgeG);
  el('text', {
    x: judgeC.x, y: judgeC.y + 26, 'text-anchor': 'middle',
    class: 'scene-label', fill: '#6B7069',
  }, judgeG, 'JUDGMENT · 最佳判断');

  /* ---------- 散点（信息星图）：漂浮收集 → 汇聚锚点 → 合流判断 ---------- */
  const dotGroup = el('g', {}, svg);
  const dots: Dot[] = [];
  for (let i = 0; i < 26; i++) {
    const x = 58 + rnd() * 384;
    const y = 38 + rnd() * 196;
    const nearest = anchors.reduce((best, a) => {
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      return d < best.d ? { a, d } : best;
    }, { a: anchors[0], d: Infinity }).a;
    const mid: [number, number] = [x + (rnd() - 0.5) * 36, y + (rnd() - 0.5) * 24];
    const node = el('circle', { cx: x, cy: y, r: 1.1 + rnd() * 1.3, fill: CYAN, opacity: 0 }, dotGroup);
    // 合流终点：判断节点附近小幅散布
    const judge: [number, number] = [judgeC.x + (rnd() - 0.5) * 5, judgeC.y];
    dots.push({ node, from: [x, y], mid, to: [nearest.x, nearest.y], judge });
  }

  /* ---------- scrub 主时间线 ---------- */
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

  // ① 散点浮现 + 漂浮收集（停留更久：先游走再汇聚）
  dots.forEach((d, i) => {
    tl.to(d.node, { opacity: 0.75, duration: 0.1 }, 0.06 + (i % 9) * 0.02);
    tl.to(d.node, {
      attr: { cx: d.mid[0], cy: d.mid[1] },
      duration: 0.22, ease: 'sine.inOut',
    }, 0.16 + (i % 9) * 0.02);
    // 汇聚到最近锚点
    tl.to(d.node, {
      attr: { cx: d.to[0], cy: d.to[1] },
      opacity: 0.14,
      duration: 0.2,
    }, 0.42 + (i % 9) * 0.025);
  });
  // ② 流线
  tl.fromTo(flow, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.22, ease: 'power2.out' }, 0.5);
  // ③ 节点
  nodes.forEach((n, i) => {
    tl.fromTo(n.g, { opacity: 0, scale: 0.4, transformOrigin: 'center' }, { opacity: 1, scale: 1, duration: 0.12, ease: 'back.out(2)' }, 0.54 + i * 0.06);
  });
  // ④ 粒子合流到判断节点（淡入消失，融入判断）
  dots.forEach((d, i) => {
    tl.to(d.node, {
      attr: { cx: d.judge[0], cy: d.judge[1] },
      opacity: 0,
      duration: 0.22, ease: 'power2.in',
    }, 0.64 + (i % 9) * 0.02);
  });
  // ⑤ 最佳判断点亮
  tl.to(judgeG, { opacity: 1, duration: 0.1, ease: 'power2.out' }, 0.86);

  if (prefersReduced()) {
    tl.progress(1);
    return;
  }

  /* ---------- idle 微循环（进入视口才跑） ---------- */
  const idle = gsap.timeline({ repeat: -1, paused: true });
  orbits.forEach((o, i) => {
    idle.to(o, { rotation: i % 2 ? -360 : 360, transformOrigin: '50% 50%', duration: 40 + i * 10, ease: 'none', repeat: -1 }, 0);
  });
  dots.forEach((d) => {
    const r0 = Number(d.node.getAttribute('r'));
    idle.to(d.node, { attr: { r: r0 * 0.45 }, duration: 0.9 + rnd(), yoyo: true, repeat: -1, ease: 'sine.inOut' }, rnd() * 2);
  });
  nodes.forEach((n) => {
    idle.to(n.core, { attr: { r: 4.6 }, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }, 0.2);
  });
  // 判断点脉冲
  idle.to(judgeCore, { attr: { r: 5 }, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }, 0.3);
  idle.pause();

  ScrollTrigger.create({
    trigger: host,
    start: 'top 95%',
    end: 'bottom 5%',
    onToggle: (self) => (self.isActive ? idle.play() : idle.pause()),
  });
}
