'use strict';

const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { authRateLimit } = require('../middleware/authRateLimit.middleware');

const router = express.Router();

router.get('/config', authController.config);
router.post('/register', authRateLimit, authController.register);
router.post('/login', authRateLimit, authController.login);
router.post('/google', authRateLimit, authController.googleLogin);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

module.exports = router;
