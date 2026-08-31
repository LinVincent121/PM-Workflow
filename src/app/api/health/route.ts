import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'pmwa.db');
  const healthy = fs.existsSync(dbPath);
  return Response.json(
    { status: healthy ? 'ok' : 'degraded', database: healthy ? 'available' : 'missing', timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
