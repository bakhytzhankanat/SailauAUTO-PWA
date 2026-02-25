import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { optionalAuth, requireAuth, requireOwner } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireOwner, userController.list);
router.post('/', optionalAuth, requireAuth, requireOwner, userController.create);
router.get('/workers', optionalAuth, requireAuth, requireOwner, userController.listWorkers);
router.patch('/:id', optionalAuth, requireAuth, requireOwner, userController.updateUser);

export default router;
