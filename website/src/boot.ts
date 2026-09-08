/**
 * boot.ts — 首屏入场编排
 *
 * 调研参数落地：
 * - 标题 SplitText 逐字 y 110%→0 · 0.9s · stagger 0.035s · power4.out
 * - 单条编排轨道 ≤ 1.2s，整体分层并行
 * - reduced-motion → 一次性 150ms 淡入
 */
import { gsap, prefersReduced, EASE } from './motion';
import { SplitText } from 'gsap/SplitText';
import { createRabbit, drawRabbit } from './rabbit';
import { data } from './data';

export function boot() {
  // ---- 星座兔注入（nav / hero / outro） ----
  const navCrest = document.getElementById('nav-crest');
  const heroCrest = document.getElementById('hero-crest');
  const outroCrest = document.getElementById('outro-crest');
  if (navCrest) navCrest.appendChild(createRabbit({ glow: false }));
  if (heroCrest) heroCrest.appendChild(createRabbit({ glow: true }));
  if (outroCrest) outroCrest.appendChild(createRabbit({ glow: true }));

  // ---- 数据绑定 ----
  const versionEl = document.getElementById('hero-version');
  if (versionEl) versionEl.textContent = `v${data.version}`;

  const stats = document.querySelectorAll<HTMLElement>('[data-count]');
  const nums = [data.counts.skill, data.counts.agent, data.totalLines, data.targets.length];
  stats.forEach((el, i) => {
    el.dataset.count = String(nums[i] ?? 0);
  });

  // ---- 标题（文本包裹 + 追加胡萝卜句点星） ----
  const title = document.getElementById('hero-title');
  let chars: Element[] = [];
  let dot: HTMLElement | null = null;
  if (title) {
    // 文本包进 span（SplitText 只处理纯文本节点，避免吞掉装饰元素）
    const textSpan = document.createElement('span');
    textSpan.textContent = title.textContent;
    title.textContent = '';
    title.appendChild(textSpan);

    const dotEl = document.createElement('span');
    dotEl.className = 'char-dot';
    dotEl.setAttribute('aria-hidden', 'true');
    title.appendChild(dotEl);
    dot = dotEl;

    if (!prefersReduced()) {
      const split = new SplitText(textSpan, { type: 'chars', charsClass: 'char', mask: 'chars' });
      chars = split.chars;
      gsap.set(dot, { scale: 0 });
    }
  }

  // ---- reduced-motion 快速通道 ----
  if (prefersReduced()) {
    gsap.set('.hero-kicker, .hero-sub, .hero-cta, .hero-stats, .hero-scroll-hint', { opacity: 1 });
    stats.forEach((el) => {
      const n = Number(el.dataset.count ?? 0);
      el.textContent = n >= 1000 ? n.toLocaleString('en-US') : String(n);
    });
    return;
  }

  // ---- 初始态 ----
  gsap.set('.kicker-item', { opacity: 0, y: 10 });
  gsap.set('.kicker-dot', { scale: 0 });
  if (title && chars.length) gsap.set(chars, { yPercent: 115 });
  gsap.set('.hero-sub', { opacity: 0, y: 18 });
  gsap.set('.hero-cta', { opacity: 0, y: 16 });
  gsap.set('.hero-stats .stat', { opacity: 0, y: 14 });
  gsap.set('.hero-scroll-hint', { opacity: 0 });
  gsap.set('.hero-crest', { opacity: 0 });

  // ---- 主时间线 ----
  const tl = gsap.timeline({ defaults: { ease: EASE.out } });

  tl.to('.hero-crest', { opacity: 1, duration: 0.01 }, 0.05);
  const heroRabbit = heroCrest?.querySelector('svg');
  if (heroRabbit) {
    const rabbitTl = drawRabbit(heroRabbit as SVGSVGElement, 0.12);
    if (rabbitTl) tl.add(rabbitTl, 0.05);
  }
  tl.to('.kicker-item', { opacity: 1, y: 0, duration: 0.55, stagger: 0.08 }, 0.35)
    .to('.kicker-dot', { scale: 1, duration: 0.4, stagger: 0.1, ease: 'back.out(2.5)' }, 0.45)
    .to(chars, { yPercent: 0, duration: 0.95, stagger: 0.032 }, 0.52)
    .to(dot, { scale: 1, duration: 0.55, ease: 'back.out(3.4)' }, '-=0.15')
    .to('.hero-sub', { opacity: 1, y: 0, duration: 0.7 }, '-=0.55')
    .to('.hero-cta', { opacity: 1, y: 0, duration: 0.65 }, '-=0.45')
    .to(
      '.hero-stats .stat',
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.07 },
      '-=0.35'
    )
    // countUp 挂在时间线上（stagger 的 onComplete 会每个 target 各触发一次）
    .add(() => countUp(), '-=0.3')
    .to('.hero-scroll-hint', { opacity: 1, duration: 0.8 }, '-=0.1');
}

/** 统计数字 count-up（tabular-nums，1.4s） */
function countUp() {
  const stats = document.querySelectorAll<HTMLElement>('[data-count]');
  stats.forEach((el) => {
    const target = Number(el.dataset.count || 0);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.4,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = target >= 1000 ? Math.round(obj.v).toLocaleString('en-US') : String(Math.round(obj.v));
      },
    });
  });
}
