import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('daicVisibility', {
  subscribe(callback: (visible: boolean) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, visible: unknown) => {
      if (typeof visible === 'boolean') callback(visible);
    };
    ipcRenderer.on('daic:visibility', listener);
    return () => ipcRenderer.removeListener('daic:visibility', listener);
  },
});
