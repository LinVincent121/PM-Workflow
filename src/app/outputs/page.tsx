'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface OutputItem {
  outputId: string; sessionId: string; workflowId: string;
  title: string; version: string; content: string;
  createdAt: string; updatedAt: string;
  versions?: VersionItem[];
}
interface VersionItem {
  versionId: string; content: string; version: string; title: string; createdAt: string;
}

const WF_LABELS: Record<string, string> = {
  'idea-refinement':'想法完善','competitive-intel':'竞品分析','business-strategy':'商业战略',
  'prd-delivery':'PRD 交付','prioritization':'需求排布','launch-pipeline':'发布流程',
  'incident-response':'事故响应','build-vs-buy':'自建外购','activation-loop':'激活优化',
  'agent-orchestrator':'Agent 编排',
};

function timeAgo(ts: string): string {
  if (!ts) return '--';
  const d = new Date(ts); if (isNaN(d.getTime())) return '--';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff/60000);
  if (mins<1) return '刚刚'; if (mins<60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins/60);
  if (hrs<24) return `${hrs} 小时前`;
  const days = Math.floor(hrs/24);
  if (days<30) return `${days} 天前`;
  return d.toLocaleDateString('zh-CN',{month:'short',day:'numeric'});
}

export default function OutputsPage() {
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string|null>(null);
  const [renameText, setRenameText] = useState('');
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [expandedVersions, setExpandedVersions] = useState<VersionItem[]>([]);
  const [previewVersion, setPreviewVersion] = useState<VersionItem|null>(null);

  function loadOutputs() {
    fetch('/api/outputs').then(r=>r.json()).then(data=>setOutputs(Array.isArray(data)?data:[])).catch(()=>{}).finally(()=>setLoading(false));
  }
  useEffect(()=>{loadOutputs();},[]);

  function handleDelete(outputId: string) {
    if (!confirm('确定删除此产出？')) return;
    fetch('/api/outputs',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({outputId})}).then(()=>loadOutputs()).catch(()=>{});
  }
  function toggleVersions(outputId: string) {
    if (expandedId===outputId) { setExpandedId(null); setExpandedVersions([]); return; }
    setExpandedId(outputId);
    fetch(`/api/outputs?outputId=${encodeURIComponent(outputId)}`).then(r=>r.json()).then(d=>setExpandedVersions(d.versions||[])).catch(()=>setExpandedVersions([]));
  }
  function startRename(o: OutputItem) { setRenamingId(o.outputId); setRenameText(o.title); }
  function commitRename(outputId: string) {
    if (!renameText.trim()) { setRenamingId(null); return; }
    fetch('/api/outputs',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({outputId,title:renameText.trim()})})
      .then(()=>{setOutputs(prev=>prev.map(o=>o.outputId===outputId?{...o,title:renameText.trim()}:o));}).catch(()=>{});
    setRenamingId(null);
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <main style={{ flex:1, overflow:'auto', padding:'40px 48px' }}>
        <header style={{ marginBottom:28 }}>
          <h1 className="display" style={{ fontSize:'clamp(1.4rem, 2vw, 1.7rem)', marginBottom:6 }}>工作产出</h1>
          <p className="body-text">完成工作流对话后保存的产出内容。</p>
        </header>

        {loading && <div style={{ fontSize:'0.82rem', color:'var(--ink-faint)' }}>加载中…</div>}

        {!loading && outputs.length===0 && (
          <div style={{ textAlign:'center', padding:'64px 0', color:'var(--ink-faint)' }}>
            <div style={{ fontFamily:'Inter, sans-serif', fontSize:'1.1rem', fontWeight:500, marginBottom:8, color:'var(--ink-muted)' }}>
              暂无工作产出
            </div>
            <p style={{ fontSize:'0.82rem', maxWidth:320, margin:'0 auto 14px', lineHeight:1.6 }}>
              完成工作流对话后，在 AI 回复中点击「导入编辑」并保存即可在此查看。
            </p>
            <Link href="/" style={{ color:'var(--accent)', textDecoration:'none', fontWeight:600, fontSize:'0.82rem' }}>
              开始新任务 →
            </Link>
          </div>
        )}

        {!loading && outputs.length>0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(330px, 1fr))', gap:12 }}>
            {outputs.map(o=>(
              <div key={o.outputId} className="card" style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:8 }}>
                {renamingId===o.outputId?(
                  <input value={renameText} onChange={e=>setRenameText(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')commitRename(o.outputId);if(e.key==='Escape')setRenamingId(null);}}
                    onBlur={()=>commitRename(o.outputId)} autoFocus onClick={e=>e.stopPropagation()}
                    className="input" style={{ fontSize:'0.88rem', fontWeight:600, padding:'6px 10px' }} />
                ):(
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontFamily:'Inter, sans-serif', fontSize:'0.92rem', fontWeight:600, letterSpacing:'-0.01em' }}>{o.title}</span>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={()=>startRename(o)} className="btn-ghost" style={{ padding:'2px 6px', fontSize:'0.62rem' }}>重命名</button>
                      <button onClick={()=>handleDelete(o.outputId)} className="btn-ghost" style={{ padding:'2px 6px', fontSize:'0.62rem' }}>删除</button>
                    </div>
                  </div>
                )}
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span className="badge">{o.version}</span>
                  <span style={{ fontSize:'0.7rem', color:'var(--ink-faint)' }}>
                    {WF_LABELS[o.workflowId]||o.workflowId}
                  </span>
                </div>
                <div style={{ fontSize:'0.76rem', color:'var(--ink-muted)', lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {o.content.substring(0,130)}…
                </div>
                <button onClick={()=>toggleVersions(o.outputId)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'0.68rem',color:'var(--accent)',padding:0,fontFamily:'inherit',alignSelf:'flex-start' }}>
                  {expandedId===o.outputId?'收起版本':'版本历史'}
                </button>
                {expandedId===o.outputId&&(
                  <div style={{ borderTop:'1px solid var(--border-light)', paddingTop:8 }}>
                    {expandedVersions.length===0?(
                      <div style={{ fontSize:'0.68rem', color:'var(--ink-faint)' }}>加载中…</div>
                    ):(
                      <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:150, overflowY:'auto' }}>
                        {expandedVersions.map((v,vi)=>(
                          <div key={v.versionId} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'3px 8px', borderRadius:3, fontSize:'0.7rem', background:vi===0?'var(--sidebar-hover)':'transparent' }}>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <span style={{ fontWeight:600, fontFamily:"'JetBrains Mono',monospace", color:'var(--accent)' }}>{v.version}</span>
                              <span style={{ color:'var(--ink-muted)' }}>{v.title}</span>
                              {vi===0&&<span style={{ fontSize:'0.58rem', color:'var(--green-text)', background:'var(--green-bg)', padding:'0 4px', borderRadius:2 }}>最新</span>}
                            </div>
                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                              <span style={{ color:'var(--ink-faint)', fontSize:'0.62rem' }}>{timeAgo(v.createdAt)}</span>
                              <button onClick={()=>setPreviewVersion(v)} className="btn-ghost" style={{ padding:'1px 6px', fontSize:'0.6rem' }}>查看</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.64rem', color:'var(--ink-faint)', marginTop:'auto', borderTop:'1px solid var(--border-light)', paddingTop:10 }}>
                  <span>{timeAgo(o.updatedAt)}</span>
                  <Link href={`/workflow/${o.workflowId}?sid=${o.sessionId}`} style={{ color:'var(--accent)', textDecoration:'none', fontWeight:500, fontSize:'0.72rem' }}>查看来源 →</Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {previewVersion&&(
          <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.3)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={()=>setPreviewVersion(null)}>
            <div className="modal-content" style={{ background:'white', borderRadius:5, maxWidth:680, width:'90%', maxHeight:'82vh', overflow:'auto', padding:'28px 32px', border:'1px solid var(--border)' }}
              onClick={e=>e.stopPropagation()}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div>
                  <span className="badge">{previewVersion.version}</span>
                  <span style={{ marginLeft:8, fontFamily:'Inter,sans-serif', fontWeight:600, fontSize:'0.95rem' }}>{previewVersion.title}</span>
                </div>
                <button onClick={()=>setPreviewVersion(null)} className="btn-ghost" style={{ fontSize:'0.74rem' }}>关闭</button>
              </div>
              <div className="caption" style={{ marginBottom:12 }}>
                保存于 {new Date(previewVersion.createdAt).toLocaleString('zh-CN')}
              </div>
              <div style={{ border:'1px solid var(--border)', borderRadius:3, padding:'14px 18px', background:'var(--sidebar-bg)', maxHeight:'50vh', overflow:'auto' }}>
                <div style={{ fontSize:'0.82rem', lineHeight:1.65, whiteSpace:'pre-wrap', color:'var(--ink)' }}>{previewVersion.content}</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
