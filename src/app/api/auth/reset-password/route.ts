import { NextRequest, NextResponse } from 'next/server';
import { createEmailVerification, consumeEmailVerification, getUserByEmail, setUserPassword, addAuditLog } from '@/lib/db';
import { sendVerificationCode } from '@/lib/mailer';
import { randomInt } from 'crypto';
export async function POST(req: NextRequest) {
  const { email, code, newPassword } = await req.json(); const normalized=String(email||'').trim().toLowerCase(); const user=getUserByEmail(normalized);
  if(!user) return NextResponse.json({error:'该邮箱未注册'},{status:404});
  if(!code){const v=String(randomInt(100000,1000000)); createEmailVerification(normalized,v,'password-reset'); await sendVerificationCode(normalized,v); return NextResponse.json({ok:true,message:'验证码已发送'});}
  if(String(newPassword||'').length<8) return NextResponse.json({error:'密码至少 8 位'},{status:400});
  if(!consumeEmailVerification(normalized,String(code),'password-reset')) return NextResponse.json({error:'验证码错误或已过期'},{status:400});
  setUserPassword(user.userId,String(newPassword)); addAuditLog(user.userId,'reset_password',user.userId,'通过邮箱重置密码'); return NextResponse.json({ok:true});
}
