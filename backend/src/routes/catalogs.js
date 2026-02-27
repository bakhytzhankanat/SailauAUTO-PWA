import { Router } from 'express';
import * as catalogController from '../controllers/catalogController.js';
import { optionalAuth, requireAuth, requireService, requireOwner } from '../middleware/auth.js';

const router = Router();

router.get('/vehicle-catalog', optionalAuth, requireAuth, requireService, catalogController.getVehicleCatalog);
router.get('/service-catalog', optionalAuth, requireAuth, requireService, catalogController.getServiceCatalog);
router.get('/service-categories', optionalAuth, requireAuth, requireService, catalogController.getServiceCategories);
router.get('/service-categories-with-services', optionalAuth, requireAuth, requireService, catalogController.getCategoriesWithServices);
router.post('/service-catalog', optionalAuth, requireAuth, requireService, requireOwner, catalogController.createService);
router.delete('/service-catalog/:id', optionalAuth, requireAuth, requireService, requireOwner, catalogController.deleteService);

export default router;
