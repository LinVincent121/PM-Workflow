import { NextRequest } from 'next/server';
import { loadSkillContent } from '@/lib/skill-loader';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const content = loadSkillContent(params.id);
  if (!content) {
    return Response.json({ error: 'Skill not found' }, { status: 404 });
  }
  return Response.json({ id: params.id, content });
}
