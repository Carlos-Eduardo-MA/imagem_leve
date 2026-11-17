'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const imageRoutes = require('./routes/image.routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

app.disable('x-powered-by');

/**
 * CSP restritiva, mas com o necessário para o Google Identity Services:
 * o script vem de accounts.google.com e o botão é renderizado em um iframe
 * do mesmo domínio. O preview da imagem usa data:.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://*.googleusercontent.com',
          'https://lh3.googleusercontent.com',
        ],
        connectSrc: ["'self'", 'https://accounts.google.com'],
        frameSrc: ['https://accounts.google.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        // Em dev (HTTP localhost) forçar upgrade quebraria a própria página.
        upgradeInsecureRequests: env.isProduction ? [] : null,
      },
    },
    // O login do Google precisa enviar o Referer para accounts.google.com.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // O fluxo do Google abre um popup; "same-origin" cortaria a comunicação
    // entre a janela de login e a aplicação.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }),
);

app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);

// Frontend estático servido pela própria aplicação (mesma origem).
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
