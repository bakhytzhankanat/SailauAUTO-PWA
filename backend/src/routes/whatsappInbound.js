import { Router } from 'express';
import * as whatsappInboundController from '../controllers/whatsappInboundController.js';
import { optionalAuth, requireAuth, requireService, requireOwnerOrManager } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireService, requireOwnerOrManager, whatsappInboundController.list);

export default router;
