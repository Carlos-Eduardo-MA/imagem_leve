'use strict';

const multer = require('multer');
const { AppError } = require('../utils/AppError');
const { ALLOWED_MIME_TYPES } = require('../services/image.service');

const MAX_FILE_SIZE = 15 * 1024 * 1024;

// Upload em memória: o arquivo nunca toca o disco e é processado pelo sharp.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 5 },
  fileFilter(req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new AppError(400, 'Formato não suportado. Envie JPEG, PNG, WebP ou AVIF.'),
      );
    }
    callback(null, true);
  },
});

const uploadImage = upload.single('image');

module.exports = { uploadImage, MAX_FILE_SIZE };
