import { NextRequest } from 'next/server';
import { createUser, getUserByEmail, listAuthUsers, setUserRole, setUserPassword, setUserEmail, setUserActive, getAdminStats, addAuditLog, searchAuditLogs, deleteUserAccount } from '@/lib/db';
import { currentUser } from '@/lib/auth';

function guard() { const user = currentUser(); return user?.role === 'admin' ? user : null; }

export async function GET(request: Request) {
  if (!guard()) return Response.json({ error: '无权限' }, { status: 403 });
  const u=new URL(request.url); return Response.json({ users: listAuthUsers(), stats: getAdminStats(), logs: searchAuditLogs({page:Number(u.searchParams.get('page')||1),pageSize:Number(u.searchParams.get('pageSize')||20),action:u.searchParams.get('action')||undefined,userId:u.searchParams.get('userId')||undefined}) });
}

export async function POST(request: NextRequest) {
  if (!guard()) return Response.json({ error: '无权限' }, { status: 403 });
  try {
    const { email, password, role } = await request.json();
    const normalized = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized) || String(password || '').length < 8) return Response.json({ error: '请输入有效邮箱和至少 8 位密码' }, { status: 400 });
    if (getUserByEmail(normalized)) return Response.json({ error: '该邮箱已注册' }, { status: 409 });
    const user = createUser(normalized, String(password));
    if (role === 'admin') setUserRole(user.userId, 'admin');
    addAuditLog(guard()!.userId, 'create_user', user.userId, normalized);
    return Response.json({ ok: true, user: { ...user, role: role === 'admin' ? 'admin' : 'user' } }, { status: 201 });
  } catch (err: any) { return Response.json({ error: err.message || '创建失败' }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  if (!guard()) return Response.json({ error: '无权限' }, { status: 403 });
  const actor = guard();
  const { userId, role, email, password, active } = await request.json();
  if (!userId) return Response.json({ error: '参数无效' }, { status: 400 });
  if (actor && userId === actor.userId && role === 'user') return Response.json({ error: '不能取消自己的管理员角色' }, { status: 400 });
  if (role !== undefined) { if (!['user', 'admin'].includes(role)) return Response.json({ error: '角色无效' }, { status: 400 }); setUserRole(userId, role); }
  if (email !== undefined) setUserEmail(userId, String(email));
  if (password !== undefined) { if (String(password).length < 8) return Response.json({ error: '密码至少 8 位' }, { status: 400 }); setUserPassword(userId, String(password)); }
  if (active !== undefined) { if (actor?.userId === userId && !active) return Response.json({ error: '不能禁用自己' }, { status: 400 }); setUserActive(userId, !!active); }
  addAuditLog(actor?.userId || null, 'update_user', userId, JSON.stringify({ role, email: email ? String(email).toLowerCase() : undefined, passwordChanged: password !== undefined }));
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest) { const actor=guard(); if(!actor)return Response.json({error:'无权限'},{status:403}); const {userId}=await request.json(); if(!userId)return Response.json({error:'缺少 userId'},{status:400}); if(userId===actor.userId)return Response.json({error:'不能删除当前管理员'},{status:400}); deleteUserAccount(userId); addAuditLog(actor.userId,'delete_user',userId,'删除账号及其数据'); return Response.json({ok:true}); }
