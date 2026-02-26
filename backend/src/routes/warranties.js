import { Router } from 'express';
import * as warrantyController from '../controllers/warrantyController.js';
import { optionalAuth, requireAuth, requireService, requireOwnerOrManager } from '../middleware/auth.js';

const router = Router();

router.get('/expiring', optionalAuth, requireAuth, requireService, requireOwnerOrManager, warrantyController.listExpiring);

export default router;
