import { Menu, Tray, type NativeImage } from 'electron';
import type { WindowService } from './WindowService';

export class TrayService {
  private readonly tray: Tray;
  constructor(image: NativeImage, private readonly window: WindowService, private readonly quit: () => void) {
    const bounds = window.layout.alphaBounds;
    this.tray = new Tray(image.crop(bounds).resize({ width: 18, height: 32 }));
    this.tray.setToolTip('DAIC — Ї');
    this.refresh();
  }
  refresh(): void {
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: this.window.isVisible() ? 'Приховати Ї' : 'Показати Ї', click: () => this.window.toggle() },
      { label: 'Повернути на основний екран', click: () => this.window.returnToPrimary() },
      { type: 'separator' },
      { label: 'Вийти', click: this.quit },
    ]));
  }
  dispose(): void { this.tray.destroy(); }
}
