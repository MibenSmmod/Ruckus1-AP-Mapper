const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const RuckusAPI = require('./src/api/ruckus');
const { checkForUpdates } = require('./src/updater');

const APP_DISPLAY_NAME = 'Ruckus One AP Mapper';

let mainWindow;
let ruckusClient = null;
let poeQueryCancelled = false;

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const checkUpdatesItem = {
    label: 'Check for Updates…',
    click: () => {
      checkForUpdates().catch((error) => {
        console.error('[updater] Menu check failed:', error);
      });
    }
  };

  const template = [
    ...(isMac
      ? [{
          label: APP_DISPLAY_NAME,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            checkUpdatesItem,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    {
      label: 'File',
      submenu: [
        ...(!isMac ? [checkUpdatesItem, { type: 'separator' }] : []),
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }]
              }
            ]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }]
          : [{ role: 'close' }])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'GitHub Releases',
          click: async () => {
            await shell.openExternal('https://github.com/MibenSmmod/Ruckus1-AP-Mapper/releases');
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Dev-only PNG; packaged macOS apps use the .icns from the app bundle.
function getDevIconPath() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  return fs.existsSync(iconPath) ? iconPath : null;
}

function createWindow() {
  const icon = getDevIconPath();
  const options = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Ruckus One AP Mapper'
  };
  if (icon) {
    options.icon = icon;
  }

  mainWindow = new BrowserWindow(options);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.loadFile('src/index.html');

  // Open external links in the system browser instead of navigating the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.setName(APP_DISPLAY_NAME);
  }

  app.setAboutPanelOptions({
    applicationName: APP_DISPLAY_NAME,
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: 'Unofficial community tool — not affiliated with Belden Inc. or Ruckus.'
  });

  const icon = getDevIconPath();
  if (process.platform === 'darwin' && app.dock && icon) {
    try {
      app.dock.setIcon(icon);
    } catch (error) {
      console.error('Failed to set dock icon:', error);
    }
  }

  createApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Config file path
const configPath = path.join(app.getPath('userData'), 'config.json');

// IPC Handlers

ipcMain.handle('get-app-version', async () => app.getVersion());

// Load saved credentials
ipcMain.handle('load-credentials', async () => {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading credentials:', error);
  }
  return null;
});

// Save credentials
ipcMain.handle('save-credentials', async (event, credentials) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(credentials, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving credentials:', error);
    return false;
  }
});

// Clear saved credentials
ipcMain.handle('clear-credentials', async () => {
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    return true;
  } catch (error) {
    console.error('Error clearing credentials:', error);
    return false;
  }
});

// Authenticate with Ruckus ONE
ipcMain.handle('authenticate', async (event, { tenantId, clientId, clientSecret, region }) => {
  try {
    ruckusClient = new RuckusAPI(region);
    await ruckusClient.authenticate(tenantId, clientId, clientSecret);
    return { success: true };
  } catch (error) {
    ruckusClient = null;
    return { success: false, error: error.message };
  }
});

// Get venues
ipcMain.handle('get-venues', async (event, tenantId) => {
  try {
    if (!ruckusClient) {
      throw new Error('Not authenticated');
    }
    const venues = await ruckusClient.getVenues(tenantId);
    return { success: true, data: venues };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get floor plans for a venue
ipcMain.handle('get-floor-plans', async (event, { tenantId, venueId }) => {
  try {
    if (!ruckusClient) {
      throw new Error('Not authenticated');
    }
    const floorPlans = await ruckusClient.getVenueFloorPlans(tenantId, venueId);
    return { success: true, data: floorPlans };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get floor plan image
ipcMain.handle('get-floor-plan-image', async (event, { tenantId, venueId, floorPlanId, imageId }) => {
  try {
    if (!ruckusClient) {
      throw new Error('Not authenticated');
    }
    const imageData = await ruckusClient.getFloorPlanImage(tenantId, venueId, floorPlanId, imageId);
    return { success: true, data: imageData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get access points for a venue
ipcMain.handle('get-access-points', async (event, { tenantId, venueId }) => {
  try {
    if (!ruckusClient) {
      throw new Error('Not authenticated');
    }
    const accessPoints = await ruckusClient.getAccessPoints(tenantId, venueId);

    // Live dBm from the same query the RUCKUS One floor-plan popup uses.
    try {
      const radioRows = await ruckusClient.queryApRadioStatuses(venueId);
      RuckusAPI.applyRadioStatuses(accessPoints, radioRows);
      const withPower = accessPoints.filter((ap) => {
        const radio = ap.radio || {};
        return ['apRadioParams24G', 'apRadioParams50G', 'apRadioParams6G']
          .some((key) => radio[key] && radio[key].actualTxPower > 0);
      }).length;
      const withAfc = accessPoints.filter((ap) => ap.afcPowerState).length;
      console.log(`Radio TX power from /venues/aps/query: ${withPower} of ${accessPoints.length} APs`);
      console.log(`AFC power state from /venues/aps/query: ${withAfc} of ${accessPoints.length} APs`);
    } catch (error) {
      console.warn('[TX] Radio status query failed:', error.message);
    }

    return { success: true, data: accessPoints };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get switches for a venue (floor-plan placement and status)
ipcMain.handle('get-switches', async (event, { venueId }) => {
  try {
    if (!ruckusClient) {
      throw new Error('Not authenticated');
    }
    const switches = await ruckusClient.getSwitches(venueId);
    return { success: true, data: switches };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

function sendPoeProgress(info) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('poe-progress', info);
  }
}

// PoE from RUCKUS One: AP LLDP neighbors plus the matched switch port.
ipcMain.handle('query-ap-poe', async (event, { venueId, aps }) => {
  try {
    if (!ruckusClient) {
      throw new Error('Not authenticated');
    }
    poeQueryCancelled = false;
    const data = await ruckusClient.queryApPoe(venueId, aps, {
      onProgress: sendPoeProgress,
      shouldCancel: () => poeQueryCancelled
    });
    return { success: true, data, cancelled: poeQueryCancelled };
  } catch (error) {
    console.error('[PoE] Query failed:', error.message);
    return { success: false, error: error.message, cancelled: poeQueryCancelled };
  }
});

ipcMain.handle('cancel-ap-poe', async () => {
  poeQueryCancelled = true;
  return { success: true };
});

// Logout
ipcMain.handle('logout', async () => {
  ruckusClient = null;
  return { success: true };
});
