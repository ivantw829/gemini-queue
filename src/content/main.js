/*
 * Content script 進入點：用量狀態與輪詢、佇列快取、SPA 換頁偵測、與 SW 的訊息。
 */
(function (root) {
  const GQ = (root.GQ = root.GQ || {});
  const log = GQ.logger.createLogger('main');
  const { MSG, STORAGE_KEYS } = GQ;
  const t = GQ.t;

  if (GQ.__mainLoaded) return; // 防止重複注入
  GQ.__mainLoaded = true;

  let snapshot = null;
  let inflight = null;

  function withTimeout(promise, ms) {
    if (!ms) return promise;
    return Promise.race([promise, new Promise((r) => setTimeout(() => r(null), ms))]);
  }

  GQ.usageState = {
    current: () => snapshot,
    /** 重新查詢用量；超過 timeout 回傳 null（查詢仍會在背景完成並更新快照） */
    refresh({ timeout } = {}) {
      if (!inflight) {
        inflight = GQ.usage
          .getStatus()
          .then((snap) => {
            snapshot = snap;
            return GQ.bg
              .send(MSG.USAGE_SNAPSHOT, { snapshot: snap })
              .catch(() => {})
              .then(() => snap);
          })
          .catch((e) => {
            log.error('usage refresh failed', e);
            return null;
          })
          .finally(() => {
            inflight = null;
          });
      }
      return withTimeout(inflight, timeout);
    }
  };

  function snapshotAge() {
    return snapshot && snapshot.fetchedAt ? Date.now() - snapshot.fetchedAt : Infinity;
  }

  let staleRefreshAt = 0;

  function pollTick() {
    // 若這是 /usage 頁面且在背景，由聊天分頁或 SW 主動要求時再重整即可，避免自己重複觸發
    if (GQ.text.isUsageUrl(location.href) && document.hidden) return;
    const now = Date.now();
    const interval = GQ.settings.get().pollMinutes * 60 * 1000;
    const threshold = document.hidden ? interval + 30000 : interval - 5000;
    const stale =
      GQ.session.staleAfterReset(snapshot, now - (document.hidden ? 30000 : 0)) && now - staleRefreshAt > 60000;
    if (stale) staleRefreshAt = now;
    if (stale || snapshotAge() >= threshold) GQ.usageState.refresh();
  }

  // ───────────── 佇列快取（供手動送出比對） ─────────────

  let queue = [];
  GQ.queueCache = { get: () => queue };

  let chatInstalled = false;
  function ensureChatHooks() {
    if (chatInstalled || GQ.text.isUsageUrl(location.href)) return;
    chatInstalled = true;
    GQ.attachments.install();
    GQ.interceptor.install();
    document.addEventListener(
      'focusin',
      (e) => {
        if (GQ.selectors.closestEditor(e.target) && snapshotAge() > 30000) GQ.usageState.refresh();
      },
      true
    );
  }

  // ───────────── 初始化 ─────────────

  async function init() {
    await GQ.settings.ready;
    const data = await chrome.storage.local.get([STORAGE_KEYS.USAGE, STORAGE_KEYS.QUEUE]);
    snapshot = data[STORAGE_KEYS.USAGE] || null;
    queue = data[STORAGE_KEYS.QUEUE] || [];

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[STORAGE_KEYS.USAGE]) snapshot = changes[STORAGE_KEYS.USAGE].newValue || null;
      if (changes[STORAGE_KEYS.QUEUE]) {
        queue = changes[STORAGE_KEYS.QUEUE].newValue || [];
        const cur = GQ.restore.getCurrentId();
        if (cur && !queue.some((it) => it.id === cur)) GQ.ui.hideBar('gone');
      }
    });

    GQ.selectors.onMissing((name) => {
      GQ.ui.toast(t('toastSelectorMissing', { name }), { kind: 'error', duration: 15000 });
    });

    if (GQ.text.isUsageUrl(location.href)) {
      // 在 /usage 頁面（無論是你自己開的、還是 SW 背景開來擷取的），載入後立刻讀一次 DOM 回報
      GQ.usageState.refresh();
    } else {
      ensureChatHooks();
      pollTick();
      for (const delay of GQ.TIMING.RESTORE_CHECK_DELAYS_MS) setTimeout(() => GQ.restore.check(), delay);
    }

    setInterval(pollTick, 15000);

    // SPA 換頁偵測
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        log.debug('url changed', { to: GQ.text.urlShape(location.href) });
        if (GQ.text.isUsageUrl(location.href)) {
          GQ.usageState.refresh();
        } else {
          ensureChatHooks();
          GQ.interceptor.onNavigate();
          GQ.attachments.reset();
          GQ.restore.onNavigate();
          GQ.restore.check();
        }
      }
    }, 500);

    GQ.settings.onChange(() => {
      if (!GQ.text.isUsageUrl(location.href)) GQ.usageState.refresh();
    });

    log.info('content script ready', { usagePage: GQ.text.isUsageUrl(location.href) });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return false;
    if (msg.type === MSG.USAGE_REFRESH) {
      GQ.usageState.refresh({ timeout: 12000 }).then((snap) => sendResponse({ snapshot: snap }));
      return true;
    }
    if (msg.type === MSG.RESTORE_START) {
      if (GQ.text.isUsageUrl(location.href)) {
        sendResponse({ ok: false, busy: true });
        return false;
      }
      const accepted = GQ.restore.start(msg.item, msg.mode, msg.attempt || {});
      sendResponse({ ok: accepted, busy: !accepted });
      return false;
    }
    return false;
  });

  init().catch((e) => log.error('init failed', e));
})(globalThis);
