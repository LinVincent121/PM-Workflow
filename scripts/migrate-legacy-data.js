const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.resolve(process.env.DATABASE_PATH || 'data/pmwa.db'));
const owner = process.env.MIGRATE_OWNER_USER_ID;
if (!owner) { console.error('Set MIGRATE_OWNER_USER_ID to the account that should own legacy data.'); process.exit(1); }
const tables = ['sessions', 'folders', 'work_outputs', 'session_names', 'output_versions'];
const tx = db.transaction(() => { for (const table of tables) db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(owner); });
tx(); db.close(); console.log('Legacy data ownership migration completed.');
