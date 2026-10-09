import { Router } from 'express';
import { auditLogController } from '../controllers/auditLog.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticateJWT, (req, res, next) => auditLogController.list(req, res, next));

export default router;
