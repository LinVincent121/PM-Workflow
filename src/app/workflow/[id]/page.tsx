'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import UserAvatar from '@/components/UserAvatar';
import Markdown from '@/components/Markdown';
import MarkdownEditor from '@/components/MarkdownEditor';
import ResizeHandle from '@/components/ResizeHandle';

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
  const [deliverableReady, setDeliverableReady] = useState(false); // Track if final report is ready
  const autoSendTriggeredRef = useRef(false); // useRef to prevent double-send (state is async, ref is sync)
  const sendingRef = useRef(false); // synchronous guard against double-invocation of handleSend
  const abortRef = useRef<AbortController | null>(null); // abort in-flight SSE on unmount
  const [uploadedFiles, setUploadedFiles] = useState<{fileId:string;originalName:string;mimeType:string;size:number;isImage:boolean}[]>([]);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesConsumedRef = useRef(false);

  // Only show "导入编辑" button in the final phase (deliverable review stage)
  const isInFinalPhase = totalPhases > 0 && currentPhase === totalPhases - 1;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [hasImportedSession, setHasImportedSession] = useState(false);
  const [importedMsgIdx, setImportedMsgIdx] = useState<number | null>(null);
  const [editingMsgIdx, setEditingMsgIdx] = useState<number | null>(null); // which message the editor was opened for
  const [pendingRevise, setPendingRevise] = useState<string | null>(null);
  const [reviewActive, setReviewActive] = useState(false);
  const [chatWidth, setChatWidth] = useState(() => {
    if (typeof window === 'undefined') return 72;
    try { const v = localStorage.getItem('pm-chat-width'); return v ? parseInt(v) : 72; } catch { return 72; }
  });
  const [reviewWidth, setReviewWidth] = useState(() => {
    if (typeof window === 'undefined') return 360;
    try { const v = localStorage.getItem('pm-review-width'); return v ? parseInt(v) : 360; } catch { return 360; }
  });
  const chatNarrow = editorOpen && chatWidth < 100;
  const chatWidthRef = useRef(chatWidth);
  chatWidthRef.current = chatWidth;
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const phaseRef = useRef<HTMLDivElement>(null);

  // Restore editor session from storage when sessionId changes (route navigation)
  useEffect(() => {
    if (!sessionId) return;
    const key = `pm-editor-meta-${sessionId}`;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const { content, hasImported } = JSON.parse(saved);
        if (content) {
          setEditorContent(content);
          setHasImportedSession(hasImported || false);
        }
      }
    } catch {}
  }, [sessionId]);

  // Save editor session meta whenever it changes
  useEffect(() => {
    if (!sessionId || !hasImportedSession) return;
    try {
      sessionStorage.setItem(`pm-editor-meta-${sessionId}`, JSON.stringify({
        content: editorContent,
        hasImported: hasImportedSession,
      }));
    } catch {}
  }, [editorContent, hasImportedSession, sessionId]);

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
            // Check if deliverable is ready based on last AI message
            const lastAiMsg = [...data.messages].reverse().find((m: any) => m.role === 'assistant');
            if (lastAiMsg && data.currentPhase === totalPhases - 1 && checkDeliverableComplete(lastAiMsg.content)) {
              setDeliverableReady(true);
            }
          } else { showGreeting(); }
        })
        .catch(() => showGreeting())
        .finally(() => setHistoryLoaded(true));
    } else {
      showGreeting();
      setHistoryLoaded(true);
    }
  }, [workflowName, historyLoaded]);

  // Auto-send initial message from URL parameter
  useEffect(() => {
    if (!historyLoaded || messages.length > 1 || sending || autoSendTriggeredRef.current) return;
    const initialMsg = searchParams.get('initialMessage');
    if (initialMsg && initialMsg.trim()) {
      autoSendTriggeredRef.current = true; // Synchronous guard against re-entry
      // Call handleSend directly — no timer, no race window
      handleSend(initialMsg.trim());
    }
  }, [historyLoaded, messages.length, searchParams, sending]);

  // Cleanup: abort in-flight SSE request on unmount (prevents Strict Mode double-stream)
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  function showGreeting() {
    // Show greeting but don't create session yet - session will be created on first user message
    setMessages([{ role: 'assistant', content: `你好！我将引导你完成「**${workflowName}**」工作流。\n\n准备好开始了吗？请描述一下你需要解决的产品问题。` }]);
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Auto-expand chat when editor opens (default ~40% of available width)
  useEffect(() => {
    if (editorOpen && chatWidthRef.current < 200) {
      const available = window.innerWidth - 64;
      const target = Math.floor(available * 0.4);
      const next = Math.max(200, Math.min(600, target));
      setChatWidth(next);
    }
  }, [editorOpen]);
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
    if (!msgText || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true); setError(null);

    const userMsg: Message = { role: 'user', content: msgText };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideMessage) setInput('');

    const assistantIdx = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    // Create abort controller for cleanup (prevents double-stream on unmount/remount)
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId || undefined, workflowId: sessionId ? undefined : id, message: userMsg.content, files: uploadedFiles }),
        signal: abort.signal,
      });
      // Clear sessionStorage after files are consumed
      try { sessionStorage.removeItem('pm-uploaded-files'); } catch {}
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
            if (chunk.done) {
              setUploadedFiles([]); // Clear files after first message
              // Check if we're in final phase and deliverable is complete
              setMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[assistantIdx];
                // Use backend signal (phaseCompleted) OR frontend heuristics
                if (lastMsg && (chunk.phaseCompleted || checkDeliverableComplete(lastMsg.content))) {
                  if (isInFinalPhase) {
                    setDeliverableReady(true);
                    // Mark all phases as complete
                    setCurrentPhase(totalPhases);
                  }
                }
                return updated;
              });
              break;
            }
            setMessages(prev => { const updated = [...prev]; if (assistantIdx < updated.length) updated[assistantIdx] = { ...updated[assistantIdx], content: updated[assistantIdx].content + (chunk.delta || '') }; return updated; });
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // Silently ignore aborted requests
      setError(err.message);
      setMessages(prev => { const copy = [...prev]; if (copy[assistantIdx]?.content === '') copy.splice(assistantIdx, 1); return copy; });
    } finally {
      setSending(false);
      sendingRef.current = false;
      abortRef.current = null;
      if (sessionId && messages.length < 6) {
        fetch('/api/sessions/generate-title', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId}) }).catch(() => {});
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // Detect deliverable completion using multiple signals
  function checkDeliverableComplete(content: string): boolean {
    // Signal 1: Explicit completion markers
    const markers = ['✅', '完成', 'Phase Complete', '进入下一阶段'];
    const hasMarker = markers.some(m => content.includes(m));

    // Signal 2: Length - deliverables are usually substantial (>800 chars)
    const isLongEnough = content.length > 800;

    // Signal 3: Structure - reports typically have multiple headers
    const headerCount = (content.match(/^##\s/gm) || []).length;
    const hasStructure = headerCount >= 3;

    // Signal 4: Check if in final phase (we know workflow structure)
    const inFinalPhase = totalPhases > 0 && currentPhase === totalPhases - 1;

    // Deliverable ready if: (has marker) OR (in final phase AND (long OR structured))
    return hasMarker || (inFinalPhase && (isLongEnough || hasStructure));
  }

  // ── Editor helpers ──
  function openEditor(content: string, msgIdx: number) {
    setEditorContent(content);
    setHasImportedSession(true);
    setEditorOpen(true);
    setEditingMsgIdx(msgIdx);
  }

  function closeEditor() {
    setEditorOpen(false);
    setReviewActive(false);
  }

  function handleImportDone() {
    // Mark the message that was being edited as imported
    if (editingMsgIdx !== null) {
      setImportedMsgIdx(editingMsgIdx);
    }
    // Close editor but keep editingMsgIdx so the imported state persists
    // (editingMsgIdx is cleared only when a new editor session starts)
    setEditorOpen(false);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      {/* Image preview modal */}
      {previewImg && (
        <div onClick={e => { if (e.target === e.currentTarget) setPreviewImg(null); }}
          style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <img src={previewImg} alt="预览" style={{ maxWidth:'90vw', maxHeight:'90vh', objectFit:'contain', borderRadius:4 }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setPreviewImg(null)}
            style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,0.15)', border:'none', color:'white', fontSize:'1.5rem', cursor:'pointer', width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
      )}

      {/* Chat panel — resizable narrow strip */}
      <div style={{
        width: editorOpen ? chatWidth : '100%',
        minWidth: editorOpen ? chatWidth : 0,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: 'var(--white)',
        borderRight: editorOpen ? '1px solid var(--border)' : 'none',
        transition: editorOpen ? 'none' : 'width 0.22s ease',
      }}>
        {/* Header */}
        <header style={{ padding: chatNarrow ? '10px 4px' : '10px 24px', borderBottom:'1px solid var(--border)', background:'white', display:'flex', alignItems:'center', gap:12, flexShrink:0, height:48, justifyContent: chatNarrow ? 'center' : 'flex-start' }}>
          {chatNarrow ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--ink-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h6M5 8h4"/><rect x="1.5" y="1.5" width="13" height="10" rx="1.5"/><path d="M5 14l2-2.5h7V11"/></svg>
          ) : (
            <>
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
                  // Restore previously imported session, or grab last AI message on first open
                  if (hasImportedSession) {
                    setEditorOpen(true);
                  } else {
                    const lastAi = [...messages].reverse().find(m => m.role === 'assistant');
                    if (lastAi) openEditor(lastAi.content, messages.indexOf(lastAi));
                    else setEditorOpen(true);
                  }
                }
              }}
              className="btn-ghost" style={{ padding:'4px 14px', fontSize:'0.72rem', display:'flex', alignItems:'center', gap:5 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 10h10M3 6h7"/><rect x="2" y="2" width="12" height="12" rx="1.5"/></svg>
                {editorOpen ? '收起编辑器' : '打开编辑器'}
              </button>
              <UserAvatar />
            </>
          )}
        </header>

        {!chatNarrow && (
          <>
            {/* Phase progress */}
            {totalPhases > 0 && (
          <div style={{ padding:'6px 24px', background:'white', borderBottom:'1px solid var(--border-light)', flexShrink:0, position:'relative' }} ref={phaseRef}>
            <button onClick={() => setPhaseExpanded(!phaseExpanded)}
              style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', width:'100%', padding:0, fontFamily:'inherit' }}>
              <span style={{ fontSize:'0.66rem', fontWeight:600, color:'var(--ink-faint)', letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                阶段 {currentPhase >= totalPhases ? totalPhases : currentPhase + 1} / {totalPhases}
              </span>
              <div style={{ flex:1, height:3, background:'var(--border-light)', borderRadius:1.5, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${currentPhase >= totalPhases ? 100 : ((currentPhase+1)/totalPhases)*100}%`, background: currentPhase >= totalPhases ? 'var(--green-text)' : 'var(--accent)', borderRadius:1.5, transition:'width 0.5s ease' }} />
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
                  const status = currentPhase >= totalPhases ? 'done' : i < currentPhase ? 'done' : i === currentPhase ? 'active' : 'pending';
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
        <div style={{ flex:1, overflow:'auto', padding:'24px 32px 40px', display:'flex', flexDirection:'column', alignItems:'center' }}>
          <div style={{ width:'100%', maxWidth:900, display:'flex', flexDirection:'column', gap:16 }}>
            {/* Uploaded files — shown above first user message */}
            {uploadedFiles.length > 0 && messages.length > 0 && (
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <div style={{ maxWidth:'75%', display:'flex', gap:6, flexWrap:'wrap' }}>
                  {uploadedFiles.map(f => (
                    <div key={f.fileId} style={{
                      display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
                      background:'var(--accent-bg)', border:'1px solid var(--accent-border)',
                      borderRadius:4, fontSize:'0.72rem', color:'var(--accent)',
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
                      <button onClick={() => setUploadedFiles(prev => prev.filter(x => x.fileId !== f.fileId))}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', padding:0, fontSize:'0.9rem', lineHeight:1 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', justifyContent: m.role==='user'?'flex-end':'flex-start' }}>
                <div className={m.role==='user'?'msg-user':'msg-ai'} style={{ maxWidth:'75%', position:'relative' }}>
                  {m.role === 'user' ? (
                    <div style={{ fontSize:'0.92rem', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{typeof m.content === 'string' ? m.content : (m.content as any[]).find((p:any) => p.type === 'text')?.text || ''}</div>
                  ) : (
                    <>
                      <Markdown content={typeof m.content === 'string' ? m.content : ''} />
                      {sending && i === messages.length - 1 && (
                        <span className="cursor-blink" style={{ color:'var(--ink-faint)', fontSize:'0.85rem' }}>▊</span>
                      )}
                      {/* Only show "导入编辑" on the LAST AI message when deliverable is ready */}
                      {m.content && m.content.length > 20 && deliverableReady && i === messages.length - 1 && (
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
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Error bar */}
        {error && (
          <div style={{ padding:'8px 24px', background:'var(--red-bg)', borderTop:'1px solid var(--red-border)', fontSize:'0.8rem', color:'var(--red-text)', flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
            {error}
            <button onClick={() => setError(null)} style={{ background:'none', border:'none', textDecoration:'underline', cursor:'pointer', color:'var(--red-text)', fontSize:'0.76rem' }}>关闭</button>
          </div>
        )}

        {/* Input */}
        <div style={{ padding:'16px 32px 20px', borderTop:'1px solid var(--border)', background:'white', flexShrink:0 }}>
          <div style={{ maxWidth:900, margin:'0 auto' }}>
            {/* Input container - modern chat UI style */}
            <div style={{
              display:'flex', alignItems:'flex-end', gap:12,
              background:'white', border:'1.5px solid #e5e7eb', borderRadius:24,
              padding:'12px 16px', transition:'border-color 0.2s ease',
              boxShadow:'0 2px 8px rgba(0,0,0,0.04)'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>

              <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={sending ? 'AI 思考中…' : '输入你的问题…'}
                disabled={sending}
                style={{
                  flex:1, border:'none', background:'transparent', fontSize:'0.92rem',
                  outline:'none', resize:'none', minHeight:24, maxHeight:120,
                  fontFamily:'"Inter", system-ui, sans-serif', lineHeight:1.6,
                  padding:'4px 8px', color:'var(--ink)', overflow:'hidden'
                }}
              />

              {/* Right toolbar */}
              <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                {/* File upload button */}
                <input ref={fileInputRef} type="file" multiple
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md"
                  style={{ display:'none' }}
                  onChange={e => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files);
                      const docs = newFiles.filter(f => !f.type.startsWith('image/'));
                      const images = newFiles.filter(f => f.type.startsWith('image/'));
                      const currentDocs = uploadedFiles.filter(f => !f.isImage);
                      const currentImages = uploadedFiles.filter(f => f.isImage);
                      const valid = [...docs.slice(0, 1 - currentDocs.length), ...images.slice(0, 2 - currentImages.length)];
                      if (valid.length === 0) { e.target.value = ''; return; }
                      const formData = new FormData();
                      valid.forEach(f => formData.append('files', f));
                      fetch('/api/upload', { method: 'POST', body: formData })
                        .then(r => r.json())
                        .then(data => {
                          if (data.files) setUploadedFiles(prev => [...prev, ...data.files]);
                        })
                        .catch(() => {});
                    }
                    e.target.value = '';
                  }} />
                <button onClick={() => fileInputRef.current?.click()}
                  title="上传文档 (.pdf, .doc, .txt, .md) 或图片"
                  disabled={sending}
                  style={{
                    background:'transparent', border:'none', borderRadius:'50%',
                    width:36, height:36, cursor: sending ? 'not-allowed' : 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all 0.2s ease', color:'#6b7280', opacity: sending ? 0.5 : 1
                  }}
                  onMouseEnter={e => { if (!sending) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#3b82f6'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>

                {/* Image upload button */}
                <button onClick={() => fileInputRef.current?.click()}
                  title="上传图片 (.png, .jpg, .gif, .webp)"
                  disabled={sending}
                  style={{
                    background:'transparent', border:'none', borderRadius:'50%',
                    width:36, height:36, cursor: sending ? 'not-allowed' : 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all 0.2s ease', color:'#6b7280', opacity: sending ? 0.5 : 1
                  }}
                  onMouseEnter={e => { if (!sending) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#3b82f6'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>

                {/* Send button */}
                <button onClick={() => handleSend()} disabled={sending || !input.trim()}
                  style={{
                    background: (!input.trim() || sending) ? '#e5e7eb' : '#3b82f6',
                    border:'none', borderRadius:'50%',
                    width:36, height:36, cursor: (!input.trim() || sending) ? 'not-allowed' : 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all 0.2s ease', color:'white',
                    opacity: sending ? 0.6 : 1
                  }}
                  onMouseEnter={e => { if (input.trim() && !sending) e.currentTarget.style.background = '#2563eb'; }}
                  onMouseLeave={e => { if (input.trim() && !sending) e.currentTarget.style.background = '#3b82f6'; }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
      </div>

      {/* Drag handle: chat ↔ editor */}
      {editorOpen && (
        <ResizeHandle
          onDrag={(dx) => {
            setChatWidth(prev => {
              const next = Math.max(48, Math.min(600, prev + dx));
              return next;
            });
          }}
          onDragEnd={() => {
            try { localStorage.setItem('pm-chat-width', String(chatWidthRef.current)); } catch {}
          }}
        />
      )}

      {/* Editor + Review container */}
      <div style={{ flex: editorOpen ? 1 : '0 0 0', display: editorOpen ? 'flex' : 'none', overflow: 'hidden' }}>
        <MarkdownEditor
          initialContent={editorContent}
          workflowId={id}
          sessionId={sessionId || ''}
          onClose={closeEditor}
          onTitleGenerated={() => {}}
          onReviseRequest={(msg) => setPendingRevise(msg)}
          onImported={handleImportDone}
          onReviewActive={setReviewActive}
        />
      </div>
    </div>
  );
}
