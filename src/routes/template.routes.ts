import { Router } from 'express';
import { templateController } from '../controllers/template.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

// Require authentication for all template and document generation endpoints
router.use(authenticateJWT);

router.get('/capabilities', (req, res) => templateController.getCapabilities(req, res));
router.get('/templates', (req, res) => templateController.getTemplates(req, res));
router.post('/generate', (req, res) => templateController.generate(req, res));
router.post('/fill-template', (req, res) => templateController.generate(req, res));
router.get('/test', (req, res) => templateController.test(req, res));

export default router;
