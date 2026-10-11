import { Router } from 'express';
import authRoutes from './auth.routes';
import auditLogRoutes from './auditLog.routes';
import recentFileRoutes from './recentFile.routes';
import templateRoutes from './template.routes';
import judgePairRoutes from './judgePair.routes';
import paragraphTemplateRoutes from './paragraphTemplate.routes';
import cloudFileRoutes from './cloudFile.routes';
import downloadRoutes from './download.routes';
import feedbackRoutes from './feedback.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/recent-files', recentFileRoutes);
router.use('/judge-pairs', judgePairRoutes);
router.use('/paragraph-templates', paragraphTemplateRoutes);
router.use('/cloud-files', cloudFileRoutes);
router.use('/downloads', downloadRoutes);
router.use('/feedbacks', feedbackRoutes);
router.use('/admin', adminRoutes);

// Endpoint to reliably open URL in system default browser on the local machine
router.post('/open-browser', (req, res) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ success: false, message: 'Missing url parameter' });
    return;
  }

  try {
    const { exec } = require('child_process');
    // Windows cmd 'start "" "<url>"' reliably opens the machine's default browser
    exec(`cmd.exe /c start "" "${url.replace(/"/g, '')}"`);
    res.json({ success: true, message: 'Browser launched' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint to bring JADS Desktop window to foreground when auth succeeds
router.post('/focus-app', (req, res) => {
  try {
    const { exec } = require('child_process');
    // Multi-tier strategy on Windows to bypass foreground lock:
    // 1. SetForegroundWindow via AttachThreadInput
    // 2. WScript.Shell AppActivate
    // 3. SystemParametersInfo SPI_SETFOREGROUNDLOCKTIMEOUT
    const psScript = `
      $code = @'
      using System;
      using System.Runtime.InteropServices;
      public class Win32Focus {
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr ProcessId);
        [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
        [DllImport("user32.dll", SetLastError=true)] public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, IntPtr pvParam, uint fWinIni);
        
        public static void ForceForeground(IntPtr hWnd) {
          if (hWnd == IntPtr.Zero) return;
          IntPtr fgHwnd = GetForegroundWindow();
          uint fgThread = GetWindowThreadProcessId(fgHwnd, IntPtr.Zero);
          uint curThread = (uint)System.Threading.Thread.CurrentThread.ManagedThreadId;
          
          AttachThreadInput(curThread, fgThread, true);
          SystemParametersInfo(0x2001, 0, IntPtr.Zero, 0x0002 | 0x0001); // SPI_SETFOREGROUNDLOCKTIMEOUT = 0
          
          ShowWindow(hWnd, 9); // SW_RESTORE
          BringWindowToTop(hWnd);
          SetForegroundWindow(hWnd);
          
          AttachThreadInput(curThread, fgThread, false);
        }
      }
'@
      Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue;

      $procs = Get-Process -Name "jads", "jads-tauri", "jads-court" -ErrorAction SilentlyContinue;
      foreach ($p in $procs) {
        if ($p.MainWindowHandle -ne 0) {
          [Win32Focus]::ForceForeground($p.MainWindowHandle);
        }
      }

      $wshell = New-Object -ComObject WScript.Shell;
      $wshell.AppActivate("JADS - ระบบสร้างและจัดการเอกสารคดีความ");
      $wshell.AppActivate("JADS");
    `.replace(/\r?\n\s*/g, ' ');

    exec(`powershell -NoProfile -Command "${psScript}"`, () => {
      res.json({ success: true });
    });
  } catch {
    res.json({ success: false });
  }
});


router.use('/', templateRoutes);

export default router;
