# Gemini Queue 隱私權政策 / Privacy Policy

最後更新 / Last updated：2026-11-24

> 本頁同時提供繁體中文與英文版本，供 Chrome Web Store 審核與使用者參考。
> This page provides both Traditional Chinese and English versions for Chrome Web Store review and user reference.

---

## 繁體中文

### 本擴充功能是什麼

Gemini Queue 是一個非官方的社群 Chrome 擴充功能，用於 `gemini.google.com` 網頁聊天。當你的用量達到上限時，它會攔下你要送出的訊息（文字與你從電腦加入的附件）、存入本機佇列，並在額度重置後提醒你送出。

本專案與 Google 沒有隸屬、合作或背書關係。「Gemini」是 Google LLC 的商標，這裡僅用於說明本工具適用的網站。

### 我們收集哪些資料

**我們（開發者）完全不收集任何資料。** 本擴充功能沒有自己的伺服器，不會把任何資料傳送給開發者或任何第三方。

擴充功能會在**你自己的瀏覽器裝置上**，使用 Chrome 的 `storage.local` API 與本機 IndexedDB 儲存以下內容，僅供擴充功能本身運作使用：

| 資料 | 用途 | 儲存位置 |
|---|---|---|
| 你排入佇列的訊息文字 | 額度重置後自動填回輸入框 | 本機 `chrome.storage.local` |
| 你排入佇列的訊息附件（檔案內容、檔名、類型、大小） | 額度重置後透過頁面的上傳元件加回輸入框 | 本機擴充功能的 IndexedDB（`gq-files`）；訊息送出或刪除時一併刪除 |
| 偵測到的用量狀態與重置時間 | 顯示狀態、判斷何時可以送出 | 本機 `chrome.storage.local` |
| 你的設定（是否自動送出、通知開關、輪詢頻率等） | 記住你的偏好 | 本機 `chrome.storage.local` |
| 除錯紀錄（事件名稱、項目 id、文字長度、狀態） | 協助你自行除錯；**不含訊息內容與檔名** | 本機 `chrome.storage.local`，最多 500 筆，可在設定頁清除 |

### 資料如何被使用、是否會離開你的裝置

- 擴充功能不會呼叫任何分析服務，也不會傳送你的任何聊天資料：
  - **新版本檢查**：只有從 GitHub 原始碼安裝（開發人員模式）時，每天一次讀取 GitHub 上公開的 `manifest.json`（`raw.githubusercontent.com`）比較版本號。這是不帶任何參數、不帶 cookie 的 GET 請求。可在設定頁「更新」關閉；從 Chrome 線上應用程式商店安裝時完全不會發出這個請求。
- 擴充功能只會在你按下「送出」、且系統判斷「用量已達上限」時，才讀取輸入框的文字內容，用途僅限於存入佇列。
- 為了判斷訊息是否已成功送出、避免重複送出，擴充功能會在本機比對目前對話中**你自己最近幾則訊息**的文字；這項比對只在本機進行，不會保存或傳送。
- 所有資料都留在 `chrome.storage.local` 與擴充功能自己的 IndexedDB，不會同步到雲端、不會上傳到任何伺服器、不會賣給或分享給第三方。

### 權限使用說明

| 權限 | 用途 |
|---|---|
| `storage` | 在本機儲存佇列、用量狀態快照、設定與除錯紀錄 |
| `alarms` | 排程「額度重置時間＋30 秒」的檢查，確認是否已重置 |
| `notifications` | 額度重置、需要你確認送出等情況發送桌面通知 |
| Host 權限：`https://gemini.google.com/*` | 偵測頁面上的上限提示、填入與送出佇列中的訊息；不會用於其他網站 |

### 你的控制權

- 設定頁提供「清除所有資料」，會立即刪除佇列、附件、快照、設定與除錯紀錄。
- 移除擴充功能會刪除 Chrome 為它保留的所有本機資料。
- 你可以隨時在佇列中編輯或刪除個別項目。

---

## English

### What this extension is

Gemini Queue is an unofficial, community-built Chrome extension for the `gemini.google.com` web chat. When your usage limit is reached, it intercepts the message you were about to send (its text and any local files you attached), stores it in a local queue, and reminds you to send it once your quota resets.

This project is not affiliated with, endorsed by, or sponsored by Google. "Gemini" is a trademark of Google LLC, used here only to describe the site this tool works with.

### What data we collect

**We (the developer) do not collect any data at all.** The extension has no server of its own and never transmits any data to the developer or any third party.

The extension stores the following locally on your own browser device solely so the extension itself can function:

| Data | Purpose | Where it's stored |
|---|---|---|
| The text of messages you queue | Auto-filled back into the composer after your quota resets | Local `chrome.storage.local` |
| Files attached to messages you queue | Re-attached through the page's upload control after reset | Extension's local IndexedDB (`gq-files`); deleted when sent or removed |
| Detected limit status and reset times | Used to decide when sending is allowed | Local `chrome.storage.local` |
| Your settings | Remembers your preferences | Local `chrome.storage.local` |
| Debug log (metadata only) | Lets you debug issues yourself; **never includes message content or filenames** | Local `chrome.storage.local`, capped at 500 entries |

### Network requests & on-device processing

- For unpacked (developer mode) installs only, the extension checks the public `manifest.json` on GitHub once a day with no parameters or cookies to notify of updates (configurable in settings; disabled for Chrome Web Store installs).
- All message queuing, duplicate detection, and attachment storage happen strictly on your device.

### Permissions

| Permission | Why it's needed |
|---|---|
| `storage` | Store the queue, usage snapshot, settings, and debug log locally |
| `alarms` | Schedule checks around the expected quota reset time |
| `notifications` | Notify you when your quota resets or requires attention |
| Host permission: `https://gemini.google.com/*` | Detect limit banners on the page and restore/send queued messages |

---

**聯絡方式 / Contact：** 請透過 GitHub Issues 回報問題或疑問 / Please use GitHub Issues to report questions or concerns:
<https://github.com/ivantw829/gemini-queue/issues>
