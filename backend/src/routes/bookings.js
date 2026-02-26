import { Router } from 'express';
import * as bookingController from '../controllers/bookingController.js';
import { optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, requireWorkerOrOwner } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireService, bookingController.list);
router.get('/:id', optionalAuth, requireAuth, requireService, bookingController.getById);
router.post('/', optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, bookingController.create);
router.patch('/:id', optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, bookingController.update);
router.patch('/:id/start', optionalAuth, requireAuth, requireService, requireWorkerOrOwner, bookingController.start);
router.patch('/:id/complete', optionalAuth, requireAuth, requireService, requireWorkerOrOwner, bookingController.complete);

export default router;
