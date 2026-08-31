# Project Handover

> Last updated: 2026-07-24 | Coverage: partial

<!-- project-handover:generated:start -->
## 项目现状与目标

**名称**：PM Workbench
**仓库**：`https://github.com/LinVincent121/PM-Workflow`
**路径**：`d:/Desktop/pm-skills-2`
**技术栈**：Next.js 14 App Router + better-sqlite3 + Tailwind CSS + 自定义 Markdown 渲染器 + SSE 流式
**启动**：`npm run dev`（需配 `.env` 文件，端口 3000）

核心功能：
- 10 个 PM 工作流 JSON（想法完善、竞品分析、商业战略、PRD 交付等）
- 通用对话 `/chat` 页面（纯 LLM 调用，不经过工作流编排）
- 流式对话（SSE）+ Markdown 编辑器（预览/编辑切换 + AI 审查）
- 文件/图片上传（最多 1 个文档 + 2 张图片，支持多模态）
- 工作产出管理（文件夹组织 + 版本历史）
- 设置页面（API key + 模型配置）

## 任务记录与完成状态

### 首页与工作流对话页面UI优化（已完成 - 2026-07-22）

**状态**：已完成
**Git commit**：`5e1b39a`

**主要改动**：
1. 首页：数据汇总区、推荐工作流卡片、工作流选择器、现代化输入框
2. 工作流对话页：消息居中、输入框优化、文件上传UI
3. 系统提示词、会话过滤、快速启动逻辑

### 文件夹管理 + 产出组织系统（已完成 - 2026-07-22）

**状态**：已完成
**Git commit**：`5e1b39a`

### 已修复的3个BUG（已完成 - 2026-07-22）

**Git commit**：`140b2d5`

1. ✅ review 卡片编辑保存问题（useRef 替代 state）
2. ✅ "已导入"状态丢失问题
3. ✅ 快速保存默认值问题

### 2026-07-24 修复任务（已完成）

#### 1. 通用对话独立页面 ✅

创建 `/chat` 页面 + `/api/chat/simple` SSE 端点，纯 LLM 调用不经过工作流编排。
涉及文件：`src/app/chat/page.tsx`（新建）、`src/app/api/chat/simple/route.ts`（新建）、`src/app/page.tsx`

#### 2. 双气泡修复 ✅

**根因**：`{sending && <div className="msg-ai">▊</div>}` 光标闪烁元素独立渲染为第二个 AI 气泡，与空 assistant 消息叠在一起。
**修复**：删除独立的光标 `msg-ai` 元素，改为在最后一条 assistant 消息内容末尾添加内联 `cursor-blink`。
**后续增强**：移除 `setTimeout` 延迟 → 直接调用 `handleSend`；添加 `AbortController` 防止 Strict Mode 下双重 SSE 流。
涉及文件：`src/app/workflow/[id]/page.tsx`、`src/app/chat/page.tsx`

#### 3. 品牌名称改回 PM Workbench ✅

涉及文件：`Sidebar.tsx`、`globals.css`、`layout.tsx`、`orchestrator.ts`

#### 4. 回复开头自我介绍修复 ✅

**根因**：System prompt 中 "直接以 PM Workbench 的身份开始对话" 被 LLM 理解为每次回复都要自我介绍。
**修复**：改为 "直接回答问题，不要每次都自我介绍"。
涉及文件：`src/lib/orchestrator.ts`、`src/app/api/chat/simple/route.ts`

#### 5. 通用对话历史记录 ✅

**修复**：`/api/chat/simple` 创建 session（`workflowId: 'chat'`），发送前保存 user 消息，流式完成后保存 assistant 消息。Sidebar 路由 `workflowId === 'chat'` → `/chat?sid=`。
涉及文件：`src/app/api/chat/simple/route.ts`、`src/app/chat/page.tsx`、`src/components/Sidebar.tsx`、`src/lib/db.ts`

#### 6. 通用对话标题生成 ✅

**修复**：发送消息时立即用用户消息前 30 字作为临时标题，AI 回复后通过 `/api/sessions/generate-title` 生成正式标题替换。
涉及文件：`src/app/api/chat/simple/route.ts`、`src/app/chat/page.tsx`

#### 7. Streaming 会话卡死修复 ✅

**根因**：SSE 流出错时 catch 块未重置 session 状态；`markSessionRead` 只处理 `unread` 不处理 `streaming`。
**修复**：catch 中 `updateSession(sid, {status:'idle'})`；`markSessionRead` SQL 改为 `status IN ('unread','streaming')`；Sidebar 对 `streaming` 状态也调用 `mark-read`。
涉及文件：`src/app/api/chat/simple/route.ts`、`src/lib/db.ts`、`src/components/Sidebar.tsx`

#### 8. 同路由切换会话卡死修复 ✅

**根因**：Next.js 在同路由 `/chat?sid=A` → `/chat?sid=B` 时不重新挂载组件，`historyLoaded` 保持 `true` 导致 session 加载 effect 被跳过。
**修复**：新增 `useEffect` 监听 URL 中 `sid` 变化，检测到 `sid !== sessionId` 时重置 `historyLoaded`、`messages`、`sessionId`。
涉及文件：`src/app/chat/page.tsx`

#### 9. 多模态消息渲染崩溃修复 ✅

**根因**：含图片的消息 `content` 是数组 `[{type:'text',...}, {type:'image_url',...}]`，渲染时 `{m.content}` 对数组调 `.toString()` 导致崩溃。
**修复**：`sanitizeContent` 支持数组类型；渲染时对数组提取 `text` 部分。
涉及文件：`src/lib/llm/client.ts`、`src/app/chat/page.tsx`、`src/app/workflow/[id]/page.tsx`、`src/types/index.ts`

#### 10. 文件/图片上传功能 ✅

**新增文件**：
- `src/app/api/upload/route.ts` — 上传 API，multipart 接收，保存到 `data/uploads/`
- `src/app/api/files/[fileId]/route.ts` — 文件服务 API，支持下载和图片访问
- `src/lib/file-utils.ts` — 文件读取工具（文本提取、base64 转换、LLM prompt 上下文构建）

**修改文件**：
- `src/app/page.tsx` — `handleSend` 改为 async，发送前上传文件，元信息存 sessionStorage
- `src/app/chat/page.tsx` — sessionStorage 读取文件、展示区（文档下载、图片点击预览）、modal 预览、上传按钮
- `src/app/workflow/[id]/page.tsx` — 同上
- `src/app/api/chat/simple/route.ts` — 接受 `files` 参数，文本注入 prompt，图片用 base64 多模态
- `src/lib/orchestrator.ts` — `processMessageStream` 接受 `files` 参数
- `src/app/api/chat/stream/route.ts` — 接受并传递 `files`

**限制**：文档最多 1 个 ≤10MB，图片最多 2 张 ≤5MB

#### 11. 侧边栏 Streaming 状态按钮显示 ✅

**修复**：移除 `s.status !== 'streaming'` 条件，hover 时"重命名""删除"按钮始终显示。
涉及文件：`src/components/Sidebar.tsx`

## 产出与交付物

### 已实现功能

1. **首页**：`/` — 数据汇总、推荐工作流、工作流选择器、文件上传+发送
2. **通用对话**：`/chat` — 独立页面，纯 LLM 对话，不含工作流，支持文件/图片
3. **工作流列表页**：`/workflow`
4. **工作流对话页**：`/workflow/[id]` — 消息居中、文件上传、自动发送、Markdown 编辑器
5. **产出管理页面**：`/outputs` — 文件夹管理、预览编辑器、下载 .md
6. **文件上传**：`/api/upload` + `/api/files/[fileId]` — 上传、下载、图片预览

## 已确定的方案、约定与偏好

### UI设计风格
- 圆角 24px 输入框，边框 1.5px solid #e5e7eb
- 消息容器 maxWidth 900px，气泡 maxWidth 75%
- 按钮：圆形 36px，图标式设计

### 品牌名称
- 统一使用"PM Workbench"

### 文件上传
- 文档：最多 1 个，≤10MB（.pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt, .md）
- 图片：最多 2 张，≤5MB（.png, .jpg, .jpeg, .gif, .webp）
- 文件信息通过 sessionStorage 传递（键名 `pm-uploaded-files`）

### 会话管理
- 通用对话 session 使用 `workflowId: 'chat'`
- Sidebar 路由 `chat` → `/chat?sid=`，其他 → `/workflow/[id]?sid=`
- 会话过滤：`messages.length > 0`

## 踩坑与已验证修复

### 1. React State 更新时序问题
使用 `useRef` 存储最新值，避免闭包中的异步 state 过期。

### 2. React Strict Mode 双重挂载
- sessionStorage 在 effect 中 `removeItem` 会导致第二次挂载数据丢失 → 移到消费点删除
- SSE 流在卸载时未中止 → 使用 `AbortController`

### 3. Next.js App Router 同路由组件不复挂载
`/chat?sid=A` → `/chat?sid=B` 时不重新挂载，需手动监听 `searchParams` 变化并重置状态。

### 4. 多模态 content 类型
含图片消息的 `content` 是数组，渲染和 `sanitizeContent` 需做类型判断。

### 5. 侧边栏 streaming 状态按钮
`streaming` 不应阻止重命名/删除按钮显示。

## 未完成事项与下一步

### 已明确未修复BUG

1. **图片上传后对话页不显示图片**
   - **现象**：首页上传图片 → 进入 `/chat` → 第一条用户消息上方没有显示对应图片
   - **上次修复**：移除 `messages.length > 0` 条件 + 移动 sessionStorage 清理时机
   - **状态**：仍未修复，需继续排查
   - **优先级**：高

2. **删除当前查看的会话时右侧页面不刷新**
   - **现象**：左侧任务栏删除当前正在查看的会话时，右侧页面不刷新，需手动跳转到首页
   - **预期**：删除后自动跳转到首页
   - **额外需求**：删除时需弹出二次确认弹窗
   - **优先级**：中

### 下一步计划

1. 修复图片上传后不显示的 BUG
2. 实现删除会话时自动跳转 + 二次确认
3. 测试文件上传完整流程
4. 优化首页布局

## 已知问题与限制

1. **LLM API Key 配置**：首次使用需在 Settings 页面填入有效 key
2. **图片显示**：图片上传后对话页展示有 BUG，见上方未修复列表

## 对话覆盖情况

**本次更新**：基于 2026-07-24 会话增量更新
**覆盖状态**：partial
**读取对话数**：1（当前会话）
**主要新增**：
- 通用对话独立页面 `/chat`
- 双气泡修复（光标放入 assistant 消息内部）
- 品牌名称 PM Workbench
- 回复自我介绍修复
- 通用对话 session 历史记录 + 标题生成
- Streaming 会话卡死修复
- 同路由会话切换卡死修复
- 多模态消息渲染崩溃修复
- 文件/图片上传完整功能
- 侧边栏 streaming 状态按钮修复
- 2 个未修复 BUG 记录

**已记录 commit**：
- `5e1b39a`（2026-07-22）：文件夹管理 + 产出组织 + 编辑&下载功能
- `140b2d5`（2026-07-22）：文档记录 3 个已修复 BUG
<!-- project-handover:generated:end -->

<!-- project-handover:state
{"version":1,"project_root":"D:\\Desktop\\pm-skills-2","last_sync":"2026-07-24T16:00:00Z","coverage":"partial","threads":{"session-20260722":{"fingerprint":"ui-optimization-bugs","updated_at":"2026-07-22T18:30:00Z","title":"首页与工作流对话页面UI优化+已知BUG记录"},"session-20260724":{"fingerprint":"chat-page-file-upload-bugfixes","updated_at":"2026-07-24T16:00:00Z","title":"通用对话页面+文件上传+多项BUG修复"}}}
-->