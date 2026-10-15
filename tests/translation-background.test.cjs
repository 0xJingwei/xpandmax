const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const config = { provider: 'custom', endpoint: 'https://api.example/v1/chat/completions', model: 'example', apiKey: 'synthetic-key' };
const popup = { id: 'test', url: 'chrome-extension://test/translation-options.html' };
const page = { id: 'test', url: 'https://x.com/home', tab: { id: 1 }, frameId: 0 };
function setup({ saved = config, allowed = true, fetcher, schedule = setTimeout } = {}) {
  let listener;
  let state = saved;
  const requests = [];
  const chrome = {
    runtime: { id: 'test', getURL: path => `chrome-extension://test/${path}`, onMessage: { addListener: fn => { listener = fn; } } },
    storage: { local: {
      get: async () => ({ translationConfig: state }),
      set: async values => { state = values.translationConfig; }
    } },
    permissions: { contains: async () => allowed }
  };
  vm.runInNewContext(fs.readFileSync('extension/translation-background.js', 'utf8'), {
    chrome, URL, AbortController, TextDecoder, setTimeout: schedule, clearTimeout,
    fetch: async (...args) => {
      requests.push(args);
      return fetcher ? fetcher(...args) : new Response(JSON.stringify({ choices: [{ message: { content: '开发工具' } }] }));
    }
  });
  const send = (message, sender = page) => new Promise(resolve => {
    if (listener(message, sender, resolve) !== true) resolve(undefined);
  });
  return { send, requests };
}

test('API request uses saved endpoint and key only in background', async () => {
  const { send, requests } = setup();
  const result = await send({ type: 'translate-bio', text: 'Building tools' });
  assert.equal(result.text, '开发工具');
  assert.equal(requests[0][0], config.endpoint);
  assert.equal(requests[0][1].headers.Authorization, 'Bearer synthetic-key');
  assert.equal(requests[0][1].credentials, 'omit');
  assert.equal(requests[0][1].redirect, 'error');
  assert.equal(JSON.parse(requests[0][1].body).messages[1].content, 'Building tools');
  assert.deepEqual(JSON.parse(JSON.stringify(await send({ type: 'translation-status' }))), { provider: 'custom' });
  assert.equal(await send({ type: 'translation-config' }), undefined);
});

test('denied permission, disabled provider and untrusted senders never call fetch', async () => {
  for (const options of [{ allowed: false }, { saved: { provider: 'local' } }]) {
    const { send, requests } = setup(options);
    assert.ok((await send({ type: 'translate-bio', text: 'Building tools' })).error);
    assert.equal(requests.length, 0);
  }
  const { send, requests } = setup();
  assert.equal(await send({ type: 'translate-bio', text: 'Building tools' }, { ...page, url: 'https://evil.example/' }), undefined);
  assert.equal(await send({ type: 'translation-save', config }, page), undefined);
  assert.equal(requests.length, 0);
});

test('HTTP errors and malformed responses are sanitized', async () => {
  for (const response of [new Response('synthetic-key', { status: 401 }), new Response('secret', { status: 429 }), new Response('{}'), new Response('<html>secret</html>'), new Response('x'.repeat(65537))]) {
    const { send } = setup({ fetcher: () => response });
    const result = await send({ type: 'translate-bio', text: 'Building tools' });
    assert.equal(typeof result.error, 'string');
    assert.doesNotMatch(result.error, /synthetic-key|secret|<html>/);
  }
});

test('a stalled provider times out, and retries remain a user action', async () => {
  const { send, requests } = setup({
    schedule: callback => setTimeout(callback, 1),
    fetcher: (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('synthetic network error')));
    })
  });
  const result = await send({ type: 'translate-bio', text: 'Building tools' });
  assert.match(result.error, /超时/);
  assert.equal(requests.length, 1);
});

test('background bounds concurrent requests and rejects oversized bios', async () => {
  const pending = [];
  const { send, requests } = setup({ fetcher: () => new Promise(resolve => pending.push(resolve)) });
  const first = send({ type: 'translate-bio', text: 'First' });
  const second = send({ type: 'translate-bio', text: 'Second' });
  const third = await send({ type: 'translate-bio', text: 'Third' });
  assert.match(third.error, /较多/);
  assert.ok((await send({ type: 'translate-bio', text: 'x'.repeat(6001) })).error);
  assert.equal(requests.length, 2);
  pending.forEach(resolve => resolve(new Response(JSON.stringify({ choices: [{ message: { content: '译文' } }] }))));
  assert.equal((await first).text, '译文');
  assert.equal((await second).text, '译文');
});

test('settings reject unsafe URLs and test only uses a fixed synthetic sentence', async () => {
  const { send, requests } = setup();
  for (const endpoint of ['http://api.example/v1', 'https://user:pass@api.example/v1', 'https://api.example/v1?key=secret']) {
    assert.ok((await send({ type: 'translation-save', config: { ...config, endpoint } }, popup)).error);
  }
  assert.equal((await send({ type: 'translation-test', text: 'private data' }, popup)).text, '开发工具');
  assert.equal(JSON.parse(requests[0][1].body).messages[1].content, 'I build useful tools.');
});
