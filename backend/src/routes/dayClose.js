import { Router } from 'express';
import * as dayCloseController from '../controllers/dayCloseController.js';
import { optionalAuth, requireAuth, requireSeniorWorkerOrOwner, requireOwner } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

const router = Router();

router.post('/', optionalAuth, requireAuth, requireSeniorWorkerOrOwner, dayCloseController.create);
router.get('/', optionalAuth, requireAuth, dayCloseController.getByDate);
router.patch('/:id', optionalAuth, requireAuth, requireOwner, dayCloseController.update);

router.get('/workers', optionalAuth, requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, display_name, role FROM "user" WHERE role = $1 AND (is_active IS NULL OR is_active = true) ORDER BY display_name`,
    ['worker']
  );
  return res.json(rows);
});

export default router;
