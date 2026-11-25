/*
 * Gemini 專屬路由、/usage 頁面解析、上限提示文字解析與背景擷取單元測試。
 *
 *   node --test test/
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const ctx = {
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    chrome: {
      storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } },
      runtime: { sendMessage: async () => ({}) }
    },
    document: { querySelectorAll: () => [], querySelector: () => null }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of [
    'src/shared/constants.js',
    'src/shared/settings.js',
    'src/shared/logger.js',
    'src/shared/text.js',
    'src/content/selectors.js',
    'src/content/usage.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.GQ;
}

test('Gemini URL routing: /app, /usage, /u/<n>/app, /gem/<id>', () => {
  const { text } = loadEnv();
  assert.equal(text.isNewChatUrl('https://gemini.google.com/'), true);
  assert.equal(text.isNewChatUrl('https://gemini.google.com/app'), true);
  assert.equal(text.isNewChatUrl('https://gemini.google.com/u/2/app/'), true);
  assert.equal(text.isNewChatUrl('https://gemini.google.com/gem/coding-helper'), true);
  assert.equal(text.isNewChatUrl('https://gemini.google.com/usage'), false);
  assert.equal(text.isNewChatUrl('https://gemini.google.com/app/1a2b3c4d5e6f'), false);

  // Usage URL helpers
  assert.equal(text.isUsageUrl('https://gemini.google.com/usage'), true);
  assert.equal(text.isUsageUrl('https://gemini.google.com/u/1/usage/'), true);
  assert.equal(text.isUsageUrl('https://gemini.google.com/app'), false);
  assert.equal(text.usageUrlFor('https://gemini.google.com/app/abc'), 'https://gemini.google.com/usage');
  assert.equal(text.usageUrlFor('https://gemini.google.com/u/1/app/abc'), 'https://gemini.google.com/u/1/usage');
});

test('parseUsagePageText parses real gemini.google.com/usage zh_TW & EN text accurately', () => {
  const { usage } = loadEnv();
  // 2026-11-25 11:14 local time
  const now = new Date(2026, 10, 25, 11, 14, 0).getTime();

  const realCollapsed =
    'Gemini 用量限制 PRO 方案限制決定了你在一段時間內可使用的 Gemini 額度。進階模型和功能可能需要更高的用量。瞭解詳情 ' +
    '剛才更新 目前用量 info 已使用 4% 重設時間：下午1:07 每週上限 重設時間：12月1日下午1:07 已使用 0% ' +
    '訂閱 AI Ultra 即享 5 倍用量 每月 $3,300';
  const r1 = usage.parseUsagePageText(realCollapsed, now);
  assert.ok(r1);
  assert.equal(r1.session.pct, 4);
  assert.equal(new Date(r1.session.resetsAt).getDate(), 25);
  assert.equal(new Date(r1.session.resetsAt).getHours(), 13);
  assert.equal(new Date(r1.session.resetsAt).getMinutes(), 7);
  assert.equal(r1.weekly.pct, 0);
  assert.equal(new Date(r1.weekly.resetsAt).getMonth(), 11); // December
  assert.equal(new Date(r1.weekly.resetsAt).getDate(), 1);
  assert.equal(new Date(r1.weekly.resetsAt).getHours(), 13);
  assert.equal(new Date(r1.weekly.resetsAt).getMinutes(), 7);

  // Just-expired 5-hour session reset time (13:08 reading "下午1:07") must NOT jump +24h to tomorrow
  const justPast = new Date(2026, 10, 25, 13, 8, 0).getTime();
  const rPast = usage.parseUsagePageText(realCollapsed, justPast);
  assert.ok(rPast.session.resetsAt <= justPast, 'expired 5h session stays in the past');

  // Idle 0% without reset time
  const rIdle = usage.parseUsagePageText('用量限制\n目前用量\n已使用 0%\n每週上限\n重設時間：12月1日下午1:07\n已使用 12%', now);
  assert.equal(rIdle.session.pct, 0);
  assert.equal(rIdle.session.resetsAt, null);
  assert.equal(rIdle.weekly.pct, 12);

  // English UI
  const rEn = usage.parseUsagePageText(
    'Usage limits PRO\nCurrent usage\n28% used\nResets at 4:30 PM\nWeekly limit\nResets Dec 1, 1:07 PM\n9% used\nUpgrade to AI Ultra',
    now
  );
  assert.equal(rEn.session.pct, 28);
  assert.equal(new Date(rEn.session.resetsAt).getHours(), 16);
  assert.equal(new Date(rEn.session.resetsAt).getMinutes(), 30);
  assert.equal(rEn.weekly.pct, 9);
});
