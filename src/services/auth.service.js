'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { AppError } = require('../utils/AppError');
const users = require('../store/user.store');

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72;
const BCRYPT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

let dummyPasswordHash;

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    throw new AppError(400, 'Informe um endereço de e-mail válido.');
  }

  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new AppError(400, 'Informe um endereço de e-mail válido.');
  }
  return email;
}

function normalizeName(value) {
  if (typeof value !== 'string') {
    throw new AppError(400, 'Informe seu nome para criar a conta.');
  }

  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) {
    throw new AppError(400, 'O nome deve ter entre 2 e 80 caracteres.');
  }
  return name;
}

function validatePassword(password, minimumLength) {
  if (
    typeof password !== 'string' ||
    password.length < minimumLength ||
    Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES
  ) {
    const message =
      minimumLength === MIN_PASSWORD_LENGTH
        ? 'A senha deve ter pelo menos 12 caracteres e no máximo 72 bytes.'
        : 'Informe uma senha válida.';
    throw new AppError(400, message);
  }
}

async function getDummyPasswordHash() {
  if (!dummyPasswordHash) {
    dummyPasswordHash = bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
  }
  return dummyPasswordHash;
}

async function registerWithEmail({ name, email, password } = {}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeName(name);
  validatePassword(password, MIN_PASSWORD_LENGTH);

  if (users.findByEmail(normalizedEmail)) {
    throw new AppError(409, 'Já existe uma conta com este e-mail.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    return users.createEmailAccount({
      email: normalizedEmail,
      name: normalizedName,
      passwordHash,
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new AppError(409, 'Já existe uma conta com este e-mail.');
    }
    throw error;
  }
}

async function loginWithEmail({ email, password } = {}) {
  const normalizedEmail = normalizeEmail(email);
  validatePassword(password, 1);

  const account = users.findByEmail(normalizedEmail);
  const passwordHash = account?.password_hash || (await getDummyPasswordHash());
  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (!account?.password_hash || !passwordMatches) {
    throw new AppError(401, 'E-mail ou senha inválidos.');
  }

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    picture: null,
  };
}

function connectGoogleAccount(account) {
  const user = users.connectGoogleAccount(account);
  if (!user) {
    throw new AppError(409, 'Não foi possível vincular esta conta Google ao e-mail existente.');
  }
  return user;
}

module.exports = {
  loginWithEmail,
  registerWithEmail,
  connectGoogleAccount,
};
