'use strict';

const { OAuth2Client } = require('google-auth-library');
const env = require('../config/env');
const { AppError } = require('../utils/AppError');

let client = null;

function getClient() {
  if (!env.googleClientId) {
    throw new AppError(
      503,
      'Login com Google não configurado. Defina GOOGLE_CLIENT_ID no .env para habilitar.',
    );
  }
  client ??= new OAuth2Client(env.googleClientId);
  return client;
}

/**
 * Valida o ID token emitido pelo Google Identity Services no navegador.
 * A assinatura e a audiência são conferidas pelo próprio Google; nunca
 * confiamos em dados enviados diretamente pelo cliente.
 */
async function verifyGoogleCredential(credential) {
  let ticket;
  try {
    ticket = await getClient().verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });
  } catch {
    throw new AppError(401, 'Não foi possível validar sua conta Google. Tente entrar novamente.');
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new AppError(401, 'A conta Google precisa ter um endereço de e-mail verificado.');
  }

  return {
    id: `google:${payload.sub}`,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || null,
  };
}

module.exports = { verifyGoogleCredential };
