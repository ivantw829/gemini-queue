/*
 * 自動重設的模型設定：設定值驗證，以及 SW 記錄 content 回報的切換結果。
 * 實際操作模型選單的部分在 test/harness/index.html（需要 DOM）。
 *
 *   node --test test/
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEnv } = require('./helpers/sw-env');

test('settings: auto reset model defaults to hydrogen / low and rejects unknown values', () => {
  const env = createEnv();
  const S = env.ctx.GQ.settings;
  const d = S.normalize({});
  assert.equal(d.autoResetModel, 'hydrogen');
  assert.equal(d.autoResetEffort, 'low');
  const bad = S.normalize({ autoResetModel: 'flash-lite', autoResetEffort: 'ultra' });
  assert.equal(bad.autoResetModel, 'hydrogen');
  assert.equal(bad.autoResetEffort, 'low');
  const ok = S.normalize({ autoResetModel: 'neon', autoResetEffort: 'medium' });
  assert.equal(ok.autoResetModel, 'neon');
  assert.equal(ok.autoResetEffort, 'medium');
});

test('KEEPALIVE_MODEL_RESULT stores lastModelSwitch without touching other keepalive state', async () => {
  const env = createEnv();
  await env.settle();
  env.store.keepalive = { conversationUrl: 'https://gemini.google.com/app/k', failCount: 1, lastSentAt: 5 };
  const res = await env.send({
    type: env.MSG.KEEPALIVE_MODEL_RESULT,
    ok: false,
    reason: 'model-locked',
    model: 'Hydrogen'
  });
  assert.equal(res.ok, true);
  const st = env.store.keepalive;
  assert.equal(st.conversationUrl, 'https://gemini.google.com/app/k');
  assert.equal(st.failCount, 1);
  assert.equal(st.lastModelSwitch.ok, false);
  assert.equal(st.lastModelSwitch.reason, 'model-locked');
  assert.equal(st.lastModelSwitch.model, 'Hydrogen');
  assert.equal(typeof st.lastModelSwitch.at, 'number');
});
