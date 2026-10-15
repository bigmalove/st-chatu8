// 诊断脚本（不参与回归门禁）：还原「进聊天 → 补渲染历史视频」的真实时序，
// 抓一个现有测试漏掉的瞬态：所有历史视频在可见性观察器第一次回调之前就被 play() 了一把。
// 注意：这里刻意把 videoAutoplay 设为 'true'，考察的是「开启自动播放」这一档的竞态窗口；
// 默认档（关闭自动播放）下视频根本不自动播，见 test-video-perf-browser.mjs 第 5 段。
// 用法：node test/diag-video-hydrate-burst.mjs
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = [
  process.env.CHROME,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => p && existsSync(p));
if (!CHROME) throw new Error('找不到 Chrome，请用 CHROME 环境变量指定');

const src = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
function extract(signature) {
  const start = src.indexOf(signature);
  if (start === -1) throw new Error(`未在 index.js 中找到 ${signature}`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`未能定界 ${signature}`);
}
function extractVar(name) {
  const m = new RegExp(`^var ${name} = .*;$`, 'm').exec(src);
  if (!m) throw new Error(`未在 index.js 中找到 var ${name}`);
  return m[0];
}
const realCode = [
  extractVar('chatVideoObservers'),
  extractVar('chatVideoBlobUrls'),
  extractVar('chatVideoSweepTimer'),
  extractVar('CHAT_VIDEO_SWEEP_INTERVAL_MS'),
  extractVar('CHAT_VIDEO_BLOB_RELEASE_MS'),
  extract('function blobToBase64('),
  extract('async function _dataUrlToBlob('),
  extract('function _addToStcoOffsets('),
  extract('async function fixMp4Faststart('),
  extract('function getChatVideoObserver('),
  extract('function isChatVideoAutoplayOn('),
  extract('function playChatVideoIfAllowed('),
  extract('function pauseChatVideoOffscreen('),
  extract('function setupChatVideoPlayback('),
  extract('function trackChatVideoBlobUrl('),
  extract('function createAndShowImage('),
].join('\n');

// 真实时序：hydrateMissingMedia 逐条 await 读库，createAndShowImage 里的转码是 fire-and-forget。
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>
body{margin:0}
#chat{height:100vh;overflow-y:auto;padding:0}
.mes{height:520px;border-bottom:1px solid #ccc;box-sizing:border-box}
.mes video{width:320px;height:180px}
</style>
</head><body><div id="chat"></div><pre id="result">PENDING</pre>
<script>
var extensionName = 'st-chatu8';
var extension_settings40 = { 'st-chatu8': { dbclike: 'false', clickToPreview: 'false', longPressToEdit: 'false', collapseImage: 'false', videoAutoplay: 'true' } };
var _showImagePreview = null;
function showEditDialog() {}
function addSmoothShakeEffect() {}
function triggerGeneration() {}
${realCode}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function startJankMeter() {
  let last = performance.now(), max = 0;
  const id = setInterval(() => { const now = performance.now(); max = Math.max(max, now - last); last = now; }, 16);
  return () => { clearInterval(id); return Math.round(Math.max(max, performance.now() - last)); };
}
async function recordTestVideo() {
  const canvas = document.createElement('canvas');
  canvas.width = 160; canvas.height = 90;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(30);
  const mime = ['video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  let frame = 0;
  const timer = setInterval(() => { ctx.fillStyle = 'hsl(' + (frame++ * 12) + ',80%,50%)'; ctx.fillRect(0, 0, 160, 90); }, 33);
  rec.start(100);
  await sleep(1500);
  rec.stop();
  await new Promise((r) => { rec.onstop = r; });
  clearInterval(timer);
  return new Blob(chunks, { type: 'video/webm' });
}
const FLOORS = 12;
const chat = document.getElementById('chat');
const floors = [];
function buildFloor(i) {
  const f = document.createElement('div');
  f.className = 'mes';
  const btn = document.createElement('button');
  btn.className = 'image-tag-button';
  f.appendChild(btn);
  const span = document.createElement('span');
  span.className = 'st-chatu8-image-span';
  span.dataset.requestId = 'req-' + i;
  f.appendChild(span);
  chat.appendChild(f);
  return { floor: f, span, btn };
}
async function run() {
  const out = {};
  try {
    const blob = await recordTestVideo();
    const dataUrl = await blobToBase64(blob);
    out.videoBytes = blob.size;
    for (let i = 0; i < FLOORS; i++) floors.push(buildFloor(i));
    // 进入聊天：列表滚到底部（只有最后一屏可见），随后补渲染
    chat.scrollTop = chat.scrollHeight;
    await sleep(120);

    // 记录每个视频的 play/pause 事件
    const log = [];
    const t0 = performance.now();
    const t = () => Math.round(performance.now() - t0);
    const sampled = [];
    const stopJank = startJankMeter();
    const sampleTimer = setInterval(() => {
      const playing = floors
        .map((f, i) => (f.span.querySelector('video') && !f.span.querySelector('video').paused ? i : -1))
        .filter((i) => i >= 0);
      sampled.push({ t: t(), playing });
    }, 5);

    // 模仿 hydrateMissingMedia：逐条 await 读库 + createAndShowImage
    for (let i = 0; i < floors.length; i++) {
      const v = document.createElement('video');
      log.push({ i, t: t(), e: 'create' });
      await sleep(2); // 模拟 getItemImg 的 IDB 往返
      createAndShowImage(floors[i].span, dataUrl, 'x', floors[i].btn, '', true, '');
      const vv = floors[i].span.querySelector('video');
      vv.addEventListener('play', () => log.push({ i, t: t(), e: 'play', visible: vv._chatu8Visible }));
      vv.addEventListener('pause', () => log.push({ i, t: t(), e: 'pause' }));
    }
    const hydrateDone = t();
    await sleep(1500);
    const jank = stopJank();
    clearInterval(sampleTimer);

    let maxPlaying = 0, maxAt = 0;
    for (const s of sampled) if (s.playing.length > maxPlaying) { maxPlaying = s.playing.length; maxAt = s.t; }
    const burstWindow = sampled.filter((s) => s.playing.length > 1);
    const settled = floors.map((f, i) => { const v = f.span.querySelector('video'); return v && !v.paused ? i : -1; }).filter((i) => i >= 0);
    const everPlayed = [...new Set(log.filter((e) => e.e === 'play').map((e) => e.i))].sort((a, b) => a - b);
    const visibleNow = (() => {
      const r = chat.getBoundingClientRect();
      return floors.map((f, i) => {
        const rr = f.floor.getBoundingClientRect();
        return rr.bottom > r.top && rr.top < r.bottom ? i : -1;
      }).filter((i) => i >= 0);
    })();
    out.hydrateDoneMs = hydrateDone;
    out.jankMs = jank;
    out.maxPlaying = maxPlaying;
    out.maxPlayingAtMs = maxAt;
    out.burstSamples = burstWindow.length;
    out.burstFirst = burstWindow[0] || null;
    out.burstLast = burstWindow[burstWindow.length - 1] || null;
    out.everPlayed = everPlayed;
    out.settled = settled;
    out.visibleFloors = visibleNow;
    out.eventLog = log;
    out.result = 'OK';
  } catch (e) {
    out.result = 'ERR';
    out.error = (e && e.stack) || String(e);
  }
  document.getElementById('result').textContent = JSON.stringify(out);
  try { await fetch('/result', { method: 'POST', body: JSON.stringify(out) }); } catch (e) {}
}
run();
</script></body></html>`;

let resolveResult;
const resultPromise = new Promise((r) => { resolveResult = r; });
const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/result') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(204).end();
      try { resolveResult(JSON.parse(body)); } catch (e) { resolveResult({ result: 'ERR', error: '结果解析失败: ' + body.slice(0, 300) }); }
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const profile = mkdtempSync(join(tmpdir(), 'chatu8-video-burst-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--window-size=800,600', '--disable-dev-shm-usage',
  ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []),
  `--user-data-dir=${profile}`, `http://127.0.0.1:${port}/`,
], { stdio: 'inherit' });

const result = await Promise.race([resultPromise, new Promise((r) => setTimeout(() => r(null), 120000))]);
chrome.kill();
server.close();
try { rmSync(profile, { recursive: true, force: true }); } catch (e) {}

if (!result) { console.log('FAIL  浏览器在 120 秒内没有回报结果'); process.exit(1); }
console.log(JSON.stringify(result, null, 2));
process.exit(result.result === 'OK' ? 0 : 1);
