# HANDOFF — PM Workflow Assistant

> 2026-07-21 · 上一个会话完成了全部核心功能的开发和推送

---

## 项目概览

**名称**：PM Workflow Assistant（PM 工作流助手）
**仓库**：`https://github.com/LinVincent121/PM-Workflow`（已推送 6 个 commit）
**路径**：`d:/Desktop/pm-skills-2/pm-workflow-assistant`
**技术栈**：Next.js 14 App Router + better-sqlite3 + Tailwind CSS + 自定义 Markdown 渲染器 + SSE 流式
**Node 版本**：任意 18+
**启动**：`npm run dev`（`.env` 已配置，端口 3000）

## 已完成功能

### 核心架构
- 10 个 PM 工作流（JSON 文件在 `src/data/workflows/`），含多阶段引导对话
- SSE 流式 AI 聊天，Markdown 渲染（自定义零依赖组件 `src/components/Markdown.tsx`）
- SQLite 持久化（`data/pmwa.db`），session / settings / work_outputs / output_versions 四张表
- OpenAI 兼容 LLM 适配器（`src/lib/llm/client.ts`），支持非流式 + 流式
- Skill 加载器（从 `../pm-skills/` 读取 SKILL.md 注入对话上下文）

### 对话功能
- 输入框改为 `<textarea>`：`Enter` 发送，`Shift+Enter` 换行，自动扩展高度
- 历史任务侧边栏：按「今日/昨天/一周内/过往对话」时间分组 + 末次时间显示
- 会话状态指示器：AI 回复中闪烁绿点，完成显示红点
- AI 自动生成 6-10 字会话标题（每轮对话结束后调用 `/api/sessions/generate-title`）
- 阶段进度条 + 弹窗（显示所有阶段、已完成/进行中/待进行状态）

### Markdown 编辑器
- 每条 AI 消息底部「📝 导入编辑」按钮 → 右侧 40% 面板
- 编辑/预览切换、AI 审查（完整性/质量/结构/差距）
- 「依据审核结果修改」→ 主对话区触发 AI 改写
- 保存对话框：AI 生成标题 + V1.0.0 自动递增版本号
- 2s 防抖自动保存

### 工作产出
- 侧边栏「📤 工作产出」入口 → `/outputs` 页面
- 卡片网格展示、支持重命名/删除/版本历史查看
- 空状态引导

## 当前问题

1. **Git push 网络限制**：本机无法直连 GitHub HTTPS（443），换 token 已解决。用户本地网络可正常 push。
2. **`.env` 含 API key**：`.gitignore` 已排除 `.env`，但需提醒新环境配置 LLM 信息。
3. **工作流 prompt 完整性**：6 个工作流 JSON 已在上一会话 agent 中增强了最终阶段的输出要求（要求完整可落地报告），但未做端到端验证。

## 下一步计划

1. **端到端测试**：逐个运行 10 个工作流，验证每个的最终阶段输出是否完整可落地
2. **知识库功能**：侧边栏「📚 知识库」入口目前置灰（`即将推出`），需要实现
3. **多用户支持**：当前无认证，所有会话共享
4. **移动端适配**：当前仅桌面布局

## 关键文件索引

| 文件 | 用途 |
|------|------|
| `src/lib/db.ts` | SQLite 全部 CRUD，含 `toISO()` 日期转换 |
| `src/lib/orchestrator.ts` | 系统提示词构建 + 流式/非流式消息处理 |
| `src/lib/llm/client.ts` | LLM API 调用，含 `sanitizeContent` |
| `src/lib/title-generator.ts` | AI 标题生成 |
| `src/lib/skill-loader.ts` | Skill 文件加载 + 工作流定义加载 |
| `src/types/index.ts` | 全部 TypeScript 类型 |
| `src/components/Sidebar.tsx` | 侧边栏（导航+历史+状态指示器） |
| `src/components/Markdown.tsx` | 零依赖 Markdown 渲染器 |
| `src/components/MarkdownEditor.tsx` | 编辑器面板（编辑/预览/审查/保存） |
| `src/app/workflow/[id]/page.tsx` | 主聊天页面（SSE+进度条+编辑器分屏） |
| `src/app/outputs/page.tsx` | 工作产出页面 |
| `src/app/page.tsx` | 首页工作流卡片 |
| `src/app/api/chat/stream/route.ts` | SSE 流式端点 |
| `src/app/api/review/route.ts` | AI 审查端点 |
| `src/app/api/outputs/route.ts` | 产出 CRUD |
| `src/app/api/sessions/generate-title/route.ts` | 标题生成 |
| `src/app/api/sessions/mark-read/route.ts` | 标记已读 |

## 踩过的坑

1. **Tailwind `@tailwind base` 重置 `list-style`**：有序列表数字消失 → 给 `<ol>` 显式加 `listStyleType: 'decimal'`
2. **SQLite `CREATE TABLE IF NOT EXISTS` 不追加新列**：写 `ensureColumn()` 用 `PRAGMA table_info` 检测 + `ALTER TABLE` 迁移
3. **SQLite 日期格式 `"YYYY-MM-DD HH:MM:SS"` 不能被 `new Date()` 解析**：写 `toISO()` 转换空格为 `T`
4. **Markdown 表格漏渲染**：自定义渲染器遗漏表格块级解析 → 补写完整表格检测/解析/渲染
5. **Git 推送 `Recv failure: Connection was reset`**：网络层拦截 → 换用 GitHub 新 token 解决

---

## 纠错反思表

本会话中所有被用户纠正过的问题及归因：

| # | 修改内容 | 错误归因 | 下次指令建议 |
|---|---------|---------|------------|
| 1 | Markdown 表格未渲染（`| col |` 语法） | **信息不足** — 自定义渲染器初始设计遗漏了 GFM 表格语法 | 构建 Markdown 渲染器时先穷举 AI 可能输出的所有 GFM 格式（表格/任务列表/删除线/嵌套格式等），再逐个实现 |
| 2 | 有序列表编号消失 | **判断逻辑问题** — 用了 Tailwind 但忘了 base 层会全局重置 `list-style: none` | 在用 Tailwind 的项目中，`<ol>` `<ul>` 永远显式设置 `listStyleType`，不依赖浏览器默认值 |
| 3 | `table sessions has no column named status` | **信息不足** — SQLite `CREATE TABLE IF NOT EXISTS` 不会修改已有表结构 | 任何 DB 改表结构操作必须写迁移逻辑：`PRAGMA table_info` 检查列 → `ALTER TABLE ADD COLUMN` |
| 4 | `Invalid Date` 时间戳显示 | **判断逻辑问题** — `toISO()` 对已是 ISO 格式的值又追加 `.000Z`，破坏格式 | 日期转换函数先检测输入是否已是目标格式；`new Date()` 调用前一律加 `isNaN` 守卫 |
| 5 | `max_tokens: 2048` 导致 AI 回复被截断 | **信息不足** — 只考虑了对话场景，没考虑工作流最终阶段会生成数千字完整报告 | LLM `max_tokens` 按最高输出量设置：报告生成类 8192，对话类 4096 |
| 6 | AI 回复一次性全部出现（无打字机效果） | **判断逻辑问题** — 后端 `processMessageStream` 已实现但前端仍用非流式 API | 新增 API 后端后检查前端是否已切换到新端点；废弃端点加 `@deprecated` 注释 |
| 7 | `renderInline` 不支持嵌套格式 | **信息不足** — 内联格式化只做了单次正则扫描，没考虑 Markdown 格式可嵌套 | 内联格式化递归调用自身处理 bold/italic/link/strike 内部内容 |
| 8 | Git push HTTPS 被网络层拦截，换 3 次 token | **环境限制** — 服务器到 GitHub 443 端口连通性不稳定，非代码逻辑问题 | git push 前先用 `curl api.github.com` 验证连通性；网络不通则请用户本地 push |
| 9 | Sidebar 用户手工修改后产生冲突 linter 警告 | **环境限制** — 用户侧 VSCode linter 自动修改文件导致 git diff 脏工作区 | 所有 `git push` 前执行 `git add -A && git status` 确保无遗漏变更 |

---

## 系统记忆索引

以下 6 条记忆已录入系统，新会话将自动加载：

| 记忆 | 文件 | 要点 |
|------|------|------|
| Tailwind list-style reset | `memory/tailwind-list-style-reset.md` | `<ol>` `<ul>` 必须显式设 listStyleType |
| SQLite column migration | `memory/sqlite-migrate-existing-tables.md` | 用 `ensureColumn()` 做 `ALTER TABLE ADD COLUMN` |
| SQLite date format | `memory/sqlite-date-format.md` | `toISO()` 先检测再转换，避免二次追加 |
| Sidebar time label guard | `memory/sidebar-time-label-guard.md` | `timeLabel()` `timeAgo()` 必须含 `isNaN` 守卫 |
| Markdown table rendering | `memory/markdown-table-rendering.md` | 表格需独立检测/对齐解析/`<thead>`+`<tbody>` 渲染 |
| Markdown inline recursive | `memory/markdown-inline-recursive-formatting.md` | `renderInline` 内部递归调用才支持嵌套格式 |
