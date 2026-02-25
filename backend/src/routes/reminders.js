import { Router } from 'express';
import * as reminderController from '../controllers/reminderController.js';
import { optionalAuth, requireAuth, requireOwnerOrManager } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, requireAuth, reminderController.list);
router.post('/', optionalAuth, requireAuth, reminderController.create);
router.patch('/:id/status', optionalAuth, requireAuth, reminderController.updateStatus);
router.delete('/:id', optionalAuth, requireAuth, reminderController.deleteReminder);
router.post('/clear-done', optionalAuth, requireAuth, requireOwnerOrManager, reminderController.clearDone);

export default router;
