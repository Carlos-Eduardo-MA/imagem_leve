'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const env = require('../config/env');

fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });

const database = new Database(env.databasePath);
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    google_sub TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const findByEmailStatement = database.prepare('SELECT * FROM users WHERE email = ?');
const findByGoogleSubStatement = database.prepare('SELECT * FROM users WHERE google_sub = ?');
const insertEmailAccountStatement = database.prepare(
  'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)',
);
const insertGoogleAccountStatement = database.prepare(
  'INSERT INTO users (id, email, name, google_sub) VALUES (?, ?, ?, ?)',
);
const linkGoogleAccountStatement = database.prepare(
  'UPDATE users SET google_sub = ? WHERE id = ?',
);

function toUser(account, picture = null) {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    picture,
  };
}

function findByEmail(email) {
  return findByEmailStatement.get(email) || null;
}

function createEmailAccount({ email, name, passwordHash }) {
  const id = crypto.randomUUID();
  insertEmailAccountStatement.run(id, email, name, passwordHash);
  return toUser(findByEmailStatement.get(email));
}

const connectGoogleAccountTransaction = database.transaction(({ sub, email, name, picture }) => {
  const existingGoogleAccount = findByGoogleSubStatement.get(sub);
  if (existingGoogleAccount) return toUser(existingGoogleAccount, picture);

  const existingEmailAccount = findByEmailStatement.get(email);

  if (existingEmailAccount?.google_sub) return null;

  if (existingEmailAccount) {
    linkGoogleAccountStatement.run(sub, existingEmailAccount.id);
    return toUser(findByEmailStatement.get(email), picture);
  }

  const id = crypto.randomUUID();
  insertGoogleAccountStatement.run(id, email, name, sub);
  return toUser(findByEmailStatement.get(email), picture);
});

function connectGoogleAccount(account) {
  return connectGoogleAccountTransaction.immediate(account);
}

function close() {
  database.close();
}

module.exports = {
  findByEmail,
  createEmailAccount,
  connectGoogleAccount,
  close,
};
