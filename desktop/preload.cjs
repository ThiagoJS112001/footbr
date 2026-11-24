const { contextBridge, ipcRenderer } = require('electron');

function request(channel, ...args) {
  const result = ipcRenderer.sendSync(channel, ...args);
  if (!result?.ok) throw new Error('Não foi possível acessar o arquivo de save.');
  return result.value;
}

contextBridge.exposeInMainWorld('footbrDesktop', {
  readSave: (slot) => request('footbr:read-save', slot),
  writeSave: (slot, data) => request('footbr:write-save', slot, data),
});
