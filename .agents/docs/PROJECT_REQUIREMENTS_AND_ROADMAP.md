# 智绘姬 (ST-Chatu8) 实际需求与最新规划文档 (PROJECT_REQUIREMENTS_AND_ROADMAP)

## 1. 概述与核心定位
**智绘姬 (st-chatu8 / ComfyUi-ST)** 是专为 **SillyTavern (酒馆)** 打造的高阶 AI 绘图与角色提示词 (Prompt) 扩展插件。
其核心定位为：将角色设定（Character）、服装样式（Outfit）、通用角色/服装以及 Banana AI 交互逻辑，无缝转化为符合 Stable Diffusion / Flux / Midjourney 等 ComfyUI 绘图标准的提示词，并实现全流程 ComfyUI API 工作流联动。

---

## 2. 已解决核心痛点与底层基础设施 (Current Technical Accomplishments)

### 2.1 提示词注入模板管理系统 (Injection Template Engine)
- **架构**：彻底解耦了角色的外貌、服装、通用列表向 AI 提示词注入时的格式控制。
- **四核心子模板**：
  1. `characterListTemplate`：角色启用列表展开模板
  2. `innerOutfitTemplate`：角色专属服装展开模板
  3. `commonCharacterListTemplate`：通用角色展开模板
  4. `enableOutfitListTemplate`：通用服装展开模板
- **智能消行清洗算法 (`applyInjectionTemplate`)**：
  支持对行内包含的 `{traits}`, `{facial}`, `{upperSFW}` 等占位符进行按行扫描。若某行内所有占位符变量均为空值，则自动丢弃整行，消除遗留冒号或静态标签，保障 Token 效率最大化。

---

## 3. 核心业务需求梳理 (Core Business Requirements)

| 业务模块 | 核心功能需求 | 状态 |
| :--- | :--- | :--- |
| **角色预设管理** | 支持角色中文/英文名、traits、正面/背面五官及 SFW/NSFW 上下半身细致拆解与 Token 实时统计 | 已完成 (稳定) |
| **服装预设管理** | 支持专属服装与通用服装的拆分，上下半身/背面剪裁精细化描述 | 已完成 (稳定) |
| **注入模板系统** | 支持多模板方案切换、新建、另存为、重命名、恢复默认及实时 Preview 渲染 preview | 已完成 (已修复持久化) |
| **Banana / AI 助手** | 支持大模型生成角色提示词、自动翻译与结构化匹配 | 已完成 (迭代中) |
| **ComfyUI 服务联动** | API 状态监控、自定义工作流配置、参数映射与图生图重绘 | 已完成 (迭代中) |

---

## 4. 最新规划与分支管理策略 (Latest Roadmap & Branching Strategy)

### 4.1 分支管理路线图

```
                ┌───> Dev-injectionTemplate (纯洁基线: 指向 b1a5770 原始 2.8.0 节点)
                │
main (生产主分支) ├───> dev (日常开发与集成测试分支)
                │
                └───> feat/injection-templates (注入模板功能隔离开发分支)
```

1. **`main` (生产主分支)**：
   - 包含完整的【动态 `extensionName` 适配】、【注入模板系统】与【持久化全修复】。
   - 所有推送到 `main` 的提交必须通过 `node --check index.js` 语法静态测试。
2. **`Dev-injectionTemplate` (回溯隔离分支)**：
   - 保持 2.8.0 原始干净基线，用于版本回归对比、排查上游变动与独立实验。

---

### 4.2 短期开发规划 (Short-Term Roadmap - Q3 2026)

1. **注入模板体验升级**：
   - [ ] 在注入模板编辑界面引入可视化 Diff 对比弹窗（另存为/更新前对比差异）。
   - [ ] 增加模板占位符语法校验（提示未识别的占位符拼写）。
   - [ ] 提供内置模板方案库：预置 SDXL 高效率卡片、Flux Tag 混排、NovelAI 简易格式一键选定。

2. **配置全量备份与跨环境恢复工具**：
   - [ ] 提供一键打包导出全局所有预设（角色+服装+模板+ComfyUI工作流）为 `.stchatu8.json` 压缩包。
   - [ ] 提供跨扩展名/跨环境的一键检测与修复工具。

3. **ComfyUI 工作流参数映射与 Node 节点智能注入**：
   - [ ] 增强智绘姬生成的 Prompt 向 ComfyUI API 工作流中的指定 Node ID (如 CLIP Text Encode) 动态绑定的准确度。

---

## 5. 本地开发与测试规范 (Verification & Guidelines)

1. **静态代码规范**：
   在提交任何修改前，必须运行终端指令进行 JavaScript 语法检测：
   ```bash
   node --check index.js
   ```
2. **文档维护规范**：
   新增重大功能模块时，必须同步在 `.agents/docs/` 目录下更新或新增对应的 `*SPEC.md` 文件。
