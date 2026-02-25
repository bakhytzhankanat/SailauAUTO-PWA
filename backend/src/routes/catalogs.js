import { Router } from 'express';
import * as catalogController from '../controllers/catalogController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/vehicle-catalog', optionalAuth, requireAuth, catalogController.getVehicleCatalog);
router.get('/service-catalog', optionalAuth, requireAuth, catalogController.getServiceCatalog);
router.get('/service-categories', optionalAuth, requireAuth, catalogController.getServiceCategories);
router.get('/service-categories-with-services', optionalAuth, requireAuth, catalogController.getCategoriesWithServices);

export default router;
