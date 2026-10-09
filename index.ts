import { app } from './src/app';
import { env } from './src/config/env';

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 JADS Backend Server is running!`);
  console.log(`📍 Web Tester: http://localhost:${PORT}`);
  console.log(`⚡ Quick Test: http://localhost:${PORT}/api/test`);
  console.log(`🔐 Auth Endpoints: http://localhost:${PORT}/api/auth`);
  console.log(`📁 Recent Files: http://localhost:${PORT}/api/recent-files`);
  console.log(`📋 Audit Logs: http://localhost:${PORT}/api/audit-logs`);
  console.log(`📂 Templates Dir: ${env.TEMPLATES_DIR}`);
  console.log(`===============================================`);
});