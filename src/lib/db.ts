import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
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

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT NOT NULL REFERENCES auth_users(user_id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS auth_users (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS auth_verifications (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'signup',
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    session_token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth_users(user_id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
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
ensureColumn('sessions', 'user_id', 'TEXT', 'NULL');

// ─── Auth helpers ───
function passwordHash(password: string, salt = randomBytes(16).toString('hex')): string {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString('hex');
  return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }

export interface AuthUser { userId: string; email: string; emailVerified: boolean; role: 'user' | 'admin'; }

ensureColumn('auth_users', 'role', 'TEXT', "'user'");
ensureColumn('auth_users', 'active', 'INTEGER', '1');

export function getUserByEmail(email: string): AuthUser | null {
  const row = db.prepare('SELECT user_id, email, email_verified, role FROM auth_users WHERE email = ? COLLATE NOCASE').get(email.trim()) as any;
  return row ? { userId: row.user_id, email: row.email, emailVerified: !!row.email_verified, role: row.role === 'admin' ? 'admin' : 'user' } : null;
}

export function createUser(email: string, password: string): AuthUser {
  const userId = crypto.randomUUID();
  db.prepare('INSERT INTO auth_users (user_id, email, password_hash) VALUES (?, ?, ?)').run(userId, email.trim().toLowerCase(), passwordHash(password));
  return { userId, email: email.trim().toLowerCase(), emailVerified: false, role: 'user' };
}

export function verifyUserPassword(email: string, password: string): AuthUser | null {
  const row = db.prepare('SELECT user_id, email, password_hash, email_verified, role, active FROM auth_users WHERE email = ? COLLATE NOCASE').get(email.trim()) as any;
  if (!row || !row.active || !passwordMatches(password, row.password_hash)) return null;
  return { userId: row.user_id, email: row.email, emailVerified: !!row.email_verified, role: row.role === 'admin' ? 'admin' : 'user' };
}

export function setUserPassword(userId: string, password: string): void {
  db.prepare('UPDATE auth_users SET password_hash = ?, updated_at = ? WHERE user_id = ?').run(passwordHash(password), new Date().toISOString(), userId);
}
export function setUserEmail(userId: string, email: string): void { db.prepare('UPDATE auth_users SET email=?, updated_at=? WHERE user_id=?').run(email.trim().toLowerCase(), new Date().toISOString(), userId); }
export function setUserActive(userId: string, active: boolean): void { db.prepare('UPDATE auth_users SET active=?, updated_at=? WHERE user_id=?').run(active ? 1 : 0, new Date().toISOString(), userId); }

export function markEmailVerified(userId: string): void { db.prepare('UPDATE auth_users SET email_verified = 1, updated_at = ? WHERE user_id = ?').run(new Date().toISOString(), userId); }

export function createEmailVerification(email: string, code: string, purpose = 'signup'): void {
  db.prepare('DELETE FROM auth_verifications WHERE email = ? COLLATE NOCASE AND purpose = ?').run(email.trim(), purpose);
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO auth_verifications (id, email, code_hash, purpose, expires_at) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), email.trim().toLowerCase(), tokenHash(code), purpose, expires);
}

export function consumeEmailVerification(email: string, code: string, purpose = 'signup'): boolean {
  const row = db.prepare('SELECT id, code_hash, expires_at, attempts FROM auth_verifications WHERE email = ? COLLATE NOCASE AND purpose = ? ORDER BY created_at DESC LIMIT 1').get(email.trim(), purpose) as any;
  if (!row || row.attempts >= 5 || new Date(row.expires_at).getTime() < Date.now()) return false;
  db.prepare('UPDATE auth_verifications SET attempts = attempts + 1 WHERE id = ?').run(row.id);
  return timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(tokenHash(code)));
}

export function createAuthSession(userId: string, days = 30): string {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  db.prepare('INSERT INTO auth_sessions (session_token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash(token), userId, expires);
  return token;
}

export function getUserBySessionToken(token: string): AuthUser | null {
  const row = db.prepare(`SELECT u.user_id, u.email, u.email_verified, u.role, u.active, s.expires_at FROM auth_sessions s JOIN auth_users u ON u.user_id = s.user_id WHERE s.session_token_hash = ?`).get(tokenHash(token)) as any;
  if (!row || !row.active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) { db.prepare('DELETE FROM auth_sessions WHERE session_token_hash = ?').run(tokenHash(token)); return null; }
  return { userId: row.user_id, email: row.email, emailVerified: !!row.email_verified, role: row.role === 'admin' ? 'admin' : 'user' };
}

export function deleteAuthSession(token: string): void { db.prepare('DELETE FROM auth_sessions WHERE session_token_hash = ?').run(tokenHash(token)); }

export function listAuthUsers() {
  return (db.prepare(`SELECT user_id, email, email_verified, role, active, created_at, updated_at FROM auth_users ORDER BY created_at DESC`).all() as any[]).map(r => ({ userId:r.user_id, email:r.email, emailVerified:!!r.email_verified, role:r.role === 'admin' ? 'admin' : 'user', active:!!r.active, createdAt:toISO(r.created_at), updatedAt:toISO(r.updated_at) }));
}
export function setUserRole(userId: string, role: 'user' | 'admin') { db.prepare('UPDATE auth_users SET role=?, updated_at=? WHERE user_id=?').run(role, new Date().toISOString(), userId); }
export function getAdminStats() {
  const scalar = (sql: string) => Number((db.prepare(sql).get() as any)?.count || 0);
  return { users: scalar('SELECT COUNT(*) count FROM auth_users'), sessions: scalar('SELECT COUNT(*) count FROM sessions'), outputs: scalar('SELECT COUNT(*) count FROM work_outputs'), folders: scalar('SELECT COUNT(*) count FROM folders') };
}
export function addAuditLog(userId: string | null, action: string, target = '', detail = '') { db.prepare('INSERT INTO audit_logs (id,user_id,action,target,detail,created_at) VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(), userId, action, target, detail, new Date().toISOString()); }
export function listAuditLogs(limit = 100) { return (db.prepare('SELECT l.*, u.email FROM audit_logs l LEFT JOIN auth_users u ON u.user_id=l.user_id ORDER BY l.created_at DESC LIMIT ?').all(limit) as any[]).map(r => ({ id:r.id, email:r.email || '系统', action:r.action, target:r.target || '', detail:r.detail || '', createdAt:toISO(r.created_at) })); }
export function searchAuditLogs(opts: { page?: number; pageSize?: number; action?: string; userId?: string }) { const page=Math.max(1,opts.page||1), size=Math.min(100,Math.max(1,opts.pageSize||20)); const where:string[]=[];const args:any[]=[];if(opts.action){where.push('l.action = ?');args.push(opts.action)}if(opts.userId){where.push('l.user_id = ?');args.push(opts.userId)}const w=where.length?'WHERE '+where.join(' AND '):'';const total=(db.prepare(`SELECT COUNT(*) count FROM audit_logs l ${w}`).get(...args) as any).count;const rows=db.prepare(`SELECT l.*,u.email FROM audit_logs l LEFT JOIN auth_users u ON u.user_id=l.user_id ${w} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`).all(...args,size,(page-1)*size) as any[];return {items:rows.map(r=>({id:r.id,email:r.email||'系统',action:r.action,target:r.target||'',detail:r.detail||'',createdAt:toISO(r.created_at)})),total,page,pageSize:size,totalPages:Math.ceil(total/size)}}
export function deleteUserAccount(userId:string){const tx=db.transaction(()=>{db.prepare('DELETE FROM output_versions WHERE output_id IN (SELECT output_id FROM work_outputs WHERE user_id=?)').run(userId);db.prepare('DELETE FROM work_outputs WHERE user_id=?').run(userId);db.prepare('DELETE FROM session_names WHERE session_id IN (SELECT session_id FROM sessions WHERE user_id=?)').run(userId);db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);db.prepare('DELETE FROM folders WHERE user_id=?').run(userId);db.prepare('DELETE FROM user_settings WHERE user_id=?').run(userId);db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(userId);db.prepare('DELETE FROM auth_users WHERE user_id=?').run(userId)});tx()}

// Optional first-run bootstrap: set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env.local.
if (process.env.SUPERADMIN_EMAIL && process.env.SUPERADMIN_PASSWORD && !getUserByEmail(process.env.SUPERADMIN_EMAIL)) {
  const admin = createUser(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_PASSWORD);
  setUserRole(admin.userId, 'admin');
  markEmailVerified(admin.userId);
}

// ─── Work Outputs tables ───
db.exec(`
  CREATE TABLE IF NOT EXISTS work_outputs (
    output_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    title TEXT NOT NULL,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    folder_id TEXT,
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

  CREATE TABLE IF NOT EXISTS folders (
    folder_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migration for folder_id column added after initial creation
ensureColumn('work_outputs', 'folder_id', 'TEXT', 'NULL');
ensureColumn('work_outputs', 'user_id', 'TEXT', 'NULL');
ensureColumn('folders', 'user_id', 'TEXT', 'NULL');
// Auxiliary ownership columns for existing databases.
db.exec(`CREATE TABLE IF NOT EXISTS session_names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT)`);
ensureColumn('session_names', 'user_id', 'TEXT', 'NULL');
ensureColumn('output_versions', 'user_id', 'TEXT', 'NULL');

// ─── Session CRUD ───

export function createSession(workflowId: string, userId?: string): Session {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO sessions (session_id, workflow_id, user_id, status, created_at, updated_at) VALUES (?, ?, ?, 'idle', ?, ?)`).run(sessionId, workflowId, userId || null, now, now);
  return { sessionId, workflowId, currentPhase: 0, messages: [], context: {}, status: 'idle', createdAt: now, updatedAt: now };
}

export function getSession(sessionId: string, userId?: string): Session | null {
  const row = userId ? db.prepare(`SELECT * FROM sessions WHERE session_id = ? AND (user_id = ? OR user_id IS NULL)`).get(sessionId, userId) as any : db.prepare(`SELECT * FROM sessions WHERE session_id = ?`).get(sessionId) as any;
  if (!row) return null;
  return { sessionId: row.session_id, workflowId: row.workflow_id, currentPhase: row.current_phase, messages: JSON.parse(row.messages), context: JSON.parse(row.context), status: row.status || 'idle', createdAt: toISO(row.created_at), updatedAt: toISO(row.updated_at) };
}

export function updateSession(sessionId: string, updates: Partial<Pick<Session, 'currentPhase' | 'messages' | 'context' | 'status'>>, userId?: string): void {
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const vals: any[] = [now];
  if (updates.currentPhase !== undefined) { sets.push('current_phase = ?'); vals.push(updates.currentPhase); }
  if (updates.messages !== undefined) { sets.push('messages = ?'); vals.push(JSON.stringify(updates.messages)); }
  if (updates.context !== undefined) { sets.push('context = ?'); vals.push(JSON.stringify(updates.context)); }
  if (updates.status !== undefined) { sets.push('status = ?'); vals.push(updates.status); }
  vals.push(sessionId);
  const owner = userId ? ' AND (user_id = ? OR user_id IS NULL)' : '';
  if (userId) vals.push(userId);
  db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE session_id = ?${owner}`).run(...vals);
}

export function setSessionStatus(sessionId: string, status: 'idle' | 'streaming' | 'unread', userId?: string): void {
  if (userId) db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE session_id = ? AND (user_id = ? OR user_id IS NULL)').run(status, new Date().toISOString(), sessionId, userId);
  else db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE session_id = ?').run(status, new Date().toISOString(), sessionId);
}

export function markSessionRead(sessionId: string, userId?: string): void {
  db.prepare("UPDATE sessions SET status = 'idle', updated_at = ? WHERE session_id = ? AND status IN ('unread', 'streaming') AND (user_id = ? OR ? IS NULL)").run(new Date().toISOString(), sessionId, userId || null, userId || null);
}

// ─── Settings ───

export function getSettings(userId?: string): { llmApiKey: string; llmBaseUrl: string; llmModel: string } {
  const rows = userId
    ? db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(userId) as { key: string; value: string }[]
    : db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    llmApiKey: map.llmApiKey || process.env.LLM_API_KEY || '',
    llmBaseUrl: map.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    llmModel: map.llmModel || process.env.LLM_MODEL || 'gpt-4o',
  };
}

export function saveSettings(userId: string | null, s: { llmApiKey?: string; llmBaseUrl?: string; llmModel?: string }): void {
  const stmt = userId
    ? db.prepare('INSERT OR REPLACE INTO user_settings (user_id, key, value) VALUES (?, ?, ?)')
    : db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  if (s.llmApiKey !== undefined) userId ? stmt.run(userId, 'llmApiKey', s.llmApiKey) : stmt.run('llmApiKey', s.llmApiKey);
  if (s.llmBaseUrl !== undefined) userId ? stmt.run(userId, 'llmBaseUrl', s.llmBaseUrl) : stmt.run('llmBaseUrl', s.llmBaseUrl);
  if (s.llmModel !== undefined) userId ? stmt.run(userId, 'llmModel', s.llmModel) : stmt.run('llmModel', s.llmModel);
}

// ─── History ───

export function deleteSession(sessionId: string, userId?: string): void {
  if (userId) db.prepare('DELETE FROM sessions WHERE session_id = ? AND (user_id = ? OR user_id IS NULL)').run(sessionId, userId);
  else db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
}

export function renameSession(sessionId: string, newName: string, userId?: string): void {
  // Store the custom name in a separate table
  db.exec(`CREATE TABLE IF NOT EXISTS session_names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT)`);
  if (userId && !getSession(sessionId, userId)) return;
  db.prepare('INSERT OR REPLACE INTO session_names (session_id, name, user_id) VALUES (?, ?, ?)').run(sessionId, newName, userId || null);
}

export function getSessionName(sessionId: string): string | null {
  db.exec(`CREATE TABLE IF NOT EXISTS session_names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT)`);
  const row = db.prepare('SELECT name FROM session_names WHERE session_id = ?').get(sessionId) as { name: string } | undefined;
  return row?.name || null;
}

export function listSessions(userId?: string) {
  db.exec(`CREATE TABLE IF NOT EXISTS session_names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT)`);
  // Also ensure status column exists for schemas created before migration
  ensureColumn('sessions', 'status', 'TEXT', "'idle'");
  const rows = db.prepare(`
    SELECT s.session_id, s.workflow_id, s.current_phase, s.created_at, s.updated_at, s.status, n.name as custom_name
    FROM sessions s LEFT JOIN session_names n ON s.session_id = n.session_id
    ${userId ? 'WHERE (s.user_id = ? OR s.user_id IS NULL)' : ''}
    ORDER BY s.updated_at DESC LIMIT 50
  `).all(...(userId ? [userId] : [])) as any[];
  const wfNames: Record<string, string> = {
    'chat':'💬 通用对话',
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

export function findDuplicateOutput(folderId: string, title: string, version: string, userId?: string): boolean {
  const row = db.prepare(
    'SELECT 1 FROM work_outputs WHERE folder_id = ? AND LOWER(title) = LOWER(?) AND LOWER(version) = LOWER(?) LIMIT 1'
  ).get(folderId, title, version);
  return !!row;
}

export function createOutput(outputId: string, sessionId: string, workflowId: string, title: string, version: string, content: string, folderId?: string | null, userId?: string) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO work_outputs (output_id, session_id, workflow_id, title, version, content, folder_id, user_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(outputId, sessionId, workflowId, title, version, content, folderId || null, userId || null, now, now);
}

export function updateOutput(outputId: string, title: string, version: string, content: string, userId?: string) {
  const now = new Date().toISOString();
  db.prepare(`UPDATE work_outputs SET title=?, version=?, content=?, updated_at=? WHERE output_id=?${userId ? ' AND (user_id = ? OR user_id IS NULL)' : ''}`).run(title, version, content, now, outputId, ...(userId ? [userId] : []));
}

export function getOutput(outputId: string, userId?: string) {
  const row = userId ? db.prepare('SELECT * FROM work_outputs WHERE output_id = ? AND (user_id = ? OR user_id IS NULL)').get(outputId, userId) as any : db.prepare('SELECT * FROM work_outputs WHERE output_id = ?').get(outputId) as any;
  if (!row) return null;
  return {
    outputId: row.output_id, sessionId: row.session_id, workflowId: row.workflow_id,
    title: row.title, version: row.version, content: row.content,
    folderId: row.folder_id || null,
    createdAt: toISO(row.created_at), updatedAt: toISO(row.updated_at),
  };
}

export function listOutputs(folderId?: string | null, userId?: string) {
  const owner = userId ? ' AND (user_id = ? OR user_id IS NULL)' : '';
  const ownerArgs = userId ? [userId] : [];
  let rows: any[];
  if (folderId === null || folderId === '__unfiled__') {
    rows = db.prepare(`SELECT * FROM work_outputs WHERE folder_id IS NULL${owner} ORDER BY updated_at DESC`).all(...ownerArgs);
  } else if (folderId) {
    rows = db.prepare(`SELECT * FROM work_outputs WHERE folder_id = ?${owner} ORDER BY updated_at DESC`).all(folderId, ...ownerArgs);
  } else {
    rows = db.prepare(`SELECT * FROM work_outputs WHERE 1=1${owner} ORDER BY updated_at DESC`).all(...ownerArgs);
  }
  return rows.map((r: any) => ({
    outputId: r.output_id, sessionId: r.session_id, workflowId: r.workflow_id,
    title: r.title, version: r.version, content: r.content,
    folderId: r.folder_id || null,
    createdAt: toISO(r.created_at), updatedAt: toISO(r.updated_at),
  }));
}

export function renameOutput(outputId: string, title: string, userId?: string) {
  const now = new Date().toISOString();
  db.prepare(`UPDATE work_outputs SET title=?, updated_at=? WHERE output_id=?${userId ? ' AND (user_id = ? OR user_id IS NULL)' : ''}`).run(title, now, outputId, ...(userId ? [userId] : []));
}

export function deleteOutput(outputId: string, userId?: string) {
  if (userId && !getOutput(outputId, userId)) return;
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

// ─── Folder CRUD ───

export function createFolder(name: string, description: string, userId?: string) {
  const folderId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO folders (folder_id, name, description, user_id, created_at, updated_at) VALUES (?,?,?,?,?,?)')
    .run(folderId, name, description, userId || null, now, now);
  return { folderId, name, description, createdAt: now, updatedAt: now, outputCount: 0 };
}

export interface FolderRow {
  folderId: string; name: string; description: string;
  createdAt: string; updatedAt: string; outputCount: number;
}

export function listFolders(userId?: string): FolderRow[] {
  const rows = db.prepare(`
    SELECT f.*, COUNT(o.output_id) as output_count
    FROM folders f LEFT JOIN work_outputs o ON f.folder_id = o.folder_id
    ${userId ? 'WHERE (f.user_id = ? OR f.user_id IS NULL)' : ''}
    GROUP BY f.folder_id
    ORDER BY f.updated_at DESC
  `).all(...(userId ? [userId] : [])) as any[];
  return rows.map((r: any) => ({
    folderId: r.folder_id, name: r.name, description: r.description,
    createdAt: toISO(r.created_at), updatedAt: toISO(r.updated_at),
    outputCount: Number(r.output_count),
  }));
}

export function getFolder(folderId: string, userId?: string) {
  const row = userId ? db.prepare('SELECT * FROM folders WHERE folder_id = ? AND (user_id = ? OR user_id IS NULL)').get(folderId, userId) as any : db.prepare('SELECT * FROM folders WHERE folder_id = ?').get(folderId) as any;
  if (!row) return null;
  return {
    folderId: row.folder_id, name: row.name, description: row.description,
    createdAt: toISO(row.created_at), updatedAt: toISO(row.updated_at),
  };
}

export function updateFolder(folderId: string, name: string, description: string, userId?: string) {
  const now = new Date().toISOString();
  if (userId) db.prepare('UPDATE folders SET name=?, description=?, updated_at=? WHERE folder_id=? AND (user_id = ? OR user_id IS NULL)').run(name, description, now, folderId, userId);
  else db.prepare('UPDATE folders SET name=?, description=?, updated_at=? WHERE folder_id=?').run(name, description, now, folderId);
}

export function deleteFolder(folderId: string, userId?: string) {
  // Cascade delete: delete output versions first, then outputs, then folder
  const outputs = db.prepare(`SELECT output_id FROM work_outputs WHERE folder_id = ?${userId ? ' AND (user_id = ? OR user_id IS NULL)' : ''}`).all(folderId, ...(userId ? [userId] : [])) as { output_id: string }[];
  for (const o of outputs) {
    db.prepare('DELETE FROM output_versions WHERE output_id = ?').run(o.output_id);
  }
  db.prepare(`DELETE FROM work_outputs WHERE folder_id = ?${userId ? ' AND (user_id = ? OR user_id IS NULL)' : ''}`).run(folderId, ...(userId ? [userId] : []));
  db.prepare(`DELETE FROM folders WHERE folder_id = ?${userId ? ' AND (user_id = ? OR user_id IS NULL)' : ''}`).run(folderId, ...(userId ? [userId] : []));
}
