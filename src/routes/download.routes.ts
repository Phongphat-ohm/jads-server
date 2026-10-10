import { Router } from 'express';
import { downloadController } from '../controllers/download.controller';

const router = Router();

// Public routes for desktop application downloads
router.get('/info', downloadController.getInfo);
router.get('/latest', downloadController.downloadLatest);
router.get('/:version/:filename', downloadController.downloadByVersion);

export default router;
