import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import squirrelStartup from 'electron-squirrel-startup';
import { SettingsService } from './SettingsService';
import { PositionService } from './PositionService';
import { WindowService } from './WindowService';
import { TrayService } from './TrayService';
import { characterConfig } from './characterConfig';

app.setName('DAIC');
const dataDir = path.join(app.getPath('appData'), 'DAIC');
function report(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[DAIC]', message);
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const log = path.join(dataDir, 'daic.log');
    if (fs.existsSync(log) && fs.statSync(log).size > 65536) fs.writeFileSync(log, '');
    fs.appendFileSync(log, new Date().toISOString() + ' ' + message + '\n');
  } catch { /* Logging must never prevent exit or persistence fallback. */ }
}

let windowService: WindowService | undefined;
let trayService: TrayService | undefined;
let shuttingDown = false;
function quit(): void {
  if (shuttingDown) return;
  shuttingDown = true; windowService?.dispose(); trayService?.dispose(); app.quit();
}
function fatal(error: unknown): void { report(error); quit(); }

if (squirrelStartup) {
  app.quit();
} else {
  try { fs.mkdirSync(dataDir, { recursive: true }); app.setPath('userData', dataDir); } catch (error) { report(error); }
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    // Also handles a second launch while ready/create is still pending: initial create always shows.
    app.on('second-instance', () => windowService?.show());
    app.setAppUserModelId('com.squirrel.DAIC.DAIC');
    app.on('before-quit', () => {
      if (!shuttingDown) { shuttingDown = true; windowService?.dispose(); trayService?.dispose(); }
    });
    app.on('window-all-closed', () => { if (!shuttingDown) quit(); });
    app.whenReady().then(async () => {
      if (shuttingDown) return;
      const settings = new SettingsService(path.join(dataDir, 'settings.json'), report);
      windowService = new WindowService(settings, new PositionService(characterConfig.edgeMargin));
      windowService.onFatal = fatal;
      trayService = new TrayService(windowService.image, windowService, quit);
      windowService.onVisibilityChanged = () => trayService?.refresh();
      await windowService.create();
    }).catch(fatal);
  }
}
