// 回归：一条工作流内部串了生图+生视频时，后端会把两个产物都放进 data（顺序是「首帧图、视频」）。
// 此前 Grok 分支只取 data[0]，表现就是「只显示了图片而不显示视频」——视频被静默丢掉。
// 两段模式下必须优先取视频产物；找不到视频（如四宫格只出图）才退回第一个。
// 直接从 index.js 抽取真正发布的函数运行，与 test-pregen-*.mjs 同一套做法。
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

function extract(signature) {
  const start = src.indexOf(signature);
  if (start === -1) throw new Error(`未在 index.js 中找到 ${signature}`);
  let depth = 0, end = -1;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

const pickGrokMediaItem = new Function(`${extract('function pickGrokMediaItem(')}\nreturn pickGrokMediaItem;`)();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
}

// 后端真实回的形状（对照 data/tasks 里成功的管线任务）：
// images = ['images/<id>/image_00000.png', 'images/<id2>/ComfyUI_ZIP_video_00000.mp4']
const imageProduct = { url: 'http://127.0.0.1:8795/files/abc/image_00000.png', b64_json: 'iVBORw0KGgo=', mime_type: 'image/png' };
const videoProduct = { url: 'http://127.0.0.1:8795/files/def/ComfyUI_ZIP_video_00000.mp4', b64_json: 'AAAAIGZ0eXA=', mime_type: 'video/mp4' };

// 1. 两段模式：有视频就取视频，哪怕它在后面
{
  const item = pickGrokMediaItem([imageProduct, videoProduct], true);
  check('两段模式取视频产物', item === videoProduct, JSON.stringify(item));
}

// 2. mime_type 缺失时按 URL 后缀兜底
{
  const noMime = { url: 'http://127.0.0.1:8795/files/def/video_00000.mp4' };
  const item = pickGrokMediaItem([imageProduct, noMime], true);
  check('mime_type 缺失时按 URL 后缀认视频', item === noMime, JSON.stringify(item));
}

// 3. 只有图（四宫格那种只出图的形态）：退回第一个产物
{
  const grid = { url: 'http://x/four_grid.png', mime_type: 'image/png' };
  const slice = { url: 'http://x/slice_1.png', mime_type: 'image/png' };
  const item = pickGrokMediaItem([grid, slice], true);
  check('没有视频时退回第一个产物', item === grid, JSON.stringify(item));
}

// 4. 没开两段模式：保持老行为，一律 data[0]
{
  const item = pickGrokMediaItem([imageProduct, videoProduct], false);
  check('未开两段模式时仍是 data[0]', item === imageProduct, JSON.stringify(item));
}

// 5. 单产物（普通生图后端）：原样返回
{
  check('单产物原样返回', pickGrokMediaItem([imageProduct], true) === imageProduct);
}

// 6. 畸形输入不能抛：空数组、非数组、混进 null / 字符串
{
  let ok = true;
  try {
    if (pickGrokMediaItem([], true) !== undefined) ok = false;
    if (pickGrokMediaItem(undefined, true) !== undefined) ok = false;
    if (pickGrokMediaItem(null, true) !== undefined) ok = false;
    if (pickGrokMediaItem('nope', true) !== undefined) ok = false;
    if (pickGrokMediaItem([null, 'x', 3], true) !== undefined) ok = false;
    if (pickGrokMediaItem([null, videoProduct], true) !== videoProduct) ok = false;
  } catch (error) {
    ok = false;
    console.error(error);
  }
  check('畸形输入不抛错', ok);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
