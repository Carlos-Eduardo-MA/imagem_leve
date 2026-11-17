'use strict';

const env = require('../config/env');
const { AppError } = require('../utils/AppError');
const { verifyGoogleCredential } = require('../services/google.service');
const authService = require('../services/auth.service');
const { createSessionToken, cookieOptions } = require('../utils/session');

function startSession(res, user) {
  res.cookie(env.cookie.name, createSessionToken(user), cookieOptions());
  res.json({ user });
}

async function register(req, res, next) {
  try {
    const user = await authService.registerWithEmail(req.body);
    startSession(res, user);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const user = await authService.loginWithEmail(req.body);
    startSession(res, user);
  } catch (error) {
    next(error);
  }
}

/** Recebe o ID token do Google Identity Services e inicia a sessão. */
async function googleLogin(req, res, next) {
  try {
    const credential = req.body?.credential;

    if (typeof credential !== 'string' || credential.length < 20) {
      throw new AppError(400, 'Credencial do Google ausente ou inválida.');
    }

    const googleUser = await verifyGoogleCredential(credential);
    const user = authService.connectGoogleAccount(googleUser);

    startSession(res, user);
  } catch (error) {
    next(error);
  }
}

function me(req, res) {
  res.json({ user: req.user });
}

function logout(req, res) {
  res.clearCookie(env.cookie.name, {
    httpOnly: true,
    sameSite: env.cookie.sameSite,
    secure: env.cookie.secure,
    path: '/',
  });
  res.status(204).end();
}

/** Informa ao frontend se o login Google está pronto para uso. */
function config(req, res) {
  res.json({ googleClientId: env.googleClientId || null });
}

module.exports = { register, login, googleLogin, me, logout, config };
