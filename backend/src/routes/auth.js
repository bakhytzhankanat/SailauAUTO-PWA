import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', authController.login);
router.get('/me', optionalAuth, requireAuth, authController.me);

export default router;
