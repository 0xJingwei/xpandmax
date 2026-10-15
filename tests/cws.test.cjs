const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const clientModule = import('../scripts/cws.mjs');

test('服务账号签名只申请商店作用域，使用短期令牌且不发送私钥', async () => {
  const { serviceAssertion, StoreClient, ITEM_ID } = await clientModule;
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { type: 'service_account', client_email: 'publisher@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const assertion = serviceAssertion(key, 1000);
  const [header, claim, signature] = assertion.split('.');
  assert.equal(crypto.verify('RSA-SHA256', Buffer.from(`${header}.${claim}`), publicKey, Buffer.from(signature, 'base64url')), true);
  const data = JSON.parse(Buffer.from(claim, 'base64url'));
  assert.equal(data.scope, 'https://www.googleapis.com/auth/chromewebstore');
  assert.equal(data.exp - data.iat, 3600);
  const calls = [];
  const client = new StoreClient({ publisherId: 'publisher_1', key }, async (url, options) => {
    calls.push([url, options]);
    return { ok: true, json: async () => url.includes('oauth2') ? { access_token: 'private-token', expires_in: 3600 } : { itemId: ITEM_ID } };
  });
  await client.status(); await client.status();
  assert.equal(calls.length, 3);
  assert.equal(calls[0][1].body.has('assertion'), true);
  assert.equal(calls[0][1].body.toString().includes('PRIVATE'), false);
  assert.equal(calls[1][0], `https://chromewebstore.googleapis.com/v2/publishers/publisher_1/items/${ITEM_ID}:fetchStatus`);
  assert.equal(calls[1][1].redirect, 'error');
});

test('提交前上传成功，提交后读回相同版本的待审核状态', async () => {
  const { submitRelease } = await clientModule;
  const calls = [];
  let submitted = false;
  const client = {
    status: async () => { calls.push('status'); return submitted ? { submittedItemRevisionStatus: { state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '0.9.2' }] } } : {}; },
    upload: async () => { calls.push('upload'); return { uploadState: 'SUCCEEDED', crxVersion: '0.9.2' }; },
    publish: async () => { calls.push('publish'); submitted = true; return { state: 'PENDING_REVIEW' }; }
  };
  const result = await submitRelease(client, { version: '0.9.2', file: 'fixture.zip', sha256: 'hash' });
  assert.equal(result.outcome, 'PENDING_REVIEW');
  assert.deepEqual(calls, ['status', 'upload', 'publish', 'status']);
});

test('同版待审核时不重复上传，替换旧审核需要显式参数', async () => {
  const { submitRelease } = await clientModule;
  const client = { status: async () => ({ submittedItemRevisionStatus: { state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '0.9.2' }] } }) };
  assert.equal((await submitRelease(client, { version: '0.9.2' })).outcome, 'already_submitted');
  await assert.rejects(submitRelease(client, { version: '0.9.3' }), /--replace-pending/);
});

test('上传失败、版本错配或发布校验失败时不报告送审成功', async () => {
  const { submitRelease } = await clientModule;
  let published = 0;
  for (const upload of [{ uploadState: 'FAILED' }, { uploadState: 'SUCCEEDED', crxVersion: 'wrong' }]) {
    await assert.rejects(submitRelease({ status: async () => ({}), upload: async () => upload, publish: async () => { published++; } }, { version: '0.9.2' }));
  }
  assert.equal(published, 0);
  await assert.rejects(submitRelease({ status: async () => ({}), upload: async () => ({ uploadState: 'SUCCEEDED' }), publish: async () => { throw new Error('需要填写 storage 权限理由'); } }, { version: '0.9.2' }), /storage/);
});

test('异步上传必须成功后才提交，响应丢失通过读回恢复', async () => {
  const { submitRelease } = await clientModule;
  let calls = 0;
  const state = { submittedItemRevisionStatus: { state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '0.9.2' }] } };
  const client = {
    status: async () => { calls++; return calls === 1 ? {} : calls === 2 ? { lastAsyncUploadState: 'SUCCEEDED' } : state; },
    upload: async () => ({ uploadState: 'IN_PROGRESS' }),
    publish: async () => { throw new Error('timeout'); }
  };
  const result = await submitRelease(client, { version: '0.9.2' }, { wait: async () => {} });
  assert.equal(result.outcome, 'PENDING_REVIEW');
  assert.equal(result.published.recoveredByReadback, true);
});
