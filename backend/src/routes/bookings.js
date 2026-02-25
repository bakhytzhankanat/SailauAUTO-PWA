import { Router } from 'express';
import * as bookingController from '../controllers/bookingController.js';
import { optionalAuth, requireAuth, requireOwnerOrManager, requireOwnerOrManagerOrSeniorWorker, requireWorkerOrOwner } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, bookingController.list);
router.get('/:id', optionalAuth, requireAuth, bookingController.getById);
router.post('/', optionalAuth, requireAuth, requireOwnerOrManagerOrSeniorWorker, bookingController.create);
router.patch('/:id', optionalAuth, requireAuth, requireOwnerOrManagerOrSeniorWorker, bookingController.update);
router.patch('/:id/start', optionalAuth, requireAuth, requireWorkerOrOwner, bookingController.start);
router.patch('/:id/complete', optionalAuth, requireAuth, requireWorkerOrOwner, bookingController.complete);

export default router;
