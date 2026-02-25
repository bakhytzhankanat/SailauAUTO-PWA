import { Router } from 'express';
import * as clientController from '../controllers/clientController.js';
import { optionalAuth, requireAuth, requireOwnerOrManager } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireOwnerOrManager, clientController.list);
router.get('/:id', optionalAuth, requireAuth, requireOwnerOrManager, clientController.getById);
router.get('/:id/visits', optionalAuth, requireAuth, requireOwnerOrManager, clientController.listVisits);
router.get('/:id/warranties', optionalAuth, requireAuth, requireOwnerOrManager, clientController.listWarranties);

export default router;
