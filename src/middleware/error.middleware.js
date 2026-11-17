'use strict';

const { AppError } = require('../utils/AppError');

function notFound(req, res) {
  res.status(404).json({ error: 'Recurso não encontrado.' });
}

/**
 * Handler central: todo erro passa aqui. Detalhes internos ficam no log,
 * nunca na resposta.
 */
// eslint-disable-next-line no-unused-vars -- Express identifica o handler pelo 4º parâmetro
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  // Corpo JSON malformado chega como SyntaxError do express.json().
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }

  // Erros do multer (arquivo grande demais, campo inesperado...).
  if (error.name === 'MulterError') {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'A imagem passa do limite de 15 MB. Envie um arquivo menor.'
        : 'Não foi possível receber o arquivo enviado.';
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
  }

  let appError = error;

  if (!(error instanceof AppError)) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    appError = new AppError(statusCode, error.message || 'Erro interno do servidor.');
  }

  if (appError.statusCode >= 500) {
    console.error('[erro]', error);
  }

  const body = {
    error:
      appError.statusCode >= 500
        ? 'Erro interno do servidor.'
        : appError.message,
  };

  res.status(appError.statusCode).json(body);
}

module.exports = { notFound, errorHandler };
