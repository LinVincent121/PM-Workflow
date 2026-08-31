'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface FolderItem {
  folderId: string; name: string; description: string;
  createdAt: string; updatedAt: string; outputCount: number;
}

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

export default function OutputsPage() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  function loadFolders() {
    setLoading(true);
    fetch('/api/folders')
      .then(r => r.json())
      .then(data => setFolders(Array.isArray(data) ? data : []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadFolders(); }, []);

  async function handleCreateFolder() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      if (res.ok) {
        const folder = await res.json();
        setFolders(prev => [{ ...folder, outputCount: folder.outputCount ?? 0 }, ...prev]);
        setShowCreate(false);
        setNewName('');
        setNewDesc('');
      }
    } catch { } finally { setCreating(false); }
  }

  function startEdit(f: FolderItem) {
    setEditingId(f.folderId);
    setEditName(f.name);
    setEditDesc(f.description);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
  }

  async function handleSaveEdit(folderId: string) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/folders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, name: editName.trim(), description: editDesc.trim() }),
      });
      setFolders(prev => prev.map(f => f.folderId === folderId ? { ...f, name: editName.trim(), description: editDesc.trim() } : f));
      cancelEdit();
    } catch { } finally { setSaving(false); }
  }

  function handleDeleteFolder(folderId: string, name: string, outputCount: number) {
    const warning = outputCount > 0
      ? `⚠️ 警告：文件夹「${name}」中有 ${outputCount} 项工作产出，删除后这些产出物也将被永久删除且无法恢复！`
      : `确定删除文件夹「${name}」？`;
    if (!confirm(warning)) return;
    try {
      fetch('/api/folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      }).then(() => {
        setFolders(prev => prev.filter(f => f.folderId !== folderId));
      }).catch(() => { });
    } catch { }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '40px 48px' }} className="resp-main">
        <header style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="resp-header">
          <div>
            <h1 className="display" style={{ fontSize: 'clamp(1.4rem, 2vw, 1.7rem)', marginBottom: 6 }}>工作产出</h1>
            <p className="body-text">按文件夹管理保存的工作产出物。</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
            新建文件夹
          </button>
        </header>

        {loading && <div style={{ fontSize: '0.82rem', color: 'var(--ink-faint)' }}>加载中…</div>}

        {!loading && folders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--ink-faint)' }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.1rem', fontWeight: 500, marginBottom: 8, color: 'var(--ink-muted)' }}>
              暂无文件夹
            </div>
            <p style={{ fontSize: '0.82rem', maxWidth: 340, margin: '0 auto 14px', lineHeight: 1.6 }}>
              创建文件夹来组织你的工作产出。保存时也可以选择已有文件夹。
            </p>
            <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.82rem' }}>
              创建第一个文件夹
            </button>
          </div>
        )}

        {!loading && folders.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }} className="resp-grid-folders">
            {folders.map(f => (
              <div key={f.folderId} className="card" style={{
                padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10,
                transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
              }}>
                {editingId === f.folderId ? (
                  // Edit mode
                  <>
                    <input className="input" value={editName} onChange={e => setEditName(e.target.value)}
                      placeholder="文件夹名称" maxLength={20}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(f.folderId); if (e.key === 'Escape') cancelEdit(); }}
                      autoFocus style={{ fontSize: '0.88rem', fontWeight: 600, padding: '6px 10px' }} />
                    <input className="input" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                      placeholder="简介（可选）" maxLength={50}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(f.folderId); if (e.key === 'Escape') cancelEdit(); }}
                      style={{ fontSize: '0.78rem', padding: '6px 10px' }} />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={cancelEdit} className="btn-ghost" style={{ fontSize: '0.68rem' }}>取消</button>
                      <button onClick={() => handleSaveEdit(f.folderId)} disabled={saving || !editName.trim()}
                        className="btn-primary" style={{ fontSize: '0.68rem', padding: '4px 12px' }}>
                        {saving ? '保存中…' : '保存'}
                      </button>
                    </div>
                  </>
                ) : (
                  // View mode
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Link href={`/outputs/${f.folderId}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round">
                            <path d="M2 4.5V12a1.5 1.5 0 001.5 1.5h9A1.5 1.5 0 0014 12V5.5A1.5 1.5 0 0012.5 4H8L6.5 2H3.5A1.5 1.5 0 002 3.5v1z" />
                          </svg>
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '-0.01em' }}>{f.name}</span>
                        </div>
                      </Link>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={e => { e.preventDefault(); startEdit(f); }}
                          className="btn-ghost" style={{ padding: '2px 6px', fontSize: '0.62rem' }}
                          title="编辑文件夹">
                          编辑
                        </button>
                        <button onClick={e => { e.preventDefault(); handleDeleteFolder(f.folderId, f.name, f.outputCount); }}
                          className="btn-ghost" style={{ padding: '2px 6px', fontSize: '0.62rem', color: 'var(--red-text)' }}
                          title="删除文件夹">
                          删除
                        </button>
                      </div>
                    </div>
                    {f.description && (
                      <Link href={`/outputs/${f.folderId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                          {f.description}
                        </div>
                      </Link>
                    )}
                    <Link href={`/outputs/${f.folderId}`} style={{ textDecoration: 'none', color: 'inherit', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent)', fontFamily: '"JetBrains Mono", monospace' }}>
                          {f.outputCount ?? 0} 项产出
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--ink-faint)' }}>{timeAgo(f.updatedAt)}</span>
                      </div>
                    </Link>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create folder modal */}
        {showCreate && (
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.25)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setNewName(''); setNewDesc(''); } }}>
            <div className="modal-content resp-modal" style={{ background: 'white', borderRadius: 5, padding: '24px 28px', minWidth: 360, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 16 }}>新建文件夹</div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, marginBottom: 4, color: 'var(--ink-muted)' }}>名称</label>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="输入文件夹名称" maxLength={20}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 500, marginBottom: 4, color: 'var(--ink-muted)' }}>简介</label>
                <input className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="简要描述（可选）" maxLength={50}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }} className="btn-ghost">取消</button>
                <button onClick={handleCreateFolder} disabled={creating || !newName.trim()} className="btn-primary" style={{ fontSize: '0.82rem' }}>
                  {creating ? '创建中…' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}