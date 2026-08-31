const Database=require('better-sqlite3');const db=new Database(process.env.DATABASE_PATH||'data/pmwa.db');
const tables=['auth_users','sessions','folders','work_outputs','audit_logs'];for(const t of tables){if(!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t))throw Error(`missing table ${t}`)}
const cols=(t)=>db.prepare(`PRAGMA table_info(${t})`).all().map(x=>x.name);for(const t of ['sessions','folders','work_outputs'])if(!cols(t).includes('user_id'))throw Error(`${t} missing user_id`);console.log('Isolation schema checks passed');db.close();
