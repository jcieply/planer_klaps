const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('klapsDesktop', {
  platform: process.platform,
  pdfjsBase: 'klaps://app/vendor/pdfjs/',
  store: {
    list: () => ipcRenderer.invoke('store:list'),
    save: (id, meta, plan, script, media) => ipcRenderer.invoke('store:save', id, meta, plan, script, media),
    load: (id) => ipcRenderer.invoke('store:load', id),
    remove: (id) => ipcRenderer.invoke('store:remove', id)
  },
  saveFile: (name, data) => ipcRenderer.invoke('file:save', name, data),
  onMenu: (fn) => { ipcRenderer.on('menu', (_e, a) => fn(a)); }
});
