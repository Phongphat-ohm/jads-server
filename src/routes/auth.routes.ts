import { Router } from 'express';
import {
  authController,
  registerSchema,
  loginSchema,
  oauthSyncSchema,
  completeProfileSchema,
  requestBindEmailSchema,
  confirmBindEmailSchema,
  forgotPasswordSchema,
  resetPasswordWithOtpSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../controllers/auth.controller';
import { authenticateJWT, optionalJWT } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

const router = Router();

// Local Registration & Login
router.post('/register', validateBody(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post('/login', validateBody(loginSchema), (req, res, next) => authController.login(req, res, next));

// OAuth NextAuth Sync & Onboarding
router.post('/oauth/sync', validateBody(oauthSyncSchema), (req, res, next) => authController.oauthSync(req, res, next));
router.post('/complete-profile', authenticateJWT, validateBody(completeProfileSchema), (req, res, next) => authController.completeProfile(req, res, next));
router.delete('/onboarding/cancel', authenticateJWT, (req, res, next) => authController.cancelOnboarding(req, res, next));

// Email Binding & Verification via OTP
router.post('/email/request-bind', authenticateJWT, validateBody(requestBindEmailSchema), (req, res, next) => authController.requestBindEmail(req, res, next));
router.post('/email/confirm-bind', authenticateJWT, validateBody(confirmBindEmailSchema), (req, res, next) => authController.confirmBindEmail(req, res, next));

// Forgot & Reset Password via OTP
router.post('/forgot-password', validateBody(forgotPasswordSchema), (req, res, next) => authController.forgotPassword(req, res, next));
router.post('/reset-password', validateBody(resetPasswordWithOtpSchema), (req, res, next) => authController.resetPassword(req, res, next));

// Profile & Password Management
router.get('/me', authenticateJWT, (req, res, next) => authController.me(req, res, next));
router.put('/profile', authenticateJWT, validateBody(updateProfileSchema), (req, res, next) => authController.updateProfile(req, res, next));
router.put('/change-password', authenticateJWT, validateBody(changePasswordSchema), (req, res, next) => authController.changePassword(req, res, next));
router.post('/logout', optionalJWT, (req, res, next) => authController.logout(req, res, next));

export default router;
