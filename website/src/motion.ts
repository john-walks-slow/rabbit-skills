/**
 * motion.ts — 共享动效基座
 * 统一注册 GSAP 插件、暴露 reduced-motion 状态与常用 ease。
 * 调研结论落地：opt-in（no-preference 才启用重动效）、低端护栏。
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { SplitText } from 'gsap/SplitText';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, SplitText, MotionPathPlugin, ScrambleTextPlugin);

export { gsap, ScrollTrigger };

/** 用户是否偏好减少动效（支持 ?motion=reduced 强制开启） */
export const prefersReduced = () =>
  new URLSearchParams(location.search).get('motion') === 'reduced' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 移动端（粒子上限、复杂度降级用） */
export const isMobile = () => window.matchMedia('(max-width: 700px)').matches;

/** 单段编排 ≤ 1.2s、入场用 power4/expo —— 统一出口 */
export const EASE = {
  out: 'power4.out',
  io: 'power3.inOut',
  prod: 'power2.out',
} as const;
