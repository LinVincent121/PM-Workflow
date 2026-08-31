'use client';
import { useEffect, useState } from 'react';
type Action = 'password' | 'switch' | 'delete' | null;

export default function UserAvatar() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [form, setForm] = useState<Record<string,string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { setEmail(d?.user?.email || ''); setRole(d?.user?.role || 'user'); }).catch(() => {}); }, []);
  if (!email) return <a href="/auth" className="workbench-login-link">登录</a>;
  const close = () => { setAction(null); setMessage(''); setForm({}); };
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); window.location.href = '/'; }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    let url = '', body: Record<string,string> = {};
    if (action === 'password') { url = '/api/auth/password'; body = { currentPassword: form.currentPassword || '', newPassword: form.newPassword || '' }; }
    else if (action === 'switch') { url = '/api/auth/login'; body = { email: form.email || '', password: form.password || '' }; }
    else { if (form.confirm !== '注销账号') { setMessage('请输入“注销账号”确认'); setBusy(false); return; } url = '/api/auth/delete-account'; }
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setMessage(d.error || '操作失败'); return; }
    if (action === 'delete') { window.location.href = '/'; return; }
    if (action === 'switch') { window.location.reload(); return; }
    setMessage('操作成功'); setForm({});
  }
  const modal = action ? (
    <div className="account-modal-backdrop">
      <section className="account-modal" role="dialog" aria-modal="true">
        <button className="account-modal-close" onClick={close}>×</button>
        <p className="section-label">ACCOUNT</p><h3>{action === 'password' ? '修改密码' : action === 'switch' ? '切换账号' : '注销账号'}</h3>
        {action === 'delete' && <p>注销后将永久删除你的会话、文件夹、产出物和设置，无法恢复。</p>}
        <form className="account-inline-form" onSubmit={submit}>
          {action === 'password' && <><input type="password" placeholder="当前密码" onChange={e => setForm({ ...form, currentPassword: e.target.value })}/><input type="password" placeholder="新密码（至少 8 位）" onChange={e => setForm({ ...form, newPassword: e.target.value })}/></>}
          {action === 'switch' && <><input type="email" placeholder="邮箱" onChange={e => setForm({ ...form, email: e.target.value })}/><input type="password" placeholder="密码" onChange={e => setForm({ ...form, password: e.target.value })}/></>}
          {action === 'delete' && <input placeholder="输入“注销账号”确认" onChange={e => setForm({ ...form, confirm: e.target.value })}/>}
          <button disabled={busy} className="account-primary">{busy ? '处理中…' : '确认' + (action === 'password' ? '修改密码' : action === 'switch' ? '切换账号' : '注销账号')}</button>
          {message && <small className="account-message">{message}</small>}
        </form>
      </section>
    </div>
  ) : null;
  return <div className="workbench-account-wrap">
    <button className="workbench-avatar-button" title={email} aria-label="打开账号菜单" aria-expanded={open} onClick={() => setOpen(!open)}><span className="workbench-avatar">{email.charAt(0).toUpperCase()}</span><span className="workbench-email">{email}</span></button>
    {open && <div className="account-modal-backdrop"><section className="account-modal workbench-account-modal" role="dialog" aria-modal="true"><button className="account-modal-close" onClick={() => setOpen(false)}>×</button><p className="section-label">ACCOUNT</p><strong className="account-modal-email">{email}</strong><div className="account-modal-actions">{role === 'admin' && <a href="/admin">后台审计</a>}<button onClick={() => { setOpen(false); setAction('password'); }}>修改密码</button><button onClick={() => { setOpen(false); setAction('switch'); }}>切换账号</button><button onClick={() => { setOpen(false); setAction('delete'); }}>注销账号</button><button onClick={logout}>退出账号</button></div></section></div>}
    {modal}
  </div>;
}
