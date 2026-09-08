/**
 * browser.ts — 内容物浏览器
 * 数据构建期自动生成（generate-content.mjs）。过滤 / 搜索 / 全文预览模态。
 */
import { marked } from 'marked';
import { gsap, prefersReduced } from './motion';
import { data, TYPE_LABEL, type ContentItem, type ItemType } from './data';

const grid = () => document.getElementById('browser-grid')!;
const emptyEl = () => document.getElementById('browser-empty')!;
const searchInput = () => document.getElementById('browser-search') as HTMLInputElement;

let activeFilter: ItemType | 'all' = 'all';
let query = '';

export function initBrowser() {
  /* ---------- 元信息 ---------- */
  const meta = document.getElementById('contents-meta');
  if (meta) meta.textContent = String(data.items.length);

  /* ---------- tab 计数 ---------- */
  document.querySelectorAll<HTMLElement>('[data-n]').forEach((el) => {
    const key = el.dataset.n!;
    el.textContent = key === 'all' ? String(data.items.length) : String(data.counts[key] ?? 0);
  });

  /* ---------- targets ---------- */
  const targetsRow = document.getElementById('targets-row');
  if (targetsRow) {
    for (const t of data.targets) {
      const chip = document.createElement('span');
      chip.className = 'target-chip';
      chip.textContent = t;
      targetsRow.appendChild(chip);
    }
  }

  /* ---------- tab 事件 ---------- */
  document.querySelectorAll<HTMLButtonElement>('.btab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = (btn.dataset.filter as ItemType | 'all') || 'all';
      document.querySelectorAll('.btab').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      render();
    });
  });

  /* ---------- 搜索 ---------- */
  let timer = 0;
  searchInput().addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      query = searchInput().value.trim().toLowerCase();
      render();
    }, 90);
  });

  // “/” 聚焦搜索（模态打开时不抢焦点）
  document.addEventListener('keydown', (e) => {
    if (
      e.key === '/' &&
      modal()?.hidden &&
      document.activeElement?.tagName !== 'INPUT' &&
      document.activeElement?.tagName !== 'TEXTAREA'
    ) {
      e.preventDefault();
      searchInput().focus();
    }
  });

  render();
  initModal();
}

/* ---------- 过滤 + 渲染 ---------- */

function matches(item: ContentItem): boolean {
  if (activeFilter !== 'all' && item.type !== activeFilter) return false;
  if (!query) return true;
  return (
    item.name.toLowerCase().includes(query) ||
    item.description.toLowerCase().includes(query) ||
    item.content.toLowerCase().includes(query)
  );
}

function render() {
  const g = grid();
  const items = data.items.filter(matches);
  g.innerHTML = '';
  emptyEl().hidden = items.length > 0;

  // 小 live region 播报结果数（代替整网格 aria-live）
  const live = document.getElementById('results-live');
  if (live) live.textContent = `${items.length} 条结果`;

  const frag = document.createDocumentFragment();
  for (const item of items) {
    frag.appendChild(card(item));
  }
  g.appendChild(frag);

  if (!prefersReduced() && items.length) {
    gsap.fromTo(g.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.018, ease: 'power2.out', clearProps: 'opacity,transform' });
  }
}

function card(item: ContentItem): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'item-card' + (item.core ? ' is-core' : '');
  btn.setAttribute('aria-label', `预览 ${item.name}`);

  const top = document.createElement('div');
  top.className = 'item-top';
  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = item.name;
  top.appendChild(name);
  if (item.core) {
    const badge = document.createElement('span');
    badge.className = 'item-core-badge';
    badge.textContent = `CORE ${item.core}`;
    top.appendChild(badge);
  }
  btn.appendChild(top);

  const desc = document.createElement('p');
  desc.className = 'item-desc';
  desc.textContent = item.description;
  btn.appendChild(desc);

  const meta = document.createElement('div');
  meta.className = 'item-meta';
  const type = document.createElement('span');
  type.className = `item-type type-${item.type}`;
  type.textContent = TYPE_LABEL[item.type];
  meta.appendChild(type);
  if (item.activation) {
    const act = document.createElement('span');
    act.className = 'item-lines';
    act.textContent = item.activation;
    meta.appendChild(act);
  }
  const lines = document.createElement('span');
  lines.className = 'item-lines';
  lines.textContent = `${item.lines} 行`;
  meta.appendChild(lines);
  btn.appendChild(meta);

  btn.addEventListener('click', () => openModal(item));
  return btn;
}

/* ---------- 模态 ---------- */

const modal = () => document.getElementById('modal')!;
let lastFocus: Element | null = null;

function initModal() {
  modal().querySelectorAll('[data-modal-close]').forEach((el) =>
    el.addEventListener('click', closeModal)
  );
  document.addEventListener('keydown', (e) => {
    const m = modal();
    if (m.hidden) return;
    if (e.key === 'Escape') {
      closeModal();
    } else if (e.key === 'Tab') {
      // focus trap：Tab 循环停留在模态内
      const focusables = [
        ...m.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ].filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !m.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

function openModal(item: ContentItem) {
  const m = modal();
  lastFocus = document.activeElement;

  const title = document.getElementById('modal-title')!;
  const metaEl = document.getElementById('modal-meta')!;
  const body = document.getElementById('modal-body')!;
  const gh = document.getElementById('modal-gh') as HTMLAnchorElement;

  title.textContent = item.name;
  const metaParts = [TYPE_LABEL[item.type], item.path, `${item.lines} 行`];
  if (item.activation) metaParts.splice(1, 0, item.activation);
  if (item.mode) metaParts.splice(1, 0, item.mode);
  if (item.events?.length) metaParts.splice(1, 0, item.events.join(' / '));
  metaEl.textContent = metaParts.join(' · ');
  gh.href = item.url;

  body.innerHTML = marked.parse(item.content, { async: false }) as string;
  body.scrollTop = 0;

  m.hidden = false;
  document.body.style.overflow = 'hidden';
  const closeBtn = m.querySelector<HTMLButtonElement>('.modal-close');
  closeBtn?.focus();
}

function closeModal() {
  const m = modal();
  m.hidden = true;
  document.body.style.overflow = '';
  if (lastFocus instanceof HTMLElement) lastFocus.focus();
}
