'use strict';

// "Character & theme" (renderer/editor.html): what its page may ask of main.js.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('editor', {
  list: () => ipcRenderer.invoke('chars:list'),
  save: (character) => ipcRenderer.invoke('chars:save', character),
  remove: (id) => ipcRenderer.invoke('chars:remove', id),
  use: (id) => ipcRenderer.invoke('chars:use', id),
  theme: (theme) => ipcRenderer.invoke('chars:theme', theme),
  pick: () => ipcRenderer.invoke('chars:pick'),
  perform: (act) => ipcRenderer.invoke('chars:perform', act),
});
