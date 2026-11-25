/*
 * 文字與網址工具（適用 gemini.google.com，支援 /app、多帳號 /u/<n> 與 /gem 路由）。
 */
(function (root) {
  const GQ = (root.GQ = root.GQ || {});
  const GEMINI_ORIGIN = 'https://gemini.google.com';

  // 用於比對「是不是同一段文字」：統一換行、去除多餘空白
  function normalizeForCompare(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .join('\n')
      .trim();
  }

  function sameText(a, b) {
    return normalizeForCompare(a) === normalizeForCompare(b);
  }

  // 只比對開頭（訊息渲染後可能被截斷或加上格式）
  function textStartsMatch(rendered, original, len = 200) {
    const r = normalizeForCompare(rendered).replace(/\s+/g, ' ');
    const o = normalizeForCompare(original).replace(/\s+/g, ' ');
    if (!r || !o) return false;
    const n = Math.min(len, o.length);
    return r.slice(0, n) === o.slice(0, n);
  }

  // 去除常見 Markdown 標記（訊息氣泡會把它們渲染掉）並移除所有空白，只留內容字元
  function stripMarkdown(text) {
    return normalizeForCompare(text)
      .replace(/```[^\n]*\n?/g, '')
      .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
      .replace(/[*_~`]/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\s+/g, '');
  }

  /** 渲染後的訊息氣泡是否就是這段原文（先比原文開頭，再比去除格式後的開頭） */
  function renderedMatches(rendered, original, len = 200) {
    if (textStartsMatch(rendered, original, len)) return true;
    const r = stripMarkdown(rendered);
    const o = stripMarkdown(original);
    if (!r || !o) return false;
    const n = Math.min(len, o.length);
    return r.slice(0, n) === o.slice(0, n);
  }

  /** 移除 Google 多帳號路徑前綴 /u/<index>，供路由型別判斷（不影響實際對話 key） */
  function stripAccountPrefix(pathname) {
    return String(pathname || '/').replace(/^\/u\/\d+(?=\/|$)/, '') || '/';
  }

  // 對話識別：保留 /u/<index> 以區隔不同 Google 帳號，忽略 query 與 hash。
  function conversationKey(url) {
    try {
      const u = new URL(url, GEMINI_ORIGIN);
      return u.origin + u.pathname.replace(/\/+$/, '');
    } catch (_) {
      return String(url || '');
    }
  }

  /**
   * 給 debug log 用的網址類型：只留路徑結構，ID 換成 :id
   * （例如 /app、/app/:id、/u/0/app/:id、/gem/:id、/gem/:id/:id）。
   * 不含 query、hash 與對話／Gem ID。
   */
  function urlShape(url) {
    try {
      const u = new URL(url, GEMINI_ORIGIN);
      const raw = u.pathname.split('/').filter(Boolean);
      const parts = raw.map((s, i) => {
        const prev = raw[i - 1];
        const prev2 = raw[i - 2];
        if (prev === 'app' || prev === 'gem' || prev2 === 'gem') return ':id';
        if ((s.length >= 8 && /\d/.test(s)) || s.length > 24) return ':id';
        return s;
      });
      return (u.origin === GEMINI_ORIGIN ? '' : 'other:') + '/' + parts.join('/');
    } catch (_) {
      return 'invalid';
    }
  }

  function isNewChatUrl(url) {
    try {
      const p = stripAccountPrefix(new URL(url, GEMINI_ORIGIN).pathname);
      return p === '/' || p === '/app' || p === '/app/' || /^\/gem\/[^/]+\/?$/.test(p);
    } catch (_) {
      return false;
    }
  }

  /** 是否為 Gemini 用量限制頁面（/usage 或 /u/<n>/usage） */
  function isUsageUrl(url) {
    try {
      const p = stripAccountPrefix(new URL(url, GEMINI_ORIGIN).pathname);
      return /^\/usage(?:\/|$)/.test(p);
    } catch (_) {
      return false;
    }
  }

  /** 依目前網址取得對應帳號的 /usage 網址（保留 /u/<index> 前綴） */
  function usageUrlFor(url) {
    try {
      const u = new URL(url || GEMINI_ORIGIN, GEMINI_ORIGIN);
      const m = u.pathname.match(/^(\/u\/\d+)(?=\/|$)/);
      return GEMINI_ORIGIN + (m ? m[1] : '') + '/usage';
    } catch (_) {
      return GEMINI_ORIGIN + '/usage';
    }
  }

  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function preview(text, n = 80) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  /** 檔案大小：1.2 MB / 340 KB / 12 B */
  function formatBytes(n) {
    const v = Number(n) || 0;
    if (v >= 1024 * 1024) return (v / (1024 * 1024)).toFixed(v >= 10 * 1024 * 1024 ? 0 : 1) + ' MB';
    if (v >= 1024) return Math.round(v / 1024) + ' KB';
    return v + ' B';
  }

  GQ.text = {
    GEMINI_ORIGIN,
    stripAccountPrefix,
    formatBytes,
    normalizeForCompare,
    sameText,
    textStartsMatch,
    stripMarkdown,
    renderedMatches,
    conversationKey,
    urlShape,
    isNewChatUrl,
    isUsageUrl,
    usageUrlFor,
    uuid,
    preview
  };
})(globalThis);
