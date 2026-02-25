import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import { optionalAuth, requireAuth, requireOwnerOrManager } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, inventoryController.list);
router.post('/', optionalAuth, requireAuth, requireOwnerOrManager, inventoryController.create);
router.post('/movement', optionalAuth, requireAuth, requireOwnerOrManager, inventoryController.createMovement);

export default router;
