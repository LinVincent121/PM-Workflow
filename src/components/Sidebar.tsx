'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
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
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} 小时前`;
  const diffDays = Math.floor(diffH / 24);
  if (diffDays < 30) return `${diffDays} 天前`;
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

  if (today.length) groups.push({ label: '今日', items: today });
  if (yesterday.length) groups.push({ label: '昨天', items: yesterday });
  if (week.length) groups.push({ label: '一周内', items: week });
  if (older.length) groups.push({ label: '过往对话', items: older });
  return groups;
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const sidebarRef = useRef<HTMLElement>(null);

  const loadSessions = useCallback(() => {
    fetch('/api/sessions').then(r => r.json()).then(s => setSessions(Array.isArray(s) ? s : [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadSessions();
    const timer = setInterval(loadSessions, 3000); // poll every 3s for status updates
    return () => clearInterval(timer);
  }, [loadSessions]);

  // Close rename on outside click — only set up when renaming is active
  useEffect(() => {
    if (!renamingId) return;
    function handleClick() { setRenamingId(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [renamingId]);

  const isHome = pathname === '/';
  const isWorkflow = pathname === '/workflow';
  const isSkills = pathname === '/skills';
  const isSettings = pathname === '/settings';
  const isOutputs = pathname === '/outputs';

  function handleDelete(sid: string) {
    if (!confirm('确定删除此对话？')) return;
    fetch('/api/sessions', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId:sid}) })
      .then(() => loadSessions()).catch(() => {});
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
    // Mark as read when clicking into it
    if (s.status === 'unread') {
      fetch('/api/sessions/mark-read', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId:s.sessionId}) }).catch(() => {});
    }
    router.push(`/workflow/${s.workflowId}?sid=${s.sessionId}`);
  }

  const grouped = useMemo(() => groupSessions(sessions), [sessions]);

  return (
    <aside ref={sidebarRef} style={{
      width: collapsed?60:250, minWidth: collapsed?60:250,
      background:'var(--sidebar-bg)', borderRight:'1px solid var(--border)',
      display:'flex', flexDirection:'column', transition:'width 0.2s ease',
      overflow:'hidden', userSelect:'none',
    }}>
      <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', justifyContent: collapsed?'center':'space-between', borderBottom:'1px solid var(--border)' }}>
        {!collapsed && <span style={{ fontWeight:700, fontSize:'0.9rem', whiteSpace:'nowrap' }}>PM工作助手</span>}
        <button onClick={()=>setCollapsed(!collapsed)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1rem', color:'var(--ink-muted)', padding:0 }}>
          {collapsed ? '☰' : '✕'}
        </button>
      </div>

      <nav style={{ padding:'12px 10px', display:'flex', flexDirection:'column', gap:2 }}>
        <SidebarLink href="/"         icon="＋" label="新建任务" collapsed={collapsed} active={isHome} />
        <SidebarLink href="/workflow" icon="⚡" label="工作流"   collapsed={collapsed} active={isWorkflow} />
        <SidebarLink href="#"         icon="📚" label="知识库"   collapsed={collapsed} />
        <SidebarLink href="/outputs"  icon="📤" label="工作产出" collapsed={collapsed} active={isOutputs} />
        <SidebarLink href="/skills"   icon="🔧" label="Skills"   collapsed={collapsed} active={isSkills} />
      </nav>

      <div style={{ padding:'6px 10px', marginTop:8, flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {!collapsed && <div className="label" style={{ padding:'0 8px', marginBottom:4, fontSize:'0.75rem', color:'var(--ink-faint)', fontWeight:500 }}>历史任务</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:1, flex:1, overflowY:'auto' }}>
          {grouped.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <div style={{ padding:'6px 10px 2px', fontSize:'0.7rem', fontWeight:600, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(s => (
                <div key={s.sessionId} style={{ position:'relative' }}
                  onMouseEnter={()=>setHoverId(s.sessionId)} onMouseLeave={()=>setHoverId(null)}
                >
                  {renamingId === s.sessionId ? (
                    <input
                      value={renameText}
                      onChange={e=>setRenameText(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter') commitRename(s.sessionId); if(e.key==='Escape') setRenamingId(null); }}
                      onBlur={()=>commitRename(s.sessionId)}
                      autoFocus
                      onClick={e=>e.stopPropagation()}
                      style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--accent)', fontSize:'0.82rem', outline:'none', background:'white' }}
                    />
                  ) : (
                    <button
                      onClick={()=>handleClickSession(s)}
                      style={{
                        display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:6, border:'none',
                        background:'transparent', cursor:'pointer', fontSize:'0.82rem', textAlign:'left', width:'100%',
                        overflow:'hidden', whiteSpace:'nowrap',
                        color: 'var(--ink-muted)',
                      }}
                      className="tr"
                      onMouseEnter={e=>{e.currentTarget.style.background='var(--sidebar-hover)'}}
                      onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}
                    >
                      {collapsed ? (
                        <span style={{ position:'relative' }}>
                          {s.workflowName.charAt(0)}
                          {s.status === 'streaming' && (
                            <span className="cursor-blink" style={{ position:'absolute', top:-2, right:-6, fontSize:'0.55rem', color:'var(--accent)' }}>●</span>
                          )}
                          {s.status === 'unread' && (
                            <span style={{ position:'absolute', top:0, right:-6, width:6, height:6, borderRadius:'50%', background:'var(--accent)' }} />
                          )}
                        </span>
                      ) : (
                        <div style={{ overflow:'hidden', flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                              {s.workflowName}
                            </span>
                            {s.status === 'streaming' && (
                              <span className="cursor-blink" title="AI 正在回复…" style={{ fontSize:'0.55rem', color:'var(--accent)', flexShrink:0 }}>●</span>
                            )}
                            {s.status === 'unread' && (
                              <span title="新回复" style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
                            )}
                          </div>
                          <div style={{ fontSize:'0.7rem', color:'var(--ink-faint)', marginTop:1 }}>
                            {timeLabel(s.updatedAt)}
                          </div>
                        </div>
                      )}
                    </button>
                  )}
                  {/* Delete button on hover */}
                  {!collapsed && hoverId === s.sessionId && renamingId !== s.sessionId && s.status !== 'streaming' && (
                    <div style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', display:'flex', gap:2 }}>
                      <button onClick={e=>{e.stopPropagation();startRename(s);}}
                        title="重命名"
                        style={{ background:'transparent',border:'none',cursor:'pointer',fontSize:'0.7rem',padding:'2px',color:'var(--ink-faint)',borderRadius:4 }}
                      >✏️</button>
                      <button onClick={e=>{e.stopPropagation();handleDelete(s.sessionId);}}
                        title="删除"
                        style={{ background:'transparent',border:'none',cursor:'pointer',fontSize:'0.7rem',padding:'2px',color:'var(--ink-faint)',borderRadius:4 }}
                      >🗑</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {sessions.length===0 && !collapsed && (
            <div style={{ padding:'12px 10px', fontSize:'0.8rem', color:'var(--ink-faint)' }}>暂无历史记录</div>
          )}
        </div>
      </div>

      <div style={{ marginTop:'auto', padding:'10px' }}>
        <Link href="/settings"
          style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:6, textDecoration:'none', color: isSettings ? 'var(--ink)' : 'var(--ink-muted)', fontSize:'0.85rem', background: isSettings ? 'var(--sidebar-active)' : 'transparent', fontWeight: isSettings ? 600 : 400 }}
          className="tr"
          onMouseEnter={e=>{if(!isSettings)e.currentTarget.style.background='var(--sidebar-hover)'}}
          onMouseLeave={e=>{if(!isSettings)e.currentTarget.style.background='transparent'}}
        >
          <span>⚙️</span>
          {!collapsed && <span>设置</span>}
        </Link>
      </div>
    </aside>
  );
}

function SidebarLink({ href, icon, label, collapsed, active }: { href:string; icon:string; label:string; collapsed:boolean; active?:boolean }) {
  if (href === '#') {
    return (
      <button style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:7, border:'none', background:'transparent', cursor:'default', fontSize:'0.85rem', width:'100%', textAlign:'left' as const, color:'var(--ink-faint)', justifyContent: collapsed?'center':'flex-start', opacity:0.5 }}>
        <span style={{fontSize:'1rem'}}>{icon}</span>
        {!collapsed && <span style={{whiteSpace:'nowrap'}}>{label}</span>}
        {!collapsed && <span style={{fontSize:'0.7rem',marginLeft:4,opacity:0.6}}>即将推出</span>}
      </button>
    );
  }
  return (
    <Link href={href} style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:7, fontSize:'0.85rem', width:'100%', textAlign:'left' as const, background: active ? 'var(--sidebar-active)' : 'transparent', color: active ? 'var(--ink)' : 'var(--ink-muted)', fontWeight: active ? 600 : 400, justifyContent: collapsed?'center':'flex-start' }}
      className="tr"
      onMouseEnter={e=>{if(!active)e.currentTarget.style.background='var(--sidebar-hover)'}}
      onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent'}}
    >
      <span style={{fontSize:'1rem'}}>{icon}</span>
      {!collapsed && <span style={{whiteSpace:'nowrap'}}>{label}</span>}
    </Link>
  );
}
