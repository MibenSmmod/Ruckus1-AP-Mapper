# QA Workflow — Ruckus One AP Mapper

Guided **Test → Fix → Validate** process for the full app journey:

**Login → Venues → Floor(s) → Floor map → Package**

Every phase has two halves:

- **UI** — what you see and click.
- **Backend** — what the main process and RUCKUS One API actually did (calls, writes, errors, storage, packaging).

The in-app **Getting Started** checklist (FR#20) is the user-facing smoke test. Its 15 items are folded into Phase 4 below (marked **GS**), so finishing Phase 4 also completes Getting Started.

---

## Method (how we work)

### Loop

1. **Gate** — run the automated checks (Phase 0). Don't start manual QA on a red build.
2. **Test** one phase below.
3. **Log** each issue (template at the end): phase, steps, expected, actual, terminal/console clue, severity.
4. **Fix** blockers and majors in that phase before moving on (keeps regressions local).
5. **Validate** the failed cases, plus a short smoke of the prior phase. Re-run `npm test`.
6. Advance to the next phase.

### Where to look (important)

All RUCKUS One API calls run in the **main process** (Node `https`), not the page. So:

| What | Where |
|------|-------|
| R1 API calls, retries, `[PoE]` / `[TX]` / `[Clients]` / `[GlobalSearch]` / `[API]` / `[updater]` warnings | The **terminal** running `npm start` |
| UI errors, canvas/render exceptions | DevTools **Console** (View → Toggle Developer Tools) |
| Settings, favorites, opacity, Getting Started progress | DevTools → Application → **Local Storage** (`r1-mapper-*` keys) |
| Saved credentials | `~/Library/Application Support/ruckus-one-ap-mapper/config.json` (Windows: `%APPDATA%\ruckus-one-ap-mapper\config.json`) |

> DevTools **Network** will *not* show R1 API traffic. Don't treat an empty Network tab as "no call was made".

### Severity

| Level | Meaning | Examples |
|-------|---------|----------|
| Blocker | Cannot complete the journey, or a safety issue | Auth crash, blank map, credentials in installer, unintended write to R1 |
| Major | Feature broken or data wrong | Wrong AP coords, PoE cache never used, export empty, missing devices on large tenants |
| Minor | Workaround exists | Bad empty state, awkward focus, unclear error text |
| Polish | Looks/feel only | Spacing, alignment, label wording |

### Environments

| Pass | When | What |
|------|------|------|
| 0 — Automated | Before every session | `npm test`, syntax, prebuild, static security checks |
| A — Dev | Every phase | `npm start` against a real tenant |
| B — Edge data | After the map happy path | Dense floor, offline APs, no switches, single floor, many venues, unplaced devices |
| C — Resilience | After Pass A is green | Network loss, timeouts, token expiry, cancel/logout mid-query |
| D — Package | Last | `npm run prebuild` then `build:mac-arm64` (or win); install with clean userData |

### Tokens

- Use a **Read Only** Application Token for Phases 1–4d. It proves the app never needs write access to view.
- Use an **Administrator** token only for Phase 4e (Edit mode), ideally on a **lab/test venue**. Edit mode writes to production R1.

### Guided sessions (with Claude)

Run **one phase per session** (or one sub-section of Phase 4):

1. Claude runs Phase 0 and reports the result.
2. You run the phase's checklist and paste failures (screenshot + terminal lines help most).
3. Claude reproduces from code, patches, adds a unit test when the fix is in `src/api/ruckus.js`, and re-runs Phase 0.
4. You re-test the **Validate** bullets. Mark the phase **PASS** only when they're clean.

Say: *"Start guided QA — Phase 1"* (then 2, 3, 4a…4e, 5, 6).

---

## Prep (once)

```bash
npm install
npm start
```

- Use a real Ruckus ONE tenant with at least one multi-floor venue, if possible.
- Keep the `npm start` terminal visible (backend logs) and open DevTools (Console + Application).
- Optional first-run test: quit the app and clear userData (`~/Library/Application Support/ruckus-one-ap-mapper/`).
- Note in R1 for later comparison: venue count, total AP/switch counts, and 2–3 known AP positions.

---

## Phase 0 — Automated gate (Claude runs this every session)

**Goal:** Catch regressions and safety problems before any clicking.

- [ ] `npm test` — all unit tests pass (PoE labels, radio/client merge, paging, 429 retry, image redirects, Edit-mode write allowlist and probe)
- [ ] `node --check` on `main.js`, `preload.js`, `src/*.js`, `src/api/*.js` — no syntax errors
- [ ] `npm run prebuild` — no project-root `config.json` / `.env` / `credentials.json`, login inputs empty, `config.json` excluded from `build.files`
- [ ] Static security checks:
  - [ ] No `rejectUnauthorized: false` anywhere in `src/` or `main.js`
  - [ ] `BrowserWindow` keeps `contextIsolation: true` and `nodeIntegration: false`
  - [ ] CSP meta in `src/index.html` still has `script-src 'self'` (no `unsafe-inline` / `unsafe-eval` for scripts)
  - [ ] `preload.js` exposes no generic `invoke`/`send`, raw HTTP method, or free-form path
  - [ ] The only R1 mutating calls in `src/api/ruckus.js` are the two placement PUTs (via `_placementWrite`) and the LLDP refresh `PATCH .../neighbors`
  - [ ] Any new `innerHTML` that includes API data uses `escapeHtml`
- [ ] App boots for ~10s with no errors in the terminal

**Gate:** Must be green before manual testing.

---

## Phase 1 — Login

**Goal:** Authenticate safely; no secrets in UI defaults, logs, or packages.

### UI — happy path
- [ ] App opens on login; Tenant / Client ID / Client Secret are **empty** (placeholders only)
- [ ] "See an example map" opens and closes without needing credentials
- [ ] Region select: na / eu / asia
- [ ] Show/hide client secret toggle works
- [ ] Valid credentials → Connect → venues screen
- [ ] Save credentials checked → quit → relaunch → fields restored, still connects
- [ ] Clear button empties fields; after clear + quit with save off, no leftover secrets on next launch
- [ ] Connect with Save **unchecked** → saved credentials removed from disk (`config.json` gone)
- [ ] Logout with Save **checked** → fields stay filled (saved login); with Save **unchecked** → Client Secret field is emptied and hidden

### UI — negative / edge
- [ ] Wrong secret → clear error, stay on login, no crash
- [ ] Wrong region for the tenant → clear auth error (not a hang)
- [ ] Empty required fields → blocked by form validation
- [ ] Network offline → "Cannot reach api…ruckus.cloud … Check your network connection and the selected Region" within ~60s; Connect usable again
- [ ] Rapid double-click Connect → no duplicate auth storms or stuck spinner

### Backend
- [ ] Saved `config.json` contains only `version`, `region`, `encryptedPayload` — no readable Tenant ID / Client ID / Secret — and is owner-only (`-rw-------`)
- [ ] Corrupt `config.json` (edit one character of `encryptedPayload`) → app opens with an empty login; terminal logs the error; no crash
- [ ] Legacy plaintext migration: a `config.json` with plain `tenantId`/`clientId`/`clientSecret` loads once and is rewritten encrypted
- [ ] The client secret never appears in terminal output or the DevTools console, including on failed login
- [ ] `test-auth.sh <tenant> <client>` prompts for the secret (hidden) and returns HTTP 200 for the correct region

### Validate after fixes
- Fresh start → example map → bad login → good login → logout → login again

**Gate:** Must pass before Phase 2. Re-run `npm run prebuild` if login HTML/inputs changed.

---

## Phase 2 — Venues

**Goal:** List, navigate, favorite, globally search, and recover from API failures.

### UI — happy path
- [ ] Loading state, then venue list
- [ ] Tile view and list view toggle; choice persists across relaunch
- [ ] Page size 10/20/50/100/All + Previous/Next pagination; size persists across relaunch
- [ ] Name sort toggles A→Z / Z→A
- [ ] Star a venue → it sorts to the top; persists across relaunch; per tenant (another tenant doesn't see it)
- [ ] Click venue → floor plan screen; header shows the venue name
- [ ] Logout returns to login

### Global Search (FR#17)
- [ ] Open from the venue header; progress bar advances through APs → switches → floor plans
- [ ] Search hostname, serial, MAC (any separator style), and IP
- [ ] Result shows Venue + Floor; **Jump** opens that floor, pulses the device, and fills the map search box
- [ ] Unplaced device shows "Unassigned" and Jump is disabled
- [ ] Cancel mid-build stops cleanly; reopening rebuilds
- [ ] Second search in the same session reuses the index (no rebuild); Refresh rebuilds; logout clears it

### UI — negative / edge
- [ ] Zero venues → sensible empty state (not an endless spinner)
- [ ] API error → venue error message; recover via re-login or revisit
- [ ] Slow network → loading stays visible until resolved; no double render

### Backend
- [ ] **Venue count matches R1.** If the tenant has many venues, confirm none are missing (`GET /venues` does not page)
- [ ] **Global Search AP total matches R1's total AP count** (`GET /venues/aps` does not page; a short count is a Major)
- [ ] Global Search with tenant-wide switch query failing → terminal shows the per-venue fallback warning and the search still works
- [ ] Logout during a Global Search build → build stops (no further `[GlobalSearch]` lines after logout)

### Validate after fixes
- Login → star a venue → Global Search a known AP → Jump → back to venues → logout → login (star still there)

**Gate:** Must pass before Phase 3.

---

## Phase 3 — Floor plan(s)

**Goal:** Correct floors and device totals; clean back-navigation.

### UI — happy path
- [ ] Loading, then floor list for the selected venue
- [ ] Venue-wide header `N Access Points · M Switches` matches R1
- [ ] Single-floor venue: one row, opens the map
- [ ] Multi-floor venue: all floors listed; each opens the correct map
- [ ] Back → venues; venue selection still sane
- [ ] Logout from this screen works

### UI — negative / edge
- [ ] Venue with no floor plans → empty state, not a crash
- [ ] Floor fetch failure → error UI; Back still works
- [ ] Rapid Back / re-enter another venue → no stale list from the previous venue

### Backend
- [ ] Venue with more than 500 switches or switch ports (if available) → counts still match R1 (paging)

### Validate after fixes
- Venues → floors → Back → other venue → floors → open map → Back to floors

**Gate:** Must pass before Phase 4.

---

## Phase 4 — Floor map

Split into sub-phases so fixes stay focused. Finish **4a** before deep feature work.

### Getting Started coverage

| # | Getting Started item | Phase |
|---|----------------------|-------|
| 1 | Hover an AP for co-channel (CCI) highlights | 4b |
| 2 | Click a device for AP/Switch details | 4b |
| 3 | Switch floors via the floor name dropdown | 4a |
| 4 | Search by Hostname, Serial, MAC, or IP | 4b |
| 5 | Filter to hide devices and focus the floor | 4b |
| 6 | Edit mode: move a device on the map | 4e |
| 7 | Query PoE and LLDP to acquire data for each AP | 4c |
| 8 | PoE Budget Rollup (usage, missing LLDP, underpowered) | 4c |
| 9 | Settings show/hide labels for dense floors | 4b |
| 10 | Refresh API Calls | 4d |
| 11 | Export PNG/PDF | 4d |
| 12 | Collapse the Legend | 4a |
| 13 | Lower-right: Opacity, Font Size, Zoom | 4a |
| 14 | Mouse scroll/zoom and click-drag pan | 4a |
| 15 | Keyboard Shortcuts in the Help menu | 4a |

Getting Started modal itself (test in 4a):
- [ ] Opens from Help → Getting Started and from the checklist button left of Search
- [ ] Checks persist across relaunch; Reset progress clears them
- [ ] Esc / Done / backdrop close it
- [ ] Rows and dividers line up the full width, including after scrolling the list and at small window sizes
- [ ] The list matches the real features (labels and order)

### 4a — Load, navigate, chrome
- [ ] Loading, then the floor image draws
- [ ] AP markers in the correct places vs R1 (spot-check the 2–3 APs you noted)
- [ ] Switches appear when present; none when the venue has none
- [ ] Legend counts (online/offline/other) match the visible devices
- [ ] Freshness / stale badges: fresh after load; Stale after 15 min (floor) / 30 min (PoE)
- [ ] **GS3** Floor switcher (multi-floor): switch floors without returning to the list; correct image + devices
- [ ] Back → floor list; Logout works
- [ ] **GS14** Pan (drag), scroll zoom toward the cursor
- [ ] **GS13** + / − / reset zoom; Font size S/M/L; opacity slider + typed %; image fades, overlays stay solid; opacity persists **per floor**
- [ ] **GS12** Legend collapse / expand; state persists
- [ ] Dark mode toggle (Settings and View menu stay in sync); title bar / UI coherent
- [ ] **GS15** Keyboard Shortcuts modal (Help, Cmd/Ctrl+/) matches the real bindings: `/`, `+`/`=`, `-`, `0`, ↑/↓/Enter in search, Esc closes the topmost overlay
- [ ] Shortcuts are ignored while typing in an input
- [ ] Window resize / maximize: canvas still usable

**Backend**
- [ ] Floor image loads with TLS verification on (no certificate error in the terminal). A certificate error here usually means a TLS-inspecting proxy; log it as a Blocker, don't work around it
- [ ] Image request that stalls → map error within ~60s, not an endless spinner
- [ ] `[TX]` or `[Clients]` warnings in the terminal → floor still loads (soft fail), popup just lacks that data

**Validate:** Load map → switch floor → adjust opacity/zoom/font → Back → re-open the same floor (opacity restored)

### 4b — Selection, search, filter, CCI
- [ ] **GS1** Hover AP → co-channel peers ringed by band; non-peers dim; switches hidden; leaving hover clears it
- [ ] **GS2** Click AP → details (MAC, IP, status, model, serial, clients total + per band; total = sum of bands)
- [ ] **GS2** Click switch → details (model, MAC, IP, status, incidents, uptime, clients, PoE budget when known)
- [ ] Close popups via X and Esc
- [ ] **GS4** Search (`/` or icon): hostname, serial, MAC (any separator), IP; keyboard nav in the dropdown; selecting pulses the device; clear
- [ ] No match → empty dropdown, no crash
- [ ] **GS5** Filters: status, band (6 GHz enabled), AFC (SP/LPI), model; button badge when active; header shows visible-of-total; Clear resets
- [ ] Filtered-out devices are excluded from search, hover, click, and export
- [ ] **GS9** Settings toggles: hostname, PoE, LLDP, band info, APs, switches — each shows/hides without remount bugs

**Backend**
- [ ] RF labels match R1 for 2–3 APs (channel, bandwidth, live TX power dBm, AFC SP/LPI)
- [ ] Client counts are plausible vs R1's Clients page

**Validate:** Search → open AP → filter offline → clear filter → toggle hostname off/on

### 4c — PoE & LLDP
- [ ] **GS7** First Query PoE & LLDP → confirmation explains the LLDP refresh → progress modal steps through switch ports → LLDP refresh → wait → LLDP read
- [ ] Cancel mid-run stops cleanly; partial results don't corrupt the cache
- [ ] Labels prefer the LLDP form (`802.3bt C6 45W / Using 14.1W`) and fall back to the switch port (`802.3bt / Using 9.9W`)
- [ ] Offline APs show `Offline`; APs with no neighbor table show `No LLDP`
- [ ] Second query → cache choice: Display cached vs Query again
- [ ] PoE chips in the legend update; rollup button enables when budgets exist
- [ ] **GS8** PoE Budget Rollup: floor usage %, per-switch usage, Missing LLDP / Underpowered lists; clicking an entry pulses the AP
- [ ] Per-AP "Query PoE Type" in the AP popup
- [ ] Leave the floor and return: cache still available; another floor has its own cache (no cross-floor bleed)

**Backend**
- [ ] One LLDP refresh (PATCH) per **operational** AP only; offline APs are skipped
- [ ] Using **Display cached** makes no R1 calls (terminal stays quiet)
- [ ] Spot-check 2 APs against the ICX: port, class, allocated W, and draw match
- [ ] Underpowered flag is correct for at least one known case (e.g. an 802.3bt AP on an 802.3at port), or note that none exist
- [ ] Per-AP query started while a floor query is running → both finish; Cancel stops both
- [ ] Logout during a PoE query → it stops (no more `[PoE]` lines)
- [ ] Rate limit: if HTTP 429 occurs on a very large floor, the user sees the rate-limit message (not a generic error) and the app recovers after a minute

**Validate:** Query → cancel mid-run → query to completion → cached path → rollup → other floor → back

### 4d — Refresh & export
- [ ] **GS10** Refresh API Calls updates labels; no duplicate markers; legend counts stay consistent; freshness resets
- [ ] **GS11** Export PNG and PDF (toolbar ⤓ and File menu, Cmd/Ctrl+E / Shift+Cmd/Ctrl+E): overlays + opacity match on-screen intent; white background even in dark mode; file opens
- [ ] Export respects active filters and ignores zoom/pan (full floor)
- [ ] Save dialog cancel → no error, UI unchanged; Reveal-in-folder works

**Backend**
- [ ] Exported PDF opens in Preview/Acrobat and prints at the right page size

**Validate:** Refresh → export PNG → export PDF

### 4e — Edit device location (Administrator token, lab venue)
**GS6.** Edit mode writes real coordinates to RUCKUS One.

**Read Only token**
- [ ] Edit on a floor with placed devices → Administrator Scope message; Edit stays off
- [ ] **R1 check:** no device moved
- [ ] Edit on a floor with **no** placed devices → Edit opens (unverified); dragging an unplaced device onto the map → rejected, device returns to the Unplaced list, Edit turns off, Administrator Scope message

**Administrator token**
- [ ] Turning Edit on → **no device moves in R1** (the access check re-writes a device's current position)
- [ ] Banner + Unplaced Devices panel appear; panel search works
- [ ] Drag an AP: icon becomes crosshairs while dragging, drop → R1 updated → Refresh / re-enter floor shows the new position
- [ ] Drag a switch: same as above
- [ ] Drag an unplaced device onto the floor → placed in R1
- [ ] Esc / leaving the map mid-drag cancels without writing
- [ ] Click without moving → no write

**Backend**
- [ ] R1 activity log shows only the expected position updates (one per drop, plus possibly one for the access check)
- [ ] Failed write (e.g. disconnect network, then drop) → error message, and the marker returns to its old position

**Validate:** Move one AP → Refresh / re-enter floor → position persists in R1 → move it back

---

## Phase 5 — Resilience & cross-cutting

### Network & session
- [ ] Turn Wi-Fi off during floor load → error within ~60s; turn it back on → Refresh works
- [ ] Leave the app idle for more than 60 min, then open a floor → works (token renews silently, no re-login)
- [ ] Leave the map open 30+ min → legend ages and Stale badges update

### Updater (FR#14)
- [ ] Launch offline → no dialog, no hang (silent failure)
- [ ] Launch online on the current version → no dialog
- [ ] Menu → Check for Updates… → "up to date" (or the update dialog if a newer release exists)

### Storage
- [ ] All preferences (`r1-mapper-*` in Local Storage) survive relaunch: theme, legend, favorites, page size, view mode, opacity per floor, Getting Started
- [ ] Logout clears session caches (venue devices, PoE cache, Global Search index) but keeps preferences

### Performance
- [ ] Dense floor: pan/zoom stays interactive; no multi-second freezes on filter toggle
- [ ] Switch floors 10× → memory roughly stable (Activity Monitor), no duplicated listeners (no doubled actions)
- [ ] Search/filter doesn't cause visible jank

---

## Phase 6 — Package & release

- [ ] `npm test` and `npm run prebuild` pass
- [ ] Project root has no `config.json` / `.env` / `credentials.json`
- [ ] Version bumped in `package.json` (and `src/index.html` if shown there)
- [ ] Build: `npm run build:mac-arm64` (and x64 / win as needed)
- [ ] Inspect the package contents — only `main.js`, `preload.js`, `src/**`, `package.json`; no `tests/`, `scripts/`, `config.json`, `.env`:
  ```bash
  npx asar list "dist/mac-arm64/Ruckus One AP Mapper.app/Contents/Resources/app.asar"
  ```
- [ ] Install with **cleared userData** → login fields empty
- [ ] macOS: app opens without Gatekeeper warnings (signed + notarized)
- [ ] Windows: installer runs, shortcuts created, app launches
- [ ] Regression smoke (below) on the installed build

### Regression smoke (5–7 minutes)
`npm test` → Login → venue → floors → map → search one AP → toggle one setting → PoE cached display → export PNG → Back → logout

---

## Fix discipline (keeps the guided workflow honest)

1. Fix inside the **current phase** first; avoid drive-by refactors in other screens.
2. Prefer the smallest change: UI bug in `src/renderer.js` / `src/styles.css` / `src/index.html`; IPC in `main.js` / `preload.js`; API in `src/api/ruckus.js`.
3. Logic fixes in `src/api/ruckus.js` get a unit test in `tests/ruckus.test.js`.
4. After each fix: Phase 0, then that phase's **Validate** bullets, then the **Regression smoke** if the change touched auth, IPC, or the canvas draw path.
5. Efficiency cleanup only after the related feature is functionally PASS (Phase 5), unless a freeze is a blocker.
6. One commit per fix (or per phase), referencing the issue ID.

---

## Issue log template

```text
ID:          QA-###
Phase:       (0 | 1 | 2 | 3 | 4a–4e | 5 | 6)
Severity:    blocker | major | minor | polish
Steps:
Expected:
Actual:
Terminal / Console:
Fix (commit):
Validated:   yes/no
```

---

## Suggested order for guided runs

| Session | Focus |
|---------|-------|
| 1 | Phase 0 + Phase 1 Login |
| 2 | Phase 2 Venues + Global Search |
| 3 | Phase 3 Floors |
| 4 | Phase 4a Map chrome + Getting Started modal |
| 5 | Phase 4b Search / filter / popups / CCI |
| 6 | Phase 4c PoE & LLDP |
| 7 | Phase 4d Refresh / export |
| 8 | Phase 4e Edit (Administrator token, lab venue) |
| 9 | Phase 5 Resilience + perf |
| 10 | Phase 6 Package + regression smoke |
