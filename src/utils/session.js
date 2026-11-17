'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/** Sessão do usuário em um JWT de curta duração guardado em cookie httpOnly. */
function createSessionToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
    env.session.secret,
    { algorithm: 'HS256', expiresIn: env.session.expiresIn },
  );
}

function verifySessionToken(token) {
  return jwt.verify(token, env.session.secret, { algorithms: ['HS256'] });
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.cookie.sameSite,
    secure: env.cookie.secure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

module.exports = { createSessionToken, verifySessionToken, cookieOptions };
