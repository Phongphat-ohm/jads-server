import { Router } from 'express';
import authRoutes from './auth.routes';
import auditLogRoutes from './auditLog.routes';
import recentFileRoutes from './recentFile.routes';
import templateRoutes from './template.routes';
import judgePairRoutes from './judgePair.routes';
import paragraphTemplateRoutes from './paragraphTemplate.routes';
import cloudFileRoutes from './cloudFile.routes';
import downloadRoutes from './download.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/recent-files', recentFileRoutes);
router.use('/judge-pairs', judgePairRoutes);
router.use('/paragraph-templates', paragraphTemplateRoutes);
router.use('/cloud-files', cloudFileRoutes);
router.use('/downloads', downloadRoutes);
router.use('/', templateRoutes);

export default router;
