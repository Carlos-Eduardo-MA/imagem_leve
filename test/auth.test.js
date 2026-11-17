'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'imagem-leve-auth-'));
process.env.SESSION_SECRET = 'test-session-secret-with-more-than-32-characters';
process.env.DATABASE_PATH = path.join(testDirectory, 'users.db');
process.env.GOOGLE_CLIENT_ID = '';
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const users = require('../src/store/user.store');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  users.close();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

async function postJson(route, body) {
  return fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('registers an account with a bcrypt hash and starts an HttpOnly session', async () => {
  const response = await postJson('/api/auth/register', {
    name: 'Portfolio User',
    email: 'Portfolio@Example.com',
    password: 'a-strong-password-123',
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.user.email, 'portfolio@example.com');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);

  const storedAccount = users.findByEmail('portfolio@example.com');
  assert.notEqual(storedAccount.password_hash, 'a-strong-password-123');
  assert.match(storedAccount.password_hash, /^\$2[aby]\$/);

  const sessionCookie = response.headers.get('set-cookie').split(';')[0];
  const sessionResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(sessionResponse.status, 200);
  assert.equal((await sessionResponse.json()).user.id, result.user.id);
});

test('logs in case-insensitively and rejects incorrect passwords generically', async () => {
  const loginResponse = await postJson('/api/auth/login', {
    email: 'PORTFOLIO@example.com',
    password: 'a-strong-password-123',
  });
  assert.equal(loginResponse.status, 200);

  const invalidResponse = await postJson('/api/auth/login', {
    email: 'portfolio@example.com',
    password: 'incorrect-password',
  });
  assert.equal(invalidResponse.status, 401);
  assert.equal((await invalidResponse.json()).error, 'E-mail ou senha inválidos.');
});

test('rejects duplicate accounts and passwords below the minimum length', async () => {
  const duplicateResponse = await postJson('/api/auth/register', {
    name: 'Other User',
    email: 'portfolio@example.com',
    password: 'a-different-strong-password',
  });
  assert.equal(duplicateResponse.status, 409);

  const weakPasswordResponse = await postJson('/api/auth/register', {
    name: 'Another User',
    email: 'another@example.com',
    password: 'short',
  });
  assert.equal(weakPasswordResponse.status, 400);
});

test('links a Google identity to the matching account without changing its id', () => {
  const originalAccount = users.findByEmail('portfolio@example.com');
  const linkedAccount = users.connectGoogleAccount({
    sub: 'google-sub-portfolio',
    email: 'portfolio@example.com',
    name: 'Google Profile Name',
    picture: null,
  });

  assert.equal(linkedAccount.id, originalAccount.id);
  assert.equal(users.connectGoogleAccount({
    sub: 'different-google-sub',
    email: 'portfolio@example.com',
    name: 'Another Profile',
    picture: null,
  }), null);
});

test('limits repeated login attempts from the same IP', async () => {
  const responses = [];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    responses.push(
      await postJson('/api/auth/login', {
        email: 'portfolio@example.com',
        password: 'incorrect-password',
      }),
    );
  }

  assert.deepEqual(
    responses.map((response) => response.status),
    [401, 401, 401, 401, 401, 429],
  );
});
