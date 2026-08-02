# 提示词注入模板自定义管理系统 - 设计与架构规范 (INJECTION_TEMPLATE_SPEC)

## 1. 概述与设计目标
本系统旨在解耦 SillyTavern 插件在将角色设定（Character）、服装设定（Outfit）、通用角色（Common Character）及通用服装（Enable Outfit）注入 AI 提示词（Prompt）时的格式控制。用户可通过自定义模板方案，自由控制 Token 密度、节点包装、Markdown 格式或 Danbooru Tag 结构。

---

## 2. 关键架构改动与数据结构

### 2.1 模板 Preset 数据存储结构
每个模板方案包含 4 个核心子模板字段：
```json
{
  "injectionTemplates": {
    "currentPresetId": "默认方案",
    "presets": {
      "默认方案": {
        "characterListTemplate": "<character id=\"{nameEN}\" cn=\"{nameCN}\">\n  [Traits] {traits}\n  [Face] Front: {facial} | Back: {facialBack}\n  [Body-SFW] Front: {upperSFW}, {lowerSFW} | Back: {upperSFWBack}, {lowerSFWBack}\n  [Body-NSFW] Front: {upperNSFW}, {lowerNSFW} | Back: {upperNSFWBack}, {lowerNSFWBack}\n  [Outfits]\n{outfits}\n</character>",
        "innerOutfitTemplate": "  <outfit name=\"{nameEN}\" cn=\"{nameCN}\">\n    [Upper] Front: {upperBody} | Back: {upperBodyBack}\n    [Full] Front: {fullBody} | Back: {fullBodyBack}\n  </outfit>",
        "commonCharacterListTemplate": "<common_character id=\"{nameEN}\" cn=\"{nameCN}\" />",
        "enableOutfitListTemplate": "<common_outfit id=\"{nameEN}\" cn=\"{nameCN}\">\n  [Upper] Front: {upperBody} | Back: {upperBodyBack}\n  [Full] Front: {fullBody} | Back: {fullBodyBack}\n</common_outfit>"
      }
    }
  }
}
```

### 2.2 占位符变量汇总表

| 占位符 | 作用作用域 | 字段含义说明 |
| :--- | :--- | :--- |
| `{nameCN}` | 角色 / 服装 | 中文名称 |
| `{nameEN}` | 角色 / 服装 | 英文名称标识符 (默认自动截取首段) |
| `{traits}` | 角色 | 角色特征 (Tag / 作品来源 / 年龄等) |
| `{facial}` | 角色 | 正面面部五官特征 |
| `{facialBack}` | 角色 | 背面发型/辫子等特征 |
| `{upperSFW}` | 角色 | 上半身 SFW 正面特征 |
| `{upperSFWBack}` | 角色 | 上半身 SFW 背面特征 |
| `{lowerSFW}` | 角色 | 下半身 SFW 正面特征 |
| `{lowerSFWBack}` | 角色 | 下半身 SFW 背面特征 |
| `{upperNSFW}` | 角色 | 上半身 NSFW 解剖细节 |
| `{upperNSFWBack}` | 角色 | 上半身 NSFW 背面细节 |
| `{lowerNSFW}` | 角色 | 下半身 NSFW 正面标签 |
| `{lowerNSFWBack}` | 角色 | 下半身 NSFW 背面标签 |
| `{outfits}` | 角色 | 角色内部启用的服装展开缩进点 |
| `{upperBody}` | 服装 | 上半身服装款式/领口/材质 |
| `{upperBodyBack}` | 服装 | 上半身服装背面结构 |
| `{fullBody}` | 服装 | 下半身服装/鞋袜配饰 |
| `{fullBodyBack}` | 服装 | 下半身服装背面剪裁 |

---

## 3. 核心机制算法

### 3.1 空字段整行自动清洗机制 (`applyInjectionTemplate`)
在将数据注入模板时，为避免因可选字段为空而产生遗留静态标签（如 `[Traits] `）造成 Token 浪费，引擎实现了行级校验：
1. 提取当前行中的所有 `{var}` 占位符。
2. 逐一检查占位符对应的变量值。
3. **若当前行中包含的所有占位符变量均为空值**，则自动放弃该整行输出。
4. **若至少包含一个非空变量**，则进行替换并保留行排版。

```javascript
function applyInjectionTemplate(template, data) {
  if (!template) return "";
  const lines = template.split("\n");
  const resultLines = [];

  for (let line of lines) {
    const placeholders = line.match(/\{[a-zA-Z0-9_$]+\}/g);
    if (placeholders && placeholders.length > 0) {
      let hasValue = false;
      for (const ph of placeholders) {
        const key = ph.slice(1, -1);
        const val = data[key] !== void 0 && data[key] !== null ? String(data[key]).trim() : "";
        if (val !== "") hasValue = true;
        line = line.split(ph).join(val);
      }
      if (!hasValue) continue; // 整行占位符全空，整行丢弃
    }
    if (!line.match(/^[\s\uFF1A:]*$/)) {
      resultLines.push(line);
    }
  }
  return resultLines.join("\n");
}
```

### 3.2 设置访问规则
使用 `getCharacterSettingsRoot()` 统一定位设置对象，直接通过标准原生 `extensionName` 访问设置根节点：

```javascript
function getCharacterSettingsRoot() {
  if (typeof extension_settings31 !== "undefined" && extension_settings31[extensionName]) {
    return extension_settings31[extensionName];
  }
  if (typeof extension_settings !== "undefined" && extension_settings[extensionName]) {
    return extension_settings[extensionName];
  }
  return null;
}
```

---

## 4. 最新分支与开发规范

1. **`main` 分支**：集成动态路径推断、模板管理引擎与持久化全修补的最新稳定分支。
2. **`Dev-injectionTemplate` 分支**：保持上游 2.8.0 `b1a5770` 原始纯洁基线，用于对比与回溯。

