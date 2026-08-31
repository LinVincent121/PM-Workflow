const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dbPath = path.resolve(process.env.DATABASE_PATH || 'data/pmwa.db');
const outDir = path.resolve('data/backups');
fs.mkdirSync(outDir, { recursive: true });
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);
for (const name of fs.readdirSync(outDir)) {
  const full = path.join(outDir, name);
  if (name.endsWith('.db') && Date.now() - fs.statSync(full).mtimeMs > retentionDays * 86400000) fs.rmSync(full);
}
const target = path.join(outDir, `pmwa-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
const db = new Database(dbPath, { readonly: true });
db.backup(target).then(() => { db.close(); console.log(`Backup created: ${target}`); }).catch(err => { db.close(); console.error(err); process.exitCode = 1; });
