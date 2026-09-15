/**
 * scene-troubleshoot.ts — 根因排障：日志捕获 → 因果链 → 诊断结论
 *
 * 叙事：终端日志逐行读入 → 异常行被珊瑚色标记捕获 →
 * 现象→日志→根因 因果链逐级点亮 → 目标环锁定根因 →
 * 盖章「诊断结论」+ 85% 置信仪表。
 */
import { gsap, ScrollTrigger, prefersReduced } from '../motion';
import { el, svgRoot, seeded } from '../svg';

const CORAL = '#FF8075';

export function initTroubleshootScene() {
  const host = document.getElementById('scene-troubleshoot');
  if (!host) return;

  const svg = svgRoot('0 0 500 400', host);
  const rnd = seeded(771);

  /* ---------- 终端窗 ---------- */
  const term = el('g', {}, svg);
  el('rect', {
    x: 36, y: 26, width: 428, height: 134, rx: 10,
    fill: '#0A0C0B', stroke: 'rgba(233,234,227,0.14)', 'stroke-width': 1,
  }, term);
  // 标题栏
  [52, 64, 76].forEach((x) =>
    el('circle', { cx: x, cy: 44, r: 2.6, fill: 'rgba(233,234,227,0.18)' }, term)
  );
  el('text', {
    x: 250, y: 47, 'text-anchor': 'middle',
    class: 'scene-label', fill: '#6B7069',
  }, term, 'agent.log — frozen capture');
  el('line', {
    x1: 36, y1: 58, x2: 464, y2: 58,
    stroke: 'rgba(233,234,227,0.08)', 'stroke-width': 1,
  }, term);

  /* ---------- 日志行 ---------- */
  interface Row { rect: SVGRectElement; w: number; anomaly: boolean; }
  const rowsGroup = el('g', { 'clip-path': 'url(#ts-clip)' }, term);
  const clip = el('clipPath', { id: 'ts-clip' }, svg);
  el('rect', { x: 38, y: 60, width: 424, height: 98 }, clip);

  const rows: Row[] = [];
  const ROW_Y = [72, 84, 96, 108, 120, 132, 144];
  ROW_Y.forEach((y, i) => {
    const anomaly = i === 4;
    const w = anomaly ? 262 : 96 + Math.floor(rnd() * 250);
    const rect = el('rect', {
      x: 54, y, width: 0, height: 5, rx: 2.5,
      fill: anomaly ? CORAL : 'rgba(233,234,227,0.16)',
    }, rowsGroup);
    rows.push({ rect, w, anomaly });
    // 行首时间戳点缀
    el('rect', { x: 44, y, width: 5, height: 5, rx: 1, fill: 'rgba(233,234,227,0.1)' }, rowsGroup);
  });

  // 异常行标记（左缘珊瑚条 + 光晕）
  const anomalyMark = el('g', { opacity: 0 }, term);
  el('rect', { x: 40, y: ROW_Y[4] - 2, width: 3, height: 9, rx: 1.5, fill: CORAL }, anomalyMark);
  el('rect', { x: 44, y: ROW_Y[4] - 3, width: 404, height: 11, rx: 4, fill: CORAL, opacity: 0.08 }, anomalyMark);

  /* ---------- 因果链：复现 → 根因 → 诊断 ---------- */
  const chain: Array<{ x: number; y: number; label: string; sub: string }> = [
    { x: 120, y: 226, label: '复现', sub: 'REPRODUCE' },
    { x: 250, y: 252, label: '根因', sub: 'ROOT CAUSE' },
    { x: 380, y: 226, label: '诊断', sub: 'DIAGNOSE' },
  ];
  const connector = el('path', {
    d: `M 120 226 C 200 261 300 261 380 226`,
    fill: 'none', stroke: CORAL, 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.7,
  }, svg);

  const chainNodes = chain.map((c) => {
    const g = el('g', { opacity: 0 }, svg);
    el('circle', { cx: c.x, cy: c.y, r: 9, fill: '#121514', stroke: CORAL, 'stroke-width': 1.2 }, g);
    el('circle', { cx: c.x, cy: c.y, r: 3.2, fill: CORAL }, g);
    el('text', {
      x: c.x, y: c.y - 20, 'text-anchor': 'middle',
      fill: '#E9EAE3', 'font-size': 12, 'font-weight': 500, 'font-family': 'Space Grotesk, PingFang SC, sans-serif',
    }, g, c.label);
    el('text', {
      x: c.x, y: c.y + 26, 'text-anchor': 'middle',
      class: 'scene-label', fill: '#6B7069',
    }, g, c.sub);
    return { g, c };
  });

  // 根因锁定准星（4 tick，从大到小 snap-on；无虚线圆）
  const lockC = { x: 250, y: 252 };
  const lockG = el('g', { opacity: 0 }, svg);
  const reticleTicks = [
    [lockC.x, lockC.y - 26, lockC.x, lockC.y - 14],
    [lockC.x, lockC.y + 14, lockC.x, lockC.y + 26],
    [lockC.x - 26, lockC.y, lockC.x - 14, lockC.y],
    [lockC.x + 14, lockC.y, lockC.x + 26, lockC.y],
  ].map(([x1, y1, x2, y2]) =>
    el('line', { x1, y1, x2, y2, stroke: CORAL, 'stroke-width': 1.7, 'stroke-linecap': 'round' }, lockG)
  );

  /* ---------- 诊断产物卡（右侧，仿 plan 样式） ---------- */
  const cardC = { x: 395, y: 340 };
  const report = el('g', { opacity: 0 }, svg);
  el('rect', {
    x: cardC.x - 46, y: cardC.y - 27, width: 92, height: 54, rx: 7,
    fill: '#121514', stroke: CORAL, 'stroke-width': 1.3,
  }, report);
  const cardLines = [[-34, -15, 52], [-34, -6, 40], [-34, 3, 46], [-34, 12, 28]].map(([dx, dy, w]) => {
    const r = el('rect', { x: cardC.x + dx, y: cardC.y + dy, width: 0, height: 2, rx: 1, fill: CORAL, opacity: 0.6 }, report);
    return { r, w };
  });
  el('text', {
    x: cardC.x, y: cardC.y + 42, 'text-anchor': 'middle',
    class: 'scene-label', fill: '#6B7069',
  }, report, '*.troubleshoot.md');

  /* ---------- 95% 置信仪表（左侧） ---------- */
  const dialC = { x: 100, y: 340, r: 22 };
  const dial = el('g', { opacity: 0 }, svg);
  el('path', {
    d: `M ${dialC.x} ${dialC.y - dialC.r} a ${dialC.r} ${dialC.r} 0 1 1 -0.01 0`,
    fill: 'none', stroke: 'rgba(233,234,227,0.14)', 'stroke-width': 3,
  }, dial);
  const dialArc = el('path', {
    d: `M ${dialC.x} ${dialC.y - dialC.r} a ${dialC.r} ${dialC.r} 0 1 1 -0.01 0`,
    fill: 'none', stroke: CORAL, 'stroke-width': 3, 'stroke-linecap': 'round',
  }, dial);
  const dialNum = el('text', {
    x: dialC.x, y: dialC.y + 6, 'text-anchor': 'middle',
    fill: '#E9EAE3', 'font-family': 'JetBrains Mono, monospace', 'font-size': 16, 'font-weight': 500,
  }, dial, '0%');
  el('text', {
    x: dialC.x, y: dialC.y + 40, 'text-anchor': 'middle',
    class: 'scene-label', fill: '#6B7069',
  }, dial, 'BELIEF · 置信度');

  /* ---------- scrub 时间线 ---------- */
  const counter = { v: 0 };
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: prefersReduced()
      ? undefined
      : { trigger: host, start: 'top 88%', end: 'bottom 52%', scrub: 1.3 },
  });

  // 日志读入
  rows.forEach((r, i) => {
    tl.to(r.rect, { attr: { width: r.w }, duration: 0.06, ease: 'power1.out' }, 0.02 + i * 0.028);
  });
  // 异常标记 + 闪烁
  tl.to(anomalyMark, { opacity: 1, duration: 0.04 }, 0.3)
    .fromTo(anomalyMark, { opacity: 0.3 }, { opacity: 1, duration: 0.05, repeat: 2, yoyo: true, ease: 'none' }, 0.32);
  // 因果链（仿 R/P/A：单段 cubic arc + 节点 scale 入场）
  tl.fromTo(connector, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.28, ease: 'power2.out' }, 0.4);
  chainNodes.forEach((n, i) => {
    tl.fromTo(n.g, { opacity: 0, scale: 0.4, transformOrigin: 'center' }, { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(2)' }, 0.4 + i * 0.08);
  });
  // 根因锁定准星（从左下角滑入，慢）
  tl.to(lockG, { opacity: 1, duration: 0.05 }, 0.7)
    .fromTo(lockG, { x: -70, y: 45, scale: 1.4, transformOrigin: '250px 252px' }, { x: 0, y: 0, scale: 1, duration: 0.24, ease: 'power3.out' }, 0.7);
  // 置信仪表（随 rrd 开始即增加，持续更久）
  tl.to(dial, { opacity: 1, duration: 0.05 }, 0.4)
    .fromTo(dialArc, { drawSVG: '0%' }, { drawSVG: '95%', duration: 0.5, ease: 'power1.out' }, 0.42)
    .to(counter, { v: 95, duration: 0.5, ease: 'power1.out', onUpdate: () => (dialNum.textContent = String(Math.round(counter.v)) + '%') }, 0.42);
  // 诊断卡 + hairlines
  tl.fromTo(report, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }, 0.74);
  cardLines.forEach((l, i) => {
    tl.to(l.r, { attr: { width: l.w }, duration: 0.1, ease: 'none' }, 0.78 + i * 0.06);
  });

  if (prefersReduced()) {
    tl.progress(1);
    return;
  }

  /* ---------- idle 微循环 ---------- */
  const idle = gsap.timeline({ paused: true });
  // 准星 tick 脉冲（保持锁定感，无飘移虚线圆）
  reticleTicks.forEach((t) => {
    idle.fromTo(t, { opacity: 0.5 }, { opacity: 1, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }, 0.1);
  });

  ScrollTrigger.create({
    trigger: host,
    start: 'top 95%',
    end: 'bottom 5%',
    onToggle: (self) => (self.isActive ? idle.play() : idle.pause()),
  });
}
