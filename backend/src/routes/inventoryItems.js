import { Router } from 'express';
import * as inventoryItemController from '../controllers/inventoryItemController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, inventoryItemController.list);

export default router;
