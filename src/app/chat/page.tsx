'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import UserAvatar from '@/components/UserAvatar';
import Markdown from '@/components/Markdown';

interface Message { role: 'user' | 'assistant'; content: string; }
interface UploadedFile { fileId: string; originalName: string; mimeType: string; size: number; isImage: boolean; }

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(searchParams.get('sid'));
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const autoSendRef = useRef(false);
  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const filesConsumedRef = useRef(false);

  // Check API key
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (!s.llmApiKey) { setError('请先在设置页配置 LLM API Key'); }
      else setConfigured(true);
    }).catch(() => {});
  }, []);

  // When navigating between chat sessions (same route, different sid), reset state
  const currentSid = searchParams.get('sid');
  useEffect(() => {
    if (currentSid && currentSid !== sessionId) {
      setHistoryLoaded(false);
      setMessages([]);
      setSessionId(currentSid);
    }
  }, [currentSid, sessionId]);

  // Load uploaded files from sessionStorage (passed from homepage)
  useEffect(() => {
    if (filesConsumedRef.current) return;
    filesConsumedRef.current = true;
    try {
      const raw = sessionStorage.getItem('pm-uploaded-files');
      if (raw) {
        const files = JSON.parse(raw);
        if (Array.isArray(files) && files.length > 0) {
          setUploadedFiles(files);
        }
      }
    } catch {}
  }, []);

  // Load session from sid parameter
  useEffect(() => {
    if (historyLoaded) return;
    const sid = searchParams.get('sid');
    if (sid) {
      fetch('/api/sessions/mark-read', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId:sid}) }).catch(()=>{});
      fetch(`/api/sessions?sessionId=${encodeURIComponent(sid)}`)
        .then(r => r.json())
        .then(data => {
          if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages);
            setSessionId(sid);
          }
        })
        .catch(() => {})
        .finally(() => setHistoryLoaded(true));
    } else {
      setHistoryLoaded(true);
    }
  }, [historyLoaded, searchParams]);

  // Auto-send initial message from URL (only for new sessions, not when loading sid)
  useEffect(() => {
    if (!historyLoaded || autoSendRef.current) return;
    const sid = searchParams.get('sid');
    if (sid) return;
    const initialMsg = searchParams.get('initialMessage');
    if (initialMsg && initialMsg.trim() && configured) {
      autoSendRef.current = true;
      handleSend(initialMsg.trim());
    }
  }, [configured, historyLoaded, searchParams]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  async function handleSend(overrideMessage?: string) {
    const msgText = overrideMessage || input.trim();
    if (!msgText || sendingRef.current) return;
    if (!configured) { router.push('/settings'); return; }

    sendingRef.current = true;
    setSending(true);
    setError(null);

    const userMsg: Message = { role: 'user', content: msgText };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideMessage) setInput('');

    const assistantIdx = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch('/api/chat/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          sessionId,
          files: uploadedFiles,
        }),
        signal: abort.signal,
      });
      // Clear sessionStorage after files are consumed
      try { sessionStorage.removeItem('pm-uploaded-files'); } catch {}

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const chunk = JSON.parse(jsonStr);
            if (chunk.error) { setError(chunk.error); break; }
            if (chunk.sessionId && !sessionId) setSessionId(chunk.sessionId);
            if (chunk.done) {
              // Clear files after first message is sent
              setUploadedFiles([]);
              break;
            }
            setMessages(prev => {
              const updated = [...prev];
              if (assistantIdx < updated.length) {
                updated[assistantIdx] = {
                  ...updated[assistantIdx],
                  content: updated[assistantIdx].content + (chunk.delta || ''),
                };
              }
              return updated;
            });
          } catch { /* skip parse errors */ }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
      setMessages(prev => {
        const copy = [...prev];
        if (copy[assistantIdx]?.content === '') copy.splice(assistantIdx, 1);
        return copy;
      });
    } finally {
      setSending(false);
      sendingRef.current = false;
      abortRef.current = null;
      if (sessionId && messages.length < 4) {
        fetch('/api/sessions/generate-title', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId}) }).catch(() => {});
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const docs = newFiles.filter(f => !f.type.startsWith('image/'));
    const images = newFiles.filter(f => f.type.startsWith('image/'));

    // Limit: max 1 doc, max 2 images
    const currentDocs = uploadedFiles.filter(f => !f.isImage);
    const currentImages = uploadedFiles.filter(f => f.isImage);
    const valid = [...docs.slice(0, 1 - currentDocs.length), ...images.slice(0, 2 - currentImages.length)];

    if (valid.length === 0) {
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    valid.forEach(f => formData.append('files', f));

    fetch('/api/upload', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        if (data.files) {
          setUploadedFiles(prev => [...prev, ...data.files]);
        }
      })
      .catch(() => {});
    e.target.value = '';
  }

  function removeFile(fileId: string) {
    setUploadedFiles(prev => prev.filter(f => f.fileId !== fileId));
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      {/* Image preview modal */}
      {previewImg && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setPreviewImg(null); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.8)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
          <img
            src={previewImg}
            alt="预览"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 4 }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewImg(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: 'white', fontSize: '1.5rem', cursor: 'pointer',
              width: 40, height: 40, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--white)' }}>
        {/* Header */}
        <header style={{
          padding: '10px 24px', borderBottom: '1px solid var(--border)',
          background: 'white', display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0, height: 48,
        }}>
          <Link href="/" style={{
            color: 'var(--ink-faint)', textDecoration: 'none', fontSize: '0.8rem',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10 3L4 8l6 5"/>
            </svg>
            首页
          </Link>
          <span style={{ color: 'var(--ink-ghost)' }}>/</span>
          <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: '0.88rem', letterSpacing: '-0.01em' }}>
            💬 通用对话
          </span>
          <div style={{ marginLeft: 'auto' }}><UserAvatar /></div>
        </header>

        {/* Messages */}
        <div style={{
          flex: 1, overflow: 'auto', padding: '24px 32px 40px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.length === 0 && !sending && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>💬</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>PM Workbench 通用对话</div>
                <div style={{ fontSize: '0.82rem' }}>直接提问，我会以产品经理助手的身份回答你的问题</div>
                <div className="new-task-recommendations">
                  <div className="new-task-recommendation-title">推荐工作流</div>
                  <div className="new-task-recommendation-grid">
                    {[['💡','产品想法完善','把一个模糊想法打磨成可验证的机会','idea-refinement'],['🔍','竞品分析报告','快速建立市场与竞品情报','competitive-intel'],['📝','PRD 与交付','生成工程团队可以直接执行的 PRD','prd-delivery']].map(([icon,title,desc,id])=><button key={id} onClick={()=>router.push(`/workflow/${id}`)} className="new-task-recommendation"><span>{icon}</span><strong>{title}</strong><small>{desc}</small><b>开始 →</b></button>)}
                  </div>
                </div>
              </div>
            )}
            {/* Uploaded files — shown above messages in chat area */}
            {uploadedFiles.length > 0 && (
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}>
                <div style={{ maxWidth:'75%', display:'flex', gap:6, flexWrap:'wrap' }}>
                  {uploadedFiles.map(f => (
                    <div key={f.fileId} style={{
                      display:'flex', alignItems:'center', gap:5,
                      padding:'4px 10px', background:'var(--accent-bg)',
                      border:'1px solid var(--accent-border)', borderRadius:4,
                      fontSize:'0.72rem', color:'var(--accent)',
                    }}>
                      {f.isImage ? (
                        <button onClick={() => setPreviewImg(`/api/files/${f.fileId}`)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontFamily:'inherit', fontSize:'0.72rem', padding:0, display:'flex', alignItems:'center', gap:4, textDecoration:'underline' }}>
                          🖼 {f.originalName}
                        </button>
                      ) : (
                        <a href={`/api/files/${f.fileId}`} download={f.originalName}
                          style={{ display:'flex', alignItems:'center', gap:4, color:'var(--accent)', textDecoration:'none' }}>
                          📄 {f.originalName}
                        </a>
                      )}
                      <button onClick={() => removeFile(f.fileId)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', padding:0, fontSize:'0.9rem', lineHeight:1 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className={m.role === 'user' ? 'msg-user' : 'msg-ai'} style={{ maxWidth: '75%' }}>
                  {m.role === 'user' ? (
                    <div style={{ fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{typeof m.content === 'string' ? m.content : (m.content as any[]).find((p:any) => p.type === 'text')?.text || ''}</div>
                  ) : (
                    <span>
                      <Markdown content={typeof m.content === 'string' ? m.content : ''} />
                      {sending && i === messages.length - 1 && (
                        <span className="cursor-blink" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>▊</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Error bar */}
        {error && (
          <div style={{
            padding: '8px 24px', background: 'var(--red-bg)',
            borderTop: '1px solid var(--red-border)', fontSize: '0.8rem',
            color: 'var(--red-text)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {error}
            <button onClick={() => setError(null)} style={{
              background: 'none', border: 'none', textDecoration: 'underline',
              cursor: 'pointer', color: 'var(--red-text)', fontSize: '0.76rem',
            }}>关闭</button>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '8px 32px 18px', background: 'white', flexShrink: 0 }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 12,
              background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 24,
              padding: '12px 16px', transition: 'border-color 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={sending ? 'AI 思考中…' : '输入你的问题…'}
                disabled={sending}
                style={{
                  flex: 1, border: 'none', background: 'transparent', fontSize: '0.92rem',
                  outline: 'none', resize: 'none', minHeight: 24, maxHeight: 120,
                  fontFamily: '"Inter", system-ui, sans-serif', lineHeight: 1.6,
                  padding: '4px 8px', color: 'var(--ink)', overflow: 'hidden',
                }}
              />
              <input ref={fileInputRef} type="file" multiple
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md"
                style={{ display: 'none' }}
                onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()}
                title="上传文件或图片"
                disabled={sending}
                style={{
                  background: 'transparent', border: 'none', borderRadius: '50%',
                  width: 36, height: 36, cursor: sending ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease', color: '#6b7280', opacity: sending ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!sending) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#3b82f6'; } }}
                onMouseLeave={e => { if (!sending) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; } }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              {/* Image upload button */}
              <button onClick={() => fileInputRef.current?.click()}
                title="上传图片 (.png, .jpg, .gif, .webp)"
                disabled={sending}
                style={{
                  background: 'transparent', border: 'none', borderRadius: '50%',
                  width: 36, height: 36, cursor: sending ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease', color: '#6b7280', opacity: sending ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!sending) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#3b82f6'; } }}
                onMouseLeave={e => { if (!sending) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; } }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
              <button
                onClick={() => handleSend()}
                disabled={sending || !input.trim()}
                style={{
                  background: (!input.trim() || sending) ? '#e5e7eb' : '#3b82f6',
                  border: 'none', borderRadius: '50%',
                  width: 36, height: 36,
                  cursor: (!input.trim() || sending) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease', color: 'white',
                  opacity: sending ? 0.6 : 1,
                }}
                onMouseEnter={e => {
                  if (input.trim() && !sending) e.currentTarget.style.background = '#2563eb';
                }}
                onMouseLeave={e => {
                  if (input.trim() && !sending) e.currentTarget.style.background = '#3b82f6';
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
