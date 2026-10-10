// 回归：正文里只写一段 video###……###（纯视频生成）时必须被识别成一个生成段。
// 此前视频段只在「两段提示词」开关打开时才扫描，且配不上生图段的那些会被从正文里默默抹掉、
// 什么也不生成——纯视频工作流等于白写。
// 现在的约定：视频标记一律扫描；开关只管「要不要按配对语义把两段合成一次请求」；
// 配不上的视频段升级成它自己的生成段。直接从 index.js 抽取真正发布的函数运行。
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

const resolveVideoSegments = new Function(`${extract('function resolveVideoSegments(')}\nreturn resolveVideoSegments;`)();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
}

// 与 findAndReplaceInElement 里构造出来的形状一致
const imageMatch = (content, startIndex, ordinal = 0) => ({ fullMatch: `image###${content}###`, content, startIndex, endIndex: startIndex + content.length, isPatternMatch: true, ordinal });
const videoMatch = (content, startIndex) => ({ fullMatch: `video###${content}###`, content, startIndex, endIndex: startIndex + content.length, isVideoPairTag: true });

// 1. 两段开关打开、图文各一段：配对上，生图段不额外多出生成段
{
  const images = [imageMatch('海边旅馆午后', 0)];
  const videos = [videoMatch('镜头缓慢推近', 20)];
  const paired = resolveVideoSegments(images, videos, true);
  check('配对：视频段挂到生图段上', images[0].pairedVideoPrompt === '镜头缓慢推近');
  check('配对：配对上的返回给调用方', paired.length === 1 && paired[0].content === '镜头缓慢推近');
  check('配对：不额外多出生成段', images.length === 1 && !images[0].isSoloVideoSegment);
}

// 2. 两段开关打开，但这一条只写了 video 段 → 它自己成为一个生成段
{
  const images = [];
  const videos = [videoMatch('镜头缓慢推近，人物轻微晃动', 0)];
  resolveVideoSegments(images, videos, true);
  check('只有 video 段：升成生成段', images.length === 1);
  check('只有 video 段：不再当成配对段', images[0].isVideoPairTag === false);
  check('只有 video 段：打上单段标记', images[0].isSoloVideoSegment === true);
  check('只有 video 段：内容原样可用作 prompt', images[0].content === '镜头缓慢推近，人物轻微晃动');
  check('只有 video 段：编号从 0 起', images[0].ordinal === 0);
}

// 3. 图文各一段 + 多出一个 video 段：前一个配对，多出来的单独成段
{
  const images = [imageMatch('A', 0)];
  const videos = [videoMatch('V1', 10), videoMatch('V2', 30)];
  const paired = resolveVideoSegments(images, videos, true);
  check('多出的 video 段：配对仍是一对一', paired.length === 1 && paired[0].content === 'V1');
  check('多出的 video 段：多出来的单独成段', images.length === 2 && images[1].isSoloVideoSegment === true && images[1].content === 'V2');
  check('多出的 video 段：编号接在生图段后', images[1].ordinal === 1);
}

// 4. 开关没开：视频段不参与配对，全部各自成段
{
  const images = [imageMatch('A', 0)];
  const videos = [videoMatch('V1', 10)];
  const paired = resolveVideoSegments(images, videos, false);
  check('开关没开：不做配对', paired.length === 0 && images[0].pairedVideoPrompt === '');
  check('开关没开：视频段仍然成为生成段', images.length === 2 && images[1].content === 'V1' && images[1].isSoloVideoSegment === true);
}

// 5. 开关没开、正文只有 video 段（纯视频工作流的主场景）
{
  const images = [];
  const videos = [videoMatch('慢推到特写', 0)];
  resolveVideoSegments(images, videos, false);
  check('开机没开 + 只有 video 段：照样成段', images.length === 1 && images[0].content === '慢推到特写');
}

// 6. 多个单段视频：编号递增，且不与生图段的编号撞车
//    生图段 2 个（编号 0/1）+ 视频段 4 个 → 前 2 个配对，后 2 个各自成段，编号 2/3
{
  const images = [imageMatch('A', 0, 0), imageMatch('B', 40, 1)];
  const videos = [videoMatch('V1', 80), videoMatch('V2', 120), videoMatch('V3', 160), videoMatch('V4', 200)];
  resolveVideoSegments(images, videos, true);
  check('编号不撞车：生图段仍是 0/1', images[0].ordinal === 0 && images[1].ordinal === 1);
  check('编号不撞车：单段视频接着 2/3', images.length === 4 && images[2].ordinal === 2 && images[3].ordinal === 3);
  check('编号不撞车：单段视频内容对得上', images[2].content === 'V3' && images[3].content === 'V4');
}

// 7. 畸形输入不抛
{
  let ok = true;
  try {
    resolveVideoSegments([], [], true);
    resolveVideoSegments([], [], false);
  } catch (error) {
    ok = false;
    console.error(error);
  }
  check('空输入不抛错', ok);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
