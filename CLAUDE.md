# CLAUDE.md / 開發指引

本文件提供在此專案工作的 AI 開發助手（Claude Code / Gemini / Antigravity）架構與維護指引。

## 專案定位

**Gemini Queue**：給 `https://gemini.google.com/*` 使用的 Chrome MV3 擴充功能，純 JavaScript（零依賴、不需建置），改編自原專案 Claude Queue。當 Gemini 的 5 小時算力循環或每週額度達上限時，攔截送出的訊息（含本機附件），存入本機佇列，並在額度重置後協助還原或自動送出。

介面預設語言為繁體中文（`_locales/zh_TW`）。請以繁體中文與使用者溝通。

## 常用指令

```bash
node --test test/                                   # 執行全部單元與 service worker 測試
node --test --test-name-pattern="Gemini" test/      # 執行特定測試
for f in $(find src -name '*.js'); do node --check "$f"; done   # JS 語法檢查
python3 -m http.server 8765                         # 開啟 http://localhost:8765/test/harness/index.html 跑模擬頁面測試
```

- `test/sw.test.js` 與 `test/helpers/sw-env.js` 使用 Node `vm` 載入真正的 `service-worker.js` 與記憶體 `chrome.*` stub。
- `test/gemini-adapt.test.js` 測試 Gemini 多帳號 `/u/<n>`、`/app`、`/gem` 路由、中英文上限提示與日期時間解析，以及 DOM-first 快照與可擴充 Provider。
- `test/harness/index.html` 模擬 `gemini.google.com` 的 DOM（`<input-area-v2>`、`<rich-textarea><div class="ql-editor">`、`<user-query>`、`<uploader-file-preview>`、`<bard-mode-switcher>`），載入真正的 content scripts 跑完所有端對端情境。

## 架構重點

- **共用命名空間 `globalThis.GQ`**：所有模組都是 classic script，掛在 `GQ` 下（`GQ.STORAGE_KEYS`、`GQ.MSG`、`GQ.settings`、`GQ.t`…）。Service worker 以 `importScripts` 載入，popup/options 以 `<script>` 載入，content scripts 嚴格依 `manifest.json` 順序載入。
- **Service worker 是佇列的唯一寫入者**：所有異動透過 `src/background/service-worker.js` 的 `handlers` 與 `locked()` mutex 序列化處理。
- **防重複送出核心不變量**：送出前必須取得 `QUEUE_CLAIM` token、已送出 ID 寫入 `sentIds`、`pendingRestore` 只能領取一次、自動模式絕不在非目標對話送出、`uncertain` 狀態標為失敗絕不自動重試。
- **Gemini 路由處理（`src/shared/text.js`）**：
  - `conversationKey(url)` 保留 `/u/<index>` 以區隔不同 Google 帳號。
  - `isNewChatUrl(url)` 去除選用的 `/u/<index>` 後，將 `/`、`/app`、`/gem/<gemId>` 視為新對話起點；`/app/<chatId>` 與 `/gem/<gemId>/<chatId>` 視為既有對話。
- **DOM 優先用量偵測（`src/content/usage.js`）**：
  - 預設不發送網路請求（`hasUsageProvider() === false`），掃描 `selectors.limitBanner` 解析上限提示與重置時間；未見上限提示時回傳 `{ source: 'dom', full: null, error: null }`。
  - 預留 `GQ.usage.setUsageProvider(fn)` 與 `parseUsageResponse(json)`，日後確認內部 RPC 或用量查詢方式後可直接接上百分比條與自動重設。
- **編輯器與選擇器（`src/content/selectors.js`、`src/content/editor.js`）**：
  - 針對 `rich-textarea .ql-editor`（Quill）處理 `.ql-blank` 與 `<p><br></p>`，每次變更後觸發 bubbling `input` 事件同步 Angular 狀態。
  - Gemini 生成回應時可能把 `.send-button` 加上 `.stop` class 或改 `aria-label="Stop response"`，`selectors.isStopButtonElement()` 會在尋找送出鈕時排除停止狀態。

## 設計約束

- 最小權限：`storage`、`alarms`、`notifications`，host 權限僅 `https://gemini.google.com/*`。
- 絕不偽造或重放 `gemini.google.com` 的內部聊天請求；一律透過填入編輯器並點擊真實送出按鈕完成。
- Debug log 嚴禁記錄訊息內文或附件檔名。
- 所有新增介面文字放入 `_locales/zh_TW/messages.json`（使用 `{placeholder}` 具名佔位符）。
