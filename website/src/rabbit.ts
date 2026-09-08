/**
 * rabbit.ts — 星座兔 mark
 * 基于 lucide「rabbit」路径（ISC License），星座化处理：
 * 描边路径 + 关键顶点星标。一份定义，三处使用（nav / hero / outro） */
import { gsap } from 'gsap';

const STROKE_PATHS = [
  // 身体轮廓
  'M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1 1 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3',
  // 耳朵
  'M20 8.54V4a2 2 0 1 0-4 0v3',
  // 尾巴
  'M13 16a3 3 0 0 1 2.24 5',
  // 腮
  'M7.612 12.524a3 3 0 1 0-1.6 4.3',
];

/** 星标：[x, y, r, isCarrot]（24×24 空间） */
const STARS: Array<[number, number, number, boolean]> = [
  [18, 12, 1.05, true], // 眼睛 —— 胡萝卜色主星
  [12.4, 3.6, 0.62, false], // 耳基
  [6, 17, 0.62, false], // 背部
  [22, 14, 0.62, false], // 臀部
  [20, 4, 0.5, false], // 耳尖
];

export interface RabbitOptions {
  /** 描边色 */
  stroke?: string;
  /** 主星（眼睛）颜色 */
  star?: string;
  /** 星光晕 */
  glow?: boolean;
  /** 类名 */
  className?: string;
}

/** 创建星座兔 SVG 元素（不做动画；动画由调用方用 GSAP 驱动） */
export function createRabbit(opts: RabbitOptions = {}): SVGSVGElement {
  const { stroke = '#E9EAE3', star = '#FFA36B', glow = false, className } = opts;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  if (className) svg.setAttribute('class', className);

  const g = document.createElementNS(NS, 'g');
  g.setAttribute('stroke', stroke);
  g.setAttribute('stroke-width', '1');
  g.setAttribute('stroke-linecap', 'round');
  g.setAttribute('stroke-linejoin', 'round');
  g.setAttribute('opacity', '0.92');

  const pathEls: SVGPathElement[] = [];
  for (const d of STROKE_PATHS) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    g.appendChild(p);
    pathEls.push(p);
  }
  svg.appendChild(g);

  const starEls: SVGCircleElement[] = [];
  for (const [x, y, r, isCarrot] of STARS) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(x));
    c.setAttribute('cy', String(y));
    c.setAttribute('r', String(r));
    c.setAttribute('fill', isCarrot ? star : stroke);
    if (isCarrot && glow) {
      const halo = document.createElementNS(NS, 'circle');
      halo.setAttribute('cx', String(x));
      halo.setAttribute('cy', String(y));
      halo.setAttribute('r', String(r * 3.2));
      halo.setAttribute('fill', star);
      halo.setAttribute('opacity', '0.22');
      svg.appendChild(halo);
      starEls.push(halo);
    }
    svg.appendChild(c);
    starEls.push(c);
  }

  (svg as SVGSVGElement & { _paths: SVGPathElement[]; _stars: SVGCircleElement[] })._paths = pathEls;
  (svg as SVGSVGElement & { _paths: SVGPathElement[]; _stars: SVGCircleElement[] })._stars = starEls;
  return svg;
}

/** 快速入场：描边绘制 + 星标弹出（供 nav/outro 等轻量场景） */
export function drawRabbit(svg: SVGSVGElement, delay = 0) {
  const el = svg as SVGSVGElement & { _paths: SVGPathElement[]; _stars: SVGCircleElement[] };
  if (!el._paths) return;
  gsap.set(el._paths, { drawSVG: '0%' });
  gsap.set(el._stars, { scale: 0, transformOrigin: 'center' });
  const tl = gsap.timeline({ delay });
  tl.to(el._paths, { drawSVG: '100%', duration: 0.9, stagger: 0.05, ease: 'power2.inOut' })
    .to(el._stars, { scale: 1, duration: 0.5, stagger: 0.04, ease: 'back.out(2.2)' }, '-=0.45');
  return tl;
}
