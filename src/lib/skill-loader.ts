import fs from 'fs';
import path from 'path';
import type { WorkflowDef } from '@/types';

const SKILLS_ROOT = path.join(process.cwd(), '..', 'pm-skills');

/**
 * Read a SKILL.md file and return its full Markdown content.
 * The orchestrator will inject this as context in the system prompt.
 */
export function loadSkillContent(skillId: string): string | null {
  const skillDir = path.join(SKILLS_ROOT, skillId);
  if (!fs.existsSync(skillDir)) return null;
  const mdFile = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(mdFile)) return null;
  return fs.readFileSync(mdFile, 'utf-8');
}

/**
 * Read a skill's template.md if it exists.
 */
export function loadSkillTemplate(skillId: string): string | null {
  const tmpl = path.join(SKILLS_ROOT, skillId, 'template.md');
  if (!fs.existsSync(tmpl)) return null;
  return fs.readFileSync(tmpl, 'utf-8');
}

/**
 * Read a skill's example if it exists.
 */
export function loadSkillExample(skillId: string): string | null {
  const ex = path.join(SKILLS_ROOT, skillId, 'examples', 'sample.md');
  if (!fs.existsSync(ex)) return null;
  return fs.readFileSync(ex, 'utf-8');
}

/**
 * Load a full skill bundle: SKILL.md + template + example.
 */
export function loadSkillBundle(skillId: string): { skill: string; template: string | null; example: string | null } {
  return {
    skill: loadSkillContent(skillId) || `// Skill "${skillId}" not found at ${SKILLS_ROOT}/${skillId}/`,
    template: loadSkillTemplate(skillId),
    example: loadSkillExample(skillId),
  };
}

/**
 * Build a comprehensive context prompt for a list of skill IDs.
 * Limits total tokens by capping each skill at ~4000 chars.
 */
export function buildSkillsContext(skillIds: string[]): string {
  const parts: string[] = [];

  for (const id of skillIds) {
    const bundle = loadSkillBundle(id);
    if (!bundle) continue;

    let content = `\n--- Skill: ${id} ---\n`;
    // Take the first ~3500 chars of SKILL.md, focusing on Purpose + Application
    const skill = bundle.skill;
    const relevant = extractRelevantSections(skill);
    content += relevant.substring(0, 3500);
    parts.push(content);
  }

  return parts.join('\n');
}

/**
 * Extract Purpose, Key Concepts, and Application sections from SKILL.md.
 */
function extractRelevantSections(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let inRelevant = false;

  for (const line of lines) {
    if (/^## (Purpose|Key Concepts|Application|Facilitation)/.test(line)) {
      inRelevant = true;
    }
    if (inRelevant && /^## (References|Examples|Common Pitfalls)/.test(line)) {
      inRelevant = false;
    }
    if (inRelevant) {
      result.push(line);
    }
  }

  if (result.length === 0) {
    // Fallback: take everything
    return md;
  }

  return result.join('\n');
}

/**
 * Load a workflow definition from JSON.
 */
export function loadWorkflowDef(workflowId: string): WorkflowDef | null {
  const defPath = path.join(process.cwd(), 'src', 'data', 'workflows', `${workflowId}.json`);
  if (!fs.existsSync(defPath)) return null;
  return JSON.parse(fs.readFileSync(defPath, 'utf-8'));
}

/**
 * List all available workflow definitions.
 */
export function listWorkflowDefs(): WorkflowDef[] {
  const dir = path.join(process.cwd(), 'src', 'data', 'workflows');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}
