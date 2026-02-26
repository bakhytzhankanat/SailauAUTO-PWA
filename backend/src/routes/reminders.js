import { Router } from 'express';
import * as reminderController from '../controllers/reminderController.js';
import { optionalAuth, requireAuth, requireService, requireOwnerOrManager } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, requireService, reminderController.list);
router.post('/', optionalAuth, requireAuth, requireService, reminderController.create);
router.patch('/:id/status', optionalAuth, requireAuth, requireService, reminderController.updateStatus);
router.delete('/:id', optionalAuth, requireAuth, requireService, reminderController.deleteReminder);
router.post('/clear-done', optionalAuth, requireAuth, requireService, requireOwnerOrManager, reminderController.clearDone);

export default router;
