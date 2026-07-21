'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

interface WorkflowCard {
  id: string; name: string; emoji: string; description: string; skillCount: number; estimatedTime: string;
}

const WF_META: Record<string, { label: string }> = {
  'idea-refinement':    { label: '想法完善' },
  'competitive-intel':  { label: '竞品分析' },
  'business-strategy':  { label: '商业战略' },
  'prd-delivery':       { label: 'PRD 交付' },
  'prioritization':     { label: '需求排布' },
  'launch-pipeline':    { label: '发布流程' },
  'incident-response':  { label: '事故响应' },
  'build-vs-buy':       { label: '自建外购' },
  'activation-loop':    { label: '激活优化' },
  'agent-orchestrator': { label: 'Agent 编排' },
};

// Full workflow descriptions for detail modal
const WF_FULL: Record<string, string> = {
  'launch-pipeline': `## 产品发布全流程

**触发场景**：我们要在下个月发布一个新功能，帮我走一遍从准备到上线的全流程

### 阶段 1 — 上市前情报收集
company-research → 竞争对手在做什么类似发布？
pestel-analysis → 宏观环境有没有风险？

### 阶段 2 — 定位与信息准备
positioning-statement → 一句话定位
press-release → 逆向撰写新闻稿（Amazon PR/FAQ 风格）

### 阶段 3 — 干系人对齐
stakeholder-identification → 谁需要被说服？
stakeholder-mapping → 权力/利益矩阵
stakeholder-engagement-advisor → 怎么沟通？

### 阶段 4 — 发布执行
eol-message → 端对端消息策略
organic-growth-advisor → 发布后有机增长计划

### 阶段 5 — 发布后复盘
business-health-diagnostic → 发布后业务健康检查
derisk-measurement-advisor → 度量指标验证

**产出物**：完整的 Go-To-Market 文档（竞品情报 + 定位声明 + 新闻稿草稿 + 干系人沟通计划 + 发布后增长策略 + 复盘框架）`,
  'incident-response': `## 产品事故响应与恢复

**触发场景**：我们的核心功能出了严重问题，用户大量流失，需要紧急应对

### 阶段 1 — 紧急诊断
business-health-diagnostic + problem-framing-canvas

### 阶段 2 — 对内沟通
problem-statement + eol-message

### 阶段 3 — 对外沟通
press-release + positioning-statement

### 阶段 4 — 根因修复
epic-hypothesis + user-story-splitting + incoming-request-advisor

### 阶段 5 — 预防机制
pol-probe + derisk-measurement-advisor

**产出物**：事故响应时间线、对内对外沟通模板、修复任务清单、预防性监控方案`,
  'build-vs-buy': `## Build vs Buy 决策框架

**触发场景**：我们团队在争论自建 AI 推荐系统还是采购第三方服务

### 阶段 1 — 市场扫描
tam-sam-som-calculator + company-research

### 阶段 2 — 财务建模
finance-based-pricing-advisor + saas-economics-efficiency-metrics + feature-investment-advisor

### 阶段 3 — 技术评估
context-engineering-advisor + agent-orchestration-advisor

### 阶段 4 — 决策输出
prioritization-advisor + epic-hypothesis

**产出物**：决策备忘录（成本对比表 + 风险评估 + 推荐方案 + 验证里程碑）`,
  'activation-loop': `## 新用户激活优化

**触发场景**：新用户在注册后 24 小时内流失率高达 70%，需要系统性解决

### 阶段 1 — 旅程映射
customer-journey-map + jobs-to-be-done

### 阶段 2 — 数据诊断
saas-revenue-growth-metrics + finance-metrics-quickref

### 阶段 3 — 假设生成
opportunity-solution-tree + pol-probe-advisor

### 阶段 4 — 方案设计
lean-ux-canvas + proto-persona + user-story

### 阶段 5 — 实验设计
discovery-interview-prep + discovery-process

**产出物**：激活漏斗分析报告、用户分段时间线、3-5 个可测试的激活方案、A/B 实验设计文档`,
  'idea-refinement': `## 产品想法完善

**触发场景**：我有一个产品想法，但不确定是否靠谱，帮我系统地完善它

### 阶段 1 — 想法初探
problem-statement + problem-framing-canvas

### 阶段 2 — 用户深描
proto-persona + jobs-to-be-done + customer-journey-map

### 阶段 3 — 价值定位
positioning-statement + recommendation-canvas

### 阶段 4 — 方案构想
lean-ux-canvas + epic-hypothesis

### 阶段 5 — 约束与风险
derisk-measurement-advisor + pol-probe-advisor

### 阶段 6 — 输出汇总
storyboard + eol-message

**产出物**：完整想法完善文档（问题陈述、用户画像、JTBD、定位声明、Lean UX 画布、Epic 假设、风险登记册、故事板）`,
  'competitive-intel': `## 竞品分析报告

**触发场景**：我需要一份完整的竞品分析报告，用于 Q3 战略规划

### 阶段 1 — 竞品识别与分类
company-research + stakeholder-identification

### 阶段 2 — 产品功能对比
positioning-statement + problem-statement + user-story-mapping

### 阶段 3 — 市场与行业分析
pestel-analysis + tam-sam-som-calculator + saas-revenue-growth-metrics

### 阶段 4 — 商业模式与定价
finance-based-pricing-advisor + feature-investment-advisor + saas-economics-efficiency-metrics

### 阶段 5 — 用户与市场感知
customer-journey-map + discovery-interview-prep

### 阶段 6 — 风险与机会
opportunity-solution-tree + derisk-measurement-advisor

### 阶段 7 — 报告整合
storyboard + press-release + eol-message

**产出物**：竞品画像矩阵、功能对比表、定价分析、用户旅程对比、市场机会地图、风险登记册、差异化叙事`,
  'business-strategy': `## 商业分析与战略布局

**触发场景**：基于完善后的产品想法和竞品分析，需要完整的商业分析报告

### 阶段 1 — 战略定位
positioning-workshop + product-strategy-session

### 阶段 2 — 市场规模与机会
tam-sam-som-calculator + pestel-analysis

### 阶段 3 — 商业模式设计
recommendation-canvas + feature-investment-advisor + organic-growth-advisor

### 阶段 4 — 财务计划
finance-based-pricing-advisor + saas-economics-efficiency-metrics + saas-revenue-growth-metrics

### 阶段 5 — 投资方向
feature-investment-advisor + epic-hypothesis + prioritization-advisor

### 阶段 6 — 风险评估
derisk-measurement-advisor + business-health-diagnostic

### 阶段 7 — 报告整合
roadmap-planning + storyboard

**产出物**：战略定位声明、TAM/SAM/SOM 测算、商业模式画布、财务预测模型、投资优先级矩阵、风险登记册、分阶段路线图`,
  'prd-delivery': `## PRD 与交付

**触发场景**：基于完善的产品想法、竞品分析、商业报告，生成完整的 PRD

### 阶段 1 — Executive Summary
整合上游的 Epic 假设 + 战略定位

### 阶段 2 — Problem Statement
problem-statement + problem-framing-canvas

### 阶段 3 — Target Users & Personas
proto-persona + jobs-to-be-done

### 阶段 4 — Strategic Context
引用商业报告的 TAM/SAM/SOM、竞品定位对比、财务目标

### 阶段 5 — Solution Overview
lean-ux-canvas + user-story-mapping + storyboard

### 阶段 6 — Success Metrics
引用财务计划的 ARPU/LTV/CAC 目标

### 阶段 7 — User Stories & Requirements
epic-hypothesis + epic-breakdown-advisor + user-story + user-story-splitting

### 阶段 8 — Out of Scope & Dependencies
incoming-request-advisor + pestel-analysis

**产出物**：完整工程就绪 PRD（问题陈述、用户画像、战略上下文、解决方案、成功指标、用户故事+验收标准、Out of Scope、依赖与风险）`,
  'prioritization': `## 需求排布

**触发场景**：PRD 完成了，需求很多但资源有限，帮我排优先级

### 阶段 1 — 框架选择
prioritization-advisor → 推荐 RICE / ICE / Value-Effort / Kano

### 阶段 2 — 需求流入治理
incoming-request-advisor → 12 段解码报告

### 阶段 3 — 财务与定价影响
finance-based-pricing-advisor + feature-investment-advisor

### 阶段 4 — Epic 拆解与故事拆分
epic-breakdown-advisor + user-story-splitting

### 阶段 5 — 风险降低与验证
derisk-measurement-advisor + pol-probe-advisor

### 阶段 6 — 排布输出
roadmap-planning + user-story-mapping

**产出物**：优先级排序表、需求解码报告、财务影响评估、Epic 拆解清单、风险登记册、分阶段路线图`,
  'agent-orchestrator': `## Agent 工作编排助手

**触发场景**：我每周要做竞品分析 + 用户调研汇总 + 路线图更新，帮我设计自动化工作流

### 阶段 1 — 需求采集
context-engineering-advisor → 理解工作场景、约束条件、战略目标

### 阶段 2 — AI-Shaped 任务判定
agent-orchestration-advisor → 判定是否适合 Agent 编排

### 阶段 3 — Skill 匹配
自动检索 Skills 库 → 按关键词+语义+类型匹配

### 阶段 4 — 工作流拓扑设计
Full Parallel / Pipeline / Hybrid

### 阶段 5 — 边界与交接定义
每个 Skill 的输入输出契约 + 交接规则

### 阶段 6 — 编排方案生成
完整编排方案（拓扑图 + Skill 列表 + 契约 + 时间节省估计）

### 阶段 7 — 建议与优化
skill-authoring-workflow + workshop-facilitation

**产出物**：自动化工作流编排方案、拓扑图、Skill 匹配列表、输入输出契约文档、分周实施计划`,
};

export default function HomePage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [input, setInput] = useState('');
  const [selectedWf, setSelectedWf] = useState<string | null>(null);
  const [modalWf, setModalWf] = useState<string | null>(null);

  const cardOrder = ['idea-refinement','competitive-intel','business-strategy','prd-delivery','prioritization','launch-pipeline','incident-response','build-vs-buy','activation-loop','agent-orchestrator'];

  useEffect(() => {
    fetch('/api/workflows').then(r=>r.json()).then(d=>{setWorkflows(d);setLoading(false)}).catch(()=>setLoading(false));
    fetch('/api/settings').then(r=>r.json()).then(s=>setConfigured(!!s.llmApiKey)).catch(()=>{});
  }, []);

  function handleSend() {
    if (!input.trim()) return;
    if (!configured) { router.push('/settings'); return; }
    const wfId = selectedWf || 'idea-refinement';
    fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({workflowId:wfId, message:input.trim()}) })
      .then(r=>r.json()).then(d=>{ if(d.sessionId) router.push(`/workflow/${wfId}?sid=${d.sessionId}`); }).catch(()=>{});
  }

  function handleKeyDown(e: React.KeyboardEvent) { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); handleSend(); } }

  function startWorkflow(wfId: string) {
    if (!configured) { router.push('/settings'); return; }
    router.push(`/workflow/${wfId}`);
  }

  const ordered = cardOrder.map(id=>workflows.find(w=>w.id===id)).filter(Boolean) as WorkflowCard[];

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />

      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--paper)' }}>
        {/* Header area */}
        <div style={{ flex:1, overflow:'auto', padding:'44px 48px 20px', display:'flex', flexDirection:'column', alignItems:'center' }}>
          <header style={{ marginBottom: 28, textAlign: 'center', maxWidth: 640 }}>
            <h1 className="display" style={{ fontSize: 'clamp(1.5rem, 2.2vw, 1.8rem)', marginBottom: 8 }}>
              你好，今天想做什么？
            </h1>
            <p className="body-text">
              选择一个工作流开始结构化的 PM 流程，或直接在输入框中描述你的需求
            </p>
          </header>

          {loading ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, maxWidth:1080, width:'100%' }}>
              {Array(10).fill(0).map((_,i)=>(
                <div key={i} className="skeleton" style={{ height:170 }} />
              ))}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, maxWidth:1080, width:'100%' }}>
              {ordered.map(wf => {
                const meta = WF_META[wf.id] || { label: wf.name };
                return (
                  <div key={wf.id} className="card"
                    style={{ padding:'16px 14px 14px', display:'flex', flexDirection:'column' }}
                    onClick={() => startWorkflow(wf.id)}>
                    {/* Top row: label + detail button */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <span style={{ fontSize:'0.64rem', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', color:'var(--ink-faint)' }}>
                        {meta.label}
                      </span>
                      {/* Detail button — stop propagation */}
                      <button onClick={(e) => { e.stopPropagation(); setModalWf(wf.id); }}
                        title="查看工作流详情"
                        style={{
                          background:'transparent', border:'1px solid var(--border)', cursor:'pointer',
                          fontSize:'0.6rem', color:'var(--ink-faint)', padding:'2px 7px', borderRadius:3,
                          fontFamily:'inherit', fontWeight:500,
                        }}
                        className="tr-color"
                        onMouseEnter={e1 => { e1.currentTarget.style.color = 'var(--accent)'; e1.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onMouseLeave={e1 => { e1.currentTarget.style.color = 'var(--ink-faint)'; e1.currentTarget.style.borderColor = 'var(--border)'; }}>
                        详情
                      </button>
                    </div>

                    {/* Title */}
                    <h3 style={{
                      fontFamily: '"Inter", sans-serif', fontSize:'0.84rem', fontWeight:600,
                      marginBottom:6, lineHeight:1.3, letterSpacing:'-0.01em', color:'var(--ink)',
                    }}>
                      {wf.name}
                    </h3>

                    {/* Description */}
                    <p style={{ fontSize:'0.73rem', color:'var(--ink-muted)', lineHeight:1.5, flex:1, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {wf.description}
                    </p>

                    {/* Footer */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, fontSize:'0.66rem', color:'var(--ink-faint)', borderTop:'1px solid var(--border-light)', paddingTop:10 }}>
                      <span style={{ fontFamily:'"JetBrains Mono",monospace' }}>{wf.skillCount} Skills · {wf.estimatedTime}</span>
                      <span style={{ fontFamily:'"JetBrains Mono",monospace', color:'var(--accent)', fontWeight:500 }}>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom input bar */}
        <div style={{ padding:'14px 48px 22px', borderTop:'1px solid var(--border)', background:'var(--white)' }}>
          <div style={{ maxWidth:860, margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--white)', borderRadius:5, border:'1px solid var(--border)', padding:'6px 14px' }}>
              {selectedWf && (
                <span style={{
                  fontSize:'0.72rem', fontWeight:600, color:'var(--accent)', background:'var(--accent-bg)',
                  padding:'2px 10px', borderRadius:3, border:'1px solid var(--accent-border)',
                  whiteSpace:'nowrap', fontFamily: '"Inter", sans-serif',
                }}>
                  {ordered.find(w=>w.id===selectedWf)?.name || selectedWf}
                </span>
              )}
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="描述你遇到的问题..."
                style={{ flex:1, border:'none', background:'transparent', fontSize:'0.86rem', outline:'none', padding:'8px 4px', color:'var(--ink)', fontFamily:'"Inter", system-ui, sans-serif' }} />

              {/* Send button with icon */}
              <button onClick={handleSend} disabled={!input.trim()} className="btn-primary"
                style={{ padding:'8px 20px', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:5 }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14 2L7 9M14 2l-4.5 12L7 9 2 5.5z"/></svg>
                发送
              </button>
            </div>

            {/* Quick workflow picks */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:8, paddingLeft:4 }}>
              <span style={{ fontSize:'0.66rem', color:'var(--ink-faint)', padding:'4px 4px', fontWeight:500 }}>快速切换：</span>
              {ordered.map(wf => (
                <button key={wf.id} onClick={() => setSelectedWf(selectedWf === wf.id ? null : wf.id)}
                  style={{
                    background: selectedWf === wf.id ? 'var(--accent)' : 'transparent',
                    color: selectedWf === wf.id ? 'white' : 'var(--ink-muted)',
                    border: selectedWf === wf.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    cursor:'pointer', fontSize:'0.68rem', padding:'3px 10px', borderRadius:3,
                    fontFamily:'"Inter", system-ui, sans-serif', fontWeight: selectedWf === wf.id ? 600 : 400,
                  }} className="tr-color"
                  onMouseEnter={e => { if (selectedWf !== wf.id) { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = 'var(--ink)'; } }}
                  onMouseLeave={e => { if (selectedWf !== wf.id) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink-muted)'; } }}>
                  {wf.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ── Workflow Detail Modal ── */}
      {modalWf && (
        <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.3)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setModalWf(null)}>
          <div className="modal-content" style={{
            background:'white', borderRadius:5, maxWidth:680, width:'90%', maxHeight:'78vh', overflow:'auto',
            padding:'28px 32px', border:'1px solid var(--border)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontFamily:'"Inter", sans-serif', fontSize:'1.05rem', fontWeight:650, letterSpacing:'-0.02em' }}>
                {ordered.find(w=>w.id===modalWf)?.name}
              </h2>
              <button onClick={() => setModalWf(null)} className="btn-ghost" style={{ fontSize:'0.76rem' }}>关闭</button>
            </div>
            <div style={{ whiteSpace:'pre-wrap', fontSize:'0.84rem', lineHeight:1.7, color:'var(--ink)' }}>
              {WF_FULL[modalWf] || (ordered.find(w=>w.id===modalWf) ? `${ordered.find(w=>w.id===modalWf)?.name}\n\n${ordered.find(w=>w.id===modalWf)?.description}` : '详情加载中...')}
            </div>
            <div style={{ marginTop:24, display:'flex', gap:10 }}>
              <button onClick={() => { setModalWf(null); startWorkflow(modalWf); }} className="btn-primary">
                开始此工作流
              </button>
              <button onClick={() => setModalWf(null)} className="btn-ghost">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
