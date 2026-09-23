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

    saveDb();
    return db;
}

function saveDb() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
    return db;
}

module.exports = { initDb, getDb, saveDb };
