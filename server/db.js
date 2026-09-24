const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'onboarding.db');

let db;

async function initDb() {
    const SQL = await initSqlJs();

    // Load existing DB file or create new one
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS onboarding_submissions (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            submitted_at TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS material_submissions (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            submitted_at TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS licences (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            key TEXT NOT NULL,
            total_uses INTEGER NOT NULL,
            used_count INTEGER NOT NULL DEFAULT 0,
            added_at TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS user_preferences (
            email TEXT PRIMARY KEY,
            lang TEXT NOT NULL DEFAULT 'fr'
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS mailing_lists (
            address TEXT PRIMARY KEY,
            created_at TEXT NOT NULL
        )
    `);

    seedMailingLists();
    saveDb();
    return db;
}

// One-time seed of the known mailing lists (safe to re-run, uses INSERT OR IGNORE)
function seedMailingLists() {
    const knownLists = [
        'treso@recommerce.com',
        'update.iban@recommerce.com',
        'digital@recommerce.com',
        'po@recommerce.com',
        'po.digital@recommerce.com',
        'tech@recommerce.com',
        'testing-qa-digital@recommerce.com',
        'eshopgo-evolutionlevel@recommerce.com',
        'all@recommerce.com',
        'all_fr@recommerce.com',
        'perfcom@recommerce.com',
        'all Gentilly',
        'entreprises@recommerce.com',
        'entreprise@recommerce.com',
        'buyback@recommerce.com',
        'entreprises_bte@recommerce.com',
    ];
    const now = new Date().toISOString();
    knownLists.forEach(address => {
        db.run('INSERT OR IGNORE INTO mailing_lists (address, created_at) VALUES (?, ?)', [address, now]);
    });
}

function saveDb() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
    return db;
}

function getMailingLists() {
    const rows = db.exec('SELECT address FROM mailing_lists ORDER BY address ASC');
    if (!rows.length) return [];
    return rows[0].values.map(([address]) => address);
}

function addMailingList(address) {
    const trimmed = (address || '').trim();
    if (!trimmed) return;
    db.run('INSERT OR IGNORE INTO mailing_lists (address, created_at) VALUES (?, ?)', [trimmed, new Date().toISOString()]);
}

function getLicences() {
    const rows = db.exec('SELECT id, type, key, total_uses, used_count, added_at FROM licences ORDER BY added_at DESC');
    if (!rows.length) return [];
    return rows[0].values.map(([id, type, key, totalUses, usedCount, addedAt]) => ({
        id, type, key, totalUses, usedCount, addedAt
    }));
}

function addLicence({ id, type, key, totalUses }) {
    db.run('INSERT INTO licences (id, type, key, total_uses, used_count, added_at) VALUES (?, ?, ?, ?, 0, ?)',
        [id, type, key, totalUses, new Date().toISOString()]);
}

function adjustLicenceUsage(id, delta) {
    db.run('UPDATE licences SET used_count = MAX(0, MIN(total_uses, used_count + ?)) WHERE id = ?', [delta, id]);
}

function deleteLicence(id) {
    db.run('DELETE FROM licences WHERE id = ?', [id]);
}

function getUserLang(email) {
    const stmt = db.prepare('SELECT lang FROM user_preferences WHERE email = ?');
    stmt.bind([email]);
    let lang = 'fr';
    if (stmt.step()) lang = stmt.getAsObject().lang;
    stmt.free();
    return lang;
}

function setUserLang(email, lang) {
    db.run('INSERT INTO user_preferences (email, lang) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET lang = excluded.lang', [email, lang]);
}

module.exports = {
    initDb, getDb, saveDb, getMailingLists, addMailingList,
    getLicences, addLicence, adjustLicenceUsage, deleteLicence,
    getUserLang, setUserLang,
};
