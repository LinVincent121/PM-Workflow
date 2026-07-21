# HANDOFF — PM Workflow Assistant

> 2026-07-21 · 项目清理 + Precision Instrument UI 重设计 + 编辑器交互增强

---

## 项目概览

**名称**：PM Workflow Assistant（PM 工作流助手）
**仓库**：`https://github.com/LinVincent121/PM-Workflow`
**路径**：`d:/Desktop/pm-skills-2`（注意：代码已搬至根目录 `src/`，不再是 `pm-workflow-assistant/` 子目录）
**技术栈**：Next.js 14 App Router + better-sqlite3 + Tailwind CSS + 自定义 Markdown 渲染器 + SSE 流式 + Inter / JetBrains Mono 字体
**启动**：`npm run dev`（需配 `.env` 文件，端口 3000）

## 已完成功能

### 项目结构清理
- 移除了孤儿 `pm-workflow-assistant/` gitlink（旧 submodule 残留），代码已全部迁至根目录 `src/`
- 修正 `skill-loader.ts` 和 `skills/list/route.ts` 中 `SKILLS_ROOT` 路径：从 `../pm-skills` → `pm-skills`
- `.gitignore` 已排除 `.env`、`pm-workflow-assistant/`

### Precision Instrument UI 重设计（commit a75aa86 + cd78022）
- 颜色系统：暖纸色系 → 冷白 `#FAFBFD` + 电气蓝 `#2563EB` accent
- 字体：Newsreader 衬线 → Inter（UI）+ JetBrains Mono（数据标签）
- 卡片：去 emoji 图标 → 纯文字标签，hover 顶部蓝色指示条
- 全部页面中文化：工作流、技能库、工作产出、模型设置
- 侧边栏：inline SVG 图标（新建/工作流/技能库/工作产出/设置）

### 编辑器 + 审查系统重写（8 个 commit）
- **50/50 分屏**：对话区域和编辑区域各占 50%（排除侧边栏宽度）
- **AI 审查毛玻璃遮罩**：审查中显示 blur 遮罩 + spinner
- **审查结果结构化**：总结/优点/待改进/建议 四色卡片 + 上下 50% 分屏独立滚动
- **审查结果可直接编辑**：总结 → textarea，优点/待改进/建议 → 可修改 input + × 删除 + + 添加
- **审查历史记录**：每次审查存入 reviewHistory[]，顶部时间线标签切换查看
- **「AI 已审查」状态**：完成后按钮变绿，收起再打开状态保留（key 固定）
- **「已导入」状态**：per-message 追踪，导入后按钮变绿禁用
- **智能修改 Prompt**：内容 ≤4000 字直接嵌入；>4000 字先自动存为工作产出再引导 AI 读取
- **用户补充意见**：「补充意见」按钮 → 文本框 → 合并到修改 Prompt
- **保存优化**：默认标题 `{工作流}_报告_YYYY-MM-DD`，去掉 AI 生成标题的等待；同一 outputId 自动版本递增
- **编辑器 toggle 按钮**：对话页顶栏始终可见，收起后可再次打开

### 对话页优化
- 阶段进度条：紧凑内联 + 点击展开详细阶段列表
- 对话气泡：冷白底色 + 蓝色边框（user）/ 灰色边框（AI）
- 输入框：蓝色 focus ring，支持 Enter 发送 / Shift+Enter 换行

## 当前状态

### 本次会话提交（12 个新 commit，未推送）
```
7c62222 fix: editable review cards + 已导入 state + quick save defaults
6b2d6b0 fix: persist review state across editor open/close
b636785 feat: review history + smart revise + user feedback
2c47c16 fix: 50/50 split excludes sidebar width
754810c fix: fresh rewrite of editor and chat page — all 6 UX items
276b04b fix: editor flex layout — remove duplicate wrapper div causing TSX error
6562b49 fix: import-to-editor UX — close editor on import, keep per-message state
3ab9ed8 fix: per-message imported state + conversation-page editor visibility
cd78022 feat: full i18n + editor UX overhaul
a75aa86 feat: complete UI redesign — Precision Instrument
d222b6f fix: correct skills root path from ../pm-skills to pm-skills
3ac8f33 chore: remove orphaned pm-workflow-assistant gitlink, add to gitignore
```

12 个 commit 待推送（领先 origin/master 12 个 commit）。

### 已知问题
1. **`.env` 被重置**：Agnes AI API 失效（返回 404 HTML），`.env` 已改为 OpenAI 默认占位。用户需在 Settings 页面填入有效 key
2. **工作流 prompt 完整性**：10 个 JSON 工作流未做端到端验证
3. **知识库功能**：侧边栏「知识库」入口仍为占位状态（未实现）
4. **多用户/移动端**：未实现

## 关键文件索引

| 文件 | 用途 | 本次改动 |
|------|------|---------|
| `src/app/globals.css` | 设计 token：冷白+电气蓝+Inter+JetBrains Mono | 重写 |
| `src/app/layout.tsx` | 字体加载 Inter + JetBrains Mono | 修改 |
| `src/components/Sidebar.tsx` | 侧边栏：中文导航+SVG图标+历史分组 | 重写 |
| `src/app/page.tsx` | 首页：5列网格+详情弹窗+底部输入+快速切换 | 重写 |
| `src/app/workflow/[id]/page.tsx` | 聊天页：50/50分屏+阶段进度+气泡 | 重写 |
| `src/components/MarkdownEditor.tsx` | 编辑器：审查系统+历史记录+可编辑卡片+智能修改 | 重写 |
| `src/app/workflow/page.tsx` | 工作流列表页 | 重写 |
| `src/app/skills/page.tsx` | 技能库索引页 | 重写 |
| `src/app/outputs/page.tsx` | 工作产出页面 | 重写 |
| `src/app/settings/page.tsx` | 模型设置页 | 重写 |
| `src/lib/skill-loader.ts` | Skill 路径修正 | 修改 |
| `src/app/api/skills/list/route.ts` | Skill 路径修正 | 修改 |

## 踩过的坑（本会话新增）

| # | 现象 | 原因 | 修复 | 预防 |
|---|------|------|------|------|
| 1 | Skills API 返回空数组 | `SKILLS_ROOT` 用了 `../pm-skills`，cwd 变为根目录后路径解析为 `d:/Desktop/pm-skills`（不存在） | 改为 `pm-skills` | 项目结构调整后检查所有相对路径 |
| 2 | `MarkdownEditor` 工具栏不可见 | 两层 `flex: 0 0 50%` 嵌套 + `minWidth:0` 导致内容挤压 | 外层父容器控制宽度，内层用 `flex:1` 填充 | 复杂 flex 嵌套先画 ASCII 层级图再写代码 |
| 3 | React key 缺失导致组件重 mount 丢状态 | `{editorOpen && <MarkdownEditor/>}` 无 key，React 可能复用旧实例 | 加固定 key `'editor-active'` | 条件渲染的复杂组件始终给稳定 key |
| 4 | 「已导入」不生效 | `handleImportDone` 用 `messages.findIndex` 匹配内容，但编辑器内内容可能已被修改 | 改为 `editingMsgIdx` 在 `openEditor` 时直接记录消息索引 | 状态追踪优先用索引而非内容匹配 |
| 5 | Agnes AI API 返回 404 HTML | `platform.agnes-ai.com/v1/chat/completions` 路径不存在 | `.env` 重置为 OpenAI 默认 | 新 provider 先用 curl 验证 endpoint |

## 系统记忆

6 条记忆已录入（同上一次交接），本项目新会话自动加载：
- Tailwind list-style reset
- SQLite column migration
- SQLite date format
- Sidebar time label guard
- Markdown table rendering
- Markdown inline recursive formatting

<!-- project-handover:generated:start -->
<!-- project-handover:generated:end -->

<!-- project-handover:state
{"version":1,"project_root":"D:\\Desktop\\pm-skills-2","last_sync":"2026-07-21T00:00:00Z","coverage":"partial","threads":{}}
-->
