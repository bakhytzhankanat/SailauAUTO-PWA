import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { optionalAuth, requireAuth, requireService, requireOwner, requireOwnerOrManagerOrSeniorWorker } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireService, requireOwner, userController.list);
router.post('/', optionalAuth, requireAuth, requireService, requireOwner, userController.create);
router.get('/workers', optionalAuth, requireAuth, requireService, requireOwnerOrManagerOrSeniorWorker, userController.listWorkers);
router.patch('/:id', optionalAuth, requireAuth, requireService, requireOwner, userController.updateUser);

export default router;
