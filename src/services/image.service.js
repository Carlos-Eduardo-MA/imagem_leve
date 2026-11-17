'use strict';

const sharp = require('sharp');
const { AppError } = require('../utils/AppError');

const MAX_DIMENSION = 1600;
const MAX_INPUT_PIXELS = 50_000_000;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const DOWNLOAD_FORMATS = {
  jpeg: { extension: 'jpg', mimeType: 'image/jpeg' },
  png: { extension: 'png', mimeType: 'image/png' },
  webp: { extension: 'webp', mimeType: 'image/webp' },
};

function supportedFormats() {
  return Object.keys(DOWNLOAD_FORMATS);
}

/**
 * Redimensiona a imagem para no máximo MAX_DIMENSION px de largura e a
 * recomprime em WebP. Esse buffer otimizado é a base para o preview e para
 * a conversão no formato escolhido na hora do download.
 */
async function compressImage(buffer, mimetype) {
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    throw new AppError(400, 'Formato não suportado. Envie JPEG, PNG, WebP ou AVIF.');
  }

  let metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new AppError(400, 'Não foi possível ler esta imagem. Envie um arquivo válido.');
  }

  if (!metadata.width || !metadata.height) {
    throw new AppError(400, 'A imagem enviada não tem dimensões válidas.');
  }

  let result;
  try {
    result = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // aplica a orientação EXIF antes de redimensionar
      .resize({
        width: Math.min(metadata.width, MAX_DIMENSION),
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new AppError(400, 'Não foi possível processar esta imagem.');
  }

  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

/** Converte a imagem já otimizada para o formato pedido no download. */
async function convertImage(buffer, format) {
  const target = DOWNLOAD_FORMATS[format];

  if (!target) {
    throw new AppError(
      400,
      `Formato de download inválido. Escolha entre: ${supportedFormats().join(', ')}.`,
    );
  }

  const pipeline = sharp(buffer).rotate();

  if (format === 'jpeg') {
    pipeline.jpeg({ quality: 82, mozjpeg: true });
  } else if (format === 'png') {
    pipeline.png({ compressionLevel: 9 });
  } else {
    pipeline.webp({ quality: 82, effort: 4 });
  }

  const data = await pipeline.toBuffer();

  return { data, ...target };
}

module.exports = {
  ALLOWED_MIME_TYPES,
  MAX_DIMENSION,
  compressImage,
  convertImage,
  supportedFormats,
};
