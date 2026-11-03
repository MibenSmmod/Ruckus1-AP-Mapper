const https = require('https');

// Shown when RUCKUS One returns HTTP 429 (token-bucket rate limit, ~2000 calls/min per tenant).
const RATE_LIMIT_USER_MESSAGE =
  'Rate limit reached (HTTP 429). RUCKUS One temporarily blocked API calls because this tenant exceeded its request quota (about 2,000 calls per minute). Wait about a minute and try again. Large PoE & LLDP queries are a common cause.';

function rateLimitError() {
  const error = new Error(RATE_LIMIT_USER_MESSAGE);
  error.statusCode = 429;
  return error;
}

// Regional API endpoints
// Both auth and API use api.{region}.ruckus.cloud
const REGIONS = {
  'na': {
    auth: 'api.ruckus.cloud',
    api: 'api.ruckus.cloud'
  },
  'eu': {
    auth: 'api.eu.ruckus.cloud',
    api: 'api.eu.ruckus.cloud'
  },
  'asia': {
    auth: 'api.asia.ruckus.cloud',
    api: 'api.asia.ruckus.cloud'
  }
};

class RuckusAPI {
  constructor(region = 'na') {
    this.region = region.toLowerCase();
    if (!REGIONS[this.region]) {
      throw new Error(`Invalid region: ${region}. Valid regions: na, eu, asia`);
    }
    this.endpoints = REGIONS[this.region];
    this.accessToken = null;
    this.tokenExpiry = null;
    this.tenantId = null;
    this.clientId = null;
    this.clientSecret = null;
  }

  // Make HTTPS request
  _request(options, postData = null) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          // Check if response is binary (image)
          const contentType = res.headers['content-type'] || '';

          // Redirects are never expected from JSON API calls. On the token
          // endpoint they almost always mean a wrong region or tenant.
          if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
            const error = String(options.path || '').startsWith('/oauth2/')
              ? new Error(`Authentication failed (HTTP ${res.statusCode}). Please check your Region, Tenant ID, Client ID, and Client Secret.`)
              : new Error(`Unexpected redirect (HTTP ${res.statusCode}) from ${options.method} ${options.path}`);
            error.statusCode = res.statusCode;
            reject(error);
            return;
          }

          if (res.statusCode === 429) {
            reject(rateLimitError());
            return;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            if (contentType.includes('image/')) {
              // Return raw buffer for images
              resolve({ type: 'image', contentType, data });
            } else if (contentType.includes('application/json')) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                resolve(data);
              }
            } else {
              resolve(data);
            }
          } else {
            let errorMessage = `HTTP ${res.statusCode}`;
            try {
              const errorData = JSON.parse(data);
              errorMessage = errorData.error_description || errorData.message || errorMessage;
            } catch (e) {
              if (data && data.length < 500) errorMessage += `: ${data}`;
            }
            const error = new Error(errorMessage);
            error.statusCode = res.statusCode;
            reject(error);
          }
        });
      });

      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        req.destroy(new Error(`${options.method} ${options.path} timed out`));
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (postData) {
        req.write(postData);
      }

      req.end();
    });
  }

  // _request with the same 429 backoff apiCall uses (1s, 2s, 4s).
  async _send(options, postData = null) {
    return withRateLimitRetry(() => this._request(options, postData));
  }

  // Check if token needs refresh
  _isTokenExpired() {
    if (!this.accessToken || !this.tokenExpiry) {
      return true;
    }
    // Refresh 5 minutes before expiry
    return Date.now() >= (this.tokenExpiry - 5 * 60 * 1000);
  }

  // Ensure we have a valid token
  async _ensureAuthenticated() {
    if (this._isTokenExpired()) {
      if (!this.tenantId || !this.clientId || !this.clientSecret) {
        throw new Error('Not authenticated. Please call authenticate() first.');
      }
      await this.authenticate(this.tenantId, this.clientId, this.clientSecret);
    }
  }

  // Authenticate with Ruckus ONE
  async authenticate(tenantId, clientId, clientSecret) {
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    const postData = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;

    const options = {
      hostname: this.endpoints.auth,
      port: 443,
      path: `/oauth2/token/${encodeURIComponent(tenantId)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const response = await this._send(options, postData);

    if (!response || !response.access_token) {
      throw new Error('Authentication failed: No access token received');
    }

    this.accessToken = response.access_token;
    // Token expires in 60 minutes (3600 seconds)
    const expiresIn = response.expires_in || 3600;
    this.tokenExpiry = Date.now() + (expiresIn * 1000);

    return response;
  }

  // Get list of venues
  async getVenues(tenantId) {
    await this._ensureAuthenticated();

    const options = {
      hostname: this.endpoints.api,
      port: 443,
      path: '/venues',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'x-rks-tenantid': tenantId
      }
    };

    return await this._send(options);
  }

  // Get floor plans for a venue
  async getVenueFloorPlans(tenantId, venueId) {
    await this._ensureAuthenticated();

    const options = {
      hostname: this.endpoints.api,
      port: 443,
      path: `/venues/${encodeURIComponent(venueId)}/floorplans`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'x-rks-tenantid': tenantId
      }
    };

    return await this._send(options);
  }

  // Get floor plan image using imageId from floor plan data
  async getFloorPlanImage(tenantId, venueId, floorPlanId, imageId) {
    await this._ensureAuthenticated();

    // Use the files endpoint with the imageId
    const options = {
      hostname: this.endpoints.api,
      port: 443,
      path: `/files/${encodeURIComponent(imageId)}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'image/*',
        'x-rks-tenantid': tenantId
      }
    };

    return await this._requestBinaryWithRedirect(options);
  }

  // Make binary request that follows redirects (the file API usually
  // redirects to cloud storage). TLS is always verified; only https
  // redirects are followed, and auth headers stay on the original host.
  _requestBinaryWithRedirect(options, maxRedirects = 3) {
    return new Promise((resolve, reject) => {
      const makeRequest = (opts, redirectCount) => {
        const req = https.request(opts, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            res.resume();
            if (redirectCount >= maxRedirects) {
              reject(new Error('Too many redirects'));
              return;
            }
            let newOpts;
            try {
              newOpts = imageRedirectOptions(res.headers.location, opts, options);
            } catch (error) {
              reject(error);
              return;
            }
            makeRequest(newOpts, redirectCount + 1);
            return;
          }

          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            if (res.statusCode === 429) {
              reject(rateLimitError());
              return;
            }
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const buffer = Buffer.concat(chunks);
              const contentType = res.headers['content-type'] || 'image/png';
              const base64 = buffer.toString('base64');
              resolve(`data:${contentType};base64,${base64}`);
            } else {
              const error = new Error(`HTTP ${res.statusCode}`);
              error.statusCode = res.statusCode;
              reject(error);
            }
          });
        });
        req.setTimeout(REQUEST_TIMEOUT_MS, () => {
          req.destroy(new Error('Floor plan image request timed out'));
        });
        req.on('error', reject);
        req.end();
      };
      makeRequest(options, 0);
    });
  }

  // All tenant APs (placement + identity). No radio/client enrichment.
  async getAllAccessPoints(tenantId) {
    await this._ensureAuthenticated();

    const options = {
      hostname: this.endpoints.api,
      port: 443,
      path: '/venues/aps',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'x-rks-tenantid': tenantId
      }
    };

    const allAPs = await this._send(options);
    return Array.isArray(allAPs) ? allAPs : [];
  }

  // Get access points (all APs, then filter by venue)
  async getAccessPoints(tenantId, venueId) {
    const allAPs = await this.getAllAccessPoints(tenantId);
    return allAPs.filter(ap => ap.venueId === venueId);
  }

  // JSON API call. Uses the RUCKUS One v1 media type the PoE endpoints expect.
  async apiCall(method, path, body, accept = V1_ACCEPT) {
    await this._ensureAuthenticated();

    const postData = body !== undefined ? JSON.stringify(body) : null;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': accept,
      'x-rks-tenantid': this.tenantId
    };
    if (postData) {
      headers['Content-Type'] = accept;
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: this.endpoints.api,
      port: 443,
      path,
      method,
      headers
    };

    return withRateLimitRetry(() => this._requestJson(options, postData));
  }

  _requestJson(options, postData = null) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 429) {
            reject(rateLimitError());
            return;
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            if (!data) {
              resolve(null);
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(data);
            }
            return;
          }

          let errorMessage = `HTTP ${res.statusCode}`;
          if (data && data.length < 500) errorMessage += `: ${data}`;
          const error = new Error(`${options.method} ${options.path} -> ${errorMessage}`);
          error.statusCode = res.statusCode;
          reject(error);
        });
      });

      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        req.destroy(new Error(`${options.method} ${options.path} timed out`));
      });
      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  // Operational radio status for a venue. actualTxPower is the dBm value
  // shown in the RUCKUS One TX Power column.
  async queryApRadioStatuses(venueId) {
    return this.queryAll(
      '/venues/aps/query',
      ['serialNumber', 'macAddress', 'name', 'model', 'radioStatuses', 'afcStatus', 'clientCount'],
      { venueId: [venueId] }
    );
  }

  // Connected Wi-Fi clients for a venue (minimal fields for per-band density).
  // AP identity lives under apInformation (serialNumber / macAddress); flat
  // apMac / apSerialNumber projections are ignored by the API.
  async queryApClients(venueId) {
    return this.queryAll(
      '/venues/aps/clients/query',
      ['apInformation', 'band'],
      { venueId: [venueId] }
    );
  }

  // ICX switches: identity, placement, status. Optional venue filter.
  static get SWITCH_QUERY_FIELDS() {
    return [
      'id',
      'switchName',
      'name',
      'provisionName',
      'deviceStatus',
      'floorplanId',
      'xPercent',
      'yPercent',
      'venueId',
      'isStack',
      'deviceType',
      'model',
      'switchMac',
      'ipAddress',
      'uptime',
      'alerts',
      'clientCount',
      'poeUtilization',
      'poeTotal',
      'poeFree'
    ];
  }

  // Prefer tenant-wide (no venue filter) for global search.
  async getAllSwitches() {
    return this.queryAll(
      '/venues/switches/query',
      RuckusAPI.SWITCH_QUERY_FIELDS,
      null
    );
  }

  // ICX switches for a venue, including floor-plan placement and status.
  async getSwitches(venueId) {
    return this.queryAll(
      '/venues/switches/query',
      RuckusAPI.SWITCH_QUERY_FIELDS,
      { venueId: [venueId] }
    );
  }

  // Page through a RUCKUS One view-model query endpoint.
  async queryAll(path, fields, filters) {
    const rows = [];
    let page = 1;
    while (true) {
      const body = { fields, page, pageSize: PAGE_SIZE };
      if (filters) body.filters = filters;
      const resp = await this.apiCall('POST', path, body) || {};
      const data = Array.isArray(resp.data) ? resp.data : [];
      rows.push(...data);
      if (!data.length) return rows;
      // Without totalCount, a short page means the last page.
      const done = resp.totalCount != null
        ? rows.length >= resp.totalCount
        : data.length < PAGE_SIZE;
      if (done) return rows;
      if (page >= MAX_QUERY_PAGES) {
        console.warn(`[API] ${path} stopped after ${MAX_QUERY_PAGES} pages (${rows.length} rows)`);
        return rows;
      }
      page += 1;
    }
  }

  // PoE for the given APs: LLDP neighbor power plus the matched ICX switch port.
  // refresh asks each operational AP to update LLDP (same call the RUCKUS One UI makes).
  async queryApPoe(venueId, aps, options = {}) {
    const {
      refresh = true,
      waitMs = 8000,
      onProgress = () => {},
      shouldCancel = () => false
    } = options;
    const list = Array.isArray(aps) ? aps : [];
    const operational = list.filter((ap) => ap.serialNumber && isOperational(ap));
    const report = (percent, message, detail) => onProgress({ percent, message, detail });

    report(2, 'Reading switch port PoE...', '');
    let ports = [];
    try {
      ports = await this.queryAll(
        '/venues/switches/switchPorts/query',
        PORT_FIELDS,
        { venueId: [venueId] }
      );
    } catch (error) {
      console.warn('[PoE] Switch port query failed:', error.message);
    }
    const portIndex = indexPorts(ports);
    if (shouldCancel()) return poeResultsForAps(list, {}, portIndex);

    const neighborsBySerial = {};
    if (refresh && operational.length && !shouldCancel()) {
      for (let i = 0; i < operational.length; i++) {
        if (shouldCancel()) break;
        const ap = operational[i];
        report(
          5 + (i / operational.length) * 35,
          `Refreshing LLDP (${i + 1} of ${operational.length})`,
          ap.name || ap.serialNumber
        );
        try {
          // Both status and type are required; {} yields AP-OPS-10200 Invalid attribute value.
          await this.apiCall(
            'PATCH',
            `/venues/${encodeURIComponent(venueId)}/aps/${encodeURIComponent(ap.serialNumber)}/neighbors`,
            { status: 'CURRENT', type: 'LLDP_NEIGHBOR' }
          );
        } catch (error) {
          console.warn(`[PoE] LLDP refresh failed for ${ap.name || ap.serialNumber}:`, error.message);
        }
      }

      if (!shouldCancel()) {
        const finished = await waitWithProgress(waitMs, shouldCancel, (elapsed) => {
          const remaining = Math.max(0, Math.ceil((waitMs - elapsed) / 1000));
          report(
            42 + (elapsed / waitMs) * 8,
            'Waiting for APs to refresh LLDP...',
            `${remaining}s remaining`
          );
        });
        if (!finished) return poeResultsForAps(list, neighborsBySerial, portIndex);
      }
    }

    for (let i = 0; i < operational.length; i++) {
      if (shouldCancel()) break;
      const ap = operational[i];
      report(
        50 + ((i + 1) / operational.length) * 45,
        `Reading LLDP (${i + 1} of ${operational.length})`,
        ap.name || ap.serialNumber
      );
      try {
        const resp = await this.apiCall(
          'POST',
          `/venues/${encodeURIComponent(venueId)}/aps/${encodeURIComponent(ap.serialNumber)}/neighbors/query`,
          { page: 1, pageSize: 25, filters: [{ type: 'LLDP_NEIGHBOR' }] }
        );
        neighborsBySerial[ap.serialNumber] = neighborList(resp);
      } catch (error) {
        // WIFI-10498 means the AP has no LLDP neighbor table yet — not a transport failure.
        if (/WIFI-10498|No detected neighbor data/i.test(error.message)) {
          neighborsBySerial[ap.serialNumber] = [];
        } else {
          console.warn(`[PoE] LLDP read failed for ${ap.name || ap.serialNumber}:`, error.message);
          neighborsBySerial[ap.serialNumber] = [];
        }
      }
    }

    report(100, 'Complete', '');
    return poeResultsForAps(list, neighborsBySerial, portIndex);
  }

  // --- FR#18: floor-plan placement writes (allowlisted PUT only) ---

  _assertPlacementWritePath(method, path) {
    if (method !== 'PUT') {
      throw new Error('Placement write refused: only PUT is allowed');
    }
    if (typeof path !== 'string' || !(AP_FLOOR_POSITION_PATH.test(path) || SWITCH_POSITION_PATH.test(path))) {
      throw new Error('Placement write refused: path is not an allowlisted floor-position endpoint');
    }
  }

  _sanitizeApPositionBody(body) {
    if (!body || typeof body !== 'object') {
      throw new Error('Placement write refused: invalid AP position body');
    }
    const keys = Object.keys(body);
    if (keys.length !== 2 || !keys.includes('xPercent') || !keys.includes('yPercent')) {
      throw new Error('Placement write refused: AP body may only include xPercent and yPercent');
    }
    return {
      xPercent: clampPercent(body.xPercent),
      yPercent: clampPercent(body.yPercent)
    };
  }

  _sanitizeSwitchPositionBody(body) {
    if (!body || typeof body !== 'object') {
      throw new Error('Placement write refused: invalid switch position body');
    }
    const keys = Object.keys(body);
    if (
      keys.length !== 3 ||
      !keys.includes('floorPlanId') ||
      !keys.includes('xPercent') ||
      !keys.includes('yPercent')
    ) {
      throw new Error('Placement write refused: switch body may only include floorPlanId, xPercent, and yPercent');
    }
    if (!body.floorPlanId || typeof body.floorPlanId !== 'string') {
      throw new Error('Placement write refused: floorPlanId is required');
    }
    return {
      floorPlanId: body.floorPlanId,
      xPercent: clampPercent(body.xPercent),
      yPercent: clampPercent(body.yPercent)
    };
  }

  // Private gate: only the two allowlisted position PUTs may proceed.
  async _placementWrite(method, path, body) {
    this._assertPlacementWritePath(method, path);
    let sanitized;
    if (AP_FLOOR_POSITION_PATH.test(path)) {
      sanitized = this._sanitizeApPositionBody(body);
    } else {
      sanitized = this._sanitizeSwitchPositionBody(body);
    }
    return this.apiCall(method, path, sanitized);
  }

  async updateApFloorPosition({ venueId, floorPlanId, serialNumber, xPercent, yPercent }) {
    if (!venueId || !floorPlanId || !serialNumber) {
      throw new Error('venueId, floorPlanId, and serialNumber are required');
    }
    const path =
      `/venues/${encodeURIComponent(venueId)}` +
      `/floorplans/${encodeURIComponent(floorPlanId)}` +
      `/aps/${encodeURIComponent(serialNumber)}/floorPositions`;
    return this._placementWrite('PUT', path, { xPercent, yPercent });
  }

  async updateSwitchPosition({ venueId, switchId, floorPlanId, xPercent, yPercent }) {
    if (!venueId || !switchId || !floorPlanId) {
      throw new Error('venueId, switchId, and floorPlanId are required');
    }
    const path =
      `/venues/${encodeURIComponent(venueId)}` +
      `/switches/${encodeURIComponent(switchId)}/positions`;
    return this._placementWrite('PUT', path, { floorPlanId, xPercent, yPercent });
  }

  // Probe write scope without moving the device: re-write a device's current
  // position on this floor (a no-op move). 2xx → writable, 403 → Read Only.
  // Coordinates must already be valid; they are never clamped, so a bad probe
  // is refused locally instead of turning into a real move.
  async probePlacementWriteAccess({ type, venueId, floorPlanId, deviceId, xPercent, yPercent }) {
    if (!venueId || !floorPlanId || !deviceId) {
      throw new Error('venueId, floorPlanId, and deviceId are required to probe write access');
    }
    if (!isValidPercent(xPercent) || !isValidPercent(yPercent)) {
      throw new Error('Probe refused: the device\'s current xPercent/yPercent (0–100) are required');
    }
    try {
      if (type === 'switch') {
        await this.updateSwitchPosition({ venueId, switchId: deviceId, floorPlanId, xPercent, yPercent });
      } else {
        await this.updateApFloorPosition({ venueId, floorPlanId, serialNumber: deviceId, xPercent, yPercent });
      }
      return { canWrite: true };
    } catch (error) {
      if (error.statusCode === 403) return { canWrite: false, statusCode: 403 };
      throw error;
    }
  }
}

const V1_ACCEPT = 'application/vnd.ruckus.v1+json';
const PAGE_SIZE = 500;
// Safety stop for queryAll if an endpoint ignores `page` (500 × 200 = 100k rows).
const MAX_QUERY_PAGES = 200;
const REQUEST_TIMEOUT_MS = 60000;

// FR#18 allowlist — the only R1 paths permitted for map placement writes.
const AP_FLOOR_POSITION_PATH =
  /^\/venues\/[^/]+\/floorplans\/[^/]+\/aps\/[^/]+\/floorPositions$/;
const SWITCH_POSITION_PATH =
  /^\/venues\/[^/]+\/switches\/[^/]+\/positions$/;

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error('Placement write refused: xPercent/yPercent must be a number');
  }
  return Math.min(100, Math.max(0, n));
}

function isValidPercent(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}
const PORT_FIELDS = [
  'switchName', 'switchSerial', 'switchUnitId', 'portIdentifier', 'name',
  'status', 'poeEnabled', 'poeType', 'poeUsed', 'poeTotal', 'poeUsage',
  'neighborName', 'neighborMacAddress', 'venueId'
];
const PORT_ID_RE = /(\d+\/\d+\/\d+)/;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry HTTP 429 with exponential backoff (1s, 2s, 4s), then surface the
// user-facing rate-limit message.
async function withRateLimitRetry(send, retryDelay = delay) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (error) {
      if (error.statusCode !== 429) throw error;
      if (attempt >= 3) throw rateLimitError();
      await retryDelay(2 ** attempt * 1000);
    }
  }
}

// Request options for following a floor-plan image redirect. Only https is
// allowed. The original headers (Authorization) are kept only when the
// redirect stays on the original API host.
function imageRedirectOptions(location, currentOpts, originalOpts) {
  const url = new URL(location, `https://${currentOpts.hostname}`);
  if (url.protocol !== 'https:') {
    throw new Error(`Refusing non-HTTPS floor plan image redirect to ${url.host}`);
  }
  const sameHost = url.hostname === originalOpts.hostname;
  return {
    hostname: url.hostname,
    port: url.port ? Number(url.port) : 443,
    path: url.pathname + url.search,
    method: 'GET',
    headers: sameHost ? { ...originalOpts.headers } : { Accept: 'image/*' }
  };
}

async function waitWithProgress(ms, shouldCancel, onTick) {
  const step = 250;
  let elapsed = 0;
  while (elapsed < ms) {
    if (shouldCancel()) return false;
    const slice = Math.min(step, ms - elapsed);
    await delay(slice);
    elapsed += slice;
    if (onTick) onTick(elapsed);
  }
  return !shouldCancel();
}

function neighborList(resp) {
  if (!resp || typeof resp !== 'object') return [];
  if (Array.isArray(resp.neighbors)) return resp.neighbors;
  if (Array.isArray(resp.data)) return resp.data;
  return [];
}

function isOperational(ap) {
  const status = String(ap.state || ap.status || ap.subState || '');
  if (status.startsWith('2_')) return true;
  return /operational|online/i.test(status);
}

function normMac(mac) {
  return String(mac || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

function bandParamKey(band) {
  const compact = String(band || '').toLowerCase().replace(/[\s_]/g, '');
  if (compact.startsWith('2.4') || compact.startsWith('24g') || compact === '24') return 'apRadioParams24G';
  if (compact.startsWith('6')) return 'apRadioParams6G';
  if (compact.startsWith('5')) return 'apRadioParams50G';
  return null;
}

// Display band label for client density (matches map RF band names).
function bandDisplayLabel(band) {
  const key = bandParamKey(band);
  if (key === 'apRadioParams24G') return '2.4G';
  if (key === 'apRadioParams50G') return '5G';
  if (key === 'apRadioParams6G') return '6G';
  return null;
}

// Map RUCKUS One AFC powerState to the map label suffix.
// API values are LOW_POWER / STANDARD_POWER (UI shows Low / Standard).
function afcPowerSuffix(powerState) {
  const val = String(powerState || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (!val) return null;
  if (val.includes('standard') || val === 'sp') return 'SP';
  if (val.includes('low') || val === 'lpi') return 'LPI';
  return null;
}

// Copy live radio power, bandwidth, AFC status, and clientCount from POST /venues/aps/query
// onto the configuration objects returned by GET /venues/aps.
function applyRadioStatuses(accessPoints, rows) {
  const bySerial = new Map();
  const byMac = new Map();
  for (const row of rows || []) {
    if (row.serialNumber != null) bySerial.set(String(row.serialNumber), row);
    const mac = normMac(row.macAddress || row.mac);
    if (mac) byMac.set(mac, row);
  }

  for (const ap of accessPoints || []) {
    const row = bySerial.get(String(ap.serialNumber || '')) || byMac.get(normMac(ap.mac || ap.macAddress));
    if (!row) continue;

    const afcSuffix = afcPowerSuffix(row.afcStatus && row.afcStatus.powerState);
    if (afcSuffix) ap.afcPowerState = afcSuffix;

    if (row.clientCount != null && row.clientCount !== '') {
      const clients = Number(row.clientCount);
      if (Number.isFinite(clients) && clients >= 0) ap.clientCount = clients;
    }

    if (!ap.radio || !Array.isArray(row.radioStatuses)) continue;
    for (const radio of row.radioStatuses) {
      const key = bandParamKey(radio.band);
      if (!key || !ap.radio[key]) continue;
      const power = Number(radio.actualTxPower);
      if (Number.isFinite(power) && power > 0) ap.radio[key].actualTxPower = power;
      const calibration = Number(radio.calibrationTxPower);
      if (Number.isFinite(calibration) && calibration > 0) ap.radio[key].calibrationTxPower = calibration;
      const bandwidth = String(radio.channelBandwidth || '');
      if (/\d/.test(bandwidth)) ap.radio[key].operativeChannelBandwidth = bandwidth;
    }
  }
  return accessPoints;
}

// Aggregate POST /venues/aps/clients/query rows into per-AP per-band counts.
// Always sets clientCountsByBand (zeros when the AP has no clients) so the popup
// can show a breakdown whenever this query succeeded.
function applyClientBandCounts(accessPoints, clientRows) {
  const countsBySerial = new Map();
  const countsByMac = new Map();

  function emptyCounts() {
    return { '2.4G': 0, '5G': 0, '6G': 0 };
  }

  function bump(map, key, band) {
    if (!key || !band) return;
    let counts = map.get(key);
    if (!counts) {
      counts = emptyCounts();
      map.set(key, counts);
    }
    counts[band] += 1;
  }

  for (const row of clientRows || []) {
    const band = bandDisplayLabel(row.band);
    if (!band) continue;
    const apInfo = row.apInformation || {};
    const serial =
      row.apSerialNumber != null
        ? String(row.apSerialNumber)
        : apInfo.serialNumber != null
          ? String(apInfo.serialNumber)
          : '';
    const mac = normMac(
      row.apMac ||
        row.apMacAddress ||
        apInfo.macAddress ||
        apInfo.mac ||
        row.mac
    );
    if (serial) bump(countsBySerial, serial, band);
    if (mac) bump(countsByMac, mac, band);
  }

  for (const ap of accessPoints || []) {
    const counts =
      countsBySerial.get(String(ap.serialNumber || '')) ||
      countsByMac.get(normMac(ap.mac || ap.macAddress));
    ap.clientCountsByBand = counts ? { ...counts } : emptyCounts();
    // Prefer the clients-list sum over /venues/aps/query clientCount so the
    // popup total always matches the per-band breakdown (those APIs can disagree).
    const sum =
      (ap.clientCountsByBand['2.4G'] || 0) +
      (ap.clientCountsByBand['5G'] || 0) +
      (ap.clientCountsByBand['6G'] || 0);
    ap.clientCount = sum;
  }
  return accessPoints;
}

function portIdFromDesc(desc) {
  const match = PORT_ID_RE.exec(desc || '');
  return match ? match[1] : null;
}

function toInt(value) {
  if (value == null || value === '') return null;
  const n = parseInt(String(value).trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function wattsFromMw(mw) {
  const n = toInt(mw);
  if (n == null) return null;
  return Math.round((n / 1000) * 10) / 10;
}

function formatWatts(mw) {
  const watts = wattsFromMw(mw);
  if (watts == null) return null;
  return String(watts);
}

function standardRank(standard) {
  if (!standard) return 0;
  const s = String(standard);
  if (/802\.3\s*bt/i.test(s) || /type\s*[34]/i.test(s)) return 3;
  if (/802\.3\s*at/i.test(s) || /type\s*2/i.test(s)) return 2;
  if (/802\.3\s*af/i.test(s) || /type\s*1/i.test(s)) return 1;
  return 0;
}

function lldpClass(lldp) {
  if (!lldp || lldp.lldpClass == null || lldp.lldpClass === '') return null;
  const digits = String(lldp.lldpClass).replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}

function standardFromClass(cls) {
  if (cls == null) return null;
  if (cls <= 3) return '802.3af';
  if (cls === 4) return '802.3at';
  return '802.3bt';
}

function standardFromPowerType(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (/802\.3\s*bt/i.test(s) || /type\s*[34]/i.test(s)) return '802.3bt';
  if (/802\.3\s*at/i.test(s) || /type\s*2/i.test(s)) return '802.3at';
  if (/802\.3\s*af/i.test(s) || /type\s*1/i.test(s)) return '802.3af';
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (n === 1) return '802.3af';
    if (n === 2) return '802.3at';
    if (n === 3 || n === 4) return '802.3bt';
  }
  return null;
}

function standardFromPortType(poeType) {
  if (!poeType) return null;
  const s = String(poeType);
  if (/802\.3\s*bt/i.test(s) || /4P/i.test(s) || /UPOE/i.test(s)) return '802.3bt';
  if (/802\.3\s*at/i.test(s)) return '802.3at';
  if (/802\.3\s*af/i.test(s)) return '802.3af';
  if (/2P/i.test(s)) return '802.3at';
  return null;
}

function pickPseNeighbor(neighbors) {
  if (!neighbors || !neighbors.length) return null;
  const pse = neighbors.find((n) => String(n.lldpDeviceType || '').toUpperCase() === 'PSE');
  return pse || neighbors[0];
}

function indexPorts(ports) {
  const bySerialPort = new Map();
  const byNeighbor = new Map();
  for (const port of ports || []) {
    const pid = port.portIdentifier;
    for (const serial of [port.switchSerial, port.switchUnitId]) {
      if (serial) bySerialPort.set(`${serial}|${pid}`, port);
    }
    if (port.neighborName) byNeighbor.set(`name:${port.neighborName}`, port);
    const mac = normMac(port.neighborMacAddress);
    if (mac) byNeighbor.set(`mac:${mac}`, port);
  }
  return { bySerialPort, byNeighbor };
}

function findPort(ap, lldp, portIndex) {
  if (lldp && lldp.neighborSerialNumber) {
    const key = `${lldp.neighborSerialNumber}|${portIdFromDesc(lldp.lldpPortDesc)}`;
    if (portIndex.bySerialPort.has(key)) return portIndex.bySerialPort.get(key);
  }
  if (ap.name && portIndex.byNeighbor.has(`name:${ap.name}`)) {
    return portIndex.byNeighbor.get(`name:${ap.name}`);
  }
  const mac = normMac(ap.mac || ap.macAddress);
  if (mac && portIndex.byNeighbor.has(`mac:${mac}`)) {
    return portIndex.byNeighbor.get(`mac:${mac}`);
  }
  return null;
}

function isExplicitlyFalse(value) {
  return value === false || value === 'false' || value === 'False';
}

// Compact map label. LLDP class/allocation is negotiated PoE; switch poeUsed
// is live draw. Prefer both when available: "802.3bt C5 40.3W / Using 14.1W".
function formatPoeLabel(lldp, port) {
  const cls = lldpClass(lldp);
  let standard = standardFromClass(cls) || standardFromPowerType(lldp && lldp.lldpPowerType);
  const upoe = lldp && (lldp.lldpUPOE === true || String(lldp.lldpUPOE).toLowerCase() === 'true');
  if (!standard && upoe) standard = '802.3bt';
  if (!standard && port) standard = standardFromPortType(port.poeType);

  const alloc = formatWatts(lldp && lldp.lldpPSEAllocPowerVal);
  const draw = formatWatts(port && port.poeUsed);

  if (!standard && port && port.poeType) standard = String(port.poeType);
  if (!standard && alloc == null && draw == null) return null;

  const parts = [];
  if (standard) parts.push(standard);
  if (cls != null) parts.push(`C${cls}`);
  if (alloc != null) parts.push(`${alloc}W`);

  const negotiated = parts.join(' ');
  if (alloc != null && draw != null) return `${negotiated} / Using ${draw}W`;
  if (alloc != null) return negotiated;
  if (draw != null) return negotiated ? `${negotiated} / Using ${draw}W` : `Using ${draw}W`;
  return negotiated || null;
}

function labelForAp(ap, neighbors, port) {
  const lldp = pickPseNeighbor(neighbors);
  const text = formatPoeLabel(lldp, port);
  if (text) return text;
  if (!isOperational(ap)) return 'error:Offline';
  if (port && isExplicitlyFalse(port.poeEnabled)) return 'error:PoE disabled';
  if (!neighbors || !neighbors.length) return 'error:No LLDP';
  return 'error:No PoE data';
}

// Structured PoE row for rollups (FR#4). Map labels stay in `label`.
function detailForAp(ap, neighbors, port) {
  const mac = String(ap.mac || ap.macAddress || '').toLowerCase();
  const lldp = pickPseNeighbor(neighbors);
  const label = labelForAp(ap, neighbors, port);
  const operational = isOperational(ap);

  let status = 'ok';
  if (typeof label === 'string' && label.startsWith('error:')) {
    const err = label.slice(6);
    if (err === 'Offline') status = 'offline';
    else if (err === 'PoE disabled') status = 'poe_disabled';
    else if (err === 'No LLDP') status = 'no_lldp';
    else status = 'no_data';
  }

  const cls = lldpClass(lldp);
  let negotiatedStandard = standardFromClass(cls) || standardFromPowerType(lldp && lldp.lldpPowerType);
  const upoe = lldp && (lldp.lldpUPOE === true || String(lldp.lldpUPOE).toLowerCase() === 'true');
  if (!negotiatedStandard && upoe) negotiatedStandard = '802.3bt';
  const portStandard = port ? standardFromPortType(port.poeType) : null;
  if (!negotiatedStandard && portStandard) negotiatedStandard = portStandard;

  let underpowered = false;
  if (operational && port && isExplicitlyFalse(port.poeEnabled)) {
    underpowered = true;
    status = 'poe_disabled';
  } else if (
    status === 'ok' &&
    negotiatedStandard &&
    portStandard &&
    standardRank(negotiatedStandard) > standardRank(portStandard)
  ) {
    underpowered = true;
    status = 'underpowered';
  }

  const portId = (port && port.portIdentifier) ||
    (lldp && portIdFromDesc(lldp.lldpPortDesc)) ||
    null;

  return {
    apName: ap.name || '',
    apMac: mac,
    serial: ap.serialNumber || '',
    operational,
    status,
    underpowered,
    label,
    standard: negotiatedStandard || null,
    class: cls,
    allocW: wattsFromMw(lldp && lldp.lldpPSEAllocPowerVal),
    drawW: wattsFromMw(port && port.poeUsed),
    portId,
    switchSerial: (port && (port.switchSerial || port.switchUnitId)) ||
      (lldp && lldp.neighborSerialNumber) ||
      null,
    switchName: (port && port.switchName) ||
      (lldp && (lldp.neighborSystemName || lldp.neighborName)) ||
      null,
    portPoeEnabled: port ? !isExplicitlyFalse(port.poeEnabled) : null,
    portPoeType: (port && port.poeType) || null,
    portBudgetW: wattsFromMw(port && port.poeTotal)
  };
}

function poeResultsForAps(aps, neighborsBySerial, portIndex) {
  const labels = {};
  const details = {};
  for (const ap of aps) {
    const mac = String(ap.mac || ap.macAddress || '').toLowerCase();
    if (!mac) continue;
    const neighbors = neighborsBySerial[ap.serialNumber] || [];
    const lldp = pickPseNeighbor(neighbors);
    const port = findPort(ap, lldp, portIndex);
    const detail = detailForAp(ap, neighbors, port);
    labels[mac] = detail.label;
    details[mac] = detail;
  }
  return { labels, details };
}

// Back-compat helper used by older call sites / tests.
function labelsForAps(aps, neighborsBySerial, portIndex) {
  return poeResultsForAps(aps, neighborsBySerial, portIndex).labels;
}

module.exports = RuckusAPI;
module.exports.applyRadioStatuses = applyRadioStatuses;
module.exports.applyClientBandCounts = applyClientBandCounts;
module.exports.formatPoeLabel = formatPoeLabel;
module.exports.labelForAp = labelForAp;
module.exports.detailForAp = detailForAp;
module.exports.poeResultsForAps = poeResultsForAps;
module.exports.labelsForAps = labelsForAps;
module.exports.findPort = findPort;
module.exports.indexPorts = indexPorts;
module.exports.pickPseNeighbor = pickPseNeighbor;
module.exports.standardRank = standardRank;
module.exports.wattsFromMw = wattsFromMw;
module.exports.withRateLimitRetry = withRateLimitRetry;
module.exports.imageRedirectOptions = imageRedirectOptions;
