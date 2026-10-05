const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const model = require('./model.cjs');
const { Store } = require('./store.cjs');

app.setName('DoseNote');
app.setPath('userData', path.join(app.getPath('appData'), 'DoseNote'));
if (process.env.DOSENOTE_TEST_DATA && !app.isPackaged) app.setPath('userData', process.env.DOSENOTE_TEST_DATA);
const acquiredLock = app.requestSingleInstanceLock();
if (!acquiredLock) app.quit();
let window;
let store;
let loadError;
const page = pathToFileURL(path.join(__dirname, 'index.html')).href;

function handle(channel, operation) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.senderFrame.url !== page) throw new Error('Untrusted caller.');
    try {
      if (loadError) throw loadError;
      return { ok: true, value: await operation(...args) };
    } catch (error) { return { ok: false, error: error.message }; }
  });
}

function createWindow() {
  window = new BrowserWindow({ width: 1080, height: 810, minWidth: 760, minHeight: 620, backgroundColor: '#f6f7f3', title: 'DoseNote', icon: path.join(__dirname, 'icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== page) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.loadFile(path.join(__dirname, 'index.html'));
}

app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
if (acquiredLock) app.whenReady().then(() => {
  store = new Store(path.join(app.getPath('userData'), 'medications.json'));
  try { store.load(); } catch (error) { loadError = error; }
  handle('data:load', () => store.state);
  handle('medication:add', input => store.save(model.addMedication(store.state, input)));
  handle('medication:edit', (id, input) => store.save(model.editMedication(store.state, id, input)));
  handle('medication:remove', id => store.save(model.removeMedication(store.state, id)));
  handle('dose:toggle', (id, dose) => store.save(model.toggleDose(store.state, id, dose)));
  handle('backup:export', async () => {
    const result = await dialog.showSaveDialog(window, { title: 'Save a DoseNote backup', defaultPath: `DoseNote-backup-${model.dayKey()}.json`, filters: [{ name: 'DoseNote backup', extensions: ['json'] }] });
    if (result.canceled) return false;
    fs.writeFileSync(result.filePath, JSON.stringify(store.state, null, 2), { mode: 0o600 });
    return true;
  });
  handle('backup:import', async () => {
    const result = await dialog.showOpenDialog(window, { title: 'Restore a DoseNote backup', filters: [{ name: 'DoseNote backup', extensions: ['json'] }], properties: ['openFile'] });
    if (result.canceled) return null;
    if (fs.statSync(result.filePaths[0]).size > 10 * 1024 * 1024) throw new Error('Backup is too large (maximum 10 MB).');
    const restored = model.validateState(JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')));
    const confirmation = await dialog.showMessageBox(window, { type: 'question', title: 'Replace your current data?', message: 'Restore this backup?', detail: 'This replaces all current medications and history. Save a backup first if you want to keep them.', buttons: ['Cancel', 'Restore backup'], defaultId: 0, cancelId: 0 });
    if (confirmation.response !== 1) return null;
    return store.save(restored);
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ label: 'DoseNote', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] }
  ]));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
