const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

for (const provider of ['custom', 'google', 'gemini', 'anthropic']) test(`${provider} translates without browser models and preserves handles`, async () => {
  const dom = new JSDOM('', { url: 'https://x.com/', runScripts: 'outside-only' });
  const w = dom.window;
  const calls = [];
  w.chrome = {
    runtime: { sendMessage: async message => {
      if (message.type === 'translation-status') return { provider };
      calls.push(message);
      return { text: '为创作者开发工具 ⟦XP0⟧' };
    } },
    storage: { onChanged: { addListener() {} } }
  };
  try {
    w.eval(fs.readFileSync('extension/translation.js', 'utf8'));
    await new Promise(resolve => setTimeout(resolve, 0));
    w.xpandmaxTranslations.request('Building tools for creators @Example');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(w.xpandmaxTranslations.inspect('Building tools for creators @Example')?.text, '为创作者开发工具 @Example');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, 'translate-bio');
    assert.equal(calls[0].text, 'Building tools for creators ⟦XP0⟧');
  } finally { w.close(); }
});

test('switching to API escapes hung local model jobs and ignores their late results', async () => {
  const dom = new JSDOM('', { url: 'https://x.com/', runScripts: 'outside-only' });
  const w = dom.window;
  let provider = 'local', changed;
  let finishLocal;
  const calls = [];
  w.LanguageDetector = { create: async () => ({ detect: async () => [{ detectedLanguage: 'en' }] }) };
  w.Translator = { create: () => new Promise(resolve => { finishLocal = resolve; }) };
  w.chrome = {
    runtime: { sendMessage: async message => {
      if (message.type === 'translation-status') return { provider };
      calls.push(message);
      return { text: '新接口译文' };
    } },
    storage: { onChanged: { addListener: listener => { changed = listener; } } }
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    w.eval(fs.readFileSync('extension/translation.js', 'utf8'));
    await tick();
    w.xpandmaxTranslations.request('First bio');
    w.xpandmaxTranslations.request('Second bio');
    await tick();
    provider = 'custom';
    changed({ translationConfig: {} }, 'local');
    await tick();
    w.xpandmaxTranslations.request('First bio');
    await tick();
    assert.equal(calls.length, 1);
    assert.equal(w.xpandmaxTranslations.inspect('First bio').text, '新接口译文');
    finishLocal({ translate: async () => '旧译文' });
    await tick();
    assert.equal(w.xpandmaxTranslations.inspect('First bio').text, '新接口译文');
  } finally { w.close(); }
});
