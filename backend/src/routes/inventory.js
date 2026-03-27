import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import { optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireService, inventoryController.list);
router.post('/', optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, inventoryController.create);
router.post('/movement', optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, inventoryController.createMovement);
router.delete('/:id', optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, inventoryController.remove);

export default router;
