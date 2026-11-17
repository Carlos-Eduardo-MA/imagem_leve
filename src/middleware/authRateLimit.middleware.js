'use strict';

const { rateLimit } = require('express-rate-limit');

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({
      error: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.',
    });
  },
});

module.exports = { authRateLimit };
