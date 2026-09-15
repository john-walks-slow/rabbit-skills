/**
 * main.ts — 入口
 */
import './styles.css';

import { ScrollTrigger, prefersReduced } from './motion';
import { boot } from './boot';
import { initHeroCanvas } from './hero-canvas';
import { initReveals } from './reveal';
import { initResearchScene } from './scenes/research';
import { initTroubleshootScene } from './scenes/troubleshoot';
import { initImplementScene } from './scenes/implement';
import { initBrowser } from './browser';
import { initCopy } from './copy';
import { initDocsTabs } from './docs';
import { drawRabbit } from './rabbit';

/* ---------- 入口编排（每步隔离，失败不拖垮全局） ---------- */
const steps: Array<[string, () => void]> = [
  ['boot', boot],
  ['hero-canvas', () => initHeroCanvas()],
  ['reveals', () => initReveals()],
  ['scene-research', () => initResearchScene()],
  ['scene-troubleshoot', () => initTroubleshootScene()],
  ['scene-implement', () => initImplementScene()],
  ['browser', () => initBrowser()],
  ['docs-tabs', () => initDocsTabs()],
  ['copy', () => initCopy()],
];

const failures: string[] = [];
for (const [name, fn] of steps) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    console.error(`[init] ${name} failed`, e);
  }
}
if (failures.length) {
  document.documentElement.setAttribute('data-init-failures', failures.join(' | '));
}

/* nav / outro 兔子入场（nav 立即，outro 进入视口时；reduced 直接终态） */
const navCrest = document.querySelector('#nav-crest svg') as SVGSVGElement | null;
if (navCrest) {
  if (prefersReduced()) drawRabbit(navCrest, 0)?.progress(1);
  else drawRabbit(navCrest, 0.15);
}

const outroCrest = document.querySelector('#outro-crest');
if (outroCrest) {
  const rabbitEl = outroCrest.querySelector('svg') as SVGSVGElement | null;
  if (rabbitEl) {
    if (prefersReduced()) {
      drawRabbit(rabbitEl, 0)?.progress(1);
    } else {
      ScrollTrigger.create({
        trigger: outroCrest,
        start: 'top 92%',
        once: true,
        onEnter: () => drawRabbit(rabbitEl, 0),
      });
    }
  }
}

/* 字体加载完成后刷新滚动测量 */
if (document.fonts?.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/* GitHub stars（非阻塞，失败静默） */
fetch('https://api.github.com/repos/john-walks-slow/rabbit-skills')
  .then((r) => (r.ok ? r.json() : null))
  .then((j) => {
    if (j?.stargazers_count != null) {
      const el = document.getElementById('nav-stars');
      if (el) el.textContent = `${j.stargazers_count.toLocaleString('en-US')} stars`;
    }
  })
  .catch(() => undefined);
