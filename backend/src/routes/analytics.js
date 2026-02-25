import { Router } from 'express';
import { optionalAuth, requireAuth, requireOwner } from '../middleware/auth.js';
import * as analyticsController from '../controllers/analyticsController.js';

const router = Router();

router.get(
  '/summary',
  optionalAuth,
  requireAuth,
  requireOwner,
  analyticsController.getSummary
);

export default router;
