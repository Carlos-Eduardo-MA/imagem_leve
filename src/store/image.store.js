'use strict';

const crypto = require('node:crypto');

/**
 * Guarda as imagens otimizadas apenas em memória, por pouco tempo.
 * É suficiente para o fluxo enviar → otimizar → baixar, sem escrever
 * arquivos no disco e sem manter dados de usuários indefinidamente.
 */
const TTL_MS = 30 * 60 * 1000;
const MAX_PER_USER = 10;

const entries = new Map();

function save(entry) {
  // Limita quantos resultados cada usuário pode manter na memória.
  const ownEntries = [...entries.entries()].filter(([, item]) => item.userId === entry.userId);
  for (const [id] of ownEntries.slice(0, Math.max(0, ownEntries.length - MAX_PER_USER + 1))) {
    entries.delete(id);
  }

  const id = crypto.randomUUID();
  entries.set(id, { ...entry, id, expiresAt: Date.now() + TTL_MS });
  return entries.get(id);
}

function get(id, userId) {
  const entry = entries.get(id);

  if (!entry) return null;

  if (entry.userId !== userId || entry.expiresAt <= Date.now()) {
    entries.delete(id);
    return null;
  }

  return entry;
}

// Limpeza periódica para não acumular resultados expirados.
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(id);
  }
}, 5 * 60 * 1000).unref();

module.exports = { save, get };
