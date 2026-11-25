/*
 * 頁面內 UI：提示（toast）與浮動確認列（bar）。
 * 放在 Shadow DOM 裡，樣式不會與 gemini.google.com 互相影響。
 */
(function (root) {
  const GQ = (root.GQ = root.GQ || {});

  const STYLE = `
    :host { all: initial; }
    .wrap { position: fixed; z-index: 2147483646; left: 50%; transform: translateX(-50%);
      bottom: 140px; display: flex; flex-direction: column; gap: 8px; align-items: center;
      font: 14px/1.45 system-ui, -apple-system, "PingFang TC", "Noto Sans TC", sans-serif;
      pointer-events: none; max-width: min(640px, calc(100vw - 32px)); }
    .toast, .bar { pointer-events: auto; box-shadow: 0 6px 24px rgba(0,0,0,.18);
      border-radius: 12px; padding: 10px 14px; color: #1f1f1f; background: #f8f9fc;
      border: 1px solid #d3dbe8; }
    .toast { animation: in .18s ease-out; }
    .toast.warn { border-color: #e7b45a; background: #fff7e6; }
    .toast.error { border-color: #d9534f; background: #fdecea; }
    .toast.success { border-color: #6aa86a; background: #edf7ed; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; border-color: #1a73e8; }
    .bar .msg { flex: 1 1 260px; }
    .bar .sub { display: block; font-size: 12px; color: #5f6368; margin-top: 2px; }
    .bar .btns { display: flex; gap: 6px; flex-wrap: wrap; }
    button { font: inherit; font-size: 13px; padding: 5px 12px; border-radius: 8px; cursor: pointer;
      border: 1px solid #c4c7c5; background: #fff; color: #1f1f1f; }
    button:hover { filter: brightness(.96); }
    button.primary { background: #1a73e8; border-color: #1557b0; color: #fff; }
    button.danger { color: #b3261e; }
    .tag { font-size: 11px; font-weight: 600; color: #1a73e8; margin-right: 6px; }
    @media (prefers-color-scheme: dark) {
      .toast, .bar { background: #1e1f20; color: #e3e3e3; border-color: #444746; }
      .toast.warn { background: #3a3020; } .toast.error { background: #3d2322; }
      .toast.success { background: #1f3322; }
      .bar { border-color: #8ab4f8; }
      .bar .sub { color: #9aa0a6; }
      .tag { color: #8ab4f8; }
      button { background: #2d2e30; color: #e3e3e3; border-color: #5f6368; }
      button.primary { background: #8ab4f8; border-color: #8ab4f8; color: #062e6f; font-weight: 600; }
      button.danger { color: #f28b82; }
    }
    @keyframes in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  `;

  let host = null;
  let wrap = null;
  let barEl = null;
  let barResolve = null;

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('gemini-queue-ui');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    shadow.append(style, wrap);
    document.documentElement.appendChild(host);
  }

  /**
   * @param {string} message
   * @param {{kind?: 'info'|'warn'|'error'|'success', duration?: number}} opts
   */
  function toast(message, opts = {}) {
    ensureHost();
    const el = document.createElement('div');
    el.className = `toast ${opts.kind || 'info'}`;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'Gemini Queue';
    el.append(tag, document.createTextNode(message));
    wrap.appendChild(el);
    const duration = opts.duration ?? (opts.kind === 'error' ? 10000 : 6000);
    if (duration > 0) setTimeout(() => el.remove(), duration);
    return el;
  }

  /**
   * 顯示浮動確認列，回傳使用者點選的按鈕 id。
   * 同時只會有一個 bar；開新的會讓舊的以 'dismissed' 結束。
   * @param {{message: string, sub?: string, buttons: Array<{id, label, kind?: 'primary'|'danger'}>}} opts
   * @returns {Promise<string>}
   */
  function showBar(opts) {
    ensureHost();
    hideBar('dismissed');
    barEl = document.createElement('div');
    barEl.className = 'bar';
    const msg = document.createElement('div');
    msg.className = 'msg';
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'Gemini Queue';
    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = opts.message;
    msg.append(tag, text);
    if (opts.sub) {
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = opts.sub;
      msg.appendChild(sub);
    }
    const btns = document.createElement('div');
    btns.className = 'btns';
    for (const b of opts.buttons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b.label;
      btn.dataset.id = b.id;
      if (b.kind) btn.className = b.kind;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.keepOpen) {
          b.onClick && b.onClick(e);
          return;
        }
        hideBar(b.id);
      });
      btns.appendChild(btn);
    }
    barEl.append(msg, btns);
    wrap.appendChild(barEl);
    const primary = btns.querySelector('button.primary');
    if (primary) primary.focus({ preventScroll: true });
    return new Promise((resolve) => {
      barResolve = resolve;
    });
  }

  function updateBar(message) {
    if (!barEl) return;
    const text = barEl.querySelector('.text');
    if (text) text.textContent = message;
  }

  function hideBar(result = 'dismissed') {
    if (barEl) barEl.remove();
    barEl = null;
    if (barResolve) {
      const r = barResolve;
      barResolve = null;
      r(result);
    }
  }

  function isBarOpen() {
    return !!barEl;
  }

  GQ.ui = { toast, showBar, updateBar, hideBar, isBarOpen };
})(globalThis);
