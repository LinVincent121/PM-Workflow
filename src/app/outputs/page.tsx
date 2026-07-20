'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface OutputItem {
  outputId: string;
  sessionId: string;
  workflowId: string;
  title: string;
  version: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const WF_NAMES: Record<string, string> = {
  'idea-refinement': '💡 产品想法完善',
  'competitive-intel': '🔍 竞品分析报告',
  'business-strategy': '📊 商业分析与战略',
  'prd-delivery': '📝 PRD 与交付',
  'prioritization': '🎯 需求排布',
  'agent-orchestrator': '🤖 Agent 工作编排',
  'launch-pipeline': '🚀 产品发布全流程',
  'incident-response': '🔥 产品事故响应与恢复',
  'build-vs-buy': '🏗️ Build vs Buy 决策',
  'activation-loop': '👤 新用户激活优化',
};

function timeAgo(ts: string): string {
  if (!ts) return '--';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '--';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function OutputsPage() {
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  useEffect(() => {
    fetch('/api/outputs')
      .then(r => r.json())
      .then(data => setOutputs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(outputId: string) {
    if (!confirm('确定删除此产出？')) return;
    fetch('/api/outputs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outputId }),
    })
      .then(() => setOutputs(prev => prev.filter(o => o.outputId !== outputId)))
      .catch(() => {});
  }

  function startRename(o: OutputItem) {
    setRenamingId(o.outputId);
    setRenameText(o.title);
  }

  function commitRename(outputId: string) {
    if (!renameText.trim()) { setRenamingId(null); return; }
    fetch('/api/outputs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outputId, title: renameText.trim() }),
    })
      .then(() => {
        setOutputs(prev => prev.map(o => o.outputId === outputId ? { ...o, title: renameText.trim() } : o));
      })
      .catch(() => {});
    setRenamingId(null);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>📤 工作产出</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginTop: 4 }}>
            完成工作流后保存的产出内容
          </p>
        </header>

        {loading && (
          <div style={{ fontSize: '0.85rem', color: 'var(--ink-faint)' }}>加载中…</div>
        )}

        {!loading && outputs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-faint)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500, marginBottom: 6 }}>暂无工作产出</div>
            <div style={{ fontSize: '0.82rem' }}>
              完成工作流对话后，在 AI 回复中点击「导入编辑」并保存，即可在此查看。
            </div>
            <Link href="/" style={{ display: 'inline-block', marginTop: 16, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500, fontSize: '0.85rem' }}>
              ← 开始新任务
            </Link>
          </div>
        )}

        {!loading && outputs.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {outputs.map(o => (
              <div key={o.outputId} className="card-hover"
                style={{
                  background: 'white', borderRadius: 10, border: '1px solid var(--border)',
                  padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8,
                  transition: 'all 0.15s ease',
                }}>
                {/* Title */}
                {renamingId === o.outputId ? (
                  <input
                    value={renameText} onChange={e => setRenameText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(o.outputId); if (e.key === 'Escape') setRenamingId(null); }}
                    onBlur={() => commitRename(o.outputId)}
                    autoFocus onClick={e => e.stopPropagation()}
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--accent)', borderRadius: 6, fontSize: '0.95rem', outline: 'none', fontWeight: 600 }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{o.title}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => startRename(o)} title="重命名"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--ink-faint)', padding: 2 }}>✏️</button>
                      <button onClick={() => handleDelete(o.outputId)} title="删除"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--ink-faint)', padding: 2 }}>🗑</button>
                    </div>
                  </div>
                )}

                {/* Version + workflow */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--paper-warm)', padding: '1px 8px', borderRadius: 4 }}>
                    {o.version}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>
                    {WF_NAMES[o.workflowId] || o.workflowId}
                  </span>
                </div>

                {/* Preview */}
                <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.content.substring(0, 120)}…
                </div>

                {/* Time */}
                <div style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span>最后编辑 {timeAgo(o.updatedAt)}</span>
                  <Link href={`/workflow/${o.workflowId}?sid=${o.sessionId}`}
                    style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 500 }}>
                    查看来源 →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
