/*
 * ⚠️ gemini.google.com 改版時可能需要修改的檔案。
 *
 * 自動重設送出前，把專用對話的模型切到設定的模型與思考程度（預設 4 Hydrogen／低），
 * 避免用較高算力消耗的 4 Neon / 4 Carbon 送一則只是用來開始工作階段的短訊息。
 *
 * 2026-11 實機介面（Gemini 4）：
 *  - 輸入框右側膠囊按鈕顯示目前模型（例如「Hydrogen ^」、「Neon ^」、「自動 ^」）
 *  - 主選單項目：
 *      1. 自動（根據需求調整回覆）
 *      2. 全天候貼心協助（4 Hydrogen）
 *      3. 深入分析（4 Neon）
 *      4. 程式編寫與複雜任務（4 Carbon，未解鎖方案帶有鎖頭圖示，不可誤點以免跳出升級視窗）
 *      5. 底部「思考程度 ▸」子選單：低（快速高效）／中等（適中）／高（詳盡）
 *  - 只操作頁面上的模型選單，不修改任何網路請求；任何一步失敗都只回報原因並照常送出。
 */
(function (root) {
  const GQ = (root.GQ = root.GQ || {});
  const log = GQ.logger.createLogger('model');

  const MODELS = {
    auto: { name: '自動', itemRe: /^\s*(自動(?:\s|$)|Auto\b)/i, labelRe: /\bauto\b|自動/i },
    hydrogen: { name: '4 Hydrogen', itemRe: /\bhydrogen\b/i, labelRe: /\bhydrogen\b/i },
    neon: { name: '4 Neon', itemRe: /\bneon\b/i, labelRe: /\bneon\b/i },
    carbon: { name: '4 Carbon', itemRe: /\bcarbon\b/i, labelRe: /\bcarbon\b/i }
  };
  const EFFORTS = ['low', 'medium', 'high'];
  const ANY_MODEL_RE = /\b(hydrogen|neon|carbon)\b|^\s*(自動(?:\s|$)|Auto\b)/i;
  const THINKING_TRIGGER_RE = /思考程度|thinking|effort/i;
  const STEP_TIMEOUT_MS = 3000;
  const SETTLE_MS = 800;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeout = STEP_TIMEOUT_MS) {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() >= end) return null;
      await sleep(100);
    }
  }

  /** 相容 Angular Material / CDK 與自訂 UI 的完整指標與點擊事件序列 */
  function press(el) {
    const r = el.getBoundingClientRect();
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      buttons: 1,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      view: window
    };
    const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    const P = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
    el.dispatchEvent(new P('pointerdown', ptr));
    el.dispatchEvent(new MouseEvent('mousedown', base));
    el.dispatchEvent(new P('pointerup', { ...ptr, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
  }

  /** Angular Material 子選單常由 hover（mouseenter / mouseover）觸發展開 */
  function hover(el) {
    const r = el.getBoundingClientRect();
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      view: window
    };
    const P = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
    el.dispatchEvent(new P('pointerover', { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    el.dispatchEvent(new P('pointerenter', { ...base, bubbles: false, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mouseover', base));
    el.dispatchEvent(new MouseEvent('mouseenter', { ...base, bubbles: false }));
  }

  const menus = () =>
    Array.from(document.querySelectorAll('[role="menu"], [role="listbox"], .mat-mdc-menu-panel'));
  const menuItems = (menu) =>
    Array.from(
      menu.querySelectorAll(
        '[role="menuitemradio"], [role="menuitem"], [role="option"], button.mat-mdc-menu-item'
      )
    );
  const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

  /**
   * 優先使用 selectors.modelSelector；若 Gemini 改掉外層標籤，
   * 備援在輸入區內尋找顯示 Hydrogen / Neon / Carbon / 自動 的選單按鈕（排除左側 + 上傳按鈕）。
   */
  function trigger() {
    const bySel = GQ.selectors.find('modelSelector');
    if (bySel) return bySel;
    const comp = GQ.selectors.getComposer();
    if (!comp) return null;
    const btns = Array.from(comp.querySelectorAll('button'));
    return (
      btns.find((b) => {
        const txt = `${b.getAttribute('aria-label') || ''} ${textOf(b)}`;
        if (/上傳|upload|add files|新增檔案|麥克風|microphone|傳送|send|stop|停止/i.test(txt)) return false;
        return /\b(hydrogen|neon|carbon|auto)\b|自動|模型|model/i.test(txt);
      }) || null
    );
  }

  function label() {
    const t = trigger();
    return t ? `${t.getAttribute('aria-label') || ''} ${textOf(t)}`.trim() : '';
  }

  function isCurrent(model) {
    const spec = MODELS[model];
    return spec ? spec.labelRe.test(label()) : false;
  }

  async function closeMenus() {
    for (let i = 0; i < 3 && menus().length; i++) {
      const target = document.activeElement || document.body;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(150);
    }
    if (menus().length && trigger()) press(trigger());
    await waitFor(() => !menus().length, 1000);
  }

  async function openMenu() {
    const t = trigger();
    if (!t) return null;
    if (!menus().length) press(t);
    return waitFor(() => menus()[0] || null);
  }

  /** 先嘗試 hover 展開子選單（Angular Material 預設），沒出現再補 click */
  async function openSubmenu(item) {
    const before = new Set(menus());
    hover(item);
    let m = await waitFor(() => menus().find((x) => !before.has(x)) || null, 500);
    if (!m) {
      press(item);
      m = await waitFor(() => menus().find((x) => !before.has(x)) || null);
    }
    return m;
  }

  /** 檢查項目是否停用或帶有未解鎖鎖頭（例如 Pro 方案下的 4 Carbon 🔒），避免誤點跳出升級視窗 */
  function isLockedOrDisabled(el) {
    if (el.disabled === true || el.getAttribute('aria-disabled') === 'true') return true;
    try {
      if (
        el.querySelector(
          'mat-icon[fonticon*="lock" i], [data-mat-icon-name*="lock" i], .lock-icon, [aria-label*="鎖" i], [aria-label*="lock" i], [aria-label*="upgrade" i], [aria-label*="升級"]'
        )
      ) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function submenuTriggers(menu) {
    const explicit = Array.from(menu.querySelectorAll('[aria-haspopup="menu"], [aria-haspopup="listbox"]'));
    if (explicit.length) return explicit;
    return menuItems(menu).filter((e) => THINKING_TRIGGER_RE.test(textOf(e)));
  }

  function findModelItem(menu, model) {
    const spec = MODELS[model];
    if (!spec) return null;
    const candidates = menuItems(menu).filter(
      (e) =>
        !e.hasAttribute('aria-haspopup') &&
        !THINKING_TRIGGER_RE.test(textOf(e)) &&
        spec.itemRe.test(`${e.getAttribute('aria-label') || ''} ${textOf(e)}`)
    );
    if (!candidates.length) return null;
    const unlocked = candidates.find((e) => !isLockedOrDisabled(e));
    return unlocked || 'locked';
  }

  async function selectModel(model) {
    const main = await openMenu();
    if (!main) return 'menu-not-opened';
    let item = findModelItem(main, model);
    if (!item) {
      for (const sub of submenuTriggers(main)) {
        const m = await openSubmenu(sub);
        if (!m) continue;
        if (menuItems(m).some((e) => ANY_MODEL_RE.test(textOf(e)))) {
          item = findModelItem(m, model);
          break;
        }
      }
    }
    if (item === 'locked') {
      await closeMenus();
      return 'model-locked';
    }
    if (!item) {
      await closeMenus();
      return 'model-not-found';
    }
    press(item);
    const ok = await waitFor(() => !menus().length && isCurrent(model));
    if (!ok) {
      await closeMenus();
      return isCurrent(model) ? null : 'model-not-applied';
    }
    return null;
  }

  async function selectEffort(effort) {
    const index = EFFORTS.indexOf(effort);
    const main = await openMenu();
    if (!main) return 'menu-not-opened';
    let options = null;
    const subs = submenuTriggers(main);
    // 優先找「思考程度 / Thinking」觸發項
    subs.sort((a, b) => Number(THINKING_TRIGGER_RE.test(textOf(b))) - Number(THINKING_TRIGGER_RE.test(textOf(a))));
    for (const sub of subs) {
      const m = await openSubmenu(sub);
      if (!m) continue;
      const r = menuItems(m).filter((e) => !e.hasAttribute('aria-haspopup'));
      if (r.length === EFFORTS.length && !r.some((e) => ANY_MODEL_RE.test(textOf(e)))) {
        options = r;
        break;
      }
    }
    if (!options) {
      await closeMenus();
      return 'effort-not-found';
    }
    const target = options[index];
    if (target.getAttribute('aria-checked') === 'true' || target.getAttribute('aria-selected') === 'true') {
      await closeMenus();
      return null;
    }
    if (isLockedOrDisabled(target)) {
      await closeMenus();
      return 'effort-unavailable';
    }
    press(target);
    await waitFor(() => !menus().length, STEP_TIMEOUT_MS);
    if (menus().length) await closeMenus();
    return null;
  }

  /**
   * 把模型與思考程度切到指定值。
   * @param {{model: 'none'|'auto'|'hydrogen'|'neon'|'carbon', effort: 'none'|'low'|'medium'|'high'}} want
   * @returns {Promise<{ok: boolean, changed: boolean, reason?: string}>}
   */
  async function ensure({ model = 'none', effort = 'none' } = {}) {
    const wantModel = MODELS[model] ? model : 'none';
    const wantEffort = EFFORTS.includes(effort) ? effort : 'none';
    if (wantModel === 'none' && wantEffort === 'none') return { ok: true, changed: false, reason: 'off' };
    if (!trigger()) {
      log.warn('model selector not found');
      return { ok: false, changed: false, reason: 'no-selector' };
    }
    let changed = false;
    try {
      if (wantModel !== 'none' && !isCurrent(wantModel)) {
        const err = await selectModel(wantModel);
        if (err) {
          log.warn('model switch failed', { reason: err, model: wantModel });
          return { ok: false, changed: false, reason: err };
        }
        changed = true;
      }
      if (wantEffort !== 'none') {
        const err = await selectEffort(wantEffort);
        if (err) {
          log.warn('effort switch failed', { reason: err, effort: wantEffort });
          return { ok: false, changed, reason: err };
        }
      }
      if (changed) {
        await sleep(SETTLE_MS);
        if (!(await waitFor(() => isCurrent(wantModel)))) {
          log.warn('model switch did not stick', { model: wantModel });
          return { ok: false, changed, reason: 'model-not-applied' };
        }
      }
    } catch (e) {
      log.warn('model switch error', { error: e.message });
      await closeMenus().catch(() => {});
      return { ok: false, changed, reason: 'error' };
    }
    log.info('model ready', { model: wantModel, effort: wantEffort, changed });
    return { ok: true, changed };
  }

  GQ.model = { ensure, label, MODELS, EFFORTS };
})(globalThis);
