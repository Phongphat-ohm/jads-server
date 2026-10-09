import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import {
  getJudgePairs,
  createJudgePair,
  updateJudgePair,
  deleteJudgePair,
} from '../controllers/judgePair.controller';

const router = Router();

router.use(authenticateJWT);

router.get('/', getJudgePairs);
router.post('/', createJudgePair);
router.put('/:id', updateJudgePair);
router.delete('/:id', deleteJudgePair);

export default router;
