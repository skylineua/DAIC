import { BrowserWindow, nativeImage, screen } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { characterLayout, type CharacterLayout } from './characterLayout';
import { characterConfig } from './characterConfig';
import { PositionService } from './PositionService';
import { SettingsService } from './SettingsService';

export class WindowService {
  private window: BrowserWindow | null = null;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private displayTimer?: ReturnType<typeof setTimeout>;
  private quitting = false;
  private ready = false;
  readonly layout: CharacterLayout;
  readonly image: Electron.NativeImage;
  onVisibilityChanged: () => void = () => {};
  onFatal: (error: unknown) => void = console.error;
  private readonly displayChanged = () => {
    clearTimeout(this.displayTimer);
    this.displayTimer = setTimeout(() => { this.ensureVisiblePosition(); this.flushPosition(); }, 250);
  };

  constructor(private readonly settings: SettingsService, private readonly positions: PositionService) {
    const imageFile = path.join(__dirname, '../assets', characterConfig.imageFile);
    this.image = nativeImage.createFromPath(imageFile);
    if (this.image.isEmpty()) throw new Error('Character PNG is missing or invalid');
    const size = this.image.getSize();
    this.layout = characterLayout(this.image.toBitmap(), size.width, size.height, characterConfig.visibleHeight, characterConfig.padding);
  }

  async create(): Promise<void> {
    if (this.window) return;
    const initial = this.positions.resolve(this.settings.load(), screen.getAllDisplays().map(d => d.workArea), screen.getPrimaryDisplay().workArea, this.layout);
    const win = this.window = new BrowserWindow({
      title: 'DAIC — Ї', ...initial, width: this.layout.width, height: this.layout.height,
      frame: false, transparent: true, backgroundColor: '#00000000', show: false,
      alwaysOnTop: true, skipTaskbar: true, resizable: false, maximizable: false,
      minimizable: false, fullscreenable: false, focusable: false, hasShadow: false,
      webPreferences: { preload: path.join(__dirname, '../preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    });
    win.setMenu(null);
    win.on('move', () => {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.flushPosition(), 250);
    });
    win.on('close', event => { if (!this.quitting) { event.preventDefault(); this.hide(); } });
    win.on('show', () => { win.webContents.send('daic:visibility', true); this.onVisibilityChanged(); });
    win.on('hide', () => { win.webContents.send('daic:visibility', false); this.onVisibilityChanged(); });
    win.on('closed', () => { this.window = null; if (!this.quitting) this.onFatal(new Error('Character window closed unexpectedly')); });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('render-process-gone', (_event, details) => { if (!this.quitting) this.onFatal(new Error('Renderer stopped: ' + details.reason)); });
    screen.on('display-added', this.displayChanged);
    screen.on('display-removed', this.displayChanged);
    screen.on('display-metrics-changed', this.displayChanged);
    const url = pathToFileURL(path.join(__dirname, '../renderer/index.html'));
    for (const key of ['imageWidth', 'imageHeight', 'left', 'top'] as const) url.searchParams.set(key, String(this.layout[key]));
    url.searchParams.set('imageFile', characterConfig.imageFile);
    await win.loadURL(url.toString());
    if (this.quitting || win.isDestroyed()) return;
    const imageLoaded = await win.webContents.executeJavaScript('document.querySelector("img").complete && document.querySelector("img").naturalWidth > 0');
    if (!imageLoaded) throw new Error('Character image failed to load');
    this.ready = true;
    this.show();
    this.flushPosition();
  }

  isVisible(): boolean { return this.window?.isVisible() ?? false; }
  show(): void {
    if (!this.ready) return; // create() shows the single window once loading is complete.
    this.ensureVisiblePosition();
    this.window?.showInactive();
  }
  hide(): void { this.flushPosition(); this.window?.hide(); }
  toggle(): void { if (this.isVisible()) this.hide(); else this.show(); }
  returnToPrimary(): void {
    if (!this.window) return;
    const p = this.positions.defaultPosition(screen.getPrimaryDisplay().workArea, this.layout);
    this.window.setPosition(p.x, p.y);
    this.flushPosition(); this.show();
  }
  ensureVisiblePosition(): void {
    const win = this.window; if (!win || win.isDestroyed()) return;
    const bounds = win.getBounds();
    const p = this.positions.resolve(bounds, screen.getAllDisplays().map(d => d.workArea), screen.getPrimaryDisplay().workArea, this.layout);
    if (p.x !== bounds.x || p.y !== bounds.y) win.setPosition(p.x, p.y);
  }
  flushPosition(): void {
    clearTimeout(this.saveTimer);
    if (this.window && !this.window.isDestroyed()) {
      const { x, y } = this.window.getBounds(); this.settings.save({ x, y });
    }
  }
  dispose(): void {
    this.quitting = true; this.flushPosition(); clearTimeout(this.displayTimer);
    screen.removeListener('display-added', this.displayChanged);
    screen.removeListener('display-removed', this.displayChanged);
    screen.removeListener('display-metrics-changed', this.displayChanged);
  }
}
