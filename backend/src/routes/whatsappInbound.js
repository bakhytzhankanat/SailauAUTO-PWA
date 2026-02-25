import { Router } from 'express';
import * as whatsappInboundController from '../controllers/whatsappInboundController.js';
import { optionalAuth, requireAuth, requireOwnerOrManager } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireOwnerOrManager, whatsappInboundController.list);

export default router;
