import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { currentUser } from '@/lib/auth';
import { addAuditLog } from '@/lib/db';

export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

export async function GET(
  _request: NextRequest,
  { params }: { params: { fileId: string } },
) {
  try {
    const { fileId } = params;
    // Sanitize to prevent path traversal
    const safeName = path.basename(fileId);
    const user = currentUser();
    const scoped = path.join(UPLOAD_DIR, user?.userId || 'legacy', safeName);
    const filePath = fs.existsSync(scoped) ? scoped : path.join(UPLOAD_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return Response.json({ error: '文件不存在' }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(safeName).toLowerCase();

    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const contentType = mimeMap[ext] || 'application/octet-stream';

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { fileId: string } }) {
  const safeName = path.basename(params.fileId); const user = currentUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  const filePath = path.join(UPLOAD_DIR, user.userId, safeName);
  if (!fs.existsSync(filePath)) return Response.json({ error: '文件不存在' }, { status: 404 });
  fs.unlinkSync(filePath); addAuditLog(user.userId, 'delete_file', safeName, '删除文件'); return Response.json({ ok: true });
}
