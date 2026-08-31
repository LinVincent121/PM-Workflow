'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Markdown from '@/components/Markdown';

interface OutputItem {
  outputId: string; sessionId: string; workflowId: string;
  title: string; version: string; content: string;
  folderId: string | null;
  createdAt: string; updatedAt: string;
}

interface FolderInfo {
  folderId: string; name: string; description: string;
  createdAt: string; updatedAt: string;
}

const WF_LABELS: Record<string, string> = {
  'idea-refinement': '想法完善', 'competitive-intel': '竞品分析', 'business-strategy': '商业战略',
  'prd-delivery': 'PRD 交付', 'prioritization': '需求排布', 'launch-pipeline': '发布流程',
  'incident-response': '事故响应', 'build-vs-buy': '自建外购', 'activation-loop': '激活优化',
  'agent-orchestrator': 'Agent 编排',
};

function timeAgo(ts: string): string {
  if (!ts) return '--';
  const d = new Date(ts); if (isNaN(d.getTime())) return '--';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚'; if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function FolderDetailPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOutput, setPreviewOutput] = useState<OutputItem | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<'preview' | 'edit'>('preview');
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function loadOutputs() {
    if (!folderId) return;
    setLoading(true);
    Promise.all([
      fetch('/api/folders').then(r => r.json()),
      fetch(`/api/outputs?folderId=${encodeURIComponent(folderId)}`).then(r => r.json()),
    ]).then(([foldersData, outputsData]) => {
      const folders = Array.isArray(foldersData) ? foldersData : [];
      const found = folders.find((f: any) => f.folderId === folderId);
      if (found) {
        setFolder({ folderId: found.folderId, name: found.name, description: found.description, createdAt: found.createdAt, updatedAt: found.updatedAt });
      } else {
        setFolder({ folderId, name: '文件夹', description: '', createdAt: '', updatedAt: '' });
      }
      setOutputs(Array.isArray(outputsData) ? outputsData : []);
    }).catch(() => { }).finally(() => setLoading(false));
  }

  useEffect(() => { loadOutputs(); }, [folderId]);

  async function handleDeleteOutput(outputId: string) {
    if (!confirm('确定删除此产出？')) return;
    try {
      await fetch('/api/outputs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId }),
      });
      setOutputs(prev => prev.filter(o => o.outputId !== outputId));
    } catch { }
  }

  // ── Open modal — always start in preview mode ──
  function openPreview(o: OutputItem) {
    setPreviewOutput(o);
    setEditContent(o.content);
    setModalMode('preview');
    setEditSaved(false);
  }

  function closePreview() {
    // Flush any pending auto-save before closing
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
      doSaveEdit();
    }
    setPreviewOutput(null);
  }

  // ── Auto-save on content change (debounced 1.5s) ──
  const autoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      doSaveEdit();
    }, 1500);
  }, [editContent]);

  async function doSaveEdit() {
    if (!previewOutput || !editContent.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputId: previewOutput.outputId,
          sessionId: previewOutput.sessionId,
          workflowId: previewOutput.workflowId,
          title: previewOutput.title,
          version: previewOutput.version,
          content: editContent,
        }),
      });
      if (res.ok) {
        setEditSaved(true);
        // Update the local output data
        setOutputs(prev => prev.map(o =>
          o.outputId === previewOutput.outputId ? { ...o, content: editContent } : o
        ));
        setPreviewOutput(prev => prev ? { ...prev, content: editContent } : null);
      }
    } catch { } finally {
      setEditSaving(false);
    }
  }

  function handleContentChange(val: string) {
    setEditContent(val);
    setEditSaved(false);
    autoSave();
  }

  // ── Download as .md ──
  function handleDownload() {
    if (!previewOutput) return;
    const blob = new Blob([previewOutput.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${previewOutput.title.replace(/[\\/:*?"<>|]/g, '_')}_${previewOutput.version}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '40px 48px' }} className="resp-main">
        {/* Breadcrumb */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
          <Link href="/outputs" style={{ color: 'var(--ink-faint)', textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 3L4 8l6 5" /></svg>
              工作产出
            </span>
          </Link>
          <span style={{ color: 'var(--ink-ghost)' }}>/</span>
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{folder?.name || '加载中…'}</span>
        </div>

        {loading && <div style={{ fontSize: '0.82rem', color: 'var(--ink-faint)' }}>加载中…</div>}

        {!loading && (
          <>
            <header style={{ marginBottom: 24 }}>
              <h1 className="display" style={{ fontSize: 'clamp(1.3rem, 2vw, 1.6rem)', marginBottom: 4 }}>{folder?.name}</h1>
              {folder?.description && (
                <p className="body-text" style={{ marginBottom: 4 }}>{folder.description}</p>
              )}
              <span style={{ fontSize: '0.74rem', color: 'var(--ink-faint)' }}>
                {outputs.length} 项产出
              </span>
            </header>

            {outputs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--ink-faint)' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 500, marginBottom: 8, color: 'var(--ink-muted)' }}>
                  此文件夹暂无产出
                </div>
                <p style={{ fontSize: '0.82rem', maxWidth: 320, margin: '0 auto 14px', lineHeight: 1.6 }}>
                  在编辑器保存时选择此文件夹，即可将产出保存到这里。
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12 }} className="resp-grid-outputs">
                {outputs.map(o => (
                  <div key={o.outputId} className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}
                    onClick={() => openPreview(o)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.92rem', fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer' }}>{o.title}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); handleDeleteOutput(o.outputId); }}
                          className="btn-ghost" style={{ padding: '2px 6px', fontSize: '0.62rem' }}>删除</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="badge">{o.version}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                        {WF_LABELS[o.workflowId] || o.workflowId}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.content.substring(0, 130)}…
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: 'var(--ink-faint)', marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
                      <span>{timeAgo(o.updatedAt)}</span>
                      <Link href={`/workflow/${o.workflowId}?sid=${o.sessionId}`}
                        onClick={e => e.stopPropagation()}
                        style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500, fontSize: '0.72rem' }}>
                        查看来源 →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Preview / Edit modal */}
        {previewOutput && (
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={closePreview}>
            <div className="modal-content resp-modal" style={{ background: 'white', borderRadius: 5, maxWidth: 800, width: '95%', height: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px 0', flexShrink: 0 }} className="resp-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="badge">{previewOutput.version}</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: '0.95rem' }}>{previewOutput.title}</span>
                  {editSaving && <span style={{ fontSize: '0.66rem', color: 'var(--ink-faint)' }}>保存中…</span>}
                  {editSaved && !editSaving && <span style={{ fontSize: '0.66rem', color: 'var(--green-text)' }}>已保存</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="modal-actions">
                  {/* Download button */}
                  <button onClick={handleDownload} className="btn-ghost"
                    style={{ padding: '4px 12px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M8 2v9M5 8l3 3 3-3"/></svg>
                    下载 .md
                  </button>
                  {/* Edit / Preview toggle */}
                  <div style={{ display: 'flex', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button onClick={() => setModalMode('preview')}
                      style={{ padding: '4px 12px', fontSize: '0.7rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: modalMode === 'preview' ? 'var(--accent)' : 'white', color: modalMode === 'preview' ? 'white' : 'var(--ink-muted)', fontWeight: 500 }}>
                      预览
                    </button>
                    <button onClick={() => setModalMode('edit')}
                      style={{ padding: '4px 12px', fontSize: '0.7rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: modalMode === 'edit' ? 'var(--accent)' : 'white', color: modalMode === 'edit' ? 'white' : 'var(--ink-muted)', fontWeight: 500 }}>
                      编辑
                    </button>
                  </div>
                  <button onClick={closePreview} className="btn-ghost" style={{ fontSize: '0.74rem' }}>关闭</button>
                </div>
              </div>
              <div className="caption resp-modal-caption" style={{ padding: '8px 32px 12px', flexShrink: 0 }}>
                保存于 {new Date(previewOutput.createdAt).toLocaleString('zh-CN')}
                {previewOutput.workflowId && (
                  <span style={{ marginLeft: 8 }}>· {WF_LABELS[previewOutput.workflowId] || previewOutput.workflowId}</span>
                )}
              </div>

              {/* Body */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 3, margin: '0 32px 24px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="resp-modal-body">
                {modalMode === 'preview' ? (
                  <div style={{ padding: '14px 18px', background: 'var(--sidebar-bg)', flex: 1, overflow: 'auto' }}>
                    <Markdown content={previewOutput.content} />
                  </div>
                ) : (
                  <textarea value={editContent} onChange={e => handleContentChange(e.target.value)}
                    placeholder="编辑 Markdown 内容…"
                    style={{ width: '100%', height: '100%', padding: '14px 18px', border: 'none', outline: 'none', resize: 'none',
                      fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: '0.78rem', lineHeight: 1.7,
                      background: 'var(--sidebar-bg)', color: 'var(--ink)', flex: 1 }} />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}