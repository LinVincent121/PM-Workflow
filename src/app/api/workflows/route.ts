import { listWorkflowDefs } from '@/lib/skill-loader';

export const runtime = 'nodejs';

export async function GET() {
  const workflows = listWorkflowDefs();
  const cards = workflows.map((w) => ({
    id: w.id,
    name: w.name,
    emoji: w.emoji,
    description: w.shortDesc,
    skillCount: w.skills.length,
    estimatedTime: w.estimatedTime,
    phases: w.phases.map(p => ({ id: p.id, title: p.title, description: p.description })),
  }));
  return Response.json(cards);
}
