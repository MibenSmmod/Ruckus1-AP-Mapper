// Unit tests for src/api/ruckus.js. No network: apiCall / request helpers are stubbed.
// Run with `npm test` (Node's built-in test runner, no extra dependencies).
const test = require('node:test');
const assert = require('node:assert');
const RuckusAPI = require('../src/api/ruckus');

const {
  formatPoeLabel,
  labelForAp,
  detailForAp,
  poeResultsForAps,
  indexPorts,
  applyRadioStatuses,
  applyClientBandCounts,
  withRateLimitRetry,
  imageRedirectOptions,
  wattsFromMw
} = RuckusAPI;

function stubClient(handler) {
  const client = new RuckusAPI('na');
  const calls = [];
  client.apiCall = async (method, path, body) => {
    calls.push({ method, path, body });
    return handler ? handler({ method, path, body }, calls.length) : null;
  };
  return { client, calls };
}

function httpError(statusCode) {
  const error = new Error(`HTTP ${statusCode}`);
  error.statusCode = statusCode;
  return error;
}

// --- PoE labels ---

test('PoE label prefers LLDP class/allocation and adds switch draw', () => {
  assert.strictEqual(
    formatPoeLabel({ lldpClass: '6', lldpPSEAllocPowerVal: '45000' }, { poeUsed: '14100' }),
    '802.3bt C6 45W / Using 14.1W'
  );
  assert.strictEqual(formatPoeLabel({ lldpClass: '4', lldpPSEAllocPowerVal: '25500' }, null), '802.3at C4 25.5W');
});

test('PoE label falls back to switch port type and draw', () => {
  assert.strictEqual(formatPoeLabel(null, { poeType: '802.3bt', poeUsed: '9900' }), '802.3bt / Using 9.9W');
  assert.strictEqual(formatPoeLabel(null, { poeUsed: '7000' }), 'Using 7W');
  assert.strictEqual(formatPoeLabel(null, null), null);
});

test('PoE error labels explain why there is no data', () => {
  assert.strictEqual(labelForAp({ status: '1_Offline' }, [], null), 'error:Offline');
  assert.strictEqual(labelForAp({ status: '2_00_Operational' }, [], { poeEnabled: false }), 'error:PoE disabled');
  assert.strictEqual(labelForAp({ status: '2_00_Operational' }, [], null), 'error:No LLDP');
});

test('PoE detail flags an AP negotiating more than the port standard as underpowered', () => {
  const detail = detailForAp(
    { name: 'AP1', mac: 'AA:BB', serialNumber: 'S1', status: '2_00_Operational' },
    [{ lldpDeviceType: 'PSE', lldpClass: '6', lldpPSEAllocPowerVal: '45000' }],
    { poeType: '802.3at', poeUsed: '20000', portIdentifier: '1/1/1' }
  );
  assert.strictEqual(detail.status, 'underpowered');
  assert.strictEqual(detail.underpowered, true);
  assert.strictEqual(detail.portId, '1/1/1');
});

test('PoE results match APs to switch ports by LLDP serial+port, name, or MAC', () => {
  const ports = indexPorts([
    { switchSerial: 'SW1', portIdentifier: '1/1/5', poeUsed: '10000', poeType: '802.3bt' },
    { neighborName: 'AP-NAME', portIdentifier: '1/1/6', poeUsed: '11000' },
    { neighborMacAddress: 'cc-dd-ee-ff-00-11', portIdentifier: '1/1/7', poeUsed: '12000' }
  ]);
  const aps = [
    { name: 'AP-SERIAL', mac: 'AA:00:00:00:00:01', serialNumber: 'A1', status: '2_00_Operational' },
    { name: 'AP-NAME', mac: 'AA:00:00:00:00:02', serialNumber: 'A2', status: '2_00_Operational' },
    { name: 'AP-MAC', mac: 'CC:DD:EE:FF:00:11', serialNumber: 'A3', status: '2_00_Operational' }
  ];
  const neighbors = { A1: [{ neighborSerialNumber: 'SW1', lldpPortDesc: 'GigabitEthernet1/1/5' }] };
  const { details } = poeResultsForAps(aps, neighbors, ports);
  assert.strictEqual(details['aa:00:00:00:00:01'].portId, '1/1/5');
  assert.strictEqual(details['aa:00:00:00:00:02'].portId, '1/1/6');
  assert.strictEqual(details['cc:dd:ee:ff:00:11'].portId, '1/1/7');
});

test('wattsFromMw rounds to one decimal and tolerates blanks', () => {
  assert.strictEqual(wattsFromMw('14123'), 14.1);
  assert.strictEqual(wattsFromMw(''), null);
  assert.strictEqual(wattsFromMw(null), null);
});

// --- Radio / client enrichment ---

test('applyRadioStatuses copies live tx power, bandwidth, AFC and client count', () => {
  const aps = [{ serialNumber: 'S1', radio: { apRadioParams6G: {}, apRadioParams24G: {} } }];
  applyRadioStatuses(aps, [{
    serialNumber: 'S1',
    clientCount: '7',
    afcStatus: { powerState: 'STANDARD_POWER' },
    radioStatuses: [
      { band: '6G', actualTxPower: '23', channelBandwidth: '160MHz' },
      { band: '2.4G', actualTxPower: '0' }
    ]
  }]);
  assert.strictEqual(aps[0].afcPowerState, 'SP');
  assert.strictEqual(aps[0].clientCount, 7);
  assert.strictEqual(aps[0].radio.apRadioParams6G.actualTxPower, 23);
  assert.strictEqual(aps[0].radio.apRadioParams6G.operativeChannelBandwidth, '160MHz');
  assert.strictEqual(aps[0].radio.apRadioParams24G.actualTxPower, undefined);
});

test('applyRadioStatuses marks live 6G for APs on venue settings (no enable6G)', () => {
  const aps = [
    { serialNumber: 'S1', radio: { useVenueSettings: true, apRadioParams6G: { operativeChannel: 69 } } },
    { serialNumber: 'S2', radio: { useVenueSettings: true, apRadioParams6G: {} } },
    { serialNumber: 'S3', radio: { apRadioParams6G: {} } }
  ];
  applyRadioStatuses(aps, [
    { serialNumber: 'S1', radioStatuses: [{ band: '6G', channel: 69, channelBandwidth: '160', actualTxPower: 22 }] },
    { serialNumber: 'S2', radioStatuses: [{ band: '6G', channel: 37, channelBandwidth: '320' }] },
    { serialNumber: 'S3', radioStatuses: [{ band: '6G', channel: 0 }] }
  ]);
  assert.strictEqual(aps[0].radio.live6G, true);
  assert.strictEqual(aps[0].radio.apRadioParams6G.operativeChannel, 69);
  assert.strictEqual(aps[0].radio.apRadioParams6G.actualTxPower, 22);
  assert.strictEqual(aps[1].radio.live6G, true);
  assert.strictEqual(aps[1].radio.apRadioParams6G.operativeChannel, 37);
  assert.strictEqual(aps[2].radio.live6G, undefined);
});

test('applyClientBandCounts totals clients per band and matches by serial or MAC', () => {
  const aps = [
    { serialNumber: 'S1', mac: 'AA:AA:AA:AA:AA:01' },
    { serialNumber: 'S2', mac: 'AA:AA:AA:AA:AA:02' },
    { serialNumber: 'S3', mac: 'AA:AA:AA:AA:AA:03' }
  ];
  applyClientBandCounts(aps, [
    { band: '2.4 GHz', apInformation: { serialNumber: 'S1' } },
    { band: '5 GHz', apInformation: { serialNumber: 'S1' } },
    { band: '6 GHz', apInformation: { serialNumber: 'S1' } },
    { band: '5GHz', apInformation: { macAddress: 'aa-aa-aa-aa-aa-02' } }
  ]);
  assert.deepStrictEqual(aps[0].clientCountsByBand, { '2.4G': 1, '5G': 1, '6G': 1 });
  assert.strictEqual(aps[0].clientCount, 3);
  assert.strictEqual(aps[1].clientCount, 1);
  assert.deepStrictEqual(aps[2].clientCountsByBand, { '2.4G': 0, '5G': 0, '6G': 0 });
});

// --- Paging ---

test('queryAll pages until totalCount is reached', async () => {
  const { client, calls } = stubClient((req, n) => ({
    data: Array.from({ length: n < 3 ? 500 : 10 }, (_, i) => ({ i })),
    totalCount: 1010
  }));
  const rows = await client.queryAll('/x/query', ['id'], null);
  assert.strictEqual(rows.length, 1010);
  assert.deepStrictEqual(calls.map((c) => c.body.page), [1, 2, 3]);
});

test('queryAll without totalCount keeps paging while pages are full', async () => {
  const { client, calls } = stubClient((req, n) => ({
    data: Array.from({ length: n === 1 ? 500 : 3 }, () => ({}))
  }));
  const rows = await client.queryAll('/x/query', ['id'], { venueId: ['v'] });
  assert.strictEqual(rows.length, 503);
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(calls[0].body.filters, { venueId: ['v'] });
});

test('queryAll stops on an empty page', async () => {
  const { client, calls } = stubClient(() => ({ data: [], totalCount: 999 }));
  assert.deepStrictEqual(await client.queryAll('/x/query', ['id'], null), []);
  assert.strictEqual(calls.length, 1);
});

// --- Rate limit retry ---

test('withRateLimitRetry retries 429 three times with backoff, then gives up', async () => {
  const waits = [];
  let attempts = 0;
  await assert.rejects(
    withRateLimitRetry(async () => { attempts += 1; throw httpError(429); }, async (ms) => { waits.push(ms); }),
    (error) => error.statusCode === 429 && /Rate limit/.test(error.message)
  );
  assert.strictEqual(attempts, 4);
  assert.deepStrictEqual(waits, [1000, 2000, 4000]);
});

test('withRateLimitRetry returns after a transient 429 and never retries other errors', async () => {
  let attempts = 0;
  const value = await withRateLimitRetry(async () => {
    attempts += 1;
    if (attempts === 1) throw httpError(429);
    return 'ok';
  }, async () => {});
  assert.strictEqual(value, 'ok');

  attempts = 0;
  await assert.rejects(withRateLimitRetry(async () => { attempts += 1; throw httpError(500); }, async () => {}));
  assert.strictEqual(attempts, 1);
});

// --- Floor plan image redirects ---

test('image redirect to cloud storage drops auth headers and keeps TLS defaults', () => {
  const original = { hostname: 'api.ruckus.cloud', headers: { Authorization: 'Bearer t', Accept: 'image/*' } };
  const opts = imageRedirectOptions('https://bucket.storage.example.com/a/b.png?sig=1', original, original);
  assert.deepStrictEqual(opts, {
    hostname: 'bucket.storage.example.com',
    port: 443,
    path: '/a/b.png?sig=1',
    method: 'GET',
    headers: { Accept: 'image/*' }
  });
  assert.ok(!('rejectUnauthorized' in opts));
});

test('image redirect on the same API host (or relative) keeps auth headers', () => {
  const original = { hostname: 'api.ruckus.cloud', headers: { Authorization: 'Bearer t' } };
  const opts = imageRedirectOptions('/files/abc/content', original, original);
  assert.strictEqual(opts.hostname, 'api.ruckus.cloud');
  assert.strictEqual(opts.headers.Authorization, 'Bearer t');
});

test('image redirect to plain http is refused', () => {
  const original = { hostname: 'api.ruckus.cloud', headers: {} };
  assert.throws(() => imageRedirectOptions('http://evil.example.com/x.png', original, original), /non-HTTPS/);
});

// --- FR#18 placement writes ---

test('placement writes only use the two allowlisted PUTs with sanitized bodies', async () => {
  const { client, calls } = stubClient();
  await client.updateApFloorPosition({ venueId: 'v', floorPlanId: 'f', serialNumber: 'S', xPercent: 150, yPercent: -3 });
  await client.updateSwitchPosition({ venueId: 'v', switchId: 'SW', floorPlanId: 'f', xPercent: 10, yPercent: 20 });
  assert.deepStrictEqual(calls, [
    { method: 'PUT', path: '/venues/v/floorplans/f/aps/S/floorPositions', body: { xPercent: 100, yPercent: 0 } },
    { method: 'PUT', path: '/venues/v/switches/SW/positions', body: { floorPlanId: 'f', xPercent: 10, yPercent: 20 } }
  ]);
});

test('placement gate refuses other methods, paths and body fields', async () => {
  const { client, calls } = stubClient();
  await assert.rejects(client._placementWrite('PATCH', '/venues/v/switches/SW/positions', {}), /only PUT/);
  await assert.rejects(client._placementWrite('PUT', '/venues/v/aps/S/reboot', {}), /allowlisted/);
  await assert.rejects(
    client._placementWrite('PUT', '/venues/v/floorplans/f/aps/S/floorPositions', { xPercent: 1, yPercent: 1, name: 'x' }),
    /only include/
  );
  assert.strictEqual(calls.length, 0);
});

test('client exposes no write-access probe (Edit mode writes only on a real drop)', () => {
  assert.strictEqual(typeof new RuckusAPI('na').probePlacementWriteAccess, 'undefined');
});

test('region must be na, eu or asia', () => {
  assert.strictEqual(new RuckusAPI('EU').endpoints.api, 'api.eu.ruckus.cloud');
  assert.throws(() => new RuckusAPI('mars'), /Invalid region/);
});

test('network failures get a plain-language message; other errors pass through', () => {
  const offline = Object.assign(new Error('getaddrinfo ENOTFOUND api.ruckus.cloud'), { code: 'ENOTFOUND' });
  const friendly = RuckusAPI.friendlyNetworkError(offline, 'api.ruckus.cloud');
  assert.match(friendly.message, /Cannot reach api\.ruckus\.cloud \(ENOTFOUND\)\. Check your network connection/);
  assert.strictEqual(friendly.code, 'ENOTFOUND');

  const other = httpError(401);
  assert.strictEqual(RuckusAPI.friendlyNetworkError(other, 'api.ruckus.cloud'), other);
});

test('sign-in HTTP errors become actionable messages', async () => {
  const msg = (status) => RuckusAPI.authFailureError(httpError(status)).message;
  assert.match(msg(401), /did not accept this Client ID and Client Secret.*\(HTTP 401\)$/);
  assert.match(msg(400), /Client ID and Client Secret/);
  assert.match(msg(403), /not allowed to access this tenant/);
  assert.match(msg(404), /no tenant with this Tenant ID .* Region/);
  assert.match(msg(503), /try again/);
  assert.strictEqual(RuckusAPI.authFailureError(httpError(401)).statusCode, 401);

  const offline = Object.assign(new Error('Cannot reach x'), { code: 'ENOTFOUND' });
  assert.strictEqual(RuckusAPI.authFailureError(offline), offline);
  const limited = httpError(429);
  assert.strictEqual(RuckusAPI.authFailureError(limited), limited);

  // authenticate() applies it to the token request.
  const client = new RuckusAPI('na');
  client._send = async () => { throw httpError(401); };
  await assert.rejects(client.authenticate('t', 'c', 's'), /did not accept this Client ID/);
});

test('a timed-out request reports the host, not the path', async () => {
  const https = require('node:https');
  const { EventEmitter } = require('node:events');
  const original = https.request;
  https.request = () => {
    const req = new EventEmitter();
    req.setTimeout = (_ms, onTimeout) => setImmediate(onTimeout);
    req.destroy = (err) => setImmediate(() => req.emit('error', err));
    req.write = () => {};
    req.end = () => {};
    return req;
  };
  try {
    const client = new RuckusAPI('na');
    const options = { hostname: 'api.ruckus.cloud', path: '/oauth2/token/secret-tenant', method: 'POST', headers: {} };
    await assert.rejects(client._request(options, 'x'), (err) => {
      assert.match(err.message, /^Cannot reach api\.ruckus\.cloud \(ETIMEDOUT\)/);
      assert.doesNotMatch(err.message, /secret-tenant/);
      return true;
    });
  } finally {
    https.request = original;
  }
});

test('AP firmware without LLDP refresh (WIFI-10496): query continues and the label says why', async () => {
  const client = new RuckusAPI('na');
  const firmwareError = new Error('PATCH ... -> HTTP 400: {"errors":[{"code":"WIFI-10496","message":"The version of AP firmware is not supported."}]}');
  firmwareError.statusCode = 400;
  const calls = [];
  client.apiCall = async (method, path) => {
    calls.push(`${method} ${path}`);
    if (path.endsWith('/switchPorts/query')) return { data: [], totalCount: 0 };
    if (method === 'PATCH') throw firmwareError;
    const noNeighbors = new Error('WIFI-10498 No detected neighbor data');
    throw noNeighbors;
  };
  const ap = { name: 'MCS-AP1', serialNumber: 'S1', macAddress: 'AA:BB:CC:00:00:01', status: '2_00_Operational' };
  const warn = console.warn;
  console.warn = () => {};
  let result;
  try {
    result = await client.queryApPoe('v1', [ap], { waitMs: 0 });
  } finally {
    console.warn = warn;
  }
  // Refresh was attempted, and the neighbors were still read.
  assert.ok(calls.some((c) => c.startsWith('PATCH ')));
  assert.ok(calls.some((c) => c.endsWith('/neighbors/query')));
  const detail = result.details['aa:bb:cc:00:00:01'];
  assert.strictEqual(detail.label, 'error:No LLDP (AP firmware)');
  assert.strictEqual(detail.status, 'no_lldp');
  assert.strictEqual(detail.lldpRefreshUnsupported, true);

  assert.ok(RuckusAPI.isFirmwareUnsupportedError(firmwareError));
  assert.ok(!RuckusAPI.isFirmwareUnsupportedError(httpError(400)));
});

test('PoE results for an AP without a MAC are keyed by serial, not dropped', () => {
  const ap = { name: 'New-AP', serialNumber: 'S9', status: '2_00_Operational' };
  const { labels, details } = poeResultsForAps([ap], { S9: [] }, indexPorts([]));
  assert.ok(labels['serial:S9']);
  assert.strictEqual(details['serial:S9'].apMac, 'serial:S9');
  assert.strictEqual(RuckusAPI.poeResultKey({ macAddress: 'AA:BB', serialNumber: 'S9' }), 'aa:bb');
});
