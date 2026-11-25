/*
 * ⚠️ gemini.google.com 改版時最常需要修改的檔案之一。
 *
 * 用量偵測（自動讀取 https://gemini.google.com/usage ＋ 頁面上限橫幅雙重偵測）：
 *   1. 結構化用量擷取（/usage 頁面）：
 *      - 若目前分頁就是 /usage：等待 Angular 渲染出「目前用量 / 每週上限」與百分比後直接解析 DOM。
 *      - 若目前在 /app 等聊天頁：請 Service Worker 複用既有的 /usage 分頁、或在背景靜默開啟一個
 *        暫時的非作用中 /usage 分頁（不搶焦點），讀取完百分比與重設時間後立即自動關閉。
 *   2. 頁面上限橫幅備援（DOM 偵測）：
 *      - 掃描聊天頁上的 rate-limit-banner / role=alert 等提示區域，即時攔截上限提示。
 *   3. 擴充介面（setUsageProvider）：供測試或自訂資料來源注入。
 *
 * 只讀取頁面狀態；絕不偽造或重放任何聊天請求。
 */
(function (root) {
  const GQ = (root.GQ = root.GQ || {});
  const log = GQ.logger.createLogger('usage');
  const { TIMING } = GQ;

  const FIELD_ALIASES = {
    session: ['five_hour', 'fiveHour', 'session', 'five_hour_limit', 'rollingWindow'],
    weekly: ['seven_day', 'sevenDay', 'weekly', 'seven_day_limit', 'weeklyLimit'],
    utilization: ['utilization', 'percent', 'percentage', 'used_percent', 'pct'],
    resetsAt: ['resets_at', 'resetsAt', 'reset_at', 'resetAt']
  };

  const FULL_THRESHOLD = 100;
  const USAGE_RENDER_WAIT_MS = 10000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ───────────────────────── 自訂 Provider（測試或擴充用） ─────────────────────────

  let usageProvider = null;

  function setUsageProvider(fn) {
    usageProvider = typeof fn === 'function' ? fn : null;
  }

  function hasUsageProvider() {
    return typeof usageProvider === 'function';
  }

  async function fetchUsageApi() {
    if (!usageProvider) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMING.USAGE_FETCH_TIMEOUT_MS);
    try {
      const raw = await usageProvider({ signal: ctrl.signal });
      if (!raw) return null;
      return parseUsageResponse(raw);
    } finally {
      clearTimeout(timer);
    }
  }

  // ───────────────────────── 回應解析 ─────────────────────────

  function pick(obj, aliases) {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const k of aliases) if (obj[k] !== undefined) return obj[k];
    return undefined;
  }

  function parseTimestamp(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
    const ms = Date.parse(v);
    return isNaN(ms) ? null : ms;
  }

  function parseBucket(b) {
    if (!b || typeof b !== 'object') return null;
    const pct = Number(pick(b, FIELD_ALIASES.utilization));
    return {
      pct: isNaN(pct) ? null : Math.max(0, Math.min(100, pct)),
      resetsAt: parseTimestamp(pick(b, FIELD_ALIASES.resetsAt))
    };
  }

  /**
   * @returns {{ session: Bucket|null, weekly: Bucket|null, extras: Array<{key, pct, resetsAt}> }}
   */
  function parseUsageResponse(json) {
    if (!json || typeof json !== 'object') throw new Error('usage: unexpected response');
    const session = parseBucket(pick(json, FIELD_ALIASES.session));
    const weekly = parseBucket(pick(json, FIELD_ALIASES.weekly));
    if (!session && !weekly) {
      throw new Error('usage: no session/weekly fields (format may have changed)');
    }
    const extras = Array.isArray(json.extras) ? json.extras.slice() : [];
    for (const [key, val] of Object.entries(json)) {
      if (/^(seven_day_|model_limit_)/.test(key) && val && typeof val === 'object') {
        const b = parseBucket(val);
        if (b && b.pct != null) extras.push({ key, ...b });
      }
    }
    return { session, weekly, extras };
  }

  // ───────────────────────── /usage 頁面文字解析 ─────────────────────────
  //
  // 2026-11 實測 https://gemini.google.com/usage 結構：
  //   用量限制 PRO
  //   ...
  //   目前用量 ⓘ                                    已使用 4%
  //   重設時間：下午1:07
  //   每週上限                                       已使用 0%
  //   重設時間：12月1日下午1:07
  //   訂閱 AI Ultra 即享 5 倍用量 ...
  // 注意：第二張卡片在 DOM 內「重設時間」可能出現在「已使用 X%」之前，因此以區塊標題切分後各自擷取。

  function parseUsageCardSlice(slice, { isSession = false } = {}, now = Date.now()) {
    if (!slice) return null;
    const pm =
      slice.match(/已使用\s*(\d+(?:\.\d+)?)\s*%/i) ||
      slice.match(/(\d+(?:\.\d+)?)\s*%\s*(?:已使用|used)/i) ||
      slice.match(/\b(\d{1,3}(?:\.\d+)?)\s*%/);
    if (!pm) return null;
    const pct = Math.max(0, Math.min(100, Number(pm[1])));

    const rm =
      slice.match(/(?:重[設置]時間|重[設置]於|將於)\s*[:：]?\s*([\s\S]+?)(?=\s*(?:已使用|\d+(?:\.\d+)?\s*%|$))/i) ||
      slice.match(/\bresets?(?:\s+time|\s+at|\s+on)?\s*[:：]?\s*([\s\S]+?)(?=\s*(?:\d+(?:\.\d+)?\s*%\s*used|$))/i);

    let resetsAt = null;
    if (rm && rm[1]) {
      const clause = rm[1].replace(/\s+/g, ' ').trim();
      const parsed = parseResetTimeFromText(clause, now);
      if (!parsed.estimated && parsed.resetAt) {
        resetsAt = parsed.resetAt;
        // 5 小時「目前用量」若剛過期（例如 13:08 讀到「下午1:07」），parseResetTimeFromText 會預設加一天變明天；
        // 超過 12 小時代表其實是今天剛過的時間，扣回 24 小時讓狀態正確視為已歸零。
        if (isSession && resetsAt - now > 12 * 60 * 60 * 1000) {
          resetsAt -= 24 * 60 * 60 * 1000;
        }
      }
    }
    return { pct, resetsAt };
  }

  /**
   * 從 /usage 頁面的可見文字解析出 { session, weekly, extras }。
   * 尚未渲染完成（找不到區塊或百分比）時回傳 null。
   */
  function parseUsagePageText(rawText, now = Date.now()) {
    const s = String(rawText || '').replace(/\u00a0/g, ' ');
    if (!s.trim()) return null;

    const sm = s.match(/目前用量|当前用量|\bcurrent\s+usage\b/i);
    const wm = s.match(/每週上限|每周上限|\bweekly\s+limit\b/i);
    if (!sm && !wm) return null;

    const anchorEnd = Math.max(sm ? sm.index : 0, wm ? wm.index : 0);
    const tail = s.slice(anchorEnd);
    const fm = tail.match(
      /訂閱\s*AI|订阅\s*AI|用量設定|用量设置|額外用量|额外用量|\b(?:subscribe|upgrade)\s+to\b|\busage\s+settings\b|\bextra\s+usage\b/i
    );
    const endIdx = fm ? anchorEnd + fm.index : s.length;

    let session = null;
    let weekly = null;
    if (sm) {
      const stop = wm && wm.index > sm.index ? wm.index : endIdx;
      session = parseUsageCardSlice(s.slice(sm.index, stop), { isSession: true }, now);
    }
    if (wm) {
      const stop = sm && sm.index > wm.index ? sm.index : endIdx;
      weekly = parseUsageCardSlice(s.slice(wm.index, stop), { isSession: false }, now);
    }
    if (!session && !weekly) return null;
    return { session, weekly, extras: [] };
  }

  function extractUsageDomText() {
    if (!document.body) return '';
    // 注意：不能移除 side-navigation-v2（它是包住整個主畫面的外層容器），只移除側邊導覽抽屜本身
    const clone = document.body.cloneNode(true);
    clone
      .querySelectorAll('bard-sidenav, mat-sidenav, [role="navigation"], script, style, noscript')
      .forEach((e) => e.remove());
    return clone.innerText || clone.textContent || '';
  }

  /** 在 /usage 頁面等待前端渲染出百分比後解析回傳 */
  async function readUsagePageDom(timeoutMs = USAGE_RENDER_WAIT_MS) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const parsed = parseUsagePageText(extractUsageDomText(), Date.now());
      if (parsed) return parsed;
      await sleep(250);
    }
    const lastTry = parseUsagePageText(extractUsageDomText(), Date.now());
    if (lastTry) return lastTry;
    throw new Error('usage-page-timeout');
  }

  // ───────────────────────── DOM 上限橫幅偵測 ─────────────────────────

  const LIMIT_PATTERNS = [
    /\b(usage|message|weekly|daily|session|5-hour|compute|prompt)\s+limit\b/i,
    /\bout of (free )?(messages|prompts|uploads)\b/i,
    /\b(you['’]?ve\s+)?(temporarily\s+)?reached (your|the)\b.{0,45}\blimit\b/i,
    /\blimit\s+on\s+gemini\b/i,
    /\blimit (reached|resets?|refreshes?)\b/i,
    /\bquota\s+(exceeded|reached)\b/i,
    /(已達|達到|到達).{0,18}(上限|限制|限額|額度)/,
    /(用量|額度|訊息|對話|次數|算力).{0,8}(上限|已滿|用完|用盡|達上限)/,
    /暫時達到.{0,15}(上限|限制)/
  ];

  function isLimitText(text) {
    return LIMIT_PATTERNS.some((re) => re.test(text));
  }

  /**
   * 只檢查 selectors.limitBanner 指定的區域、且文字很短的元素，
   * 並排除輸入框與訊息氣泡，避免讀取聊天內容。
   */
  function detectLimitFromDom(now = Date.now()) {
    const editor = GQ.selectors.find('editor');
    const userMsgSel = GQ.selectors.SELECTORS.userMessage.join(',');
    const candidates = GQ.selectors.SELECTORS.limitBanner.flatMap((sel) => {
      try {
        return Array.from(document.querySelectorAll(sel));
      } catch (_) {
        return [];
      }
    });
    for (const el of candidates) {
      if (editor && (el.contains(editor) || editor.contains(el))) continue;
      try {
        if (el.closest(userMsgSel)) continue;
      } catch (_) {}
      const text = (el.innerText || el.textContent || '').trim();
      if (!text || text.length > 400) continue;
      if (isLimitText(text)) {
        const parsed = parseResetTimeFromText(text, now);
        return { limited: true, ...parsed };
      }
    }
    return { limited: false };
  }

  const WEEKDAYS_EN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];
  const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  /**
   * 從提示文字解析重置時間。支援：
   *   "resets at 3:00 PM" / "until 5:17 PM" / "resets Monday 9:00 AM" / "in 2 hours"
   *   "tomorrow at 3:00 PM" / "until Nov 25, 5:17 PM"
   *   "下午1:07" / "12月1日下午1:07" / "明天下午 3:00" / "週一 上午 9:00" / "2 小時後" / "15:30"
   * 解析失敗時回傳「5 小時後」並標記 estimated=true。
   */
  function parseResetTimeFromText(text, now = Date.now()) {
    const s = String(text);

    // 相對時間
    let m = s.match(/\bin\s+(\d+)\s*(hours?|hrs?|h)\b(?:\s*(?:and\s*)?(\d+)\s*(minutes?|mins?|m)\b)?/i);
    if (m) return { resetAt: now + (+m[1] * 60 + (+m[3] || 0)) * 60000, estimated: false };
    m = s.match(/\bin\s+(\d+)\s*(minutes?|mins?)\b/i);
    if (m) return { resetAt: now + +m[1] * 60000, estimated: false };
    m = s.match(/(\d+)\s*小時(?:\s*(\d+)\s*分(?:鐘)?)?\s*後/);
    if (m) return { resetAt: now + (+m[1] * 60 + (+m[2] || 0)) * 60000, estimated: false };
    m = s.match(/(\d+)\s*分(?:鐘)?\s*後/);
    if (m) return { resetAt: now + +m[1] * 60000, estimated: false };

    // 明確月日（例如 "Nov 25" / "12月1日"）與「明天 / tomorrow」
    let explicitMonth = null;
    let explicitDay = null;
    const mdEn = s.match(
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
    );
    if (mdEn) {
      explicitMonth = MONTHS_EN.indexOf(mdEn[1].toLowerCase());
      explicitDay = +mdEn[2];
    }
    const mdZh = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日號]/);
    if (mdZh) {
      explicitMonth = +mdZh[1] - 1;
      explicitDay = +mdZh[2];
    }
    const isTomorrow = /\btomorrow\b|明天|明日/i.test(s);

    // 星期
    let weekday = null;
    const wdEn = s.match(
      /\b(sun|mon|tue|wed|thu|fri|sat)(?:day|s|nesday|sday|urday|rsday|r|rs)?\b\.?/i
    );
    if (wdEn) weekday = WEEKDAYS_EN.indexOf(wdEn[1].toLowerCase());
    const wdZh = s.match(/(?:週|周|星期|禮拜)([日天一二三四五六])/);
    if (wdZh) weekday = WEEKDAYS_ZH.indexOf(wdZh[1] === '天' ? '日' : wdZh[1]);

    // 時刻
    let hour = null;
    let minute = 0;
    m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
    if (m) {
      hour = +m[1] % 12;
      minute = +(m[2] || 0);
      if (/^p/i.test(m[3])) hour += 12;
    } else {
      m = s.match(/(上午|早上|凌晨|中午|下午|傍晚|晚上)?\s*(\d{1,2})\s*[:：點点時]\s*(\d{1,2})?/);
      if (m) {
        hour = +m[2];
        minute = +(m[3] || 0);
        const period = m[1];
        if (period && /下午|傍晚|晚上/.test(period) && hour < 12) hour += 12;
        if (period && /中午/.test(period) && hour < 11) hour += 12;
        if (period && /上午|早上|凌晨/.test(period) && hour === 12) hour = 0;
      } else {
        m = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
        if (m) {
          hour = +m[1];
          minute = +m[2];
        }
      }
    }

    if (hour == null || hour > 23 || minute > 59) {
      return { resetAt: now + TIMING.FALLBACK_RESET_MS, estimated: true };
    }

    const d = new Date(now);
    d.setSeconds(0, 0);
    d.setHours(hour, minute);
    if (explicitMonth != null && explicitDay != null && explicitMonth >= 0 && explicitMonth <= 11) {
      d.setMonth(explicitMonth, explicitDay);
      if (d.getTime() <= now) d.setFullYear(d.getFullYear() + 1);
    } else if (isTomorrow) {
      d.setDate(d.getDate() + 1);
    } else if (weekday != null && weekday >= 0) {
      let diff = (weekday - d.getDay() + 7) % 7;
      if (diff === 0 && d.getTime() <= now) diff = 7;
      d.setDate(d.getDate() + diff);
    } else if (d.getTime() <= now) {
      d.setDate(d.getDate() + 1);
    }
    return { resetAt: d.getTime(), estimated: false };
  }

  // ───────────────────────── Debug 模擬 ─────────────────────────

  function simulatedStatus(now = Date.now()) {
    const st = GQ.settings.get();
    if (!st.debugSimulate) return null;
    const full = now < st.debugSimulateUntil;
    return {
      source: 'simulated',
      full,
      fullReasons: full ? ['simulated'] : [],
      session: { pct: full ? 100 : 0, resetsAt: st.debugSimulateUntil || null },
      weekly: { pct: full ? 40 : 0, resetsAt: null },
      extras: [],
      resetAt: full ? st.debugSimulateUntil : null,
      estimated: false,
      fetchedAt: now,
      error: null
    };
  }

  // ───────────────────────── 組合 ─────────────────────────

  function buildSnapshot(api, dom, error, now = Date.now()) {
    const reasons = [];
    const resetCandidates = [];
    let estimated = false;

    if (api) {
      for (const key of ['session', 'weekly']) {
        const b = api[key];
        const expired = b && b.resetsAt && b.resetsAt <= now;
        if (b && b.pct != null && b.pct >= FULL_THRESHOLD && !expired) {
          reasons.push(key);
          if (b.resetsAt) resetCandidates.push(b.resetsAt);
        }
      }
    }
    if (dom && dom.limited) {
      reasons.push('dom');
      resetCandidates.push(dom.resetAt);
      if (dom.estimated && resetCandidates.length === 1) estimated = true;
    }

    const full = reasons.length ? true : api ? false : null;
    let resetAt = null;
    if (full) {
      resetAt = resetCandidates.length ? Math.max(...resetCandidates) : null;
      if (!resetAt) {
        resetAt = now + TIMING.FALLBACK_RESET_MS;
        estimated = true;
      }
    }

    let source;
    if (api) source = dom && dom.limited ? 'api+dom' : 'api';
    else if (dom && dom.limited) source = 'dom';
    else if (!error) source = 'dom';
    else source = 'none';

    return {
      source,
      full,
      fullReasons: reasons,
      session: api ? api.session : null,
      weekly: api ? api.weekly : null,
      extras: api ? api.extras : [],
      resetAt,
      estimated,
      fetchedAt: now,
      error: error || null
    };
  }

  async function getStatus() {
    const sim = simulatedStatus(Date.now());
    if (sim) return sim;

    const href = typeof location !== 'undefined' ? location.href : '';
    const onUsagePage = !!(GQ.text && GQ.text.isUsageUrl && GQ.text.isUsageUrl(href));

    let api = null;
    let error = null;

    if (onUsagePage) {
      try {
        api = await readUsagePageDom();
      } catch (e) {
        error = e.message || 'usage-page-error';
        log.warn('failed to read /usage DOM', { error });
      }
      const snap = buildSnapshot(api, { limited: false }, error, Date.now());
      log.debug('usage page status', {
        source: snap.source,
        session: snap.session && snap.session.pct,
        weekly: snap.weekly && snap.weekly.pct
      });
      return snap;
    }

    if (hasUsageProvider()) {
      try {
        api = await fetchUsageApi();
      } catch (e) {
        error = e.name === 'AbortError' ? 'timeout' : e.message;
        log.warn('usage provider failed, falling back to DOM detection', { error });
      }
    } else if (GQ.bg && GQ.MSG && GQ.MSG.USAGE_FETCH_PAGE) {
      try {
        const res = await GQ.bg.send(GQ.MSG.USAGE_FETCH_PAGE, { url: href });
        if (res && res.ok && res.api) {
          api = res.api;
        } else if (res && res.error) {
          error = res.error;
          log.warn('background /usage fetch failed, falling back to DOM detection', { error });
        }
      } catch (e) {
        error = e.message;
        log.warn('USAGE_FETCH_PAGE failed', { error });
      }
    }

    const now = Date.now();
    const dom = detectLimitFromDom(now);
    const snap = buildSnapshot(api, dom, error, now);
    log.debug('usage status', {
      source: snap.source,
      full: snap.full,
      reasons: snap.fullReasons,
      session: snap.session && snap.session.pct,
      weekly: snap.weekly && snap.weekly.pct,
      resetAt: snap.resetAt,
      estimated: snap.estimated
    });
    return snap;
  }

  GQ.usage = {
    setUsageProvider,
    hasUsageProvider,
    getStatus,
    fetchUsageApi,
    parseUsageResponse,
    parseUsagePageText,
    readUsagePageDom,
    detectLimitFromDom,
    parseResetTimeFromText,
    simulatedStatus,
    buildSnapshot,
    isLimitText
  };
})(globalThis);
