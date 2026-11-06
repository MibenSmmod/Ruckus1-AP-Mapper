const { app, BrowserWindow, ipcMain, shell, Menu, safeStorage, dialog, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const RuckusAPI = require('./src/api/ruckus');
const { checkForUpdates } = require('./src/updater');
const { createPdfFromJpeg, paperForCountry } = require('./src/exportPdf');

const APP_DISPLAY_NAME = 'RUCKUS One Device Mapper';
const CONFIG_VERSION_ENCRYPTED = 2;

let mainWindow;
let ruckusClient = null;
// Per-run cancel tokens: starting a run never clears another run's cancel.
// Cancel stops every active run of that kind.
const activePoeRuns = new Set();
const activeGlobalSearchRuns = new Set();

function cancelRuns(runs) {
  for (const run of runs) run.cancelled = true;
}
let darkModeEnabled = true; // matches renderer default; synced from renderer on load

const GLOBAL_SEARCH_SWITCH_CONCURRENCY = 4;
const GLOBAL_SEARCH_FLOOR_CONCURRENCY = 4;

function sendGlobalSearchProgress(info) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('global-search-progress', info);
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return [];
  const results = new Array(list.length);
  let next = 0;
  const runnerCount = Math.min(Math.max(1, concurrency), list.length);
  await Promise.all(Array.from({ length: runnerCount }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= list.length) return;
      results[index] = await worker(list[index], index);
    }
  }));
  return results;
}

function setDarkModeEnabled(dark) {
  darkModeEnabled = !!dark;
  nativeTheme.themeSource = darkModeEnabled ? 'dark' : 'light';
}

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
        {
          label: 'Export Map as PNG…',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('export-map-request', 'png');
            }
          }
        },
        {
          label: 'Export Map as PDF…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('export-map-request', 'pdf');
            }
          }
        },
        { type: 'separator' },
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
        {
          label: 'Dark Mode',
          type: 'checkbox',
          checked: darkModeEnabled,
          click: (menuItem) => {
            setDarkModeEnabled(menuItem.checked);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('set-dark-mode', darkModeEnabled);
            }
          }
        },
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
          label: 'Getting Started',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('show-getting-started');
            }
          }
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('show-keyboard-shortcuts');
            }
          }
        },
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
    title: 'RUCKUS One Device Mapper'
  };
  if (icon) {
    options.icon = icon;
  }

  mainWindow = new BrowserWindow(options);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();

    // FR#14: silent launch check — prompt only if a newer release exists.
    // Two attempts with timeouts; failures are logged and ignored so startup never hangs.
    setTimeout(() => {
      checkForUpdates({ silent: true, retries: 2 }).catch((error) => {
        console.error('[updater] Startup check failed:', error);
      });
    }, 2000);
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
    copyright: 'Unofficial community tool — not affiliated with Belden Inc. or RUCKUS.'
  });

  const icon = getDevIconPath();
  if (process.platform === 'darwin' && app.dock && icon) {
    try {
      app.dock.setIcon(icon);
    } catch (error) {
      console.error('Failed to set dock icon:', error);
    }
  }

  setDarkModeEnabled(darkModeEnabled);
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

// Config file path — credentials are encrypted at rest via Electron safeStorage
// (macOS Keychain / Windows DPAPI). Never store Tenant ID, Client ID, or Client Secret in plaintext.
const configPath = path.join(app.getPath('userData'), 'config.json');

function assertSafeStorageAvailable() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS credential encryption is unavailable. Credentials cannot be saved securely on this system.'
    );
  }
}

function encryptCredentials(credentials) {
  assertSafeStorageAvailable();
  const secretPayload = JSON.stringify({
    tenantId: credentials.tenantId || '',
    clientId: credentials.clientId || '',
    clientSecret: credentials.clientSecret || ''
  });
  const encrypted = safeStorage.encryptString(secretPayload);
  return {
    version: CONFIG_VERSION_ENCRYPTED,
    region: credentials.region || 'na',
    encryptedPayload: encrypted.toString('base64')
  };
}

function decryptCredentials(stored) {
  assertSafeStorageAvailable();
  if (!stored || typeof stored.encryptedPayload !== 'string') {
    throw new Error('Encrypted credentials are missing or invalid.');
  }
  const decrypted = safeStorage.decryptString(Buffer.from(stored.encryptedPayload, 'base64'));
  const secrets = JSON.parse(decrypted);
  return {
    region: stored.region || 'na',
    tenantId: secrets.tenantId || '',
    clientId: secrets.clientId || '',
    clientSecret: secrets.clientSecret || ''
  };
}

function isPlaintextCredentials(stored) {
  return Boolean(
    stored
    && typeof stored === 'object'
    && stored.version !== CONFIG_VERSION_ENCRYPTED
    && (stored.tenantId || stored.clientId || stored.clientSecret)
  );
}

function writeEncryptedCredentials(credentials) {
  const encryptedConfig = encryptCredentials(credentials);
  // Owner-only: the payload is Keychain/DPAPI-bound, but keep it unreadable to other users too.
  fs.writeFileSync(configPath, JSON.stringify(encryptedConfig, null, 2), { mode: 0o600 });
  fs.chmodSync(configPath, 0o600);
}

function loadStoredCredentials() {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const stored = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  // Legacy plaintext config: migrate to OS-encrypted storage on first read
  if (isPlaintextCredentials(stored)) {
    const credentials = {
      region: stored.region || 'na',
      tenantId: stored.tenantId || '',
      clientId: stored.clientId || '',
      clientSecret: stored.clientSecret || ''
    };
    try {
      writeEncryptedCredentials(credentials);
    } catch (migrateError) {
      console.error('Error migrating plaintext credentials to encrypted storage:', migrateError);
      // Still return credentials so the user can sign in; next successful save will encrypt.
    }
    return credentials;
  }

  if (stored && stored.version === CONFIG_VERSION_ENCRYPTED) {
    return decryptCredentials(stored);
  }

  return null;
}

// IPC Handlers

ipcMain.handle('get-app-version', async () => app.getVersion());

// Keep View → Dark Mode checkbox in sync with the in-app settings toggle
ipcMain.on('theme-changed', (event, dark) => {
  setDarkModeEnabled(dark);
  createApplicationMenu();
});


// Save exported map (PNG bytes or JPEG→PDF) via native save dialog
ipcMain.handle('export-map', async (event, { dataBase64, format, defaultName, width, height }) => {
  try {
    const isPdf = format === 'pdf';
    const result = await dialog.showSaveDialog(mainWindow || undefined, {
      title: isPdf ? 'Export Map as PDF' : 'Export Map as PNG',
      defaultPath: defaultName || (isPdf ? 'floor-plan.pdf' : 'floor-plan.png'),
      filters: isPdf
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : [{ name: 'PNG Image', extensions: ['png'] }]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const binary = Buffer.from(dataBase64, 'base64');
    if (isPdf) {
      const paper = paperForCountry(app.getLocaleCountryCode());
      const pdf = createPdfFromJpeg(binary, width, height, { paper });
      fs.writeFileSync(result.filePath, pdf);
    } else {
      fs.writeFileSync(result.filePath, binary);
    }

    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    console.error('Error exporting map:', error);
    return { canceled: false, error: error.message || String(error) };
  }
});

ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  if (filePath) {
    shell.showItemInFolder(filePath);
  }
});

// Load saved credentials (decrypts OS-protected payload; migrates legacy plaintext)
ipcMain.handle('load-credentials', async () => {
  try {
    return loadStoredCredentials();
  } catch (error) {
    console.error('Error loading credentials:', error);
  }
  return null;
});

// Save credentials encrypted with the OS user store (Keychain / DPAPI)
ipcMain.handle('save-credentials', async (event, credentials) => {
  try {
    writeEncryptedCredentials(credentials);
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

// Authenticate with RUCKUS ONE
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

    // Live dBm / AFC / clientCount from the same query the RUCKUS One UI uses.
    try {
      const radioRows = await ruckusClient.queryApRadioStatuses(venueId);
      RuckusAPI.applyRadioStatuses(accessPoints, radioRows);
    } catch (error) {
      console.warn('[TX] Radio status query failed:', error.message);
    }

    // Per-band client density (read-only; soft-fail so floor still loads).
    try {
      const clientRows = await ruckusClient.queryApClients(venueId);
      RuckusAPI.applyClientBandCounts(accessPoints, clientRows);
    } catch (error) {
      console.warn('[Clients] AP clients query failed:', error.message);
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
  let run = null;
  try {
    if (!ruckusClient) {
      throw new Error('Not authenticated');
    }
    run = { cancelled: false };
    activePoeRuns.add(run);
    const data = await ruckusClient.queryApPoe(venueId, aps, {
      onProgress: sendPoeProgress,
      shouldCancel: () => run.cancelled
    });
    const labelCount = Object.keys((data && data.labels) || {}).length;
    const sent = Array.isArray(aps) ? aps.length : 0;
    console.log(`[PoE] ${run.cancelled ? 'Cancelled' : 'Done'}: ${labelCount} of ${sent} AP${sent === 1 ? '' : 's'} labeled`);
    return { success: true, data, cancelled: run.cancelled };
  } catch (error) {
    console.error('[PoE] Query failed:', error.message);
    return { success: false, error: error.message, cancelled: !!(run && run.cancelled) };
  } finally {
    if (run) activePoeRuns.delete(run);
  }
});

ipcMain.handle('cancel-ap-poe', async () => {
  cancelRuns(activePoeRuns);
  return { success: true };
});

// FR#18: update AP or switch floor-plan coordinates (allowlisted PUTs only).
// Payload is typed — never accepts raw HTTP method/path from the renderer.
ipcMain.handle('update-device-position', async (event, params = {}) => {
  try {
    if (!ruckusClient) {
      throw new Error('Not authenticated');
    }
    const { type, venueId, floorPlanId, deviceId, xPercent, yPercent } = params;
    if (type !== 'ap' && type !== 'switch') {
      throw new Error('type must be "ap" or "switch"');
    }
    if (!venueId || !floorPlanId || !deviceId) {
      throw new Error('venueId, floorPlanId, and deviceId are required');
    }
    if (type === 'ap') {
      await ruckusClient.updateApFloorPosition({
        venueId,
        floorPlanId,
        serialNumber: deviceId,
        xPercent,
        yPercent
      });
    } else {
      await ruckusClient.updateSwitchPosition({
        venueId,
        switchId: deviceId,
        floorPlanId,
        xPercent,
        yPercent
      });
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      statusCode: error.statusCode || null
    };
  }
});

// FR#17: lean tenant device index for Global Search (no radio/clients/PoE)
ipcMain.handle('build-global-search-index', async (event, { tenantId, venues }) => {
  let run = null;
  try {
    if (!ruckusClient) {
      throw new Error('Not authenticated');
    }
    // Keep this run's client: logout sets ruckusClient to null while
    // requests may still be in flight.
    const client = ruckusClient;
    run = { cancelled: false };
    activeGlobalSearchRuns.add(run);
    const venueList = Array.isArray(venues) ? venues : [];
    const floorSteps = Math.max(venueList.length, 1);
    let done = 0;
    let total = 1 + 1 + floorSteps; // APs + switches + floor plans

    const report = (phase, message) => {
      const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      sendGlobalSearchProgress({ percent, phase, message, done, total });
    };

    const throwIfCancelled = () => {
      if (run.cancelled) {
        const err = new Error('Cancelled');
        err.cancelled = true;
        throw err;
      }
    };

    report('aps', 'Fetching access points...');
    const accessPoints = await client.getAllAccessPoints(tenantId);
    throwIfCancelled();
    done += 1;
    report('aps', `Loaded ${accessPoints.length} access points`);

    let switches = [];
    report('switches', 'Fetching switches...');
    try {
      switches = await client.getAllSwitches();
      throwIfCancelled();
      done += 1;
      report('switches', `Loaded ${switches.length} switches`);
    } catch (error) {
      if (error.cancelled) throw error;
      console.warn('[GlobalSearch] Tenant-wide switch query failed, falling back per venue:', error.message);
      // Replace the single switch step with one step per venue (or one no-op step).
      const switchSteps = Math.max(venueList.length, 1);
      total = total - 1 + switchSteps;
      switches = [];
      if (venueList.length === 0) {
        done += 1;
        report('switches', 'No venues for switch fallback');
      } else {
        await mapWithConcurrency(venueList, GLOBAL_SEARCH_SWITCH_CONCURRENCY, async (venue) => {
          throwIfCancelled();
          try {
            const rows = await client.getSwitches(venue.id);
            switches.push(...(rows || []));
          } catch (venueError) {
            console.warn(`[GlobalSearch] Switches for venue ${venue.id} failed:`, venueError.message);
          }
          done += 1;
          report('switches', `Switches: ${venue.name || venue.id}`);
        });
      }
    }

    const floorsById = {};
    report('floors', 'Fetching floor plans...');
    if (venueList.length === 0) {
      done += 1;
      report('floors', 'No venues for floor plans');
    } else {
      await mapWithConcurrency(venueList, GLOBAL_SEARCH_FLOOR_CONCURRENCY, async (venue) => {
        throwIfCancelled();
        try {
          const floorPlans = await client.getVenueFloorPlans(tenantId, venue.id);
          const list = Array.isArray(floorPlans) ? floorPlans : [];
          for (const fp of list) {
            if (!fp || !fp.id) continue;
            floorsById[fp.id] = {
              name: fp.name || 'Unnamed Floor Plan',
              venueId: venue.id
            };
          }
        } catch (floorError) {
          console.warn(`[GlobalSearch] Floor plans for venue ${venue.id} failed:`, floorError.message);
        }
        done += 1;
        report('floors', `Floor plans: ${venue.name || venue.id}`);
      });
    }

    throwIfCancelled();
    done = total;
    report('done', `Index ready · ${accessPoints.length} APs · ${switches.length} switches`);

    return {
      success: true,
      data: {
        accessPoints,
        switches,
        floorsById,
        fetchedAt: Date.now()
      },
      cancelled: false
    };
  } catch (error) {
    if (error.cancelled || (run && run.cancelled)) {
      return { success: false, cancelled: true, error: 'Cancelled' };
    }
    console.error('[GlobalSearch] Index build failed:', error.message);
    return { success: false, error: error.message, cancelled: false };
  } finally {
    if (run) activeGlobalSearchRuns.delete(run);
  }
});

ipcMain.handle('cancel-global-search-index', async () => {
  cancelRuns(activeGlobalSearchRuns);
  return { success: true };
});

// Logout
ipcMain.handle('logout', async () => {
  cancelRuns(activePoeRuns);
  cancelRuns(activeGlobalSearchRuns);
  ruckusClient = null;
  return { success: true };
});
