import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Session } from '@/types';

const DB_PATH = path.join(process.cwd(), 'data', 'pmwa.db');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    current_phase INTEGER DEFAULT 0,
    messages TEXT DEFAULT '[]',
    context TEXT DEFAULT '{}',
    status TEXT DEFAULT 'idle',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ── Migrations for columns added after initial creation ──
function ensureColumn(table: string, column: string, type: string, defaultValue: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${defaultValue}`);
  }
}
ensureColumn('sessions', 'status', 'TEXT', "'idle'");

// ─── Work Outputs tables ───
db.exec(`
  CREATE TABLE IF NOT EXISTS work_outputs (
    output_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    title TEXT NOT NULL,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS output_versions (
    version_id TEXT PRIMARY KEY,
    output_id TEXT NOT NULL,
    content TEXT NOT NULL,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (output_id) REFERENCES work_outputs(output_id) ON DELETE CASCADE
  );
`);

// ─── Session CRUD ───

export function createSession(workflowId: string): Session {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO sessions (session_id, workflow_id, status, created_at, updated_at) VALUES (?, ?, 'idle', ?, ?)`).run(sessionId, workflowId, now, now);
  return { sessionId, workflowId, currentPhase: 0, messages: [], context: {}, status: 'idle', createdAt: now, updatedAt: now };
}

export function getSession(sessionId: string): Session | null {
  const row = db.prepare(`SELECT * FROM sessions WHERE session_id = ?`).get(sessionId) as any;
  if (!row) return null;
  return { sessionId: row.session_id, workflowId: row.workflow_id, currentPhase: row.current_phase, messages: JSON.parse(row.messages), context: JSON.parse(row.context), status: row.status || 'idle', createdAt: toISO(row.created_at), updatedAt: toISO(row.updated_at) };
}

export function updateSession(sessionId: string, updates: Partial<Pick<Session, 'currentPhase' | 'messages' | 'context' | 'status'>>): void {
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const vals: any[] = [now];
  if (updates.currentPhase !== undefined) { sets.push('current_phase = ?'); vals.push(updates.currentPhase); }
  if (updates.messages !== undefined) { sets.push('messages = ?'); vals.push(JSON.stringify(updates.messages)); }
  if (updates.context !== undefined) { sets.push('context = ?'); vals.push(JSON.stringify(updates.context)); }
  if (updates.status !== undefined) { sets.push('status = ?'); vals.push(updates.status); }
  vals.push(sessionId);
  db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE session_id = ?`).run(...vals);
}

export function setSessionStatus(sessionId: string, status: 'idle' | 'streaming' | 'unread'): void {
  db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE session_id = ?').run(status, new Date().toISOString(), sessionId);
}

export function markSessionRead(sessionId: string): void {
  db.prepare("UPDATE sessions SET status = 'idle', updated_at = ? WHERE session_id = ? AND status = 'unread'").run(new Date().toISOString(), sessionId);
}

// ─── Settings ───

export function getSettings(): { llmApiKey: string; llmBaseUrl: string; llmModel: string } {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    llmApiKey: map.llmApiKey || process.env.LLM_API_KEY || '',
    llmBaseUrl: map.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    llmModel: map.llmModel || process.env.LLM_MODEL || 'gpt-4o',
  };
}

export function saveSettings(s: { llmApiKey?: string; llmBaseUrl?: string; llmModel?: string }): void {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  if (s.llmApiKey !== undefined) stmt.run('llmApiKey', s.llmApiKey);
  if (s.llmBaseUrl !== undefined) stmt.run('llmBaseUrl', s.llmBaseUrl);
  if (s.llmModel !== undefined) stmt.run('llmModel', s.llmModel);
}

// ─── History ───

export function deleteSession(sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
}

export function renameSession(sessionId: string, newName: string): void {
  // Store the custom name in a separate table
  db.exec(`CREATE TABLE IF NOT EXISTS session_names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
  db.prepare('INSERT OR REPLACE INTO session_names (session_id, name) VALUES (?, ?)').run(sessionId, newName);
}

export function getSessionName(sessionId: string): string | null {
  db.exec(`CREATE TABLE IF NOT EXISTS session_names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
  const row = db.prepare('SELECT name FROM session_names WHERE session_id = ?').get(sessionId) as { name: string } | undefined;
  return row?.name || null;
}

export function listSessions() {
  db.exec(`CREATE TABLE IF NOT EXISTS session_names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
  // Also ensure status column exists for schemas created before migration
  ensureColumn('sessions', 'status', 'TEXT', "'idle'");
  const rows = db.prepare(`
    SELECT s.session_id, s.workflow_id, s.current_phase, s.created_at, s.updated_at, s.status, n.name as custom_name
    FROM sessions s LEFT JOIN session_names n ON s.session_id = n.session_id
    ORDER BY s.updated_at DESC LIMIT 50
  `).all() as any[];
  const wfNames: Record<string, string> = {
    'idea-refinement':'💡 产品想法完善','competitive-intel':'🔍 竞品分析报告','business-strategy':'📊 商业分析与战略',
    'prd-delivery':'📝 PRD 与交付','prioritization':'🎯 需求排布','agent-orchestrator':'🤖 Agent 工作编排',
    'launch-pipeline':'🚀 产品发布全流程','incident-response':'🔥 产品事故响应与恢复','build-vs-buy':'🏗️ Build vs Buy 决策',
    'activation-loop':'👤 新用户激活优化',
  };
  return rows.map((r:any)=>({
    sessionId:r.session_id, workflowId:r.workflow_id,
    workflowName: r.custom_name || `${wfNames[r.workflow_id]||r.workflow_id} · ${r.created_at.substring(0,10)}`,
    createdAt: toISO(r.created_at), updatedAt: toISO(r.updated_at),
    customName: r.custom_name || null, status: r.status || 'idle',
  }));
}

/** Convert SQLite datetime string to ISO-8601 for JS Date parsing */
function toISO(val: string): string {
  if (!val) return new Date().toISOString();
  // Already ISO-8601 (contains 'T' as separator) — return as-is
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return val;
  // SQLite format: "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS.000Z"
  return val.replace(' ', 'T') + '.000Z';
}

// ─── Work Outputs CRUD ───

export function createOutput(outputId: string, sessionId: string, workflowId: string, title: string, version: string, content: string) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO work_outputs (output_id, session_id, workflow_id, title, version, content, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(outputId, sessionId, workflowId, title, version, content, now, now);
}

export function updateOutput(outputId: string, title: string, version: string, content: string) {
  const now = new Date().toISOString();
  db.prepare('UPDATE work_outputs SET title=?, version=?, content=?, updated_at=? WHERE output_id=?')
    .run(title, version, content, now, outputId);
}

export function getOutput(outputId: string) {
  const row = db.prepare('SELECT * FROM work_outputs WHERE output_id = ?').get(outputId) as any;
  if (!row) return null;
  return {
    outputId: row.output_id, sessionId: row.session_id, workflowId: row.workflow_id,
    title: row.title, version: row.version, content: row.content,
    createdAt: toISO(row.created_at), updatedAt: toISO(row.updated_at),
  };
}

export function listOutputs() {
  const rows = db.prepare('SELECT * FROM work_outputs ORDER BY updated_at DESC').all() as any[];
  return rows.map((r: any) => ({
    outputId: r.output_id, sessionId: r.session_id, workflowId: r.workflow_id,
    title: r.title, version: r.version, content: r.content,
    createdAt: toISO(r.created_at), updatedAt: toISO(r.updated_at),
  }));
}

export function renameOutput(outputId: string, title: string) {
  const now = new Date().toISOString();
  db.prepare('UPDATE work_outputs SET title=?, updated_at=? WHERE output_id=?').run(title, now, outputId);
}

export function deleteOutput(outputId: string) {
  db.prepare('DELETE FROM output_versions WHERE output_id = ?').run(outputId);
  db.prepare('DELETE FROM work_outputs WHERE output_id = ?').run(outputId);
}

export function saveOutputVersion(versionId: string, outputId: string, content: string, version: string, title: string) {
  db.prepare('INSERT INTO output_versions (version_id, output_id, content, version, title) VALUES (?,?,?,?,?)')
    .run(versionId, outputId, content, version, title);
}

export function getOutputVersions(outputId: string): { versionId: string; content: string; version: string; title: string; createdAt: string }[] {
  const rows = db.prepare('SELECT * FROM output_versions WHERE output_id = ? ORDER BY created_at DESC').all(outputId) as any[];
  return rows.map((r: any) => ({
    versionId: r.version_id, content: r.content, version: r.version,
    title: r.title, createdAt: toISO(r.created_at),
  }));
}
