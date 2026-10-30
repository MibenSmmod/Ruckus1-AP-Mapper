// AP Model TX Power Specs (Max TX Power in dBm)
const modelSpecs = {
  'R770': { model24G: 20, model5G: 20, model6G: 21 },
  'R670': { model24G: 16, model5G: 15, model6G: 16 },
  'T670': { model24G: 20, model5G: 20, model6G: 21 },
  'R760': { model24G: 22, model5G: 22, model6G: 22 },
  'R560': { model24G: 20, model5G: 20, model6G: 21 },
  'R850': { model24G: 23, model5G: 23, model6G: null },
  'R750': { model24G: 20, model5G: 22, model6G: null },
  'R650': { model24G: 22, model5G: 22, model6G: null },
  'R550': { model24G: 19, model5G: 22, model6G: null },
  'R350': { model24G: 19, model5G: 20, model6G: null },
  'T750': { model24G: 22, model5G: 22, model6G: null },
  'T350': { model24G: 22, model5G: 22, model6G: null }
};

// Application State
const state = {
  tenantId: null,
  selectedVenue: null,
  selectedFloorPlan: null,
  venues: [],
  floorPlans: [],
  accessPoints: [],
  switches: [],
  floorPlanImage: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  minZoom: 1,
  maxZoom: 10,
  fontSizeMultiplier: 1, // 1 = small, 1.5 = medium, 2 = large
  searchResults: [],
  selectedSearchAP: null,
  showHostname: true,
  showPoE: false,
  hideSwitches: false,
  poeQueryInProgress: false,
  poeShouldCancel: false,
  apPoeInfo: {}, // Map of AP MAC to PoE label (e.g., "802.3bt C6 45W")
  poeDataByFloorPlan: {}, // Cache PoE data per floor plan ID
  selectedPopupAP: null, // AP object shown in the popup
  hoveredDevice: null // { type: 'ap'|'switch', key: string } — drawn on top
};

// DOM Elements
const screens = {
  login: document.getElementById('login-screen'),
  venue: document.getElementById('venue-screen'),
  floorplan: document.getElementById('floorplan-screen'),
  map: document.getElementById('map-screen')
};

const elements = {
  // Login
  loginForm: document.getElementById('login-form'),
  region: document.getElementById('region'),
  tenantId: document.getElementById('tenant-id'),
  clientId: document.getElementById('client-id'),
  clientSecret: document.getElementById('client-secret'),
  toggleClientSecret: document.getElementById('toggle-client-secret'),
  saveCredentials: document.getElementById('save-credentials'),
  connectBtn: document.getElementById('connect-btn'),
  clearBtn: document.getElementById('clear-btn'),
  loginError: document.getElementById('login-error'),
  viewExampleBtn: document.getElementById('view-example-btn'),
  exampleModal: document.getElementById('example-modal'),
  closeExampleBtn: document.getElementById('close-example-btn'),
  exampleBackBtn: document.getElementById('example-back-btn'),

  // Venue
  venueLoading: document.getElementById('venue-loading'),
  venueList: document.getElementById('venue-list'),
  venueError: document.getElementById('venue-error'),
  logoutBtn: document.getElementById('logout-btn'),

  // Floor Plan Selection
  backToVenues: document.getElementById('back-to-venues'),
  venueName: document.getElementById('venue-name'),
  floorplanLoading: document.getElementById('floorplan-loading'),
  floorplanList: document.getElementById('floorplan-list'),
  floorplanError: document.getElementById('floorplan-error'),
  logoutBtn2: document.getElementById('logout-btn-2'),

  // Map
  backToFloorplans: document.getElementById('back-to-floorplans'),
  floorplanName: document.getElementById('floorplan-name'),
  apCount: document.getElementById('ap-count'),
  refreshBtn: document.getElementById('refresh-btn'),
  mapLoading: document.getElementById('map-loading'),
  canvas: document.getElementById('floor-plan-canvas'),
  logoutBtn3: document.getElementById('logout-btn-3'),

  // Zoom Controls
  zoomInBtn: document.getElementById('zoom-in-btn'),
  zoomResetBtn: document.getElementById('zoom-reset-btn'),
  zoomOutBtn: document.getElementById('zoom-out-btn'),

  // Font Size Controls
  fontSizeSmallBtn: document.getElementById('font-size-small-btn'),
  fontSizeMediumBtn: document.getElementById('font-size-medium-btn'),
  fontSizeLargeBtn: document.getElementById('font-size-large-btn'),

  // Search
  apSearchToggle: document.getElementById('ap-search-toggle'),
  apSearchPopup: document.getElementById('ap-search-popup'),
  apSearch: document.getElementById('ap-search'),
  apSearchClear: document.getElementById('ap-search-clear'),
  apSearchDropdown: document.getElementById('ap-search-dropdown'),

  // Settings
  settingsBtn: document.getElementById('settings-btn'),
  settingsMenu: document.getElementById('settings-menu'),
  toggleHostname: document.getElementById('toggle-hostname'),
  hostnameCheck: document.getElementById('hostname-check'),
  togglePoe: document.getElementById('toggle-poe'),
  poeCheck: document.getElementById('poe-check'),
  toggleHideSwitches: document.getElementById('toggle-hide-switches'),
  hideSwitchesCheck: document.getElementById('hide-switches-check'),

  // PoE Query button
  poeQueryBtn: document.getElementById('poe-query-btn'),

  // SSH Confirmation Modal
  sshModal: document.getElementById('ssh-confirmation-modal'),
  sshConfirmBtn: document.getElementById('ssh-confirm-btn'),
  sshCancelBtn: document.getElementById('ssh-cancel-btn'),

  // PoE Progress Modal
  poeProgressModal: document.getElementById('poe-progress-modal'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  currentApText: document.getElementById('current-ap-text'),
  poeCancelBtn: document.getElementById('poe-cancel-btn'),

  // PoE Cache Choice Modal
  poeCacheChoiceModal: document.getElementById('poe-cache-choice-modal'),
  useCacheBtn: document.getElementById('use-cache-btn'),
  queryAgainBtn: document.getElementById('query-again-btn'),

  // AP Popup
  apPopup: document.getElementById('ap-popup'),
  closePopup: document.getElementById('close-popup'),
  apName: document.getElementById('ap-name'),
  apMac: document.getElementById('ap-mac'),
  apIp: document.getElementById('ap-ip'),
  apStatus: document.getElementById('ap-status'),
  apModel: document.getElementById('ap-model'),
  apSerial: document.getElementById('ap-serial'),
  apPoeQueryBtn: document.getElementById('ap-poe-query-btn'),

  // Switch Popup
  switchPopup: document.getElementById('switch-popup'),
  closeSwitchPopup: document.getElementById('close-switch-popup'),
  switchName: document.getElementById('switch-name'),
  switchModel: document.getElementById('switch-model'),
  switchMac: document.getElementById('switch-mac'),
  switchIp: document.getElementById('switch-ip'),
  switchStatus: document.getElementById('switch-status'),
  switchIncidents: document.getElementById('switch-incidents'),
  switchUptime: document.getElementById('switch-uptime'),
  switchClients: document.getElementById('switch-clients')
};

// Canvas context
const ctx = elements.canvas.getContext('2d');

// Screen Navigation
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

// Initialize Application
async function init() {
  // Show package version on the login screen
  const versionInfo = document.querySelector('.version-info');
  if (versionInfo && window.api.getAppVersion) {
    try {
      const version = await window.api.getAppVersion();
      if (version) {
        versionInfo.textContent = `v${version}`;
      }
    } catch (error) {
      console.warn('Could not load app version:', error);
    }
  }

  // Load saved credentials
  const credentials = await window.api.loadCredentials();
  if (credentials) {
    elements.region.value = credentials.region || 'na';
    elements.tenantId.value = credentials.tenantId || '';
    elements.clientId.value = credentials.clientId || '';
    elements.clientSecret.value = credentials.clientSecret || '';
    elements.saveCredentials.checked = true;
  }

  // Set up event listeners
  setupEventListeners();
}

// Event Listeners
function setupEventListeners() {
  // Login form
  elements.loginForm.addEventListener('submit', handleLogin);

  // Clear button
  elements.clearBtn.addEventListener('click', handleClearCredentials);

  // Show/hide client secret
  elements.toggleClientSecret.addEventListener('click', toggleClientSecretVisibility);

  // Example map preview
  elements.viewExampleBtn.addEventListener('click', openExampleModal);
  elements.closeExampleBtn.addEventListener('click', closeExampleModal);
  elements.exampleBackBtn.addEventListener('click', closeExampleModal);
  elements.exampleModal.addEventListener('click', (e) => {
    if (e.target === elements.exampleModal) {
      closeExampleModal();
    }
  });

  // Logout buttons
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.logoutBtn2.addEventListener('click', handleLogout);
  elements.logoutBtn3.addEventListener('click', handleLogout);

  // Navigation
  elements.backToVenues.addEventListener('click', () => {
    showScreen('venue');
  });

  elements.backToFloorplans.addEventListener('click', () => {
    showScreen('floorplan');
  });

  // Refresh button
  elements.refreshBtn.addEventListener('click', handleRefresh);

  // AP Popup
  elements.closePopup.addEventListener('click', closeAPPopup);
  elements.apPopup.addEventListener('click', (e) => {
    if (e.target === elements.apPopup) {
      closeAPPopup();
    }
  });

  // Switch Popup
  elements.closeSwitchPopup.addEventListener('click', closeSwitchPopup);
  elements.switchPopup.addEventListener('click', (e) => {
    if (e.target === elements.switchPopup) {
      closeSwitchPopup();
    }
  });

  elements.apPoeQueryBtn.addEventListener('click', async () => {
    const ap = state.selectedPopupAP;
    if (!ap) return;

    // Close popup before showing the PoE query confirmation
    elements.apPopup.classList.add('hidden');

    const confirmed = await confirmPoeQuery();
    if (!confirmed) return;

    await fetchSingleAPPoEInfo(ap);
  });

  // Canvas interactions
  elements.canvas.addEventListener('click', handleCanvasClick);
  elements.canvas.addEventListener('mousemove', handleCanvasMouseMove);
  elements.canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
  elements.canvas.addEventListener('mousedown', handleCanvasMouseDown);
  elements.canvas.addEventListener('mouseup', handleCanvasMouseUp);
  elements.canvas.addEventListener('mouseleave', handleCanvasMouseLeave);

  // Zoom controls
  elements.zoomInBtn.addEventListener('click', handleZoomIn);
  elements.zoomOutBtn.addEventListener('click', handleZoomOut);
  elements.zoomResetBtn.addEventListener('click', handleZoomReset);

  // Font size controls
  elements.fontSizeSmallBtn.addEventListener('click', () => handleFontSizeChange(1));
  elements.fontSizeMediumBtn.addEventListener('click', () => handleFontSizeChange(1.5));
  elements.fontSizeLargeBtn.addEventListener('click', () => handleFontSizeChange(2));

  // Search
  elements.apSearchToggle.addEventListener('click', toggleAPSearchPopup);
  elements.apSearch.addEventListener('input', handleAPSearch);
  elements.apSearchClear.addEventListener('click', handleClearAPSearch);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.floating-search-panel')) {
      closeAPSearchPopup();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!elements.exampleModal.classList.contains('hidden')) {
        closeExampleModal();
        return;
      }
      if (!elements.apSearchPopup.classList.contains('hidden')) {
        closeAPSearchPopup();
      }
      closeSettingsMenu();
    }
  });

  // Settings
  elements.settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettingsMenu();
  });

  elements.toggleHostname.addEventListener('click', () => {
    state.showHostname = !state.showHostname;
    elements.hostnameCheck.textContent = state.showHostname ? '☑' : '☐';
    renderFloorPlan();
  });

  elements.toggleHideSwitches.addEventListener('click', () => {
    state.hideSwitches = !state.hideSwitches;
    elements.hideSwitchesCheck.textContent = state.hideSwitches ? '☑' : '☐';
    renderFloorPlan();
  });

  // Display PoE Level: show/hide only (query is started from the plug icon)
  elements.togglePoe.addEventListener('click', () => {
    state.showPoE = !state.showPoE;
    elements.poeCheck.textContent = state.showPoE ? '☑' : '☐';
    renderFloorPlan();
  });

  elements.poeQueryBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeSettingsMenu();
    await startFloorPlanPoeQuery();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.floating-settings-panel')) {
      closeSettingsMenu();
    }
  });

  // PoE query confirmation
  elements.sshConfirmBtn.addEventListener('click', () => {
    window.sshConfirmationResult = true;
    elements.sshModal.classList.add('hidden');
  });

  elements.sshCancelBtn.addEventListener('click', () => {
    window.sshConfirmationResult = false;
    elements.sshModal.classList.add('hidden');
  });

  // PoE Progress Modal listeners
  elements.poeCancelBtn.addEventListener('click', () => {
    state.poeShouldCancel = true;
    elements.currentApText.textContent = 'Cancelling...';
    window.api.cancelApPoe();
  });

  // PoE Cache Choice Modal listeners
  elements.useCacheBtn.addEventListener('click', () => {
    // Restore cached PoE data and close modal
    state.apPoeInfo = { ...state.poeDataByFloorPlan[state.selectedFloorPlan.id] };
    state.showPoE = true;
    elements.poeCheck.textContent = '☑';
    elements.poeCacheChoiceModal.classList.add('hidden');
    closeSettingsMenu();
    renderFloorPlan();
  });

  elements.queryAgainBtn.addEventListener('click', async () => {
    elements.poeCacheChoiceModal.classList.add('hidden');
    const confirmed = await confirmPoeQuery();
    if (confirmed) {
      const ok = await fetchPoEInfo();
      if (ok) {
        state.showPoE = true;
        elements.poeCheck.textContent = '☑';
        renderFloorPlan();
      }
    }
  });

  // Window resize
  window.addEventListener('resize', () => {
    if (screens.map.classList.contains('active')) {
      resetZoomPan();
      renderFloorPlan();
    }
  });
}

// Clear Credentials Handler
async function handleClearCredentials() {
  elements.region.value = 'na';
  elements.tenantId.value = '';
  elements.clientId.value = '';
  elements.clientSecret.value = '';
  elements.saveCredentials.checked = false;
  elements.loginError.classList.add('hidden');
  setClientSecretVisibility(false);

  // Also clear saved credentials from storage
  await window.api.clearCredentials();
}

function openExampleModal() {
  elements.exampleModal.classList.remove('hidden');
}

function closeExampleModal() {
  elements.exampleModal.classList.add('hidden');
}

function toggleClientSecretVisibility() {
  const showing = elements.clientSecret.type === 'text';
  setClientSecretVisibility(!showing);
}

function setClientSecretVisibility(show) {
  elements.clientSecret.type = show ? 'text' : 'password';
  const openIcon = elements.toggleClientSecret.querySelector('.eye-open');
  const closedIcon = elements.toggleClientSecret.querySelector('.eye-closed');
  openIcon.classList.toggle('hidden', show);
  closedIcon.classList.toggle('hidden', !show);
  elements.toggleClientSecret.setAttribute('aria-label', show ? 'Hide client secret' : 'Show client secret');
  elements.toggleClientSecret.title = show ? 'Hide client secret' : 'Show client secret';
}

// Login Handler
async function handleLogin(e) {
  e.preventDefault();

  const region = elements.region.value;
  const tenantId = elements.tenantId.value.trim();
  const clientId = elements.clientId.value.trim();
  const clientSecret = elements.clientSecret.value.trim();
  const saveCredentials = elements.saveCredentials.checked;

  elements.connectBtn.disabled = true;
  elements.connectBtn.textContent = 'Connecting...';
  elements.loginError.classList.add('hidden');

  try {
    // Authenticate
    const result = await window.api.authenticate({
      tenantId,
      clientId,
      clientSecret,
      region
    });

    if (!result.success) {
      throw new Error(result.error || 'Authentication failed');
    }

    // Save credentials if requested
    if (saveCredentials) {
      await window.api.saveCredentials({
        region,
        tenantId,
        clientId,
        clientSecret
      });
    } else {
      await window.api.clearCredentials();
    }

    // Store tenant ID in state
    state.tenantId = tenantId;

    // Load venues and show venue screen
    showScreen('venue');
    await loadVenues();

  } catch (error) {
    elements.loginError.textContent = error.message;
    elements.loginError.classList.remove('hidden');
  } finally {
    elements.connectBtn.disabled = false;
    elements.connectBtn.textContent = 'Connect';
  }
}

// Logout Handler
async function handleLogout() {
  await window.api.logout();
  state.tenantId = null;
  state.selectedVenue = null;
  state.selectedFloorPlan = null;
  state.venues = [];
  state.floorPlans = [];
  state.accessPoints = [];
  state.switches = [];
  showScreen('login');
}

// Refresh Handler
async function handleRefresh() {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.classList.add('loading');

  try {
    await loadFloorPlanData();
  } finally {
    elements.refreshBtn.disabled = false;
    elements.refreshBtn.classList.remove('loading');
  }
}

// Load Venues
async function loadVenues() {
  elements.venueLoading.classList.remove('hidden');
  elements.venueList.classList.add('hidden');
  elements.venueError.classList.add('hidden');

  try {
    const result = await window.api.getVenues(state.tenantId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to load venues');
    }

    state.venues = result.data || [];
    renderVenueList();

  } catch (error) {
    elements.venueError.textContent = error.message;
    elements.venueError.classList.remove('hidden');
  } finally {
    elements.venueLoading.classList.add('hidden');
  }
}

// Render Venue List
function renderVenueList() {
  elements.venueList.innerHTML = '';

  if (state.venues.length === 0) {
    elements.venueList.innerHTML = `
      <div class="empty-state">
        <h3>No Venues Found</h3>
        <p>No venues are available for this tenant.</p>
      </div>
    `;
    elements.venueList.classList.remove('hidden');
    return;
  }

  state.venues.forEach(venue => {
    const item = document.createElement('div');
    item.className = 'list-item';
    // Address is a nested object with addressLine, city, country fields
    const addr = venue.address || {};
    const addressLine = addr.addressLine || '';
    const country = addr.country || '';

    item.innerHTML = `
      <h3>${escapeHtml(venue.name || 'Unnamed Venue')}</h3>
      ${addressLine ? `<p>${escapeHtml(addressLine)}</p>` : ''}
      ${country ? `<p>${escapeHtml(country)}</p>` : ''}
    `;
    item.addEventListener('click', () => selectVenue(venue));
    elements.venueList.appendChild(item);
  });

  elements.venueList.classList.remove('hidden');
}

// Select Venue
async function selectVenue(venue) {
  state.selectedVenue = venue;
  elements.venueName.textContent = venue.name || 'Floor Plans';
  showScreen('floorplan');
  await loadFloorPlans();
}

// Load Floor Plans
async function loadFloorPlans() {
  elements.floorplanLoading.classList.remove('hidden');
  elements.floorplanList.classList.add('hidden');
  elements.floorplanError.classList.add('hidden');

  try {
    const result = await window.api.getFloorPlans({
      tenantId: state.tenantId,
      venueId: state.selectedVenue.id
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to load floor plans');
    }

    state.floorPlans = result.data || [];
    renderFloorPlanList();

  } catch (error) {
    elements.floorplanError.textContent = error.message;
    elements.floorplanError.classList.remove('hidden');
  } finally {
    elements.floorplanLoading.classList.add('hidden');
  }
}

// Render Floor Plan List
function renderFloorPlanList() {
  elements.floorplanList.innerHTML = '';

  if (state.floorPlans.length === 0) {
    elements.floorplanList.innerHTML = `
      <div class="empty-state">
        <h3>No Floor Plans Found</h3>
        <p>No floor plans are available for this venue.</p>
      </div>
    `;
    elements.floorplanList.classList.remove('hidden');
    return;
  }

  state.floorPlans.forEach(floorPlan => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <h3>${escapeHtml(floorPlan.name || 'Unnamed Floor Plan')}</h3>
      <p>Floor: ${escapeHtml(floorPlan.floorNumber?.toString() || 'N/A')}</p>
    `;
    item.addEventListener('click', () => selectFloorPlan(floorPlan));
    elements.floorplanList.appendChild(item);
  });

  elements.floorplanList.classList.remove('hidden');
}

// Select Floor Plan
async function selectFloorPlan(floorPlan) {
  state.selectedFloorPlan = floorPlan;
  elements.floorplanName.textContent = `${state.selectedVenue?.name || 'Venue'} > ${floorPlan.name || 'Floor Plan'}`;
  showScreen('map');
  await loadFloorPlanData();
}

// Load Floor Plan Data (Image, APs, and switches)
async function loadFloorPlanData() {
  resetZoomPan();
  elements.mapLoading.classList.remove('hidden');
  elements.canvas.style.display = 'none';

  try {
    // Load floor plan image, access points, and switches in parallel
    const [imageResult, apResult, switchResult] = await Promise.all([
      window.api.getFloorPlanImage({
        tenantId: state.tenantId,
        venueId: state.selectedVenue.id,
        floorPlanId: state.selectedFloorPlan.id,
        imageId: state.selectedFloorPlan.imageId
      }),
      window.api.getAccessPoints({
        tenantId: state.tenantId,
        venueId: state.selectedVenue.id
      }),
      window.api.getSwitches({
        venueId: state.selectedVenue.id
      }).catch((error) => {
        console.warn('[Switches] Query failed:', error.message || error);
        return { success: false, error: error.message || String(error) };
      })
    ]);

    if (!imageResult.success) {
      throw new Error(imageResult.error || 'Failed to load floor plan image');
    }

    // Filter APs for this floor plan (floorplanId is in position object with lowercase 'p')
    const allAPs = apResult.success ? (apResult.data || []) : [];
    state.accessPoints = allAPs.filter(ap =>
      ap.position && ap.position.floorplanId === state.selectedFloorPlan.id
    );

    if (switchResult.success) {
      state.switches = filterAndDedupeSwitches(switchResult.data || [], state.selectedFloorPlan.id);
    } else {
      console.warn('[Switches] Query failed:', switchResult.error || 'Unknown error');
      state.switches = [];
    }

    updateDeviceCount();

    // Restore cached PoE data for this floor plan if it exists
    const floorPlanId = state.selectedFloorPlan.id;
    if (state.poeDataByFloorPlan[floorPlanId]) {
      state.apPoeInfo = state.poeDataByFloorPlan[floorPlanId];
      state.showPoE = true;
      elements.poeCheck.textContent = '☑';
      console.log('[PoE] Restored cached PoE data for floor plan:', floorPlanId);
    } else {
      // No cached data for this floor plan
      state.apPoeInfo = {};
      state.showPoE = false;
      elements.poeCheck.textContent = '☐';
    }

    // Load image
    const img = new Image();
    img.onload = () => {
      state.floorPlanImage = img;
      elements.mapLoading.classList.add('hidden');
      elements.canvas.style.display = 'block';
      renderFloorPlan();
    };
    img.onerror = () => {
      throw new Error('Failed to load floor plan image');
    };
    img.src = imageResult.data;

  } catch (error) {
    elements.mapLoading.textContent = error.message;
  }
}

function updateDeviceCount() {
  const apCount = state.accessPoints.length;
  const switchCount = state.switches.length;
  const apLabel = `${apCount} Access Point${apCount !== 1 ? 's' : ''}`;
  const switchLabel = `${switchCount} Switch${switchCount !== 1 ? 'es' : ''}`;
  elements.apCount.textContent = `${apLabel} · ${switchLabel}`;
}

// Prefer stack / named row when several switches share the same map point.
function filterAndDedupeSwitches(switches, floorPlanId) {
  const onFloor = (switches || []).filter((sw) =>
    sw &&
    sw.floorplanId === floorPlanId &&
    typeof sw.xPercent === 'number' &&
    typeof sw.yPercent === 'number'
  );

  const byPosition = new Map();
  for (const sw of onFloor) {
    const key = `${sw.xPercent},${sw.yPercent}`;
    const existing = byPosition.get(key);
    if (!existing || switchPlacementScore(sw) > switchPlacementScore(existing)) {
      byPosition.set(key, sw);
    }
  }
  return Array.from(byPosition.values());
}

function switchPlacementScore(sw) {
  let score = 0;
  if (sw.isStack) score += 4;
  if (String(sw.deviceType || '').toLowerCase().includes('stack')) score += 2;
  if (switchHostname(sw)) score += 1;
  return score;
}

function switchHostname(sw) {
  return sw.switchName || sw.name || sw.provisionName || '';
}

// Render Floor Plan on Canvas
function renderFloorPlan() {
  if (!state.floorPlanImage) return;

  const container = elements.canvas.parentElement;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  // Set canvas size to match container
  elements.canvas.width = containerWidth;
  elements.canvas.height = containerHeight;

  const img = state.floorPlanImage;

  // Calculate base scale to fit image in container while maintaining aspect ratio
  const scaleX = containerWidth / img.width;
  const scaleY = containerHeight / img.height;
  state.scale = Math.min(scaleX, scaleY);

  // Apply zoom to get the effective scale
  const effectiveScale = state.scale * state.zoom;

  // Calculate offset to center the zoomed image, then apply pan
  const scaledWidth = img.width * effectiveScale;
  const scaledHeight = img.height * effectiveScale;
  state.offsetX = (containerWidth - scaledWidth) / 2 + state.panX;
  state.offsetY = (containerHeight - scaledHeight) / 2 + state.panY;

  // Clear canvas
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(0, 0, containerWidth, containerHeight);

  // Draw floor plan image
  ctx.drawImage(
    img,
    state.offsetX,
    state.offsetY,
    scaledWidth,
    scaledHeight
  );

  // Draw access points, then switches; hovered device last for visibility
  drawAccessPoints();
  if (!state.hideSwitches) {
    drawSwitches();
  }
  drawHoveredDeviceOnTop();

  // Continue animation if there's a selected search AP
  if (state.selectedSearchAP) {
    requestAnimationFrame(renderFloorPlan);
  }
}

// Shared status color for APs and switches
function deviceStatusColor(status) {
  const value = status === undefined || status === null ? '' : String(status).toLowerCase();
  if (value === 'insetupphase' || value === 'applying' || value.includes('setup')) {
    return '#ff9800'; // Orange
  }
  if (value === 'warning' || value === 'degraded' || value === 'operationalwarning') {
    return '#ffc107'; // Yellow
  }
  if (
    value === 'offline' ||
    value === 'disconnected' ||
    value === 'unknown' ||
    value === 'undefined' ||
    value === '' ||
    value.includes('never') ||
    value.includes('nevercontacted')
  ) {
    return '#dc3545'; // Red
  }
  return '#28a745'; // Green (Operational / Online / other healthy)
}

function accessPointKey(ap) {
  return ap.mac || ap.serialNumber || ap.name || '';
}

function switchKey(sw) {
  return sw.id || sw.switchMac || sw.serialNumber || switchHostname(sw) || '';
}

function isHoveredAccessPoint(ap) {
  return state.hoveredDevice &&
    state.hoveredDevice.type === 'ap' &&
    state.hoveredDevice.key === accessPointKey(ap);
}

function isHoveredSwitch(sw) {
  return state.hoveredDevice &&
    state.hoveredDevice.type === 'switch' &&
    state.hoveredDevice.key === switchKey(sw);
}

function getMapDrawScale() {
  const img = state.floorPlanImage;
  if (!img) return null;
  const effectiveScale = state.scale * state.zoom;
  return {
    scaledWidth: img.width * effectiveScale,
    scaledHeight: img.height * effectiveScale
  };
}

// Draw Access Points (skip hovered — redrawn on top later)
function drawAccessPoints() {
  const scale = getMapDrawScale();
  if (!scale) return;

  state.accessPoints.forEach((ap) => {
    if (isHoveredAccessPoint(ap)) return;
    drawOneAccessPoint(ap, scale.scaledWidth, scale.scaledHeight);
  });
}

function drawOneAccessPoint(ap, scaledWidth, scaledHeight) {
  const apRadius = 12;
  if (!ap.position || ap.position.xPercent === undefined || ap.position.yPercent === undefined) return;

  const x = state.offsetX + (ap.position.xPercent / 100 * scaledWidth);
  const y = state.offsetY + (ap.position.yPercent / 100 * scaledHeight);
  const color = deviceStatusColor(ap.state);

  ctx.beginPath();
  ctx.arc(x, y, apRadius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // WiFi glyph: larger, evenly spaced arcs with round caps for a clean look
  const wifiCy = y + 2.5;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.arc(x, wifiCy, 1.5, 0, Math.PI * 2);
  ctx.fill();

  const arcHalf = Math.PI * 0.32;
  const arcStart = -Math.PI / 2 - arcHalf;
  const arcEnd = -Math.PI / 2 + arcHalf;
  [4.5, 7.5].forEach((r) => {
    ctx.beginPath();
    ctx.arc(x, wifiCy, r, arcStart, arcEnd);
    ctx.stroke();
  });
  ctx.restore();

  if (state.selectedSearchAP && state.selectedSearchAP.mac === ap.mac) {
    const now = Date.now() % 1500;
    const progress = now / 1500;
    const pulseRadius = 16 + (8 * Math.sin(progress * Math.PI * 2));
    const pulseOpacity = 0.6 + (0.4 * Math.cos(progress * Math.PI * 2));

    ctx.strokeStyle = `rgba(0, 102, 204, ${pulseOpacity})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  const labelsOnLeft = apLabelsOnLeft(ap, x, y, scaledWidth, scaledHeight);
  drawChannelLabels(ap, x, y, apRadius, color, labelsOnLeft);
}

// Pixel distance at which nearby device labels are treated as overlapping.
const DEVICE_LABEL_OVERLAP_PX = 24;

function switchOverlapsAccessPoint(swX, swY, scaledWidth, scaledHeight) {
  for (const ap of state.accessPoints) {
    if (!ap.position || ap.position.xPercent === undefined || ap.position.yPercent === undefined) {
      continue;
    }
    const ax = state.offsetX + (ap.position.xPercent / 100 * scaledWidth);
    const ay = state.offsetY + (ap.position.yPercent / 100 * scaledHeight);
    const dx = swX - ax;
    const dy = swY - ay;
    if (Math.sqrt(dx * dx + dy * dy) <= DEVICE_LABEL_OVERLAP_PX) {
      return true;
    }
  }
  return false;
}

// When two APs overlap, fan labels outward: left AP → left, right AP → right.
function apLabelsOnLeft(ap, x, y, scaledWidth, scaledHeight) {
  const thisKey = accessPointKey(ap);
  for (const other of state.accessPoints) {
    if (accessPointKey(other) === thisKey) continue;
    if (!other.position || other.position.xPercent === undefined || other.position.yPercent === undefined) {
      continue;
    }
    const ox = state.offsetX + (other.position.xPercent / 100 * scaledWidth);
    const oy = state.offsetY + (other.position.yPercent / 100 * scaledHeight);
    const dist = Math.sqrt(Math.pow(x - ox, 2) + Math.pow(y - oy, 2));
    if (dist > DEVICE_LABEL_OVERLAP_PX) continue;

    if (ox > x || (ox === x && accessPointKey(other) > thisKey)) {
      return true;
    }
  }
  return false;
}

// Draw switches (skip hovered — redrawn on top later)
function drawSwitches() {
  const scale = getMapDrawScale();
  if (!scale) return;

  state.switches.forEach((sw) => {
    if (isHoveredSwitch(sw)) return;
    drawOneSwitch(sw, scale.scaledWidth, scale.scaledHeight);
  });
}

function drawOneSwitch(sw, scaledWidth, scaledHeight) {
  const radius = 12;
  const x = state.offsetX + (sw.xPercent / 100 * scaledWidth);
  const y = state.offsetY + (sw.yPercent / 100 * scaledHeight);
  const color = deviceStatusColor(sw.deviceStatus);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Switch chassis glyph: white bar with a port circle on the right
  const boxW = 11;
  const boxH = 5;
  const boxX = x - boxW / 2;
  const boxY = y - boxH / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.beginPath();
  ctx.arc(boxX + boxW - 2.5, y, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const labelsOnLeft = switchOverlapsAccessPoint(x, y, scaledWidth, scaledHeight);
  drawSwitchLabels(sw, x, y, radius, color, labelsOnLeft);
}

function drawHoveredDeviceOnTop() {
  if (!state.hoveredDevice) return;
  const scale = getMapDrawScale();
  if (!scale) return;

  if (state.hoveredDevice.type === 'ap') {
    const ap = state.accessPoints.find((a) => accessPointKey(a) === state.hoveredDevice.key);
    if (ap) drawOneAccessPoint(ap, scale.scaledWidth, scale.scaledHeight);
    return;
  }

  if (state.hoveredDevice.type === 'switch' && !state.hideSwitches) {
    const sw = state.switches.find((s) => switchKey(s) === state.hoveredDevice.key);
    if (sw) drawOneSwitch(sw, scale.scaledWidth, scale.scaledHeight);
  }
}

// API reports PoE in mW; RUCKUS One UI shows watts (e.g. 44W/240W 18%).
function formatSwitchPoeUsage(sw) {
  const usedMw = Number(sw.poeUtilization);
  const totalMw = Number(sw.poeTotal);
  if (!Number.isFinite(usedMw) || !Number.isFinite(totalMw) || totalMw <= 0) {
    return null;
  }
  const usedW = Math.round(usedMw / 1000);
  const totalW = Math.round(totalMw / 1000);
  const percent = Math.round((usedMw / totalMw) * 100);
  return `${usedW}W/${totalW}W ${percent}%`;
}

function drawSwitchLabels(sw, x, y, radius, color, labelsOnLeft = false) {
  const hostname = switchHostname(sw);
  const poeText = formatSwitchPoeUsage(sw);
  if (!hostname && !poeText) return;

  const labelX = labelsOnLeft ? x - radius - 5 : x + radius + 5;
  const baseFontSize = 11;
  const fontSize = Math.round(baseFontSize * state.fontSizeMultiplier);
  const lineHeight = 14 * state.fontSizeMultiplier;
  const bgPadding = 2;
  const bgHeight = fontSize + 3;
  const bgYOffset = fontSize * 0.8;

  const lines = [];
  if (hostname) lines.push({ text: hostname, fill: color, bold: true });
  if (poeText) lines.push({ text: poeText, fill: '#333333', bold: true });

  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  ctx.save();
  ctx.textAlign = labelsOnLeft ? 'right' : 'left';

  lines.forEach((line, index) => {
    const labelY = startY + (index * lineHeight);
    ctx.font = `${line.bold ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    const textWidth = ctx.measureText(line.text).width;
    const bgX = labelsOnLeft
      ? labelX - textWidth - bgPadding
      : labelX - bgPadding;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(bgX, labelY - bgYOffset, textWidth + (bgPadding * 2), bgHeight);

    ctx.fillStyle = line.fill;
    ctx.fillText(line.text, labelX, labelY);
  });

  ctx.restore();
}

// Format bandwidth for display (e.g., "80MHz" -> "80")
function formatBandwidth(bandwidth) {
  if (!bandwidth) return '';
  // Extract just the number from strings like "80MHz", "160MHz", "AUTO"
  const match = bandwidth.match(/(\d+)/);
  return match ? match[1] : bandwidth;
}

// Prefer the operating width from radioStatuses. The config value is often AUTO.
function operativeBandwidth(radioParams) {
  const live = radioParams.operativeChannelBandwidth;
  if (live && /\d/.test(String(live))) return formatBandwidth(String(live));
  return formatBandwidth(radioParams.channelBandwidth320MhzGroup || radioParams.channelBandwidth);
}

// Helper: Convert dB offset to actual dBm using model max TX power
function convertDbOffsetToDdBm(dbOffsetStr, maxTxPower) {
  if (!maxTxPower) return null;
  const match = dbOffsetStr.match(/-?(\d+)/);
  if (!match) return null;
  const offset = parseInt(match[1]);
  return maxTxPower - offset;
}

// Format transmit power for display.
// actualTxPower is the live dBm value from radioStatuses (the RUCKUS One TX Power column).
// The configured setting (MAX, Auto, -N dB) is only used when that reading is missing.
function formatTxPower(actualTxPower, operativeTxPower, txPower, apModel, band) {
  // Get max TX power for this model/band if available
  let maxTxPowerValue = null;
  if (apModel && band) {
    const specs = modelSpecs[apModel];
    if (specs) {
      maxTxPowerValue = specs[band];
    }
  }

  // Try actualTxPower first (numeric value from API)
  if (actualTxPower !== undefined && actualTxPower !== null) {
    let numValue;
    if (typeof actualTxPower === 'string') {
      const match = actualTxPower.match(/(\d+)/);
      numValue = match ? parseInt(match[1]) : null;
    } else {
      numValue = parseInt(actualTxPower);
    }

    if (numValue !== null && numValue > 0) return numValue.toString();
  }

  // Fall back to operativeTxPower (e.g., "max", "-6 dB")
  if (operativeTxPower !== undefined && operativeTxPower !== null) {
    const val = operativeTxPower.toString().toLowerCase();
    if (val === 'max' || val === 'full') return 'MAX';
    if (val === 'min') return 'MIN';

    // Check if it's a dB offset (e.g., "-12 dB", "-15 dB")
    if (val.includes('db') && maxTxPowerValue !== null) {
      const dBmValue = convertDbOffsetToDdBm(val, maxTxPowerValue);
      if (dBmValue !== null) return dBmValue.toString();
    }

    const match = val.match(/(\d+)/);
    return match ? match[1] : operativeTxPower;
  }

  // Fall back to txPower (e.g., "MAX", "Auto", "-17")
  if (txPower !== undefined && txPower !== null) {
    const val = txPower.toString().toLowerCase();
    if (val === 'max' || val === 'full') return 'MAX';
    if (val === 'auto') return 'AUTO';
    if (val === 'min') return 'MIN';

    // Check if it's a dB offset
    if (val.includes('db') && maxTxPowerValue !== null) {
      const dBmValue = convertDbOffsetToDdBm(val, maxTxPowerValue);
      if (dBmValue !== null) return dBmValue.toString();
    }

    const match = val.match(/(\d+)/);
    return match ? match[1] : txPower;
  }

  // No value found
  return '??';
}

function drawMapLabelLine(text, labelX, labelY, fillStyle, fontSize, labelsOnLeft) {
  const bgPadding = 2;
  const bgHeight = fontSize + 3;
  const bgYOffset = fontSize * 0.8;
  const textWidth = ctx.measureText(text).width;
  const bgX = labelsOnLeft ? labelX - textWidth - bgPadding : labelX - bgPadding;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(bgX, labelY - bgYOffset, textWidth + (bgPadding * 2), bgHeight);
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, labelX, labelY);
}

// Draw channel labels next to AP (right by default; left when overlapping another AP)
function drawChannelLabels(ap, x, y, apRadius, apColor, labelsOnLeft = false) {
  const radio = ap.radio;
  const labels = [];

  if (radio) {
    // 2.4GHz
    if (radio.apRadioParams24G) {
      if (radio.apRadioParams24G.operativeChannel) {
        const ch = radio.apRadioParams24G.operativeChannel;
        const bw = operativeBandwidth(radio.apRadioParams24G);
        const tx = formatTxPower(radio.apRadioParams24G.actualTxPower, radio.apRadioParams24G.operativeTxPower, radio.apRadioParams24G.txPower, ap.model, 'model24G');
        labels.push({ band: '2.4G', channel: ch, bandwidth: bw, txPower: tx, color: '#2196F3' });
      } else {
        labels.push({ band: '2.4G', disabled: true, color: '#2196F3' });
      }
    }

    // 5GHz
    if (radio.apRadioParams50G) {
      if (radio.apRadioParams50G.operativeChannel) {
        const ch = radio.apRadioParams50G.operativeChannel;
        const bw = operativeBandwidth(radio.apRadioParams50G);
        const tx = formatTxPower(radio.apRadioParams50G.actualTxPower, radio.apRadioParams50G.operativeTxPower, radio.apRadioParams50G.txPower, ap.model, 'model5G');
        labels.push({ band: '5G', channel: ch, bandwidth: bw, txPower: tx, color: '#9C27B0' });
      } else {
        labels.push({ band: '5G', disabled: true, color: '#9C27B0' });
      }
    }

    // 6GHz - only show if hardware is enabled (enable6G: true)
    if (radio.apRadioParams6G && radio.enable6G === true) {
      if (radio.apRadioParams6G.operativeChannel) {
        const ch = radio.apRadioParams6G.operativeChannel;
        const bw = operativeBandwidth(radio.apRadioParams6G);
        const tx = formatTxPower(radio.apRadioParams6G.actualTxPower, radio.apRadioParams6G.operativeTxPower, radio.apRadioParams6G.txPower, ap.model, 'model6G');
        // AFC Power State from /venues/aps/query: Low -> LPI, Standard -> SP
        const hasTx = tx && tx !== '??';
        const afcSuffix = (hasTx && ap.afcPowerState) ? ap.afcPowerState : null;
        labels.push({ band: '6G', channel: ch, bandwidth: bw, txPower: tx, afcSuffix, color: '#FF5722' });
      } else {
        labels.push({ band: '6G', disabled: true, color: '#FF5722' });
      }
    }
  }

  // Check if PoE info should be displayed
  const poeMac = (ap.mac || ap.macAddress || '').toLowerCase();
  const poeInfo = state.showPoE && poeMac ? state.apPoeInfo[poeMac] : null;
  const showHost = state.showHostname && ap.name;
  const totalLines = labels.length + (poeInfo ? 1 : 0);

  if (totalLines === 0 && !showHost) return;

  const labelX = labelsOnLeft ? x - apRadius - 5 : x + apRadius + 5;
  const baseFontSize = 11;
  const fontSize = Math.round(baseFontSize * state.fontSizeMultiplier);
  const lineHeight = 14 * state.fontSizeMultiplier;
  const startY = totalLines > 0 ? y - ((totalLines - 1) * lineHeight) / 2 : y;

  ctx.save();
  ctx.textAlign = labelsOnLeft ? 'right' : 'left';
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

  if (showHost) {
    const hostnameY = totalLines > 0 ? startY - lineHeight : y;
    drawMapLabelLine(ap.name, labelX, hostnameY, apColor, fontSize, labelsOnLeft);
  }

  labels.forEach((label, index) => {
    const labelY = startY + (index * lineHeight);
    let text;
    if (label.disabled) {
      text = `${label.band}: disabled`;
    } else {
      const txPart = label.txPower ? `/${label.txPower}` : '';
      const afcPart = label.afcSuffix ? ` (${label.afcSuffix})` : '';
      text = `${label.band}: ${label.channel}/${label.bandwidth}${txPart}${afcPart}`;
    }
    drawMapLabelLine(text, labelX, labelY, label.disabled ? '#999999' : label.color, fontSize, labelsOnLeft);
  });

  if (poeInfo) {
    const poeY = startY + (labels.length * lineHeight);
    const isError = poeInfo.startsWith('error:');
    const displayPoeValue = isError ? poeInfo.substring(6) : poeInfo;
    const poeText = `PoE: ${displayPoeValue}`;
    drawMapLabelLine(poeText, labelX, poeY, isError ? '#dc3545' : '#333333', fontSize, labelsOnLeft);
  }

  ctx.restore();
}

function getMapScale() {
  const img = state.floorPlanImage;
  if (!img) return null;
  const effectiveScale = state.scale * state.zoom;
  return {
    scaledWidth: img.width * effectiveScale,
    scaledHeight: img.height * effectiveScale
  };
}

// Get AP at a given point (returns AP or null)
function getAPAtPoint(pointX, pointY) {
  const apRadius = 12;
  const scale = getMapScale();
  if (!scale) return null;

  let best = null;
  let bestDist = Infinity;
  for (const ap of state.accessPoints) {
    if (!ap.position || ap.position.xPercent === undefined || ap.position.yPercent === undefined) continue;

    const x = state.offsetX + (ap.position.xPercent / 100 * scale.scaledWidth);
    const y = state.offsetY + (ap.position.yPercent / 100 * scale.scaledHeight);
    const distance = Math.sqrt(Math.pow(pointX - x, 2) + Math.pow(pointY - y, 2));

    if (distance <= apRadius && distance < bestDist) {
      best = ap;
      bestDist = distance;
    }
  }
  return best;
}

// Get switch at a given point (returns switch or null)
function getSwitchAtPoint(pointX, pointY) {
  if (state.hideSwitches) return null;

  const radius = 12;
  const scale = getMapScale();
  if (!scale) return null;

  let best = null;
  let bestDist = Infinity;
  for (const sw of state.switches) {
    const x = state.offsetX + (sw.xPercent / 100 * scale.scaledWidth);
    const y = state.offsetY + (sw.yPercent / 100 * scale.scaledHeight);
    const distance = Math.sqrt(Math.pow(pointX - x, 2) + Math.pow(pointY - y, 2));
    if (distance <= radius && distance < bestDist) {
      best = sw;
      bestDist = distance;
    }
  }
  return best;
}

// Prefer closer icon; keep current hover when both still under the cursor.
function getDeviceAtPoint(pointX, pointY) {
  const scale = getMapScale();
  if (!scale) return null;

  const ap = getAPAtPoint(pointX, pointY);
  const sw = getSwitchAtPoint(pointX, pointY);
  if (!ap && !sw) return null;
  if (ap && !sw) return { type: 'ap', device: ap, key: accessPointKey(ap) };
  if (sw && !ap) return { type: 'switch', device: sw, key: switchKey(sw) };

  const ax = state.offsetX + (ap.position.xPercent / 100 * scale.scaledWidth);
  const ay = state.offsetY + (ap.position.yPercent / 100 * scale.scaledHeight);
  const sx = state.offsetX + (sw.xPercent / 100 * scale.scaledWidth);
  const sy = state.offsetY + (sw.yPercent / 100 * scale.scaledHeight);
  const apDist = Math.hypot(pointX - ax, pointY - ay);
  const swDist = Math.hypot(pointX - sx, pointY - sy);

  if (state.hoveredDevice) {
    if (state.hoveredDevice.type === 'ap' && state.hoveredDevice.key === accessPointKey(ap)) {
      return { type: 'ap', device: ap, key: accessPointKey(ap) };
    }
    if (state.hoveredDevice.type === 'switch' && state.hoveredDevice.key === switchKey(sw)) {
      return { type: 'switch', device: sw, key: switchKey(sw) };
    }
  }

  if (swDist <= apDist) {
    return { type: 'switch', device: sw, key: switchKey(sw) };
  }
  return { type: 'ap', device: ap, key: accessPointKey(ap) };
}

function setHoveredDevice(next) {
  const prev = state.hoveredDevice;
  const same = (!prev && !next) ||
    (prev && next && prev.type === next.type && prev.key === next.key);
  if (same) return false;
  state.hoveredDevice = next ? { type: next.type, key: next.key } : null;
  return true;
}

// Handle Canvas Mouse Move (cursor change + panning + hover bring-to-front)
function handleCanvasMouseMove(e) {
  const rect = elements.canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (state.isPanning) {
    state.panX += mouseX - state.panStartX;
    state.panY += mouseY - state.panStartY;
    state.panStartX = mouseX;
    state.panStartY = mouseY;
    renderFloorPlan();
    return;
  }

  const hit = getDeviceAtPoint(mouseX, mouseY);
  elements.canvas.style.cursor = hit ? 'pointer' : (state.zoom > 1 ? 'grab' : 'default');
  if (setHoveredDevice(hit)) {
    renderFloorPlan();
  }
}

// Handle Canvas Click
function handleCanvasClick(e) {
  // Don't trigger click if we just finished panning
  if (state.didPan) {
    state.didPan = false;
    return;
  }

  const rect = elements.canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const hit = getDeviceAtPoint(clickX, clickY);
  if (!hit) return;

  if (hit.type === 'ap') {
    showAPPopup(hit.device);
  } else {
    showSwitchPopup(hit.device);
  }
}

// Handle Canvas Mouse Down (start panning)
function handleCanvasMouseDown(e) {
  const rect = elements.canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Don't start panning if clicking on an AP or switch
  if (getDeviceAtPoint(mouseX, mouseY)) return;

  state.isPanning = true;
  state.didPan = false;
  state.panStartX = mouseX;
  state.panStartY = mouseY;
  elements.canvas.style.cursor = 'grabbing';
}

// Handle Canvas Mouse Up (stop panning)
function handleCanvasMouseUp() {
  if (state.isPanning) {
    state.isPanning = false;
    // If we moved while panning, suppress the click
    state.didPan = true;
    elements.canvas.style.cursor = state.zoom > 1 ? 'grab' : 'default';
  }
}

// Handle Canvas Mouse Leave (stop panning / clear hover)
function handleCanvasMouseLeave() {
  if (state.isPanning) {
    state.isPanning = false;
    state.didPan = false;
  }
  if (setHoveredDevice(null)) {
    renderFloorPlan();
  }
}

// Handle Canvas Wheel (zoom toward cursor)
function handleCanvasWheel(e) {
  e.preventDefault();

  const rect = elements.canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const oldZoom = state.zoom;
  const zoomFactor = 1.1;

  if (e.deltaY < 0) {
    state.zoom = Math.min(state.zoom * zoomFactor, state.maxZoom);
  } else {
    state.zoom = Math.max(state.zoom / zoomFactor, state.minZoom);
  }

  // Adjust pan to keep the point under the cursor stationary
  const zoomRatio = state.zoom / oldZoom;
  const containerWidth = elements.canvas.width;
  const containerHeight = elements.canvas.height;

  // The center of the image (before pan) is at canvas center
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;

  // Offset from center to mouse, including current pan
  const dx = mouseX - centerX - state.panX;
  const dy = mouseY - centerY - state.panY;

  state.panX -= dx * (zoomRatio - 1);
  state.panY -= dy * (zoomRatio - 1);

  renderFloorPlan();
}

// Zoom In Button
function handleZoomIn() {
  const oldZoom = state.zoom;
  state.zoom = Math.min(state.zoom * 1.25, state.maxZoom);
  const zoomRatio = state.zoom / oldZoom;

  // Zoom toward canvas center: pan stays proportional
  state.panX *= zoomRatio;
  state.panY *= zoomRatio;

  renderFloorPlan();
}

// Zoom Out Button
function handleZoomOut() {
  const oldZoom = state.zoom;
  state.zoom = Math.max(state.zoom / 1.25, state.minZoom);
  const zoomRatio = state.zoom / oldZoom;

  state.panX *= zoomRatio;
  state.panY *= zoomRatio;

  renderFloorPlan();
}

// Reset Zoom Button
function handleZoomReset() {
  resetZoomPan();
  renderFloorPlan();
}

// Reset zoom and pan state
function resetZoomPan() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.isPanning = false;
}

// Handle Font Size Change
function handleFontSizeChange(multiplier) {
  state.fontSizeMultiplier = multiplier;

  // Update button active states
  elements.fontSizeSmallBtn.classList.remove('active');
  elements.fontSizeMediumBtn.classList.remove('active');
  elements.fontSizeLargeBtn.classList.remove('active');

  if (multiplier === 1) {
    elements.fontSizeSmallBtn.classList.add('active');
  } else if (multiplier === 1.5) {
    elements.fontSizeMediumBtn.classList.add('active');
  } else if (multiplier === 2) {
    elements.fontSizeLargeBtn.classList.add('active');
  }

  // Re-render the floor plan with new font size
  renderFloorPlan();
}

// Show AP Popup
function showAPPopup(ap) {
  closeSwitchPopup();

  elements.apName.textContent = ap.name || 'Access Point';
  elements.apMac.textContent = ap.mac || 'N/A';
  elements.apIp.textContent = ap.ipAddress || ap.ip || 'N/A';

  // API uses 'state' field (e.g., "Operational", "Offline")
  const status = ap.state || ap.subState || 'Unknown';
  elements.apStatus.textContent = status;
  elements.apStatus.className = 'value';
  if (status.toLowerCase() === 'operational' || status.toLowerCase() === 'online') {
    elements.apStatus.classList.add('status-online');
  } else if (status.toLowerCase() === 'offline' || status.toLowerCase() === 'disconnected') {
    elements.apStatus.classList.add('status-offline');
  }

  elements.apModel.textContent = ap.model || 'N/A';
  elements.apSerial.textContent = ap.serialNumber || 'N/A';

  // Store AP reference for single-AP PoE query
  state.selectedPopupAP = ap;

  // Enable button only when AP is Operational/online
  const isOperational = status.toLowerCase() === 'operational' || status.toLowerCase() === 'online';
  elements.apPoeQueryBtn.disabled = !isOperational;

  elements.apPopup.classList.remove('hidden');
}

// Close AP Popup
function closeAPPopup() {
  elements.apPopup.classList.add('hidden');
}

// Show Switch Popup
function showSwitchPopup(sw) {
  closeAPPopup();

  elements.switchName.textContent = switchHostname(sw) || 'Switch';
  elements.switchModel.textContent = sw.model || 'N/A';
  elements.switchMac.textContent = sw.switchMac || 'N/A';
  elements.switchIp.textContent = sw.ipAddress || 'N/A';
  elements.switchUptime.textContent = sw.uptime || 'N/A';
  elements.switchIncidents.textContent =
    sw.alerts === undefined || sw.alerts === null ? 'N/A' : String(sw.alerts);
  elements.switchClients.textContent =
    sw.clientCount === undefined || sw.clientCount === null ? 'N/A' : String(sw.clientCount);

  const status = sw.deviceStatus || 'Unknown';
  elements.switchStatus.textContent = status;
  elements.switchStatus.className = 'value status-with-dot';
  const statusLower = String(status).toLowerCase();
  if (statusLower === 'operational' || statusLower === 'online') {
    elements.switchStatus.classList.add('status-online');
  } else if (statusLower === 'offline' || statusLower === 'disconnected') {
    elements.switchStatus.classList.add('status-offline');
  } else if (statusLower.includes('warn') || statusLower.includes('degraded')) {
    elements.switchStatus.classList.add('status-warning');
  }

  elements.switchPopup.classList.remove('hidden');
}

function closeSwitchPopup() {
  elements.switchPopup.classList.add('hidden');
}

// Fuzzy search - checks if query matches text loosely
function fuzzyMatch(query, text) {
  if (!query || !text) return false;
  query = query.toLowerCase();
  text = text.toLowerCase();

  let queryIndex = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === query[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === query.length;
}

// Handle AP Search
function handleAPSearch(e) {
  const query = e.target.value.trim();

  if (!query) {
    elements.apSearchDropdown.classList.add('hidden');
    state.searchResults = [];
    state.selectedSearchAP = null;
    renderFloorPlan();
    return;
  }

  // Search for matching APs by name or serial
  state.searchResults = state.accessPoints.filter(ap => {
    const name = ap.name || '';
    const serial = ap.serialNumber || '';
    return fuzzyMatch(query, name) || fuzzyMatch(query, serial);
  });

  renderAPSearchDropdown();
  elements.apSearchDropdown.classList.remove('hidden');
  renderFloorPlan();
}

// Render AP Search Dropdown
function renderAPSearchDropdown() {
  elements.apSearchDropdown.innerHTML = '';

  if (state.searchResults.length === 0) {
    elements.apSearchDropdown.innerHTML = '<div class="ap-search-no-results">No access points found</div>';
    return;
  }

  state.searchResults.forEach((ap, index) => {
    const item = document.createElement('div');
    item.className = 'ap-search-item';
    if (state.selectedSearchAP && state.selectedSearchAP.mac === ap.mac) {
      item.classList.add('selected');
    }

    item.innerHTML = `
      <div class="ap-search-item-name">${escapeHtml(ap.name || 'Unnamed AP')}</div>
      <div class="ap-search-item-serial">${escapeHtml(ap.serialNumber || 'N/A')}</div>
    `;

    item.addEventListener('click', () => selectAPFromSearch(ap));
    elements.apSearchDropdown.appendChild(item);
  });
}

// Select AP from Search Dropdown
function selectAPFromSearch(ap) {
  state.selectedSearchAP = ap;
  elements.apSearch.value = ap.name || '';
  elements.apSearchDropdown.classList.add('hidden');
  renderFloorPlan();
}

// Handle Clear AP Search
function handleClearAPSearch() {
  elements.apSearch.value = '';
  elements.apSearchDropdown.classList.add('hidden');
  state.searchResults = [];
  state.selectedSearchAP = null;
  closeAPSearchPopup();
  renderFloorPlan();
}

// Toggle AP Search Popup
function toggleAPSearchPopup() {
  if (elements.apSearchPopup.classList.contains('hidden')) {
    elements.apSearchPopup.classList.remove('hidden');
    setTimeout(() => elements.apSearch.focus(), 50);
  } else {
    closeAPSearchPopup();
  }
}

// Close AP Search Popup
function closeAPSearchPopup() {
  elements.apSearchPopup.classList.add('hidden');
  elements.apSearchDropdown.classList.add('hidden');
}

// Toggle Settings Menu
function toggleSettingsMenu() {
  elements.settingsMenu.classList.toggle('hidden');
}

// Close Settings Menu
function closeSettingsMenu() {
  elements.settingsMenu.classList.add('hidden');
}

// Show PoE cache choice modal
function showPoECacheChoiceModal() {
  elements.poeCacheChoiceModal.classList.remove('hidden');
}

// Start floor-plan PoE query from the plug icon (cache choice or confirm dialog)
async function startFloorPlanPoeQuery() {
  if (state.poeQueryInProgress) return;
  if (!state.selectedFloorPlan) return;

  const hasCachedData = state.poeDataByFloorPlan[state.selectedFloorPlan.id];
  if (hasCachedData) {
    showPoECacheChoiceModal();
    return;
  }

  const confirmed = await confirmPoeQuery();
  if (!confirmed) return;

  const ok = await fetchPoEInfo();
  if (ok) {
    state.showPoE = true;
    elements.poeCheck.textContent = '☑';
    renderFloorPlan();
  }
}

// Confirm before asking RUCKUS One to refresh LLDP and read PoE
function confirmPoeQuery() {
  return new Promise((resolve) => {
    window.sshConfirmationResult = null;
    elements.sshModal.classList.remove('hidden');

    // Set up a check for the result
    const checkResult = setInterval(() => {
      if (window.sshConfirmationResult !== null) {
        clearInterval(checkResult);
        resolve(window.sshConfirmationResult);
      }
    }, 100);

    // Timeout after 60 seconds
    setTimeout(() => {
      clearInterval(checkResult);
      if (window.sshConfirmationResult === null) {
        elements.sshModal.classList.add('hidden');
        resolve(false);
      }
    }, 60000);
  });
}

function poeQueryPayload(ap) {
  return {
    serialNumber: ap.serialNumber,
    name: ap.name,
    mac: (ap.mac || ap.macAddress || '').toLowerCase(),
    model: ap.model,
    state: ap.state || ap.subState || ap.status || ''
  };
}

function showPoeProgress(info) {
  const percent = Math.max(0, Math.min(100, info.percent || 0));
  elements.progressFill.style.width = percent + '%';
  elements.progressText.textContent = info.message || '';
  elements.currentApText.textContent = info.detail || '';
}

// Fetch PoE for every AP on the current floor plan from RUCKUS One.
async function fetchPoEInfo() {
  return runPoeQuery(state.accessPoints, { replaceAll: true });
}

// Fetch PoE for the AP opened from the map popup.
async function fetchSingleAPPoEInfo(ap) {
  const ok = await runPoeQuery([ap], { replaceAll: false });
  if (ok && !state.showPoE) {
    state.showPoE = true;
    elements.poeCheck.textContent = '☑';
    renderFloorPlan();
  }
}

async function runPoeQuery(aps, { replaceAll }) {
  if (state.poeQueryInProgress) return false;
  if (!aps || aps.length === 0) {
    console.log('[PoE] No access points loaded');
    return false;
  }
  if (!state.selectedVenue || !state.selectedFloorPlan) return false;

  state.poeQueryInProgress = true;
  state.poeShouldCancel = false;
  elements.poeProgressModal.classList.remove('hidden');
  elements.progressFill.style.width = '0%';
  elements.progressText.textContent = 'Contacting RUCKUS One...';
  elements.currentApText.textContent = '';

  const stopProgress = window.api.onPoeProgress(showPoeProgress);

  try {
    const result = await window.api.queryApPoe({
      venueId: state.selectedVenue.id,
      aps: aps.map(poeQueryPayload)
    });

    if (!result.success) {
      throw new Error(result.error || 'PoE query failed');
    }

    const labels = result.data || {};
    if (replaceAll) {
      state.apPoeInfo = labels;
    } else {
      state.apPoeInfo = { ...state.apPoeInfo, ...labels };
    }
    state.poeDataByFloorPlan[state.selectedFloorPlan.id] = { ...state.apPoeInfo };
    console.log('[PoE] Loaded', Object.keys(labels).length, 'AP labels');

    elements.progressFill.style.width = '100%';
    elements.progressText.textContent = result.cancelled ? 'Cancelled' : 'Complete';
    elements.currentApText.textContent = '';

    setTimeout(() => {
      elements.poeProgressModal.classList.add('hidden');
      state.poeQueryInProgress = false;
      renderFloorPlan();
    }, 500);
    return true;
  } catch (error) {
    console.error('Error fetching PoE info:', error);
    elements.progressText.textContent = 'PoE query failed';
    elements.currentApText.textContent = error.message || 'Unknown error';
    state.poeQueryInProgress = false;
    if (replaceAll && Object.keys(state.apPoeInfo).length === 0) {
      state.showPoE = false;
      elements.poeCheck.textContent = '☐';
    }
    setTimeout(() => {
      elements.poeProgressModal.classList.add('hidden');
    }, 2500);
    return false;
  } finally {
    stopProgress();
  }
}

// Utility: Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
init();
