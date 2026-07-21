'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Markdown from '@/components/Markdown';
import MarkdownEditor from '@/components/MarkdownEditor';

interface Message { role: 'user' | 'assistant'; content: string; }
interface PhaseInfo { id: string; title: string; description: string; }

export default function WorkflowChatPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [workflowName, setWorkflowName] = useState('');
  const [phases, setPhases] = useState<PhaseInfo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(searchParams.get('sid'));
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [totalPhases, setTotalPhases] = useState(0);
  const [phaseExpanded, setPhaseExpanded] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [importedMsgIdx, setImportedMsgIdx] = useState<number | null>(null);
  const [pendingRevise, setPendingRevise] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const phaseRef = useRef<HTMLDivElement>(null);

  // Load workflow
  useEffect(() => {
    fetch('/api/workflows').then(r => r.json()).then(d => {
      const wf = d.find((w: any) => w.id === id);
      if (!wf) { router.push('/'); return; }
      setWorkflowName(wf.name);
      if (wf.phases) { setTotalPhases(wf.phases.length); setPhases(wf.phases); }
    }).catch(() => { });
  }, [id, router]);

  // Check API key
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => { if (!s.llmApiKey) setError('请先在设置页配置 LLM API Key'); }).catch(() => { });
  }, []);

  // Load session or show greeting
  useEffect(() => {
    if (!workflowName || historyLoaded) return;
    const sid = searchParams.get('sid');
    if (sid) {
      setSessionId(sid);
      fetch('/api/sessions/mark-read', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId:sid}) }).catch(()=>{});
      fetch(`/api/sessions?sessionId=${encodeURIComponent(sid)}`)
        .then(r => r.json())
        .then(data => {
          if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages);
            if (typeof data.currentPhase === 'number') setCurrentPhase(data.currentPhase);
          } else { showGreeting(); }
        })
        .catch(() => showGreeting())
        .finally(() => setHistoryLoaded(true));
    } else {
      showGreeting();
      setHistoryLoaded(true);
    }
  }, [workflowName, historyLoaded]);

  function showGreeting() {
    setMessages([{ role: 'assistant', content: `你好！我将引导你完成「**${workflowName}**」工作流。\n\n准备好开始了吗？请描述一下你需要解决的产品问题。` }]);
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Close phase panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (phaseRef.current && !phaseRef.current.contains(e.target as Node)) setPhaseExpanded(false);
    }
    if (phaseExpanded) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [phaseExpanded]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);

  // Handle pending revise from editor
  useEffect(() => {
    if (pendingRevise) { handleSend(pendingRevise); setPendingRevise(null); }
  }, [pendingRevise]);

  // Send with SSE
  async function handleSend(overrideMessage?: string) {
    const msgText = overrideMessage || input.trim();
    if (!msgText || sending) return;
    setSending(true); setError(null);

    const userMsg: Message = { role: 'user', content: msgText };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideMessage) setInput('');

    const assistantIdx = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId || undefined, workflowId: sessionId ? undefined : id, message: userMsg.content }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: '请求失败' })); throw new Error(err.error || `HTTP ${res.status}`); }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream body');

      const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim(); if (!jsonStr) continue;
          try {
            const chunk = JSON.parse(jsonStr);
            if (chunk.error) { setError(chunk.error); break; }
            if (chunk.sessionId && !sessionId) setSessionId(chunk.sessionId);
            if (typeof chunk.currentPhase === 'number') setCurrentPhase(chunk.currentPhase);
            if (chunk.done) break;
            setMessages(prev => { const updated = [...prev]; if (assistantIdx < updated.length) updated[assistantIdx] = { ...updated[assistantIdx], content: updated[assistantIdx].content + (chunk.delta || '') }; return updated; });
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setMessages(prev => { const copy = [...prev]; if (copy[assistantIdx]?.content === '') copy.splice(assistantIdx, 1); return copy; });
    } finally {
      setSending(false);
      if (sessionId && messages.length < 6) {
        fetch('/api/sessions/generate-title', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId}) }).catch(() => {});
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // ── Editor helpers ──
  function openEditor(content: string, msgIdx: number) {
    setEditorContent(content);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
  }

  function handleImportDone() {
    // Mark the msg that had its content opened in editor as imported
    if (importedMsgIdx !== null) return; // already marked
    // find which message content matches editor content
    const idx = messages.findIndex(m => m.role === 'assistant' && m.content === editorContent);
    if (idx >= 0) setImportedMsgIdx(idx);
    setEditorOpen(false);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      {/* Chat + Editor flex container */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Chat area */}
        <div style={{ flex: editorOpen ? '0 0 50%' : 1, display:'flex', flexDirection:'column', overflow:'hidden', borderRight: editorOpen ? '1px solid var(--border)' : 'none' }}>
        {/* Header */}
        <header style={{ padding:'10px 24px', borderBottom:'1px solid var(--border)', background:'white', display:'flex', alignItems:'center', gap:12, flexShrink:0, height:48 }}>
          <Link href="/" style={{ color:'var(--ink-faint)', textDecoration:'none', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:4 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 3L4 8l6 5"/></svg>
            首页
          </Link>
          <span style={{ color:'var(--ink-ghost)' }}>/</span>
          <span style={{ fontFamily:'Inter,sans-serif', fontWeight:600, fontSize:'0.88rem', letterSpacing:'-0.01em' }}>{workflowName}</span>
          <div style={{ flex:1 }} />

          {/* Toggle editor button */}
          <button onClick={() => {
            if (editorOpen) { closeEditor(); }
            else {
              const lastAi = [...messages].reverse().find(m => m.role === 'assistant');
              if (lastAi) openEditor(lastAi.content, messages.indexOf(lastAi));
              else setEditorOpen(true);
            }
          }}
          className="btn-ghost" style={{ padding:'4px 14px', fontSize:'0.72rem', display:'flex', alignItems:'center', gap:5 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 10h10M3 6h7"/><rect x="2" y="2" width="12" height="12" rx="1.5"/></svg>
            {editorOpen ? '收起编辑器' : '打开编辑器'}
          </button>
        </header>

        {/* Phase progress */}
        {totalPhases > 0 && (
          <div style={{ padding:'6px 24px', background:'white', borderBottom:'1px solid var(--border-light)', flexShrink:0, position:'relative' }} ref={phaseRef}>
            <button onClick={() => setPhaseExpanded(!phaseExpanded)}
              style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', width:'100%', padding:0, fontFamily:'inherit' }}>
              <span style={{ fontSize:'0.66rem', fontWeight:600, color:'var(--ink-faint)', letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                阶段 {currentPhase + 1} / {totalPhases}
              </span>
              <div style={{ flex:1, height:3, background:'var(--border-light)', borderRadius:1.5, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${((currentPhase+1)/totalPhases)*100}%`, background:'var(--accent)', borderRadius:1.5, transition:'width 0.5s ease' }} />
              </div>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--ink-faint)" strokeWidth="1.5" strokeLinecap="round"
                style={{ transform: phaseExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.15s ease' }}>
                <path d="M4 6l4 4 4-4"/>
              </svg>
            </button>

            {phaseExpanded && (
              <div style={{
                position:'absolute', top:'100%', left:24, zIndex:50,
                background:'white', border:'1px solid var(--border)', borderRadius:5,
                boxShadow:'0 4px 20px rgba(0,0,0,0.06), 0 12px 40px rgba(0,0,0,0.04)',
                padding:'8px 0', minWidth:360, maxWidth:460, maxHeight:'55vh', overflowY:'auto',
              }}>
                {phases.map((p, i) => {
                  const status = i < currentPhase ? 'done' : i === currentPhase ? 'active' : 'pending';
                  return (
                    <div key={p.id} style={{
                      display:'flex', gap:10, padding:'9px 18px',
                      background: status === 'active' ? 'var(--accent-bg)' : 'transparent',
                      alignItems:'flex-start',
                    }}>
                      <span style={{
                        width:22, height:22, borderRadius:'50%', flexShrink:0,
                        background: status === 'done' ? 'var(--green-text)' : status === 'active' ? 'var(--accent)' : 'var(--border)',
                        color:'white', display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'0.62rem', fontWeight:700, lineHeight:1, marginTop:1,
                      }}>
                        {status === 'done' ? '✓' : i + 1}
                      </span>
                      <div>
                        <div style={{ fontSize:'0.82rem', fontWeight: status==='active'?600:500, color: status==='pending'?'var(--ink-faint)':'var(--ink)' }}>
                          {p.title}
                          {status === 'active' && <span style={{ marginLeft:6, fontSize:'0.62rem', color:'var(--accent)', fontWeight:500 }}>进行中</span>}
                        </div>
                        <div style={{ fontSize:'0.7rem', color:'var(--ink-faint)', lineHeight:1.4, marginTop:2 }}>{p.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex:1, overflow:'auto', padding:'24px 32px 40px', display:'flex', flexDirection:'column', gap:14 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display:'flex', justifyContent: m.role==='user'?'flex-end':'flex-start' }}>
              <div className={m.role==='user'?'msg-user':'msg-ai'} style={{ maxWidth:'85%', position:'relative' }}>
                {m.role === 'user' ? (
                  <div style={{ fontSize:'0.86rem', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{m.content}</div>
                ) : (
                  <>
                    <Markdown content={m.content} />
                    {m.content && m.content.length > 20 && (
                      <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end' }}>
                        <button onClick={() => {
                          if (importedMsgIdx === i) return;
                          openEditor(m.content, i);
                        }}
                          style={{
                            background: importedMsgIdx === i ? 'var(--green-bg)' : 'var(--accent-bg)',
                            border: importedMsgIdx === i ? '1px solid var(--green-border)' : '1px solid var(--accent-border)',
                            borderRadius:3, padding:'4px 12px', fontSize:'0.7rem',
                            color: importedMsgIdx === i ? 'var(--green-text)' : 'var(--accent)',
                            cursor: importedMsgIdx === i ? 'default' : 'pointer', fontFamily:'inherit', fontWeight:500,
                          }}>
                          {importedMsgIdx === i ? '已导入' : '导入编辑'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ display:'flex' }}>
              <div className="msg-ai"><span className="cursor-blink" style={{ color:'var(--ink-faint)', fontSize:'0.85rem' }}>▊</span></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Error bar */}
        {error && (
          <div style={{ padding:'8px 24px', background:'var(--red-bg)', borderTop:'1px solid var(--red-border)', fontSize:'0.8rem', color:'var(--red-text)', flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
            {error}
            <button onClick={() => setError(null)} style={{ background:'none', border:'none', textDecoration:'underline', cursor:'pointer', color:'var(--red-text)', fontSize:'0.76rem' }}>关闭</button>
          </div>
        )}

        {/* Input */}
        <div style={{ padding:'14px 32px 20px', borderTop:'1px solid var(--border)', background:'white', flexShrink:0 }}>
          <div style={{ maxWidth:800, margin:'0 auto' }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={sending ? 'AI 思考中…' : '输入你的问题…  Enter 发送'}
                disabled={sending} rows={1}
                style={{
                  flex:1, padding:'10px 16px', border:'1px solid var(--border)', borderRadius:4, fontSize:'0.86rem',
                  outline:'none', background:'var(--paper)', resize:'none', fontFamily:'inherit', lineHeight:1.5,
                  maxHeight:160, overflowY:'auto',
                  transition:'border-color 0.12s ease, box-shadow 0.12s ease',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <button onClick={() => handleSend()} disabled={sending || !input.trim()} className="btn-primary"
                style={{ padding:'10px 22px', height:40, fontSize:'0.84rem', display:'flex', alignItems:'center', gap:5 }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14 2L7 9M14 2l-4.5 12L7 9 2 5.5z"/></svg>
                发送
              </button>
            </div>
            <div style={{ marginTop:5, fontSize:'0.66rem', color:'var(--ink-faint)', display:'flex', gap:10 }}>
              <span>Enter 发送</span>
              <span>Shift + Enter 换行</span>
            </div>
          </div>
        </div>
      </div>

      {/* Markdown Editor */}
      {editorOpen && (
        <MarkdownEditor
          initialContent={editorContent}
          workflowId={id}
          sessionId={sessionId || ''}
          onClose={closeEditor}
          onTitleGenerated={() => {}}
          onReviseRequest={(msg) => setPendingRevise(msg)}
          onImported={handleImportDone}
        />
      )}
      </div>{/* close chat+editor flex container */}
    </div>
  );
}
