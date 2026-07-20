import fs from 'fs';
import path from 'path';
import { listWorkflowDefs } from '@/lib/skill-loader';

export const runtime = 'nodejs';

const SKILLS_DIR = path.join(process.cwd(), '..', 'pm-skills');

export async function GET() {
  try {
    if (!fs.existsSync(SKILLS_DIR)) {
      return Response.json([]);
    }

    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    const skills = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const content = fs.readFileSync(skillMd, 'utf-8');
      const nameMatch = content.match(/name:\s*(.+)/);
      const descMatch = content.match(/description:\s*["']?(.+?)["']?\s*$/m);
      const typeMatch = content.match(/type:\s*(\w+)/);

      skills.push({
        id: entry.name,
        name: nameMatch?.[1]?.trim() || entry.name,
        description: descMatch?.[1]?.trim() || '',
        type: typeMatch?.[1] || 'component',
      });
    }

    return Response.json(skills);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
