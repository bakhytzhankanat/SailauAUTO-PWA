import { Router } from 'express';
import * as inventoryItemController from '../controllers/inventoryItemController.js';
import { optionalAuth, requireAuth, requireService } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireService, inventoryItemController.list);

export default router;
