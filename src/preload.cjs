const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('doseNote', {
  load: () => ipcRenderer.invoke('data:load'),
  add: input => ipcRenderer.invoke('medication:add', input),
  edit: (id, input) => ipcRenderer.invoke('medication:edit', id, input),
  remove: id => ipcRenderer.invoke('medication:remove', id),
  toggle: (id, dose) => ipcRenderer.invoke('dose:toggle', id, dose),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import')
});
