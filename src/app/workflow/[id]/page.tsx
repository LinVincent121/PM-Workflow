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
  const [phasePopover, setPhasePopover] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [pendingRevise, setPendingRevise] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // ── Load workflow name + phases ──
  useEffect(() => {
    fetch('/api/workflows').then(r => r.json()).then(d => {
      const wf = d.find((w: any) => w.id === id);
      if (!wf) { router.push('/'); return; }
      setWorkflowName(wf.name);
      if (wf.phases) {
        setTotalPhases(wf.phases.length);
        setPhases(wf.phases);
      }
    }).catch(() => { });
  }, [id, router]);

  // ── Check API key ──
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => { if (!s.llmApiKey) setError('请先在设置页配置 LLM API Key'); }).catch(() => { });
  }, []);

  // ── Load existing session history OR show welcome greeting ──
  useEffect(() => {
    if (!workflowName || historyLoaded) return;
    const sid = searchParams.get('sid');
    if (sid) {
      setSessionId(sid);
      // Mark read
      fetch('/api/sessions/mark-read', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId:sid}) }).catch(()=>{});
      fetch(`/api/sessions?sessionId=${encodeURIComponent(sid)}`)
        .then(r => r.json())
        .then(data => {
          if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages);
            if (typeof data.currentPhase === 'number') setCurrentPhase(data.currentPhase);
          } else {
            showGreeting();
          }
        })
        .catch(() => showGreeting())
        .finally(() => setHistoryLoaded(true));
    } else {
      showGreeting();
      setHistoryLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowName, historyLoaded]);

  function showGreeting() {
    setMessages([{ role: 'assistant', content: `你好！我将引导你完成「**${workflowName}**」工作流。\n\n准备好开始了吗？请描述一下你需要解决的产品问题，或者你想要讨论的主题。` }]);
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Close popover on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPhasePopover(false);
      }
    }
    if (phasePopover) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [phasePopover]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);

  // ── Handle pending revise request from editor ──
  useEffect(() => {
    if (pendingRevise) {
      handleSend(pendingRevise);
      setPendingRevise(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRevise]);

  // ── Send with SSE streaming ──
  async function handleSend(overrideMessage?: string) {
    const msgText = overrideMessage || input.trim();
    if (!msgText || sending) return;
    setSending(true);
    setError(null);

    const userMsg: Message = { role: 'user', content: msgText };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideMessage) setInput('');

    const assistantIdx = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId || undefined, workflowId: sessionId ? undefined : id, message: userMsg.content }),
      });

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
            if (typeof chunk.currentPhase === 'number') setCurrentPhase(chunk.currentPhase);
            if (chunk.done) break;

            setMessages(prev => {
              const updated = [...prev];
              if (assistantIdx < updated.length) {
                updated[assistantIdx] = { ...updated[assistantIdx], content: updated[assistantIdx].content + (chunk.delta || '') };
              }
              return updated;
            });
          } catch { /* skip unparseable chunks */ }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setMessages(prev => {
        const copy = [...prev];
        if (copy[assistantIdx]?.content === '') copy.splice(assistantIdx, 1);
        return copy;
      });
    } finally {
      setSending(false);
      // Auto-generate title after first few exchanges
      if (sessionId && messages.length < 6) {
        fetch('/api/sessions/generate-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        }).catch(() => {});
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter: default behavior = newline
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Link href="/" style={{ color: 'var(--ink-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>← 首页</Link>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{workflowName}</span>
        </header>

        {/* ── Phase progress bar ── */}
        {totalPhases > 0 && (
          <div style={{ padding: '8px 24px', background: 'white', borderBottom: '1px solid var(--border)', flexShrink: 0, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                阶段 {currentPhase + 1}/{totalPhases}
              </span>
              <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', maxWidth: 300 }}>
                <div style={{
                  height: '100%',
                  width: `${((currentPhase + 1) / totalPhases) * 100}%`,
                  background: 'var(--accent)',
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <button
                onClick={() => setPhasePopover(!phasePopover)}
                title="查看所有阶段"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--ink-muted)', padding: '2px 6px', borderRadius: 4 }}
              >
                {phasePopover ? '收起 ▴' : '详情 ▾'}
              </button>
            </div>

            {/* Popover */}
            {phasePopover && (
              <div ref={popoverRef} style={{
                position: 'absolute', top: '100%', left: 24, zIndex: 50,
                background: 'white', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.06)',
                padding: '12px 0', minWidth: 320, maxWidth: 420,
                maxHeight: '60vh', overflowY: 'auto',
              }}>
                {phases.map((p, i) => {
                  const status = i < currentPhase ? 'done' : i === currentPhase ? 'active' : 'pending';
                  const dotColor = status === 'done' ? 'var(--green-text)' : status === 'active' ? 'var(--accent)' : 'var(--border)';
                  const bg = status === 'active' ? 'var(--paper-warm)' : 'transparent';
                  return (
                    <div key={p.id} style={{ display: 'flex', gap: 10, padding: '8px 16px', background: bg, alignItems: 'flex-start' }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: dotColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', fontWeight: 700, lineHeight: 1, marginTop: 1,
                      }}>
                        {status === 'done' ? '✓' : status === 'active' ? (i + 1) : (i + 1)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.82rem', fontWeight: status === 'active' ? 600 : 500,
                          color: status === 'pending' ? 'var(--ink-faint)' : 'var(--ink)',
                        }}>
                          {p.title}
                          {status === 'done' && <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--green-text)' }}>✅</span>}
                          {status === 'active' && <span style={{ marginLeft: 6, fontSize: '0.6rem', color: 'var(--accent)' }}>进行中</span>}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', lineHeight: 1.4, marginTop: 1 }}>
                          {p.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div className={m.role === 'user' ? 'msg-user' : 'msg-ai'} style={{ maxWidth: '74%', position: 'relative' }}>
                {m.role === 'user' ? (
                  <div style={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                ) : (
                  <>
                    <Markdown content={m.content} />
                    {m.content && m.content.length > 20 && (
                      <div style={{ marginTop: 8, textAlign: 'right' }}>
                        <button
                          onClick={() => { setEditorContent(m.content); setEditorOpen(true); }}
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', color: 'var(--ink-muted)', cursor: 'pointer' }}
                        >
                          📝 导入编辑
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ display: 'flex' }}>
              <div className="msg-ai">
                <span className="cursor-blink" style={{ color: 'var(--ink-faint)' }}>▊</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div style={{ padding: '10px 24px', background: 'var(--red-bg)', borderTop: '1px solid var(--red-border)', fontSize: '0.85rem', color: 'var(--red-text)', flexShrink: 0 }}>
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 12, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: 'var(--red-text)' }}>关闭</button>
          </div>
        )}

        <div style={{ padding: '14px 24px 18px', borderTop: '1px solid var(--border)', background: 'white', flexShrink: 0 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sending ? 'AI 思考中…' : '输入你的回答，或选择编号…  Shift+Enter 换行'}
              disabled={sending}
              rows={1}
              style={{
                flex: 1, padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 12,
                fontSize: '0.9rem', outline: 'none', background: 'var(--paper)',
                resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                maxHeight: 160, overflowY: 'auto',
              }}
            />
            <button onClick={() => handleSend()} disabled={sending || !input.trim()}
              style={{ padding: '10px 20px', height: 40, background: sending || !input.trim() ? '#e0ddda' : 'var(--accent)', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 500, cursor: sending || !input.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              发送
            </button>
          </div>
          <div style={{ maxWidth: 800, margin: '4px auto 0', fontSize: '0.7rem', color: 'var(--ink-faint)', textAlign: 'right' }}>
            <kbd style={{ background:'var(--sidebar-bg)', padding:'1px 5px', borderRadius:3, border:'1px solid var(--border)', fontSize:'0.65rem' }}>Enter</kbd> 发送 · <kbd style={{ background:'var(--sidebar-bg)', padding:'1px 5px', borderRadius:3, border:'1px solid var(--border)', fontSize:'0.65rem' }}>Shift+Enter</kbd> 换行
          </div>
        </div>
      </div>

      {/* Markdown Editor panel */}
      {editorOpen && (
        <div style={{ flex: 2, minWidth: 340, maxWidth: '42%' }}>
          <MarkdownEditor
            initialContent={editorContent}
            workflowId={id}
            sessionId={sessionId || ''}
            onClose={() => setEditorOpen(false)}
            onReviseRequest={(msg) => setPendingRevise(msg)}
          />
        </div>
      )}
    </div>
  );
}
