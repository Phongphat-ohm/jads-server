import { Router } from 'express';
import multer from 'multer';
import { feedbackController } from '../controllers/feedback.controller';
import { authenticateJWT, optionalJWT, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

// Upload attachment (Public or Authenticated)
router.post('/upload', optionalJWT, upload.single('file'), (req, res) => feedbackController.uploadAttachment(req, res));

// View/Download attachment
router.get('/attachments/:key', (req, res) => feedbackController.downloadAttachment(req, res));

// Submit feedback (User or Guest with optional JWT)
router.post('/', optionalJWT, (req, res) => feedbackController.createFeedback(req, res));

// Get user's own feedback history
router.get('/my', authenticateJWT, (req, res) => feedbackController.getMyFeedbacks(req, res));

// Admin routes
router.get('/stats', authenticateJWT, requireAdmin, (req, res) => feedbackController.getStats(req, res));
router.get('/', authenticateJWT, requireAdmin, (req, res) => feedbackController.listAllFeedbacks(req, res));
router.patch('/:id', authenticateJWT, requireAdmin, (req, res) => feedbackController.updateFeedbackStatus(req, res));
router.delete('/:id', authenticateJWT, requireAdmin, (req, res) => feedbackController.deleteFeedback(req, res));

export default router;
