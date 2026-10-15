// 官方 Chrome Web Store v2 发布客户端。凭证仅在本机读取，不进入插件包。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ITEM_ID = 'dckjdeemcnjccfbinnmncalmoajleboo';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const API = 'https://chromewebstore.googleapis.com';
const CONFIG = path.join(os.homedir(), '.config/xpandmax/cws.json');
const KEY = path.join(os.homedir(), '.config/xpandmax/cws-service-account.json');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export function serviceAssertion(key, now = Math.floor(Date.now() / 1000)) {
  if (key.type !== 'service_account' || !key.client_email || !key.private_key) throw new Error('文件不是 Google 服务账号 JSON 密钥。');
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', typ: 'JWT', ...(key.private_key_id ? { kid: key.private_key_id } : {}) });
  const claim = encode({ iss: key.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const data = `${header}.${claim}`;
  return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), key.private_key).toString('base64url')}`;
}

export function readConfig(filename = process.env.CWS_CONFIG || CONFIG) {
  if (!fs.existsSync(filename)) throw new Error(`尚未配置发布账号。运行 npm run store:configure -- --publisher-id 发布者ID --key-file 服务账号JSON路径`);
  const config = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (!/^[a-zA-Z0-9_-]+$/.test(config.publisherId || '')) throw new Error('publisherId 缺失或格式不正确。');
  if (config.itemId !== ITEM_ID) throw new Error('配置中的插件 ID 与本项目不匹配，已停止。');
  const keyFile = path.resolve(config.keyFile || KEY);
  if (!fs.existsSync(keyFile)) throw new Error(`未找到服务账号密钥：${keyFile}`);
  if (process.platform !== 'win32' && (fs.statSync(keyFile).mode & 0o077)) throw new Error('服务账号密钥权限过宽，请先 chmod 600 密钥文件。');
  return { ...config, keyFile, key: JSON.parse(fs.readFileSync(keyFile, 'utf8')) };
}

export class StoreClient {
  constructor(config, request = fetch) { this.config = config; this.request = request; this.token = null; this.expires = 0; }
  async accessToken() {
    if (this.token && this.expires > Date.now() + 60000) return this.token;
    const assertion = serviceAssertion(this.config.key);
    const response = await this.request('https://oauth2.googleapis.com/token', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error(`Google 身份验证失败 (${response.status} / ${data.error || 'missing_token'})。检查服务账号、API 是否启用，以及商店后台的服务账号绑定。`);
    this.token = data.access_token; this.expires = Date.now() + (Number(data.expires_in) || 3600) * 1000;
    return this.token;
  }
  async call(action, body, media = false) {
    const token = await this.accessToken();
    const name = `publishers/${this.config.publisherId}/items/${ITEM_ID}`;
    const response = await this.request(`${API}${media ? '/upload' : ''}/v2/${name}:${action}`, {
      method: action === 'fetchStatus' ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': media ? 'application/zip' : 'application/json' } : {}) },
      ...(body ? { body: media ? body : JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      const message = String(data.error?.message || response.statusText || 'request_failed').replaceAll(token, '[REDACTED]').slice(0, 2000);
      throw new Error(`Chrome Web Store ${action} 失败 (${response.status}): ${message}`);
    }
    if (data.itemId && data.itemId !== ITEM_ID) throw new Error('服务端返回了其他插件 ID，已停止。');
    return data;
  }
  status() { return this.call('fetchStatus'); }
  upload(file) { return this.call('upload', fs.readFileSync(file), true); }
  publish() { return this.call('publish', { publishType: 'DEFAULT_PUBLISH', skipReview: false, blockOnWarnings: true }); }
  cancel() { return this.call('cancelSubmission', {}); }
}

function versions(revision) { return (revision?.distributionChannels || []).map(x => x.crxVersion); }
export async function submitRelease(client, release, { replacePending = false, wait = pause, onProgress = () => {} } = {}) {
  const before = await client.status();
  if (before.takenDown || before.warned) throw new Error('商店条目有下架或警告状态，请先在后台处理。');
  if (versions(before.publishedItemRevisionStatus).includes(release.version)) return { outcome: 'already_published', version: release.version, before };
  const pending = before.submittedItemRevisionStatus;
  if (['PENDING_REVIEW', 'STAGED'].includes(pending?.state)) {
    if (versions(pending).includes(release.version)) return { outcome: 'already_submitted', version: release.version, before };
    if (!replacePending) throw new Error('已有其他版本待审核。确认替换后加 --replace-pending，程序会取消旧审核并提交本版。');
    onProgress('取消旧版本的待审核提交');
    await client.cancel();
  }
  onProgress(`上传 ${release.version}`);
  const upload = await client.upload(release.file);
  if (upload.crxVersion && upload.crxVersion !== release.version) throw new Error('服务器识别的上传版本与本地版本不同，已停止。');
  let state = upload.uploadState;
  for (let n = 0; state === 'IN_PROGRESS' && n < 24; n++) {
    await wait(5000); state = (await client.status()).lastAsyncUploadState;
  }
  if (state !== 'SUCCEEDED') throw new Error(`上传未确认成功 (${state || 'unknown'})，未提交审核。可用 store:status 检查后重试。`);
  onProgress('提交审核');
  let published;
  try { published = await client.publish(); }
  catch (error) {
    // 提交请求的响应丢失时，先读回状态，避免重复发布。
    const observed = await client.status().catch(() => null);
    if (!versions(observed?.submittedItemRevisionStatus).includes(release.version)) throw error;
    published = { state: observed.submittedItemRevisionStatus.state, recoveredByReadback: true };
  }
  const after = await client.status();
  const current = [after.submittedItemRevisionStatus, after.publishedItemRevisionStatus].find(x => versions(x).includes(release.version));
  if (!current || !['PENDING_REVIEW', 'STAGED', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'].includes(current.state)) {
    throw new Error('已发送提交请求，但读回状态尚未确认本版已提交。请运行 npm run store:status 核对。');
  }
  return { outcome: current.state, version: release.version, sha256: release.sha256, before, upload, published, after };
}

export function packageRelease() {
  execFileSync('python3', ['scripts/package.py', '--store'], { cwd: ROOT, stdio: 'pipe' });
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/manifest.json'))).version;
  const file = path.join(ROOT, `dist/xpandmax-${version}-chrome-web-store.zip`);
  // 打包脚本使用固定白名单；核对压缩包清单及清单版本，而非只信任文件名。
  execFileSync('python3', ['-c', 'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert json.loads(z.read("manifest.json"))["version"]==sys.argv[2]; assert all(not n.startswith(("/",".")) and ".." not in n.split("/") for n in z.namelist())', file, version]);
  return { version, file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
}

function arg(name) { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; }
async function main() {
  const command = process.argv[2];
  if (command === 'configure') {
    const publisherId = arg('--publisher-id'); const source = path.resolve(arg('--key-file') || KEY);
    if (!publisherId || !/^[a-zA-Z0-9_-]+$/.test(publisherId)) throw new Error('请提供 --publisher-id 发布者ID。');
    const key = JSON.parse(fs.readFileSync(source, 'utf8')); serviceAssertion(key);
    fs.mkdirSync(path.dirname(CONFIG), { recursive: true, mode: 0o700 });
    if (source !== KEY) fs.copyFileSync(source, KEY);
    fs.chmodSync(KEY, 0o600);
    fs.writeFileSync(CONFIG, JSON.stringify({ itemId: ITEM_ID, publisherId, keyFile: KEY }, null, 2), { mode: 0o600 });
    console.log(`发布配置已保存到 ${CONFIG}，服务账号 ${key.client_email}。私钥未写入项目。`); return;
  }
  if (!['status', 'submit'].includes(command)) throw new Error('用法：npm run store:configure / store:status / store:submit');
  const client = new StoreClient(readConfig());
  if (command === 'status') { console.log(JSON.stringify(await client.status(), null, 2)); return; }
  const release = packageRelease();
  const result = await submitRelease(client, release, { replacePending: process.argv.includes('--replace-pending'), onProgress: console.log });
  const receipt = path.join(ROOT, 'artifacts/cws-releases', `${new Date().toISOString().replaceAll(':', '-')}-${release.version}.json`);
  fs.mkdirSync(path.dirname(receipt), { recursive: true });
  fs.writeFileSync(receipt, JSON.stringify({ at: new Date().toISOString(), itemId: ITEM_ID, ...result }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ outcome: result.outcome, version: release.version, receipt }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
