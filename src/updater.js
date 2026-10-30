const { app, dialog, shell, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const GITHUB_OWNER = 'MibenSmmod';
const GITHUB_REPO = 'Ruckus1-AP-Mapper';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

let checking = false;

function normalizeVersion(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function compareVersions(a, b) {
  const pa = normalizeVersion(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = normalizeVersion(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff > 0) return 1;
    if (diff < 0) return -1;
  }
  return 0;
}

function pickAsset(assets, platform, arch) {
  const list = Array.isArray(assets) ? assets : [];
  const byName = (predicate) => list.find((asset) => predicate(asset.name || ''));

  if (platform === 'win32') {
    return byName((name) => /Setup\.exe$/i.test(name))
      || byName((name) => /\.exe$/i.test(name) && !/blockmap/i.test(name));
  }

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      return byName((name) => /arm64\.dmg$/i.test(name));
    }
    return byName((name) => /x64\.dmg$/i.test(name))
      || byName((name) => /\.dmg$/i.test(name) && !/arm64/i.test(name));
  }

  return null;
}

async function fetchLatestRelease() {
  const response = await fetch(RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Ruckus-One-AP-Mapper'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} while checking for updates`);
  }

  return response.json();
}

function parentWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  const all = BrowserWindow.getAllWindows();
  return all.find((win) => !win.isDestroyed()) || null;
}

function createProgressWindow(parent) {
  const win = new BrowserWindow({
    width: 420,
    height: 140,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    parent: parent || undefined,
    modal: Boolean(parent),
    title: 'Downloading Update',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setMenuBarVisibility(false);
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .wrap { width: 340px; }
    h1 { font-size: 14px; font-weight: 600; margin: 0 0 12px; }
    .bar {
      height: 8px;
      background: #d2d2d7;
      border-radius: 999px;
      overflow: hidden;
    }
    .fill {
      height: 100%;
      width: 0%;
      background: #0071e3;
      border-radius: 999px;
      transition: width 0.15s ease;
    }
    .status { margin-top: 10px; font-size: 12px; color: #6e6e73; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Downloading update…</h1>
    <div class="bar"><div class="fill" id="fill"></div></div>
    <div class="status" id="status">Starting download…</div>
  </div>
  <script>
    window.addEventListener('message', (event) => {
      const data = event.data || {};
      const fill = document.getElementById('fill');
      const status = document.getElementById('status');
      if (typeof data.percent === 'number') {
        fill.style.width = Math.max(0, Math.min(100, data.percent)) + '%';
      }
      if (data.text) status.textContent = data.text;
    });
  </script>
</body>
</html>`)}`);

  return win;
}

function updateProgress(win, percent, text) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(
    `window.postMessage(${JSON.stringify({ percent, text })}, '*');`
  ).catch(() => {});
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function downloadReleaseAsset(asset, onProgress) {
  const downloadsDir = app.getPath('downloads');
  const fileName = asset.name
    || `Ruckus-One-AP-Mapper-update${path.extname(asset.browser_download_url || '')}`;
  const destination = path.join(downloadsDir, fileName);

  const response = await fetch(asset.browser_download_url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'Ruckus-One-AP-Mapper'
    },
    redirect: 'follow'
  });

  if (!response.ok || !response.body) {
    throw new Error(`Download failed with HTTP ${response.status}`);
  }

  const total = Number(response.headers.get('content-length')) || 0;
  let received = 0;
  const file = fs.createWriteStream(destination);
  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      const ok = file.write(Buffer.from(value));
      if (!ok) {
        await new Promise((resolve) => file.once('drain', resolve));
      }
      if (typeof onProgress === 'function') {
        onProgress(received, total);
      }
    }
    await new Promise((resolve, reject) => {
      file.end(resolve);
      file.on('error', reject);
    });
  } catch (error) {
    file.destroy();
    await fs.promises.unlink(destination).catch(() => {});
    throw error;
  }

  return destination;
}

async function promptAndInstall(updateInfo) {
  const win = parentWindow();
  const detailParts = [
    `Current version: ${updateInfo.currentVersion}`,
    `Latest version: ${updateInfo.latestVersion}`
  ];
  if (updateInfo.asset) {
    detailParts.push(`Installer: ${updateInfo.asset.name}`);
  }

  const buttons = updateInfo.asset
    ? ['Download Update', 'Open Release Page', 'Later']
    : ['Open Release Page', 'Later'];

  const { response } = await dialog.showMessageBox(win || undefined, {
    type: 'info',
    title: 'Update Available',
    message: `Version ${updateInfo.latestVersion} is available.`,
    detail: detailParts.join('\n'),
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    noLink: true
  });

  if (buttons[response] === 'Open Release Page') {
    await shell.openExternal(updateInfo.releaseUrl || RELEASES_PAGE);
    return;
  }

  if (buttons[response] !== 'Download Update' || !updateInfo.asset) {
    return;
  }

  const progressWin = createProgressWindow(win);
  await new Promise((resolve) => {
    progressWin.once('ready-to-show', () => {
      progressWin.show();
      resolve();
    });
  });

  let filePath;
  try {
    filePath = await downloadReleaseAsset(updateInfo.asset, (received, total) => {
      if (total > 0) {
        const percent = Math.min(99, Math.round((received / total) * 100));
        updateProgress(
          progressWin,
          percent,
          `${formatBytes(received)} of ${formatBytes(total)} (${percent}%)`
        );
      } else {
        updateProgress(progressWin, 0, `${formatBytes(received)} downloaded…`);
      }
    });
    updateProgress(progressWin, 100, 'Download complete');
  } catch (error) {
    if (!progressWin.isDestroyed()) progressWin.close();
    const { response: retry } = await dialog.showMessageBox(win || undefined, {
      type: 'error',
      title: 'Download Failed',
      message: 'Could not download the update.',
      detail: `${error.message}\n\nYou can open the release page in your browser instead.`,
      buttons: ['Open Release Page', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if (retry === 0) {
      await shell.openExternal(updateInfo.releaseUrl || RELEASES_PAGE);
    }
    return;
  }

  if (!progressWin.isDestroyed()) progressWin.close();

  const openResult = await shell.openPath(filePath);
  const openFailed = Boolean(openResult);

  await dialog.showMessageBox(win || undefined, {
    type: openFailed ? 'warning' : 'info',
    title: 'Update Downloaded',
    message: openFailed
      ? 'The installer downloaded, but could not be opened automatically.'
      : 'Installer ready.',
    detail: openFailed
      ? `Saved to:\n${filePath}\n\nOpen that file to install, then restart the app.\n\n${openResult}`
      : `Saved to:\n${filePath}\n\nFinish the installer, then restart Ruckus One AP Mapper.`,
    buttons: ['OK'],
    noLink: true
  });
}

async function checkForUpdates({ silent = false } = {}) {
  if (checking) {
    return;
  }
  checking = true;
  const win = parentWindow();
  const currentVersion = normalizeVersion(app.getVersion());

  try {
    console.log('[updater] Checking GitHub releases…');
    const release = await fetchLatestRelease();
    const latestVersion = normalizeVersion(release.tag_name || release.name);
    if (!latestVersion) {
      throw new Error('Latest release did not include a version tag');
    }

    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
    const asset = pickAsset(release.assets, process.platform, process.arch);

    if (!updateAvailable) {
      if (!silent) {
        await dialog.showMessageBox(win || undefined, {
          type: 'info',
          title: 'No Updates',
          message: 'You are up to date.',
          detail: `Ruckus One AP Mapper ${currentVersion} is the latest version.`,
          buttons: ['OK'],
          noLink: true
        });
      }
      return { updateAvailable: false, currentVersion, latestVersion };
    }

    const updateInfo = {
      updateAvailable: true,
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url || RELEASES_PAGE,
      asset
    };

    if (!silent) {
      await promptAndInstall(updateInfo);
    }

    return updateInfo;
  } catch (error) {
    console.error('[updater] Check failed:', error);
    if (!silent) {
      const { response } = await dialog.showMessageBox(win || undefined, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Could not check for updates.',
        detail: `${error.message}\n\nYou can still visit the releases page manually.`,
        buttons: ['Open Release Page', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (response === 0) {
        await shell.openExternal(RELEASES_PAGE);
      }
    }
    return { updateAvailable: false, error: error.message };
  } finally {
    checking = false;
  }
}

module.exports = {
  checkForUpdates,
  compareVersions,
  normalizeVersion,
  pickAsset,
  RELEASES_PAGE
};
