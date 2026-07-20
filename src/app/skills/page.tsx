'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

interface SkillItem {
  id: string; name: string; description: string; type: string;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewSkill, setViewSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState('');

  useEffect(() => {
    fetch('/api/skills/list').then(r=>r.json()).then(d=>{setSkills(d||[]);setLoading(false)}).catch(()=>setLoading(false));
  }, []);

  function openSkill(id: string) {
    setViewSkill(id);
    fetch(`/api/skills/${id}`).then(r=>r.json()).then(d=>setSkillContent(d.content||'')).catch(()=>setSkillContent('加载失败'));
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <main style={{ flex:1, overflow:'auto', padding:'32px 40px' }}>
        <h1 className="display" style={{ marginBottom:8 }}>Skills 管理</h1>
        <p className="body" style={{ marginBottom:32 }}>当前 pm-skills 目录中的所有技能文档</p>

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:14 }}>
            {Array(12).fill(0).map((_,i)=>(<div key={i} style={{background:'#f3f1ed',borderRadius:10,height:140}}/>))}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:14 }}>
            {skills.map(s=>(
              <div key={s.id} className="card-hover tr"
                style={{ background:'white', borderRadius:10, border:'1px solid var(--border)', padding:'20px', cursor:'pointer' }}
                onClick={()=>openSkill(s.id)}>
                <div style={{ fontSize:'0.75rem', color:'var(--ink-faint)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.type}</div>
                <h3 style={{ fontSize:'0.95rem', fontWeight:600, marginBottom:6 }}>{s.name}</h3>
                <p style={{ fontSize:'0.8rem', color:'var(--ink-muted)', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Skill Detail Modal */}
        {viewSkill && (
          <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={()=>{setViewSkill(null);setSkillContent('');}}>
            <div className="modal-content" style={{ background:'white', borderRadius:14, maxWidth:740, width:'90%', maxHeight:'80vh', overflow:'auto', padding:'32px', boxShadow:'0 24px 64px rgba(0,0,0,0.15)', position:'relative' }}
              onClick={e=>e.stopPropagation()}>
              <button onClick={()=>{setViewSkill(null);setSkillContent('');}}
                style={{ position:'absolute', top:16, right:20, background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--ink-faint)' }}>✕</button>
              <pre style={{ whiteSpace:'pre-wrap', fontSize:'0.82rem', lineHeight:1.6, fontFamily:'"JetBrains Mono",monospace' }}>
                {skillContent || '加载中...'}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
