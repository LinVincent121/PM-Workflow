'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useRouter } from 'next/navigation';

interface WorkflowCard {
  id: string; name: string; emoji: string; description: string; skillCount: number; estimatedTime: string;
}

const WF_NAMES: Record<string, string> = {
  'idea-refinement': 'Idea Refinement',
  'competitive-intel': 'Competitive Intel',
  'business-strategy': 'Business Strategy',
  'prd-delivery': 'PRD Delivery',
  'prioritization': 'Prioritization',
  'launch-pipeline': 'Launch Pipeline',
  'incident-response': 'Incident Response',
  'build-vs-buy': 'Build vs Buy',
  'activation-loop': 'Activation Loop',
  'agent-orchestrator': 'Agent Orchestrator',
};

export default function WorkflowPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/workflows').then(r=>r.json()).then(d=>{setWorkflows(d);setLoading(false)}).catch(()=>setLoading(false));
  }, []);

  const cardOrder = ['idea-refinement','competitive-intel','business-strategy','prd-delivery','prioritization','launch-pipeline','incident-response','build-vs-buy','activation-loop','agent-orchestrator'];
  const ordered = cardOrder.map(id=>workflows.find(w=>w.id===id)).filter(Boolean) as WorkflowCard[];

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <main style={{ flex:1, overflow:'auto', padding:'40px 48px' }}>
        <header style={{ marginBottom: 28 }}>
          <h1 className="display" style={{ fontSize:'clamp(1.4rem, 2vw, 1.7rem)', marginBottom:6 }}>工作流</h1>
          <p className="body-text">10 个结构化 PM 工作流，每个编排多个 Skills 跨阶段执行。</p>
        </header>

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:12 }}>
            {Array(10).fill(0).map((_,i)=>(<div key={i} className="skeleton" style={{height:180}}/>))}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:12 }}>
            {ordered.map(wf => (
              <div key={wf.id} className="card" style={{ padding:'20px 22px', display:'flex', flexDirection:'column' }}
                onClick={() => router.push(`/workflow/${wf.id}`)}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ fontSize:'0.65rem', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', color:'var(--ink-faint)' }}>
                    {WF_NAMES[wf.id] || wf.name}
                  </span>
                  <span style={{ fontSize:'0.62rem', color:'var(--ink-ghost)', fontFamily:"'JetBrains Mono',monospace" }}>
                    {wf.skillCount} Skills
                  </span>
                </div>

                <h3 style={{ fontFamily:'Inter, sans-serif', fontSize:'0.92rem', fontWeight:600, marginBottom:6, letterSpacing:'-0.01em' }}>
                  {wf.name}
                </h3>
                <p style={{ fontSize:'0.78rem', color:'var(--ink-muted)', lineHeight:1.55, flex:1 }}>
                  {wf.description}
                </p>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.68rem', marginTop:14, borderTop:'1px solid var(--border-light)', paddingTop:14 }}>
                  <span style={{ color:'var(--ink-faint)', fontFamily:"'JetBrains Mono',monospace" }}>{wf.estimatedTime}</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", color:'var(--accent)', fontWeight:500 }}>Launch →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
