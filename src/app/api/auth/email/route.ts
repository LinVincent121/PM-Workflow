import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { createEmailVerification, consumeEmailVerification, getUserByEmail, setUserEmail, addAuditLog } from '@/lib/db';
import { sendVerificationCode } from '@/lib/mailer';
import { randomInt } from 'crypto';
export async function POST(req: NextRequest) {
  // 修改邮箱功能暂时下线，保留实现以便后续恢复。
  return NextResponse.json({ error: '修改邮箱功能暂时不可用' }, { status: 410 });
  /*
  const user=currentUser(); if(!user) return NextResponse.json({error:'请先登录'},{status:401});
  const { email, code } = await req.json(); const normalized=String(email||'').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(normalized)) return NextResponse.json({error:'邮箱格式无效'},{status:400});
  if(getUserByEmail(normalized) && normalized!==user.email.toLowerCase()) return NextResponse.json({error:'该邮箱已被使用'},{status:409});
  if(!code){const v=String(randomInt(100000,1000000)); createEmailVerification(normalized,v,'email-change'); await sendVerificationCode(normalized,v); return NextResponse.json({ok:true,message:'验证码已发送'});}
  if(!consumeEmailVerification(normalized,String(code),'email-change')) return NextResponse.json({error:'验证码错误或已过期'},{status:400});
  setUserEmail(user.userId,normalized); addAuditLog(user.userId,'change_email',user.userId,normalized); return NextResponse.json({ok:true}); */
}
