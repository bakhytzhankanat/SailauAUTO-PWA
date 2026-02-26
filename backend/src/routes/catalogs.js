import { Router } from 'express';
import * as catalogController from '../controllers/catalogController.js';
import { optionalAuth, requireAuth, requireService } from '../middleware/auth.js';

const router = Router();

router.get('/vehicle-catalog', optionalAuth, requireAuth, requireService, catalogController.getVehicleCatalog);
router.get('/service-catalog', optionalAuth, requireAuth, requireService, catalogController.getServiceCatalog);
router.get('/service-categories', optionalAuth, requireAuth, requireService, catalogController.getServiceCategories);
router.get('/service-categories-with-services', optionalAuth, requireAuth, requireService, catalogController.getCategoriesWithServices);

export default router;
