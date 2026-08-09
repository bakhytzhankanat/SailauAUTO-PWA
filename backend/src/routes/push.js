import { Router } from 'express';
import * as pushController from '../controllers/pushController.js';
import { optionalAuth, requireAuth, requireService } from '../middleware/auth.js';

const router = Router();

router.get('/public-key', pushController.getPublicKey);
router.get('/status', optionalAuth, requireAuth, requireService, pushController.status);
router.post('/subscribe', optionalAuth, requireAuth, requireService, pushController.subscribe);
router.delete('/unsubscribe', optionalAuth, requireAuth, requireService, pushController.unsubscribe);
router.post('/test', optionalAuth, requireAuth, requireService, pushController.sendTest);
router.get('/preferences', optionalAuth, requireAuth, requireService, pushController.preferences);
router.patch('/preferences', optionalAuth, requireAuth, requireService, pushController.updatePreferences);

export default router;
