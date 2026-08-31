import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { currentUser } from '@/lib/auth';
import { addAuditLog } from '@/lib/db';

export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5MB

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const user = currentUser();
    const userDir = path.join(UPLOAD_DIR, user?.userId || 'legacy');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return Response.json({ error: '没有上传文件' }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type;
      const isImage = mimeType.startsWith('image/');
      const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

      if (buffer.length > maxSize) {
        const limit = isImage ? '5MB' : '10MB';
        return Response.json({ error: `文件 "${file.name}" 超过 ${limit} 限制` }, { status: 400 });
      }

      // Generate unique filename
      const ext = path.extname(file.name) || '';
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filePath = path.join(userDir, fileId);

      fs.writeFileSync(filePath, buffer);

      results.push({
        fileId,
        originalName: file.name,
        mimeType: file.type,
        size: buffer.length,
        isImage,
      });
    }

    if (user) addAuditLog(user.userId, 'upload_file', '', `${results.length} 个文件`);
    return Response.json({ files: results });
  } catch (err: any) {
    console.error('Upload API error:', err);
    return Response.json({ error: err.message || '上传失败' }, { status: 500 });
  }
}
