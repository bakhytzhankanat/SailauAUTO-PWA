import { Router } from 'express';
import * as clientController from '../controllers/clientController.js';
import { optionalAuth, requireAuth, requireService, requireOwnerOrManager } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireService, requireOwnerOrManager, clientController.list);
router.get('/:id', optionalAuth, requireAuth, requireService, requireOwnerOrManager, clientController.getById);
router.get('/:id/visits', optionalAuth, requireAuth, requireService, requireOwnerOrManager, clientController.listVisits);
router.get('/:id/warranties', optionalAuth, requireAuth, requireService, requireOwnerOrManager, clientController.listWarranties);

export default router;
