# PM工作助手 (PM Workflow Assistant)

> 产品经理的 AI 工作助手 — 10 个结构化工作流 × 100+ 个 PM Skills，一站式覆盖从想法到发布的全流程。

## ✨ 功能

- **10 个结构化工作流**：产品想法完善、竞品分析、商业战略、PRD 交付、需求排布、发布全流程、事故响应、Build vs Buy、新用户激活、Agent 编排
- **100+ PM Skills**：problem-statement、customer-journey-map、SWOT、PESTEL、定价策略等
- **AI 驱动对话**：SSE 流式对话，逐步引导完成每个阶段
- **Markdown 编辑器**：AI 审查 + 一键修改 + 版本历史保存
- **工作产出管理**：自动生成标题、版本快照、历史版本预览
- **Skills 管理**：浏览、搜索所有 PM Skill 文档

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装
```bash
cd pm-workflow-assistant
npm install
```

### 配置 LLM
复制 `.env.example` → `.env`，填写你的 API key：
```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxx
LLM_MODEL=gpt-4o
```
支持所有 OpenAI 兼容 API（OpenRouter、Together AI、DeepSeek、Ollama 等）。

### 启动
```bash
npm run dev
```
打开 http://localhost:3000

## 🏗️ 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS + CSS 自定义属性 |
| 数据库 | SQLite (better-sqlite3) |
| AI | OpenAI 兼容 API (SSE 流式) |

## 📁 项目结构

```
pm-skills-2/
├── README.md                    # 本文件
├── pm-skills/                   # 100+ PM Skill 文档（SKILL.md）
├── pm-workflow-assistant/       # Next.js Web 应用
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # 首页（工作流卡片）
│   │   │   ├── workflow/[id]/page.tsx # 工作流对话页
│   │   │   ├── outputs/page.tsx      # 工作产出管理（版本历史）
│   │   │   ├── skills/page.tsx       # Skills 文档浏览
│   │   │   ├── settings/page.tsx     # LLM 配置
│   │   │   └── api/                  # API 路由
│   │   ├── components/
│   │   │   ├── Sidebar.tsx           # 侧边栏导航
│   │   │   ├── MarkdownEditor.tsx    # AI 审查 + 编辑 + 版本保存
│   │   │   └── Markdown.tsx          # Markdown 渲染
│   │   ├── lib/
│   │   │   ├── db.ts                 # SQLite 数据层
│   │   │   ├── orchestrator.ts       # 工作流编排
│   │   │   ├── skill-loader.ts       # Skill 文件加载
│   │   │   ├── title-generator.ts    # AI 标题生成
│   │   │   └── llm/client.ts         # OpenAI 兼容客户端
│   │   ├── types/index.ts            # 类型定义
│   │   └── data/workflows/           # 10 个工作流 JSON 定义
│   └── package.json
```

## 🔄 更新日志

### 2026-07-20
- **AI 审查 → 主对话注入**：「依据审核结果修改」按钮改为将审查结果注入右侧主对话面板，不再新开迷你窗口
- **保存自动标题**：打开保存弹窗时自动调用 AI 生成 6-15 字中文标题
- **版本历史**：工作产出页面支持展开查看历史版本，点击可预览完整内容，最新版本标记「最新」
- **LLM 400 错误修复**：新增 `sanitizeContent()` 转义 `\x` 序列，防止 JSON 解析器误判 hex escape；请求体 >100KB 时打印警告日志
- **页签标题**：浏览器标签页改为「PM工作助手」
- **侧边栏性能优化**：`groupSessions` 加 `useMemo` 缓存；`SidebarLink` 加 `React.memo` 防止不必要重渲染；全局 `mousedown` 监听器按需挂载（仅在重命名时）
- **Skills 递归扫描**：支持合集嵌套目录（如 `pm-skills/pm-skills/swot-analysis/`），顶层 + 嵌套 Skill 全部展示

## 📄 License

MIT
