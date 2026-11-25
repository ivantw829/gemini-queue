# 手動測試清單（Gemini Queue）

## 不用真的把額度用完：兩種模擬「用量已滿」的方法

### 方法 A：debug 模擬開關（最簡單，建議）
1. 設定頁 →「除錯」→ 勾選 **記錄 debug log**
2. 勾選 **模擬「用量已滿」**，右側填入分鐘數（例如 `2`），開啟的瞬間開始計時
3. 在 `gemini.google.com/app` 送出訊息 → 會被排入佇列
4. 時間到後，擴充功能會把狀態視為「已重置」→ 走完整個重置流程
5. 測完記得把模擬關掉（關掉後會改回頁面偵測模式）

模擬期間 popup 會顯示 Session 100% 進度條，來源顯示「模擬（debug）」。

> 注意：模擬只影響擴充功能的判斷。按下確認列的「送出」後訊息會**真的**送到 Gemini（你的額度其實沒滿）。請在測試用的新對話中進行。

### 方法 B：模擬頁面上的上限提示橫幅（測試 DOM 偵測）
1. 在 `gemini.google.com/app` 開 DevTools → Console 執行：
   ```js
   const b = document.createElement('div');
   b.setAttribute('role', 'alert');
   b.textContent = "You've reached your limit on Gemini Pro until 11:30 PM";
   document.body.prepend(b);
   ```
2. 送出訊息 → 應被排隊，提示的重置時間是 23:30
3. 把文字改成 `你已達到用量上限，請稍後再試`（沒有時間）再試 → 提示應加註「（時間為估計）」，時間約為 5 小時後
4. 測完執行 `b.remove()`

---

## 0. 第一次使用：確認真實頁面的 DOM 選擇器
登入 `https://gemini.google.com/app`，開啟 DevTools → Console 貼上下列檢查指令，確認關鍵選擇器在你的帳號介面都能抓到：
```js
({
  editor: !!document.querySelector('rich-textarea .ql-editor[contenteditable="true"], div[contenteditable="true"][role="textbox"]'),
  composer: !!document.querySelector('input-area-v2, input-container'),
  sendBtn: !!document.querySelector('button.send-button, button[aria-label*="Send" i], button[aria-label*="傳送"]'),
  modelPicker: !!document.querySelector('bard-mode-switcher button, [data-test-id="bard-mode-menu-button"]')
})
```
若有任何一項為 `false`，在 Elements 面板找到對應元素，把新的選擇器加到 `src/content/selectors.js` 對應清單最前面即可。

## 1. 安裝與基本
- [ ] 載入未封裝項目沒有錯誤；`chrome://extensions` 上沒有「錯誤」按鈕
- [ ] 點 service worker 的「檢查」連結，Console 沒有錯誤
- [ ] 重新整理 `gemini.google.com` 分頁，頁面 Console 沒有 `[GeminiQueue:…]` 的錯誤
- [ ] popup 顯示「頁面偵測模式 · 目前未見上限提示」（不會誤報端點錯誤）；設定頁文字皆為繁體中文

## 2. 用量未滿時完全不干涉
- [ ] 模擬關閉、無上限提示：按 Enter 送出 → 正常送出，沒有任何提示
- [ ] 按送出按鈕 → 正常送出
- [ ] Shift+Enter → 換行，不送出
- [ ] 用注音／倉頡輸入，選字時按 Enter → 只確認選字，不送出也不被攔截

## 3. 用量已滿時攔截（方法 A 或 B）
- [ ] 輸入多行文字（含 Shift+Enter 換行、空行、中文、emoji），按 Enter → 沒有送出；提示「用量已滿，訊息已排入佇列，預計 HH:MM 重置」；Quill 輸入框清空
- [ ] 改用點送出按鈕 → 一樣被攔截
- [ ] popup 佇列出現該訊息，狀態「等待重置」，有倒數；工具列圖示顯示 1（藍色）
- [ ] 在 popup 編輯文字並儲存 → 內容更新
- [ ] 在 `/app` 新對話排一則 → popup 顯示「新對話」
- [ ] 在 `/gem/<id>` 排一則 → popup 顯示「Gem 新對話」
- [ ] 多帳號網址 `/u/1/app/...` 排隊時，不會與 `/u/0/app/...` 混淆

## 3b. 附件排隊（方法 A）
- [ ] 選檔加入一張圖片＋輸入文字，按 Enter → 提示「訊息與 1 個附件已排入佇列」；輸入框文字**和附件預覽**都被清空
- [ ] popup 項目顯示「📎 1 個附件（大小）：檔名」
- [ ] 「立即嘗試」→ 附件先加回輸入區、上傳完成後才填文字與顯示確認列；按送出 → 對話中的訊息含附件與文字，佇列移除，service worker Console 執行下列指令應回傳 0：
  `new Promise(r=>{const q=indexedDB.open('gq-files');q.onsuccess=()=>{const t=q.result.transaction('files').objectStore('files').count();t.onsuccess=()=>r(t.result)}})`
- [ ] 從 Google 雲端硬碟加入附件後送出 → 提示「這則訊息有無法保存的附件…」，不攔截

## 4. 重置流程（手動確認模式，預設）
- [ ] 模擬時間到（約 2 分鐘＋30 秒緩衝）→ 跳出桌面通知「Gemini 額度已重置」
- [ ] 工具列圖示變綠色；popup 狀態變「可送出」
- [ ] 點通知 → 切換到原對話分頁（若已開著）或開新分頁
- [ ] 文字自動填入 Quill 輸入框，送出按鈕變為可按
- [ ] 確認列「已還原訊息，要送出嗎？[送出] [取消] [保留在佇列]」
- [ ] 按 **送出** → 訊息出現在對話中（`user-query`）；佇列移除該項
- [ ] 同一對話的第二則：等 Gemini 回應完成（停止按鈕消失）後自動還原下一則

## 5. 自動送出與自動重設（模擬模式）
- [ ] 設定頁勾選「重置後自動送出」→ 模擬重置後自動開啟分頁、填入並 3 秒倒數送出
- [ ] 設定頁勾選「自動重設」並搭配模擬 2 分鐘 → 模擬結束後在專用對話自動送出 `Hello World!`，並在第二次觸發時嘗試切換為設定的 `4 Hydrogen`（思考程度「低」）模型

---

## 自動化測試（不需登入）

```bash
node --test test/
```
涵蓋 service worker 流程、附件暫存與清理、自動重設狀態機、模型設定、新版本檢查，以及 Gemini 網址路由／上限時間解析／DOM-first 快照單元測試。

```bash
python3 -m http.server 8765
```
開啟 <http://localhost:8765/test/harness/index.html>：在模擬 `gemini.google.com` 的頁面上載入真正的 content scripts 執行 28 個端對端情境，底部全部顯示 `PASS` 且 `DONE` 即通過。
