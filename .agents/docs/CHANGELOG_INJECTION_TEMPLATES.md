# 角色提示词注入模板自定义管理系统 - 版本变更日志

## 📌 版本号：v2.9.0 (单次发布更新)
- **模块名称**：角色与服装系统 - 提示词注入模板管理 (Injection Template Management System)
- **更新日期**：2026-08-01
- **分支发布**：`main` (Commit: `df590fc` 原生覆盖)

---

## 🚀 核心架构与新特性全景 (Features & Architecture)

### 1. 注入模板方案 (Preset) 完整 CRUD 生命周期管理
- 支持在前端界面中独立创建、重命名、修改保存、另存为、删除注入模板方案。
- 支持恢复至系统默认方案，以及单个 Preset 的 **JSON 导入/导出与格式校验**。

### 2. 四大内置高效预设模板
- **高 Token 效率 - 节点识别格式 (默认推荐)**：采用 XML 标签节点 (`<character>`, `<common_outfit>`) 包裹，极佳适配 Claude 3.5 / DeepSeek R1 / GPT-4o 识别。
- **原版带分割线格式 (完整 13 字段)**：保留传统完整中文分割标注，兼容老用户使用习惯。
- **Markdown 极简卡片格式**：采用标准 Markdown 列表与卡片排版。
- **Danbooru Tag 纯英高密格式**：极致压缩 Token，专门针对 AI 绘图与写实生图提示词引擎。

### 3. 光标感知与占位符变量快捷插入
- 前端能自动记忆用户最后点击/焦点的模板文本框。
- 提供结构化下拉选单，一键将 `{nameCN}`, `{traits}`, `{facial}`, `{outfits}` 等变量插入到光标所在定位处。

### 4. 智能解耦渲染引擎与全自动空行清洗
- 底层重构 `generateCharacterListText` / `generateOutfitEnableListText` / `generateCommonCharacterListText`，由静态模板拼接升级为 `applyInjectionTemplate` 动态注入。
- **关键突破**：新增**占位符全空整行自动清洗算法**。当某行中的所有 `{var}` 变量值均为空时，引擎会自动丢弃该行及前缀静态标签，彻底杜绝无用 Token 浪费。

### 5. 主题感知的实时展开效果预览与防缓存机制
- 提供 Mock 数据一键渲染预览，预览框完全继承 SillyTavern UI 主题字体与颜色变量 (`--SmartThemeBodyColor`)。
- 在 `loadAllTabsContent` 中集成时间戳参数 `?_v=${Date.now()}`，保证插件更新后无需手动清除浏览器缓存即时刷新生效。
