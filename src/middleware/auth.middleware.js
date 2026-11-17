'use strict';

const env = require('../config/env');
const { AppError } = require('../utils/AppError');
const { verifySessionToken } = require('../utils/session');

/**
 * Protege rotas privadas lendo o JWT do cookie httpOnly.
 * Qualquer falha devolve o mesmo 401, sem detalhes para quem está sondando.
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.[env.cookie.name];

  if (!token) {
    return next(new AppError(401, 'Autenticação necessária.'));
  }

  try {
    const payload = verifySessionToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture || null,
    };
  } catch {
    return next(new AppError(401, 'Sessão inválida ou expirada.'));
  }

  next();
}

module.exports = { requireAuth };
