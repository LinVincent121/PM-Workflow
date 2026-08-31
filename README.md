# PM Workbench

面向产品团队的中文 AI 工作台：把模糊问题拆成可执行的工作流，并沉淀为可编辑、可审查、可追踪的交付物。

## 核心能力

- **结构化工作流**：产品想法、竞品分析、商业战略、PRD 交付等 10 个工作流
- **通用对话**：支持 SSE 流式回复、Markdown 渲染和文件/图片上下文
- **AI 审查**：对产出物进行完整性、质量、结构和差距分析
- **产出物管理**：文件夹、版本快照、预览、编辑和下载
- **文件管理**：上传、列表、预览、下载和删除；用户目录隔离
- **账号体系**：QQ 邮箱验证码注册、登录、退出、密码修改、找回密码和账号注销
- **权限管理**：普通用户/超级管理员角色，管理员控制台和用户启用/禁用
- **审计日志**：登录、模型回答、会话、产出物、文件和账号操作均可追踪
- **安全基础设施**：限流、用户数据隔离、健康检查、备份脚本和生产安全响应头

## 技术栈

| 层面 | 技术 |
| --- | --- |
| Web 框架 | Next.js 14 App Router |
| 语言 | TypeScript + React 18 |
| 数据库 | SQLite + better-sqlite3 |
| AI | OpenAI 兼容 API，支持流式 SSE |
| 邮件 | QQ SMTP 验证码 |
| 测试 | Playwright + Node.js 数据隔离检查 |

## 本地运行

### 环境要求

- Node.js 20（better-sqlite3 当前按 Node 20 构建）
- npm

### 安装

~~~bash
npm install
~~~

### 配置环境变量

复制 .env.example 为 .env.local，至少填写：

~~~env
DATABASE_PATH=data/pmwa.db
AUTH_SECRET=请生成一段随机密钥
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的QQ邮箱
SMTP_PASSWORD=QQ邮箱SMTP授权码
SMTP_FROM=你的QQ邮箱
~~~

模型 Key 可以由每个用户在设置页填写，也可以通过环境变量提供默认配置：

~~~env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4o
~~~

### 启动

~~~bash
npm run dev
~~~

访问 http://localhost:3000。

## 常用命令

~~~bash
npm run dev                 # 开发服务
npm run build               # 生产构建
npm run start               # 启动生产服务
npm run backup              # 创建 SQLite 备份并清理过期备份
npm run migrate:legacy      # 迁移历史数据
npm run test:isolation      # 数据库结构隔离检查
npm run test:e2e            # 认证与数据隔离检查
npm run test:browser        # Playwright 浏览器测试
npx tsc --noEmit            # TypeScript 检查
~~~

首次运行浏览器测试需要安装 Chromium：

~~~bash
npx playwright install chromium
npx playwright install chromium-headless-shell
~~~

登录后的浏览器测试需要临时设置 E2E_EMAIL 和 E2E_PASSWORD。

## 主要页面

| 页面 | 地址 | 说明 |
| --- | --- | --- |
| 首页 | / | 产品介绍、登录注册和快速开始 |
| 新建任务 | /chat | 通用 AI 对话和推荐工作流 |
| 工作流 | /workflow | 浏览和启动结构化工作流 |
| 工作产出 | /outputs | 文件夹、产出物和版本管理 |
| 文件管理 | /files | 文件列表、预览、下载和删除 |
| 模型设置 | /settings | 配置个人模型连接 |
| 管理后台 | /admin | 管理员账号与审计日志 |
| 健康检查 | /api/health | 服务和数据库状态探针 |

## 数据与安全

- 默认使用本地 SQLite，数据库位于 data/pmwa.db
- 用户数据通过 user_id 做归属校验
- 上传文件按用户目录隔离
- .env、.env.local、数据库、上传文件和备份目录不会提交到 Git
- 账号注销会清理账号、Session、设置、工作会话、文件夹、产出版本和本地上传文件
- 修改邮箱功能当前暂时下线，页面和 API 会明确提示不可用
- 生产环境建议通过 HTTPS、反向代理和定时任务运行备份

## 项目结构

~~~text
src/
├── app/                 # 页面和 API 路由
├── components/          # 共享 UI 组件
├── lib/                 # 数据库、认证、邮件、LLM 和文件工具
└── types/               # TypeScript 类型
scripts/                 # 备份、迁移和自动化检查脚本
tests/e2e/               # Playwright 浏览器测试
~~~

## License

MIT
