import { Router } from 'express';
import multer from 'multer';
import { authenticateJWT } from '../middlewares/auth.middleware';
import {
  getCloudFiles,
  uploadCloudFile,
  downloadCloudFile,
  deleteCloudFile,
} from '../controllers/cloudFile.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
});

router.use(authenticateJWT);

router.get('/', getCloudFiles);
router.post('/upload', upload.single('file'), uploadCloudFile);
router.get('/:id/download', downloadCloudFile);
router.delete('/:id', deleteCloudFile);

export default router;
