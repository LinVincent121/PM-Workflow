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
    fetch(`/api/skills/${id}`).then(r=>r.json()).then(d=>setSkillContent(d.content||'')).catch(()=>setSkillContent('Failed to load'));
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <main style={{ flex:1, overflow:'auto', padding:'40px 48px' }}>
        <header style={{ marginBottom: 28 }}>
          <h1 className="display" style={{ fontSize:'clamp(1.4rem, 2vw, 1.7rem)', marginBottom:6 }}>Skills</h1>
          <p className="body-text">{skills.length} skills indexed from pm-skills directory. Click to view source.</p>
        </header>

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:10 }}>
            {Array(12).fill(0).map((_,i)=>(<div key={i} className="skeleton" style={{height:110}}/>))}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:10 }}>
            {skills.map(s => (
              <div key={s.id} className="card" style={{ padding:'16px 18px' }}
                onClick={() => openSkill(s.id)}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span className="section-label" style={{ fontSize:'0.62rem' }}>{s.type}</span>
                  <span style={{ fontSize:'0.6rem', color:'var(--ink-ghost)', fontFamily:"'JetBrains Mono',monospace" }}>{s.id.substring(0, 8)}</span>
                </div>
                <h3 style={{ fontFamily:'Inter, sans-serif', fontSize:'0.84rem', fontWeight:600, marginBottom:4, letterSpacing:'-0.01em' }}>
                  {s.name}
                </h3>
                <p style={{ fontSize:'0.74rem', color:'var(--ink-muted)', lineHeight:1.45 }}>
                  {s.description?.length > 140 ? s.description.substring(0, 140) + '…' : s.description}
                </p>
              </div>
            ))}
          </div>
        )}

        {viewSkill && (
          <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.3)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={() => { setViewSkill(null); setSkillContent(''); }}>
            <div className="modal-content" style={{
              background:'white', borderRadius:5, maxWidth:720, width:'90%', maxHeight:'82vh', overflow:'auto',
              padding:'28px 32px', border:'1px solid var(--border)',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <span style={{ fontWeight:600, fontSize:'0.95rem', fontFamily:'Inter, sans-serif' }}>{viewSkill}</span>
                <button onClick={() => { setViewSkill(null); setSkillContent(''); }} className="btn-ghost" style={{ fontSize:'0.76rem' }}>Close</button>
              </div>
              <div style={{ border:'1px solid var(--border)', borderRadius:3, padding:'14px 18px', background:'var(--sidebar-bg)' }}>
                <pre style={{ whiteSpace:'pre-wrap', fontSize:'0.78rem', lineHeight:1.65, fontFamily:"'JetBrains Mono',ui-monospace,monospace", color:'var(--ink)' }}>
                  {skillContent || 'Loading...'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
