'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from './Markdown';

interface ReviewResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  completeness: number;
}

interface MiniMessage { role: 'user' | 'assistant'; content: string; }

interface Props {
  initialContent: string;
  workflowId: string;
  sessionId: string;
  onClose: () => void;
  onTitleGenerated?: (title: string) => void;
  onReviseRequest?: (message: string) => void;
}

export default function MarkdownEditor({ initialContent, workflowId, sessionId, onClose, onTitleGenerated, onReviseRequest }: Props) {
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
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
  const [autoGeneratingTitle, setAutoGeneratingTitle] = useState(false);

  // Mini chat for "依据审核结果修改"
  const [miniChatOpen, setMiniChatOpen] = useState(false);
  const [miniMessages, setMiniMessages] = useState<MiniMessage[]>([]);
  const [miniInput, setMiniInput] = useState('');
  const [miniSending, setMiniSending] = useState(false);
  const miniBottomRef = useRef<HTMLDivElement>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update content when initialContent changes (new import)
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => { miniBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [miniMessages]);

  // Auto-save (debounced 2s) — local version tracking
  const autoSave = useCallback((text: string) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      setLastEditTime(new Date());
    }, 2000);
  }, []);

  function handleContentChange(val: string) {
    setContent(val);
    setSaved(false);
    autoSave(val);
  }

  // ── AI Review ──
  async function handleReview() {
    if (!content.trim()) return;
    setReviewing(true);
    setReviewError(null);
    setReviewResult(null);
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, workflowId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: '请求失败' }))).error);
      const data = await res.json();
      setReviewResult(data);
    } catch (err: any) {
      setReviewError(err.message);
    } finally {
      setReviewing(false);
    }
  }

  // ── "依据审核结果修改" → 发送到右侧主对话 ──
  function handleRevise() {
    if (!reviewResult || !onReviseRequest) return;
    const reviewText = [
      `**审查总结**：${reviewResult.summary}`,
      `**优点**：${reviewResult.strengths.join('；')}`,
      `**缺点**：${reviewResult.weaknesses.join('；')}`,
      `**改进建议**：${reviewResult.suggestions.join('；')}`,
      `**完整度评分**：${reviewResult.completeness}/100`,
    ].join('\n');
    const reviseMessage = `请根据以下审查结果修改文档内容，输出修改后的完整版本：\n\n${reviewText}\n\n原始文档：\n${content.substring(0, 4000)}`;
    onReviseRequest(reviseMessage);
  }

  async function sendMiniMessage(msgs?: MiniMessage[]) {
    if (miniSending) return;
    const toSend = msgs || [{ role: 'user' as const, content: miniInput.trim() }];
    if (!msgs && !miniInput.trim()) return;

    setMiniSending(true);
    if (!msgs) {
      setMiniMessages(prev => [...prev, { role: 'user', content: miniInput.trim() }]);
      setMiniInput('');
    }

    setMiniMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    const aiIdx = msgs ? 1 : miniMessages.length + 1;

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, message: (toSend[0] as MiniMessage).content }),
      });
      if (!res.ok) throw new Error('请求失败');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

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
            if (chunk.error) break;
            if (chunk.done) break;
            setMiniMessages(prev => {
              const updated = [...prev];
              if (aiIdx < updated.length) {
                updated[aiIdx] = { ...updated[aiIdx], content: updated[aiIdx].content + (chunk.delta || '') };
              }
              return updated;
            });
          } catch { /* skip */ }
        }
      }
    } catch {
      setMiniMessages(prev => prev.filter((_, i) => i !== aiIdx));
    } finally {
      setMiniSending(false);
    }
  }

  function importRevision(content: string) {
    setContent(content);
    setMiniChatOpen(false);
    setMiniMessages([]);
  }

  // ── Save ──
  async function handleSave() {
    if (!saveTitle.trim() || !saveVersion.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputId: outputId || undefined,
          sessionId,
          workflowId,
          title: saveTitle.trim(),
          version: saveVersion.trim(),
          content,
        }),
      });
      if (!res.ok) throw new Error('保存失败');
      const data = await res.json();
      if (data.outputId && !outputId) setOutputId(data.outputId);
      setSaved(true);
      setVersionCount(prev => prev + 1);
      // Auto-increment version for next save
      const parts = saveVersion.match(/^V(\d+)\.(\d+)\.(\d+)$/i);
      if (parts) {
        const nextPatch = parseInt(parts[3], 10) + 1;
        setSaveVersion(`V${parts[1]}.${parts[2]}.${nextPatch}`);
      }
      setShowSaveDialog(false);
      onTitleGenerated?.(saveTitle.trim());
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function openSaveDialog() {
    setShowSaveDialog(true);
    // Auto-generate title if we don't have one yet
    if (!outputId && content.trim()) {
      setAutoGeneratingTitle(true);
      try {
        const res = await fetch('/api/outputs/generate-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content.substring(0, 2000) }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.title) setSaveTitle(data.title);
        }
      } catch { /* ignore */ }
      setAutoGeneratingTitle(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'white', borderLeft: '1px solid var(--border)' }}>
      {/* Toolbar */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={onClose} title="收起编辑器"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--ink-muted)', padding: '2px 6px' }}>
          ←
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={handleReview} disabled={reviewing || !content.trim()}
          title="AI 审查"
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem', cursor: reviewing ? 'not-allowed' : 'pointer', color: 'var(--ink-muted)', opacity: reviewing ? 0.5 : 1 }}>
          {reviewing ? '审查中…' : '🔍 AI审查'}
        </button>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <button onClick={() => setViewMode('edit')}
            style={{ padding: '4px 10px', fontSize: '0.75rem', border: 'none', cursor: 'pointer',
              background: viewMode === 'edit' ? 'var(--accent)' : 'white',
              color: viewMode === 'edit' ? 'white' : 'var(--ink-muted)', }}>
            编辑
          </button>
          <button onClick={() => setViewMode('preview')}
            style={{ padding: '4px 10px', fontSize: '0.75rem', border: 'none', cursor: 'pointer',
              background: viewMode === 'preview' ? 'var(--accent)' : 'white',
              color: viewMode === 'preview' ? 'white' : 'var(--ink-muted)', }}>
            预览
          </button>
        </div>
      </div>

      {/* Editor / Preview area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {viewMode === 'edit' ? (
          <textarea
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            placeholder="在此编辑 Markdown 内容…"
            style={{
              width: '100%', height: '100%', padding: '14px', border: 'none', outline: 'none',
              resize: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.82rem', lineHeight: 1.65, background: 'var(--paper)',
            }}
          />
        ) : (
          <div style={{ padding: '14px' }}>
            <Markdown content={content} />
          </div>
        )}
      </div>

      {/* Review result */}
      {reviewResult && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', maxHeight: 220, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            审查结果 · 完整度 {reviewResult.completeness}%
            <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, maxWidth: 100 }}>
              <div style={{ height: '100%', width: `${reviewResult.completeness}%`, background: reviewResult.completeness >= 70 ? 'var(--green-text)' : 'var(--accent)', borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: 4 }}>{reviewResult.summary}</div>
          {reviewResult.strengths.length > 0 && (
            <div style={{ fontSize: '0.73rem', marginBottom: 3 }}>
              <span style={{ color: 'var(--green-text)', fontWeight: 600 }}>✓ {reviewResult.strengths.join('；')}</span>
            </div>
          )}
          {reviewResult.weaknesses.length > 0 && (
            <div style={{ fontSize: '0.73rem', marginBottom: 3 }}>
              <span style={{ color: 'var(--red-text)', fontWeight: 600 }}>✗ {reviewResult.weaknesses.join('；')}</span>
            </div>
          )}
          {reviewResult.suggestions.length > 0 && (
            <div style={{ fontSize: '0.73rem', color: 'var(--ink-muted)' }}>
              <span style={{ fontWeight: 600 }}>建议：</span>{reviewResult.suggestions.join('；')}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <button onClick={handleRevise}
              style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: '0.73rem', cursor: 'pointer' }}>
              依据审核结果修改
            </button>
          </div>
        </div>
      )}

      {reviewError && (
        <div style={{ borderTop: '1px solid var(--red-border)', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--red-text)', flexShrink: 0 }}>
          {reviewError} <button onClick={() => setReviewError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: 'var(--red-text)' }}>关闭</button>
        </div>
      )}

      {/* Mini chat for revision */}
      {miniChatOpen && (
        <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: 280 }}>
          <div style={{ padding: '6px 12px', fontSize: '0.73rem', fontWeight: 600, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            AI 修改建议对话
            <button onClick={() => setMiniChatOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--ink-faint)' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {miniMessages.map((m, i) => (
              <div key={i} style={{ fontSize: '0.75rem', lineHeight: 1.5, padding: '6px 10px', borderRadius: 8, background: m.role === 'user' ? 'var(--paper-warm)' : 'var(--paper)', maxWidth: '90%', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.content || (miniSending ? <span className="cursor-blink">▊</span> : '…')}
                {m.role === 'assistant' && m.content && (
                  <div style={{ marginTop: 4 }}>
                    <button onClick={() => importRevision(m.content)}
                      style={{ background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 4, padding: '2px 8px', fontSize: '0.68rem', cursor: 'pointer' }}>
                      导入此版本
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div ref={miniBottomRef} />
          </div>
          <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
            <input
              value={miniInput}
              onChange={e => setMiniInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMiniMessage(); } }}
              placeholder="输入补充说明…" disabled={miniSending}
              style={{ flex: 1, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.78rem', outline: 'none' }}
            />
            <button onClick={() => sendMiniMessage()} disabled={miniSending || !miniInput.trim()}
              style={{ padding: '5px 12px', background: miniSending ? '#e0ddda' : 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.78rem', cursor: miniSending ? 'not-allowed' : 'pointer' }}>
              发送
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, fontSize: '0.72rem', color: 'var(--ink-faint)' }}>
        <span>
          {saved ? '已保存' : '已编辑'} · {lastEditTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span>版本 V{versionCount}</span>
        <div style={{ flex: 1 }} />
        <button onClick={openSaveDialog}
          style={{ background: saved ? 'var(--green-bg)' : 'var(--accent)', color: saved ? 'var(--green-text)' : 'white', border: 'none', borderRadius: 6, padding: '4px 14px', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
          {saved ? '✓ 已保存' : '保存'}
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSaveDialog(false); }}>
          <div className="modal-content" style={{ background: 'white', borderRadius: 12, padding: '24px 28px', minWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 18 }}>保存工作产出</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: 4, color: 'var(--ink-muted)' }}>标题</label>
              <input value={saveTitle} onChange={e => setSaveTitle(e.target.value)}
                placeholder={autoGeneratingTitle ? 'AI 正在生成标题…' : '6-15字标题'}
                maxLength={32}
                disabled={autoGeneratingTitle}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: 4, color: 'var(--ink-muted)' }}>版本号</label>
              <input value={saveVersion} onChange={e => setSaveVersion(e.target.value)}
                placeholder="V1.0.0"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowSaveDialog(false)}
                style={{ padding: '7px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--ink-muted)' }}>
                取消
              </button>
              <button onClick={handleSave} disabled={saving || !saveTitle.trim()}
                style={{ padding: '7px 22px', background: saving ? '#e0ddda' : 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
