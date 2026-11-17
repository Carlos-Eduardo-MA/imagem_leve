'use strict';

const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`\n  Imagem Leve disponível em http://localhost:${env.port} (${env.nodeEnv})\n`);
  if (!env.googleClientId) {
    console.log(
      '  [aviso] GOOGLE_CLIENT_ID não configurado: a tela de login vai mostrar\n' +
        '          as instruções até você criar o cliente OAuth no Google Cloud.\n',
    );
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n[server] ${signal} recebido, encerrando...`);
    server.close(() => process.exit(0));
  });
}
