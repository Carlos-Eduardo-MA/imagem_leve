'use strict';

const express = require('express');
const imageController = require('../controllers/image.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { uploadImage } = require('../middleware/upload.middleware');

const router = express.Router();

router.use(requireAuth);

router.post('/compress', uploadImage, imageController.compress);
router.get('/:id/download', imageController.download);

module.exports = router;
