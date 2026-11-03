// Resto promo recorder — preload bridge (silent, no dialogs)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promoRec', {
  getSource: () => ipcRenderer.invoke('promo:get-source'),
  save: (name, dataB64) => ipcRenderer.send('promo:save', name, dataB64)
});
