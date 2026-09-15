/**
 * scene-implement.ts — 六站流水线（Implement → Test → Review → Validate → Doc → Commit）
 *
 * 叙事：代码块沿传送带前进，途经六站；闸门依次放行、站点依次点亮、
 * 检视通过打上对勾；终点盖下 commit hash —— 干净交付。
 */
import { gsap, ScrollTrigger, prefersReduced } from '../motion';
import { el, svgRoot } from '../svg';

const GREEN = '#82DF8D';

const STATIONS = [
  { x: 62, label: 'IMPLEMENT', zh: '实施' },
  { x: 138, label: 'TEST', zh: '测试' },
  { x: 214, label: 'REVIEW', zh: '检视' },
  { x: 290, label: 'VALIDATE', zh: '验证' },
  { x: 366, label: 'DOC', zh: '文档' },
  { x: 442, label: 'COMMIT', zh: '提交' },
];

const TRACK_Y = 148;
const BLOCK_X0 = 34;
const BLOCK_X1 = 442;

export function initImplementScene() {
  const host = document.getElementById('scene-implement');
  if (!host) return;

  const svg = svgRoot('0 0 500 400', host);

  /* ---------- 传送带 ---------- */
  el('line', {
    x1: 28, y1: TRACK_Y, x2: 472, y2: TRACK_Y,
    stroke: 'rgba(233,234,227,0.1)', 'stroke-width': 1,
  }, svg);
  const belt = el('line', {
    x1: 28, y1: TRACK_Y + 0.5, x2: 472, y2: TRACK_Y + 0.5,
    stroke: 'rgba(130,223,141,0.28)', 'stroke-width': 1, 'stroke-dasharray': '3 7',
  }, svg);

  /* ---------- 闸门 ---------- */
  const gates = STATIONS.slice(0, -1).map((s, i) => {
    const mx = (STATIONS[i].x + STATIONS[i + 1].x) / 2;
    const g = el('g', {}, svg);
    el('rect', {
      x: mx - 1, y: TRACK_Y - 9, width: 2, height: 18, rx: 1,
      fill: 'rgba(233,234,227,0.3)',
    }, g);
    return g;
  });

  /* ---------- 站点 ---------- */
  const stationEls = STATIONS.map((s) => {
    const g = el('g', {}, svg);
    const box = el('rect', {
      x: s.x - 7, y: TRACK_Y - 7, width: 14, height: 14, rx: 4,
      fill: '#121514', stroke: 'rgba(233,234,227,0.3)', 'stroke-width': 1.2,
    }, g);
    const check = el('path', {
      d: `M ${s.x - 3.2} ${TRACK_Y} l 2.2 2.4 l 4.4 -5`,
      fill: 'none', stroke: GREEN, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      opacity: 0,
    }, g);
    el('text', {
      x: s.x, y: TRACK_Y + 30, 'text-anchor': 'middle',
      class: 'scene-label', fill: '#6B7069',
    }, g, s.label);
    el('text', {
      x: s.x, y: TRACK_Y + 42, 'text-anchor': 'middle',
      'font-size': 9.5, fill: 'rgba(164,168,157,0.85)',
      'font-family': 'Space Grotesk, PingFang SC, sans-serif',
    }, g, s.zh);
    return { g, box, check, s };
  });

  /* ---------- 代码块（主角） ---------- */
  const block = el('g', {}, svg);
  el('rect', {
    x: -19, y: -15, width: 38, height: 30, rx: 7,
    fill: '#181C1A', stroke: 'rgba(233,234,227,0.35)', 'stroke-width': 1.2,
  }, block);
  [[-11, -7, 18], [-11, 0, 26], [-11, 7, 14]].forEach(([x, y, w]) =>
    el('rect', { x, y, width: w, height: 2.6, rx: 1.3, fill: 'rgba(233,234,227,0.3)' }, block)
  );
  gsap.set(block, { x: BLOCK_X0, y: TRACK_Y });

  /* ---------- commit 芯片 ---------- */
  const chipG = el('g', { opacity: 0 }, svg);
  // 连接线（COMMIT 站 → 芯片）
  el('path', {
    d: `M 442 ${TRACK_Y + 10} C 442 260 420 270 386 282`,
    fill: 'none', stroke: 'rgba(130,223,141,0.4)', 'stroke-width': 1, 'stroke-dasharray': '2 3',
  }, chipG);
  el('rect', {
    x: 268, y: 270, width: 200, height: 40, rx: 9,
    fill: '#121514', stroke: GREEN, 'stroke-width': 1.3,
  }, chipG);
  el('circle', { cx: 288, cy: 290, r: 4, fill: GREEN }, chipG);
  el('text', {
    x: 300, y: 294,
    fill: '#E9EAE3', 'font-family': 'JetBrains Mono, monospace', 'font-size': 11,
  }, chipG, 'committed · 6 files');

  // commit 节点爆出的小火花（从节点中心向外飞，attr 动画避免 transform-origin 坑）
  const burstG = el('g', { opacity: 0 }, svg);
  const sparks = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const c = Math.cos(rad), s = Math.sin(rad);
    return {
      line: el('line', { x1: 442 + c * 16, y1: TRACK_Y + s * 16, x2: 442 + c * 22, y2: TRACK_Y + s * 22, stroke: GREEN, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, burstG),
      c, s,
    };
  });

  /* ---------- 验证徽标（VALIDATE 站上方） ---------- */
  el('text', {
    x: 290, y: TRACK_Y - 26, 'text-anchor': 'middle',
    class: 'scene-label', fill: 'rgba(107,112,105,0.9)',
  }, svg, 'GATES · 每站放行才前进');

  /* ---------- scrub 时间线 ---------- */
  const reduced = prefersReduced();
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: reduced ? undefined : { trigger: host, start: 'top 88%', end: 'bottom 52%', scrub: 0.7 },
  });

  const T0 = 0.08;
  const T1 = 0.72;
  const span = BLOCK_X1 - BLOCK_X0;

  // 代码块前进（线性 = 传送带感）
  tl.to(block, { x: BLOCK_X1, duration: T1 - T0 }, T0);

  STATIONS.forEach((s, i) => {
    const tPass = T0 + ((s.x - BLOCK_X0) / span) * (T1 - T0);
    // 站点点亮
    tl.to(stationEls[i].box, { stroke: GREEN, fill: 'rgba(130,223,141,0.12)', duration: 0.03 }, Math.max(tPass, T0 + 0.01));
    // 对勾弹出
    if (!reduced) {
      tl.fromTo(stationEls[i].check, { opacity: 0, scale: 0.3, transformOrigin: 'center' }, { opacity: 1, scale: 1, duration: 0.04, ease: 'back.out(2.5)' }, tPass + 0.015);
    } else {
      tl.to(stationEls[i].check, { opacity: 1, duration: 0.01 }, tPass);
    }
    // 闸门翻转放行
    if (i < gates.length) {
      const tGate = T0 + ((STATIONS[i].x - BLOCK_X0 + 26) / span) * (T1 - T0);
      tl.to(gates[i], { rotation: 90, opacity: 0.25, transformOrigin: '50% 50%', svgOrigin: `${(STATIONS[i].x + STATIONS[i + 1].x) / 2} ${TRACK_Y}`, duration: 0.035, ease: 'power2.in' }, tGate);
    }
  });

  // 终点：火花从 commit 节点爆出（刚碰到即炸）+ 芯片
  tl.to(burstG, { opacity: 1, duration: 0.02 }, T1);
  sparks.forEach((sp) => {
    tl.fromTo(sp.line,
      { attr: { x1: 442 + sp.c * 16, y1: TRACK_Y + sp.s * 16, x2: 442 + sp.c * 22, y2: TRACK_Y + sp.s * 22 } },
      { attr: { x1: 442 + sp.c * 28, y1: TRACK_Y + sp.s * 28, x2: 442 + sp.c * 38, y2: TRACK_Y + sp.s * 38 }, duration: 0.12, ease: 'power2.out' }, T1)
      .to(sp.line, { opacity: 0, duration: 0.1, ease: 'none' }, T1 + 0.1);
  });
  tl.fromTo(chipG, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.09, ease: 'power2.out' }, T1 + 0.06);

  if (reduced) {
    tl.progress(1);
    return;
  }

  /* ---------- idle：传送带流动 ---------- */
  const idle = gsap.timeline({ paused: true });
  idle.to(belt, { attr: { 'stroke-dashoffset': -10 }, duration: 0.6, ease: 'none', repeat: -1 }, 0);

  ScrollTrigger.create({
    trigger: host,
    start: 'top 95%',
    end: 'bottom 5%',
    onToggle: (self) => (self.isActive ? idle.play() : idle.pause()),
  });
}
