const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('api', {
  // Credential management
  loadCredentials: () => ipcRenderer.invoke('load-credentials'),
  saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),
  clearCredentials: () => ipcRenderer.invoke('clear-credentials'),

  // Authentication
  authenticate: (params) => ipcRenderer.invoke('authenticate', params),
  logout: () => ipcRenderer.invoke('logout'),

  // Ruckus API calls
  getVenues: (tenantId) => ipcRenderer.invoke('get-venues', tenantId),
  getFloorPlans: (params) => ipcRenderer.invoke('get-floor-plans', params),
  getFloorPlanImage: (params) => ipcRenderer.invoke('get-floor-plan-image', params),
  getAccessPoints: (params) => ipcRenderer.invoke('get-access-points', params),
  getSwitches: (params) => ipcRenderer.invoke('get-switches', params),
  queryApPoe: (params) => ipcRenderer.invoke('query-ap-poe', params),
  cancelApPoe: () => ipcRenderer.invoke('cancel-ap-poe'),
  onPoeProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('poe-progress', listener);
    return () => ipcRenderer.removeListener('poe-progress', listener);
  }
});
