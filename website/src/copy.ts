/**
 * copy.ts — 一键复制 + toast
 */
const toast = () => document.getElementById('toast')!;
let toastTimer = 0;
const chipTimers = new WeakMap<Element, number>();

export function initCopy() {
  document.addEventListener('click', (e) => {
    const target = (e.target as Element).closest?.('[data-copy]');
    if (!target) return;
    const text = target.getAttribute('data-copy') || '';
    copyText(text).then((ok) => {
      if (ok) {
        showToast('已复制到剪贴板', true);
        target.classList.add('is-copied');
        // 连点防竞态：清掉该元素旧 timer 再挂新的
        window.clearTimeout(chipTimers.get(target));
        chipTimers.set(target, window.setTimeout(() => target.classList.remove('is-copied'), 1600));
      } else {
        showToast('复制失败，请手动复制', false);
      }
    });
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 回退：execCommand
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function showToast(msg: string, ok: boolean) {
  const t = toast();
  t.textContent = msg;
  t.classList.toggle('is-ok', ok);
  t.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('is-visible'), 1800);
}
