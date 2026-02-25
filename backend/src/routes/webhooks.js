import { Router } from 'express';
import * as webhookController from '../controllers/webhookController.js';

const router = Router();

router.post('/whatsapp', webhookController.whatsapp);

export default router;
