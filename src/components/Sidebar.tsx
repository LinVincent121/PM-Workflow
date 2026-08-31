'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface SessionItem {
  sessionId: string; workflowId: string; workflowName: string;
  createdAt: string; updatedAt: string; customName: string | null;
  status: 'idle' | 'streaming' | 'unread';
}

function timeLabel(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '--';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}小时`;
  const diffDays = Math.floor(diffH / 24);
  if (diffDays < 30) return `${diffDays}天`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function groupSessions(sessions: SessionItem[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  const groups: { label: string; items: SessionItem[] }[] = [];
  const today: SessionItem[] = [];
  const yesterday: SessionItem[] = [];
  const week: SessionItem[] = [];
  const older: SessionItem[] = [];

  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    if (d >= todayStart) today.push(s);
    else if (d >= yesterdayStart) yesterday.push(s);
    else if (d >= weekStart) week.push(s);
    else older.push(s);
  }

  if (today.length) groups.push({ label: '今天', items: today });
  if (yesterday.length) groups.push({ label: '昨天', items: yesterday });
  if (week.length) groups.push({ label: '本周', items: week });
  if (older.length) groups.push({ label: '更早', items: older });
  return groups;
}

/* ═══ Inline SVG icons — clean, 18x18, stroke-based ═══ */
const Icons = {
  plus:      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>,
  workflow: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="10" y="1" width="5" height="5" rx="1"/><rect x="1" y="10" width="5" height="5" rx="1"/><rect x="10" y="10" width="5" height="5" rx="1"/></svg>,
  skills:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M2 8h8M2 12h10"/></svg>,
  outputs:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 10l-4 4-4-4"/><path d="M10 14V2"/></svg>,
  settings:  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1.5M8 13v1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M1.5 8H3M13 8h1.5M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"/></svg>,
  chat:      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h6M5 8h4"/><rect x="1.5" y="1.5" width="13" height="10" rx="1.5"/><path d="M5 14l2-2.5h7V11"/></svg>,
  send:      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14 2L7 9M14 2l-4.5 12L7 9 2 5.5z"/></svg>,
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const loadSessions = useCallback(() => {
    fetch('/api/sessions').then(r => r.json()).then(s => setSessions(Array.isArray(s) ? s : [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadSessions();
    const timer = setInterval(loadSessions, 3000);
    return () => clearInterval(timer);
  }, [loadSessions]);

  useEffect(() => {
    if (!renamingId) return;
    function handleClick() { setRenamingId(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [renamingId]);

  const isHome = pathname === '/';
  const isChat = pathname === '/chat';
  const isWorkflow = pathname === '/workflow' || pathname.startsWith('/workflow/');
  const isSkills = pathname === '/skills';
  const isSettings = pathname === '/settings';
  const isOutputs = pathname === '/outputs';

  function handleDelete(sid: string) {
    if (!confirm('确定删除此对话？')) return;
    fetch('/api/sessions', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId:sid}) })
      .then(() => { loadSessions(); if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sid') === sid) router.push('/chat'); }).catch(() => {});
  }

  function startRename(s: SessionItem) {
    setRenamingId(s.sessionId);
    setRenameText(s.customName || s.workflowName);
  }

  function commitRename(sid: string) {
    if (!renameText.trim()) { setRenamingId(null); return; }
    fetch('/api/sessions', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId:sid, name:renameText}) })
      .then(() => loadSessions()).catch(() => {});
    setRenamingId(null);
  }

  function handleClickSession(s: SessionItem) {
    if (s.status === 'unread' || s.status === 'streaming') {
      fetch('/api/sessions/mark-read', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId:s.sessionId}) }).catch(() => {});
    }
    setMobileOpen(false);
    // Chat sessions use /chat page, workflow sessions use /workflow/[id]
    if (s.workflowId === 'chat') {
      router.push(`/chat?sid=${s.sessionId}`);
    } else {
      router.push(`/workflow/${s.workflowId}?sid=${s.sessionId}`);
    }
  }

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const grouped = useMemo(() => groupSessions(sessions), [sessions]);

  return (
    <>
      {/* Mobile hamburger */}
      <button className="mobile-hamburger" onClick={() => setMobileOpen(true)} aria-label="打开菜单">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 4h12M2 8h10M2 12h8"/>
        </svg>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside style={{
        width: collapsed ? 56 : 232, minWidth: collapsed ? 56 : 232,
        background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden', userSelect: 'none',
      }} className={mobileOpen ? 'sidebar-overlay' : ''}>
      {/* Header */}
      <div style={{
        padding: collapsed ? '14px 0' : '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
        height: 52, borderBottom: '1px solid var(--border)',
      }}>
        {!collapsed && (
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="1" y="1" width="18" height="18" rx="4" stroke="var(--accent)" strokeWidth="1.5"/>
              <path d="M6 7h8M6 10h5M6 13h3" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: '0.88rem', fontWeight: 650, letterSpacing: '-0.02em' }}>
              PM Workbench
            </span>
          </Link>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="btn-icon" style={{ width: 28, height: 28, fontSize: '0.8rem' }}>
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <NavItem href="/chat"    icon={Icons.plus}     label="新建任务" collapsed={collapsed} active={isChat} />
        <NavItem href="/workflow" icon={Icons.workflow} label="工作流"   collapsed={collapsed} active={isWorkflow && !isHome} />
        <NavItem href="/skills"   icon={Icons.skills}   label="技能库"   collapsed={collapsed} active={isSkills} />
        <NavItem href="/outputs"  icon={Icons.outputs}  label="工作产出" collapsed={collapsed} active={isOutputs} />
      </nav>

      {/* History section */}
      <div style={{ marginTop: 10, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!collapsed && (
          <div className="section-label" style={{ padding: '10px 16px 4px' }}>历史记录</div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
          {grouped.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <div style={{ padding: '10px 10px 3px', fontSize: '0.62rem', fontWeight: 600, color: 'var(--ink-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(s => (
                <div key={s.sessionId} style={{ position: 'relative' }}
                  onMouseEnter={() => setHoverId(s.sessionId)} onMouseLeave={() => setHoverId(null)}>
                  {renamingId === s.sessionId ? (
                    <input value={renameText} onChange={e => setRenameText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(s.sessionId); if (e.key === 'Escape') setRenamingId(null); }}
                      onBlur={() => commitRename(s.sessionId)} autoFocus onClick={e => e.stopPropagation()}
                      className="input" style={{ fontSize: '0.76rem', padding: '5px 8px' }} />
                  ) : (
                    <button onClick={() => handleClickSession(s)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 3, border: 'none',
                        background: 'transparent', cursor: 'pointer', fontSize: '0.76rem', textAlign: 'left', width: '100%',
                        overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--ink-muted)', fontFamily: 'inherit',
                      }}
                      className="tr-color"
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                      {collapsed ? (
                        <span style={{ position: 'relative', fontSize: '0.8rem', fontWeight: 500 }}>
                          {s.workflowName.charAt(0)}
                          {s.status === 'unread' && (
                            <span style={{ position: 'absolute', top: -1, right: -4, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
                          )}
                        </span>
                      ) : (
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 450 }}>
                              {s.customName || s.workflowName}
                            </span>
                            {s.status === 'streaming' && (
                              <span className="cursor-blink" style={{ fontSize: '0.5rem', color: 'var(--accent)', flexShrink: 0 }}>●</span>
                            )}
                            {s.status === 'unread' && (
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                            )}
                          </div>
                          <div style={{ fontSize: '0.64rem', color: 'var(--ink-faint)', marginTop: 1 }}>
                            {timeLabel(s.updatedAt)}
                          </div>
                        </div>
                      )}
                    </button>
                  )}
                  {!collapsed && hoverId === s.sessionId && renamingId !== s.sessionId && (
                    <div style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 2 }}>
                      <button onClick={e => { e.stopPropagation(); startRename(s); }}
                        style={{ background: 'var(--white)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.58rem', padding: '2px 5px', color: 'var(--ink-muted)', borderRadius: 2, fontFamily: 'inherit' }}>重命名</button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(s.sessionId); }}
                        style={{ background: 'var(--white)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.58rem', padding: '2px 5px', color: 'var(--ink-muted)', borderRadius: 2, fontFamily: 'inherit' }}>删除</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {sessions.length === 0 && !collapsed && (
            <div style={{ padding: '16px 12px', fontSize: '0.74rem', color: 'var(--ink-faint)' }}>暂无历史记录</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
        <Link href="/settings" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 3, textDecoration: 'none',
          color: isSettings ? 'var(--ink)' : 'var(--ink-muted)', fontSize: '0.8rem',
          background: isSettings ? 'var(--sidebar-active)' : 'transparent', fontWeight: isSettings ? 600 : 400,
          fontFamily: 'inherit', justifyContent: collapsed ? 'center' : 'flex-start',
        }} className="tr-color"
          onMouseEnter={e => { if (!isSettings) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
          onMouseLeave={e => { if (!isSettings) e.currentTarget.style.background = 'transparent' }}>
          {collapsed ? Icons.settings : <>{Icons.settings}<span>设置</span></>}
        </Link>
      </div>
    </aside>
    </>
  );
}

const NavItem = memo(function NavItem({ href, icon, label, collapsed, active }: {
  href: string; icon: React.ReactNode; label: string; collapsed: boolean; active?: boolean;
}) {
  return (
    <Link href={href} style={{
      textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9,
      padding: '7px 12px', borderRadius: 4, fontSize: '0.8rem', width: '100%',
      textAlign: 'left' as const,
      background: active ? 'var(--sidebar-active)' : 'transparent',
      color: active ? 'var(--ink)' : 'var(--ink-muted)',
      fontWeight: active ? 600 : 450,
      justifyContent: collapsed ? 'center' : 'flex-start',
      fontFamily: 'inherit', letterSpacing: '-0.01em',
    }} className="tr-color"
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      <span style={{ display: 'flex', alignItems: 'center', opacity: active ? 1 : 0.55 }}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </Link>
  );
});
