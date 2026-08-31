import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { currentUser } from '@/lib/auth';
const ROOT = path.join(process.cwd(), 'data', 'uploads');
export async function GET() {
  const dir = path.join(ROOT, currentUser()?.userId || 'legacy');
  if (!fs.existsSync(dir)) return Response.json([]);
  const mime:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.pdf':'application/pdf','.txt':'text/plain','.md':'text/markdown'};
  return Response.json(fs.readdirSync(dir, { withFileTypes:true }).filter(e=>e.isFile()).map(e=>{const s=fs.statSync(path.join(dir,e.name));return {fileId:e.name,size:s.size,updatedAt:s.mtime.toISOString(),mimeType:mime[path.extname(e.name).toLowerCase()]||'application/octet-stream'}}));
}
