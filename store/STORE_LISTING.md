# Chrome Web Store 上架資料（Gemini Queue）

這份文件整理「開發人員主控台」表單需要填的所有文字與數值。最後更新：2026-11-24。

## 1. 基本資訊

| 欄位 | 值 |
|---|---|
| 名稱 | Gemini Queue |
| 類別 (Category) | Productivity（生產力工具） |
| 語言 (Language) | 繁體中文（主要），可另外加 English |
| 版本 | 0.1.1（照 `manifest.json`） |

## 2. 單一用途說明（Single purpose）

> 在 gemini.google.com 用量達到上限時，自動保存你要送出的訊息，並在額度重置後協助你送出。
>
> (EN) Saves the message you tried to send when gemini.google.com's usage limit is reached, and helps you send it once your quota resets.

## 3. 簡短描述（Short description，上限 132 字元）

**繁體中文**：
```
gemini.google.com 用量達上限時保存你要送出的訊息，額度重置後協助你送出。
```

**English**：
```
Saves messages you try to send when gemini.google.com usage reaches its limit, and helps you send them after the quota resets.
```

## 4. 詳細描述（Detailed description）

### 繁體中文版

```
⚠️ 這是非官方的社群專案，與 Google 沒有隸屬、合作或背書關係。「Gemini」是 Google LLC 的商標，這裡僅用來說明本工具適用的網站。

Gemini Queue 解決重度使用者常遇到的困擾：訊息打完按下送出時，剛好遇到 5 小時算力額度或每週額度上限，寫好的長篇提示詞與附件還得手動複製、記時間回來重送。

【運作方式】
1. 當頁面上顯示用量已達上限時，你照常按送出，Gemini Queue 會攔下訊息與本機附件存入本機佇列，並清空輸入框。
2. 到了重置時間，發出桌面通知提醒。
3. 點擊通知會開啟原本的對話（支援多帳號 /u/N 與 Gems），自動填回文字與附件並顯示確認列。
4. 也可在設定頁開啟「重置後自動送出」（預設關閉，附有明確警告）。

【特色】
- 完全在本機運作：沒有外部伺服器、不上傳任何資料、不載入遠端程式碼
- 支援文字與本機加入的附件排隊（圖片、PDF 等存在本機 IndexedDB，送出後自動清除）
- 佇列可隨時編輯、刪除，或立即嘗試送出
- 多分頁防重複送出鎖定機制

【權限說明】
- storage／alarms／notifications：本機儲存佇列與設定、排程重置檢查、發送通知
- 僅要求 https://gemini.google.com/* 網站權限，不會存取其他網站

【隱私與開源】
所有資料只存在本機瀏覽器，開發者完全不收集任何資料。
隱私權政策：https://github.com/ivantw829/gemini-queue/blob/main/PRIVACY.md
開源專案（MIT）：https://github.com/ivantw829/gemini-queue
Discord 社群：https://discord.gg/yEpS7vSJtv
```

### English version

```
⚠️ This is an unofficial, community-built project. It is not affiliated with, endorsed by, or sponsored by Google. "Gemini" is a trademark of Google LLC, used here only to describe the site this tool works with.

Gemini Queue helps when you hit a 5-hour or weekly usage limit on gemini.google.com right as you press send: it saves your prompt and local file attachments into a local queue, notifies you when your quota resets, and fills everything back into the original conversation for you to review and send.

FEATURES
- 100% local: no external server, no data collection, no remote code
- Supports queuing text and local file attachments (stored in local IndexedDB and deleted once sent)
- Supports multi-account URLs (/u/0, /u/1) and Gems (/gem/...)
- Multi-tab coordination prevents duplicate sends

PRIVACY & SOURCE
Privacy policy: https://github.com/ivantw829/gemini-queue/blob/main/PRIVACY.md
Source code (MIT): https://github.com/ivantw829/gemini-queue
```

## 5. 隱私權政策網址（Privacy policy URL）

```
https://github.com/ivantw829/gemini-queue/blob/main/PRIVACY.md
```

## 6. 權限理由（Permission justification）

| 權限 | 理由 |
|---|---|
| `storage` | 在使用者本機儲存待送出的訊息佇列、狀態快照與設定，不涉及任何伺服器端儲存。 |
| `alarms` | 在預估的額度重置時間排程檢查與通知，避免持續背景輪詢消耗資源。 |
| `notifications` | 額度重置或自動送出需要使用者處理時，發送桌面通知提醒使用者。 |
| Host permission `https://gemini.google.com/*` | 只在 gemini.google.com 網頁聊天運作：偵測頁面上限提示、攔截已滿時的送出動作、並在重置後填回輸入框。不存取其他網域。 |
