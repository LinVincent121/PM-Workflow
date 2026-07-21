'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r=>r.json()).then(s=>{
      setLlmApiKey(s.llmApiKey||''); setLlmBaseUrl(s.llmBaseUrl||''); setLlmModel(s.llmModel||''); setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaved(false);
    try {
      const body: any = {};
      if (llmApiKey) body.llmApiKey = llmApiKey;
      if (llmBaseUrl) body.llmBaseUrl = llmBaseUrl;
      if (llmModel) body.llmModel = llmModel;
      const res = await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true); setTimeout(()=>setSaved(false),3000);
    } catch (err: any) { setError(err.message); }
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <main style={{ flex:1, overflow:'auto', padding:'40px 48px' }}>
        <header style={{ marginBottom: 28 }}>
          <h1 className="display" style={{ fontSize:'clamp(1.4rem, 2vw, 1.7rem)', marginBottom:6 }}>模型设置</h1>
          <p className="body-text">配置大模型连接参数。支持所有 OpenAI 兼容 API 提供商。</p>
        </header>

        {error && (
          <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-border)', borderRadius:4, padding:'10px 16px', marginBottom:18, fontSize:'0.82rem', color:'var(--red-text)', maxWidth:500 }}>
            {error}
          </div>
        )}
        {saved && (
          <div style={{ background:'var(--green-bg)', border:'1px solid var(--green-border)', borderRadius:4, padding:'10px 16px', marginBottom:18, fontSize:'0.82rem', color:'var(--green-text)', maxWidth:500 }}>
            设置已保存
          </div>
        )}

        <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:500 }}>
          <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <span style={{ fontSize:'0.85rem', fontWeight:600, fontFamily:'Inter, sans-serif' }}>API Base URL</span>
            <span className="caption">OpenAI、OpenRouter、Together AI 或 Ollama</span>
            <input className="input" type="text" value={llmBaseUrl} onChange={e=>setLlmBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
          </label>

          <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <span style={{ fontSize:'0.85rem', fontWeight:600, fontFamily:'Inter, sans-serif' }}>API Key</span>
            <span className="caption">Key 仅保存在服务器端</span>
            <div style={{ position:'relative' }}>
              <input className="input" type={showKey?'text':'password'} value={llmApiKey} onChange={e=>setLlmApiKey(e.target.value)} placeholder="sk-..." autoComplete="off" style={{ paddingRight:40 }} />
              <button type="button" onClick={()=>setShowKey(!showKey)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'0.72rem', color:'var(--ink-muted)', fontFamily:'inherit' }}>
                {showKey?'隐藏':'显示'}
              </button>
            </div>
          </label>

          <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <span style={{ fontSize:'0.85rem', fontWeight:600, fontFamily:'Inter, sans-serif' }}>Model ID</span>
            <span className="caption">如 gpt-4o、deepseek-chat、claude-sonnet-4-20250514</span>
            <input className="input" type="text" value={llmModel} onChange={e=>setLlmModel(e.target.value)} placeholder="gpt-4o" />
          </label>

          <button type="submit" className="btn-primary" style={{ alignSelf:'flex-start', marginTop:4, fontSize:'0.84rem', padding:'9px 24px' }}>
            保存设置
          </button>
        </form>

        {/* Providers */}
        <div style={{ marginTop: 40, padding:'18px 22px', background:'white', border:'1px solid var(--border)', borderRadius:4, maxWidth:500 }}>
          <h3 style={{ fontFamily:'Inter, sans-serif', fontSize:'0.84rem', fontWeight:600, marginBottom:12 }}>快速配置</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {[
              { name:'OpenAI', url:'https://api.openai.com/v1', model:'gpt-4o' },
              { name:'OpenRouter', url:'https://openrouter.ai/api/v1', model:'openai/gpt-4o' },
              { name:'Together AI', url:'https://api.together.xyz/v1', model:'meta-llama/Llama-4' },
              { name:'DeepSeek', url:'https://api.deepseek.com/v1', model:'deepseek-chat' },
              { name:'Ollama', url:'http://localhost:11434/v1', model:'llama3' },
            ].map(p=>(
              <button key={p.name} onClick={()=>{setLlmBaseUrl(p.url);setLlmModel(p.model);}}
                style={{ textAlign:'left', padding:'7px 14px', border:'1px solid var(--border-light)', borderRadius:3, background:'transparent', cursor:'pointer', fontSize:'0.8rem', fontFamily:'Inter, system-ui, sans-serif', display:'flex', alignItems:'center', gap:8 }}
                className="tr-color"
                onMouseEnter={e=>e.currentTarget.style.background='var(--sidebar-hover)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{ fontWeight:600 }}>{p.name}</span>
                <span style={{ color:'var(--ink-faint)', fontSize:'0.73rem' }}>{p.url}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
