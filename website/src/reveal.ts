/**
 * reveal.ts — 滚动进入动效
 * section 标签 ScrambleText、标题逐行升起、卡片 stagger、导航态。
 */
import { gsap, ScrollTrigger, prefersReduced, EASE } from './motion';
import { SplitText } from 'gsap/SplitText';

export function initReveals() {
  const reduced = prefersReduced();

  /* ---------- nav 滚动态 ---------- */
  const nav = document.getElementById('nav')!;
  ScrollTrigger.create({
    start: 24,
    onUpdate: (self) => nav.classList.toggle('is-scrolled', self.scroll() > 24),
  });

  /* ---------- 移动端菜单 ---------- */
  const burger = document.getElementById('nav-burger');
  const links = document.querySelector('.nav-links');
  const closeMenu = () => {
    links?.classList.remove('is-open');
    burger?.setAttribute('aria-expanded', 'false');
  };
  burger?.addEventListener('click', () => {
    const open = links?.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(!!open));
  });
  links?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && links?.classList.contains('is-open')) closeMenu();
  });

  /* ---------- nav 高亮当前 section ---------- */
  for (const id of ['philosophy', 'workflows', 'contents', 'install']) {
    const section = document.getElementById(id);
    if (!section) continue;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => {
        const link = document.querySelector(`.nav-links a[href="#${id}"]`);
        link?.classList.toggle('is-active', self.isActive);
      },
    });
  }

  if (reduced) return; // 以下均为增强动效

  /* ---------- section 标签：ScrambleText ---------- */
  document.querySelectorAll<HTMLElement>('[data-reveal-text]').forEach((elm) => {
    const original = elm.textContent || '';
    ScrollTrigger.create({
      trigger: elm,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(elm, {
          duration: 0.9,
          scrambleText: { text: original, chars: '!<>-_\\/[]{}=+*^?#', speed: 0.5 },
          ease: 'none',
        });
      },
    });
  });

  /* ---------- 标题逐行升起（mask reveal；resize 后重排防裁剪） ---------- */
  const wrapLines = (elm: HTMLElement): SplitText => {
    const split = new SplitText(elm, { type: 'lines', linesClass: 'line' });
    split.lines.forEach((line) => {
      const inner = document.createElement('span');
      inner.className = 'line-inner';
      line.appendChild(inner);
      while (line.firstChild !== inner) inner.appendChild(line.firstChild!);
    });
    gsap.set(split.lines, { overflow: 'hidden' });
    return split;
  };

  const lineSplits: Array<{ elm: HTMLElement; split: SplitText; revealed: boolean }> = [];
  document.querySelectorAll<HTMLElement>('[data-split-lines]').forEach((elm) => {
    const entry: { elm: HTMLElement; split: SplitText; revealed: boolean } = {
      elm,
      split: wrapLines(elm),
      revealed: false,
    };
    lineSplits.push(entry);
    gsap.set(elm.querySelectorAll('.line-inner'), { yPercent: 108 });
    ScrollTrigger.create({
      trigger: elm,
      start: 'top 86%',
      once: true,
      onEnter: () => {
        entry.revealed = true;
        gsap.to(elm.querySelectorAll('.line-inner'), {
          yPercent: 0,
          duration: 0.85,
          stagger: 0.1,
          ease: EASE.out,
        });
      },
    });
  });

  // 窗口尺寸变化后换行点漂移：重拆并保持各自状态（已展示→终态，未展示→隐藏态）
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      for (const entry of lineSplits) {
        entry.split.revert();
        entry.split = wrapLines(entry.elm);
        gsap.set(entry.elm.querySelectorAll('.line-inner'), { yPercent: entry.revealed ? 0 : 108 });
      }
      ScrollTrigger.refresh();
    }, 250);
  });

  /* ---------- 通用 fade-rise（不含卡片，卡片走组 stagger） ---------- */
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((elm) => {
    gsap.set(elm, { opacity: 0, y: 22 });
    ScrollTrigger.create({
      trigger: elm,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(elm, { opacity: 1, y: 0, duration: 0.75, ease: EASE.out });
      },
    });
  });

  /* ---------- 卡片 stagger（同容器内成组） ---------- */
  const groups = new Map<Element, HTMLElement[]>();
  document.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
    const parent = card.parentElement!;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent)!.push(card);
  });
  for (const [, cards] of groups) {
    gsap.set(cards, { opacity: 0, y: 22 });
    ScrollTrigger.create({
      trigger: cards[0],
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(cards, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: EASE.out });
      },
    });
  }
}
