import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { optionalAuth, requireAuth, requireOwner } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, settingsController.getAll);
router.patch('/', optionalAuth, requireAuth, requireOwner, settingsController.update);

export default router;
