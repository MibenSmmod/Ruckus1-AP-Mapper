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
  // Venue browser (FR#10)
  favoriteVenueIds: [], // string ids for current tenant
  venueViewMode: 'tiles', // 'tiles' | 'list'
  venuePageSize: 10, // 10 | 20 | 50 | 100 | 'all'
  venuePage: 1,
  venueNameSort: 'asc', // 'asc' | 'desc' — alphabetical within favorites / others
  venueHasFloorImage: {}, // venueId -> true | false (undefined = not probed yet)
  venueFloorImageProbeId: 0, // increments to ignore stale background probes
  floorPlanImage: null,
  floorPlanThumbnails: {}, // floorPlanId -> data URL (cache for picker previews)
  floorPlanThumbLoadId: 0, // increments to ignore stale thumbnail fetches
  // Venue-wide device cache (FR#6) — reused when jumping floors
  venueDevices: { accessPoints: [], switches: [], fetchedAt: null },
  venueDeviceCounts: { accessPoints: 0, switches: 0 },
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
  mapOpacityPercent: 75, // FR#19 floor-plan image opacity (1–100); per-floor default 75
  searchResults: [], // { type: 'ap'|'switch', device }
  selectedSearchDevice: null, // { type: 'ap'|'switch', device }
  searchKeyboardIndex: -1, // keyboard highlight in search dropdown (FR#11)
  // FR#17 Global Search
  mapLoadId: 0, // newest loadFloorPlanData call; older responses are ignored
  floorPlanListLoadId: 0, // newest loadFloorPlans call; older responses are ignored
  globalSearchIndex: null, // { accessPoints, switches, floorsById, fetchedAt }
  globalSearchHits: [], // matched hits for modal list
  globalSearchBuilding: false,
  pendingSearchFocus: null, // { type, key, queryText } after Jump from global search
  showHostname: true,
  showPoE: true, // Display Power Levels (switch budget + cached AP PoE); default on each launch
  showLldp: true, // Display LLDP uplink (switch · port) under PoE; default on each launch
  showBandInfo: true, // Display 2G/5G/6G channel labels; default on each launch
  showAPs: true, // Display APs; default on each launch
  showSwitches: true, // Display Switches; default on each launch
  darkMode: true,
  legendCollapsed: false,
  // Map filters (FR#2) — empty models[] means all models
  mapFilters: {
    status: 'all', // all | online | offline
    band: 'all',   // all | 6ghz | no6ghz
    afc: 'all',    // all | sp | lpi
    models: []
  },
  poeQueryInProgress: false,
  poeShouldCancel: false,
  apPoeInfo: {}, // Map of AP MAC to PoE label (e.g., "802.3bt C5 40.3W / Using 14.1W")
  apPoeDetails: {}, // Map of AP MAC to structured PoE detail (FR#4)
  poeDataByFloorPlan: {}, // Cache { labels, details, fetchedAt } per floor plan ID
  floorDataFetchedAt: null, // epoch ms when floor image/APs/switches last loaded
  poeFetchedAt: null, // epoch ms for active floor PoE cache (null = not queried)
  selectedPopupAP: null, // AP object shown in the popup
  hoveredDevice: null, // { type: 'ap'|'switch', key: string } — drawn on top
  drawPixelRatio: 1, // >1 while rendering a high-res export canvas
  // FR#18 Edit / move device locations
  editMode: false,
  editBannerDismissed: false, // hide tip for this edit session only
  unplacedPanelDismissed: false, // hide unplaced panel for this edit session only
  unplacedSearchQuery: '',
  canWritePositions: null, // null = unverified (probe or first move decides), true/false after
  deviceDrag: null // active drag incl. source 'map'|'unplaced'
};

// Freshness thresholds for the map summary strip (FR#5 / FR#13)
const FLOOR_STALE_MS = 15 * 60 * 1000; // 15 minutes
const POE_STALE_MS = 30 * 60 * 1000;   // 30 minutes
const SUMMARY_TICK_MS = 30 * 1000;     // refresh "Xm ago" labels
let summaryAgeTimer = null;

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
  venueToolbar: document.getElementById('venue-toolbar'),
  venueViewTiles: document.getElementById('venue-view-tiles'),
  venueViewList: document.getElementById('venue-view-list'),
  venuePageSize: document.getElementById('venue-page-size'),
  venueList: document.getElementById('venue-list'),
  venuePagination: document.getElementById('venue-pagination'),
  venuePagePrev: document.getElementById('venue-page-prev'),
  venuePageNext: document.getElementById('venue-page-next'),
  venuePageInfo: document.getElementById('venue-page-info'),
  venueError: document.getElementById('venue-error'),
  logoutBtn: document.getElementById('logout-btn'),
  globalSearchBtn: document.getElementById('global-search-btn'),

  // Global Search Modal (FR#17)
  globalSearchModal: document.getElementById('global-search-modal'),
  globalSearchClose: document.getElementById('global-search-close'),
  globalSearchForm: document.getElementById('global-search-form'),
  globalSearchInput: document.getElementById('global-search-input'),
  globalSearchSubmit: document.getElementById('global-search-submit'),
  globalSearchRefresh: document.getElementById('global-search-refresh'),
  globalSearchProgress: document.getElementById('global-search-progress'),
  globalSearchProgressFill: document.getElementById('global-search-progress-fill'),
  globalSearchProgressText: document.getElementById('global-search-progress-text'),
  globalSearchStatus: document.getElementById('global-search-status'),
  globalSearchResults: document.getElementById('global-search-results'),
  globalSearchCancel: document.getElementById('global-search-cancel'),

  // Floor Plan Selection
  backToVenues: document.getElementById('back-to-venues'),
  venueName: document.getElementById('venue-name'),
  venueDeviceTotals: document.getElementById('venue-device-totals'),
  floorplanLoading: document.getElementById('floorplan-loading'),
  floorplanList: document.getElementById('floorplan-list'),
  floorplanError: document.getElementById('floorplan-error'),
  logoutBtn2: document.getElementById('logout-btn-2'),

  // Map
  backToFloorplans: document.getElementById('back-to-floorplans'),
  mapVenueName: document.getElementById('map-venue-name'),
  mapFloorName: document.getElementById('map-floor-name'),
  floorSwitcherBtn: document.getElementById('floor-switcher-btn'),
  floorSwitcherMenu: document.getElementById('floor-switcher-menu'),
  refreshBtn: document.getElementById('refresh-btn'),
  editModeBtn: document.getElementById('edit-mode-btn'),
  editUnplacedBadge: document.getElementById('edit-unplaced-badge'),
  editModeBanner: document.getElementById('edit-mode-banner'),
  editModeBannerDismiss: document.getElementById('edit-mode-banner-dismiss'),
  unplacedDevicesPanel: document.getElementById('unplaced-devices-panel'),
  unplacedDevicesTitle: document.getElementById('unplaced-devices-title'),
  unplacedDevicesDismiss: document.getElementById('unplaced-devices-dismiss'),
  unplacedDevicesSearch: document.getElementById('unplaced-devices-search'),
  unplacedDevicesList: document.getElementById('unplaced-devices-list'),
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

  // Map Opacity (FR#19)
  mapOpacitySlider: document.getElementById('map-opacity-slider'),
  mapOpacityLabel: document.getElementById('map-opacity-label'),
  mapOpacityInput: document.getElementById('map-opacity-input'),

  // Getting Started (FR#20)
  gettingStartedBtn: document.getElementById('getting-started-btn'),
  gettingStartedModal: document.getElementById('getting-started-modal'),
  gettingStartedChecklist: document.getElementById('getting-started-checklist'),
  closeGettingStartedBtn: document.getElementById('close-getting-started-btn'),
  gettingStartedDoneBtn: document.getElementById('getting-started-done-btn'),
  gettingStartedResetBtn: document.getElementById('getting-started-reset-btn'),

  // Search
  apSearchToggle: document.getElementById('ap-search-toggle'),
  apSearchPopup: document.getElementById('ap-search-popup'),
  apSearch: document.getElementById('ap-search'),
  apSearchClear: document.getElementById('ap-search-clear'),
  apSearchDropdown: document.getElementById('ap-search-dropdown'),

  // Filters
  mapFilterToggle: document.getElementById('map-filter-toggle'),
  mapFilterPopup: document.getElementById('map-filter-popup'),
  mapFilterClear: document.getElementById('map-filter-clear'),
  mapFilterBadge: document.getElementById('map-filter-badge'),
  filterModelOptions: document.getElementById('filter-model-options'),

  // Settings
  settingsBtn: document.getElementById('settings-btn'),
  settingsMenu: document.getElementById('settings-menu'),
  toggleHostname: document.getElementById('toggle-hostname'),
  hostnameCheck: document.getElementById('hostname-check'),
  togglePoe: document.getElementById('toggle-poe'),
  poeCheck: document.getElementById('poe-check'),
  toggleLldp: document.getElementById('toggle-lldp'),
  lldpCheck: document.getElementById('lldp-check'),
  toggleBandInfo: document.getElementById('toggle-band-info'),
  bandInfoCheck: document.getElementById('band-info-check'),
  toggleAPs: document.getElementById('toggle-aps'),
  apsCheck: document.getElementById('aps-check'),
  toggleSwitches: document.getElementById('toggle-switches'),
  switchesCheck: document.getElementById('switches-check'),
  toggleDarkMode: document.getElementById('toggle-dark-mode'),
  darkModeCheck: document.getElementById('dark-mode-check'),

  // Export
  exportBtn: document.getElementById('export-btn'),
  exportMenu: document.getElementById('export-menu'),
  exportPng: document.getElementById('export-png'),
  exportPdf: document.getElementById('export-pdf'),

  // PoE Query button
  poeQueryBtn: document.getElementById('poe-query-btn'),
  poeSummaryBtn: document.getElementById('poe-summary-btn'),

  // Map legend + summary strip (FR#5 / FR#13)
  mapSummary: document.getElementById('map-summary'),
  legendToggle: document.getElementById('legend-toggle'),
  summaryApOnlineCount: document.getElementById('summary-ap-online-count'),
  summaryApOfflineCount: document.getElementById('summary-ap-offline-count'),
  summaryApOtherStat: document.getElementById('summary-ap-other-stat'),
  summaryApOtherCount: document.getElementById('summary-ap-other-count'),
  summarySwOnlineCount: document.getElementById('summary-sw-online-count'),
  summarySwOfflineCount: document.getElementById('summary-sw-offline-count'),
  summarySwOtherStat: document.getElementById('summary-sw-other-stat'),
  summarySwOtherCount: document.getElementById('summary-sw-other-count'),
  summaryPoeChips: document.getElementById('summary-poe-chips'),
  summaryFloorAge: document.getElementById('summary-floor-age'),
  summaryFloorStale: document.getElementById('summary-floor-stale'),
  summaryPoeAge: document.getElementById('summary-poe-age'),
  summaryPoeStale: document.getElementById('summary-poe-stale'),

  // SSH Confirmation Modal
  sshModal: document.getElementById('ssh-confirmation-modal'),
  sshConfirmBtn: document.getElementById('ssh-confirm-btn'),
  sshCancelBtn: document.getElementById('ssh-cancel-btn'),
  sshCloseBtn: document.getElementById('ssh-close-btn'),

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

  // PoE Budget Rollup Modal (FR#4)
  poeRollupModal: document.getElementById('poe-rollup-modal'),
  poeRollupClose: document.getElementById('poe-rollup-close'),
  poeRollupFloor: document.getElementById('poe-rollup-floor'),
  poeRollupSwitches: document.getElementById('poe-rollup-switches'),
  poeRollupIssues: document.getElementById('poe-rollup-issues'),

  // Keyboard Shortcuts Modal (FR#11)
  shortcutsModal: document.getElementById('shortcuts-modal'),
  closeShortcutsBtn: document.getElementById('close-shortcuts-btn'),
  shortcutsDoneBtn: document.getElementById('shortcuts-done-btn'),

  // AP Popup
  apPopup: document.getElementById('ap-popup'),
  closePopup: document.getElementById('close-popup'),
  apName: document.getElementById('ap-name'),
  apMac: document.getElementById('ap-mac'),
  apIp: document.getElementById('ap-ip'),
  apStatus: document.getElementById('ap-status'),
  apModel: document.getElementById('ap-model'),
  apSerial: document.getElementById('ap-serial'),
  apClients: document.getElementById('ap-clients'),
  apClientsByBandRow: document.getElementById('ap-clients-by-band-row'),
  apClientsByBand: document.getElementById('ap-clients-by-band'),
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
  switchClients: document.getElementById('switch-clients'),
  switchPoeRow: document.getElementById('switch-poe-row'),
  switchPoe: document.getElementById('switch-poe'),
  switchPoeIssuesRow: document.getElementById('switch-poe-issues-row'),
  switchPoeIssues: document.getElementById('switch-poe-issues')
};

// Canvas context (swapped temporarily during offscreen export)
let ctx = elements.canvas.getContext('2d');

const THEME_STORAGE_KEY = 'r1-mapper-color-theme';
const LEGEND_COLLAPSED_KEY = 'r1-mapper-legend-collapsed';
const VENUE_FAVORITES_KEY = 'r1-mapper-venue-favorites';
const VENUE_PAGE_SIZE_KEY = 'r1-mapper-venue-page-size';
const VENUE_VIEW_MODE_KEY = 'r1-mapper-venue-view-mode';
const MAP_OPACITY_KEY = 'r1-mapper-map-opacity';
const GETTING_STARTED_KEY = 'r1-mapper-getting-started';
const DEFAULT_MAP_OPACITY = 75;
const VENUE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 'all'];

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

function readLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // Ignore storage errors
  }
}

function loadGettingStartedProgress() {
  try {
    const raw = readLocalStorage(GETTING_STARTED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveGettingStartedProgress(progress) {
  writeLocalStorage(GETTING_STARTED_KEY, JSON.stringify(progress || {}));
}

function getGettingStartedCheckboxes() {
  if (!elements.gettingStartedChecklist) return [];
  return Array.from(elements.gettingStartedChecklist.querySelectorAll('input[type="checkbox"][data-gs-id]'));
}

function applyGettingStartedProgress(progress) {
  const checked = progress || {};
  getGettingStartedCheckboxes().forEach((input) => {
    const id = input.getAttribute('data-gs-id');
    input.checked = !!(id && checked[id]);
  });
}

function collectGettingStartedProgress() {
  const progress = {};
  getGettingStartedCheckboxes().forEach((input) => {
    const id = input.getAttribute('data-gs-id');
    if (id && input.checked) progress[id] = true;
  });
  return progress;
}

function persistGettingStartedProgressFromUi() {
  saveGettingStartedProgress(collectGettingStartedProgress());
}

function resetGettingStartedProgress() {
  saveGettingStartedProgress({});
  applyGettingStartedProgress({});
}

function loadVenueBrowserPrefs() {
  const pageSizeRaw = readLocalStorage(VENUE_PAGE_SIZE_KEY);
  if (pageSizeRaw === 'all') {
    state.venuePageSize = 'all';
  } else {
    const n = parseInt(pageSizeRaw, 10);
    state.venuePageSize = VENUE_PAGE_SIZE_OPTIONS.includes(n) ? n : 10;
  }

  const viewMode = readLocalStorage(VENUE_VIEW_MODE_KEY);
  state.venueViewMode = viewMode === 'list' ? 'list' : 'tiles';

  if (elements.venuePageSize) {
    elements.venuePageSize.value = String(state.venuePageSize);
  }
  syncVenueViewToggle();
}

function loadFavoriteVenueIdsForTenant(tenantId) {
  if (!tenantId) {
    state.favoriteVenueIds = [];
    return;
  }
  try {
    const raw = readLocalStorage(VENUE_FAVORITES_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const ids = Array.isArray(all?.[tenantId]) ? all[tenantId] : [];
    state.favoriteVenueIds = ids.map(String);
  } catch (_) {
    state.favoriteVenueIds = [];
  }
}

function saveFavoriteVenueIdsForTenant(tenantId) {
  if (!tenantId) return;
  try {
    const raw = readLocalStorage(VENUE_FAVORITES_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[tenantId] = state.favoriteVenueIds.slice();
    writeLocalStorage(VENUE_FAVORITES_KEY, JSON.stringify(all));
  } catch (_) {
    // Ignore storage errors
  }
}

function isVenueFavorite(venueId) {
  return state.favoriteVenueIds.includes(String(venueId));
}

function clampMapOpacity(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n)) return DEFAULT_MAP_OPACITY;
  return Math.min(100, Math.max(1, Math.round(n)));
}

function getMapOpacityForFloor(floorPlanId) {
  if (!floorPlanId) return DEFAULT_MAP_OPACITY;
  try {
    const raw = readLocalStorage(MAP_OPACITY_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return clampMapOpacity(all?.[String(floorPlanId)]);
  } catch (_) {
    return DEFAULT_MAP_OPACITY;
  }
}

function setMapOpacityForFloor(floorPlanId, percent) {
  if (!floorPlanId) return;
  try {
    const raw = readLocalStorage(MAP_OPACITY_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[String(floorPlanId)] = clampMapOpacity(percent);
    writeLocalStorage(MAP_OPACITY_KEY, JSON.stringify(all));
  } catch (_) {
    // Ignore storage errors
  }
}

let mapOpacityEditing = false;

function syncMapOpacityControls() {
  const percent = clampMapOpacity(state.mapOpacityPercent);
  state.mapOpacityPercent = percent;
  if (elements.mapOpacitySlider) {
    elements.mapOpacitySlider.value = String(percent);
  }
  if (elements.mapOpacityLabel && !mapOpacityEditing) {
    elements.mapOpacityLabel.textContent = `${percent}%`;
    elements.mapOpacityLabel.setAttribute(
      'aria-label',
      `Floor plan opacity ${percent} percent. Click to type a value.`
    );
  }
  if (elements.mapOpacityInput && !mapOpacityEditing) {
    elements.mapOpacityInput.value = String(percent);
  }
}

function applyMapOpacityForSelectedFloor() {
  const floorPlanId = state.selectedFloorPlan?.id;
  state.mapOpacityPercent = getMapOpacityForFloor(floorPlanId);
  endMapOpacityEdit(false);
  syncMapOpacityControls();
}

function handleMapOpacityChange(rawValue) {
  const percent = clampMapOpacity(rawValue);
  state.mapOpacityPercent = percent;
  syncMapOpacityControls();
  const floorPlanId = state.selectedFloorPlan?.id;
  if (floorPlanId) {
    setMapOpacityForFloor(floorPlanId, percent);
  }
  renderFloorPlan();
}

function beginMapOpacityEdit() {
  if (!elements.mapOpacityLabel || !elements.mapOpacityInput || mapOpacityEditing) return;
  mapOpacityEditing = true;
  elements.mapOpacityInput.value = String(clampMapOpacity(state.mapOpacityPercent));
  elements.mapOpacityLabel.classList.add('hidden');
  elements.mapOpacityInput.classList.remove('hidden');
  elements.mapOpacityInput.focus();
  elements.mapOpacityInput.select();
}

function endMapOpacityEdit(commit) {
  if (!elements.mapOpacityLabel || !elements.mapOpacityInput) return;
  if (!mapOpacityEditing && elements.mapOpacityInput.classList.contains('hidden')) return;

  const raw = elements.mapOpacityInput.value;
  mapOpacityEditing = false;
  elements.mapOpacityInput.classList.add('hidden');
  elements.mapOpacityLabel.classList.remove('hidden');

  if (commit) {
    handleMapOpacityChange(raw === '' ? state.mapOpacityPercent : raw);
  } else {
    syncMapOpacityControls();
  }
}

function toggleVenueFavorite(venueId) {
  const id = String(venueId);
  const idx = state.favoriteVenueIds.indexOf(id);
  if (idx >= 0) {
    state.favoriteVenueIds.splice(idx, 1);
  } else {
    state.favoriteVenueIds.push(id);
  }
  saveFavoriteVenueIdsForTenant(state.tenantId);
  renderVenueList();
}

function syncVenueViewToggle() {
  const isTiles = state.venueViewMode !== 'list';
  if (elements.venueViewTiles) {
    elements.venueViewTiles.classList.toggle('active', isTiles);
    elements.venueViewTiles.setAttribute('aria-pressed', isTiles ? 'true' : 'false');
  }
  if (elements.venueViewList) {
    elements.venueViewList.classList.toggle('active', !isTiles);
    elements.venueViewList.setAttribute('aria-pressed', !isTiles ? 'true' : 'false');
  }
}

function setVenueViewMode(mode) {
  state.venueViewMode = mode === 'list' ? 'list' : 'tiles';
  writeLocalStorage(VENUE_VIEW_MODE_KEY, state.venueViewMode);
  syncVenueViewToggle();
  renderVenueList();
}

function setVenuePageSize(value) {
  if (value === 'all') {
    state.venuePageSize = 'all';
  } else {
    const n = parseInt(value, 10);
    state.venuePageSize = VENUE_PAGE_SIZE_OPTIONS.includes(n) ? n : 10;
  }
  state.venuePage = 1;
  writeLocalStorage(VENUE_PAGE_SIZE_KEY, String(state.venuePageSize));
  renderVenueList();
}

function compareVenueNames(a, b) {
  const nameA = (a.name || 'Unnamed Venue').toLocaleLowerCase();
  const nameB = (b.name || 'Unnamed Venue').toLocaleLowerCase();
  return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
}

function sortVenuesByName(venues, dir) {
  const sorted = venues.slice();
  sorted.sort((a, b) => {
    const cmp = compareVenueNames(a, b);
    return dir === 'desc' ? -cmp : cmp;
  });
  return sorted;
}

function getSortedVenues() {
  const favorites = [];
  const others = [];
  for (const venue of state.venues) {
    if (isVenueFavorite(venue.id)) {
      favorites.push(venue);
    } else {
      others.push(venue);
    }
  }
  const dir = state.venueNameSort === 'desc' ? 'desc' : 'asc';
  return sortVenuesByName(favorites, dir).concat(sortVenuesByName(others, dir));
}

function cycleVenueNameSort() {
  state.venueNameSort = state.venueNameSort === 'asc' ? 'desc' : 'asc';
  state.venuePage = 1;
  renderVenueList();
}

function getVenuePageSlice(sorted) {
  if (state.venuePageSize === 'all') {
    return { pageVenues: sorted, totalPages: 1, page: 1 };
  }
  const size = state.venuePageSize;
  const totalPages = Math.max(1, Math.ceil(sorted.length / size));
  const page = Math.min(Math.max(1, state.venuePage), totalPages);
  state.venuePage = page;
  const start = (page - 1) * size;
  return {
    pageVenues: sorted.slice(start, start + size),
    totalPages,
    page
  };
}

function formatVenueAddress(venue) {
  const addr = venue.address || {};
  return {
    addressLine: addr.addressLine || '',
    country: addr.country || ''
  };
}

function createVenueFavoriteButton(venue) {
  const fav = isVenueFavorite(venue.id);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `venue-fav-btn${fav ? ' is-favorite' : ''}`;
  btn.title = fav ? 'Remove from favorites' : 'Add to favorites';
  btn.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');
  btn.setAttribute('aria-pressed', fav ? 'true' : 'false');
  // Parent row/tile is the Tab stop; keep the star clickable without an extra Tab hop.
  btn.tabIndex = -1;
  btn.textContent = fav ? '★' : '☆';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleVenueFavorite(venue.id);
  });
  return btn;
}

function applyTheme(dark) {
  state.darkMode = !!dark;
  if (state.darkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  if (elements.darkModeCheck) {
    elements.darkModeCheck.textContent = state.darkMode ? '☑' : '☐';
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, state.darkMode ? 'dark' : 'light');
  } catch (_) {
    // Ignore storage errors
  }
  if (window.api.notifyThemeChanged) {
    window.api.notifyThemeChanged(state.darkMode);
  }
  // Refresh map letterbox color when a floor is already open
  if (state.floorPlanImage && screens.map.classList.contains('active')) {
    renderFloorPlan();
  }
}

function getMapBackgroundColor() {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--map-background')
    .trim();
  return value || '#e0e0e0';
}

// Screen Navigation
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
  if (screenName === 'map') {
    startSummaryAgeTimer();
    updateMapSummaryStrip();
  } else {
    stopSummaryAgeTimer();
    if (state.editMode || state.deviceDrag) setEditMode(false);
  }
}

// Initialize Application
async function init() {
  // Default dark; only an explicit 'light' preference opts out
  applyTheme(getStoredTheme() !== 'light');
  loadVenueBrowserPrefs();
  loadLegendCollapsedPref();
  applyGettingStartedProgress(loadGettingStartedProgress());

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

  // Global Search (FR#17)
  if (elements.globalSearchBtn) {
    elements.globalSearchBtn.addEventListener('click', openGlobalSearchModal);
  }
  if (elements.globalSearchClose) {
    elements.globalSearchClose.addEventListener('click', () => closeGlobalSearchModal());
  }
  if (elements.globalSearchCancel) {
    elements.globalSearchCancel.addEventListener('click', () => closeGlobalSearchModal({ cancelIndex: true }));
  }
  if (elements.globalSearchModal) {
    elements.globalSearchModal.addEventListener('click', (e) => {
      if (e.target === elements.globalSearchModal) {
        closeGlobalSearchModal({ cancelIndex: true });
      }
    });
  }
  if (elements.globalSearchForm) {
    elements.globalSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      runGlobalSearch({ forceRefresh: false });
    });
  }
  if (elements.globalSearchRefresh) {
    elements.globalSearchRefresh.addEventListener('click', () => {
      runGlobalSearch({ forceRefresh: true });
    });
  }

  // Venue browser (FR#10)
  elements.venueViewTiles.addEventListener('click', () => setVenueViewMode('tiles'));
  elements.venueViewList.addEventListener('click', () => setVenueViewMode('list'));
  elements.venuePageSize.addEventListener('change', () => {
    setVenuePageSize(elements.venuePageSize.value);
  });
  elements.venuePagePrev.addEventListener('click', () => {
    if (state.venuePage > 1) {
      state.venuePage -= 1;
      renderVenueList();
    }
  });
  elements.venuePageNext.addEventListener('click', () => {
    state.venuePage += 1;
    renderVenueList();
  });

  // Navigation
  elements.backToVenues.addEventListener('click', () => {
    closeFloorSwitcher();
    showScreen('venue');
  });

  elements.backToFloorplans.addEventListener('click', () => {
    closeFloorSwitcher();
    showScreen('floorplan');
  });

  // Floor switcher (FR#6)
  if (elements.floorSwitcherBtn) {
    elements.floorSwitcherBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAPSearchPopup();
      closeMapFilterPopup();
      closeSettingsMenu();
      closeExportMenu();
      toggleFloorSwitcher();
    });
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.floor-switcher')) {
      closeFloorSwitcher();
    }
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
    if (warnIfNoOnlineAps([ap])) return;

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

  // FR#18 Edit mode
  if (elements.editModeBtn) {
    elements.editModeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleEditMode();
    });
  }
  if (elements.editModeBannerDismiss) {
    elements.editModeBannerDismiss.addEventListener('click', (e) => {
      e.stopPropagation();
      state.editBannerDismissed = true;
      syncEditModeUi();
    });
  }
  if (elements.unplacedDevicesDismiss) {
    elements.unplacedDevicesDismiss.addEventListener('click', (e) => {
      e.stopPropagation();
      state.unplacedPanelDismissed = true;
      syncEditModeUi();
    });
  }
  if (elements.unplacedDevicesSearch) {
    elements.unplacedDevicesSearch.addEventListener('input', (e) => {
      state.unplacedSearchQuery = e.target.value || '';
      renderUnplacedDevicesPanel();
    });
    elements.unplacedDevicesSearch.addEventListener('mousedown', (e) => e.stopPropagation());
  }
  if (elements.unplacedDevicesList) {
    elements.unplacedDevicesList.addEventListener('mousedown', handleUnplacedListMouseDown);
  }

  // Zoom controls
  elements.zoomInBtn.addEventListener('click', handleZoomIn);
  elements.zoomOutBtn.addEventListener('click', handleZoomOut);
  elements.zoomResetBtn.addEventListener('click', handleZoomReset);

  // Font size controls
  elements.fontSizeSmallBtn.addEventListener('click', () => handleFontSizeChange(1));
  elements.fontSizeMediumBtn.addEventListener('click', () => handleFontSizeChange(1.5));
  elements.fontSizeLargeBtn.addEventListener('click', () => handleFontSizeChange(2));

  // Map opacity (FR#19)
  if (elements.mapOpacitySlider) {
    elements.mapOpacitySlider.addEventListener('input', (e) => {
      if (mapOpacityEditing) endMapOpacityEdit(false);
      handleMapOpacityChange(e.target.value);
    });
  }
  if (elements.mapOpacityLabel) {
    elements.mapOpacityLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      beginMapOpacityEdit();
    });
  }
  if (elements.mapOpacityInput) {
    elements.mapOpacityInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        endMapOpacityEdit(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        endMapOpacityEdit(false);
      }
    });
    elements.mapOpacityInput.addEventListener('blur', () => {
      if (mapOpacityEditing) endMapOpacityEdit(true);
    });
    elements.mapOpacityInput.addEventListener('click', (e) => e.stopPropagation());
  }
  syncMapOpacityControls();

  // Search
  elements.apSearchToggle.addEventListener('click', () => {
    closeFloorSwitcher();
    toggleAPSearchPopup();
  });
  elements.apSearch.addEventListener('input', handleAPSearch);
  elements.apSearchClear.addEventListener('click', handleClearAPSearch);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.floating-search-panel')) {
      closeAPSearchPopup();
    }
  });

  // Filters
  elements.mapFilterToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAPSearchPopup();
    closeSettingsMenu();
    closeExportMenu();
    closeFloorSwitcher();
    toggleMapFilterPopup();
  });
  elements.mapFilterClear.addEventListener('click', (e) => {
    e.stopPropagation();
    clearMapFilters();
  });
  elements.mapFilterPopup.addEventListener('change', handleMapFilterChange);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.floating-filter-panel')) {
      closeMapFilterPopup();
    }
  });

  document.addEventListener('keydown', handleGlobalKeydown);

  if (elements.gettingStartedBtn) {
    elements.gettingStartedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAPSearchPopup();
      closeMapFilterPopup();
      closeSettingsMenu();
      closeExportMenu();
      closeFloorSwitcher();
      showGettingStartedModal();
    });
  }
  if (elements.closeGettingStartedBtn) {
    elements.closeGettingStartedBtn.addEventListener('click', closeGettingStartedModal);
  }
  if (elements.gettingStartedDoneBtn) {
    elements.gettingStartedDoneBtn.addEventListener('click', closeGettingStartedModal);
  }
  if (elements.gettingStartedResetBtn) {
    elements.gettingStartedResetBtn.addEventListener('click', resetGettingStartedProgress);
  }
  if (elements.gettingStartedChecklist) {
    elements.gettingStartedChecklist.addEventListener('change', (e) => {
      if (e.target && e.target.matches('input[type="checkbox"][data-gs-id]')) {
        persistGettingStartedProgressFromUi();
      }
    });
  }
  if (elements.gettingStartedModal) {
    elements.gettingStartedModal.addEventListener('click', (e) => {
      if (e.target === elements.gettingStartedModal) closeGettingStartedModal();
    });
  }
  if (window.api.onShowGettingStarted) {
    window.api.onShowGettingStarted(() => {
      showGettingStartedModal();
    });
  }

  if (elements.closeShortcutsBtn) {
    elements.closeShortcutsBtn.addEventListener('click', closeShortcutsModal);
  }
  if (elements.shortcutsDoneBtn) {
    elements.shortcutsDoneBtn.addEventListener('click', closeShortcutsModal);
  }
  if (elements.shortcutsModal) {
    elements.shortcutsModal.addEventListener('click', (e) => {
      if (e.target === elements.shortcutsModal) closeShortcutsModal();
    });
  }
  if (window.api.onShowKeyboardShortcuts) {
    window.api.onShowKeyboardShortcuts(() => {
      showShortcutsModal();
    });
  }

  // Export
  elements.exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSettingsMenu();
    closeMapFilterPopup();
    closeFloorSwitcher();
    toggleExportMenu();
  });
  elements.exportPng.addEventListener('click', (e) => {
    e.stopPropagation();
    closeExportMenu();
    exportFloorPlan('png');
  });
  elements.exportPdf.addEventListener('click', (e) => {
    e.stopPropagation();
    closeExportMenu();
    exportFloorPlan('pdf');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.floating-export-panel')) {
      closeExportMenu();
    }
  });
  if (window.api.onExportMapRequest) {
    window.api.onExportMapRequest((format) => {
      if (!screens.map.classList.contains('active') || !state.floorPlanImage) return;
      exportFloorPlan(format === 'pdf' ? 'pdf' : 'png');
    });
  }

  // Legend collapse / expand
  if (elements.legendToggle) {
    elements.legendToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLegendCollapsed();
    });
  }

  // Settings
  elements.settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeExportMenu();
    closeMapFilterPopup();
    closeFloorSwitcher();
    toggleSettingsMenu();
  });

  elements.toggleHostname.addEventListener('click', () => {
    state.showHostname = !state.showHostname;
    elements.hostnameCheck.textContent = state.showHostname ? '☑' : '☐';
    renderFloorPlan();
  });

  elements.toggleAPs.addEventListener('click', () => {
    state.showAPs = !state.showAPs;
    elements.apsCheck.textContent = state.showAPs ? '☑' : '☐';
    if (!state.showAPs) {
      if (state.hoveredDevice && state.hoveredDevice.type === 'ap') state.hoveredDevice = null;
      if (state.selectedSearchDevice && state.selectedSearchDevice.type === 'ap') {
        state.selectedSearchDevice = null;
      }
      closeAPPopup();
    }
    updateDeviceCount();
    renderFloorPlan();
  });

  elements.toggleSwitches.addEventListener('click', () => {
    state.showSwitches = !state.showSwitches;
    elements.switchesCheck.textContent = state.showSwitches ? '☑' : '☐';
    updateDeviceCount();
    renderFloorPlan();
  });

  elements.toggleDarkMode.addEventListener('click', () => {
    applyTheme(!state.darkMode);
  });

  if (window.api.onSetDarkMode) {
    window.api.onSetDarkMode((dark) => {
      applyTheme(dark);
    });
  }

  // Display Power Levels: show/hide switch budget + AP PoE (AP query is from the PoE icon)
  elements.togglePoe.addEventListener('click', () => {
    state.showPoE = !state.showPoE;
    elements.poeCheck.textContent = state.showPoE ? '☑' : '☐';
    renderFloorPlan();
  });

  // Display LLDP Info: show/hide switch name · port under PoE (from cached PoE details)
  elements.toggleLldp.addEventListener('click', () => {
    state.showLldp = !state.showLldp;
    elements.lldpCheck.textContent = state.showLldp ? '☑' : '☐';
    renderFloorPlan();
  });

  // Display Band info: show/hide 2G/5G/6G channel labels beside APs
  elements.toggleBandInfo.addEventListener('click', () => {
    state.showBandInfo = !state.showBandInfo;
    elements.bandInfoCheck.textContent = state.showBandInfo ? '☑' : '☐';
    renderFloorPlan();
  });

  elements.poeQueryBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeSettingsMenu();
    closeExportMenu();
    closeMapFilterPopup();
    closeFloorSwitcher();
    await startFloorPlanPoeQuery();
  });

  if (elements.poeSummaryBtn) {
    elements.poeSummaryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSettingsMenu();
      closeExportMenu();
      closeMapFilterPopup();
      closeFloorSwitcher();
      showPoeRollupModal();
    });
  }

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
    dismissSshConfirmation();
  });

  if (elements.sshCloseBtn) {
    elements.sshCloseBtn.addEventListener('click', dismissSshConfirmation);
  }

  if (elements.sshModal) {
    elements.sshModal.addEventListener('click', (e) => {
      if (e.target === elements.sshModal) {
        dismissSshConfirmation();
      }
    });
  }

  // PoE Progress Modal listeners
  elements.poeCancelBtn.addEventListener('click', () => {
    state.poeShouldCancel = true;
    elements.currentApText.textContent = 'Cancelling...';
    window.api.cancelApPoe();
  });

  // PoE Cache Choice Modal listeners
  elements.useCacheBtn.addEventListener('click', () => {
    applyPoeCache(state.selectedFloorPlan.id);
    state.showPoE = true;
    elements.poeCheck.textContent = '☑';
    elements.poeCacheChoiceModal.classList.add('hidden');
    closeSettingsMenu();
    renderFloorPlan();
  });

  elements.queryAgainBtn.addEventListener('click', async () => {
    elements.poeCacheChoiceModal.classList.add('hidden');
    if (warnIfNoOnlineAps(state.accessPoints)) return;
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

  if (elements.poeRollupClose) {
    elements.poeRollupClose.addEventListener('click', closePoeRollupModal);
  }
  const poeRollupDone = document.getElementById('poe-rollup-done');
  if (poeRollupDone) {
    poeRollupDone.addEventListener('click', closePoeRollupModal);
  }
  if (elements.poeRollupModal) {
    elements.poeRollupModal.addEventListener('click', (e) => {
      if (e.target === elements.poeRollupModal) closePoeRollupModal();
    });
  }

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

function isTypingTarget(el) {
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function isOverlayVisible(el) {
  return !!(el && !el.classList.contains('hidden'));
}

function showGettingStartedModal() {
  if (!elements.gettingStartedModal) return;
  applyGettingStartedProgress(loadGettingStartedProgress());
  elements.gettingStartedModal.classList.remove('hidden');
}

function closeGettingStartedModal() {
  if (elements.gettingStartedModal) {
    elements.gettingStartedModal.classList.add('hidden');
  }
}

function showShortcutsModal() {
  if (!elements.shortcutsModal) return;
  elements.shortcutsModal.classList.remove('hidden');
}

function closeShortcutsModal() {
  if (elements.shortcutsModal) {
    elements.shortcutsModal.classList.add('hidden');
  }
}

function cancelPoeProgressFromShortcut() {
  state.poeShouldCancel = true;
  if (elements.currentApText) {
    elements.currentApText.textContent = 'Cancelling...';
  }
  if (window.api.cancelApPoe) {
    window.api.cancelApPoe();
  }
}

function dismissSshConfirmation() {
  window.sshConfirmationResult = false;
  if (elements.sshModal) {
    elements.sshModal.classList.add('hidden');
  }
}

function dismissPoeCacheChoice() {
  if (elements.poeCacheChoiceModal) {
    elements.poeCacheChoiceModal.classList.add('hidden');
  }
}

// Escape closes one topmost overlay per press (FR#11)
function handleEscapeKey(e) {
  if (state.deviceDrag) {
    e.preventDefault();
    cancelDeviceDrag();
    return;
  }
  if (isOverlayVisible(elements.exampleModal)) {
    e.preventDefault();
    closeExampleModal();
    return;
  }
  if (isOverlayVisible(elements.globalSearchModal)) {
    e.preventDefault();
    closeGlobalSearchModal({ cancelIndex: true });
    return;
  }
  if (isOverlayVisible(elements.gettingStartedModal)) {
    e.preventDefault();
    closeGettingStartedModal();
    return;
  }
  if (isOverlayVisible(elements.shortcutsModal)) {
    e.preventDefault();
    closeShortcutsModal();
    return;
  }
  if (isOverlayVisible(elements.poeProgressModal)) {
    e.preventDefault();
    cancelPoeProgressFromShortcut();
    return;
  }
  if (isOverlayVisible(elements.poeCacheChoiceModal)) {
    e.preventDefault();
    dismissPoeCacheChoice();
    return;
  }
  if (isOverlayVisible(elements.sshModal)) {
    e.preventDefault();
    dismissSshConfirmation();
    return;
  }
  if (isOverlayVisible(elements.poeRollupModal)) {
    e.preventDefault();
    closePoeRollupModal();
    return;
  }
  if (isOverlayVisible(elements.apPopup)) {
    e.preventDefault();
    closeAPPopup();
    return;
  }
  if (isOverlayVisible(elements.switchPopup)) {
    e.preventDefault();
    closeSwitchPopup();
    return;
  }
  if (isOverlayVisible(elements.apSearchPopup)) {
    e.preventDefault();
    closeAPSearchPopup();
    return;
  }
  if (isOverlayVisible(elements.mapFilterPopup)) {
    e.preventDefault();
    closeMapFilterPopup();
    return;
  }
  if (isOverlayVisible(elements.settingsMenu)) {
    e.preventDefault();
    closeSettingsMenu();
    return;
  }
  if (isOverlayVisible(elements.exportMenu)) {
    e.preventDefault();
    closeExportMenu();
    return;
  }
  if (isOverlayVisible(elements.floorSwitcherMenu)) {
    e.preventDefault();
    closeFloorSwitcher();
  }
}

function handleSearchDropdownKey(e) {
  const results = state.searchResults || [];
  if (results.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.searchKeyboardIndex = Math.min(state.searchKeyboardIndex + 1, results.length - 1);
    if (state.searchKeyboardIndex < 0) state.searchKeyboardIndex = 0;
    renderAPSearchDropdown();
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.searchKeyboardIndex = Math.max(state.searchKeyboardIndex - 1, 0);
    renderAPSearchDropdown();
    return;
  }

  if (e.key === 'Enter') {
    const index = state.searchKeyboardIndex >= 0 ? state.searchKeyboardIndex : 0;
    const entry = results[index];
    if (!entry) return;
    e.preventDefault();
    selectDeviceFromSearch(entry);
  }
}

function handleMapKeyboardShortcut(e) {
  if (!screens.map.classList.contains('active')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isTypingTarget(document.activeElement)) return;

  if (e.key === '/') {
    e.preventDefault();
    openAPSearchForShortcut();
    return;
  }

  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
    e.preventDefault();
    handleZoomIn();
    return;
  }

  if (e.key === '-' || e.code === 'NumpadSubtract') {
    e.preventDefault();
    handleZoomOut();
    return;
  }

  if (e.key === '0') {
    e.preventDefault();
    handleZoomReset();
  }
}

function handleGlobalKeydown(e) {
  if (e.key === 'Escape') {
    handleEscapeKey(e);
    return;
  }

  // Search dropdown nav while the search field is focused
  if (
    document.activeElement === elements.apSearch &&
    elements.apSearchDropdown &&
    !elements.apSearchDropdown.classList.contains('hidden') &&
    (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')
  ) {
    handleSearchDropdownKey(e);
    return;
  }

  handleMapKeyboardShortcut(e);
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

    // Save credentials if requested (encrypted at rest via OS Keychain / DPAPI)
    if (saveCredentials) {
      const saved = await window.api.saveCredentials({
        region,
        tenantId,
        clientId,
        clientSecret
      });
      if (!saved) {
        console.error('Failed to save credentials securely. Sign-in will continue without persisted credentials.');
        alert('Signed in, but your credentials could not be saved securely on this computer. You will need to enter them again next time.');
      }
    } else {
      await window.api.clearCredentials();
    }

    // Store tenant ID in state
    state.tenantId = tenantId;
    state.venuePage = 1;
    state.venueHasFloorImage = {};
    state.venueFloorImageProbeId += 1;
    loadFavoriteVenueIdsForTenant(tenantId);

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
  clearVenueDevices();
  state.apPoeInfo = {};
  state.apPoeDetails = {};
  state.poeDataByFloorPlan = {};
  state.floorDataFetchedAt = null;
  state.poeFetchedAt = null;
  state.favoriteVenueIds = [];
  state.venuePage = 1;
  state.venueHasFloorImage = {};
  state.venueFloorImageProbeId += 1;
  state.floorPlanThumbnails = {};
  state.floorPlanThumbLoadId += 1;
  clearGlobalSearchState();
  closeGlobalSearchModal({ cancelIndex: true });
  closeFloorSwitcher();
  setEditMode(false);
  state.canWritePositions = null;
  updateVenueDeviceTotals();
  if (elements.venueToolbar) elements.venueToolbar.classList.add('hidden');
  if (elements.venuePagination) elements.venuePagination.classList.add('hidden');
  // Don't leave an unsaved secret sitting in the login form after logout.
  setClientSecretVisibility(false);
  if (!elements.saveCredentials.checked) {
    elements.clientSecret.value = '';
  }
  showScreen('login');
}

// Refresh Handler
async function handleRefresh() {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.classList.add('loading');

  try {
    await loadFloorPlanData({ forceDevices: true });
  } finally {
    elements.refreshBtn.disabled = false;
    elements.refreshBtn.classList.remove('loading');
  }
}

// Load Venues
async function loadVenues() {
  elements.venueLoading.classList.remove('hidden');
  elements.venueList.classList.add('hidden');
  elements.venueToolbar.classList.add('hidden');
  elements.venuePagination.classList.add('hidden');
  elements.venueError.classList.add('hidden');

  try {
    const result = await window.api.getVenues(state.tenantId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to load venues');
    }

    state.venues = result.data || [];
    state.venuePage = 1;
    renderVenueList();
    probeVenueFloorImages();

  } catch (error) {
    elements.venueError.textContent = error.message;
    elements.venueError.classList.remove('hidden');
  } finally {
    elements.venueLoading.classList.add('hidden');
  }
}

const VENUE_NO_IMAGE_TOOLTIP = 'No floors with images in this venue.';

function venueLacksFloorImage(venueId) {
  return state.venueHasFloorImage[String(venueId)] === false;
}

function getVenueWarnTooltipEl() {
  let tip = document.getElementById('venue-warn-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'venue-warn-tooltip';
    tip.className = 'venue-warn-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  return tip;
}

function showVenueWarnTooltip(anchor) {
  const tip = getVenueWarnTooltipEl();
  tip.textContent = VENUE_NO_IMAGE_TOOLTIP;
  tip.classList.remove('is-visible');
  tip.style.left = '0px';
  tip.style.top = '0px';
  const rect = anchor.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
  let top = rect.top - tipRect.height - 8;
  if (top < 8) {
    top = rect.bottom + 8;
  }
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
  tip.classList.add('is-visible');
}

function hideVenueWarnTooltip() {
  const tip = document.getElementById('venue-warn-tooltip');
  if (tip) tip.classList.remove('is-visible');
}

function createVenueNoImageWarning() {
  const warn = document.createElement('span');
  warn.className = 'venue-no-image-warn';
  warn.setAttribute('aria-label', VENUE_NO_IMAGE_TOOLTIP);
  warn.textContent = '!';
  warn.addEventListener('mouseenter', () => showVenueWarnTooltip(warn));
  warn.addEventListener('mouseleave', hideVenueWarnTooltip);
  warn.addEventListener('focus', () => showVenueWarnTooltip(warn));
  warn.addEventListener('blur', hideVenueWarnTooltip);
  return warn;
}

function appendVenueNameContent(container, venue) {
  const name = document.createElement('span');
  name.className = 'venue-name-text';
  name.textContent = venue.name || 'Unnamed Venue';
  container.appendChild(name);
  if (venueLacksFloorImage(venue.id)) {
    container.appendChild(createVenueNoImageWarning());
  }
}

function applyVenueFloorImageWarning(venueId) {
  const id = String(venueId);
  const nodes = elements.venueList?.querySelectorAll(`[data-venue-id="${CSS.escape(id)}"]`) || [];
  nodes.forEach((node) => {
    const wrap = node.querySelector('.venue-name-wrap');
    if (!wrap) return;
    const existing = wrap.querySelector('.venue-no-image-warn');
    if (venueLacksFloorImage(id)) {
      if (!existing) wrap.appendChild(createVenueNoImageWarning());
    } else if (existing) {
      existing.remove();
    }
  });
}

function setVenueHasFloorImage(venueId, hasImage) {
  const id = String(venueId);
  state.venueHasFloorImage[id] = !!hasImage;
  applyVenueFloorImageWarning(id);
}

function floorPlansHaveImage(floorPlans) {
  return (floorPlans || []).some((fp) => !!fp.imageId);
}

// Background: metadata-only check (floorplans JSON + imageId), no image downloads
async function probeVenueFloorImages() {
  const tenantId = state.tenantId;
  if (!tenantId || !state.venues.length) return;

  const probeId = ++state.venueFloorImageProbeId;
  const pending = state.venues.filter(
    (v) => v.id && state.venueHasFloorImage[String(v.id)] === undefined
  );
  if (pending.length === 0) return;

  const concurrency = 4;
  let index = 0;

  async function worker() {
    while (index < pending.length) {
      if (probeId !== state.venueFloorImageProbeId || state.tenantId !== tenantId) return;
      const venue = pending[index++];
      try {
        const result = await window.api.getFloorPlans({
          tenantId,
          venueId: venue.id
        });
        if (probeId !== state.venueFloorImageProbeId || state.tenantId !== tenantId) return;
        if (!result.success) continue;
        setVenueHasFloorImage(venue.id, floorPlansHaveImage(result.data));
      } catch (_) {
        // Leave unknown on failure — avoid false warnings
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, () => worker())
  );
}

function updateVenuePagination(totalCount, page, totalPages) {
  const showPager = state.venuePageSize !== 'all' && totalCount > 0 && totalPages > 1;
  elements.venuePagination.classList.toggle('hidden', !showPager);
  if (!showPager) return;

  const size = state.venuePageSize;
  const start = (page - 1) * size + 1;
  const end = Math.min(page * size, totalCount);
  elements.venuePageInfo.textContent = `${start}–${end} of ${totalCount}`;
  elements.venuePagePrev.disabled = page <= 1;
  elements.venuePageNext.disabled = page >= totalPages;
}

function renderVenueTiles(venues) {
  elements.venueList.classList.remove('venue-list-table');
  elements.venueList.classList.add('list-container');

  venues.forEach(venue => {
    const { addressLine, country } = formatVenueAddress(venue);
    const item = document.createElement('div');
    item.className = `list-item venue-tile${isVenueFavorite(venue.id) ? ' is-favorite' : ''}`;
    item.dataset.venueId = venue.id;
    item.tabIndex = 0;

    const header = document.createElement('div');
    header.className = 'venue-tile-header';
    const title = document.createElement('h3');
    title.className = 'venue-name-wrap';
    appendVenueNameContent(title, venue);
    header.appendChild(title);
    header.appendChild(createVenueFavoriteButton(venue));
    item.appendChild(header);

    if (addressLine) {
      const p = document.createElement('p');
      p.textContent = addressLine;
      item.appendChild(p);
    }
    if (country) {
      const p = document.createElement('p');
      p.textContent = country;
      item.appendChild(p);
    }

    const open = () => selectVenue(venue);
    item.addEventListener('click', (e) => {
      if (e.target.closest('.venue-fav-btn')) return;
      open();
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    elements.venueList.appendChild(item);
  });
}

function renderVenueTable(venues) {
  elements.venueList.classList.remove('list-container');
  elements.venueList.classList.add('venue-list-table');

  const sort = state.venueNameSort === 'desc' ? 'desc' : 'asc';
  const sortLabel = sort === 'asc' ? 'sorted ascending' : 'sorted descending';
  const sortIndicator = sort === 'asc' ? ' ▲' : ' ▼';

  const table = document.createElement('table');
  table.className = 'venue-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const favTh = document.createElement('th');
  favTh.className = 'venue-col-fav';
  favTh.setAttribute('aria-label', 'Favorite');

  const nameTh = document.createElement('th');
  nameTh.className = 'venue-col-name venue-sortable';
  const nameBtn = document.createElement('button');
  nameBtn.type = 'button';
  nameBtn.className = 'venue-sort-btn is-active';
  nameBtn.setAttribute('aria-label', `Sort by name, currently ${sortLabel}`);
  nameBtn.title = 'Sort by name';
  nameBtn.innerHTML = `Name<span class="venue-sort-indicator" aria-hidden="true">${sortIndicator}</span>`;
  nameBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    cycleVenueNameSort();
  });
  nameTh.appendChild(nameBtn);
  nameTh.setAttribute('aria-sort', sort === 'asc' ? 'ascending' : 'descending');

  const addrTh = document.createElement('th');
  addrTh.textContent = 'Address';
  const countryTh = document.createElement('th');
  countryTh.textContent = 'Country';

  headerRow.appendChild(favTh);
  headerRow.appendChild(nameTh);
  headerRow.appendChild(addrTh);
  headerRow.appendChild(countryTh);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  venues.forEach(venue => {
    const { addressLine, country } = formatVenueAddress(venue);
    const row = document.createElement('tr');
    row.className = `venue-table-row${isVenueFavorite(venue.id) ? ' is-favorite' : ''}`;
    row.dataset.venueId = venue.id;
    row.tabIndex = 0;

    const favCell = document.createElement('td');
    favCell.className = 'venue-col-fav';
    favCell.appendChild(createVenueFavoriteButton(venue));

    const nameCell = document.createElement('td');
    nameCell.className = 'venue-col-name';
    const nameWrap = document.createElement('span');
    nameWrap.className = 'venue-name-wrap';
    appendVenueNameContent(nameWrap, venue);
    nameCell.appendChild(nameWrap);

    const addrCell = document.createElement('td');
    addrCell.textContent = addressLine || '—';

    const countryCell = document.createElement('td');
    countryCell.textContent = country || '—';

    row.appendChild(favCell);
    row.appendChild(nameCell);
    row.appendChild(addrCell);
    row.appendChild(countryCell);

    const open = () => selectVenue(venue);
    row.addEventListener('click', (e) => {
      if (e.target.closest('.venue-fav-btn')) return;
      open();
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  elements.venueList.appendChild(table);
}

// Render Venue List (tiles or table, favorites first, paginated)
function renderVenueList() {
  hideVenueWarnTooltip();
  elements.venueList.innerHTML = '';
  elements.venueList.classList.remove('venue-list-table');
  elements.venueList.classList.add('list-container');

  if (state.venues.length === 0) {
    elements.venueToolbar.classList.add('hidden');
    elements.venuePagination.classList.add('hidden');
    elements.venueList.innerHTML = `
      <div class="empty-state">
        <h3>No Venues Found</h3>
        <p>No venues are available for this tenant.</p>
      </div>
    `;
    elements.venueList.classList.remove('hidden');
    return;
  }

  elements.venueToolbar.classList.remove('hidden');
  syncVenueViewToggle();
  if (elements.venuePageSize) {
    elements.venuePageSize.value = String(state.venuePageSize);
  }

  const sorted = getSortedVenues();
  const { pageVenues, totalPages, page } = getVenuePageSlice(sorted);

  if (state.venueViewMode === 'list') {
    renderVenueTable(pageVenues);
  } else {
    renderVenueTiles(pageVenues);
  }

  updateVenuePagination(sorted.length, page, totalPages);
  elements.venueList.classList.remove('hidden');
}

// Select Venue
async function selectVenue(venue) {
  state.selectedVenue = venue;
  elements.venueName.textContent = venue.name || 'Floor Plans';
  clearVenueDevices();
  updateVenueDeviceTotals({ loading: true });
  showScreen('floorplan');
  await Promise.all([
    loadFloorPlans(),
    ensureVenueDevices({ force: true })
  ]);
}

// Load Floor Plans
async function loadFloorPlans() {
  elements.floorplanLoading.classList.remove('hidden');
  elements.floorplanList.classList.add('hidden');
  elements.floorplanError.classList.add('hidden');

  const venueId = state.selectedVenue.id;
  // Only the newest load may update the list (fast Back / other venue).
  const loadId = ++state.floorPlanListLoadId;
  const isCurrent = () => loadId === state.floorPlanListLoadId && state.selectedVenue?.id === venueId;
  try {
    const result = await window.api.getFloorPlans({
      tenantId: state.tenantId,
      venueId
    });
    if (!isCurrent()) return;

    if (!result.success) {
      throw new Error(result.error || 'Failed to load floor plans');
    }

    state.floorPlans = result.data || [];
    if (state.selectedVenue?.id) {
      setVenueHasFloorImage(state.selectedVenue.id, floorPlansHaveImage(state.floorPlans));
    }
    renderFloorPlanList();

  } catch (error) {
    if (!isCurrent()) return;
    elements.floorplanError.textContent = error.message;
    elements.floorplanError.classList.remove('hidden');
  } finally {
    if (isCurrent()) elements.floorplanLoading.classList.add('hidden');
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
    item.className = 'list-item floorplan-item';
    item.dataset.floorPlanId = floorPlan.id;

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'floorplan-thumb';
    const cached = state.floorPlanThumbnails[floorPlan.id];
    if (cached) {
      const img = document.createElement('img');
      img.src = cached;
      img.alt = '';
      img.loading = 'lazy';
      thumbWrap.appendChild(img);
      thumbWrap.classList.add('has-image');
    } else if (floorPlan.imageId) {
      thumbWrap.classList.add('is-loading');
      thumbWrap.innerHTML = '<span class="floorplan-thumb-placeholder">Loading…</span>';
    } else {
      thumbWrap.classList.add('is-empty');
      thumbWrap.innerHTML = '<span class="floorplan-thumb-placeholder">No preview</span>';
    }

    const body = document.createElement('div');
    body.className = 'floorplan-item-body';
    body.innerHTML = `
      <h3>${escapeHtml(floorPlan.name || 'Unnamed Floor Plan')}</h3>
      <p>Floor: ${escapeHtml(floorPlan.floorNumber?.toString() || 'N/A')}</p>
    `;

    item.appendChild(thumbWrap);
    item.appendChild(body);
    item.tabIndex = 0;
    item.addEventListener('click', () => selectFloorPlan(floorPlan));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectFloorPlan(floorPlan);
      }
    });
    elements.floorplanList.appendChild(item);
  });

  elements.floorplanList.classList.remove('hidden');
  loadFloorPlanThumbnails();
}

// Fetch floor-plan preview images for the picker (cached, limited concurrency)
async function loadFloorPlanThumbnails() {
  const venueId = state.selectedVenue?.id;
  const tenantId = state.tenantId;
  if (!venueId || !tenantId) return;

  const loadId = ++state.floorPlanThumbLoadId;
  const pending = state.floorPlans.filter(
    (fp) => fp.id && fp.imageId && !state.floorPlanThumbnails[fp.id]
  );
  if (pending.length === 0) return;

  const concurrency = 3;
  let index = 0;

  async function worker() {
    while (index < pending.length) {
      if (loadId !== state.floorPlanThumbLoadId) return;
      const floorPlan = pending[index++];
      try {
        const result = await window.api.getFloorPlanImage({
          tenantId,
          venueId,
          floorPlanId: floorPlan.id,
          imageId: floorPlan.imageId
        });
        if (loadId !== state.floorPlanThumbLoadId) return;
        if (!result.success || !result.data) {
          setFloorPlanThumbStatus(floorPlan.id, null);
          continue;
        }
        state.floorPlanThumbnails[floorPlan.id] = result.data;
        setFloorPlanThumbStatus(floorPlan.id, result.data);
      } catch (_) {
        if (loadId !== state.floorPlanThumbLoadId) return;
        setFloorPlanThumbStatus(floorPlan.id, null);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
}

function setFloorPlanThumbStatus(floorPlanId, dataUrl) {
  const item = elements.floorplanList?.querySelector(
    `.floorplan-item[data-floor-plan-id="${CSS.escape(String(floorPlanId))}"]`
  );
  if (!item) return;
  const thumbWrap = item.querySelector('.floorplan-thumb');
  if (!thumbWrap) return;

  thumbWrap.classList.remove('is-loading', 'is-empty', 'has-image');
  thumbWrap.innerHTML = '';

  if (dataUrl) {
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = '';
    thumbWrap.appendChild(img);
    thumbWrap.classList.add('has-image');
  } else {
    thumbWrap.classList.add('is-empty');
    thumbWrap.innerHTML = '<span class="floorplan-thumb-placeholder">No preview</span>';
  }
}

// Select Floor Plan
async function selectFloorPlan(floorPlan) {
  closeFloorSwitcher();
  state.selectedFloorPlan = floorPlan;
  updateMapHeaderTitle();
  showScreen('map');
  await loadFloorPlanData();
}

// Jump to another floor without leaving the map (FR#6)
async function switchToFloorPlan(floorPlan) {
  if (!floorPlan || floorPlan.id === state.selectedFloorPlan?.id) {
    closeFloorSwitcher();
    return;
  }
  closeFloorSwitcher();
  state.selectedFloorPlan = floorPlan;
  updateMapHeaderTitle();
  await loadFloorPlanData();
}

function clearVenueDevices() {
  state.venueDevices = { accessPoints: [], switches: [], fetchedAt: null };
  state.venueDeviceCounts = { accessPoints: 0, switches: 0 };
  updateUnplacedEditBadge();
}

function formatVenueDeviceTotals(counts) {
  const ap = Number.isFinite(counts?.accessPoints) ? counts.accessPoints : 0;
  const sw = Number.isFinite(counts?.switches) ? counts.switches : 0;
  return `${ap} Access Points · ${sw} Switches`;
}

function updateVenueDeviceTotals({ loading = false, error = null } = {}) {
  const el = elements.venueDeviceTotals;
  if (!el) return;
  const hasCounts = Boolean(state.venueDevices.fetchedAt);
  if (error) {
    el.textContent = 'Device totals unavailable';
    el.title = error;
  } else {
    el.textContent = hasCounts ? formatVenueDeviceTotals(state.venueDeviceCounts) : '—';
    el.removeAttribute('title');
  }
  el.classList.toggle('is-loading', loading && !hasCounts);
}

async function ensureVenueDevices({ force = false } = {}) {
  if (!state.selectedVenue || !state.tenantId) {
    return { success: false };
  }
  if (!force && state.venueDevices.fetchedAt) {
    updateVenueDeviceTotals();
    return { success: true };
  }

  updateVenueDeviceTotals({ loading: true });

  const venueId = state.selectedVenue.id;
  const [apResult, switchResult] = await Promise.all([
    window.api.getAccessPoints({
      tenantId: state.tenantId,
      venueId
    }).catch((error) => ({ success: false, error: error.message || String(error) })),
    window.api.getSwitches({
      venueId
    }).catch((error) => {
      console.warn('[Switches] Query failed:', error.message || error);
      return { success: false, error: error.message || String(error) };
    })
  ]);

  // The user moved to another venue while this was loading.
  if (state.selectedVenue?.id !== venueId) return { success: false, stale: true };

  if (!apResult.success) {
    console.warn('[Venue devices] Access point query failed:', apResult.error || 'Unknown error');
    clearVenueDevices();
    updateVenueDeviceTotals({ error: apResult.error || 'Could not load access points' });
    return { success: false, error: apResult.error || 'Could not load access points' };
  }

  const accessPoints = apResult.data || [];
  let switches = [];
  if (switchResult.success) {
    switches = switchResult.data || [];
  } else {
    console.warn('[Switches] Query failed:', switchResult.error || 'Unknown error');
  }

  state.venueDevices = {
    accessPoints,
    switches,
    fetchedAt: Date.now()
  };
  state.venueDeviceCounts = {
    accessPoints: accessPoints.length,
    switches: switches.length
  };
  updateVenueDeviceTotals();
  updateUnplacedEditBadge();
  return { success: apResult.success };
}

function updateMapHeaderTitle() {
  if (elements.mapVenueName) {
    elements.mapVenueName.textContent = state.selectedVenue?.name || 'Venue';
  }
  if (elements.mapFloorName) {
    elements.mapFloorName.textContent = state.selectedFloorPlan?.name || 'Floor Plan';
  }
  renderFloorSwitcherMenu();
}

function renderFloorSwitcherMenu() {
  const menu = elements.floorSwitcherMenu;
  if (!menu) return;
  menu.innerHTML = '';

  state.floorPlans.forEach((floorPlan) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'floor-switcher-item';
    item.setAttribute('role', 'option');
    if (floorPlan.id === state.selectedFloorPlan?.id) {
      item.classList.add('is-active');
      item.setAttribute('aria-selected', 'true');
    } else {
      item.setAttribute('aria-selected', 'false');
    }

    const name = document.createElement('span');
    name.className = 'floor-switcher-item-name';
    name.textContent = floorPlan.name || 'Unnamed Floor Plan';
    item.appendChild(name);

    if (floorPlan.floorNumber != null && floorPlan.floorNumber !== '') {
      const meta = document.createElement('span');
      meta.className = 'floor-switcher-item-meta';
      meta.textContent = `Floor ${floorPlan.floorNumber}`;
      item.appendChild(meta);
    }

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      switchToFloorPlan(floorPlan);
    });
    menu.appendChild(item);
  });
}

function toggleFloorSwitcher() {
  if (!elements.floorSwitcherMenu || !elements.floorSwitcherBtn) return;
  const willOpen = elements.floorSwitcherMenu.classList.contains('hidden');
  if (willOpen) {
    renderFloorSwitcherMenu();
    elements.floorSwitcherMenu.classList.remove('hidden');
    elements.floorSwitcherBtn.setAttribute('aria-expanded', 'true');
  } else {
    closeFloorSwitcher();
  }
}

function closeFloorSwitcher() {
  if (elements.floorSwitcherMenu) {
    elements.floorSwitcherMenu.classList.add('hidden');
  }
  if (elements.floorSwitcherBtn) {
    elements.floorSwitcherBtn.setAttribute('aria-expanded', 'false');
  }
}

// Load Floor Plan Data (Image, APs, and switches)
async function loadFloorPlanData({ forceDevices = false } = {}) {
  // Only the newest load may draw (fast floor switching / Refresh / Back).
  const loadId = ++state.mapLoadId;
  const floorPlanId = state.selectedFloorPlan.id;
  const isCurrent = () => loadId === state.mapLoadId && state.selectedFloorPlan?.id === floorPlanId;
  resetZoomPan();
  elements.mapLoading.classList.remove('hidden');
  elements.mapLoading.textContent = 'Loading floor plan...';
  elements.canvas.style.display = 'none';

  try {
    const imagePromise = window.api.getFloorPlanImage({
      tenantId: state.tenantId,
      venueId: state.selectedVenue.id,
      floorPlanId: state.selectedFloorPlan.id,
      imageId: state.selectedFloorPlan.imageId
    });
    const devicesPromise = ensureVenueDevices({ force: forceDevices });

    const [imageResult, devicesResult] = await Promise.all([imagePromise, devicesPromise]);
    if (!isCurrent() || devicesResult.stale) return;

    if (!imageResult.success) {
      throw new Error(imageResult.error || 'Failed to load floor plan image');
    }
    if (!devicesResult.success) {
      // Don't draw an empty map that looks like a floor with no devices.
      throw new Error(`Could not load the devices for this floor: ${devicesResult.error || 'unknown error'}`);
    }

    // Filter APs for this floor plan (floorplanId is in position object with lowercase 'p')
    const allAPs = state.venueDevices.accessPoints || [];
    state.accessPoints = allAPs.filter(ap =>
      ap.position && ap.position.floorplanId === state.selectedFloorPlan.id
    );

    state.switches = filterAndDedupeSwitches(
      state.venueDevices.switches || [],
      state.selectedFloorPlan.id
    );

    resetMapFiltersForFloor();
    state.floorDataFetchedAt = Date.now();

    // FR#19: restore per-floor map opacity (default 75%)
    applyMapOpacityForSelectedFloor();

    // Restore cached AP PoE for this floor if present; keep Display Power Levels as-is
    if (hasPoeCacheForFloor(floorPlanId)) {
      applyPoeCache(floorPlanId);
      console.log('[PoE] Restored cached PoE data for floor plan:', floorPlanId);
    } else {
      state.apPoeInfo = {};
      state.apPoeDetails = {};
      state.poeFetchedAt = null;
      updatePoeSummaryButton();
    }

    updateDeviceCount();
    updateVenueDeviceTotals();
    applyPendingSearchFocus();

    // Load image
    const img = new Image();
    img.onload = () => {
      if (!isCurrent()) return;
      state.floorPlanImage = img;
      elements.mapLoading.classList.add('hidden');
      elements.canvas.style.display = 'block';
      renderFloorPlan();
    };
    img.onerror = () => {
      // Throwing here would be uncaught and leave the spinner up forever.
      if (isCurrent()) elements.mapLoading.textContent = 'Failed to load floor plan image';
    };
    img.src = imageResult.data;

  } catch (error) {
    if (isCurrent()) elements.mapLoading.textContent = error.message;
  }
}

function updateDeviceCount() {
  // Device totals live in the map legend summary strip (FR#5)
  updateMapSummaryStrip();
}

function formatRelativeAge(msAgo) {
  if (!Number.isFinite(msAgo) || msAgo < 0) return '—';
  if (msAgo < 45 * 1000) return 'just now';
  if (msAgo < 60 * 1000) return '1m ago';
  if (msAgo < 60 * 60 * 1000) return `${Math.floor(msAgo / 60000)}m ago`;
  if (msAgo < 24 * 60 * 60 * 1000) return `${Math.floor(msAgo / 3600000)}h ago`;
  return `${Math.floor(msAgo / 86400000)}d ago`;
}

function formatFetchedAge(fetchedAt) {
  if (!Number.isFinite(fetchedAt)) return null;
  return formatRelativeAge(Date.now() - fetchedAt);
}

function collectStatusCounts(devices, statusOf) {
  let online = 0;
  let offline = 0;
  let other = 0;
  for (const device of devices) {
    const category = deviceStatusCategory(statusOf(device));
    if (category === 'online') online += 1;
    else if (category === 'offline') offline += 1;
    else other += 1;
  }
  return { online, offline, other };
}

function collectApStatusCounts() {
  return collectStatusCounts(
    state.accessPoints,
    (ap) => ap.state || ap.subState || ap.status
  );
}

function collectSwitchStatusCounts() {
  return collectStatusCounts(
    state.switches,
    (sw) => sw.deviceStatus || sw.status
  );
}

function applySummaryStatusCounts(counts, onlineEl, offlineEl, otherStatEl, otherCountEl) {
  if (onlineEl) onlineEl.textContent = String(counts.online);
  if (offlineEl) offlineEl.textContent = String(counts.offline);
  if (otherCountEl) otherCountEl.textContent = String(counts.other);
  if (otherStatEl) otherStatEl.classList.toggle('hidden', counts.other === 0);
}

function collectPoeClassChips() {
  const details = Object.values(state.apPoeDetails || {});
  if (details.length === 0 && Object.keys(state.apPoeInfo || {}).length === 0) {
    return [];
  }

  const classes = new Set();
  const standards = new Set();
  for (const detail of details) {
    if (!detail || detail.status === 'offline') continue;
    if (detail.class != null && detail.class !== '') {
      classes.add(`C${detail.class}`);
    } else if (detail.standard) {
      standards.add(String(detail.standard));
    }
  }

  const classList = Array.from(classes).sort((a, b) => {
    const na = parseInt(String(a).replace(/\D/g, ''), 10);
    const nb = parseInt(String(b).replace(/\D/g, ''), 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return String(a).localeCompare(String(b));
  });
  const standardOrder = { '802.3af': 1, '802.3at': 2, '802.3bt': 3 };
  const standardList = Array.from(standards).sort((a, b) => {
    const ra = standardOrder[a] || 99;
    const rb = standardOrder[b] || 99;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });

  // Prefer negotiated classes; fall back to standards when no class numbers exist
  return classList.length > 0 ? classList : standardList;
}

function startSummaryAgeTimer() {
  if (summaryAgeTimer) return;
  summaryAgeTimer = setInterval(() => {
    if (screens.map.classList.contains('active')) {
      updateMapSummaryStrip();
    }
  }, SUMMARY_TICK_MS);
}

function stopSummaryAgeTimer() {
  if (!summaryAgeTimer) return;
  clearInterval(summaryAgeTimer);
  summaryAgeTimer = null;
}

function applyLegendCollapsed(collapsed) {
  state.legendCollapsed = !!collapsed;
  if (elements.mapSummary) {
    elements.mapSummary.classList.toggle('collapsed', state.legendCollapsed);
  }
  if (elements.legendToggle) {
    elements.legendToggle.setAttribute('aria-expanded', state.legendCollapsed ? 'false' : 'true');
    elements.legendToggle.title = state.legendCollapsed ? 'Expand legend' : 'Collapse legend';
  }
}

function loadLegendCollapsedPref() {
  applyLegendCollapsed(readLocalStorage(LEGEND_COLLAPSED_KEY) === '1');
}

function toggleLegendCollapsed() {
  applyLegendCollapsed(!state.legendCollapsed);
  writeLocalStorage(LEGEND_COLLAPSED_KEY, state.legendCollapsed ? '1' : '0');
}

function updateMapSummaryStrip() {
  if (!elements.mapSummary) return;

  applySummaryStatusCounts(
    collectApStatusCounts(),
    elements.summaryApOnlineCount,
    elements.summaryApOfflineCount,
    elements.summaryApOtherStat,
    elements.summaryApOtherCount
  );
  applySummaryStatusCounts(
    collectSwitchStatusCounts(),
    elements.summarySwOnlineCount,
    elements.summarySwOfflineCount,
    elements.summarySwOtherStat,
    elements.summarySwOtherCount
  );

  if (elements.summaryPoeChips) {
    const chips = collectPoeClassChips();
    const hasPoe = Object.keys(state.apPoeInfo || {}).length > 0 ||
      Object.keys(state.apPoeDetails || {}).length > 0;
    if (!hasPoe) {
      elements.summaryPoeChips.textContent = 'Not queried';
      elements.summaryPoeChips.classList.remove('has-chips');
    } else if (chips.length === 0) {
      elements.summaryPoeChips.textContent = 'No classes';
      elements.summaryPoeChips.classList.remove('has-chips');
    } else {
      elements.summaryPoeChips.classList.add('has-chips');
      elements.summaryPoeChips.innerHTML = chips
        .map((chip) => `<span class="summary-poe-chip">${escapeHtml(chip)}</span>`)
        .join('');
    }
  }

  const floorAge = formatFetchedAge(state.floorDataFetchedAt);
  const floorStale = Number.isFinite(state.floorDataFetchedAt) &&
    (Date.now() - state.floorDataFetchedAt) >= FLOOR_STALE_MS;
  if (elements.summaryFloorAge) {
    elements.summaryFloorAge.textContent = floorAge
      ? `Floor · ${floorAge}`
      : 'Floor · —';
    elements.summaryFloorAge.classList.toggle('is-stale', floorStale);
    if (Number.isFinite(state.floorDataFetchedAt)) {
      elements.summaryFloorAge.title = `Loaded ${new Date(state.floorDataFetchedAt).toLocaleString()}`;
    } else {
      elements.summaryFloorAge.removeAttribute('title');
    }
  }
  if (elements.summaryFloorStale) {
    elements.summaryFloorStale.classList.toggle('hidden', !floorStale);
  }

  const hasPoeCache = Object.keys(state.apPoeInfo || {}).length > 0 ||
    Object.keys(state.apPoeDetails || {}).length > 0;
  const poeAge = formatFetchedAge(state.poeFetchedAt);
  const poeStale = hasPoeCache && Number.isFinite(state.poeFetchedAt) &&
    (Date.now() - state.poeFetchedAt) >= POE_STALE_MS;
  if (elements.summaryPoeAge) {
    if (!hasPoeCache) {
      elements.summaryPoeAge.textContent = 'PoE · not queried';
      elements.summaryPoeAge.removeAttribute('title');
    } else if (poeAge) {
      elements.summaryPoeAge.textContent = `PoE · ${poeAge}`;
      elements.summaryPoeAge.title = Number.isFinite(state.poeFetchedAt)
        ? `Queried ${new Date(state.poeFetchedAt).toLocaleString()}`
        : '';
    } else {
      elements.summaryPoeAge.textContent = 'PoE · cached';
      elements.summaryPoeAge.title = 'PoE cache has no timestamp';
    }
    elements.summaryPoeAge.classList.toggle('is-stale', poeStale);
  }
  if (elements.summaryPoeStale) {
    elements.summaryPoeStale.classList.toggle('hidden', !poeStale);
  }
}

function defaultMapFilters() {
  return { status: 'all', band: 'all', afc: 'all', models: [] };
}

function mapFiltersAreActive() {
  const f = state.mapFilters;
  return f.status !== 'all' || f.band !== 'all' || f.afc !== 'all' || f.models.length > 0;
}

function deviceStatusCategory(status) {
  const color = deviceStatusColor(status);
  if (color === '#28a745') return 'online';
  if (color === '#dc3545') return 'offline';
  return 'other';
}

// 6GHz enabled filter: radio is on and has a 6 GHz channel configured/operating
function apHas6GEnabled(ap) {
  const radio = ap && ap.radio;
  if (!radio || radio.enable6G !== true || !radio.apRadioParams6G) return false;
  return !!radio.apRadioParams6G.operativeChannel;
}

function deviceModelName(device) {
  return String((device && device.model) || '').trim() || 'Unknown';
}

function accessPointPassesFilters(ap) {
  const f = state.mapFilters;
  if (f.status !== 'all') {
    const category = deviceStatusCategory(ap.state || ap.subState || ap.status);
    if (category !== f.status) return false;
  }
  if (f.band === '6ghz' && !apHas6GEnabled(ap)) return false;
  // Everything not operating on 6 GHz, including APs without a 6 GHz radio
  if (f.band === 'no6ghz' && apHas6GEnabled(ap)) return false;
  if (f.afc === 'sp' && ap.afcPowerState !== 'SP') return false;
  if (f.afc === 'lpi' && ap.afcPowerState !== 'LPI') return false;
  if (f.models.length > 0 && !f.models.includes(deviceModelName(ap))) return false;
  return true;
}

function switchPassesFilters(sw) {
  const f = state.mapFilters;
  // Band / AFC are AP-only: hide switches while those filters are on
  if (f.band !== 'all' || f.afc !== 'all') return false;
  if (f.status !== 'all') {
    const category = deviceStatusCategory(sw.deviceStatus || sw.status);
    if (category !== f.status) return false;
  }
  if (f.models.length > 0 && !f.models.includes(deviceModelName(sw))) return false;
  return true;
}

function getVisibleAccessPoints() {
  return state.accessPoints.filter(accessPointPassesFilters);
}

function getVisibleSwitches() {
  return state.switches.filter(switchPassesFilters);
}

function collectFloorModels() {
  const models = new Set();
  for (const ap of state.accessPoints) {
    models.add(deviceModelName(ap));
  }
  for (const sw of state.switches) {
    models.add(deviceModelName(sw));
  }
  return Array.from(models).sort((a, b) => a.localeCompare(b));
}

function syncMapFilterControls() {
  const f = state.mapFilters;
  for (const input of elements.mapFilterPopup.querySelectorAll('input[name="filter-status"]')) {
    input.checked = input.value === f.status;
  }
  for (const input of elements.mapFilterPopup.querySelectorAll('input[name="filter-band"]')) {
    input.checked = input.value === f.band;
  }
  for (const input of elements.mapFilterPopup.querySelectorAll('input[name="filter-afc"]')) {
    input.checked = input.value === f.afc;
  }
  renderFilterModelOptions();
  updateMapFilterButtonState();
  elements.mapFilterClear.disabled = !mapFiltersAreActive();
}

function renderFilterModelOptions() {
  const models = collectFloorModels();
  const selected = new Set(state.mapFilters.models);
  // Drop selections that no longer exist on this floor
  state.mapFilters.models = state.mapFilters.models.filter((m) => models.includes(m));

  if (models.length === 0) {
    elements.filterModelOptions.innerHTML = '<div class="map-filter-empty">No models on this floor</div>';
    return;
  }

  elements.filterModelOptions.innerHTML = '';
  for (const model of models) {
    const label = document.createElement('label');
    label.className = 'map-filter-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'filter-model';
    input.value = model;
    input.checked = selected.has(model);
    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${model}`));
    elements.filterModelOptions.appendChild(label);
  }
}

function updateMapFilterButtonState() {
  const active = mapFiltersAreActive();
  elements.mapFilterToggle.classList.toggle('filter-active', active);
  elements.mapFilterBadge.classList.toggle('hidden', !active);
  elements.mapFilterToggle.title = active
    ? 'Filters active — some devices may be hidden'
    : 'Filter devices';
  elements.mapFilterClear.disabled = !active;
}

function pruneSelectionAfterFilterChange() {
  if (state.hoveredDevice) {
    if (state.hoveredDevice.type === 'ap') {
      const ap = state.accessPoints.find((a) => accessPointKey(a) === state.hoveredDevice.key);
      if (!ap || !accessPointPassesFilters(ap)) state.hoveredDevice = null;
    } else if (state.hoveredDevice.type === 'switch') {
      const sw = state.switches.find((s) => switchKey(s) === state.hoveredDevice.key);
      if (!sw || !switchPassesFilters(sw)) state.hoveredDevice = null;
    }
  }
  if (state.selectedSearchDevice) {
    const entry = state.selectedSearchDevice;
    const visible = entry.type === 'ap'
      ? (state.showAPs && accessPointPassesFilters(entry.device))
      : (state.showSwitches && switchPassesFilters(entry.device));
    if (!visible) state.selectedSearchDevice = null;
  }
}

function applyMapFiltersAndRefresh() {
  pruneSelectionAfterFilterChange();
  updateMapFilterButtonState();
  updateDeviceCount();
  if (elements.apSearch.value.trim()) {
    handleAPSearch({ target: elements.apSearch });
  } else {
    renderFloorPlan();
  }
}

function handleMapFilterChange(e) {
  const input = e.target;
  if (!input || !input.name) return;

  if (input.name === 'filter-status') {
    state.mapFilters.status = input.value;
  } else if (input.name === 'filter-band') {
    state.mapFilters.band = input.value;
  } else if (input.name === 'filter-afc') {
    state.mapFilters.afc = input.value;
  } else if (input.name === 'filter-model') {
    state.mapFilters.models = Array.from(
      elements.filterModelOptions.querySelectorAll('input[name="filter-model"]:checked')
    ).map((el) => el.value);
  } else {
    return;
  }

  applyMapFiltersAndRefresh();
}

function clearMapFilters() {
  state.mapFilters = defaultMapFilters();
  syncMapFilterControls();
  applyMapFiltersAndRefresh();
}

function resetMapFiltersForFloor() {
  state.mapFilters = defaultMapFilters();
  syncMapFilterControls();
}

function toggleMapFilterPopup() {
  if (elements.mapFilterPopup.classList.contains('hidden')) {
    renderFilterModelOptions();
    elements.mapFilterPopup.classList.remove('hidden');
  } else {
    closeMapFilterPopup();
  }
}

function closeMapFilterPopup() {
  elements.mapFilterPopup.classList.add('hidden');
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

  // Clear canvas (theme-aware letterbox; export uses a fixed light fill instead)
  ctx.fillStyle = getMapBackgroundColor();
  ctx.fillRect(0, 0, containerWidth, containerHeight);

  // Draw floor plan image (FR#19: user-controlled opacity; devices stay full alpha)
  ctx.save();
  ctx.globalAlpha = clampMapOpacity(state.mapOpacityPercent) / 100;
  ctx.drawImage(
    img,
    state.offsetX,
    state.offsetY,
    scaledWidth,
    scaledHeight
  );
  ctx.restore();

  // Draw access points, then switches; hovered device last for visibility
  // FR#3: hide switches while co-channel highlight is active (AP hover clutter)
  beginMapDeviceDraw();
  if (state.showAPs) {
    drawAccessPoints();
  }
  if (state.showSwitches && !activeCoChannelHighlight) {
    drawSwitches();
  }
  drawHoveredDeviceOnTop();
  drawDeviceDragCrosshairs();

  // Continue animation if there's a selected search device
  if (state.selectedSearchDevice) {
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

// FR#3 — band+channel co-channel highlight (never channel number alone)
const BAND_COLORS = {
  '2.4G': '#2196F3',
  '5G': '#9C27B0',
  '6G': '#FF5722'
};
const BAND_RING_ORDER = ['6G', '5G', '2.4G']; // outermost first
const CO_CHANNEL_DIM_ALPHA = 0.38;
const CO_CHANNEL_MUTED_LABEL = '#9e9e9e';

// Frame-local highlight computed once before drawing APs (null when inactive / export)
let activeCoChannelHighlight = null;

function getApChannelKeys(ap) {
  const keys = new Set();
  const radio = ap && ap.radio;
  if (!radio) return keys;
  if (radio.apRadioParams24G && radio.apRadioParams24G.operativeChannel) {
    keys.add(`2.4G:${radio.apRadioParams24G.operativeChannel}`);
  }
  if (radio.apRadioParams50G && radio.apRadioParams50G.operativeChannel) {
    keys.add(`5G:${radio.apRadioParams50G.operativeChannel}`);
  }
  if (radio.enable6G === true && radio.apRadioParams6G && radio.apRadioParams6G.operativeChannel) {
    keys.add(`6G:${radio.apRadioParams6G.operativeChannel}`);
  }
  return keys;
}

function bandFromChannelKey(key) {
  const colon = key.indexOf(':');
  return colon >= 0 ? key.slice(0, colon) : key;
}

function getMatchingBands(hoveredKeys, peerKeys) {
  const matched = new Set();
  for (const key of hoveredKeys) {
    if (peerKeys.has(key)) matched.add(bandFromChannelKey(key));
  }
  return BAND_RING_ORDER.filter((band) => matched.has(band));
}

function computeCoChannelHighlight() {
  if (!state.hoveredDevice || state.hoveredDevice.type !== 'ap') return null;
  const hovered = getVisibleAccessPoints().find(
    (ap) => accessPointKey(ap) === state.hoveredDevice.key
  );
  if (!hovered) return null;
  const hoveredKeys = getApChannelKeys(hovered);
  if (hoveredKeys.size === 0) return null;

  const peerKeys = new Set();
  const peerMatchBands = new Map();
  for (const ap of getVisibleAccessPoints()) {
    const key = accessPointKey(ap);
    if (key === state.hoveredDevice.key) continue;
    const bands = getMatchingBands(hoveredKeys, getApChannelKeys(ap));
    if (bands.length === 0) continue;
    peerKeys.add(key);
    peerMatchBands.set(key, bands);
  }

  const hoveredBands = BAND_RING_ORDER.filter((band) => {
    for (const key of hoveredKeys) {
      if (bandFromChannelKey(key) === band) return true;
    }
    return false;
  });

  return {
    hoveredKey: state.hoveredDevice.key,
    hoveredBands,
    peerKeys,
    peerMatchBands
  };
}

function beginMapDeviceDraw() {
  activeCoChannelHighlight = computeCoChannelHighlight();
}

function isCoChannelHoverActive() {
  if (!state.hoveredDevice || state.hoveredDevice.type !== 'ap') return false;
  const hovered = getVisibleAccessPoints().find(
    (ap) => accessPointKey(ap) === state.hoveredDevice.key
  );
  return !!(hovered && getApChannelKeys(hovered).size > 0);
}

function getApCoChannelRole(ap) {
  const highlight = activeCoChannelHighlight;
  if (!highlight) return { mode: 'off' };
  const key = accessPointKey(ap);
  if (key === highlight.hoveredKey) {
    return { mode: 'hovered', highlightBands: highlight.hoveredBands };
  }
  if (highlight.peerKeys.has(key)) {
    return {
      mode: 'peer',
      highlightBands: highlight.peerMatchBands.get(key) || [],
      matchBands: highlight.peerMatchBands.get(key) || []
    };
  }
  return { mode: 'dim' };
}

function drawCoChannelRings(x, y, apRadius, matchBands, pr) {
  if (!matchBands || matchBands.length === 0) return;
  // matchBands is outermost-first (6G → 5G → 2.4G); largest radius first
  matchBands.forEach((band, index) => {
    const outward = matchBands.length - 1 - index;
    const ringRadius = apRadius + (5 + outward * 3.5) * pr;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = BAND_COLORS[band] || '#666666';
    ctx.lineWidth = 2.5 * pr;
    ctx.stroke();
  });
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

function isDraggedAccessPoint(ap) {
  return state.deviceDrag &&
    state.deviceDrag.type === 'ap' &&
    state.deviceDrag.key === accessPointKey(ap);
}

function isDraggedSwitch(sw) {
  return state.deviceDrag &&
    state.deviceDrag.type === 'switch' &&
    state.deviceDrag.key === switchKey(sw);
}

// Draw Access Points (skip hovered — redrawn on top later; skip device being dragged)
function drawAccessPoints() {
  const scale = getMapDrawScale();
  if (!scale) return;

  getVisibleAccessPoints().forEach((ap) => {
    if (isDraggedAccessPoint(ap)) return;
    if (isHoveredAccessPoint(ap)) return;
    drawOneAccessPoint(ap, scale.scaledWidth, scale.scaledHeight);
  });
}

function drawOneAccessPoint(ap, scaledWidth, scaledHeight) {
  const pr = state.drawPixelRatio || 1;
  const apRadius = 12 * pr;
  if (!ap.position || ap.position.xPercent === undefined || ap.position.yPercent === undefined) return;

  const x = state.offsetX + (ap.position.xPercent / 100 * scaledWidth);
  const y = state.offsetY + (ap.position.yPercent / 100 * scaledHeight);
  const color = deviceStatusColor(ap.state);
  const coRole = getApCoChannelRole(ap);
  const dimmed = coRole.mode === 'dim';

  ctx.save();
  if (dimmed) ctx.globalAlpha = CO_CHANNEL_DIM_ALPHA;

  ctx.beginPath();
  ctx.arc(x, y, apRadius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * pr;
  ctx.stroke();

  // WiFi glyph: larger, evenly spaced arcs with round caps for a clean look
  const wifiCy = y + 2.5 * pr;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.8 * pr;

  ctx.beginPath();
  ctx.arc(x, wifiCy, 1.5 * pr, 0, Math.PI * 2);
  ctx.fill();

  const arcHalf = Math.PI * 0.32;
  const arcStart = -Math.PI / 2 - arcHalf;
  const arcEnd = -Math.PI / 2 + arcHalf;
  [4.5, 7.5].forEach((r) => {
    ctx.beginPath();
    ctx.arc(x, wifiCy, r * pr, arcStart, arcEnd);
    ctx.stroke();
  });
  ctx.restore();

  if (coRole.mode === 'peer') {
    drawCoChannelRings(x, y, apRadius, coRole.matchBands, pr);
  }

  if (isSelectedSearchAccessPoint(ap)) {
    drawSearchPulse(x, y, pr);
  }

  const labelsOnLeft = apLabelsOnLeft(ap, x, y, scaledWidth, scaledHeight);
  const highlightBands = (coRole.mode === 'hovered' || coRole.mode === 'peer')
    ? coRole.highlightBands
    : null;
  drawChannelLabels(ap, x, y, apRadius, color, labelsOnLeft, highlightBands);
  ctx.restore();
}

// Base screen-px distance for nearby device label conflicts (at zoom 1, small font).
const DEVICE_LABEL_OVERLAP_PX = 24;
// Extra horizontal reach covering typical right-side AP RF/PoE label width (small font).
const DEVICE_LABEL_REACH_X_PX = 150;
// Fallback vertical half-height when few label layers are enabled (small font).
const DEVICE_LABEL_REACH_Y_PX = 55;

function deviceLabelFontMul() {
  return Math.max(1, state.fontSizeMultiplier || 1);
}

function deviceLabelOverlapPx() {
  const pr = state.drawPixelRatio || 1;
  // Marker spacing grows with zoom; larger fonts need a wider conflict radius.
  return DEVICE_LABEL_OVERLAP_PX * pr * Math.max(1, state.zoom || 1) * deviceLabelFontMul();
}

function deviceLabelReachXPx() {
  const pr = state.drawPixelRatio || 1;
  // Label text width scales roughly with font size.
  return DEVICE_LABEL_REACH_X_PX * pr * deviceLabelFontMul();
}

// Approximate half-height of the tallest on-map label stack for current settings.
// Used so AP↔switch pairs still conflict when markers are farther apart than the
// old fixed 55px band (regression with large font + PoE/LLDP lines).
function deviceLabelReachYPx() {
  const pr = state.drawPixelRatio || 1;
  const fontMul = deviceLabelFontMul();
  const lineHeight = 14 * fontMul * pr;
  let lines = 0;
  if (state.showHostname) lines += 1;
  if (state.showBandInfo) lines += 3; // 2.4 / 5 / 6
  if (state.showLldp) lines += 1;
  if (state.showPoE) lines += 2; // negotiated + Using
  const stackHalf = lines > 0 ? (lines * lineHeight) / 2 + lineHeight : 0;
  return Math.max(DEVICE_LABEL_REACH_Y_PX * pr * fontMul, stackHalf);
}

function devicesLabelConflict(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= deviceLabelOverlapPx()) return true;

  // Labels stay fixed screen size while markers separate as you zoom in.
  // Conflict when a peer sits inside this device's label footprint (right by
  // default): same column (dx≈0) or within horizontal label reach.
  if (Math.abs(dy) > deviceLabelReachYPx()) return false;
  return Math.abs(dx) <= deviceLabelReachXPx();
}

function collectDeviceLabelPeers(scaledWidth, scaledHeight, { excludeApKey = null, excludeSwitchKey = null } = {}) {
  const peers = [];

  if (state.showAPs) {
    for (const ap of getVisibleAccessPoints()) {
      const key = accessPointKey(ap);
      if (!key || key === excludeApKey) continue;
      if (!ap.position || ap.position.xPercent === undefined || ap.position.yPercent === undefined) {
        continue;
      }
      peers.push({
        x: state.offsetX + (ap.position.xPercent / 100 * scaledWidth),
        y: state.offsetY + (ap.position.yPercent / 100 * scaledHeight),
        key: `ap:${key}`
      });
    }
  }

  if (state.showSwitches) {
    for (const sw of getVisibleSwitches()) {
      const key = switchKey(sw);
      if (!key || key === excludeSwitchKey) continue;
      peers.push({
        x: state.offsetX + (sw.xPercent / 100 * scaledWidth),
        y: state.offsetY + (sw.yPercent / 100 * scaledHeight),
        key: `sw:${key}`
      });
    }
  }

  return peers;
}

// Fan labels outward on conflict: left device → left, right device → right.
function labelsOnLeftForPeers(x, y, thisKey, peers) {
  for (const peer of peers) {
    if (!devicesLabelConflict(x, y, peer.x, peer.y)) continue;
    if (peer.x > x || (peer.x === x && peer.key > thisKey)) {
      return true;
    }
  }
  return false;
}

// AP labels flip left when overlapping another AP or a switch.
function apLabelsOnLeft(ap, x, y, scaledWidth, scaledHeight) {
  const apKey = accessPointKey(ap);
  const peers = collectDeviceLabelPeers(scaledWidth, scaledHeight, { excludeApKey: apKey });
  return labelsOnLeftForPeers(x, y, `ap:${apKey}`, peers);
}

// Switch labels flip left when overlapping an AP or another switch.
function switchLabelsOnLeft(sw, x, y, scaledWidth, scaledHeight) {
  const swKey = switchKey(sw);
  const peers = collectDeviceLabelPeers(scaledWidth, scaledHeight, { excludeSwitchKey: swKey });
  return labelsOnLeftForPeers(x, y, `sw:${swKey}`, peers);
}

// Draw switches (skip hovered — redrawn on top later)
function drawSwitches() {
  const scale = getMapDrawScale();
  if (!scale) return;

  getVisibleSwitches().forEach((sw) => {
    if (isDraggedSwitch(sw)) return;
    if (isHoveredSwitch(sw)) return;
    drawOneSwitch(sw, scale.scaledWidth, scale.scaledHeight);
  });
}

function drawOneSwitch(sw, scaledWidth, scaledHeight) {
  const pr = state.drawPixelRatio || 1;
  const radius = 12 * pr;
  const x = state.offsetX + (sw.xPercent / 100 * scaledWidth);
  const y = state.offsetY + (sw.yPercent / 100 * scaledHeight);
  const color = deviceStatusColor(sw.deviceStatus);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * pr;
  ctx.stroke();

  // Switch chassis glyph: white bar with a port circle on the right
  const boxW = 11 * pr;
  const boxH = 5 * pr;
  const boxX = x - boxW / 2;
  const boxY = y - boxH / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.beginPath();
  ctx.arc(boxX + boxW - 2.5 * pr, y, 1.4 * pr, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  if (isSelectedSearchSwitch(sw)) {
    drawSearchPulse(x, y, pr);
  }

  const labelsOnLeft = switchLabelsOnLeft(sw, x, y, scaledWidth, scaledHeight);
  drawSwitchLabels(sw, x, y, radius, color, labelsOnLeft);
}

function drawHoveredDeviceOnTop() {
  if (!state.hoveredDevice) return;
  if (state.deviceDrag && state.hoveredDevice.key === state.deviceDrag.key) return;
  const scale = getMapDrawScale();
  if (!scale) return;

  if (state.hoveredDevice.type === 'ap' && state.showAPs) {
    const ap = getVisibleAccessPoints().find((a) => accessPointKey(a) === state.hoveredDevice.key);
    if (ap) drawOneAccessPoint(ap, scale.scaledWidth, scale.scaledHeight);
    return;
  }

  if (state.hoveredDevice.type === 'switch' && state.showSwitches) {
    const sw = getVisibleSwitches().find((s) => switchKey(s) === state.hoveredDevice.key);
    if (sw) drawOneSwitch(sw, scale.scaledWidth, scale.scaledHeight);
  }
}

function drawDeviceDragCrosshairs() {
  const drag = state.deviceDrag;
  if (!drag || drag.overCanvas === false) return;
  const pr = state.drawPixelRatio || 1;
  const x = drag.currentX;
  const y = drag.currentY;
  const arm = 14 * pr;
  const gap = 4 * pr;

  ctx.save();
  ctx.strokeStyle = '#0d6efd';
  ctx.lineWidth = 2 * pr;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x - arm, y);
  ctx.lineTo(x - gap, y);
  ctx.moveTo(x + gap, y);
  ctx.lineTo(x + arm, y);
  ctx.moveTo(x, y - arm);
  ctx.lineTo(x, y - gap);
  ctx.moveTo(x, y + gap);
  ctx.lineTo(x, y + arm);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 2.5 * pr, 0, Math.PI * 2);
  ctx.fillStyle = '#0d6efd';
  ctx.fill();
  ctx.restore();
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
  const hostname = state.showHostname ? switchHostname(sw) : '';
  const poeText = state.showPoE ? formatSwitchPoeUsage(sw) : null;
  if (!hostname && !poeText) return;

  const pr = state.drawPixelRatio || 1;
  const labelX = labelsOnLeft ? x - radius - 5 * pr : x + radius + 5 * pr;
  const baseFontSize = 11;
  const fontSize = Math.round(baseFontSize * state.fontSizeMultiplier * pr);
  const lineHeight = 14 * state.fontSizeMultiplier * pr;
  const bgPadding = 2 * pr;
  const bgHeight = fontSize + 3 * pr;
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
  const pr = state.drawPixelRatio || 1;
  const bgPadding = 2 * pr;
  const bgHeight = fontSize + 3 * pr;
  const bgYOffset = fontSize * 0.8;
  const textWidth = ctx.measureText(text).width;
  const bgX = labelsOnLeft ? labelX - textWidth - bgPadding : labelX - bgPadding;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(bgX, labelY - bgYOffset, textWidth + (bgPadding * 2), bgHeight);
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, labelX, labelY);
}

// Draw channel labels next to AP (right by default; left when overlapping another AP/switch)
// highlightBands: when set (hovered/peer in co-channel mode), mute non-matching band lines
function drawChannelLabels(ap, x, y, apRadius, apColor, labelsOnLeft = false, highlightBands = null) {
  const radio = ap.radio;
  const labels = [];
  const emphasizeBands = highlightBands ? new Set(highlightBands) : null;

  const clientsByBand = ap.clientCountsByBand || null;

  if (state.showBandInfo && radio) {
    // 2.4GHz
    if (radio.apRadioParams24G) {
      if (radio.apRadioParams24G.operativeChannel) {
        const ch = radio.apRadioParams24G.operativeChannel;
        const bw = operativeBandwidth(radio.apRadioParams24G);
        const tx = formatTxPower(radio.apRadioParams24G.actualTxPower, radio.apRadioParams24G.operativeTxPower, radio.apRadioParams24G.txPower, ap.model, 'model24G');
        const clients = clientsByBand ? (clientsByBand['2.4G'] || 0) : null;
        labels.push({ band: '2.4G', channel: ch, bandwidth: bw, txPower: tx, clients, color: BAND_COLORS['2.4G'] });
      } else {
        labels.push({ band: '2.4G', disabled: true, color: BAND_COLORS['2.4G'] });
      }
    }

    // 5GHz
    if (radio.apRadioParams50G) {
      if (radio.apRadioParams50G.operativeChannel) {
        const ch = radio.apRadioParams50G.operativeChannel;
        const bw = operativeBandwidth(radio.apRadioParams50G);
        const tx = formatTxPower(radio.apRadioParams50G.actualTxPower, radio.apRadioParams50G.operativeTxPower, radio.apRadioParams50G.txPower, ap.model, 'model5G');
        const clients = clientsByBand ? (clientsByBand['5G'] || 0) : null;
        labels.push({ band: '5G', channel: ch, bandwidth: bw, txPower: tx, clients, color: BAND_COLORS['5G'] });
      } else {
        labels.push({ band: '5G', disabled: true, color: BAND_COLORS['5G'] });
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
        const clients = clientsByBand ? (clientsByBand['6G'] || 0) : null;
        labels.push({ band: '6G', channel: ch, bandwidth: bw, txPower: tx, afcSuffix, clients, color: BAND_COLORS['6G'] });
      } else {
        labels.push({ band: '6G', disabled: true, color: BAND_COLORS['6G'] });
      }
    }
  }

  // Check if PoE / LLDP info should be displayed
  const poeMac = (ap.mac || ap.macAddress || '').toLowerCase();
  const poeInfo = state.showPoE && poeMac ? state.apPoeInfo[poeMac] : null;
  const poeDetail = state.showLldp && poeMac ? state.apPoeDetails[poeMac] : null;
  const showHost = state.showHostname && ap.name;
  const poeLines = poeLabelLines(poeInfo);
  const uplinkLines = uplinkLabelLines(poeDetail);
  const totalLines = labels.length + poeLines.length + uplinkLines.length;

  if (totalLines === 0 && !showHost) return;

  const pr = state.drawPixelRatio || 1;
  const labelX = labelsOnLeft ? x - apRadius - 5 * pr : x + apRadius + 5 * pr;
  const baseFontSize = 11;
  const fontSize = Math.round(baseFontSize * state.fontSizeMultiplier * pr);
  const lineHeight = 14 * state.fontSizeMultiplier * pr;
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
      const clientsPart = label.clients != null ? `/${label.clients}` : '';
      text = `${label.band}: ${label.channel}/${label.bandwidth}${txPart}${afcPart}${clientsPart}`;
    }
    let lineColor = label.disabled ? '#999999' : label.color;
    if (!label.disabled && emphasizeBands && !emphasizeBands.has(label.band)) {
      lineColor = CO_CHANNEL_MUTED_LABEL;
    }
    drawMapLabelLine(text, labelX, labelY, lineColor, fontSize, labelsOnLeft);
  });

  // LLDP above PoE for a cleaner stack
  uplinkLines.forEach((line, index) => {
    const uplinkY = startY + ((labels.length + index) * lineHeight);
    const uplinkColor = emphasizeBands ? CO_CHANNEL_MUTED_LABEL : line.color;
    drawMapLabelLine(line.text, labelX, uplinkY, uplinkColor, fontSize, labelsOnLeft);
  });

  // PoE multi-line block stays left-aligned (Using indented under the value).
  // When AP labels flip left, other lines use textAlign=right; keep PoE as a
  // left-aligned block anchored so the first line's right edge stays at labelX.
  const poeIndent = ctx.measureText('PoE: ').width;
  const poeBlockLeft = labelsOnLeft && poeLines.length > 0
    ? labelX - ctx.measureText(poeLines[0].text).width
    : labelX;
  if (labelsOnLeft && poeLines.length > 0) {
    ctx.textAlign = 'left';
  }
  poeLines.forEach((line, index) => {
    const poeY = startY + ((labels.length + uplinkLines.length + index) * lineHeight);
    const lineX = line.indent ? poeBlockLeft + poeIndent : poeBlockLeft;
    // Mute PoE with non-matching band labels during co-channel highlight
    const poeColor = emphasizeBands ? CO_CHANNEL_MUTED_LABEL : line.color;
    drawMapLabelLine(line.text, lineX, poeY, poeColor, fontSize, false);
  });

  ctx.restore();
}

// Stack negotiated + live draw: "PoE: 802.3bt C5 40.3W /" then indented "Using 14.2W".
function poeLabelLines(poeInfo) {
  if (!poeInfo) return [];
  const isError = poeInfo.startsWith('error:');
  const value = (isError ? poeInfo.substring(6) : poeInfo).replace(/\bUsed\b/g, 'Using');
  const color = isError ? '#dc3545' : '#333333';
  const usedSplit = value.match(/^(.*) \/ (Using .+)$/);
  if (usedSplit) {
    return [
      { text: `PoE: ${usedSplit[1]} /`, color },
      { text: usedSplit[2], color, indent: true }
    ];
  }
  return [{ text: `PoE: ${value}`, color }];
}

// LLDP uplink hint from cached PoE details: "LLDP: ICX-Lobby · 1/1/12" (FR#9).
function uplinkLabelLines(detail) {
  if (!detail) return [];
  const rawName = detail.switchName ? String(detail.switchName).trim() : '';
  const portId = detail.portId ? String(detail.portId).trim() : '';
  if (!rawName && !portId) return [];
  const switchName = rawName.length > 24 ? `${rawName.slice(0, 23)}…` : rawName;
  const parts = [];
  if (switchName) parts.push(switchName);
  if (portId) parts.push(portId);
  return [{ text: `LLDP: ${parts.join(' · ')}`, color: '#333333' }];
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
  if (!state.showAPs) return null;

  const apRadius = 12;
  const scale = getMapScale();
  if (!scale) return null;

  let best = null;
  let bestDist = Infinity;
  for (const ap of getVisibleAccessPoints()) {
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
  if (!state.showSwitches) return null;

  const radius = 12;
  const scale = getMapScale();
  if (!scale) return null;

  let best = null;
  let bestDist = Infinity;
  for (const sw of getVisibleSwitches()) {
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
  // FR#3: while co-channel highlight is up (or about to start on this AP), ignore switches
  const ignoreSwitches = isCoChannelHoverActive() ||
    (ap && getApChannelKeys(ap).size > 0);
  const sw = ignoreSwitches ? null : getSwitchAtPoint(pointX, pointY);
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

// Handle Canvas Mouse Move (cursor change + panning + hover; device drag uses document listeners)
function handleCanvasMouseMove(e) {
  if (state.deviceDrag) return;

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
  if (state.editMode && hit) {
    elements.canvas.style.cursor = 'grab';
  } else {
    elements.canvas.style.cursor = hit ? 'pointer' : (state.zoom > 1 ? 'grab' : 'default');
  }
  if (setHoveredDevice(hit)) {
    renderFloorPlan();
  }
}

// Handle Canvas Click
function handleCanvasClick(e) {
  // Don't trigger click if we just finished panning or dragging
  if (state.didPan) {
    state.didPan = false;
    return;
  }
  if (state.didDeviceDrag) {
    state.didDeviceDrag = false;
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

// Handle Canvas Mouse Down (start device drag in edit mode, else panning)
function handleCanvasMouseDown(e) {
  const rect = elements.canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const hit = getDeviceAtPoint(mouseX, mouseY);
  if (state.editMode && hit && state.canWritePositions !== false) {
    beginDeviceDrag(hit, mouseX, mouseY, e.clientX, e.clientY);
    return;
  }

  // Don't start panning if clicking on an AP or switch
  if (hit) return;

  state.isPanning = true;
  state.didPan = false;
  state.panStartX = mouseX;
  state.panStartY = mouseY;
  elements.canvas.style.cursor = 'grabbing';
}

// Handle Canvas Mouse Up (panning only; device drag finishes via document listener)
function handleCanvasMouseUp() {
  if (state.deviceDrag) return;
  if (state.isPanning) {
    state.isPanning = false;
    // If we moved while panning, suppress the click
    state.didPan = true;
    elements.canvas.style.cursor = state.zoom > 1 ? 'grab' : 'default';
  }
}

// Handle Canvas Mouse Leave (stop panning / clear hover; keep device drag alive for document drop)
function handleCanvasMouseLeave() {
  if (state.deviceDrag) {
    state.deviceDrag.overCanvas = false;
    renderFloorPlan();
    return;
  }
  if (state.isPanning) {
    state.isPanning = false;
    state.didPan = false;
  }
  if (setHoveredDevice(null)) {
    renderFloorPlan();
  }
}

// --- FR#18 Edit / move device locations ---

const ADMIN_SCOPE_MESSAGE =
  'Moving devices requires API credentials with Administrator Scope (write access to RUCKUS One). ' +
  'Create a new Application Token with Administrator Scope, or continue viewing with Read Only.';

let deviceDragListenersAttached = false;

function clientPointToCanvas(clientX, clientY) {
  if (!elements.canvas) return null;
  const rect = elements.canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
    overCanvas:
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
  };
}

function handleDocumentDeviceDragMove(e) {
  if (!state.deviceDrag) return;
  const pt = clientPointToCanvas(e.clientX, e.clientY);
  if (!pt) return;
  const dx = e.clientX - (state.deviceDrag.clientX || e.clientX);
  const dy = e.clientY - (state.deviceDrag.clientY || e.clientY);
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2 || state.deviceDrag.moved) {
    state.deviceDrag.moved = true;
  }
  state.deviceDrag.clientX = e.clientX;
  state.deviceDrag.clientY = e.clientY;
  state.deviceDrag.currentX = pt.x;
  state.deviceDrag.currentY = pt.y;
  state.deviceDrag.overCanvas = pt.overCanvas;
  if (pt.overCanvas) {
    elements.canvas.style.cursor = 'crosshair';
  }
  renderFloorPlan();
}

async function handleDocumentDeviceDragUp(e) {
  if (!state.deviceDrag) return;
  const pt = clientPointToCanvas(e.clientX, e.clientY);
  if (pt) {
    state.deviceDrag.currentX = pt.x;
    state.deviceDrag.currentY = pt.y;
    state.deviceDrag.overCanvas = pt.overCanvas;
  }
  if (!state.deviceDrag.moved) {
    cancelDeviceDrag({ suppressClick: state.deviceDrag.source === 'unplaced' });
    return;
  }
  if (!state.deviceDrag.overCanvas) {
    cancelDeviceDrag();
    return;
  }
  await finishDeviceDrag();
}

function attachDeviceDragListeners() {
  if (deviceDragListenersAttached) return;
  document.addEventListener('mousemove', handleDocumentDeviceDragMove);
  document.addEventListener('mouseup', handleDocumentDeviceDragUp);
  deviceDragListenersAttached = true;
}

function detachDeviceDragListeners() {
  if (!deviceDragListenersAttached) return;
  document.removeEventListener('mousemove', handleDocumentDeviceDragMove);
  document.removeEventListener('mouseup', handleDocumentDeviceDragUp);
  deviceDragListenersAttached = false;
}

function isApUnplaced(ap) {
  if (!ap) return true;
  const pos = ap.position;
  if (!pos || !pos.floorplanId) return true;
  return typeof pos.xPercent !== 'number' || typeof pos.yPercent !== 'number';
}

function isSwitchUnplaced(sw) {
  if (!sw) return true;
  if (!sw.floorplanId) return true;
  return typeof sw.xPercent !== 'number' || typeof sw.yPercent !== 'number';
}

function getUnplacedVenueDevices() {
  const aps = (state.venueDevices.accessPoints || [])
    .filter((ap) => isApUnplaced(ap))
    .map((device) => ({
      type: 'ap',
      device,
      key: accessPointKey(device),
      name: device.name || device.serialNumber || 'Unnamed AP',
      subtitle: [device.serialNumber, device.mac || device.macAddress].filter(Boolean).join(' · ')
    }));
  const switches = (state.venueDevices.switches || [])
    .filter((sw) => isSwitchUnplaced(sw))
    .map((device) => ({
      type: 'switch',
      device,
      key: switchKey(device),
      name: switchHostname(device) || device.id || 'Unnamed Switch',
      subtitle: [device.id, device.serialNumber || device.switchSerial, device.switchMac]
        .filter(Boolean)
        .join(' · ')
    }));
  return [...aps, ...switches].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' })
  );
}

function unplacedEntryMatchesSearch(entry, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const macQ = normalizeMacForSearch(q);
  const hay = [
    entry.name,
    entry.subtitle,
    entry.device.serialNumber,
    entry.device.mac,
    entry.device.macAddress,
    entry.device.switchMac,
    entry.device.id
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  if (hay.some((h) => h.includes(q))) return true;
  if (macQ && macQ.length >= 4) {
    return hay.some((h) => normalizeMacForSearch(h).includes(macQ));
  }
  return false;
}

function renderUnplacedDevicesPanel() {
  if (!elements.unplacedDevicesPanel || !elements.unplacedDevicesList) return;

  const all = getUnplacedVenueDevices();
  const filtered = all.filter((entry) => unplacedEntryMatchesSearch(entry, state.unplacedSearchQuery));
  const show =
    state.editMode &&
    !state.unplacedPanelDismissed &&
    all.length > 0;

  elements.unplacedDevicesPanel.classList.toggle('hidden', !show);
  if (elements.unplacedDevicesTitle) {
    elements.unplacedDevicesTitle.textContent = `Unplaced Devices (${all.length})`;
  }
  if (!show) {
    elements.unplacedDevicesList.innerHTML = '';
    return;
  }

  if (filtered.length === 0) {
    elements.unplacedDevicesList.innerHTML =
      '<div class="unplaced-devices-empty">No matching unplaced devices.</div>';
    return;
  }

  elements.unplacedDevicesList.innerHTML = filtered.map((entry) => {
    const kindClass = entry.type === 'switch' ? 'switch' : '';
    const kindLabel = entry.type === 'switch' ? 'SW' : 'AP';
    return `
      <div class="unplaced-device-row" data-type="${entry.type}" data-key="${encodeURIComponent(entry.key)}" title="Drag onto the floor plan">
        <span class="unplaced-device-kind ${kindClass}">${kindLabel}</span>
        <div class="unplaced-device-meta">
          <div class="unplaced-device-name">${escapeHtml(entry.name)}</div>
          ${entry.subtitle ? `<div class="unplaced-device-sub">${escapeHtml(entry.subtitle)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function updateUnplacedEditBadge() {
  const badge = elements.editUnplacedBadge;
  if (!badge) return;

  const count = state.venueDevices.fetchedAt ? getUnplacedVenueDevices().length : 0;
  const show = count > 0;
  badge.classList.toggle('hidden', !show);
  badge.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (show) {
    badge.textContent = count > 99 ? '99+' : String(count);
  } else {
    badge.textContent = '';
  }

  if (elements.editModeBtn) {
    const baseTitle = 'Edit device locations (requires Administrator Scope)';
    const baseLabel = 'Edit device locations';
    if (show) {
      const noun = count === 1 ? 'unplaced device' : 'unplaced devices';
      elements.editModeBtn.title = `${baseTitle} — ${count} ${noun}`;
      elements.editModeBtn.setAttribute('aria-label', `${baseLabel}, ${count} ${noun}`);
    } else {
      elements.editModeBtn.title = baseTitle;
      elements.editModeBtn.setAttribute('aria-label', baseLabel);
    }
  }
}

function syncEditModeUi() {
  if (elements.editModeBtn) {
    elements.editModeBtn.classList.toggle('active', !!state.editMode);
    elements.editModeBtn.setAttribute('aria-pressed', state.editMode ? 'true' : 'false');
  }
  if (elements.editModeBanner) {
    const showBanner = state.editMode && !state.editBannerDismissed;
    elements.editModeBanner.classList.toggle('hidden', !showBanner);
  }
  renderUnplacedDevicesPanel();
  updateUnplacedEditBadge();
  if (elements.canvas && !state.deviceDrag && !state.isPanning) {
    elements.canvas.style.cursor = state.editMode
      ? 'default'
      : (state.zoom > 1 ? 'grab' : 'default');
  }
}

function setEditMode(on) {
  if (!on && state.deviceDrag) cancelDeviceDrag();
  const enabling = !!on && !state.editMode;
  state.editMode = !!on;
  if (enabling) {
    state.editBannerDismissed = false;
    state.unplacedPanelDismissed = false;
    state.unplacedSearchQuery = '';
    if (elements.unplacedDevicesSearch) elements.unplacedDevicesSearch.value = '';
  }
  if (!on) {
    state.editBannerDismissed = false;
    state.unplacedPanelDismissed = false;
  }
  syncEditModeUi();
}

async function toggleEditMode() {
  if (state.editMode) {
    setEditMode(false);
    return;
  }
  if (!state.selectedVenue || !state.selectedFloorPlan) {
    alert('Open a floor plan before editing device locations.');
    return;
  }

  if (elements.editModeBtn) elements.editModeBtn.disabled = true;
  try {
    const ok = await ensurePlacementWriteAccess();
    if (!ok) {
      setEditMode(false);
      return;
    }
    setEditMode(true);
  } finally {
    if (elements.editModeBtn) elements.editModeBtn.disabled = false;
  }
}

function probePercent(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

// The probe re-writes a device's current position, so only devices already
// placed on this floor with valid coordinates qualify (never unplaced ones).
function pickProbeDevice() {
  const floorPlanId = state.selectedFloorPlan && state.selectedFloorPlan.id;
  if (!floorPlanId) return null;
  for (const ap of state.accessPoints) {
    const pos = ap.position;
    if (!ap.serialNumber || !pos || pos.floorplanId !== floorPlanId) continue;
    const xPercent = probePercent(pos.xPercent);
    const yPercent = probePercent(pos.yPercent);
    if (xPercent != null && yPercent != null) {
      return { type: 'ap', deviceId: ap.serialNumber, xPercent, yPercent };
    }
  }
  for (const sw of state.switches) {
    if (!sw.id || sw.floorplanId !== floorPlanId) continue;
    const xPercent = probePercent(sw.xPercent);
    const yPercent = probePercent(sw.yPercent);
    if (xPercent != null && yPercent != null) {
      return { type: 'switch', deviceId: sw.id, xPercent, yPercent };
    }
  }
  return null;
}

async function ensurePlacementWriteAccess() {
  if (state.canWritePositions === true) return true;
  if (state.canWritePositions === false) {
    alert(ADMIN_SCOPE_MESSAGE);
    return false;
  }

  const probeTarget = pickProbeDevice();
  if (!probeTarget) {
    // Nothing placed on this floor to re-write safely. Allow edit mode
    // unverified; the first real move confirms access (403 rolls back).
    return true;
  }

  const result = await window.api.probePlacementWriteAccess({
    type: probeTarget.type,
    venueId: state.selectedVenue.id,
    floorPlanId: state.selectedFloorPlan.id,
    deviceId: probeTarget.deviceId,
    xPercent: probeTarget.xPercent,
    yPercent: probeTarget.yPercent
  });

  if (!result.success) {
    if (result.statusCode === 403) {
      state.canWritePositions = false;
      alert(ADMIN_SCOPE_MESSAGE);
      return false;
    }
    alert(`Could not verify write access: ${result.error || 'Unknown error'}`);
    return false;
  }

  state.canWritePositions = !!result.canWrite;
  if (!state.canWritePositions) {
    alert(ADMIN_SCOPE_MESSAGE);
    return false;
  }
  return true;
}

function canvasPointToPercent(canvasX, canvasY) {
  const scale = getMapDrawScale();
  if (!scale || scale.scaledWidth <= 0 || scale.scaledHeight <= 0) return null;
  const xPercent = ((canvasX - state.offsetX) / scale.scaledWidth) * 100;
  const yPercent = ((canvasY - state.offsetY) / scale.scaledHeight) * 100;
  return {
    xPercent: Math.min(100, Math.max(0, xPercent)),
    yPercent: Math.min(100, Math.max(0, yPercent))
  };
}

function beginDeviceDrag(hit, mouseX, mouseY, clientX, clientY, source = 'map') {
  let origXPercent = null;
  let origYPercent = null;
  if (source === 'map') {
    if (hit.type === 'ap') {
      origXPercent = hit.device.position.xPercent;
      origYPercent = hit.device.position.yPercent;
    } else {
      origXPercent = hit.device.xPercent;
      origYPercent = hit.device.yPercent;
    }
  }
  state.deviceDrag = {
    type: hit.type,
    device: hit.device,
    key: hit.key,
    source,
    origXPercent,
    origYPercent,
    currentX: mouseX,
    currentY: mouseY,
    clientX: clientX ?? mouseX,
    clientY: clientY ?? mouseY,
    overCanvas: source === 'map',
    moved: false
  };
  state.didDeviceDrag = false;
  if (source === 'map') elements.canvas.style.cursor = 'crosshair';
  attachDeviceDragListeners();
  renderFloorPlan();
}

function handleUnplacedListMouseDown(e) {
  if (!state.editMode || state.canWritePositions === false) return;
  const row = e.target.closest('.unplaced-device-row');
  if (!row) return;
  e.preventDefault();
  const type = row.dataset.type;
  let key = row.dataset.key || '';
  try {
    key = decodeURIComponent(key);
  } catch (_) {
    /* keep raw */
  }
  const entry = getUnplacedVenueDevices().find((item) => item.type === type && item.key === key);
  if (!entry) return;
  const pt = clientPointToCanvas(e.clientX, e.clientY) || { x: 0, y: 0, overCanvas: false };
  beginDeviceDrag(
    { type: entry.type, device: entry.device, key: entry.key },
    pt.x,
    pt.y,
    e.clientX,
    e.clientY,
    'unplaced'
  );
}

function cancelDeviceDrag({ suppressClick = true } = {}) {
  if (!state.deviceDrag) return;
  state.deviceDrag = null;
  state.didDeviceDrag = suppressClick;
  detachDeviceDragListeners();
  syncEditModeUi();
  renderFloorPlan();
}

function applyLocalDevicePosition(type, device, xPercent, yPercent) {
  if (type === 'ap') {
    if (!device.position) device.position = {};
    device.position.xPercent = xPercent;
    device.position.yPercent = yPercent;
    device.position.floorplanId = state.selectedFloorPlan.id;
    const serial = device.serialNumber;
    const mac = device.mac || device.macAddress;
    (state.venueDevices.accessPoints || []).forEach((ap) => {
      if (
        (serial && ap.serialNumber === serial) ||
        (mac && (ap.mac === mac || ap.macAddress === mac))
      ) {
        if (!ap.position) ap.position = {};
        ap.position.xPercent = xPercent;
        ap.position.yPercent = yPercent;
        ap.position.floorplanId = state.selectedFloorPlan.id;
      }
    });
    return;
  }

  device.xPercent = xPercent;
  device.yPercent = yPercent;
  device.floorplanId = state.selectedFloorPlan.id;
  const id = device.id;
  (state.venueDevices.switches || []).forEach((sw) => {
    if (id && sw.id === id) {
      sw.xPercent = xPercent;
      sw.yPercent = yPercent;
      sw.floorplanId = state.selectedFloorPlan.id;
    }
  });
}

function clearLocalDevicePlacement(type, device) {
  if (type === 'ap') {
    if (device.position) {
      delete device.position.floorplanId;
      delete device.position.xPercent;
      delete device.position.yPercent;
    }
    const serial = device.serialNumber;
    const mac = device.mac || device.macAddress;
    (state.venueDevices.accessPoints || []).forEach((ap) => {
      if (
        (serial && ap.serialNumber === serial) ||
        (mac && (ap.mac === mac || ap.macAddress === mac))
      ) {
        if (ap.position) {
          delete ap.position.floorplanId;
          delete ap.position.xPercent;
          delete ap.position.yPercent;
        }
      }
    });
    state.accessPoints = (state.accessPoints || []).filter(
      (ap) => accessPointKey(ap) !== accessPointKey(device)
    );
    return;
  }

  delete device.floorplanId;
  delete device.xPercent;
  delete device.yPercent;
  const id = device.id;
  (state.venueDevices.switches || []).forEach((sw) => {
    if (id && sw.id === id) {
      delete sw.floorplanId;
      delete sw.xPercent;
      delete sw.yPercent;
    }
  });
  state.switches = (state.switches || []).filter((sw) => switchKey(sw) !== switchKey(device));
}

function ensureDeviceOnCurrentFloorLists(type, device) {
  if (type === 'ap') {
    const key = accessPointKey(device);
    if (!(state.accessPoints || []).some((ap) => accessPointKey(ap) === key)) {
      state.accessPoints = [...(state.accessPoints || []), device];
    }
    return;
  }
  const key = switchKey(device);
  if (!(state.switches || []).some((sw) => switchKey(sw) === key)) {
    state.switches = [...(state.switches || []), device];
  }
}

async function finishDeviceDrag() {
  const drag = state.deviceDrag;
  if (!drag) return;

  const fromUnplaced = drag.source === 'unplaced';
  if (!drag.moved && !fromUnplaced) {
    state.deviceDrag = null;
    detachDeviceDragListeners();
    syncEditModeUi();
    renderFloorPlan();
    return;
  }

  if (!drag.overCanvas) {
    cancelDeviceDrag();
    return;
  }

  const pct = canvasPointToPercent(drag.currentX, drag.currentY);
  state.deviceDrag = null;
  state.didDeviceDrag = true;
  detachDeviceDragListeners();

  if (!pct) {
    syncEditModeUi();
    renderFloorPlan();
    return;
  }

  const deviceId = drag.type === 'ap'
    ? drag.device.serialNumber
    : drag.device.id;
  if (!deviceId) {
    alert('Cannot update this device: missing serial number or switch id.');
    syncEditModeUi();
    renderFloorPlan();
    return;
  }

  // Optimistic local place / move
  applyLocalDevicePosition(drag.type, drag.device, pct.xPercent, pct.yPercent);
  if (fromUnplaced) ensureDeviceOnCurrentFloorLists(drag.type, drag.device);
  renderFloorPlan();
  syncEditModeUi();

  const result = await window.api.updateDevicePosition({
    type: drag.type,
    venueId: state.selectedVenue.id,
    floorPlanId: state.selectedFloorPlan.id,
    deviceId,
    xPercent: pct.xPercent,
    yPercent: pct.yPercent
  });

  if (result.success) {
    state.canWritePositions = true;
  } else {
    if (fromUnplaced) {
      clearLocalDevicePlacement(drag.type, drag.device);
    } else {
      applyLocalDevicePosition(
        drag.type,
        drag.device,
        drag.origXPercent,
        drag.origYPercent
      );
    }
    renderFloorPlan();
    syncEditModeUi();
    if (result.statusCode === 403) {
      state.canWritePositions = false;
      setEditMode(false);
      alert(ADMIN_SCOPE_MESSAGE);
    } else {
      alert(`Failed to update device location: ${result.error || 'Unknown error'}`);
    }
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

  const byBand = ap.clientCountsByBand;
  const bandSum = byBand
    ? (byBand['2.4G'] || 0) + (byBand['5G'] || 0) + (byBand['6G'] || 0)
    : null;
  // When band breakdown exists, total must match it (aps/query clientCount can lag).
  const totalClients = bandSum != null ? bandSum : ap.clientCount;
  elements.apClients.textContent =
    totalClients === undefined || totalClients === null ? 'N/A' : String(totalClients);

  if (byBand && elements.apClientsByBandRow && elements.apClientsByBand) {
    const radio = ap.radio || {};
    const parts = [];
    if (radio.apRadioParams24G) parts.push(`2.4G: ${byBand['2.4G'] || 0}`);
    if (radio.apRadioParams50G) parts.push(`5G: ${byBand['5G'] || 0}`);
    if (radio.apRadioParams6G && radio.enable6G === true) parts.push(`6G: ${byBand['6G'] || 0}`);
    if (!parts.length) {
      // No radio config to filter bands — show whatever counts we have.
      for (const band of ['2.4G', '5G', '6G']) {
        if (byBand[band] != null) parts.push(`${band}: ${byBand[band]}`);
      }
    }
    if (parts.length) {
      elements.apClientsByBand.textContent = parts.join(' · ');
      elements.apClientsByBandRow.classList.remove('hidden');
    } else {
      elements.apClientsByBand.textContent = '';
      elements.apClientsByBandRow.classList.add('hidden');
    }
  } else if (elements.apClientsByBandRow) {
    elements.apClientsByBandRow.classList.add('hidden');
  }

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

  fillSwitchPoePopupSection(sw);

  elements.switchPopup.classList.remove('hidden');
}

function fillSwitchPoePopupSection(sw) {
  if (!elements.switchPoeRow || !elements.switchPoe) return;

  const usage = formatSwitchPoeUsage(sw);
  const linked = Object.values(state.apPoeDetails || {}).filter((d) => detailBelongsToSwitch(d, sw));
  const issues = linked.filter((d) => isPoeIssueDetail(d));

  if (usage) {
    elements.switchPoe.textContent = usage;
    elements.switchPoeRow.classList.remove('hidden');
  } else {
    elements.switchPoe.textContent = '';
    elements.switchPoeRow.classList.add('hidden');
  }

  if (!elements.switchPoeIssuesRow || !elements.switchPoeIssues) return;

  if (issues.length === 0) {
    elements.switchPoeIssues.textContent = '';
    elements.switchPoeIssuesRow.classList.add('hidden');
    return;
  }

  elements.switchPoeIssuesRow.classList.remove('hidden');
  elements.switchPoeIssues.innerHTML = '';
  issues.forEach((detail) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'poe-issue-link';
    btn.textContent = `${detail.apName || detail.apMac} (${poeIssueLabel(detail)})`;
    btn.addEventListener('click', () => focusApFromPoeDetail(detail));
    elements.switchPoeIssues.appendChild(btn);
  });
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

// Strip MAC separators so aa:bb:cc, aa-bb-cc, and aabbcc match the same way
function normalizeMacForSearch(mac) {
  return String(mac || '').replace(/[^a-fA-F0-9]/g, '').toLowerCase();
}

function matchesMacQuery(query, mac) {
  const qNorm = normalizeMacForSearch(query);
  const mNorm = normalizeMacForSearch(mac);
  if (!qNorm || !mNorm || qNorm.length < 3) return false;
  return mNorm.includes(qNorm);
}

function matchesIpQuery(query, ip) {
  if (!query || !ip) return false;
  return String(ip).toLowerCase().includes(String(query).toLowerCase());
}

function accessPointSearchFields(ap) {
  return {
    texts: [ap.name, ap.serialNumber],
    macs: [ap.mac, ap.macAddress],
    ips: [ap.ipAddress, ap.ip]
  };
}

function switchSearchFields(sw) {
  return {
    texts: [switchHostname(sw), sw.id],
    macs: [sw.switchMac, sw.mac, sw.macAddress],
    ips: [sw.ipAddress, sw.ip]
  };
}

function deviceMatchesSearch(query, fields) {
  for (const text of fields.texts || []) {
    if (fuzzyMatch(query, text)) return true;
  }
  for (const mac of fields.macs || []) {
    if (matchesMacQuery(query, mac)) return true;
  }
  for (const ip of fields.ips || []) {
    if (matchesIpQuery(query, ip)) return true;
  }
  return false;
}

function isSelectedSearchAccessPoint(ap) {
  return state.selectedSearchDevice &&
    state.selectedSearchDevice.type === 'ap' &&
    accessPointKey(state.selectedSearchDevice.device) === accessPointKey(ap);
}

function isSelectedSearchSwitch(sw) {
  return state.selectedSearchDevice &&
    state.selectedSearchDevice.type === 'switch' &&
    switchKey(state.selectedSearchDevice.device) === switchKey(sw);
}

function drawSearchPulse(x, y, pr) {
  const now = Date.now() % 1500;
  const progress = now / 1500;
  const pulseRadius = (16 + (8 * Math.sin(progress * Math.PI * 2))) * pr;
  const pulseOpacity = 0.6 + (0.4 * Math.cos(progress * Math.PI * 2));

  ctx.strokeStyle = `rgba(0, 102, 204, ${pulseOpacity})`;
  ctx.lineWidth = 2 * pr;
  ctx.beginPath();
  ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
  ctx.stroke();
}

function searchResultSubtitle(entry) {
  const device = entry.device;
  if (entry.type === 'switch') {
    const parts = [device.switchMac || device.mac, device.ipAddress || device.ip].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Switch';
  }
  const parts = [device.serialNumber, device.mac || device.macAddress, device.ipAddress || device.ip]
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : 'N/A';
}

function searchResultName(entry) {
  if (entry.type === 'switch') {
    return switchHostname(entry.device) || 'Unnamed Switch';
  }
  return entry.device.name || 'Unnamed AP';
}

function isSearchResultSelected(entry) {
  if (!state.selectedSearchDevice) return false;
  if (state.selectedSearchDevice.type !== entry.type) return false;
  if (entry.type === 'ap') {
    return accessPointKey(state.selectedSearchDevice.device) === accessPointKey(entry.device);
  }
  return switchKey(state.selectedSearchDevice.device) === switchKey(entry.device);
}

// Handle device search (APs and switches by hostname, serial, MAC, or IP)
function handleAPSearch(e) {
  const query = e.target.value.trim();

  if (!query) {
    elements.apSearchDropdown.classList.add('hidden');
    state.searchResults = [];
    state.selectedSearchDevice = null;
    state.searchKeyboardIndex = -1;
    renderFloorPlan();
    return;
  }

  const results = [];
  if (state.showAPs) {
    for (const ap of getVisibleAccessPoints()) {
      if (deviceMatchesSearch(query, accessPointSearchFields(ap))) {
        results.push({ type: 'ap', device: ap });
      }
    }
  }
  if (state.showSwitches) {
    for (const sw of getVisibleSwitches()) {
      if (deviceMatchesSearch(query, switchSearchFields(sw))) {
        results.push({ type: 'switch', device: sw });
      }
    }
  }
  state.searchResults = results;
  state.searchKeyboardIndex = -1;

  renderAPSearchDropdown();
  elements.apSearchDropdown.classList.remove('hidden');
  renderFloorPlan();
}

// Render device search dropdown
function renderAPSearchDropdown() {
  elements.apSearchDropdown.innerHTML = '';

  if (state.searchResults.length === 0) {
    elements.apSearchDropdown.innerHTML = '<div class="ap-search-no-results">No devices found</div>';
    state.searchKeyboardIndex = -1;
    return;
  }

  if (state.searchKeyboardIndex >= state.searchResults.length) {
    state.searchKeyboardIndex = state.searchResults.length - 1;
  }

  state.searchResults.forEach((entry, index) => {
    const item = document.createElement('div');
    item.className = 'ap-search-item';
    if (isSearchResultSelected(entry)) {
      item.classList.add('selected');
    }
    if (index === state.searchKeyboardIndex) {
      item.classList.add('keyboard-active');
    }

    const kind = entry.type === 'switch' ? 'Switch' : 'AP';
    item.innerHTML = `
      <div class="ap-search-item-name">${escapeHtml(searchResultName(entry))} <span class="ap-search-item-kind">${kind}</span></div>
      <div class="ap-search-item-serial">${escapeHtml(searchResultSubtitle(entry))}</div>
    `;

    item.addEventListener('click', () => selectDeviceFromSearch(entry));
    elements.apSearchDropdown.appendChild(item);
  });

  const active = elements.apSearchDropdown.querySelector('.ap-search-item.keyboard-active');
  if (active && typeof active.scrollIntoView === 'function') {
    active.scrollIntoView({ block: 'nearest' });
  }
}

// Select device from search dropdown
function selectDeviceFromSearch(entry) {
  state.selectedSearchDevice = entry;
  state.searchKeyboardIndex = -1;
  elements.apSearch.value = searchResultName(entry);
  elements.apSearchDropdown.classList.add('hidden');
  renderFloorPlan();
}

// Handle Clear Search
function handleClearAPSearch() {
  elements.apSearch.value = '';
  elements.apSearchDropdown.classList.add('hidden');
  state.searchResults = [];
  state.selectedSearchDevice = null;
  state.searchKeyboardIndex = -1;
  closeAPSearchPopup();
  renderFloorPlan();
}

// ---- FR#17 Global Search ----

function clearGlobalSearchState() {
  state.globalSearchIndex = null;
  state.globalSearchHits = [];
  state.globalSearchBuilding = false;
  state.pendingSearchFocus = null;
}

function openGlobalSearchModal() {
  if (!elements.globalSearchModal) return;
  elements.globalSearchModal.classList.remove('hidden');
  setGlobalSearchStatus('');
  if (!state.globalSearchHits.length) {
    renderGlobalSearchPlaceholder('Enter a hostname, serial, MAC, or IP, then press Search.');
  }
  updateGlobalSearchRefreshEnabled();
  setTimeout(() => {
    if (elements.globalSearchInput) elements.globalSearchInput.focus();
  }, 50);
}

function closeGlobalSearchModal({ cancelIndex = false } = {}) {
  if (cancelIndex && state.globalSearchBuilding && window.api.cancelGlobalSearchIndex) {
    window.api.cancelGlobalSearchIndex();
  }
  if (elements.globalSearchModal) {
    elements.globalSearchModal.classList.add('hidden');
  }
  hideGlobalSearchProgress();
}

function updateGlobalSearchRefreshEnabled() {
  if (!elements.globalSearchRefresh) return;
  elements.globalSearchRefresh.disabled = !state.globalSearchIndex || state.globalSearchBuilding;
}

function setGlobalSearchStatus(message, { error = false } = {}) {
  if (!elements.globalSearchStatus) return;
  elements.globalSearchStatus.textContent = message || '';
  elements.globalSearchStatus.classList.toggle('is-error', !!error);
}

function showGlobalSearchProgress() {
  if (elements.globalSearchProgress) {
    elements.globalSearchProgress.classList.remove('hidden');
  }
}

function hideGlobalSearchProgress() {
  if (elements.globalSearchProgress) {
    elements.globalSearchProgress.classList.add('hidden');
  }
}

function updateGlobalSearchProgress(info = {}) {
  const percent = Number.isFinite(info.percent) ? Math.max(0, Math.min(100, info.percent)) : 0;
  if (elements.globalSearchProgressFill) {
    elements.globalSearchProgressFill.style.width = `${percent}%`;
  }
  if (elements.globalSearchProgressText) {
    const detail = info.message || 'Working…';
    const counts = Number.isFinite(info.done) && Number.isFinite(info.total)
      ? `${info.done} / ${info.total} · `
      : '';
    elements.globalSearchProgressText.textContent = `${counts}${detail}`;
  }
}

function renderGlobalSearchPlaceholder(text) {
  if (!elements.globalSearchResults) return;
  elements.globalSearchResults.innerHTML =
    `<div class="global-search-placeholder">${escapeHtml(text)}</div>`;
}

function venueNameById(venueId) {
  const venue = state.venues.find((v) => v.id === venueId);
  return venue?.name || venueId || 'Unknown Venue';
}

function floorNameFromIndex(floorPlanId, floorsById) {
  if (!floorPlanId) return 'Unassigned';
  const meta = floorsById && floorsById[floorPlanId];
  return meta?.name || 'Unknown Floor';
}

function deviceFloorPlanId(type, device) {
  if (type === 'ap') {
    return device?.position?.floorplanId || null;
  }
  return device?.floorplanId || null;
}

function deviceVenueId(type, device) {
  return device?.venueId || null;
}

function matchGlobalSearchHits(query, index) {
  const hits = [];
  const floorsById = index.floorsById || {};

  for (const ap of index.accessPoints || []) {
    if (!deviceMatchesSearch(query, accessPointSearchFields(ap))) continue;
    const floorPlanId = deviceFloorPlanId('ap', ap);
    const venueId = deviceVenueId('ap', ap);
    hits.push({
      type: 'ap',
      device: ap,
      key: accessPointKey(ap),
      name: searchResultName({ type: 'ap', device: ap }),
      venueId,
      venueName: venueNameById(venueId),
      floorPlanId,
      floorName: floorNameFromIndex(floorPlanId, floorsById)
    });
  }

  for (const sw of index.switches || []) {
    if (!deviceMatchesSearch(query, switchSearchFields(sw))) continue;
    const floorPlanId = deviceFloorPlanId('switch', sw);
    const venueId = deviceVenueId('switch', sw);
    hits.push({
      type: 'switch',
      device: sw,
      key: switchKey(sw),
      name: searchResultName({ type: 'switch', device: sw }),
      venueId,
      venueName: venueNameById(venueId),
      floorPlanId,
      floorName: floorNameFromIndex(floorPlanId, floorsById)
    });
  }

  hits.sort((a, b) => {
    const venueCmp = (a.venueName || '').localeCompare(b.venueName || '', undefined, { sensitivity: 'base' });
    if (venueCmp) return venueCmp;
    const floorCmp = (a.floorName || '').localeCompare(b.floorName || '', undefined, { sensitivity: 'base' });
    if (floorCmp) return floorCmp;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });

  return hits;
}

function renderGlobalSearchResults(hits, query) {
  if (!elements.globalSearchResults) return;
  elements.globalSearchResults.innerHTML = '';

  if (!hits.length) {
    elements.globalSearchResults.innerHTML =
      `<div class="global-search-empty">No devices found for “${escapeHtml(query)}”.</div>`;
    return;
  }

  hits.forEach((hit) => {
    const row = document.createElement('div');
    row.className = 'global-search-hit';
    row.setAttribute('role', 'listitem');

    const kind = hit.type === 'switch' ? 'Switch' : 'AP';
    // Jump only when the device is placed on a floor plan (Unassigned goes nowhere).
    const canJump = Boolean(hit.venueId && hit.floorPlanId);
    if (!canJump) row.classList.add('is-disabled');

    const floorLabel = hit.floorPlanId
      ? escapeHtml(hit.floorName || 'Unknown Floor')
      : '<span class="global-search-unassigned">Unassigned</span>';

    row.innerHTML = `
      <div class="global-search-hit-body">
        <div class="global-search-hit-title">
          Found ${escapeHtml(hit.name || 'Unnamed')}
          <span class="global-search-hit-kind">${kind}</span>
        </div>
        <div class="global-search-hit-meta">
          Venue: ${escapeHtml(hit.venueName || 'Unknown')} · Floor: ${floorLabel}
        </div>
      </div>
      ${canJump ? '<button type="button" class="global-search-hit-jump">Jump</button>' : ''}
    `;

    const jump = () => {
      if (!canJump) return;
      navigateToGlobalSearchHit(hit, query);
    };
    row.addEventListener('click', (e) => {
      if (e.target.closest('.global-search-hit-jump') || canJump) jump();
    });
    const jumpBtn = row.querySelector('.global-search-hit-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        jump();
      });
    }

    elements.globalSearchResults.appendChild(row);
  });
}

async function ensureGlobalSearchIndex({ forceRefresh = false } = {}) {
  if (!forceRefresh && state.globalSearchIndex?.fetchedAt) {
    return { success: true, data: state.globalSearchIndex, fromCache: true };
  }
  if (!state.tenantId) {
    return { success: false, error: 'Not authenticated' };
  }

  state.globalSearchBuilding = true;
  updateGlobalSearchRefreshEnabled();
  if (elements.globalSearchSubmit) elements.globalSearchSubmit.disabled = true;
  showGlobalSearchProgress();
  updateGlobalSearchProgress({ percent: 0, done: 0, total: 1, message: 'Starting…' });
  setGlobalSearchStatus('Building device index…');

  const stopProgress = window.api.onGlobalSearchProgress
    ? window.api.onGlobalSearchProgress((info) => updateGlobalSearchProgress(info))
    : () => {};

  const tenantId = state.tenantId;
  try {
    const venues = (state.venues || []).map((v) => ({ id: v.id, name: v.name || v.id }));
    const result = await window.api.buildGlobalSearchIndex({
      tenantId,
      venues
    });

    // Logged out (or switched tenant) while building: drop the result.
    if (state.tenantId !== tenantId) {
      return { success: false, cancelled: true };
    }
    if (result.cancelled) {
      setGlobalSearchStatus('Index build cancelled.');
      return { success: false, cancelled: true };
    }
    if (!result.success) {
      throw new Error(result.error || 'Failed to build search index');
    }

    state.globalSearchIndex = result.data;
    setGlobalSearchStatus(
      `Indexed ${result.data.accessPoints.length} APs · ${result.data.switches.length} switches`
    );
    return { success: true, data: result.data, fromCache: false };
  } catch (error) {
    setGlobalSearchStatus(error.message || 'Failed to build search index', { error: true });
    return { success: false, error: error.message };
  } finally {
    stopProgress();
    state.globalSearchBuilding = false;
    hideGlobalSearchProgress();
    if (elements.globalSearchSubmit) elements.globalSearchSubmit.disabled = false;
    updateGlobalSearchRefreshEnabled();
  }
}

async function runGlobalSearch({ forceRefresh = false } = {}) {
  const query = (elements.globalSearchInput?.value || '').trim();
  if (!query) {
    setGlobalSearchStatus('Enter a search value.', { error: true });
    renderGlobalSearchPlaceholder('Enter a hostname, serial, MAC, or IP, then press Search.');
    elements.globalSearchInput?.focus();
    return;
  }
  if (state.globalSearchBuilding) return;

  const indexResult = await ensureGlobalSearchIndex({ forceRefresh });
  if (!indexResult.success || !indexResult.data) {
    if (!indexResult.cancelled) {
      state.globalSearchHits = [];
      renderGlobalSearchPlaceholder('Could not build the device index.');
    }
    return;
  }

  const hits = matchGlobalSearchHits(query, indexResult.data);
  state.globalSearchHits = hits;
  renderGlobalSearchResults(hits, query);

  const cacheNote = indexResult.fromCache ? ' (cached index)' : '';
  const apTotal = (indexResult.data.accessPoints || []).length;
  const switchTotal = (indexResult.data.switches || []).length;
  const scope = ` · searched ${apTotal} AP${apTotal === 1 ? '' : 's'}, ${switchTotal} switch${switchTotal === 1 ? '' : 'es'}`;
  setGlobalSearchStatus(
    (hits.length
      ? `${hits.length} match${hits.length === 1 ? '' : 'es'}`
      : 'No matches') + scope + cacheNote
  );
  updateGlobalSearchRefreshEnabled();
}

function applyPendingSearchFocus() {
  const pending = state.pendingSearchFocus;
  if (!pending) return;

  let entry = null;
  if (pending.type === 'ap') {
    const ap = (state.accessPoints || []).find((d) => accessPointKey(d) === pending.key);
    if (ap) entry = { type: 'ap', device: ap };
  } else if (pending.type === 'switch') {
    const sw = (state.switches || []).find((d) => switchKey(d) === pending.key);
    if (sw) entry = { type: 'switch', device: sw };
  }

  state.pendingSearchFocus = null;
  if (!entry) return;

  selectDeviceFromSearch(entry);
  if (pending.queryText && elements.apSearch) {
    // Keep the user's global query text in the floor search box when useful;
    // prefer the device hostname for the pulse selection display.
    elements.apSearch.value = searchResultName(entry);
  }
  openAPSearchForShortcut();
}

async function navigateToGlobalSearchHit(hit, queryText) {
  if (!hit?.venueId || !hit?.floorPlanId) return;

  closeGlobalSearchModal();

  const venue = state.venues.find((v) => v.id === hit.venueId);
  if (!venue) {
    console.warn('[GlobalSearch] Venue not found for hit:', hit.venueId);
    return;
  }

  const query = (queryText || elements.globalSearchInput?.value || '').trim();
  state.pendingSearchFocus = {
    type: hit.type,
    key: hit.key,
    queryText: query
  };

  await selectVenue(venue);

  let floorPlan = (state.floorPlans || []).find((fp) => fp.id === hit.floorPlanId);
  if (!floorPlan && state.globalSearchIndex?.floorsById?.[hit.floorPlanId]) {
    // Floor metadata existed in the index but list may have failed; retry load once.
    await loadFloorPlans();
    floorPlan = (state.floorPlans || []).find((fp) => fp.id === hit.floorPlanId);
  }

  if (!floorPlan) {
    state.pendingSearchFocus = null;
    console.warn('[GlobalSearch] Floor plan not found:', hit.floorPlanId);
    return;
  }

  await selectFloorPlan(floorPlan);
}

// Toggle AP Search Popup
function toggleAPSearchPopup() {
  if (elements.apSearchPopup.classList.contains('hidden')) {
    closeMapFilterPopup();
    elements.apSearchPopup.classList.remove('hidden');
    setTimeout(() => elements.apSearch.focus(), 50);
  } else {
    closeAPSearchPopup();
  }
}

// Open/focus search for the "/" shortcut (does not toggle closed)
function openAPSearchForShortcut() {
  if (elements.apSearchPopup.classList.contains('hidden')) {
    closeMapFilterPopup();
    elements.apSearchPopup.classList.remove('hidden');
  }
  setTimeout(() => elements.apSearch.focus(), 50);
}

// Close AP Search Popup
function closeAPSearchPopup() {
  elements.apSearchPopup.classList.add('hidden');
  elements.apSearchDropdown.classList.add('hidden');
  state.searchKeyboardIndex = -1;
}

// Toggle Settings Menu
function toggleSettingsMenu() {
  elements.settingsMenu.classList.toggle('hidden');
}

// Close Settings Menu
function closeSettingsMenu() {
  elements.settingsMenu.classList.add('hidden');
}

function toggleExportMenu() {
  elements.exportMenu.classList.toggle('hidden');
}

function closeExportMenu() {
  elements.exportMenu.classList.add('hidden');
}

function sanitizeExportFilename(name) {
  const cleaned = String(name || 'floor-plan')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return cleaned || 'floor-plan';
}

function dataUrlToBase64(dataUrl) {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/**
 * Render the full floor plan (ignores zoom/pan) with current label settings
 * onto an offscreen canvas for PNG/PDF export.
 */
function buildExportCanvas() {
  const img = state.floorPlanImage;
  if (!img) return null;

  const container = elements.canvas.parentElement;
  const fitScale = Math.min(container.clientWidth / img.width, container.clientHeight / img.height);
  const dpr = 2;
  const drawScale = fitScale * dpr;
  const margin = Math.round(48 * dpr);
  const scaledWidth = img.width * drawScale;
  const scaledHeight = img.height * drawScale;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = Math.ceil(scaledWidth + margin * 2);
  exportCanvas.height = Math.ceil(scaledHeight + margin * 2);
  const exportCtx = exportCanvas.getContext('2d');

  const prev = {
    ctx,
    scale: state.scale,
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    selectedSearchDevice: state.selectedSearchDevice,
    hoveredDevice: state.hoveredDevice,
    drawPixelRatio: state.drawPixelRatio
  };

  ctx = exportCtx;
  state.scale = drawScale;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.offsetX = margin;
  state.offsetY = margin;
  state.selectedSearchDevice = null;
  state.hoveredDevice = null;
  state.drawPixelRatio = dpr;

  try {
    // FR#12: exports always use a light background, regardless of UI dark mode
    // FR#3: hoveredDevice is cleared above so co-channel overlay stays ephemeral
    // FR#19: floor image uses the same opacity as the live map; devices stay full alpha
    exportCtx.fillStyle = '#ffffff';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.save();
    exportCtx.globalAlpha = clampMapOpacity(state.mapOpacityPercent) / 100;
    exportCtx.drawImage(img, margin, margin, scaledWidth, scaledHeight);
    exportCtx.restore();
    beginMapDeviceDraw();
    if (state.showAPs) {
      drawAccessPoints();
    }
    if (state.showSwitches) {
      drawSwitches();
    }
  } finally {
    ctx = prev.ctx;
    state.scale = prev.scale;
    state.zoom = prev.zoom;
    state.panX = prev.panX;
    state.panY = prev.panY;
    state.offsetX = prev.offsetX;
    state.offsetY = prev.offsetY;
    state.selectedSearchDevice = prev.selectedSearchDevice;
    state.hoveredDevice = prev.hoveredDevice;
    state.drawPixelRatio = prev.drawPixelRatio;
  }

  return exportCanvas;
}

async function exportFloorPlan(format) {
  if (!state.floorPlanImage || !window.api.exportMap) return;

  elements.exportBtn.disabled = true;
  try {
    const exportCanvas = buildExportCanvas();
    if (!exportCanvas) return;

    const isPdf = format === 'pdf';
    const dataUrl = isPdf
      ? exportCanvas.toDataURL('image/jpeg', 0.92)
      : exportCanvas.toDataURL('image/png');

    const venuePart = state.selectedVenue?.name ? `${state.selectedVenue.name} - ` : '';
    const floorPart = state.selectedFloorPlan?.name || 'floor-plan';
    const baseName = sanitizeExportFilename(`${venuePart}${floorPart}`);
    const extension = isPdf ? 'pdf' : 'png';

    const result = await window.api.exportMap({
      dataBase64: dataUrlToBase64(dataUrl),
      format: isPdf ? 'pdf' : 'png',
      defaultName: `${baseName}.${extension}`,
      width: exportCanvas.width,
      height: exportCanvas.height
    });

    if (result && result.error) {
      alert(`Export failed: ${result.error}`);
      return;
    }

    if (result && !result.canceled && result.filePath && window.api.showItemInFolder) {
      window.api.showItemInFolder(result.filePath);
    }
  } catch (error) {
    console.error('Export failed:', error);
    alert(`Export failed: ${error.message || error}`);
  } finally {
    elements.exportBtn.disabled = false;
  }
}

// --- FR#4 PoE budget rollup helpers ---

function normalizePoeCacheEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return { labels: {}, details: {}, fetchedAt: null };
  }
  if (entry.labels && typeof entry.labels === 'object') {
    const fetchedAt = Number.isFinite(entry.fetchedAt) ? entry.fetchedAt : null;
    return {
      labels: { ...entry.labels },
      details: entry.details && typeof entry.details === 'object' ? { ...entry.details } : {},
      fetchedAt
    };
  }
  // Legacy session cache: flat mac -> label
  return { labels: { ...entry }, details: {}, fetchedAt: null };
}

function hasPoeCacheForFloor(floorPlanId) {
  const entry = normalizePoeCacheEntry(state.poeDataByFloorPlan[floorPlanId]);
  return Object.keys(entry.labels).length > 0 || Object.keys(entry.details).length > 0;
}

function applyPoeCache(floorPlanId) {
  const entry = normalizePoeCacheEntry(state.poeDataByFloorPlan[floorPlanId]);
  state.apPoeInfo = entry.labels;
  state.apPoeDetails = entry.details;
  state.poeFetchedAt = entry.fetchedAt;
  updatePoeSummaryButton();
  updateMapSummaryStrip();
}

function savePoeCache() {
  if (!state.selectedFloorPlan) return;
  const fetchedAt = Date.now();
  state.poeFetchedAt = fetchedAt;
  state.poeDataByFloorPlan[state.selectedFloorPlan.id] = {
    labels: { ...state.apPoeInfo },
    details: { ...state.apPoeDetails },
    fetchedAt
  };
  updatePoeSummaryButton();
  updateMapSummaryStrip();
}

function updatePoeSummaryButton() {
  if (!elements.poeSummaryBtn) return;
  const hasDetails = Object.keys(state.apPoeDetails || {}).length > 0;
  const hasSwitchBudget = (state.switches || []).some((sw) => {
    const used = Number(sw.poeUtilization);
    const total = Number(sw.poeTotal);
    return Number.isFinite(used) && Number.isFinite(total) && total > 0;
  });
  const enabled = hasDetails || hasSwitchBudget;
  elements.poeSummaryBtn.disabled = !enabled;
  elements.poeSummaryBtn.title = enabled
    ? 'PoE budget rollup'
    : 'PoE budget rollup (query PoE or open a floor with switch budgets)';
  elements.poeSummaryBtn.classList.toggle('has-data', enabled);
}

function switchIdentityKeys(sw) {
  return [sw.id, sw.serialNumber, sw.switchSerial, sw.switchMac]
    .filter(Boolean)
    .map((v) => String(v));
}

function detailBelongsToSwitch(detail, sw) {
  if (!detail || !sw) return false;
  const keys = new Set(switchIdentityKeys(sw));
  if (detail.switchSerial && keys.has(String(detail.switchSerial))) return true;
  const host = switchHostname(sw);
  if (detail.switchName && host && String(detail.switchName) === String(host)) return true;
  return false;
}

function isPoeIssueDetail(detail) {
  if (!detail) return false;
  return detail.underpowered ||
    detail.status === 'no_lldp' ||
    detail.status === 'poe_disabled' ||
    detail.status === 'underpowered';
}

function poeIssueLabel(detail) {
  if (!detail) return 'Issue';
  if (detail.status === 'no_lldp') return 'No LLDP';
  if (detail.status === 'poe_disabled') return 'PoE disabled';
  if (detail.status === 'underpowered' || detail.underpowered) return 'Underpowered';
  if (detail.status === 'no_data') return 'No PoE data';
  if (detail.status === 'offline') return 'Offline';
  return detail.status || 'Issue';
}

function poePercentClass(percent) {
  if (percent == null || !Number.isFinite(percent)) return '';
  if (percent >= 90) return 'poe-load-high';
  if (percent >= 70) return 'poe-load-warn';
  return 'poe-load-ok';
}

function buildPoeRollup() {
  const details = Object.values(state.apPoeDetails || {});
  const switches = state.switches || [];

  let floorUsedMw = 0;
  let floorTotalMw = 0;
  let switchBudgetCount = 0;
  for (const sw of switches) {
    const usedMw = Number(sw.poeUtilization);
    const totalMw = Number(sw.poeTotal);
    if (Number.isFinite(usedMw) && Number.isFinite(totalMw) && totalMw > 0) {
      floorUsedMw += usedMw;
      floorTotalMw += totalMw;
      switchBudgetCount += 1;
    }
  }

  const apDrawW = details.reduce(
    (sum, d) => sum + (typeof d.drawW === 'number' ? d.drawW : 0),
    0
  );

  const floor = {
    usedW: floorTotalMw > 0 ? Math.round(floorUsedMw / 1000) : null,
    totalW: floorTotalMw > 0 ? Math.round(floorTotalMw / 1000) : null,
    percent: floorTotalMw > 0 ? Math.round((floorUsedMw / floorTotalMw) * 100) : null,
    switchCount: switchBudgetCount,
    apDrawW: apDrawW > 0 ? Math.round(apDrawW * 10) / 10 : null,
    apCount: details.length
  };

  const switchRows = switches.map((sw) => {
    const linked = details.filter((d) => detailBelongsToSwitch(d, sw));
    return {
      sw,
      usage: formatSwitchPoeUsage(sw),
      apCount: linked.length,
      issues: linked.filter((d) => isPoeIssueDetail(d)),
      linked
    };
  }).sort((a, b) =>
    String(switchHostname(a.sw) || '').localeCompare(String(switchHostname(b.sw) || ''))
  );

  return {
    floor,
    switchRows,
    missingLldp: details.filter((d) => d.status === 'no_lldp'),
    underpowered: details.filter((d) =>
      d.underpowered || d.status === 'poe_disabled' || d.status === 'underpowered'
    ),
    noData: details.filter((d) => d.status === 'no_data'),
    details
  };
}

function focusApFromPoeDetail(detail) {
  const mac = String(detail.apMac || '').toLowerCase();
  const ap = (state.accessPoints || []).find((a) =>
    String(a.mac || a.macAddress || '').toLowerCase() === mac
  );
  if (!ap) return;
  closePoeRollupModal();
  closeSwitchPopup();
  selectDeviceFromSearch({ type: 'ap', device: ap });
}

function renderPoeIssueList(container, items, emptyText) {
  container.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'poe-rollup-empty';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  items.forEach((detail) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'poe-issue-link';
    const port = detail.portId ? ` · ${detail.portId}` : '';
    const sw = detail.switchName ? ` @ ${detail.switchName}` : '';
    btn.textContent = `${detail.apName || detail.apMac}${sw}${port} — ${poeIssueLabel(detail)}`;
    btn.addEventListener('click', () => focusApFromPoeDetail(detail));
    container.appendChild(btn);
  });
}

function showPoeRollupModal() {
  if (!elements.poeRollupModal) return;
  const rollup = buildPoeRollup();
  const { floor, switchRows, missingLldp, underpowered } = rollup;

  let floorHtml = '';
  if (floor.usedW != null && floor.totalW != null) {
    const cls = poePercentClass(floor.percent);
    floorHtml = `<div class="poe-rollup-stat ${cls}">${floor.usedW}W / ${floor.totalW}W · ${floor.percent}%</div>`;
    floorHtml += `<div class="poe-rollup-sub">${floor.switchCount} switch${floor.switchCount === 1 ? '' : 'es'} with budget on this floor</div>`;
  } else {
    floorHtml = '<div class="poe-rollup-stat">No switch PoE budget on this floor</div>';
  }
  if (floor.apDrawW != null) {
    floorHtml += `<div class="poe-rollup-sub">Matched AP draw (from last PoE query): ${floor.apDrawW}W across ${floor.apCount} AP${floor.apCount === 1 ? '' : 's'}</div>`;
  } else if (floor.apCount === 0) {
    floorHtml += '<div class="poe-rollup-sub">No AP PoE details yet — use the PoE icon to query</div>';
  }
  elements.poeRollupFloor.innerHTML = floorHtml;

  elements.poeRollupSwitches.innerHTML = '';
  if (!switchRows.length) {
    const empty = document.createElement('div');
    empty.className = 'poe-rollup-empty';
    empty.textContent = 'No switches placed on this floor.';
    elements.poeRollupSwitches.appendChild(empty);
  } else {
    switchRows.forEach((row) => {
      const el = document.createElement('div');
      el.className = 'poe-rollup-switch-row';
      const name = switchHostname(row.sw) || 'Switch';
      const usage = row.usage || 'No budget reported';
      const issueNote = row.issues.length
        ? `<span class="poe-rollup-badge">${row.issues.length} issue${row.issues.length === 1 ? '' : 's'}</span>`
        : '';
      el.innerHTML = `
        <div class="poe-rollup-switch-name">${escapeHtml(name)} ${issueNote}</div>
        <div class="poe-rollup-switch-meta">${escapeHtml(usage)} · ${row.apCount} linked AP${row.apCount === 1 ? '' : 's'}</div>
      `;
      elements.poeRollupSwitches.appendChild(el);
    });
  }

  const issueSections = [];
  issueSections.push(`<div class="poe-rollup-issue-group"><div class="poe-rollup-section-label">Missing LLDP (${missingLldp.length})</div><div id="poe-rollup-missing-lldp" class="poe-rollup-issue-list"></div></div>`);
  issueSections.push(`<div class="poe-rollup-issue-group"><div class="poe-rollup-section-label">Underpowered / PoE disabled (${underpowered.length})</div><div id="poe-rollup-underpowered" class="poe-rollup-issue-list"></div></div>`);
  elements.poeRollupIssues.innerHTML = issueSections.join('');
  renderPoeIssueList(
    document.getElementById('poe-rollup-missing-lldp'),
    missingLldp,
    'None'
  );
  renderPoeIssueList(
    document.getElementById('poe-rollup-underpowered'),
    underpowered,
    'None'
  );

  elements.poeRollupModal.classList.remove('hidden');
}

function closePoeRollupModal() {
  if (elements.poeRollupModal) {
    elements.poeRollupModal.classList.add('hidden');
  }
}

// Show PoE cache choice modal
function showPoECacheChoiceModal() {
  elements.poeCacheChoiceModal.classList.remove('hidden');
}

// Same rule as isOperational() in src/api/ruckus.js: RUCKUS One only
// refreshes and reports LLDP for APs that are online.
function apIsOperational(ap) {
  const status = String(ap?.state || ap?.status || ap?.subState || '');
  return status.startsWith('2_') || /operational|online/i.test(status);
}

// When none of these APs is online there is nothing to query: say so
// instead of running a query that finishes instantly with no visible change.
function warnIfNoOnlineAps(aps) {
  const list = aps || [];
  if (list.some(apIsOperational)) return false;
  const count = list.length;
  const what = count === 1 ? 'This AP is offline' : `All ${count} APs here are offline`;
  alert(`${what}, so there is no PoE or LLDP data to read. RUCKUS One reports LLDP only for online APs. Try again when ${count === 1 ? 'it is' : 'they are'} back online.`);
  return true;
}

// Start floor-plan PoE query from the PoE icon (cache choice or confirm dialog)
async function startFloorPlanPoeQuery() {
  if (state.poeQueryInProgress) return;
  if (!state.selectedFloorPlan) return;
  if (warnIfNoOnlineAps(state.accessPoints)) return;

  if (hasPoeCacheForFloor(state.selectedFloorPlan.id)) {
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
  const floorPlanId = state.selectedFloorPlan.id;

  try {
    const result = await window.api.queryApPoe({
      venueId: state.selectedVenue.id,
      aps: aps.map(poeQueryPayload)
    });

    // Logged out or moved to another floor meanwhile: these labels belong
    // to a floor that is no longer shown, so don't apply or cache them here.
    if (state.selectedFloorPlan?.id !== floorPlanId) {
      elements.poeProgressModal.classList.add('hidden');
      state.poeQueryInProgress = false;
      return false;
    }

    if (!result.success) {
      throw new Error(result.error || 'PoE query failed');
    }

    const payload = result.data || {};
    const labels = payload.labels && typeof payload.labels === 'object'
      ? payload.labels
      : (payload.details ? {} : payload);
    const details = payload.details && typeof payload.details === 'object'
      ? payload.details
      : {};

    // A cancelled run only covers some APs: merge it so the APs it never
    // reached keep their earlier cached labels.
    if (replaceAll && !result.cancelled) {
      state.apPoeInfo = { ...labels };
      state.apPoeDetails = { ...details };
    } else {
      state.apPoeInfo = { ...state.apPoeInfo, ...labels };
      state.apPoeDetails = { ...state.apPoeDetails, ...details };
    }
    savePoeCache();
    console.log('[PoE] Loaded', Object.keys(labels).length, 'AP labels,', Object.keys(details).length, 'details');

    // Say what was covered, so a floor with offline APs isn't a mystery.
    const online = aps.filter(apIsOperational).length;
    const offline = aps.length - online;
    elements.progressFill.style.width = '100%';
    elements.progressText.textContent = result.cancelled ? 'Cancelled' : 'Complete';
    elements.currentApText.textContent = result.cancelled
      ? ''
      : `Read ${online} online AP${online === 1 ? '' : 's'}` +
        (offline ? ` · ${offline} offline AP${offline === 1 ? '' : 's'} skipped` : '');

    setTimeout(() => {
      elements.poeProgressModal.classList.add('hidden');
      state.poeQueryInProgress = false;
      renderFloorPlan();
    }, result.cancelled ? 500 : 1500);
    return true;
  } catch (error) {
    console.error('Error fetching PoE info:', error);
    elements.progressText.textContent = 'PoE query failed';
    elements.currentApText.textContent = error.message || 'Unknown error';
    state.poeQueryInProgress = false;
    // Rate-limit copy is longer; give the user time to read it.
    const dismissMs = /rate limit|HTTP 429/i.test(error.message || '') ? 10000 : 2500;
    setTimeout(() => {
      elements.poeProgressModal.classList.add('hidden');
    }, dismissMs);
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
