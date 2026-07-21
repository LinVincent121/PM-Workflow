'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from './Markdown';

interface ReviewResult {
  summary: string; strengths: string[]; weaknesses: string[]; suggestions: string[]; completeness: number;
  reviewedAt: number; // timestamp
}
interface HistoryReview {
  result: ReviewResult;
  contentSnapshot: string;
}
interface MiniMessage { role: 'user' | 'assistant'; content: string; }

interface Props {
  initialContent: string; workflowId: string; sessionId: string;
  onClose: () => void; onTitleGenerated?: (title: string) => void;
  onReviseRequest?: (message: string) => void;
  onImported?: () => void;
}

export default function MarkdownEditor({ initialContent, workflowId, sessionId, onClose, onTitleGenerated, onReviseRequest, onImported }: Props) {
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewHistory, setReviewHistory] = useState<HistoryReview[]>([]);
  const [viewingHistoryIdx, setViewingHistoryIdx] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [lastEditTime, setLastEditTime] = useState<Date>(new Date());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveVersion, setSaveVersion] = useState('V1.0.0');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outputId, setOutputId] = useState<string | null>(null);
  const [versionCount, setVersionCount] = useState(1);
  const [imported, setImported] = useState(false);
  const [savedOutputId, setSavedOutputId] = useState<string | null>(null); // saved md reference for revise
  const [miniChatOpen, setMiniChatOpen] = useState(false);
  const [miniMessages, setMiniMessages] = useState<MiniMessage[]>([]);
  const [miniInput, setMiniInput] = useState('');
  const [miniSending, setMiniSending] = useState(false);
  const miniBottomRef = useRef<HTMLDivElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setContent(initialContent); }, [initialContent]);
  useEffect(() => { miniBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [miniMessages]);

  const autoSave = useCallback((text: string) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => setLastEditTime(new Date()), 2000);
  }, []);

  function handleContentChange(val: string) { setContent(val); setSaved(false); autoSave(val); }

  // ── Editable review: user can modify review cards directly ──
  function updateReviewSummary(text: string) {
    if (!reviewResult) return;
    setReviewResult({ ...reviewResult, summary: text });
  }
  function updateReviewStrength(idx: number, text: string) {
    if (!reviewResult) return;
    const arr = [...reviewResult.strengths]; arr[idx] = text;
    setReviewResult({ ...reviewResult, strengths: arr });
  }
  function addReviewStrength() {
    if (!reviewResult) return;
    setReviewResult({ ...reviewResult, strengths: [...reviewResult.strengths, ''] });
  }
  function removeReviewStrength(idx: number) {
    if (!reviewResult) return;
    setReviewResult({ ...reviewResult, strengths: reviewResult.strengths.filter((_,i) => i !== idx) });
  }
  function updateReviewWeakness(idx: number, text: string) {
    if (!reviewResult) return;
    const arr = [...reviewResult.weaknesses]; arr[idx] = text;
    setReviewResult({ ...reviewResult, weaknesses: arr });
  }
  function addReviewWeakness() {
    if (!reviewResult) return;
    setReviewResult({ ...reviewResult, weaknesses: [...reviewResult.weaknesses, ''] });
  }
  function removeReviewWeakness(idx: number) {
    if (!reviewResult) return;
    setReviewResult({ ...reviewResult, weaknesses: reviewResult.weaknesses.filter((_,i) => i !== idx) });
  }
  function updateReviewSuggestion(idx: number, text: string) {
    if (!reviewResult) return;
    const arr = [...reviewResult.suggestions]; arr[idx] = text;
    setReviewResult({ ...reviewResult, suggestions: arr });
  }
  function addReviewSuggestion() {
    if (!reviewResult) return;
    setReviewResult({ ...reviewResult, suggestions: [...reviewResult.suggestions, ''] });
  }
  function removeReviewSuggestion(idx: number) {
    if (!reviewResult) return;
    setReviewResult({ ...reviewResult, suggestions: reviewResult.suggestions.filter((_,i) => i !== idx) });
  }

  // Show result — either latest or from history
  const displayedResult = viewingHistoryIdx !== null
    ? reviewHistory[viewingHistoryIdx]?.result ?? null
    : reviewResult;

  // ── Review ──
  async function doReview() {
    if (!content.trim()) return;
    setReviewing(true); setReviewError(null);
    try {
      const res = await fetch('/api/review', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ content, workflowId }) });
      if (!res.ok) throw new Error((await res.json().catch(()=>({error:'请求失败'}))).error);
      const data = await res.json();
      const result: ReviewResult = { ...data, reviewedAt: Date.now() };
      setReviewResult(result);
      setReviewHistory(prev => [...prev, { result, contentSnapshot: content }]);
      setViewingHistoryIdx(null);
    } catch (err: any) { setReviewError(err.message); }
    finally { setReviewing(false); }
  }

  function showLatestReview() {
    if (reviewResult) {
      setViewingHistoryIdx(null); // switch back to latest
    } else {
      doReview();
    }
  }

  function viewHistoryReview(idx: number) {
    setViewingHistoryIdx(idx);
  }

  // ── Revise: smart prompt + auto-save ──
  async function handleRevise(customFeedback?: string) {
    const target = displayedResult;
    if (!target || !onReviseRequest) return;

    // 1. Auto-save current content as a work output first
    let fileRef = savedOutputId;
    if (!fileRef) {
      try {
        const title = (await generateTitleQuick()).trim() || `审查文档_${new Date().toLocaleDateString('zh-CN').replace(/\//g,'-')}`;
        const res = await fetch('/api/outputs', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ sessionId, workflowId, title, version: 'V1.0.0', content }),
        });
        if (res.ok) {
          const d = await res.json();
          fileRef = d.outputId;
          setSavedOutputId(d.outputId);
          setOutputId(d.outputId);
          setSaved(true);
        }
      } catch {}
    }

    // 2. Build smart prompt
    const reviewLines = [
      `审查总结：${target.summary}`,
      `优点：${target.strengths.join('；')}`,
      `待改进：${target.weaknesses.join('；')}`,
      `改进建议：${target.suggestions.join('；')}`,
      `完整度：${target.completeness}%`,
    ];
    if (customFeedback) reviewLines.push(`用户补充意见：${customFeedback}`);

    const reviewText = reviewLines.join('\n');

    // Content is short enough to embed directly
    if (content.length <= 4000) {
      onReviseRequest(`请根据以下审查结果修改文档内容，输出修改后的完整版本：\n\n${reviewText}\n\n原始文档：\n${content}`);
      return;
    }

    // Content is long — reference the saved file
    if (fileRef) {
      onReviseRequest(
        `我在「工作产出」中保存了一份需要修改的文档（outputId: ${fileRef}），标题为"${saveTitle || '审查文档'}"。\n\n` +
        `请先读取该文档的完整内容，然后根据以下审查结果对所有问题逐一修改，输出修改后的完整版本。\n\n${reviewText}\n\n` +
        `要求：\n1. 读取保存的文档（outputId: ${fileRef}）\n2. 对审查中提到的每一条问题逐一修改\n3. 输出完整的修改后文档`
      );
      return;
    }

    // Fallback: truncate
    onReviseRequest(`请根据以下审查结果修改文档内容。注意：原文较长，以下提供原文前 4000 字符作为参考，请基于审查意见输出完整修改版本：\n\n${reviewText}\n\n原文摘要：\n${content.substring(0, 4000)}`);
  }

  async function generateTitleQuick(): Promise<string> {
    try {
      const res = await fetch('/api/outputs/generate-title', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ content: content.substring(0,2000) }) });
      if (res.ok) { const d = await res.json(); if (d.title) return d.title; }
    } catch {}
    return `审查文档_${new Date().toLocaleDateString('zh-CN').replace(/\//g,'-')}`;
  }

  // ── Mini chat (user feedback for revise) ──
  function openFeedbackChat() {
    setMiniChatOpen(true);
  }

  function sendFeedbackAndRevise() {
    const fb = miniInput.trim();
    if (!fb) { handleRevise(); return; }
    setMiniChatOpen(false);
    setMiniInput('');
    handleRevise(fb);
  }

  async function sendMiniMessage(msgs?: MiniMessage[]) {
    if (miniSending) return;
    const toSend = msgs || [{ role:'user' as const, content: miniInput.trim() }];
    if (!msgs && !miniInput.trim()) return;
    setMiniSending(true);
    if (!msgs) { setMiniMessages(prev=>[...prev,{role:'user',content:miniInput.trim()}]); setMiniInput(''); }
    setMiniMessages(prev=>[...prev,{role:'assistant',content:''}]);
    const aiIdx = msgs ? 1 : miniMessages.length + 1;
    try {
      const res = await fetch('/api/chat/stream', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ workflowId, message: (toSend[0] as MiniMessage).content }) });
      if (!res.ok) throw new Error('请求失败');
      const reader = res.body?.getReader(); if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream:true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim(); if (!jsonStr) continue;
          try { const chunk = JSON.parse(jsonStr); if (chunk.error) break; if (chunk.done) break;
            setMiniMessages(prev => { const u=[...prev]; if(aiIdx<u.length)u[aiIdx]={...u[aiIdx],content:u[aiIdx].content+(chunk.delta||'')}; return u; });
          } catch {}
        }
      }
    } catch { setMiniMessages(prev=>prev.filter((_,j)=>j!==aiIdx)); }
    finally { setMiniSending(false); }
  }

  function importRevision(text: string) {
    setContent(text);
    setMiniChatOpen(false);
    setMiniMessages([]);
    setImported(true);
    onImported?.();
  }

  // ── Save ──
  async function handleSave() {
    if (!saveTitle.trim() || !saveVersion.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/outputs', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ outputId: outputId||undefined, sessionId, workflowId, title: saveTitle.trim(), version: saveVersion.trim(), content }) });
      if (!res.ok) throw new Error('保存失败');
      const data = await res.json();
      if (data.outputId && !outputId) { setOutputId(data.outputId); setSavedOutputId(data.outputId); }
      setSaved(true); setVersionCount(prev=>prev+1);
      const parts = saveVersion.match(/^V(\d+)\.(\d+)\.(\d+)$/i);
      if (parts) setSaveVersion(`V${parts[1]}.${parts[2]}.${parseInt(parts[3],10)+1}`);
      setShowSaveDialog(false);
      onTitleGenerated?.(saveTitle.trim());
    } catch {} finally { setSaving(false); }
  }

  async function openSaveDialog() {
    setShowSaveDialog(true);
    // Use a simple default title — skip the slow AI title generation
    if (!outputId && !saveTitle) {
      const defaultTitle = `${workflowId || '文档'}_报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`;
      setSaveTitle(defaultTitle);
    }
  }

  return (
    <div style={{ flex: '0 0 50%', display:'flex', flexDirection:'column', background:'white', borderLeft:'1px solid var(--border)', position:'relative', minWidth:340 }}>
      {/* Review loading overlay */}
      {reviewing && (
        <div style={{ position:'absolute', inset:0, zIndex:50, background:'rgba(255,255,255,0.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10 }}>
          <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTop:'3px solid var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          <span style={{ fontSize:'0.85rem', fontWeight:500, color:'var(--ink-muted)' }}>AI 审查中…</span>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ padding:'8px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexShrink:0, height:48 }}>
        <button onClick={onClose} title="收起编辑器" className="btn-ghost" style={{ padding:'4px 10px', fontSize:'0.72rem', display:'flex', alignItems:'center', gap:3 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 4l-6 4 6 4"/></svg>
          收起
        </button>
        {imported && (
          <span style={{ fontSize:'0.66rem', color:'var(--green-text)', background:'var(--green-bg)', padding:'2px 8px', borderRadius:3, fontWeight:500 }}>已导入</span>
        )}
        <div style={{ flex:1 }} />

        {/* Review button: changes text after first review */}
        {reviewResult ? (
          <button onClick={showLatestReview}
            className="btn-ghost" style={{ padding:'4px 12px', fontSize:'0.72rem', color:'var(--green-text)', borderColor:'var(--green-border)', background:'var(--green-bg)' }}>
            AI 已审查
          </button>
        ) : (
          <button onClick={doReview} disabled={reviewing || !content.trim()}
            className="btn-ghost" style={{ padding:'4px 12px', fontSize:'0.72rem', opacity: reviewing?0.5:1 }}>
            AI 审查
          </button>
        )}

        <div style={{ display:'flex', borderRadius:3, overflow:'hidden', border:'1px solid var(--border)' }}>
          <button onClick={() => setViewMode('edit')}
            style={{ padding:'4px 12px', fontSize:'0.72rem', border:'none', cursor:'pointer', fontFamily:'inherit',
              background: viewMode==='edit'?'var(--accent)':'white', color: viewMode==='edit'?'white':'var(--ink-muted)', fontWeight:500 }}>
            编辑
          </button>
          <button onClick={() => setViewMode('preview')}
            style={{ padding:'4px 12px', fontSize:'0.72rem', border:'none', cursor:'pointer', fontFamily:'inherit',
              background: viewMode==='preview'?'var(--accent)':'white', color: viewMode==='preview'?'white':'var(--ink-muted)', fontWeight:500 }}>
            预览
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ flex: displayedResult ? '0 0 50%' : 1, overflow:'auto', borderBottom: displayedResult ? '1px solid var(--border)' : 'none' }}>
          {viewMode === 'edit' ? (
            <textarea value={content} onChange={e => handleContentChange(e.target.value)}
              placeholder="在此编辑 Markdown 内容…"
              style={{ width:'100%', height:'100%', padding:'16px 18px', border:'none', outline:'none', resize:'none', fontFamily:'"JetBrains Mono",ui-monospace,monospace', fontSize:'0.78rem', lineHeight:1.7, background:'var(--sidebar-bg)', color:'var(--ink)' }} />
          ) : (
            <div style={{ padding:'16px 18px' }}><Markdown content={content} /></div>
          )}
        </div>

        {/* Review result panel */}
        {displayedResult && (
          <div style={{ flex: '0 0 50%', overflowY:'auto', display:'flex', flexDirection:'column' }}>
            {/* Review header bar */}
            <div style={{ padding:'8px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, background:'var(--sidebar-bg)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:'0.76rem', fontWeight:600 }}>
                  审查结果
                  {viewingHistoryIdx !== null && <span style={{ fontWeight:400, color:'var(--ink-faint)', marginLeft:4 }}>#{viewingHistoryIdx + 1}</span>}
                </span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:'0.66rem', color:'var(--ink-muted)' }}>完整度</span>
                  <span style={{ fontSize:'0.82rem', fontWeight:700, fontFamily:'"JetBrains Mono",monospace', color: displayedResult.completeness>=70?'var(--green-text)':'var(--accent)' }}>
                    {displayedResult.completeness}%
                  </span>
                  <div style={{ width:60, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${displayedResult.completeness}%`, background: displayedResult.completeness>=70?'var(--green-text)':'var(--accent)', borderRadius:2 }} />
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {/* Re-review button */}
                <button onClick={doReview} disabled={reviewing} title="再次启动AI审查"
                  className="btn-ghost" style={{ padding:'4px 10px', fontSize:'0.66rem' }}>
                  {reviewing ? '审查中…' : '再次审查'}
                </button>
                {/* Revise button */}
                <button onClick={() => handleRevise()} className="btn-primary" style={{ padding:'5px 14px', fontSize:'0.7rem' }}>
                  依此修改
                </button>
                {/* User feedback */}
                <button onClick={openFeedbackChat} title="补充修改意见"
                  className="btn-ghost" style={{ padding:'4px 8px', fontSize:'0.66rem' }}>
                  补充意见
                </button>
              </div>
            </div>

            {/* History timeline — show if more than 1 review */}
            {reviewHistory.length > 1 && (
              <div style={{ padding:'6px 14px', borderBottom:'1px solid var(--border-light)', display:'flex', gap:6, overflowX:'auto', flexShrink:0, background:'white' }}>
                <span style={{ fontSize:'0.64rem', color:'var(--ink-faint)', fontWeight:500, whiteSpace:'nowrap' }}>审查记录：</span>
                {reviewHistory.map((h, i) => (
                  <button key={i} onClick={() => viewHistoryReview(i)}
                    style={{
                      background: (viewingHistoryIdx ?? reviewHistory.length - 1) === i ? 'var(--accent)' : 'var(--sidebar-hover)',
                      color: (viewingHistoryIdx ?? reviewHistory.length - 1) === i ? 'white' : 'var(--ink-muted)',
                      border: 'none', borderRadius:3, padding:'2px 8px', fontSize:'0.62rem', cursor:'pointer',
                      fontFamily:'"JetBrains Mono",monospace', whiteSpace:'nowrap',
                    }}>
                    #{i + 1} · {h.result.completeness}%
                  </button>
                ))}
              </div>
            )}

            {/* Review cards — editable inline */}
            <div style={{ flex:1, overflowY:'auto', padding:'10px 14px', display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ background:'var(--paper)', borderRadius:4, padding:'10px 14px', border:'1px solid var(--border-light)' }}>
                <div style={{ fontSize:'0.66rem', fontWeight:600, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>总结</div>
                <textarea value={displayedResult.summary} onChange={e => updateReviewSummary(e.target.value)}
                  style={{ width:'100%', padding:'6px 8px', border:'1px solid var(--border-light)', borderRadius:3, fontSize:'0.74rem', lineHeight:1.5, resize:'vertical', fontFamily:'inherit', background:'white', minHeight:50 }} />
              </div>
              {displayedResult.strengths.length>0 && (
                <div style={{ background:'var(--green-bg)', borderRadius:4, padding:'10px 14px', border:'1px solid var(--green-border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ fontSize:'0.66rem', fontWeight:600, color:'var(--green-text)', textTransform:'uppercase', letterSpacing:'0.04em' }}>优点</div>
                    <button onClick={addReviewStrength} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.62rem', color:'var(--green-text)', fontFamily:'inherit' }}>+ 添加</button>
                  </div>
                  <ul style={{ margin:0, paddingLeft:6, display:'flex', flexDirection:'column', gap:4, listStyle:'none' }}>
                    {displayedResult.strengths.map((s,i)=>(
                      <li key={i} style={{ display:'flex', gap:4, alignItems:'flex-start' }}>
                        <input value={s} onChange={e => updateReviewStrength(i, e.target.value)}
                          style={{ flex:1, padding:'4px 8px', border:'1px solid var(--green-border)', borderRadius:2, fontSize:'0.72rem', fontFamily:'inherit', background:'white' }} />
                        <button onClick={() => removeReviewStrength(i)} title="删除" style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.7rem', color:'var(--ink-faint)', padding:'2px' }}>×</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {displayedResult.weaknesses.length>0 && (
                <div style={{ background:'var(--red-bg)', borderRadius:4, padding:'10px 14px', border:'1px solid var(--red-border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ fontSize:'0.66rem', fontWeight:600, color:'var(--red-text)', textTransform:'uppercase', letterSpacing:'0.04em' }}>待改进</div>
                    <button onClick={addReviewWeakness} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.62rem', color:'var(--red-text)', fontFamily:'inherit' }}>+ 添加</button>
                  </div>
                  <ul style={{ margin:0, paddingLeft:6, display:'flex', flexDirection:'column', gap:4, listStyle:'none' }}>
                    {displayedResult.weaknesses.map((s,i)=>(
                      <li key={i} style={{ display:'flex', gap:4, alignItems:'flex-start' }}>
                        <input value={s} onChange={e => updateReviewWeakness(i, e.target.value)}
                          style={{ flex:1, padding:'4px 8px', border:'1px solid var(--red-border)', borderRadius:2, fontSize:'0.72rem', fontFamily:'inherit', background:'white' }} />
                        <button onClick={() => removeReviewWeakness(i)} title="删除" style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.7rem', color:'var(--ink-faint)', padding:'2px' }}>×</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {displayedResult.suggestions.length>0 && (
                <div style={{ background:'var(--accent-bg)', borderRadius:4, padding:'10px 14px', border:'1px solid var(--accent-border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ fontSize:'0.66rem', fontWeight:600, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.04em' }}>建议</div>
                    <button onClick={addReviewSuggestion} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.62rem', color:'var(--accent)', fontFamily:'inherit' }}>+ 添加</button>
                  </div>
                  <ul style={{ margin:0, paddingLeft:6, display:'flex', flexDirection:'column', gap:4, listStyle:'none' }}>
                    {displayedResult.suggestions.map((s,i)=>(
                      <li key={i} style={{ display:'flex', gap:4, alignItems:'flex-start' }}>
                        <input value={s} onChange={e => updateReviewSuggestion(i, e.target.value)}
                          style={{ flex:1, padding:'4px 8px', border:'1px solid var(--accent-border)', borderRadius:2, fontSize:'0.72rem', fontFamily:'inherit', background:'white' }} />
                        <button onClick={() => removeReviewSuggestion(i)} title="删除" style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.7rem', color:'var(--ink-faint)', padding:'2px' }}>×</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {reviewError && (
        <div style={{ borderTop:'1px solid var(--red-border)', padding:'8px 14px', fontSize:'0.72rem', color:'var(--red-text)', flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
          {reviewError}
          <button onClick={()=>setReviewError(null)} style={{ background:'none',border:'none',textDecoration:'underline',cursor:'pointer',color:'var(--red-text)' }}>关闭</button>
        </div>
      )}

      {/* Mini chat — user feedback before revise */}
      {miniChatOpen && (
        <div style={{ borderTop:'1px solid var(--border)', flexShrink:0, display:'flex', flexDirection:'column', maxHeight:220 }}>
          <div style={{ padding:'6px 14px', fontSize:'0.72rem', fontWeight:600, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            补充修改意见
            <button onClick={()=>setMiniChatOpen(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'0.8rem',color:'var(--ink-faint)' }}>✕</button>
          </div>
          <div style={{ padding:'10px 14px' }}>
            <textarea value={miniInput} onChange={e=>setMiniInput(e.target.value)}
              placeholder="输入补充意见（可选），然后点击发送将审查结果和意见一起提交修改。留空则直接按审查结果修改。"
              style={{ width:'100%', height:80, padding:'8px 12px', border:'1px solid var(--border)', borderRadius:3, fontSize:'0.76rem', outline:'none', resize:'none', fontFamily:'inherit' }} />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:6, marginTop:8 }}>
              <button onClick={() => { handleRevise(); setMiniChatOpen(false); }}
                className="btn-ghost" style={{ fontSize:'0.72rem' }}>
                直接修改（不用补充意见）
              </button>
              <button onClick={sendFeedbackAndRevise} disabled={!miniInput.trim()}
                className="btn-primary" style={{ padding:'6px 14px', fontSize:'0.72rem' }}>
                补充并修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0, fontSize:'0.68rem', color:'var(--ink-faint)', fontFamily:'"JetBrains Mono",monospace' }}>
        <span>{saved?'已保存':'已编辑'} · {lastEditTime.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</span>
        <span>V{versionCount}</span>
        {savedOutputId && <span style={{ color:'var(--accent)' }}>已关联产出</span>}
        <div style={{ flex:1 }} />
        <button onClick={openSaveDialog} className="btn-primary" style={{ padding:'5px 16px', fontSize:'0.72rem' }}>
          {saved ? '已保存' : '保存'}
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.25)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e=>{if(e.target===e.currentTarget)setShowSaveDialog(false);}}>
          <div className="modal-content" style={{ background:'white', borderRadius:5, padding:'24px 28px', minWidth:350, border:'1px solid var(--border)' }}>
            <div style={{ fontWeight:600, fontSize:'0.92rem', marginBottom:16 }}>保存工作产出</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:'0.76rem', fontWeight:500, marginBottom:4, color:'var(--ink-muted)' }}>标题</label>
              <input className="input" value={saveTitle} onChange={e=>setSaveTitle(e.target.value)}
                placeholder="6-15字标题" maxLength={32} />
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={{ display:'block', fontSize:'0.76rem', fontWeight:500, marginBottom:4, color:'var(--ink-muted)' }}>版本号</label>
              <input className="input" value={saveVersion} onChange={e=>setSaveVersion(e.target.value)} placeholder="V1.0.0" />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setShowSaveDialog(false)} className="btn-ghost">取消</button>
              <button onClick={handleSave} disabled={saving||!saveTitle.trim()} className="btn-primary" style={{ fontSize:'0.82rem' }}>
                {saving?'保存中…':'保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
