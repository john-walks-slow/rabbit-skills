/**
 * svg.ts — 极简 SVG 构建助手（场景用）
 */
export const NS = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number>;

export function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  parent?: Element,
  text?: string
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text != null) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export function svgRoot(viewBox: string, parent: Element): SVGSVGElement {
  const svg = el('svg', { viewBox, preserveAspectRatio: 'xMidYMid meet' }, parent);
  return svg;
}

/** 极简可复现伪随机（场景点位确定性布局用） */
export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
