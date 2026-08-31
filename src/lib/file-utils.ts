import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

export interface UploadedFile {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  isImage: boolean;
}

/**
 * Read text content from a file for LLM context.
 */
export function readFileContent(fileId: string, userId?: string): string | null {
  try {
    const safeName = path.basename(fileId);
    const scoped = path.join(UPLOAD_DIR, userId || '', safeName);
    const filePath = fs.existsSync(scoped) ? scoped : path.join(UPLOAD_DIR, safeName);

    if (!fs.existsSync(filePath)) return null;

    const ext = path.extname(safeName).toLowerCase();
    const textExts = ['.txt', '.md', '.json', '.csv', '.xml', '.yaml', '.yml', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.sql'];

    if (textExts.includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8');
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Read a file as base64 for image content.
 */
export function readFileBase64(fileId: string, userId?: string): { data: string; mimeType: string } | null {
  try {
    const safeName = path.basename(fileId);
    const scoped = path.join(UPLOAD_DIR, userId || '', safeName);
    const filePath = fs.existsSync(scoped) ? scoped : path.join(UPLOAD_DIR, safeName);

    if (!fs.existsSync(filePath)) return null;

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    return {
      data: buffer.toString('base64'),
      mimeType: mimeMap[ext] || 'image/png',
    };
  } catch {
    return null;
  }
}

/**
 * Build a file context string for the LLM system prompt.
 */
export function buildFileContext(files: UploadedFile[], userId?: string): string {
  if (!files || files.length === 0) return '';

  let context = '\n## 用户上传的文件\n';

  for (const file of files) {
    context += `\n### ${file.originalName}\n`;

    if (file.isImage) {
      context += `[图片文件，类型: ${file.mimeType}，大小: ${(file.size / 1024).toFixed(1)}KB]\n`;
    } else {
      const content = readFileContent(file.fileId, userId);
      if (content) {
        // Truncate very long content
        const truncated = content.length > 8000 ? content.substring(0, 8000) + '\n...（内容已截断）' : content;
        context += `\`\`\`\n${truncated}\n\`\`\`\n`;
      } else {
        context += `[二进制文件，类型: ${file.mimeType}，大小: ${(file.size / 1024).toFixed(1)}KB]\n`;
      }
    }
  }

  return context;
}
