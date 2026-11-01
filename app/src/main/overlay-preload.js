'use strict';

// What a floating window she made (code.js overlays) may ask of the PC: its load, and to close or
// let clicks through. Nothing else of Node or of her reaches the page.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('capri', {
  // { cpu, ram, ramUsedGB, ramTotalGB, gpu, gpuTemp, vramUsedMB, vramTotalMB, gpuName } (gpu ones null without NVIDIA)
  stats: () => ipcRenderer.invoke('overlay:stats'),
  close: () => ipcRenderer.send('overlay:close'),
  clickThrough: (on) => ipcRenderer.send('overlay:through', Boolean(on)),
});
