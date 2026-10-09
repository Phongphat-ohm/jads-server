import { Router } from 'express';
import { recentFileController, addRecentFileSchema } from '../controllers/recentFile.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

const router = Router();

// All recent file routes require authentication
router.use(authenticateJWT);

router.get('/', (req, res, next) => recentFileController.list(req, res, next));
router.post('/', validateBody(addRecentFileSchema), (req, res, next) => recentFileController.add(req, res, next));
router.delete('/:id', (req, res, next) => recentFileController.remove(req, res, next));

export default router;
