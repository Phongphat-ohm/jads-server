import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import {
  getParagraphTemplates,
  createParagraphTemplate,
  updateParagraphTemplate,
  deleteParagraphTemplate,
} from '../controllers/paragraphTemplate.controller';

const router = Router();

router.use(authenticateJWT);

router.get('/', getParagraphTemplates);
router.post('/', createParagraphTemplate);
router.put('/:id', updateParagraphTemplate);
router.delete('/:id', deleteParagraphTemplate);

export default router;
