import { Router } from 'express';
import { optionalAuth, requireAuth, requireService, requireSeniorWorkerOrOwner } from '../middleware/auth.js';
import * as analyticsController from '../controllers/analyticsController.js';

const router = Router();

router.get(
  '/summary',
  optionalAuth,
  requireAuth,
  requireService,
  requireSeniorWorkerOrOwner,
  analyticsController.getSummary
);

export default router;
