# Gemini Queue

> 🌐 **說明網頁**：<https://ivantw829.github.io/gemini-queue/>
>
> 💬 **討論群組（Discord）：<https://discord.gg/yEpS7vSJtv>** 有問題、建議或想分享用法都歡迎來聊。
>
> 🔗 **姊妹專案**：如果你也使用 Claude，歡迎參考 [Claude Queue](https://github.com/ivantw829/claude-queue)。

`gemini.google.com` 用量達上限（5 小時算力循環上限或每週上限）時，把你按下送出的訊息（含從電腦加入的附件）先存起來，等額度重置後通知你，並協助把訊息與附件填回原對話、由你確認後送出。平時也會自動從 `gemini.google.com/usage` 讀取 5 小時與每週用量進度條。

> ⚠️ 這是**非官方**的社群開源專案，與 Google 沒有隸屬、合作或背書關係。「Gemini」是 Google LLC 的商標，這裡僅用來說明本工具適用的網站。

---

### 為什麼需要它？

用量滿的時候，常常是你正想到一個好問題、或剛打完一大段 prompt（甚至還附了好幾個檔案）。這時通常只能：把文字複製到別處、記住要在幾點回來、到時候再找回原本的對話重新上傳與貼上。Gemini Queue 把這些步驟自動化：

```
你按下送出 ──► 偵測到用量已滿 ──► 存入佇列（含對話網址與附件）──► 清空輸入框
                                                    │
            重置時間到 ◄────────────────────────────┘
                │
                ▼
  透過 /usage 確認已重置 ──► 桌面通知 ──► 你點通知 ──► 開啟原對話、自動加回附件與文字
                                                                │
                                                                ▼
                                                  你按「送出」（或開啟自動送出）
```

### 特色

- **零干擾**：用量沒滿時完全不攔截，跟沒裝一樣
- **即時雙進度條**：自動從 `gemini.google.com/usage` 讀取 **目前用量（5 小時）** 與 **每週上限** 百分比及重置時間，在工具列小視窗一目了然
- **不會弄丟訊息**：確認存檔成功才清空輸入框；任何一步失敗都會保留在佇列，並提供「複製文字」
- **附件也能排隊**：圖片、PDF 等你從電腦加入的檔案會連同文字一起存進本機 IndexedDB，重置後自動加回輸入區、等上傳完成才送出
- **支援多帳號與 Gems**：完整支援 `/app/<id>`、Google 多帳號路徑 `/u/0/app/...`、`/u/1/app/...`（自動對應同帳號的 `/u/<n>/usage`）以及 `/gem/<id>`
- **由你決定何時送出**：預設是桌面通知＋確認列，自動送出要你自己去設定頁開啟
- **自動重設（選用）**：5 小時工作階段歸零時自動在專用對話送出一則短訊息（預設切到最省額度的 **4 Hydrogen／思考程度「低」**），讓下一個工作階段馬上開始倒數，起床可以連續用到兩個工作階段
- **新版本通知**：從 GitHub 安裝時，每天檢查一次有沒有新版本，有的話發通知並附上更新步驟（只讀版本號，可關閉）
- **防重複送出**：多個分頁、手動送出、送出中關閉分頁、生成中按鈕變為停止鈕等情況都有保護
- **改版時好修**：DOM 選擇器與用量解析各自集中在單一檔案，找不到元素會明確提示
- **繁體中文介面**，已預留 i18n 多語系結構

### 基本原則

- Manifest V3、純 JavaScript，**零依賴、不需要建置**
- 只在 `https://gemini.google.com/*` 運作；權限只有 `storage`、`alarms`、`notifications`
- 沒有自己的伺服器、不上傳任何資料、不載入遠端程式碼；唯一的外部連線是每天讀一次 GitHub 上的 `manifest.json` 版本號（不帶參數與 cookie，可關閉，商店版不會連）
- 不重放或偽造 `gemini.google.com` 的內部請求：送出一律透過頁面上的輸入框與送出按鈕，跟你自己操作完全一樣
- 不會繞過任何用量限制，只是幫你**延後**送出

---

## 安裝（載入未封裝項目）

> 📖 第一次安裝？看 **[新手教學：從安裝到使用](GUIDE.md)**，有從零開始的圖文級步驟、睡前自動重設檢查清單與疑難排解。

1. 下載本專案（按右上角綠色 **Code → Download ZIP** 解壓縮到固定資料夾，或 `git clone https://github.com/ivantw829/gemini-queue.git`）
2. 開啟 Chrome 網址列輸入 `chrome://extensions`
3. 打開右上角「開發人員模式」
4. 按左上角「載入未封裝項目」，選擇這個資料夾（裡面直接有 `manifest.json` 的那層）
5. 把 **Gemini Queue** 釘選到工具列（拼圖圖示 🧩 → 圖釘 📌）
6. **已經開著的 `gemini.google.com` 分頁要重新整理一次**，content script 才會載入

更新程式碼後：在 `chrome://extensions` 按 Gemini Queue 的重新整理鈕 `↻`，再重新整理 `gemini.google.com` 分頁。

---

## 使用方式

### 平常
什麼都不用做。用量未滿時，擴充功能不會攔截任何東西。點一下工具列圖示即可查看 5 小時與每週用量進度條。

### 用量滿了
1. 照常輸入訊息（可包含從電腦選取、拖放或貼上的檔案），按 Enter 或送出按鈕
2. 擴充功能會攔下這次送出、再確認一次用量確實已滿，然後把文字、附件、對話網址、重置時間存入佇列
3. **確認存檔成功後**才清空輸入框（附件也會從輸入區移除），頁面下方會顯示：「用量已滿，訊息已排入佇列，預計 HH:MM 重置」
   - 如果重置時間是推估或解析不到（預設 5 小時後），會加註「（時間為估計）」
4. 工具列圖示會顯示佇列數量（藍色＝等待中、綠色＝可送出、紅色＝有失敗項目）

### 額度重置後
1. 到了重置時間（＋30 秒緩衝），擴充功能會透過 `/usage` 確認額度真的已重置；還沒重置就每 2 分鐘重試，最多 10 次
2. 發出桌面通知「Gemini 額度已重置」
3. 點通知 → 開啟（或切換到）原對話分頁 → 附件與文字自動填回輸入框
4. 頁面下方出現確認列：**已還原訊息，要送出嗎？**
   - **送出**：按下頁面上的送出按鈕，確認訊息出現在對話中後才從佇列移除
   - **取消**：從佇列移除這則訊息，文字留在輸入框讓你自行處理
   - **保留在佇列**：清空輸入框，訊息留在佇列，之後可從 popup 再試
5. 同一對話若有多則排隊訊息，會等 Gemini 回應完成後依序還原下一則

### 自動重設（選用，預設關閉）
Gemini 的 5 小時算力循環在歸零後，要等你**送出下一則訊息**才會開始計算新的一輪 5 小時。晚上睡覺時若工作階段結束，就會一直停在 `0%`，直到起床送出第一則訊息才重新起算。

開啟「自動重設」後：
1. 工作階段結束（＋90 秒緩衝）時，擴充功能透過 `/usage` 確認目前用量已歸零、且每週上限未滿
2. 開啟一個**專用對話**（第一次會自動開新對話並記住網址，之後都固定用同一個；被刪除時會自動再開一個），填入短訊息（預設 `Hello World!`，可在設定頁修改），倒數 3 秒後送出
3. 送出前會在專用對話的模型選單切到設定的模型與思考程度（預設 **4 Hydrogen／低**，快速且最省額度；未解鎖帶有鎖頭 🔒 的模型如 Pro 方案下的 `4 Carbon` 會自動避開，不會誤觸升級視窗。專用對話剛建立時的第一則用目前模型送出，之後才切換）
4. 下一個 5 小時工作階段立即開始倒數。例如凌晨 3 點自動送出，早上 7 點起床時目前的工作階段 8 點就會重置，可以先用 1 小時、8 點再無縫接一個完整的新工作階段

注意：
- Chrome 必須開著、**電腦不能睡眠**（macOS 可在終端機執行 `caffeinate -i`，或調整「電池／能源」設定），`gemini.google.com` 要保持登入
- 送出時會把 Chrome 視窗帶到最前面（全天都會運作，包含白天）
- 如果佇列裡有排隊訊息正在自動送出，就不另外送；連續失敗 3 次會自動暫停並發通知

### Popup（點工具列圖示）
- **目前用量（5 小時）** 與 **每週上限** 百分比、重置時間與倒數、資料來源
- 佇列清單：每則可 **編輯** 文字、**立即嘗試**（開啟原對話並還原）、**刪除**（兩段式確認）

### 設定頁（popup 右上角 ⚙）
- **重置後自動送出（不需確認）**：預設關閉。開啟後會在重置時自動開啟分頁、填入，3 秒倒數後送出（開啟前會跳出確認對話框）
- **自動重設**：工作階段歸零時自動送出一則訊息、自訂訊息內容、模型選擇（`4 Hydrogen`／`自動`／`4 Neon`／`4 Carbon`／`不切換`）與思考程度（`低`／`中等`／`高`／`不調整`）
- 桌面通知開關、用量輪詢頻率（預設 2 分鐘，多分頁共用結果）、新版本自動檢查開關
- debug log 開關與檢視／複製／清除、模擬「用量已滿」（測試用，見 [TESTING.md](TESTING.md)）、清除所有資料

---

## 運作方式

### 用量偵測（`src/content/usage.js` ＋ `src/background/service-worker.js`）
由於 `gemini.google.com` 的 `X-Frame-Options` 為 `DENY` 且用量資料由 Angular 前端動態載入，本擴充功能採用 **`/usage` 背景靜默擷取 ＋ 聊天頁上限橫幅備援** 雙軌機制：

1. **自動讀取 `https://gemini.google.com/usage`**：
   - 若你已經開著 `/usage` 分頁：直接讀取其渲染後的「目前用量」與「每週上限」卡片（若分頁在背景則重新整理一次以取得最新百分比，絕不會關閉你自己的分頁）。
   - 若沒有開著 `/usage` 分頁：Service Worker 以單飛鎖定（single-flight）在背景建立一個非作用中分頁（`active: false`，完全不搶焦點，並自動保留 `/u/0`、`/u/1` 等多帳號路徑），等 Angular 渲染出百分比與重設時間後（約 1–2 秒）立即讀取並自動關閉該暫時分頁。
   - 內建 5 小時視窗時界保護：若剛過重置時間（例如 13:08 讀到剛過期的「下午 1:07」），不會誤加一天判成明天。
2. **DOM 上限橫幅備援**：在聊天頁同時掃描特定提示區域（`rate-limit-banner`、`message-banner`、`role=alert/status` 等短文字元素，排除輸入框與對話氣泡）是否出現中英文上限提示；即使某個特定模型單獨觸發限制也能即時攔截。

### 攔截與附件（`src/content/interceptor.js`、`src/content/attachments.js`）
- 在 `window` 的 capture 階段監聽 `keydown`（Enter，排除 Shift+Enter 與輸入法選字中的 Enter）、`click`（送出按鈕）與停用送出鈕上的 `pointerdown`，只處理 `isTrusted` 真實使用者事件
- Gemini 在生成回應時可能把 `.send-button` 切換為停止鈕（`.stop` / `Stop` / `停止`），`selectors.js` 會自動排除停止狀態避免誤觸
- 有附件時：
  - 在選檔、拖放、貼上圖片當下記下 `File`，排隊時與輸入區的附件預覽卡片比對
  - 對不上的附件（例如 Google 雲端硬碟檔案、擴充功能載入前已加入的檔案）→ 提示並照原本行為放行，不冒險排入缺件訊息
  - 單檔上限 30MB、每則上限 20 個、佇列總量上限 300MB；檔案透過 Service Worker 存入擴充功能專屬的 IndexedDB（`gq-files`），送出或刪除時自動 GC 清理

### 填入輸入框（`src/content/editor.js`）
`gemini.google.com` 的輸入框是 `rich-textarea` 內的 Quill（`.ql-editor[contenteditable="true"]`）富文字編輯器。依序嘗試並讀回驗證：
1. **`document.execCommand('insertText')` ＋ 派發 bubbling `input` 事件**：讓 Quill 與外層 Angular 同步更新內容與送出按鈕啟用狀態
2. **逐行 `insertText` + `insertParagraph`**：處理多行換行段落
3. **合成 `paste` 事件**（`ClipboardEvent` + `DataTransfer`，2000 字以內）
4. **保底備援**：全部失敗時於確認列提供「複製文字」，訊息保留在佇列絕不遺失

### 邊緣情況處理
| 情況 | 處理方式 |
|---|---|
| 分頁被關閉（等待中） | 不影響；重置時會開啟新分頁 |
| 送出過程中分頁被關閉 | 標記 `failed`（「請確認是否已送出」），**絕不自動重送** |
| 瀏覽器重啟、alarm 遺失 | `onStartup` 與每次 SW 喚醒都會依佇列重建排程，並清理殘留暫時分頁 |
| 多個 Gemini 分頁／多 Google 帳號 | 用量快照共用；`/u/0` 與 `/u/1` 對話網址嚴格區隔，不會跨帳號誤送；claim token 互斥防重複 |
| 原對話已刪除／網址變了 | 手動模式詢問「要在目前這個對話送出嗎？」；自動模式嘗試重開一次，仍不符則停止並通知 |
| 在 `/app` 新對話連續排入多則 | 第一則送出建立 `/app/<id>` 後，後續同群組訊息自動重新綁定並依序送進同一個對話 |
| 你已經手動送出相同內容 | 偵測到後自動從佇列移除；還原時若對話最後 3 則已有相同文字也會先詢問 |
| 輸入框已有草稿 | 手動模式詢問是否覆蓋；自動模式會先把原草稿存進佇列（標記「草稿」不自動送）再覆蓋 |

---

## gemini.google.com 改版時最容易壞的地方

| 症狀 | 原因 | 要改的檔案 |
|---|---|---|
| Popup 顯示「讀取 /usage 失敗」或百分比一直是 `--` | `gemini.google.com/usage` 的標題文字（「目前用量／每週上限」）或百分比格式改了 | `src/content/usage.js`：`parseUsagePageText()`、`parseUsageCardSlice()` |
| 用量滿了卻沒攔截（`/usage` 未滿但特定模型被擋時） | 聊天頁上限橫幅的位置或文字句型改了 | `src/content/selectors.js` 的 `limitBanner`；`src/content/usage.js` 的 `LIMIT_PATTERNS` |
| 頁面跳出「找不到頁面元素『editor／sendButton／userMessage』」 | DOM 結構或 aria-label 改了 | `src/content/selectors.js`：在對應清單最前面加上新的選擇器 |
| 還原時顯示「無法自動填入輸入框」 | 編輯器不再是 Quill `.ql-editor` 或事件機制變更 | `src/content/editor.js` 的 `fill()` / `getText()` |
| 送出後被標記「失敗」，但其實有送出 | 使用者訊息氣泡選擇器改了（不再是 `user-query`） | `src/content/selectors.js` 的 `userMessage` |
| 有附件時提示「無法保存的附件」或排隊後附件沒移除 | 附件預覽卡片或移除按鈕選擇器改了 | `src/content/selectors.js` 的 `attachmentItem`、`attachmentRemove` |
| 還原時附件加不回去或上傳逾時 | `<input type="file">` 或上傳中指示選擇器改了 | `src/content/selectors.js` 的 `fileInput`、`attachmentUploading` |
| 設定頁「最後一次檢查」顯示「模型切換失敗」 | 模型選單按鈕或選項名稱（如 `4 Hydrogen`／`思考程度`）改版了 | `src/content/selectors.js` 的 `modelSelector`；`src/content/model.js` |

回報問題時，請在設定頁開啟 debug log、重現問題，再按「複製 log」附上（log 不含訊息內容與檔名）。

---

## 專案結構

```
manifest.json
_locales/
  zh_TW/messages.json        繁體中文（預設語系，所有介面文字）
  en/messages.json           英文（名稱與描述，示範 i18n 結構）
icons/                       16/32/48/128 px 原創藍紫佇列圖示
src/
  shared/                    service worker、content script、popup、options 共用（globalThis.GQ）
    constants.js             storage key、狀態、時間常數、訊息類型
    i18n.js                  t()、applyI18n()、時間格式化
    settings.js              設定預設值（含 Gemini 4 模型選項）、讀寫、同步
    logger.js                debug log（環狀緩衝 500 筆，前綴 [GeminiQueue:*]）
    text.js                  文字比對、多帳號 /u/<n> 與 /app、/gem、/usage 網址工具
    session.js               工作階段與自動重設狀態判斷
    version.js               版本比較與 GitHub 更新檢查網址
  background/
    service-worker.js        佇列（唯一寫入者）、alarms、通知、背景 /usage 擷取與分頁協調
    filestore.js             佇列附件存放（擴充功能專屬 IndexedDB: gq-files）
  content/                   依 manifest 順序載入
    selectors.js             ⚠ 所有 Gemini DOM 選擇器與停止鈕排除邏輯
    usage.js                 ⚠ /usage 頁面解析、DOM 橫幅備援、重置時間解析、模擬
    editor.js                ⚠ Quill (.ql-editor) 讀取／清空／填入
    model.js                 ⚠ 自動重設切換模型（自動 / 4 Hydrogen / 4 Neon / 4 Carbon ＋ 思考程度）
    attachments.js           ⚠ 捕捉本機檔案、排隊對應、還原加回
    ui.js                    頁面內提示與確認列（Shadow DOM: <gemini-queue-ui>）
    sender.js                與 SW 溝通、按送出、確認送出成功
    interceptor.js           攔截 Enter 與送出按鈕
    restore.js               重置後還原流程
    main.js                  進入點：用量輪詢、/usage 自動回報、SPA 換頁偵測
  popup/                     工具列彈出視窗
  options/                   設定頁
test/                        Node 單元測試與瀏覽器端對端模擬測試頁（test/harness/index.html）
GUIDE.md                     新手教學：從安裝到使用
TESTING.md                   手動測試清單
PRIVACY.md                   中英雙語隱私權政策
```

---

## 常見問題（FAQ）

**Q：這會讓我多用額度或繞過 Google 的限制嗎？**
不會。它只是在你被擋下時把訊息存起來，等額度恢復後再透過頁面上的送出按鈕送出，跟你自己晚點回來貼上送出完全一樣。

**Q：我的訊息與附件會被傳到哪裡？**
哪裡都不會。佇列文字只存在你自己 Chrome 的 `chrome.storage.local`，附件存在擴充功能自己的本機 IndexedDB（`gq-files`），訊息送出或刪除時就會一併清除。詳見 [PRIVACY.md](PRIVACY.md)。

**Q：為什麼偶爾會看到背景閃過一個 `gemini.google.com/usage` 分頁又馬上關掉？**
因為 `gemini.google.com` 禁止 `iframe` 內嵌（`X-Frame-Options: DENY`）且用量百分比由前端動態渲染，擴充功能會在背景靜默開一個不搶焦點的 `/usage` 分頁讀取最新百分比，讀完（約 1–2 秒）立刻自動關閉。如果你不想讓它開關分頁，也可以調整設定頁的「用量輪詢頻率」（最長 30 分鐘），或自己把一個 `/usage` 分頁釘選在瀏覽器裡，擴充功能就會直接複用它。

**Q：可以傳圖片或 PDF 附件嗎？**
可以！從電腦選取、拖放或剪貼簿貼上的檔案都會連同文字一起排隊，重置後自動加回輸入區並等上傳完成才送出。Google 雲端硬碟連結的附件無法保存，遇到時會提示並照原本方式處理。

**Q：支援多個 Google 帳號切換（`/u/0`、`/u/1`）或 Gems 嗎？**
支援。排隊時會完整保留 `/u/<n>` 帳號路徑與 `/gem/<id>`，查詢 `/usage` 時也會自動對應同一個 `/u/<n>/usage` 帳號，不會跨帳號誤送或讀錯額度。

**Q：同一個對話排了好幾則訊息會怎樣？**
會依排隊順序一則一則處理：送出第一則後，等 Gemini 回應生成完畢（停止按鈕消失），再自動還原下一則。

**Q：電腦睡眠或 Chrome 關閉時會怎樣？**
Chrome 關閉時無法執行排程。下次打開 Chrome 時會自動重建排程；若重置時間已經過了，會立刻檢查並通知你。

**Q：支援 Gemini 手機 App 或 Google AI Studio 嗎？**
不支援，目前只支援 `https://gemini.google.com/*` 網頁版。

---

## 參與貢獻

歡迎各種形式的貢獻：
- **回報問題**：開 [GitHub Issue](https://github.com/ivantw829/gemini-queue/issues)，說明 Chrome 版本、重現步驟，並附上設定頁「複製 log」的內容
- **`gemini.google.com` 改版修正**：請參考上方[改版對照表](#geminigooglecom-改版時最容易壞的地方)，通常只需修改 `selectors.js`、`usage.js` 或 `model.js`
- **翻譯**：複製 `_locales/zh_TW/messages.json` 到 `_locales/<語系>/messages.json` 翻譯 `message` 欄位（保留 `{name}` 具名佔位符）

開 PR 前請保持：零外部依賴與免建置、不新增權限、不偽造聊天 API 請求、介面文字放入 `_locales`，並通過 `test/` 測試。

## 授權

[MIT License](LICENSE)。可以自由使用、修改、散布，但請保留授權聲明。本軟體依「現狀」提供，不附任何保證。
