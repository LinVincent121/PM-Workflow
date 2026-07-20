# PM Skills 复合工作流设计

> 基于 pm-skills 仓库中的 ~60 个 Skill，编排出的端到端工作流。
> 前 4 个为原版（发布、事故、Build vs Buy、激活优化），后 6 个为新增设计。

---

## 工作流 1：🚀 产品发布全流程（Launch Pipeline）

**触发场景**："我们要在下个月发布一个新功能，帮我走一遍从准备到上线的全流程"

```
Phase 1 ── 上市前情报收集
  company-research          → 竞争对手在做什么类似发布？
  pestel-analysis           → 宏观环境有没有风险？

Phase 2 ── 定位与信息准备
  positioning-statement     → 一句话定位
  press-release             → 逆向撰写新闻稿（Amazon PR/FAQ 风格）

Phase 3 ── 干系人对齐
  stakeholder-identification → 谁需要被说服？
  stakeholder-mapping       → 权力/利益矩阵
  stakeholder-engagement-advisor → 怎么沟通？

Phase 4 ── 发布执行
  eol-message               → 端对端消息策略
  organic-growth-advisor    → 发布后有机增长计划

Phase 5 ── 发布后复盘
  business-health-diagnostic → 发布后业务健康检查
  derisk-measurement-advisor → 度量指标验证
```

**产出物**：完整的 Go-To-Market 文档（竞品情报 + 定位声明 + 新闻稿草稿 + 干系人沟通计划 + 发布后增长策略 + 复盘框架）

---

## 工作流 2：🔥 产品事故响应与恢复（Incident Response & Recovery）

**触发场景**："我们的核心功能出了严重问题，用户大量流失，需要紧急应对"

```
Phase 1 ── 紧急诊断
  business-health-diagnostic → 当前业务健康度量化
  problem-framing-canvas     → 快速界定问题边界

Phase 2 ── 对内沟通
  problem-statement          → 用数据+证据向内部说明发生了什么
  eol-message                → 终止/降级消息

Phase 3 ── 对外沟通
  press-release              → 面向用户的透明沟通稿
  positioning-statement      → 重新锚定信任

Phase 4 ── 根因修复
  epic-hypothesis            → 修复方案的假设声明
  user-story-splitting       → 拆解修复任务
  incoming-request-advisor   → 管理涌入的用户反馈

Phase 5 ── 预防机制
  pol-probe                  → 评估再次发生的概率
  derisk-measurement-advisor → 建立监控告警
```

**产出物**：事故响应时间线、对内对外沟通模板、修复任务清单、预防性监控方案

---

## 工作流 3：🏗️ Build vs Buy 决策框架

**触发场景**："我们团队在争论自建 AI 推荐系统还是采购第三方服务，需要一个结构化的决策过程"

```
Phase 1 ── 市场扫描
  tam-sam-som-calculator     → 市场规模评估（自建 vs 采购的 TAM 差异）
  company-research           → 市面上有哪些成熟供应商？

Phase 2 ── 财务建模
  finance-based-pricing-advisor → 采购成本建模
  saas-economics-efficiency-metrics → 自建的经济性分析
  feature-investment-advisor → 投资回报率对比

Phase 3 ── 技术评估
  context-engineering-advisor → 技术栈兼容性评估
  agent-orchestration-advisor → 如果涉及 AI Agent 的编排复杂度

Phase 4 ── 决策输出
  prioritization-advisor     → 多准则决策矩阵（成本/速度/控制力/风险）
  epic-hypothesis            → 最终决策的假设声明 + 验证计划
```

**产出物**：决策备忘录（成本对比表 + 风险评估 + 推荐方案 + 验证里程碑）

---

## 工作流 4：👤 新用户激活优化（Activation Optimization Loop）

**触发场景**："我们的新用户在注册后 24 小时内流失率高达 70%，需要系统性解决"

```
Phase 1 ── 旅程映射
  customer-journey-map       → 绘制完整的新用户旅程
  jobs-to-be-done            → 新用户注册时真正想"雇佣"我们的产品做什么

Phase 2 ── 数据诊断
  saas-revenue-growth-metrics → 激活漏斗量化
  finance-metrics-quickref   → LTV/CAC 影响分析

Phase 3 ── 假设生成
  opportunity-solution-tree  → 从"降低流失"出发展开所有可能方案
  pol-probe-advisor          → 为每个方案标注承诺级别

Phase 4 ── 方案设计
  lean-ux-canvas             → 快速原型 UX 方案
  proto-persona              → 细分流失用户画像
  user-story                 → 编写激活功能的故事

Phase 5 ── 实验设计
  discovery-interview-prep   → 验证实验前的用户访谈准备
  discovery-process          → 设计 A/B 测试和灰度发布计划
```

**产出物**：激活漏斗分析报告、用户分段时间线、3-5 个可测试的激活方案、A/B 实验设计文档

---

## 工作流 5：💡 产品想法完善（Idea Refinement）

**触发场景**："我有一个产品想法，但不确定是否靠谱，帮我系统地完善它"

> **设计思路**：这是一个交互式引导工作流。用户输入一个粗糙的想法，Skills 通过一系列结构化问题逐步引导用户补全：问题定义、用户画像、价值主张、约束条件、成功标准。每一步都引用不同的 Skill，形成"问题链"。

```
Phase 1 ── 想法初探
  problem-statement          → 引导用户回答：谁有问题？问题是什么？为什么痛苦？
  problem-framing-canvas     → 结构化问题画布（目标用户、痛点、现有替代方案）

Phase 2 ── 用户深描
  proto-persona              → 定义核心用户画像（角色、目标、痛点、行为模式）
  jobs-to-be-done            → 挖掘用户"雇佣"产品的真实动机
  customer-journey-map       → 描绘用户当前的体验旅程（找到断点）

Phase 3 ── 价值定位
  positioning-statement      → 一句话定位：为谁解决什么问题，带来什么独特价值
  recommendation-canvas      → 定义推荐逻辑：为什么选这个方案而不是别的？

Phase 4 ── 方案构想
  lean-ux-canvas             → 快速勾勒 UX 假设（目标、范围、原型、指标）
  epic-hypothesis            → 将想法转化为可验证的 Epic 假设

Phase 5 ── 约束与风险
  derisk-measurement-advisor → 扫描 10 个风险维度（4 内部 DUFV + 6 外部 PESTEL），
                               每个风险标记"立即行动"或"持续跟踪"
  pol-probe-advisor          → 为最高风险选择最便宜的验证探针

Phase 6 ── 输出汇总
  storyboard                 → 将完善后的想法整理为用户故事板
  eol-message                → 生成最终的想法总结与下一步建议
```

**引导问题链示例**（Agent 按此顺序提问）：

| 阶段 | 引导问题 | 引用的 Skill |
|------|---------|-------------|
| 1 | "你解决了谁的什么问题？" | problem-statement |
| 1 | "这个问题有多痛？有什么证据？" | problem-framing-canvas |
| 2 | "目标用户的具体画像是什么？" | proto-persona |
| 2 | "他们真正想'完成'的任务是什么？" | jobs-to-be-done |
| 2 | "他们现在的体验旅程长什么样？哪里断了？" | customer-journey-map |
| 3 | "用一句话说清楚你的定位" | positioning-statement |
| 3 | "为什么选这个方向而不是别的？" | recommendation-canvas |
| 4 | "最小可行方案长什么样？" | lean-ux-canvas |
| 4 | "把想法写成可验证的假设" | epic-hypothesis |
| 5 | "哪些风险必须现在解决？哪些可以后续跟踪？" | derisk-measurement-advisor |
| 5 | "最便宜怎么验证最高风险？" | pol-probe-advisor |
| 6 | "整理成故事板，给出下一步" | storyboard + eol-message |

**产出物**：一份完整的想法完善文档，包含问题陈述、用户画像、JTBD、旅程地图、定位声明、Lean UX 画布、Epic 假设、风险登记册、故事板

---

## 工作流 6：🔍 竞品分析报告（Competitive Intelligence Report）

**触发场景**："我需要一份完整的竞品分析报告，用于 Q3 战略规划"

> **设计思路**：以工作流 5 产出的"完善后的产品想法"为输入，引用多个 Research 类 Skills 进行多维度竞品分析，最终输出一份结构化的竞品报告。

```
Phase 1 ── 竞品识别与分类
  company-research           → 对每个主要竞品进行深度研究（高管引述、产品战略、组织背景）
  stakeholder-identification → 识别竞品公司的关键决策人（了解谁在做产品决策）

Phase 2 ── 产品功能对比
  positioning-statement      → 为每个竞品写一句定位声明，横向对比
  problem-statement          → 竞品各自在解决什么问题？
  user-story-mapping         → 对比各竞品的功能覆盖范围和用户旅程

Phase 3 ── 市场与行业分析
  pestel-analysis            → 宏观环境对各竞品的影响差异
  tam-sam-som-calculator     → 各竞品所在细分市场的大小和机会
  saas-revenue-growth-metrics → 竞品的营收增长模式分析（如数据可得）

Phase 4 ── 商业模式与定价
  finance-based-pricing-advisor → 竞品定价策略分析（tier 设计、ARPU、转化率）
  feature-investment-advisor → 竞品功能投资方向分析
  saas-economics-efficiency-metrics → 竞品单位经济性分析

Phase 5 ── 用户与市场感知
  customer-journey-map       → 对比竞品与自己的用户旅程差异
  customer-journey-mapping-workshop → 工作坊形式梳理旅程差距
  proto-persona              → 竞品各自吸引的用户画像对比
  discovery-interview-prep   → 设计用户调研问题，验证竞品真实口碑

Phase 6 ── 风险与机会
  opportunity-solution-tree  → 从竞品分析中提炼机会点和解决方案
  derisk-measurement-advisor → 评估竞品威胁的优先级（act vs watch）
  pol-probe                  → 为关键发现设计验证探针

Phase 7 ── 报告整合
  storyboard                 → 将分析结果整理为可视化故事板
  press-release              → 从竞品洞察中逆向推演差异化叙事
  eol-message                → 生成竞品分析报告摘要与行动建议
```

**产出物**：一份完整的竞品分析报告，包含竞品画像矩阵、功能对比表、定价分析、用户旅程对比、市场机会地图、风险登记册、差异化叙事

---

## 工作流 7：📊 商业分析与战略布局（Business Strategy & Positioning）

**触发场景**："基于完善后的产品想法和竞品分析，我需要一份完整的商业分析报告"

> **设计思路**：以工作流 5（完善的产品想法）和工作流 6（竞品分析）的输出为输入，生成包含战略布局、商业模式、市场规模、投资方向、财务计划的完整商业报告。

```
Phase 1 ── 战略定位
  positioning-workshop       → 工作坊形式确定战略定位（目标市场、差异化、价值主张）
  product-strategy-session   → 全链路战略会话（愿景 → 定位 → 机会 → 路线图）
  problem-statement          → 确认核心问题与商业机会的对应关系

Phase 2 ── 市场规模与机会
  tam-sam-som-calculator     → TAM/SAM/SOM 量化计算
  pestel-analysis            → 宏观趋势对市场机会的影响
  company-intel              → 公司内部能力与市场机会的匹配度

Phase 3 ── 商业模式设计
  recommendation-canvas      → 定义商业模式的核心推荐逻辑
  feature-investment-advisor → 功能投资决策（哪些先建、哪些外包、哪些不做）
  organic-growth-advisor     → 有机增长路径设计（不花钱的增长策略）

Phase 4 ── 财务计划
  finance-based-pricing-advisor → 定价模型与收入预测
  saas-economics-efficiency-metrics → SaaS 单位经济模型（LTV/CAC、毛利率、回收期）
  saas-revenue-growth-metrics → 营收增长预测模型
  finance-metrics-quickref   → 关键财务公式速查（作为计算参考）

Phase 5 ── 投资方向
  feature-investment-advisor → 投资优先级矩阵（战略价值 × 实施复杂度）
  epic-hypothesis            → 将投资方向转化为可验证的 Epic 假设
  prioritization-advisor     → 选择投资评估框架（RICE / Value-Effort / Kano）

Phase 6 ── 风险评估
  derisk-measurement-advisor → 10 维度风险扫描（DUFV + PESTEL）
  pol-probe-advisor          → 为高优先级风险选择验证方法
  business-health-diagnostic → 整体业务健康基线评估

Phase 7 ── 报告整合
  roadmap-planning           → 将战略决策转化为分阶段路线图
  storyboard                 → 可视化呈现商业分析结果
  press-release              → 从战略角度撰写"未来新闻稿"
  eol-message                → 生成商业分析报告摘要
```

**产出物**：一份完整的商业分析报告，包含战略定位声明、TAM/SAM/SOM 测算、商业模式画布、财务预测模型（定价/LTV/CAC/回收期）、投资优先级矩阵、风险登记册、分阶段路线图

---

## 工作流 8：📝 PRD 与交付（Product Requirements Document）

**触发场景**："基于完善的产品想法、竞品分析、商业报告，生成完整的 PRD"

> **设计思路**：在原有 `prd-development` 8 阶段工作流基础上扩展，增加对上游输入（竞品分析、商业报告、财务计划）的引用和整合。

```
Phase 1 ── Executive Summary（30 min）
  → 整合工作流 5 的 Epic 假设 + 工作流 7 的战略定位

Phase 2 ── Problem Statement（60 min）
  problem-statement          → 结构化问题陈述
  problem-framing-canvas     → 补充问题画布
  customer-journey-map       → 从竞品分析中获取用户旅程对比（工作流 6 产出）

Phase 3 ── Target Users & Personas（30 min）
  proto-persona              → 用户画像（基于工作流 5 的 JTBD 深化）
  jobs-to-be-done            → 用户任务分析

Phase 4 ── Strategic Context（45 min）
  → 引用工作流 7 的商业报告：
    - TAM/SAM/SOM 数据
    - 竞品定位对比（来自工作流 6）
    - 财务目标与 OKR 对齐

Phase 5 ── Solution Overview（60 min）
  lean-ux-canvas             → 解决方案 UX 假设
  user-story-mapping         → 用户故事地图
  storyboard                 → 故事板辅助方案描述

Phase 6 ── Success Metrics（30 min）
  → 引用工作流 7 的财务计划：
    - ARPU / LTV / CAC 目标
    - 营收增长预期
  derisk-measurement-advisor → 定义度量指标和风险跟踪

Phase 7 ── User Stories & Requirements（90-120 min）
  epic-hypothesis            → Epic 假设声明
  epic-breakdown-advisor     → Epic 拆解为 User Stories
  user-story                 → 编写用户故事与验收标准
  user-story-splitting       → 拆分大故事

Phase 8 ── Out of Scope & Dependencies（30 min）
  incoming-request-advisor   → 管理利益相关者需求流入（过滤 scope creep）
  pestel-analysis            → 外部约束条件（政策/法规/技术趋势）
  → 明确 Out of Scope 与 Dependencies
```

**扩展亮点**：
- **Phase 4** 直接引用工作流 6（竞品分析）和 工作流 7（商业报告）的数据
- **Phase 6** 直接引用工作流 7（财务计划）的指标目标
- **Phase 7** 使用 `epic-breakdown-advisor`（Richard Lawrence 9 种拆分模式）替代简单的用户故事编写
- **Phase 8** 使用 `incoming-request-advisor` 管理需求流入，防止 scope creep
- **Inline gap tagging**：每个阶段标注 🔶 Assumption（合理但未验证）/ 🔵 Open Question（未知需探索）
- **Self-Assessment**：PRD 完成后自动评估最强/最弱部分、待验证假设、推荐下一步

**产出物**：完整的工程就绪 PRD（含问题陈述、用户画像、战略上下文、解决方案、成功指标、用户故事、验收标准、Out of Scope、依赖关系、风险登记）

---

## 工作流 9：🎯 需求排布（Prioritization & Backlog Management）

**触发场景**："PRD 完成了，需求很多但资源有限，帮我排优先级"

> **设计思路**：综合运用多个 Advisor 类 Skills，从优先级排序、需求流入管理、定价建议、Epic 拆解、风险降低五个维度全面管理需求。

```
Phase 1 ── 需求框架选择
  prioritization-advisor     → 根据产品阶段、团队规模、数据可用性，
                               推荐最适合的优先级框架（RICE / ICE / Value-Effort / Kano）

Phase 2 ── 需求流入治理
  incoming-request-advisor   → 对每个新需求进行解码：
                               - 区分"表面诉求"和"真实 JTBD"
                               - 读取发件人权力/利益
                               - 分离 Must-Haves 和 Success Criteria
                               - 标记 Inferences 为 Assumptions to Validate

Phase 3 ── 财务与定价影响评估
  finance-based-pricing-advisor → 评估高优先级需求对定价/收入的影响
  saas-economics-efficiency-metrics → 评估需求投入的单位经济性回报
  feature-investment-advisor → 评估功能投资的 ROI

Phase 4 ── Epic 拆解与故事拆分
  epic-hypothesis            → 为 Top N 需求编写 Epic 假设
  epic-breakdown-advisor     → 使用 Richard Lawrence 9 种拆分模式
                               将 Epic 拆分为可交付的 User Stories
  user-story-splitting       → 对仍过大的故事进一步拆分

Phase 5 ── 风险降低与验证
  derisk-measurement-advisor → 对 Top N 需求做 10 维度风险扫描
                               （4 内部 DUFV + 6 外部 PESTEL）
                               每个风险标记 Act Now / Start Tracking
  pol-probe-advisor          → 为最高风险选择最便宜的验证探针
  pol-probe                  → 记录具体的 Proof of Life 探针

Phase 6 ── 排布输出
  roadmap-planning           → 将排序后的需求排入路线图
  user-story-mapping         → 故事地图可视化
  recommendation-canvas      → 生成最终排布建议（含推荐/备选/否决）
```

**排布决策矩阵示例**：

| 维度 | 工具 | 输出 |
|------|------|------|
| 框架选择 | prioritization-advisor | RICE 评分表 |
| 需求治理 | incoming-request-advisor | 12 段解码报告 |
| 财务影响 | finance-based-pricing-advisor | ARPU/LTV 影响评估 |
| Epic 拆解 | epic-breakdown-advisor | 垂直切片 Story 列表 |
| 风险扫描 | derisk-measurement-advisor | 风险登记册（Act/Watch） |
| 验证方法 | pol-probe-advisor → pol-probe | 最便宜验证实验 |
| 路线图 | roadmap-planning | 分阶段路线图 |

**产出物**：优先级排序表、需求流入解码报告、财务影响评估、Epic 拆解清单、风险登记册、分阶段路线图

---

## 工作流 10：🤖 Agent 工作编排助手（Workflow Orchestrator）

**触发场景**："我每周要做竞品分析 + 用户调研汇总 + 路线图更新，能不能帮我设计一个自动化的工作流？"

> **设计思路**：这是整个系统中最 Meta 的工作流——它读取用户输入的工作内容和要求，自动从已有 Skills 库中匹配、编排、生成一个新的工作流，并给出编排说明和建议。本质上是"工作流的工作流"。

```
Phase 1 ── 需求采集
  context-engineering-advisor → 理解用户的工作场景、约束条件、战略目标
  → 引导用户回答：
    - 每周花多少时间在这些工作上？
    - 哪些是重复性的？哪些需要判断？
    - 当前流程是顺序的还是并行的？
    - 期望的自动化程度？

Phase 2 ── AI-Shaped 任务判定
  agent-orchestration-advisor → 判定该任务是否适合 Agent 编排：
    - ✅ 适合：重复性高、耗时 >5h/周、可并行化、需要一致性
    - ❌ 不适合：一次性任务、纯人类判断、已足够快

Phase 3 ── Skill 匹配
  → 根据用户描述的工作内容，自动检索 Skills 库中相关的 Skill：
    - 搜索关键词匹配（如"竞品分析" → company-research, pestel-analysis）
    - 语义匹配（如"用户调研" → discovery-process, discovery-interview-prep, customer-journey-map）
    - 类型匹配（需要组件 → component；需要对话 → interactive；需要编排 → workflow）

Phase 4 ── 工作流拓扑设计
  agent-orchestration-advisor → 设计编排拓扑：
    - Full Parallel：所有 Skill 独立并行
    - Pipeline：Skill 之间有先后依赖
    - Hybrid：混合模式

Phase 5 ── 边界与交接定义
  agent-orchestration-advisor → 定义每个 Skill 的：
    - 输入契约（需要什么数据）
    - 输出契约（产出什么格式）
    - 交接规则（上一个 Skill 的输出如何喂给下一个）

Phase 6 ── 编排方案生成
  → 自动生成如下结构的编排方案：

  ```
  ╔══════════════════════════════════════════════╗
  ║  编排方案：[工作流名称]                      ║
  ╠══════════════════════════════════════════════╣
  ║  拓扑结构：[Parallel / Pipeline / Hybrid]   ║
  ║                                              ║
  ║  Skill 编排：                                ║
  ║    Phase 1: [Skill A] → [Skill B]           ║
  ║    Phase 2: [Skill C] ─┐                    ║
  ║                        ├─→ [Skill D]        ║
  ║    Phase 3: [Skill E] ─┘                    ║
  ║                                              ║
  ║  输入/输出契约：                             ║
  ║    A 输出 → B 输入: [数据格式]              ║
  ║    C/D 输出 → D 输入: [合并逻辑]            ║
  ║                                              ║
  ║  预计节省时间：X 小时/周 → Y 小时/周        ║
  ║  人工介入点：[列出]                         ║
  ╚══════════════════════════════════════════════╝
  ```

Phase 7 ── 建议与优化
  skill-authoring-workflow   → 如果编排方案需要新建 Skill，提供创建指引
  workshop-facilitation      → 提供协作实施的建议节奏
  eol-message                → 生成最终编排方案总结
```

**Skill 匹配逻辑示例**：

| 用户描述 | 匹配的 Skills | 编排类型 |
|---------|--------------|---------|
| "竞品分析" | company-research, pestel-analysis, positioning-statement | Pipeline |
| "用户调研汇总" | discovery-process, discovery-interview-prep, customer-journey-map | Pipeline |
| "路线图更新" | roadmap-planning, user-story-mapping, prioritization-advisor | Hybrid |
| "OKR 制定" | product-strategy-session, problem-statement, opportunity-solution-tree, roadmap-planning | Pipeline |
| "需求评审" | incoming-request-advisor, prioritization-advisor, epic-breakdown-advisor | Hybrid |

**编排建议输出**：
1. **可行性评估**：这个工作流是否值得编排（时间节省 vs 编排成本）
2. **Skill 依赖图**：可视化展示 Skill 之间的数据流向
3. **人工介入点**：标注哪些步骤必须由人完成（判断/决策/共情）
4. **实施路线图**：分周实施计划（先跑通哪个 Phase，再叠加哪个）
5. **监控建议**：如何评估编排效果（质量/速度/一致性）

**产出物**：一份完整的自动化工作流编排方案（拓扑图 + Skill 列表 + 输入输出契约 + 实施建议 + 预计时间节省）

---

## 📐 工作流之间的关系图

```
工作流 5（想法完善）
    ↓
工作流 6（竞品分析） ← 依赖工作流 5 的输出
    ↓
工作流 7（商业分析） ← 依赖工作流 5 + 6 的输出
    ↓
工作流 8（PRD 与交付） ← 依赖 5 + 6 + 7 的输出
    ↓
工作流 9（需求排布） ← 依赖工作流 8 的输出
    ↑
工作流 10（Agent 编排） ← 可编排上述任意工作流
```

**独立工作流**（不依赖其他工作流，可直接调用）：
- 工作流 1：🚀 产品发布全流程
- 工作流 2：🔥 产品事故响应与恢复
- 工作流 3：🏗️ Build vs Buy 决策框架
- 工作流 4：👤 新用户激活优化

---

## 🎯 如何使用这些工作流

### 方式 A：作为新的 Command 文件

模仿 `commands_discover.md` 格式，创建 `commands_idea-refinement.md` 等文件：

```yaml
---
name: idea-refinement
description: Guide a raw product idea through structured questioning to a complete, validated concept.
argument-hint: "<your rough product idea>"
uses:
  - problem-statement
  - problem-framing-canvas
  - proto-persona
  - jobs-to-be-done
  - customer-journey-map
  - positioning-statement
  - recommendation-canvas
  - lean-ux-canvas
  - epic-hypothesis
  - derisk-measurement-advisor
  - pol-probe-advisor
  - storyboard
  - eol-message
outputs:
  - Complete idea refinement document
  - Risk register with act/watch triage
  - Storyboard visualization
---
```

### 方式 B：作为 Workflow 类型的 Skill

创建一个 `workflow-orchestrator/SKILL.md`，在它的 Application 部分定义 10 个 Phase 的编排逻辑，引用每个 Skill 的输入输出契约。这正是 `prd-development` 已经采用的模式。

### 方式 C：作为自定义 Command 链

在 Claude Code 中通过自然语言触发：

```
"帮我跑一遍工作流 5 + 工作流 6，我的想法是一个面向自由职业者的 AI 日程管理工具"
```

Agent 会自动解析意图，按顺序执行对应 Phase 的 Skill，并将中间产物传递给下一个 Phase。
