import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import { optionalAuth, requireAuth, requireService, requireOwnerOrManager } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireService, inventoryController.list);
router.post('/', optionalAuth, requireAuth, requireService, requireOwnerOrManager, inventoryController.create);
router.post('/movement', optionalAuth, requireAuth, requireService, requireOwnerOrManager, inventoryController.createMovement);

export default router;
