const https = require('https');

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

          // Handle redirects as errors for API calls
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            reject(new Error(`Authentication failed (HTTP ${res.statusCode}). Please check your Region, Tenant ID, Client ID, and Client Secret.`));
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
            reject(new Error(errorMessage));
          }
        });
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

  // Make binary HTTPS request (for images)
  _requestBinary(options) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks = [];

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const buffer = Buffer.concat(chunks);
            const contentType = res.headers['content-type'] || 'image/png';
            const base64 = buffer.toString('base64');
            resolve(`data:${contentType};base64,${base64}`);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
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

    const response = await this._request(options, postData);

    if (!response.access_token) {
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

    return await this._request(options);
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

    return await this._request(options);
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

  // Make binary request that follows redirects
  _requestBinaryWithRedirect(options, maxRedirects = 3) {
    return new Promise((resolve, reject) => {
      const makeRequest = (opts, redirectCount) => {
        const req = https.request(opts, (res) => {
          // Handle redirect
          if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
            if (redirectCount >= maxRedirects) {
              reject(new Error('Too many redirects'));
              return;
            }
            const redirectUrl = new URL(res.headers.location);
            const newOpts = {
              hostname: redirectUrl.hostname,
              port: 443,
              path: redirectUrl.pathname + redirectUrl.search,
              method: 'GET',
              rejectUnauthorized: false, // Allow cloud storage certs
              headers: {
                'Accept': 'image/*'
              }
            };
            makeRequest(newOpts, redirectCount + 1);
            return;
          }

          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const buffer = Buffer.concat(chunks);
              const contentType = res.headers['content-type'] || 'image/png';
              const base64 = buffer.toString('base64');
              resolve(`data:${contentType};base64,${base64}`);
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        });
        req.on('error', reject);
        req.end();
      };
      makeRequest(options, 0);
    });
  }

  // Query inventory with custom filter/body
  async queryInventory(tenantId, body) {
    await this._ensureAuthenticated();

    const postData = JSON.stringify(body);

    const options = {
      hostname: this.endpoints.api,
      port: 443,
      path: '/tenants/inventories/query',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-rks-tenantid': tenantId
      }
    };

    return await this._request(options, postData);
  }

  // Get access points (all APs, then filter by venue)
  async getAccessPoints(tenantId, venueId) {
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

    const allAPs = await this._request(options);
    // Filter APs by venue ID
    if (Array.isArray(allAPs)) {
      return allAPs.filter(ap => ap.venueId === venueId);
    }
    return allAPs;
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

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this._requestJson(options, postData);
      } catch (error) {
        if (error.statusCode === 429 && attempt < 3) {
          await delay(2 ** attempt * 1000);
          continue;
        }
        throw error;
      }
    }
    return null;
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
            const error = new Error('HTTP 429');
            error.statusCode = 429;
            reject(error);
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

      req.setTimeout(60000, () => {
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

  // ICX switches for a venue, including floor-plan placement and status.
  async getSwitches(venueId) {
    return this.queryAll(
      '/venues/switches/query',
      [
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
      ],
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
      const total = resp.totalCount != null ? resp.totalCount : rows.length;
      if (!data.length || rows.length >= total) return rows;
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
}

const V1_ACCEPT = 'application/vnd.ruckus.v1+json';
const PAGE_SIZE = 500;
const PORT_FIELDS = [
  'switchName', 'switchSerial', 'switchUnitId', 'portIdentifier', 'name',
  'status', 'poeEnabled', 'poeType', 'poeUsed', 'poeTotal', 'poeUsage',
  'neighborName', 'neighborMacAddress', 'venueId'
];
const PORT_ID_RE = /(\d+\/\d+\/\d+)/;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return Number.isInteger(watts) ? String(watts) : String(watts);
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
