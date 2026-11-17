'use strict';

const { AppError } = require('../utils/AppError');
const images = require('../store/image.store');
const {
  compressImage,
  convertImage,
  supportedFormats,
  MAX_DIMENSION,
} = require('../services/image.service');

/** Remove diretórios e caracteres problemáticos do nome original. */
function safeBaseName(originalName) {
  const withoutPath = String(originalName || 'imagem').split(/[\\/]/).pop();
  const withoutExtension = withoutPath.replace(/\.[^.]+$/, '');
  const cleaned = withoutExtension
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return cleaned || 'imagem';
}

async function compress(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError(400, 'Envie uma imagem para diminuir.');
    }

    const result = await compressImage(req.file.buffer, req.file.mimetype);

    // Mede o tamanho final de cada formato para o seletor mostrar o valor real.
    const sizes = {};
    for (const format of supportedFormats()) {
      const converted = await convertImage(result.data, format);
      sizes[format] = converted.data.length;
    }

    const entry = images.save({
      userId: req.user.id,
      data: result.data,
      width: result.width,
      height: result.height,
      originalName: req.file.originalname,
      originalSize: req.file.size,
    });

    res.json({
      image: {
        id: entry.id,
        preview: `data:image/webp;base64,${result.data.toString('base64')}`,
        width: result.width,
        height: result.height,
        originalSize: req.file.size,
        maxDimension: MAX_DIMENSION,
        formats: sizes,
        suggestedName: safeBaseName(req.file.originalname),
        expiresInMinutes: 30,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function download(req, res, next) {
  try {
    const entry = images.get(req.params.id, req.user.id);

    if (!entry) {
      throw new AppError(
        404,
        'Imagem não encontrada ou expirada. Envie o arquivo novamente.',
      );
    }

    const format = String(req.query.format || 'jpeg').toLowerCase();
    const { data, extension, mimeType } = await convertImage(entry.data, format);

    const fileName = `${safeBaseName(entry.originalName)}-otimizada.${extension}`;
    const asciiName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');

    res.set({
      'Content-Type': mimeType,
      'Content-Length': data.length,
      'Content-Disposition':
        `attachment; filename="${asciiName}"; ` +
        `filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'no-store',
    });
    res.send(data);
  } catch (error) {
    next(error);
  }
}

module.exports = { compress, download };
