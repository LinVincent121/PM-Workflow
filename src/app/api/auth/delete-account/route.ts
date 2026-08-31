import { NextRequest,NextResponse } from 'next/server';
import fs from 'fs'; import path from 'path';
import { currentUser } from '@/lib/auth'; import { deleteUserAccount,addAuditLog } from '@/lib/db';
export async function POST(_r:NextRequest){
 const u=currentUser(); if(!u)return NextResponse.json({error:'请先登录'},{status:401});
 addAuditLog(u.userId,'delete_account',u.userId,'用户注销并清理全部数据');
 deleteUserAccount(u.userId);
 const uploadDir=path.join(process.cwd(),'data','uploads',u.userId);
 if(fs.existsSync(uploadDir)) fs.rmSync(uploadDir,{recursive:true,force:true});
 const r=NextResponse.json({ok:true}); r.cookies.delete('pmwa_session'); return r;
}
