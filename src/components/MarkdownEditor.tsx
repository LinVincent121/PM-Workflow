'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from './Markdown';
import ResizeHandle from './ResizeHandle';

interface ReviewResult {
  summary: string; strengths: string[]; weaknesses: string[]; suggestions: string[]; completeness: number;
  reviewedAt: number; // timestamp
}
interface HistoryReview {
  result: ReviewResult;
  contentSnapshot: string;
}

interface Props {
  initialContent: string; workflowId: string; sessionId: string;
  onClose: () => void; onTitleGenerated?: (title: string) => void;
  onReviseRequest?: (message: string) => void;
  onImported?: () => void;
  onReviewActive?: (active: boolean) => void;
}

export default function MarkdownEditor({ initialContent, workflowId, sessionId, onClose, onTitleGenerated, onReviseRequest, onImported, onReviewActive }: Props) {
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewHistory, setReviewHistory] = useState<HistoryReview[]>([]);
  const [viewingHistoryIdx, setViewingHistoryIdx] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewCollapsed, setReviewCollapsed] = useState(false);
  const [reviewPaneWidth, setReviewPaneWidth] = useState(() => {
    if (typeof window === 'undefined') return 360;
    try { const v = localStorage.getItem('pm-review-pane'); return v ? parseInt(v) : 360; } catch { return 360; }
  });
  const reviewPaneRef = useRef(reviewPaneWidth);
  reviewPaneRef.current = reviewPaneWidth;

  // Auto-adjust review pane when review result first appears
  useEffect(() => {
    if (!reviewResult || reviewCollapsed) return;
    // Calculate available width: total window - sidebar (64px) - chat panel width (from parent)
    // The editor container gets flex:1, so we can use its actual width
    const editorContainer = document.querySelector('[style*="flex: 1"]') as HTMLElement;
    const availableWidth = editorContainer ? editorContainer.offsetWidth : (window.innerWidth - 64);
    const minReviewWidth = Math.floor(availableWidth * 0.45);
    console.log('[MarkdownEditor] Review appeared, availableWidth:', availableWidth, 'current reviewPaneWidth:', reviewPaneWidth, 'target:', minReviewWidth);
    if (reviewPaneWidth < minReviewWidth) {
      const newWidth = Math.min(600, Math.max(300, minReviewWidth));
      console.log('[MarkdownEditor] Expanding review pane to:', newWidth);
      setReviewPaneWidth(newWidth);
    }
  }, [reviewResult, reviewCollapsed]);

  const [lastEditTime, setLastEditTime] = useState<Date | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveVersion, setSaveVersion] = useState('V1.0.0');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [versionCount, setVersionCount] = useState(1);
  const [imported, setImported] = useState(false);
  const [savedOutputId, setSavedOutputId] = useState<string | null>(null); // saved md reference for revise
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Folder state for save dialog
  const [folders, setFolders] = useState<{ folderId: string; name: string; description: string; outputCount: number }[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => { setLastEditTime(new Date()); }, []);

  // ── Persist editor session (content + review) across route changes ──
  const storageKey = `pm-editor-${sessionId}`;

  // Sync content: restore from storage on mount, or use initialContent from import
  useEffect(() => {
    if (!sessionId) {
      setContent(initialContent);
      return;
    }

    try {
      const saved = sessionStorage.getItem(storageKey);
      console.log('[MarkdownEditor] Restore check:', {
        hasInitialContent: !!initialContent,
        initialLength: initialContent?.length,
        hasSaved: !!saved,
        sessionId
      });

      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('[MarkdownEditor] Saved data found:', {
          savedContentLength: parsed.content?.length,
          hasReviewResult: !!parsed.reviewResult,
          hasReviewHistory: parsed.reviewHistory?.length > 0
        });

        // Strategy: Always prefer saved session data over initialContent
        // Only clear saved data when initialContent is explicitly different (new import)

        // Case 1: initialContent is empty → restore from storage (toggle editor open)
        if (!initialContent) {
          console.log('[MarkdownEditor] Case 1: Empty initialContent, restoring from storage');
          setContent(parsed.content || '');
          if (parsed.reviewResult) setReviewResult(parsed.reviewResult);
          if (parsed.reviewHistory) setReviewHistory(parsed.reviewHistory);
          return;
        }

        // Case 2: initialContent matches saved → restore (route change or re-open)
        if (initialContent === parsed.content) {
          console.log('[MarkdownEditor] Case 2: Exact match, restoring review');
          setContent(parsed.content);
          if (parsed.reviewResult) setReviewResult(parsed.reviewResult);
          if (parsed.reviewHistory) setReviewHistory(parsed.reviewHistory);
          return;
        }

        // Case 3: initialContent differs → new import, clear old review
        // But only if it's meaningfully different (not just whitespace)
        if (initialContent.trim() !== parsed.content.trim()) {
          console.log('[MarkdownEditor] Case 3: Different content, clearing review');
          setContent(initialContent);
          setReviewResult(null);
          setReviewHistory([]);
          setReviewCollapsed(false);
          return;
        }

        // Case 4: Same content (minor whitespace diff) → restore review
        console.log('[MarkdownEditor] Case 4: Same content with whitespace diff, restoring review');
        setContent(initialContent);
        if (parsed.reviewResult) setReviewResult(parsed.reviewResult);
        if (parsed.reviewHistory) setReviewHistory(parsed.reviewHistory);
        return;
      }
    } catch (err) {
      console.error('[MarkdownEditor] Restore error:', err);
    }

    // No saved data, use initialContent
    console.log('[MarkdownEditor] No saved data, using initialContent');
    setContent(initialContent);
  }, [initialContent, sessionId]);

  // Save session to storage whenever content or review changes
  useEffect(() => {
    if (!sessionId) return;
    // Don't save empty content (it overwrites valid saved data)
    if (!content && !reviewResult) {
      console.log('[MarkdownEditor] Skipping save: no content and no review');
      return;
    }
    console.log('[MarkdownEditor] Saving to storage:', {
      contentLength: content.length,
      hasReviewResult: !!reviewResult,
      hasReviewHistory: reviewHistory.length > 0,
      sessionId
    });
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        content,
        reviewResult,
        reviewHistory,
      }));
    } catch (err) {
      console.error('[MarkdownEditor] Save error:', err);
    }
  }, [content, reviewResult, reviewHistory, sessionId]);
  // Auto-dismiss save toast
  useEffect(() => {
    if (!saveToast) return;
    const t = setTimeout(() => setSaveToast(null), 2000);
    return () => clearTimeout(t);
  }, [saveToast]);

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

  // Notify parent when review panel becomes active/collapsed
  useEffect(() => {
    onReviewActive?.(!!displayedResult && !reviewCollapsed);
  }, [displayedResult, reviewCollapsed, onReviewActive]);

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
      setReviewCollapsed(false);
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

  // ── Save ──

  async function handleSave() {
    const errs: string[] = [];
    if (!saveTitle.trim()) errs.push('请填写标题');
    if (!saveVersion.trim()) errs.push('请填写版本号');
    if (!selectedFolderId) errs.push('请选择文件夹');
    if (errs.length > 0) {
      setSaveToast(errs.join('；'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, workflowId,
          title: saveTitle.trim(),
          version: saveVersion.trim(),
          content,
          folderId: selectedFolderId,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: '保存失败' }));
        setSaveToast(errData.error || '保存失败');
        setSaving(false);
        return;
      }
      const data = await res.json();
      if (data.outputId) setSavedOutputId(data.outputId);
      setSaved(true);
      setVersionCount(prev => prev + 1);
      const parts = saveVersion.match(/^V(\d+)\.(\d+)\.(\d+)$/i);
      if (parts) setSaveVersion(`V${parts[1]}.${parts[2]}.${parseInt(parts[3], 10) + 1}`);
      setShowSaveDialog(false);
      setSaveToast('保存成功');
      onTitleGenerated?.(saveTitle.trim());
    } catch {
      setSaveToast('保存失败，请重试');
    } finally { setSaving(false); }
  }

  async function openSaveDialog() {
    // Load folders
    try {
      const res = await fetch('/api/folders');
      if (res.ok) setFolders(await res.json());
    } catch { }
    setShowSaveDialog(true);
    if (!saveTitle) {
      const defaultTitle = `${workflowId || '文档'}_报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`;
      setSaveTitle(defaultTitle);
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), description: newFolderDesc.trim() }),
      });
      if (res.ok) {
        const folder = await res.json();
        setFolders(prev => [folder, ...prev]);
        setSelectedFolderId(folder.folderId);
        setShowNewFolderForm(false);
        setNewFolderName('');
        setNewFolderDesc('');
      }
    } catch { } finally { setCreatingFolder(false); }
  }

  return (
    <div style={{ flex: 1, display:'flex', flexDirection:'column', background:'white', borderLeft:'1px solid var(--border)', position:'relative', minWidth:340 }}>
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
        {/* Show review button when collapsed but available */}
        {reviewResult && reviewCollapsed && (
          <button onClick={() => setReviewCollapsed(false)}
            className="btn-ghost" style={{ padding:'4px 12px', fontSize:'0.72rem', color:'var(--green-text)', borderColor:'var(--green-border)', background:'var(--green-bg)' }}>
            展开审查
          </button>
        )}

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
      <div style={{ flex:1, display:'flex', flexDirection: (displayedResult && !reviewCollapsed) ? 'row' : 'column', overflow:'hidden' }}>
        <div style={{ flex: (displayedResult && !reviewCollapsed) ? 1 : 1, minWidth: (displayedResult && !reviewCollapsed) ? 300 : 0, overflow:'auto', borderRight: (displayedResult && !reviewCollapsed) ? 'none' : 'none', borderBottom: (displayedResult && !reviewCollapsed) ? 'none' : (displayedResult ? '1px solid var(--border)' : 'none') }}>
          {viewMode === 'edit' ? (
            <textarea value={content} onChange={e => handleContentChange(e.target.value)}
              placeholder="在此编辑 Markdown 内容…"
              style={{ width:'100%', height:'100%', padding:'16px 18px', border:'none', outline:'none', resize:'none', fontFamily:'"JetBrains Mono",ui-monospace,monospace', fontSize:'0.78rem', lineHeight:1.7, background:'var(--sidebar-bg)', color:'var(--ink)' }} />
          ) : (
            <div style={{ padding:'16px 18px' }}><Markdown content={content} /></div>
          )}
        </div>

        {/* Drag handle: editor content ↔ review */}
        {displayedResult && !reviewCollapsed && (
          <ResizeHandle
            onDrag={(dx) => {
              setReviewPaneWidth(prev => {
                const next = Math.max(240, Math.min(600, prev - dx));
                return next;
              });
            }}
            onDragEnd={() => {
              try { localStorage.setItem('pm-review-pane', String(reviewPaneRef.current)); } catch {}
            }}
          />
        )}

        {/* Review result panel — right side when active, hidden when collapsed */}
        {displayedResult && !reviewCollapsed && (
          <div style={{ width: reviewPaneWidth, minWidth: reviewPaneWidth, maxWidth: reviewPaneWidth, flexShrink: 0, overflowY:'auto', display:'flex', flexDirection:'column' }}>
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
                <button onClick={() => { setReviewCollapsed(true); setViewMode('edit'); handleRevise(); }} className="btn-primary" style={{ padding:'5px 14px', fontSize:'0.7rem' }}>
                  依此修改
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
                        <textarea value={s} onChange={e => updateReviewStrength(i, e.target.value)}
                          style={{ flex:1, padding:'4px 8px', border:'1px solid var(--green-border)', borderRadius:2, fontSize:'0.72rem', fontFamily:'inherit', background:'white', resize:'vertical', minHeight:28, lineHeight:1.4 }} />
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
                        <textarea value={s} onChange={e => updateReviewWeakness(i, e.target.value)}
                          style={{ flex:1, padding:'4px 8px', border:'1px solid var(--red-border)', borderRadius:2, fontSize:'0.72rem', fontFamily:'inherit', background:'white', resize:'vertical', minHeight:28, lineHeight:1.4 }} />
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
                        <textarea value={s} onChange={e => updateReviewSuggestion(i, e.target.value)}
                          style={{ flex:1, padding:'4px 8px', border:'1px solid var(--accent-border)', borderRadius:2, fontSize:'0.72rem', fontFamily:'inherit', background:'white', resize:'vertical', minHeight:28, lineHeight:1.4 }} />
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

      {/* Bottom bar */}
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0, fontSize:'0.68rem', color:'var(--ink-faint)', fontFamily:'"JetBrains Mono",monospace' }}>
        <span>{saved?'已保存':'已编辑'} · {lastEditTime ? lastEditTime.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) : '--'}</span>
        <span>V{versionCount}</span>
        {savedOutputId && <span style={{ color:'var(--accent)' }}>已关联产出</span>}
        <div style={{ flex:1 }} />
        <button onClick={openSaveDialog} className="btn-primary" style={{ padding:'5px 16px', fontSize:'0.72rem' }}>
          {saved ? '已保存' : '保存'}
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.25)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="modal-content resp-save-dialog" style={{ background:'white', borderRadius:5, padding:'24px 28px', minWidth:380, maxWidth:440, border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ fontWeight:600, fontSize:'0.92rem', marginBottom:16 }}>保存工作产出</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:'0.76rem', fontWeight:500, marginBottom:4, color:'var(--ink-muted)' }}>标题 <span style={{ color:'var(--red-text)' }}>*</span></label>
              <input className="input" value={saveTitle} onChange={e=>setSaveTitle(e.target.value)}
                placeholder="6-15字标题" maxLength={32} />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:'0.76rem', fontWeight:500, marginBottom:4, color:'var(--ink-muted)' }}>版本号 <span style={{ color:'var(--red-text)' }}>*</span></label>
              <input className="input" value={saveVersion} onChange={e=>setSaveVersion(e.target.value)} placeholder="V1.0.0" />
            </div>

            {/* Folder selection — required */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:'0.76rem', fontWeight:500, marginBottom:6, color:'var(--ink-muted)' }}>
                保存到文件夹 <span style={{ color:'var(--red-text)' }}>*</span>
              </label>
              {folders.length > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:140, overflowY:'auto', marginBottom:8 }}>
                  {folders.map(f => (
                    <label key={f.folderId} style={{
                      display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:3, cursor:'pointer',
                      background: selectedFolderId === f.folderId ? 'var(--accent-bg)' : 'transparent',
                      border: selectedFolderId === f.folderId ? '1px solid var(--accent-border)' : '1px solid transparent',
                      fontSize:'0.76rem',
                    }}>
                      <input type="radio" name="folder" checked={selectedFolderId === f.folderId}
                        onChange={() => setSelectedFolderId(f.folderId)} style={{ accentColor:'var(--accent)' }} />
                      <span style={{ flex:1, fontWeight:500 }}>{f.name}</span>
                      <span style={{ fontSize:'0.64rem', color:'var(--ink-faint)' }}>{f.outputCount} 项</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:'0.72rem', color:'var(--ink-faint)', marginBottom:8, padding:'6px 0' }}>
                  暂无文件夹，请先创建一个
                </div>
              )}

              {/* New folder form */}
              {showNewFolderForm ? (
                <div style={{ border:'1px solid var(--accent-border)', borderRadius:4, padding:'10px 12px', background:'var(--accent-bg)' }}>
                  <input className="input" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                    placeholder="文件夹名称" maxLength={20}
                    style={{ marginBottom:6, fontSize:'0.76rem' }} />
                  <input className="input" value={newFolderDesc} onChange={e => setNewFolderDesc(e.target.value)}
                    placeholder="简介（可选）" maxLength={50}
                    style={{ marginBottom:8, fontSize:'0.76rem' }} />
                  <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                    <button onClick={() => { setShowNewFolderForm(false); setNewFolderName(''); setNewFolderDesc(''); }}
                      className="btn-ghost" style={{ fontSize:'0.68rem' }}>取消</button>
                    <button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}
                      className="btn-primary" style={{ fontSize:'0.68rem', padding:'4px 12px' }}>
                      {creatingFolder ? '创建中…' : '创建文件夹'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowNewFolderForm(true)}
                  className="btn-ghost" style={{ fontSize:'0.68rem', color:'var(--accent)', padding:'2px 6px' }}>
                  + 新建文件夹
                </button>
              )}
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={() => setShowSaveDialog(false)} className="btn-ghost">取消</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize:'0.82rem' }}>
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save toast */}
      {saveToast && (
        <div className="resp-toast" style={{
          position:'fixed', bottom:32, left:'50%', transform:'translateX(-50%)', zIndex:300,
          background: saveToast === '保存成功' ? 'var(--green-text)' : 'var(--red-text)',
          color:'white', padding:'10px 24px', borderRadius:4, fontSize:'0.82rem', fontWeight:500,
          boxShadow:'0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {saveToast}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
