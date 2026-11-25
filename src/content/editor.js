/*
 * 輸入框（Gemini 的 rich-textarea / Quill .ql-editor 富文字編輯器）的讀取、清空、填入。
 *
 * 為什麼不能只改 textContent：
 *   Quill 與外層 Angular 元件依賴真實的輸入事件與選取範圍變更來同步內部狀態；
 *   若不觸發對應的 beforeinput / input 事件，送出按鈕會維持 disabled 或送出空字串。
 *
 * 填入策略（依序嘗試，每一步都會讀回比對，成功才停）：
 *   A. execCommand('insertText') + input 事件：整段一次插入，最接近真實打字。
 *   B. 逐行 insertText + insertParagraph：若方法 A 把換行合併了，改逐行插入段落。
 *   C. 合成 paste 事件（ClipboardEvent + DataTransfer text/plain）：備援（≤ 2000 字）。
 *   全部失敗 → 回報失敗，由 UI 提供「複製文字」讓使用者手動貼上（不會遺失內容）。
 */
(function (root) {
  const GQ = (root.GQ = root.GQ || {});
  const log = GQ.logger.createLogger('editor');
  const { normalizeForCompare } = GQ.text;

  function getEditor() {
    return GQ.selectors.find('editor');
  }

  /**
   * 讀取輸入框純文字。Quill（以及 ProseMirror）每段是一個 <p>，空段落是 <p><br></p>。
   * innerText 會在 <p> 之間產生兩個換行，所以自己走訪。
   */
  function getText(editor = getEditor()) {
    if (!editor) return '';
    if (editor.classList && editor.classList.contains('ql-blank') && !(editor.textContent || '').trim()) {
      return '';
    }
    const blocks = Array.from(editor.children);
    if (blocks.length && blocks.every((b) => b.tagName === 'P' || b.tagName === 'DIV')) {
      return blocks
        .map((p) => {
          // Quill 的空行是 <p><br></p>，ProseMirror 是 <p><br class="ProseMirror-trailingBreak"></p>
          if (!p.textContent && p.children.length <= 1 && (!p.firstElementChild || p.firstElementChild.tagName === 'BR')) {
            return '';
          }
          let out = '';
          const nodes = Array.from(p.childNodes);
          nodes.forEach(function walk(node, idx) {
            if (node.nodeType === Node.TEXT_NODE) out += node.nodeValue;
            else if (node.nodeName === 'BR') {
              const isTrailing =
                (node.classList && node.classList.contains('ProseMirror-trailingBreak')) ||
                (idx === nodes.length - 1 && node.parentNode === p);
              if (!isTrailing) out += '\n';
            } else node.childNodes.forEach((c, ci) => walk(c, ci));
          });
          return out;
        })
        .join('\n')
        .replace(/\u00a0/g, ' ')
        .trim();
    }
    return (editor.innerText || '').replace(/\n\n/g, '\n').replace(/\u00a0/g, ' ').trim();
  }

  function isEmpty(editor = getEditor()) {
    return !getText(editor);
  }

  function hasAttachments() {
    const composer = GQ.selectors.getComposer();
    if (!composer) return false;
    const editor = getEditor();
    return GQ.selectors.findAll('attachment', composer).some((el) => !editor || !editor.contains(el));
  }

  function selectAll(editor) {
    editor.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function notifyInput(editor) {
    try {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (_) {}
  }

  const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

  async function clear(editor = getEditor()) {
    if (!editor) return false;
    selectAll(editor);
    document.execCommand('delete', false);
    notifyInput(editor);
    await tick();
    if (!isEmpty(editor)) {
      selectAll(editor);
      editor.dispatchEvent(
        new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true })
      );
      notifyInput(editor);
      await tick();
    }
    if (!isEmpty(editor)) {
      // Quill 最後備援：重設為單一空段落並通知 Angular / Quill
      editor.innerHTML = '<p><br></p>';
      notifyInput(editor);
      await tick();
    }
    const ok = isEmpty(editor);
    if (!ok) log.warn('clear editor failed');
    return ok;
  }

  function matches(editor, text) {
    return normalizeForCompare(getText(editor)) === normalizeForCompare(text);
  }

  async function methodInsertText(editor, text) {
    selectAll(editor);
    document.execCommand('insertText', false, text);
    notifyInput(editor);
    await tick(80);
  }

  async function methodPerLine(editor, text) {
    await clear(editor);
    editor.focus();
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) document.execCommand('insertText', false, lines[i]);
      if (i < lines.length - 1) document.execCommand('insertParagraph', false);
    }
    notifyInput(editor);
    await tick(80);
  }

  async function methodPaste(editor, text) {
    await clear(editor);
    editor.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    notifyInput(editor);
    await tick(120);
  }

  /**
   * 把文字填入輸入框（會先覆蓋原有內容）。
   * @returns {Promise<{ok: boolean, method?: string}>}
   */
  async function fill(text, editor = getEditor()) {
    if (!editor) return { ok: false, method: null };
    const methods = [
      ['insertText', methodInsertText],
      ['perLine', methodPerLine]
    ];
    if (text.length <= GQ.LIMITS.PASTE_FALLBACK_MAX_CHARS) methods.push(['paste', methodPaste]);

    for (const [name, fn] of methods) {
      try {
        await fn(editor, text);
        if (matches(editor, text)) {
          log.info('fill succeeded', { method: name, length: text.length });
          moveCaretToEnd(editor);
          return { ok: true, method: name };
        }
        log.warn('fill mismatch, trying next method', { method: name, got: getText(editor).length });
      } catch (e) {
        log.warn('fill method threw', { method: name, error: e.message });
      }
    }
    await clear(editor);
    return { ok: false, method: null };
  }

  function moveCaretToEnd(editor) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  GQ.editor = { getEditor, getText, isEmpty, hasAttachments, clear, fill };
})(globalThis);
