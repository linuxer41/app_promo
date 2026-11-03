// Puente del recorder: la página pide el id de su propia ventana y devuelve el .webm.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("promoRec", {
  getSource: () => ipcRenderer.invoke("promo:get-source"),
  save: (name, dataB64) => ipcRenderer.send("promo:save", name, dataB64)
});
