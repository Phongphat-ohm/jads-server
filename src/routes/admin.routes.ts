import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { feedbackController } from '../controllers/feedback.controller';
import { authenticateJWT, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Protect all admin routes: Requires authentication and ADMIN role
router.use(authenticateJWT, requireAdmin);

router.get('/stats', (req, res) => adminController.getDashboardStats(req, res));
router.get('/users', (req, res) => adminController.listUsers(req, res));
router.patch('/users/:id/role', (req, res) => adminController.updateUserRole(req, res));
router.post('/users/:id/reset-password', (req, res) => adminController.resetUserPassword(req, res));
router.delete('/users/:id', (req, res) => adminController.deleteUser(req, res));
router.get('/audit-logs', (req, res) => adminController.listAllAuditLogs(req, res));

// Admin Feedback management endpoints
router.get('/feedbacks', (req, res) => feedbackController.listAllFeedbacks(req, res));
router.get('/feedbacks/stats', (req, res) => feedbackController.getStats(req, res));
router.patch('/feedbacks/:id', (req, res) => feedbackController.updateFeedbackStatus(req, res));
router.delete('/feedbacks/:id', (req, res) => feedbackController.deleteFeedback(req, res));

export default router;
