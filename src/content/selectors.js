/*
 * ⚠️ gemini.google.com 改版時最常需要修改的檔案之一。
 *
 * 所有 DOM 選擇器集中在這裡。每個項目是「依序嘗試」的候選清單：
 * 第一個是主要選擇器，其餘是備用。
 * 找不到時請用 require()，它會記錄錯誤並在頁面提示「介面可能已改版」，不會靜默失敗。
 *
 * 修正方式：在 gemini.google.com 開 DevTools → Elements，找到對應元素，
 * 把新的選擇器加到該清單最前面即可。
 */
(function (root) {
  const GQ = (root.GQ = root.GQ || {});
  const log = GQ.logger.createLogger('selectors');

  const SELECTORS = {
    // 聊天輸入框（Gemini 使用 rich-textarea 內的 Quill .ql-editor，placeholder 如「問問 Gemini」）
    editor: [
      'rich-textarea .ql-editor[contenteditable="true"]',
      'div.ql-editor[contenteditable="true"][role="textbox"]',
      'div.ql-editor[contenteditable="true"]',
      'rich-textarea [contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][aria-label*="Gemini" i]',
      'div[contenteditable="true"][aria-label*="prompt" i]',
      'div[contenteditable="true"][aria-label*="提示" i]'
    ],

    // 包住輸入框、附件、送出按鈕的容器（用來限縮其他選擇器的搜尋範圍）
    composer: [
      'input-area-v2',
      'input-container',
      '.input-area-container',
      'form:has(rich-textarea)',
      'div:has(> rich-textarea)',
      'fieldset:has([contenteditable="true"])',
      'div:has(.ql-editor[contenteditable="true"])'
    ],

    // 送出按鈕（注意：Gemini 生成中可能把同一個 .send-button 切換成 .stop，下方 getSendButton 會排除停止狀態）
    sendButton: [
      'button.send-button:not(.stop)',
      'button[data-test-id="send-button"]',
      'button[aria-label="Send message" i]',
      'button[aria-label="Send" i]',
      'button[aria-label="Submit" i]',
      'button[aria-label="傳送訊息"]',
      'button[aria-label="發送訊息"]',
      'button[aria-label="送出訊息"]',
      'button[aria-label="傳送"]',
      'button[aria-label="送出"]',
      'button[aria-label="提交"]',
      'button[mattooltip*="Send" i]',
      'button[mattooltip*="傳送"]',
      'button[type="submit"]'
    ],

    // 回應生成中的「停止」按鈕
    stopButton: [
      'button.send-button.stop',
      'button[aria-label="Stop response" i]',
      'button[aria-label="Stop generating" i]',
      'button[aria-label*="Stop" i]',
      'button[aria-label*="停止"]',
      'button:has(mat-icon[fonticon="stop"])',
      'button[data-test-id="stop-button"]'
    ],

    // 輸入框區域中的附件 / 圖片縮圖
    attachment: [
      'uploader-file-preview',
      'xap-attachment-preview',
      '[data-test-id*="file-preview" i]',
      '[data-testid*="file-preview" i]',
      '[data-testid="file-thumbnail"]',
      '.file-preview-container',
      '.attachment-preview',
      'img[src^="blob:"]',
      'button[aria-label^="Remove" i]',
      'button[aria-label*="移除"]'
    ],

    // 輸入區中「每個附件一張」的卡片（用來計數、比對檔名）。
    // 會合併所有候選的結果，只保留最內層的元素（不含按鈕與 input）。
    attachmentItem: [
      'uploader-file-preview',
      'xap-attachment-preview',
      '[data-test-id*="file-preview" i]',
      '[data-testid*="file-preview" i]',
      '[data-testid="file-thumbnail"]',
      '.file-preview-container',
      '.attachment-preview',
      'file-chip'
    ],

    // 附件卡片上的「移除」按鈕（排隊成功後用來清空輸入區的附件）
    attachmentRemove: [
      'uploader-file-preview button[aria-label*="Remove" i]',
      'uploader-file-preview button[aria-label*="移除"]',
      'button[aria-label^="Remove file" i]',
      'button[aria-label^="Remove" i]',
      'button[aria-label*="移除"]',
      'button[aria-label*="刪除"]',
      'button[aria-label*="Cancel upload" i]',
      'button[aria-label*="取消上傳"]',
      'button[data-test-id*="remove" i]',
      'button[data-testid*="remove" i]'
    ],

    // 附件上傳中的指示（還原時等它消失才送出）
    attachmentUploading: [
      'uploader-file-preview [role="progressbar"]',
      'uploader-file-preview mat-progress-spinner',
      'uploader-file-preview mat-spinner',
      '[aria-busy="true"]',
      '[role="progressbar"]',
      'mat-progress-spinner',
      'mat-spinner',
      '[data-state="pending"]',
      '.animate-spin'
    ],

    // 上傳檔案用的 <input type="file">（若頁面上找不到隱藏 input，attachments.js 會自動改用合成拖放）
    fileInput: [
      'input[type="file"][data-test-id*="upload" i]',
      'input[type="file"][data-testid*="upload" i]',
      'input[type="file"]:not([webkitdirectory])'
    ],

    // 模型選單按鈕（自動重設用來切換模型，例如 bard-mode-switcher）
    modelSelector: [
      'bard-mode-switcher button',
      '[data-test-id="bard-mode-menu-button"]',
      'button.input-area-switch',
      'button[aria-haspopup="menu"][aria-label*="模型"]',
      'button[aria-haspopup="menu"][aria-label*="Model" i]',
      'button[aria-haspopup="menu"][aria-label*="mode" i]',
      'button[aria-haspopup="listbox"][aria-label*="模型"]',
      'button[aria-haspopup="listbox"][aria-label*="Model" i]'
    ],

    // 對話中「使用者的訊息」氣泡（用於確認送出成功、偵測重複）
    userMessage: [
      'user-query .query-text',
      'user-query-content .query-text',
      'user-query',
      '[data-message-author-role="user"]',
      '.user-query-bubble-with-background',
      '[data-test-id="user-query"]'
    ],

    // 可能顯示「已達上限」提示的區域（只掃描這些短文字提示區域，避免讀到聊天內容）
    limitBanner: [
      'rate-limit-banner',
      'message-banner',
      'banner-component',
      '[data-test-id*="limit" i]',
      '[data-testid*="limit" i]',
      '[role="alert"]',
      '[role="status"]',
      '.mat-mdc-snack-bar-container',
      '.cdk-overlay-container [role="dialog"]',
      'input-area-v2 ~ div',
      'input-container ~ div'
    ]
  };

  const reported = new Set();
  let missingHandler = null;

  function onMissing(fn) {
    missingHandler = fn;
  }

  function list(name) {
    const l = SELECTORS[name];
    if (!l) throw new Error(`Unknown selector group: ${name}`);
    return l;
  }

  function safeQuery(scope, sel, all) {
    try {
      return all ? Array.from(scope.querySelectorAll(sel)) : scope.querySelector(sel);
    } catch (e) {
      log.warn('invalid selector', { sel, error: e.message });
      return all ? [] : null;
    }
  }

  // Gemini 的 .send-button 在生成回應時可能切換為停止按鈕；排除停止狀態避免誤按
  function isStopButtonElement(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains('stop')) return true;
    const lbl = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('mattooltip') || ''}`;
    if (/\bstop\b|停止/i.test(lbl)) return true;
    try {
      if (el.querySelector && el.querySelector('mat-icon[fonticon="stop"]')) return true;
    } catch (_) {}
    return false;
  }

  function find(name, scope = document) {
    for (const sel of list(name)) {
      const el = safeQuery(scope, sel, false);
      if (el) return el;
    }
    return null;
  }

  function findAll(name, scope = document) {
    for (const sel of list(name)) {
      const els = safeQuery(scope, sel, true);
      if (els.length) return els;
    }
    return [];
  }

  function require(name, scope = document) {
    const el = find(name, scope);
    if (!el) reportMissing(name);
    return el;
  }

  function reportMissing(name) {
    log.error(`selector not found: ${name}`, { tried: list(name) });
    if (!reported.has(name)) {
      reported.add(name);
      if (missingHandler) missingHandler(name);
    }
  }

  function closestEditor(target) {
    if (!target || !target.closest) return null;
    for (const sel of SELECTORS.editor) {
      try {
        const el = target.closest(sel);
        if (el) return el;
      } catch (_) {}
    }
    return null;
  }

  function closestSendButton(target) {
    if (!target || !target.closest) return null;
    for (const sel of SELECTORS.sendButton) {
      try {
        const el = target.closest(sel);
        if (el) {
          if (isStopButtonElement(el)) continue;
          if (sel === 'button[type="submit"]' && !getComposer()?.contains(el)) continue;
          return el;
        }
      } catch (_) {}
    }
    return null;
  }

  function getComposer() {
    const editor = find('editor');
    if (!editor) return null;
    for (const sel of SELECTORS.composer) {
      try {
        const c = editor.closest(sel);
        if (c) return c;
      } catch (_) {}
    }
    let el = editor;
    for (let i = 0; i < 4 && el.parentElement; i++) el = el.parentElement;
    return el;
  }

  function findSendIn(scope) {
    for (const sel of SELECTORS.sendButton) {
      const els = safeQuery(scope, sel, true);
      for (const el of els) {
        if (!isStopButtonElement(el)) return el;
      }
    }
    return null;
  }

  function getSendButton() {
    const composer = getComposer();
    return (composer && findSendIn(composer)) || findSendIn(document);
  }

  GQ.selectors = {
    SELECTORS,
    find,
    findAll,
    require,
    reportMissing,
    onMissing,
    closestEditor,
    closestSendButton,
    getComposer,
    getSendButton,
    isStopButtonElement
  };
})(globalThis);
