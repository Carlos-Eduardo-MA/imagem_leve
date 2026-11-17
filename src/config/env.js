'use strict';

const path = require('node:path');
require('dotenv').config();

/**
 * Configuração carregada uma única vez. A aplicação falha cedo se o segredo
 * de sessão estiver ausente: sem ele, qualquer cookie poderia ser forjado.
 */
const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const sessionSecret = process.env.SESSION_SECRET || '';

if (sessionSecret.length < 32) {
  console.error(
    '[config] SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres).\n' +
      '         Gere um com: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
  );
  process.exit(1);
}

module.exports = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 3001),
  // Sem client ID a aplicação sobe, mas a tela de login avisa que falta configurar.
  googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  databasePath: path.resolve(
    process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'users.db'),
  ),
  session: {
    secret: sessionSecret,
    expiresIn: process.env.SESSION_EXPIRES_IN || '7d',
  },
  cookie: {
    name: process.env.COOKIE_NAME || 'imagem_sessao',
    secure: isProduction,
    sameSite: 'lax',
  },
};
