'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

interface WorkflowCard {
  id: string; name: string; emoji: string; description: string; skillCount: number; estimatedTime: string;
}

// Full workflow descriptions from WORKFLOWS_DESIGN.md
const WF_FULL_DESCRIPTIONS: Record<string, string> = {
  'launch-pipeline': `## 🚀 产品发布全流程

**触发场景**："我们要在下个月发布一个新功能，帮我走一遍从准备到上线的全流程"

### Phase 1 — 上市前情报收集
- company-research → 竞争对手在做什么类似发布？
- pestel-analysis → 宏观环境有没有风险？

### Phase 2 — 定位与信息准备
- positioning-statement → 一句话定位
- press-release → 逆向撰写新闻稿（Amazon PR/FAQ 风格）

### Phase 3 — 干系人对齐
- stakeholder-identification → 谁需要被说服？
- stakeholder-mapping → 权力/利益矩阵
- stakeholder-engagement-advisor → 怎么沟通？

### Phase 4 — 发布执行
- eol-message → 端对端消息策略
- organic-growth-advisor → 发布后有机增长计划

### Phase 5 — 发布后复盘
- business-health-diagnostic → 发布后业务健康检查
- derisk-measurement-advisor → 度量指标验证

**产出物**：完整的 Go-To-Market 文档（竞品情报 + 定位声明 + 新闻稿草稿 + 干系人沟通计划 + 发布后增长策略 + 复盘框架）`,

  'incident-response': `## 🔥 产品事故响应与恢复

**触发场景**："我们的核心功能出了严重问题，用户大量流失，需要紧急应对"

### Phase 1 — 紧急诊断
- business-health-diagnostic → 当前业务健康度量化
- problem-framing-canvas → 快速界定问题边界

### Phase 2 — 对内沟通
- problem-statement → 用数据+证据向内部说明发生了什么
- eol-message → 终止/降级消息

### Phase 3 — 对外沟通
- press-release → 面向用户的透明沟通稿
- positioning-statement → 重新锚定信任

### Phase 4 — 根因修复
- epic-hypothesis → 修复方案的假设声明
- user-story-splitting → 拆解修复任务
- incoming-request-advisor → 管理涌入的用户反馈

### Phase 5 — 预防机制
- pol-probe → 评估再次发生的概率
- derisk-measurement-advisor → 建立监控告警

**产出物**：事故响应时间线、对内对外沟通模板、修复任务清单、预防性监控方案`,

  'build-vs-buy': `## 🏗️ Build vs Buy 决策框架

**触发场景**："我们团队在争论自建 AI 推荐系统还是采购第三方服务，需要一个结构化的决策过程"

### Phase 1 — 市场扫描
- tam-sam-som-calculator → 市场规模评估（自建 vs 采购的 TAM 差异）
- company-research → 市面上有哪些成熟供应商？

### Phase 2 — 财务建模
- finance-based-pricing-advisor → 采购成本建模
- saas-economics-efficiency-metrics → 自建的经济性分析
- feature-investment-advisor → 投资回报率对比

### Phase 3 — 技术评估
- context-engineering-advisor → 技术栈兼容性评估
- agent-orchestration-advisor → 如果涉及 AI Agent 的编排复杂度

### Phase 4 — 决策输出
- prioritization-advisor → 多准则决策矩阵
- epic-hypothesis → 最终决策的假设声明 + 验证计划

**产出物**：决策备忘录（成本对比表 + 风险评估 + 推荐方案 + 验证里程碑）`,

  'activation-loop': `## 👤 新用户激活优化

**触发场景**："我们的新用户在注册后 24 小时内流失率高达 70%，需要系统性解决"

### Phase 1 — 旅程映射
- customer-journey-map → 绘制完整的新用户旅程
- jobs-to-be-done → 新用户注册时真正想"雇佣"我们的产品做什么

### Phase 2 — 数据诊断
- saas-revenue-growth-metrics → 激活漏斗量化
- finance-metrics-quickref → LTV/CAC 影响分析

### Phase 3 — 假设生成
- opportunity-solution-tree → 从"降低流失"出发展开所有可能方案
- pol-probe-advisor → 为每个方案标注承诺级别

### Phase 4 — 方案设计
- lean-ux-canvas → 快速原型 UX 方案
- proto-persona → 细分流失用户画像
- user-story → 编写激活功能的故事

### Phase 5 — 实验设计
- discovery-interview-prep → 验证实验前的用户访谈准备
- discovery-process → 设计 A/B 测试和灰度发布计划

**产出物**：激活漏斗分析报告、用户分段时间线、3-5 个可测试的激活方案、A/B 实验设计文档`,

  'idea-refinement': `## 💡 产品想法完善

**触发场景**："我有一个产品想法，但不确定是否靠谱，帮我系统地完善它"

### Phase 1 — 想法初探
- problem-statement → 引导用户回答：谁有问题？问题是什么？为什么痛苦？
- problem-framing-canvas → 结构化问题画布（目标用户、痛点、现有替代方案）

### Phase 2 — 用户深描
- proto-persona → 定义核心用户画像（角色、目标、痛点、行为模式）
- jobs-to-be-done → 挖掘用户"雇佣"产品的真实动机
- customer-journey-map → 描绘用户当前的体验旅程（找到断点）

### Phase 3 — 价值定位
- positioning-statement → 一句话定位
- recommendation-canvas → 定义推荐逻辑

### Phase 4 — 方案构想
- lean-ux-canvas → 快速勾勒 UX 假设
- epic-hypothesis → 将想法转化为可验证的 Epic 假设

### Phase 5 — 约束与风险
- derisk-measurement-advisor → 扫描 10 个风险维度（4 内部 DUFV + 6 外部 PESTEL）
- pol-probe-advisor → 为最高风险选择最便宜的验证探针

### Phase 6 — 输出汇总
- storyboard → 将完善后的想法整理为用户故事板
- eol-message → 生成最终的想法总结与下一步建议

**产出物**：完整想法完善文档（问题陈述、用户画像、JTBD、定位声明、Lean UX 画布、Epic 假设、风险登记册、故事板）`,

  'competitive-intel': `## 🔍 竞品分析报告

**触发场景**："我需要一份完整的竞品分析报告，用于 Q3 战略规划"

### Phase 1 — 竞品识别与分类
- company-research → 对主要竞品进行深度研究
- stakeholder-identification → 识别竞品公司关键决策人

### Phase 2 — 产品功能对比
- positioning-statement → 为每个竞品写一句定位声明，横向对比
- problem-statement → 竞品各自在解决什么问题？
- user-story-mapping → 对比各竞品功能覆盖范围和用户旅程

### Phase 3 — 市场与行业分析
- pestel-analysis → 宏观环境对各竞品的影响差异
- tam-sam-som-calculator → 各竞品所在细分市场的大小和机会
- saas-revenue-growth-metrics → 竞品的营收增长模式分析

### Phase 4 — 商业模式与定价
- finance-based-pricing-advisor → 竞品定价策略分析
- feature-investment-advisor → 竞品功能投资方向分析
- saas-economics-efficiency-metrics → 竞品单位经济性分析

### Phase 5 — 用户与市场感知
- customer-journey-map → 对比竞品与自己的用户旅程差异
- discovery-interview-prep → 设计用户调研问题，验证竞品口碑

### Phase 6 — 风险与机会
- opportunity-solution-tree → 从竞品分析中提炼机会点
- derisk-measurement-advisor → 评估竞品威胁优先级（act vs watch）

### Phase 7 — 报告整合
- storyboard + press-release + eol-message → 生成完整竞品报告

**产出物**：竞品画像矩阵、功能对比表、定价分析、用户旅程对比、市场机会地图、风险登记册、差异化叙事`,

  'business-strategy': `## 📊 商业分析与战略布局

**触发场景**："基于完善后的产品想法和竞品分析，我需要一份完整的商业分析报告"

### Phase 1 — 战略定位
- positioning-workshop → 工作坊形式确定战略定位
- product-strategy-session → 全链路战略会话

### Phase 2 — 市场规模与机会
- tam-sam-som-calculator → TAM/SAM/SOM 量化计算
- pestel-analysis → 宏观趋势对市场机会的影响

### Phase 3 — 商业模式设计
- recommendation-canvas → 商业模式核心推荐逻辑
- feature-investment-advisor + organic-growth-advisor

### Phase 4 — 财务计划
- finance-based-pricing-advisor → 定价模型与收入预测
- saas-economics-efficiency-metrics → LTV/CAC、毛利率、回收期
- saas-revenue-growth-metrics → 营收增长预测

### Phase 5 — 投资方向
- feature-investment-advisor → 投资优先级矩阵
- epic-hypothesis + prioritization-advisor

### Phase 6 — 风险评估
- derisk-measurement-advisor → 10 维度风险扫描
- business-health-diagnostic → 整体业务健康基线

### Phase 7 — 报告整合
- roadmap-planning + storyboard → 分阶段路线图

**产出物**：战略定位声明、TAM/SAM/SOM 测算、商业模式画布、财务预测模型、投资优先级矩阵、风险登记册、分阶段路线图`,

  'prd-delivery': `## 📝 PRD 与交付

**触发场景**："基于完善的产品想法、竞品分析、商业报告，生成完整的 PRD"

### Phase 1 — Executive Summary
整合上游产出的 Epic 假设 + 战略定位

### Phase 2 — Problem Statement
problem-statement + problem-framing-canvas → 结构化问题陈述

### Phase 3 — Target Users & Personas
proto-persona + jobs-to-be-done → 用户画像深化

### Phase 4 — Strategic Context
引用商业报告：TAM/SAM/SOM、竞品定位对比、财务目标

### Phase 5 — Solution Overview
lean-ux-canvas + user-story-mapping + storyboard

### Phase 6 — Success Metrics
引用财务计划的 ARPU/LTV/CAC 目标

### Phase 7 — User Stories & Requirements
epic-hypothesis → epic-breakdown-advisor (Richard Lawrence 9 种模式) → user-story + user-story-splitting

### Phase 8 — Out of Scope & Dependencies
incoming-request-advisor + pestel-analysis → 明确边界

**产出物**：完整工程就绪 PRD（问题陈述、用户画像、战略上下文、解决方案、成功指标、用户故事+验收标准、Out of Scope、依赖与风险）`,

  'prioritization': `## 🎯 需求排布

**触发场景**："PRD 完成了，需求很多但资源有限，帮我排优先级"

### Phase 1 — 框架选择
prioritization-advisor → 推荐 RICE / ICE / Value-Effort / Kano

### Phase 2 — 需求流入治理
incoming-request-advisor → 12 段解码报告（区分表面诉求 vs 真实 JTBD）

### Phase 3 — 财务与定价影响
finance-based-pricing-advisor + feature-investment-advisor → ROI 评估

### Phase 4 — Epic 拆解与故事拆分
epic-breakdown-advisor (Richard Lawrence 9 种模式) + user-story-splitting

### Phase 5 — 风险降低与验证
derisk-measurement-advisor (10 维度 DUFV+PESTEL) + pol-probe-advisor

### Phase 6 — 排布输出
roadmap-planning + user-story-mapping → Now-Next-Later 路线图

**产出物**：优先级排序表、需求解码报告、财务影响评估、Epic 拆解清单、风险登记册、分阶段路线图`,

  'agent-orchestrator': `## 🤖 Agent 工作编排助手

**触发场景**："我每周要做竞品分析 + 用户调研汇总 + 路线图更新，帮我设计自动化工作流"

### Phase 1 — 需求采集
context-engineering-advisor → 理解工作场景、约束条件、战略目标

### Phase 2 — AI-Shaped 任务判定
agent-orchestration-advisor → 判定是否适合 Agent 编排

### Phase 3 — Skill 匹配
自动检索 Skills 库 → 按关键词+语义+类型匹配

### Phase 4 — 工作流拓扑设计
Full Parallel / Pipeline / Hybrid → 最佳拓扑

### Phase 5 — 边界与交接定义
每个 Skill 的输入输出契约 + 交接规则

### Phase 6 — 编排方案生成
完整编排方案（拓扑图 + Skill 列表 + 契约 + 时间节省估计）

### Phase 7 — 建议与优化
skill-authoring-workflow + workshop-facilitation → 实施建议

**产出物**：自动化工作流编排方案、拓扑图、Skill 匹配列表、输入输出契约文档、分周实施计划`,
};

export default function HomePage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [input, setInput] = useState('');
  const [showWfPicker, setShowWfPicker] = useState(false);
  const [selectedWf, setSelectedWf] = useState<string | null>(null);
  const [modalWf, setModalWf] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Card order: 5,6,7,8,9,1,2,3,4,10
  const cardOrder = ['idea-refinement','competitive-intel','business-strategy','prd-delivery','prioritization','launch-pipeline','incident-response','build-vs-buy','activation-loop','agent-orchestrator'];

  useEffect(() => {
    fetch('/api/workflows').then(r=>r.json()).then(d=>{setWorkflows(d);setLoading(false)}).catch(()=>setLoading(false));
    fetch('/api/settings').then(r=>r.json()).then(s=>setConfigured(!!s.llmApiKey)).catch(()=>{});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowWfPicker(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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

  function cancelWorkflow(e: React.MouseEvent) { e.stopPropagation(); setSelectedWf(null); setShowWfPicker(false); }

  const ordered = cardOrder.map(id=>workflows.find(w=>w.id===id)).filter(Boolean) as WorkflowCard[];

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />

      {/* Main */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--paper)' }}>
        <div style={{ flex:1, overflow:'auto', padding:'32px 40px 20px', display:'flex', flexDirection:'column', alignItems:'center' }}>
          <div style={{ fontSize:'3rem', marginBottom:12 }}>📋</div>
          <h1 style={{ fontFamily:"'Newsreader','Noto Serif SC',Georgia,serif", fontSize:'2rem', fontWeight:450, marginBottom:6, textAlign:'center' }}>
            你好，有什么可以帮助你的？
          </h1>
          <p style={{ fontSize:'0.9rem', color:'var(--ink-muted)', marginBottom:40, textAlign:'center' }}>
            选择下方工作流开始，或在输入框自由提问
          </p>

          {loading ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, maxWidth:1100, width:'100%' }}>
              {Array(10).fill(0).map((_,i)=>(<div key={i} style={{background:'#f3f1ed', borderRadius:10, height:150}}/>))}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, maxWidth:1100, width:'100%' }}>
              {ordered.map(wf=>(
                <div key={wf.id} className="card-hover tr"
                  style={{ background:'var(--white)', borderRadius:10, border:'1px solid var(--border)', padding:'20px 18px', cursor:'pointer', display:'flex', flexDirection:'column', position:'relative' }}
                  onClick={()=>startWorkflow(wf.id)}>
                  <div style={{ fontSize:'1.8rem', marginBottom:8 }}>{wf.emoji}</div>
                  <h3 style={{ fontSize:'0.9rem', fontWeight:600, marginBottom:4 }}>{wf.name}</h3>
                  <p style={{ fontSize:'0.78rem', color:'var(--ink-muted)', lineHeight:1.45, flex:1, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{wf.description}</p>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, fontSize:'0.75rem', color:'var(--ink-faint)' }}>
                    <span>{wf.skillCount} Skills · {wf.estimatedTime}</span>
                    <button onClick={e=>{e.stopPropagation();setModalWf(wf.id);}}
                      style={{ background:'transparent',border:'none',cursor:'pointer',fontSize:'0.85rem',color:'var(--ink-faint)',padding:'2px 4px',borderRadius:4 }}
                      className="tr" title="查看详情"
                      onMouseEnter={e2=>{e2.currentTarget.style.color='var(--accent)'}}
                      onMouseLeave={e2=>{e2.currentTarget.style.color='var(--ink-faint)'}}
                    >👁</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Input Bar */}
        <div style={{ padding:'12px 40px 20px', borderTop:'1px solid var(--border)', background:'var(--white)' }}>
          <div style={{ maxWidth:860, margin:'0 auto', display:'flex', alignItems:'center', gap:10, background:'var(--paper)', borderRadius:12, border:'1px solid var(--border)', padding:'6px 10px' }}>
            <button title="上传文件" style={{ background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',padding:'4px 6px',color:'var(--ink-muted)',borderRadius:6 }}
              className="tr" onMouseEnter={e=>{e.currentTarget.style.background='var(--sidebar-hover)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}
            >📎</button>
            <button title="上传图片" style={{ background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',padding:'4px 6px',color:'var(--ink-muted)',borderRadius:6 }}
              className="tr" onMouseEnter={e=>{e.currentTarget.style.background='var(--sidebar-hover)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}
            >🖼</button>

            <input type="text" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="输入你的问题，或选择一个工作流..."
              style={{ flex:1, border:'none', background:'transparent', fontSize:'0.9rem', outline:'none', padding:'8px 4px' }} />

            {/* Workflow picker */}
            <div style={{ position:'relative' }} ref={pickerRef}>
              <button onClick={()=>setShowWfPicker(!showWfPicker)}
                title="选择工作流"
                style={{ background: selectedWf?'var(--accent)':'transparent', color: selectedWf?'white':'var(--ink-muted)', border:'none', cursor:'pointer', fontSize:'1rem', padding:'6px 8px', borderRadius:6 }}
                className="tr"
                onMouseEnter={e=>{ if(!selectedWf) e.currentTarget.style.background='var(--sidebar-hover)' }}
                onMouseLeave={e=>{ if(!selectedWf) e.currentTarget.style.background='transparent' }}
              >⚡</button>
              {showWfPicker && (
                <div style={{ position:'absolute', bottom:44, right:0, background:'white', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 4px 24px rgba(0,0,0,0.1)', padding:'6px', minWidth:240, zIndex:100 }}>
                  {ordered.map(wf=>(
                    <div key={wf.id} onClick={()=>{setSelectedWf(wf.id);setShowWfPicker(false);}}
                      style={{ padding:'8px 12px', borderRadius:6, cursor:'pointer', fontSize:'0.85rem', display:'flex', alignItems:'center', gap:8 }}
                      className="tr"
                      onMouseEnter={e=>{e.currentTarget.style.background='var(--sidebar-hover)'}}
                      onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}
                    ><span>{wf.emoji}</span><span>{wf.name}</span></div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleSend} disabled={!input.trim()}
              style={{ background:input.trim()?'var(--accent)':'#e0ddda', color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontSize:'0.85rem', fontWeight:500, cursor:input.trim()?'pointer':'not-allowed' }}
            >发送</button>
          </div>

          {/* Selected workflow badge — inline with x to cancel */}
          {selectedWf && (
            <div style={{ maxWidth:860, margin:'6px auto 0', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:'0.78rem', background:'var(--paper-warm)', padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:6 }}>
                {ordered.find(w=>w.id===selectedWf)?.emoji} {ordered.find(w=>w.id===selectedWf)?.name}
                <button onClick={()=>setSelectedWf(null)} title="取消选择"
                  style={{ background:'none',border:'none',cursor:'pointer',fontSize:'0.85rem',color:'var(--ink-faint)',padding:0,lineHeight:1 }}
                >✕</button>
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Workflow Detail Modal */}
      {modalWf && (
        <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setModalWf(null)}>
          <div className="modal-content" style={{ background:'white', borderRadius:14, maxWidth:680, width:'90%', maxHeight:'80vh', overflow:'auto', padding:'32px', boxShadow:'0 24px 64px rgba(0,0,0,0.15)', position:'relative' }}
            onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setModalWf(null)}
              style={{ position:'absolute', top:16, right:20, background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--ink-faint)' }}>✕</button>
            <div style={{ whiteSpace:'pre-wrap', fontSize:'0.88rem', lineHeight:1.65 }}>
              {WF_FULL_DESCRIPTIONS[modalWf] || `## ${ordered.find(w=>w.id===modalWf)?.name}\n\n详情加载中...`}
            </div>
            <div style={{ marginTop:24, display:'flex', gap:10 }}>
              <button onClick={()=>{setModalWf(null);startWorkflow(modalWf);}}
                style={{ padding:'10px 20px', background:'var(--accent)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:'0.9rem', fontWeight:500 }}
              >开始此工作流</button>
              <button onClick={()=>setModalWf(null)}
                style={{ padding:'10px 20px', background:'transparent', color:'var(--ink-muted)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', fontSize:'0.9rem' }}
              >关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
