import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { optionalAuth, requireAuth, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/owners', optionalAuth, requireAuth, requireSuperAdmin, adminController.listOwners);
router.post('/owners', optionalAuth, requireAuth, requireSuperAdmin, adminController.createOwner);

export default router;
