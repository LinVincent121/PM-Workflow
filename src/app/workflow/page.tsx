'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useRouter } from 'next/navigation';

interface WorkflowCard {
  id: string; name: string; emoji: string; description: string; skillCount: number; estimatedTime: string;
}

const WF_DETAILS: Record<string, string> = {
  'launch-pipeline': `### Phase 1 — 上市前情报收集
company-research + pestel-analysis

### Phase 2 — 定位与信息准备
positioning-statement + press-release

### Phase 3 — 干系人对齐
stakeholder-identification + stakeholder-mapping + stakeholder-engagement-advisor

### Phase 4 — 发布执行
eol-message + organic-growth-advisor

### Phase 5 — 发布后复盘
business-health-diagnostic + derisk-measurement-advisor

**产出物**：Go-To-Market文档、干系人沟通计划、发布消息策略、复盘框架`,
  'incident-response': `### Phase 1 — 紧急诊断
business-health-diagnostic + problem-framing-canvas

### Phase 2 — 对内沟通
problem-statement + eol-message

### Phase 3 — 对外沟通
press-release + positioning-statement

### Phase 4 — 根因修复
epic-hypothesis + user-story-splitting + incoming-request-advisor

### Phase 5 — 预防机制
pol-probe + derisk-measurement-advisor

**产出物**：事故响应时间线、沟通模板、修复清单、预防方案`,
  'build-vs-buy': `### Phase 1 — 市场扫描
tam-sam-som-calculator + company-research

### Phase 2 — 财务建模
finance-based-pricing-advisor + saas-economics-efficiency-metrics + feature-investment-advisor

### Phase 3 — 技术评估
context-engineering-advisor + agent-orchestration-advisor

### Phase 4 — 决策输出
prioritization-advisor + epic-hypothesis

**产出物**：决策备忘录、成本对比表、风险评估、验证里程碑`,
  'activation-loop': `### Phase 1 — 旅程映射
customer-journey-map + jobs-to-be-done

### Phase 2 — 数据诊断
saas-revenue-growth-metrics + finance-metrics-quickref

### Phase 3 — 假设生成
opportunity-solution-tree + pol-probe-advisor

### Phase 4 — 方案设计
lean-ux-canvas + proto-persona + user-story

### Phase 5 — 实验设计
discovery-interview-prep + discovery-process

**产出物**：激活漏斗报告、旅程断点图、3-5个方案、A/B实验设计`,
  'idea-refinement': `### Phase 1 — 想法初探
problem-statement + problem-framing-canvas

### Phase 2 — 用户深描
proto-persona + jobs-to-be-done + customer-journey-map

### Phase 3 — 价值定位
positioning-statement + recommendation-canvas

### Phase 4 — 方案构想
lean-ux-canvas + epic-hypothesis

### Phase 5 — 约束与风险
derisk-measurement-advisor + pol-probe-advisor

### Phase 6 — 输出汇总
storyboard + eol-message

**产出物**：完整想法文档、用户画像、JTBD、定位、风险登记册`,
  'competitive-intel': `### Phase 1 — 竞品识别与分类
company-research + stakeholder-identification

### Phase 2 — 产品功能对比
positioning-statement + problem-statement + user-story-mapping

### Phase 3 — 市场与行业分析
pestel-analysis + tam-sam-som-calculator + saas-revenue-growth-metrics

### Phase 4 — 商业模式与定价
finance-based-pricing-advisor + feature-investment-advisor

### Phase 5 — 用户与市场感知
customer-journey-map + discovery-interview-prep

### Phase 6 — 风险与机会
opportunity-solution-tree + derisk-measurement-advisor

### Phase 7 — 报告整合
storyboard + press-release + eol-message

**产出物**：竞品画像矩阵、功能对比表、定价分析、机会地图`,
  'business-strategy': `### Phase 1 — 战略定位
positioning-workshop + product-strategy-session

### Phase 2 — 市场规模与机会
tam-sam-som-calculator + pestel-analysis

### Phase 3 — 商业模式设计
recommendation-canvas + feature-investment-advisor + organic-growth-advisor

### Phase 4 — 财务计划
finance-based-pricing-advisor + saas-economics-efficiency-metrics + saas-revenue-growth-metrics

### Phase 5 — 投资方向
feature-investment-advisor + epic-hypothesis + prioritization-advisor

### Phase 6 — 风险评估
derisk-measurement-advisor + business-health-diagnostic

### Phase 7 — 报告整合
roadmap-planning + storyboard + press-release + eol-message

**产出物**：战略定位声明、TAM/SAM/SOM测算、商业模式画布、财务预测、投资矩阵、路线图`,
  'prd-delivery': `### Phase 1 — Executive Summary
整合上游的 Epic 假设 + 战略定位

### Phase 2 — Problem Statement
problem-statement + problem-framing-canvas

### Phase 3 — Target Users & Personas
proto-persona + jobs-to-be-done

### Phase 4 — Strategic Context
引用商业报告数据（TAM/SAM/SOM、竞品、财务）

### Phase 5 — Solution Overview
lean-ux-canvas + user-story-mapping + storyboard

### Phase 6 — Success Metrics
ARPU/LTV/CAC 目标 + derisk-measurement-advisor

### Phase 7 — User Stories & Requirements
epic-hypothesis + epic-breakdown-advisor + user-story + user-story-splitting

### Phase 8 — Out of Scope & Dependencies
incoming-request-advisor + pestel-analysis

**产出物**：完整工程就绪 PRD`,
  'prioritization': `### Phase 1 — 框架选择
prioritization-advisor → RICE / ICE / Value-Effort / Kano

### Phase 2 — 需求流入治理
incoming-request-advisor → 12段解码报告

### Phase 3 — 财务与定价影响
finance-based-pricing-advisor + feature-investment-advisor

### Phase 4 — Epic 拆解与故事拆分
epic-breakdown-advisor + user-story-splitting

### Phase 5 — 风险降低与验证
derisk-measurement-advisor + pol-probe-advisor + pol-probe

### Phase 6 — 排布输出
roadmap-planning + user-story-mapping + recommendation-canvas

**产出物**：优先级排序表、解码报告、财务评估、Epic清单、路线图`,
  'agent-orchestrator': `### Phase 1 — 需求采集
context-engineering-advisor

### Phase 2 — AI-Shaped 任务判定
agent-orchestration-advisor

### Phase 3 — Skill 匹配
自动关键词+语义+类型匹配

### Phase 4 — 工作流拓扑设计
Full Parallel / Pipeline / Hybrid

### Phase 5 — 边界与交接定义
输入输出契约 + 交接规则

### Phase 6 — 编排方案生成
拓扑图 + Skill 列表 + 契约 + 实施计划

### Phase 7 — 建议与优化
skill-authoring-workflow + workshop-facilitation

**产出物**：编排方案、拓扑图、Skill匹配列表、实施建议`,
};

export default function WorkflowManagePage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewWf, setViewWf] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/workflows').then(r=>r.json()).then(d=>{setWorkflows(d);setLoading(false)}).catch(()=>setLoading(false));
  }, []);

  // Display order
  const cardOrder = ['idea-refinement','competitive-intel','business-strategy','prd-delivery','prioritization','launch-pipeline','incident-response','build-vs-buy','activation-loop','agent-orchestrator'];
  const ordered = cardOrder.map(id=>workflows.find(w=>w.id===id)).filter(Boolean) as WorkflowCard[];

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <main style={{ flex:1, overflow:'auto', padding:'32px 40px' }}>
        <h1 className="display" style={{ marginBottom:8 }}>工作流管理</h1>
        <p className="body" style={{ marginBottom:32 }}>管理 10 个 PM 工作流，查看详情、编排逻辑和关联的 Skills</p>

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:16 }}>
            {Array(10).fill(0).map((_,i)=>(<div key={i} style={{background:'#f3f1ed',borderRadius:10,height:160}}/>))}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:16 }}>
            {ordered.map(wf=>(
              <div key={wf.id} className="card-hover tr"
                style={{ background:'white', borderRadius:10, border:'1px solid var(--border)', padding:'22px', cursor:'pointer', display:'flex', flexDirection:'column' }}
                onClick={()=>setViewWf(wf.id)}>
                <div style={{ fontSize:'1.6rem', marginBottom:8 }}>{wf.emoji}</div>
                <h3 style={{ fontSize:'1rem', fontWeight:600, marginBottom:4 }}>{wf.name}</h3>
                <p style={{ fontSize:'0.8rem', color:'var(--ink-muted)', lineHeight:1.5, marginBottom:12 }}>{wf.description}</p>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', color:'var(--ink-faint)', marginTop:'auto' }}>
                  <span>{wf.skillCount} Skills</span>
                  <button onClick={e=>{e.stopPropagation();router.push(`/workflow/${wf.id}`);}}
                    style={{ background:'var(--accent)',color:'white',border:'none',borderRadius:6,padding:'6px 14px',fontSize:'0.8rem',cursor:'pointer',fontWeight:500 }}
                  >启动工作流</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Workflow Detail Modal */}
        {viewWf && (
          <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={()=>setViewWf(null)}>
            <div className="modal-content" style={{ background:'white', borderRadius:14, maxWidth:680, width:'90%', maxHeight:'80vh', overflow:'auto', padding:'32px', boxShadow:'0 24px 64px rgba(0,0,0,0.15)', position:'relative' }}
              onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setViewWf(null)}
                style={{ position:'absolute', top:16, right:20, background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--ink-faint)' }}>✕</button>
              <h2 style={{ fontSize:'1.3rem', fontWeight:600, marginBottom:16 }}>{ordered.find(w=>w.id===viewWf)?.emoji} {ordered.find(w=>w.id===viewWf)?.name}</h2>
              <div style={{ whiteSpace:'pre-wrap', fontSize:'0.88rem', lineHeight:1.65 }}>
                {WF_DETAILS[viewWf] || '详情加载中...'}
              </div>
              <div style={{ marginTop:20, display:'flex', gap:10 }}>
                <button onClick={()=>{setViewWf(null);router.push(`/workflow/${viewWf}`);}}
                  style={{ padding:'10px 20px', background:'var(--accent)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:'0.9rem', fontWeight:500 }}
                >启动此工作流</button>
                <button onClick={()=>setViewWf(null)}
                  style={{ padding:'10px 20px', background:'transparent', color:'var(--ink-muted)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', fontSize:'0.9rem' }}
                >关闭</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
