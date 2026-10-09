import { Router } from 'express';
import {
  authController,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../controllers/auth.controller';
import { authenticateJWT, optionalJWT } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

const router = Router();

router.post('/register', validateBody(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post('/login', validateBody(loginSchema), (req, res, next) => authController.login(req, res, next));
router.get('/me', authenticateJWT, (req, res, next) => authController.me(req, res, next));
router.put('/profile', authenticateJWT, validateBody(updateProfileSchema), (req, res, next) => authController.updateProfile(req, res, next));
router.put('/change-password', authenticateJWT, validateBody(changePasswordSchema), (req, res, next) => authController.changePassword(req, res, next));
router.post('/logout', optionalJWT, (req, res, next) => authController.logout(req, res, next));

export default router;
