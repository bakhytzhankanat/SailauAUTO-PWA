import { Router } from 'express';
import * as dayCloseController from '../controllers/dayCloseController.js';
import { optionalAuth, requireAuth, requireService, requireSeniorWorkerOrOwner, requireOwner } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

const router = Router();

router.post('/', optionalAuth, requireAuth, requireService, requireSeniorWorkerOrOwner, dayCloseController.create);
router.get('/', optionalAuth, requireAuth, requireService, dayCloseController.getByDate);
router.patch('/:id', optionalAuth, requireAuth, requireService, requireOwner, dayCloseController.update);
router.delete('/:id', optionalAuth, requireAuth, requireService, requireOwner, dayCloseController.remove);

router.get('/workers', optionalAuth, requireAuth, requireService, async (req, res) => {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const { rows } = await pool.query(
    `SELECT id, display_name, role FROM "user" WHERE service_id = $1 AND role = $2 AND (is_active IS NULL OR is_active = true) ORDER BY display_name`,
    [serviceId, 'worker']
  );
  return res.json(rows);
});

export default router;
