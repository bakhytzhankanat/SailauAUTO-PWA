import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { optionalAuth, requireAuth, requireOwner, requireService } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireService, settingsController.getAll);
router.patch('/', optionalAuth, requireAuth, requireService, requireOwner, settingsController.update);

export default router;
