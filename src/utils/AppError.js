'use strict';

/**
 * Erro esperado da aplicação (validação, sessão inválida, 404...).
 * A mensagem é segura para devolver ao cliente; erros inesperados viram 500.
 */
class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.expose = statusCode < 500;
  }
}

module.exports = { AppError };
