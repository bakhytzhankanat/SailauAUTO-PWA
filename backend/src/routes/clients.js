import { Router } from 'express';
import * as clientController from '../controllers/clientController.js';
import { optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, clientController.list);
router.get('/:id', optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, clientController.getById);
router.get('/:id/visits', optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, clientController.listVisits);
router.get('/:id/warranties', optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, clientController.listWarranties);

export default router;
