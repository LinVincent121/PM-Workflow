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
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => {
        setLlmApiKey(s.llmApiKey || '');
        setLlmBaseUrl(s.llmBaseUrl || '');
        setLlmModel(s.llmModel || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaved(false);

    try {
      const body: any = {};
      if (llmApiKey) body.llmApiKey = llmApiKey;
      if (llmBaseUrl) body.llmBaseUrl = llmBaseUrl;
      if (llmModel) body.llmModel = llmModel;

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <main style={{ flex:1, overflow:'auto', padding:'32px 40px' }}>
        <h1 className="display" style={{ marginBottom:8 }}>模型设置</h1>
        <p className="body" style={{ marginBottom:32 }}>配置大模型连接参数。支持所有 OpenAI 兼容 API 和本地模型。</p>

        {error && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-border)', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:'0.9rem', color:'var(--red-text)' }}>{error}</div>}
        {saved && <div style={{ background:'var(--green-bg)', border:'1px solid var(--green-border)', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:'0.9rem', color:'var(--green-text)' }}>设置已保存</div>}

        <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:24, maxWidth:560 }}>
          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:'0.9rem', fontWeight:500 }}>API Base URL</span>
            <span style={{ fontSize:'0.8rem', color:'var(--ink-faint)' }}>支持 OpenAI、OpenRouter、Together AI 或本地 Ollama</span>
            <input type="text" value={llmBaseUrl} onChange={e=>setLlmBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1"
              style={{ padding:'10px 14px', border:'1px solid var(--border)', borderRadius:8, fontSize:'0.9rem', background:'white', outline:'none' }} />
          </label>

          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:'0.9rem', fontWeight:500 }}>API Key</span>
            <span style={{ fontSize:'0.8rem', color:'var(--ink-faint)' }}>Key 仅保存在服务器端，不会暴露到浏览器</span>
            <div style={{ position:'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={llmApiKey}
                onChange={e=>setLlmApiKey(e.target.value)}
                placeholder="sk-..." autoComplete="off"
                style={{ padding:'10px 44px 10px 14px', border:'1px solid var(--border)', borderRadius:8, fontSize:'0.9rem', background:'white', outline:'none', width:'100%' }}
              />
              <button type="button" onClick={()=>setShowKey(!showKey)}
                title={showKey?'隐藏 Key':'显示 Key'}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'1rem', color:'var(--ink-faint)', padding:'4px' }}
              >{showKey ? '🙈' : '👁'}</button>
            </div>
          </label>

          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:'0.9rem', fontWeight:500 }}>Model</span>
            <span style={{ fontSize:'0.8rem', color:'var(--ink-faint)' }}>输入模型 ID，如 gpt-4o、deepseek-chat</span>
            <input type="text" value={llmModel} onChange={e=>setLlmModel(e.target.value)} placeholder="gpt-4o"
              style={{ padding:'10px 14px', border:'1px solid var(--border)', borderRadius:8, fontSize:'0.9rem', background:'white', outline:'none' }} />
          </label>

          <button type="submit"
            style={{ padding:'12px 24px', background:'var(--accent)', color:'white', border:'none', borderRadius:8, fontSize:'0.95rem', fontWeight:500, cursor:'pointer', marginTop:8, alignSelf:'flex-start' }}
          >保存设置</button>
        </form>

        <div style={{ marginTop:48, padding:'20px 24px', background:'white', borderRadius:10, border:'1px solid var(--border)', maxWidth:560 }}>
          <h3 style={{ fontSize:'0.95rem', fontWeight:600, marginBottom:12 }}>常见 Provider 配置</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:'0.85rem' }}>
            {[
              { name:'OpenAI', url:'https://api.openai.com/v1', model:'gpt-4o' },
              { name:'OpenRouter', url:'https://openrouter.ai/api/v1', model:'openai/gpt-4o' },
              { name:'Together AI', url:'https://api.together.xyz/v1', model:'meta-llama/Llama-4' },
              { name:'DeepSeek', url:'https://api.deepseek.com/v1', model:'deepseek-chat' },
              { name:'Ollama (本地)', url:'http://localhost:11434/v1', model:'llama3' },
            ].map(p=>(
              <button key={p.name} onClick={()=>{setLlmBaseUrl(p.url);setLlmModel(p.model);}}
                style={{ textAlign:'left', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:6, background:'transparent', cursor:'pointer', fontSize:'0.85rem' }}>
                <span style={{fontWeight:500}}>{p.name}</span>{' — '}
                <code style={{fontSize:'0.8rem',color:'var(--ink-muted)'}}>{p.url}</code>
                {' · '}<code style={{fontSize:'0.8rem',color:'var(--ink-muted)'}}>{p.model}</code>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
