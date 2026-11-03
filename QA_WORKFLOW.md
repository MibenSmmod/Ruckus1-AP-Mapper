# QA Workflow — Ruckus One AP Mapper

Guided **Test → Fix → Validate** process for the full app journey:

**Login → Venues → Floor(s) → Floor map**

This is broader than the in-app Getting Started checklist (FR#21). That list is a subset of map features; this workflow covers every screen, navigation, persistence, packaging, and performance.

---

## Method (how we work)

### Loop

1. **Test** one phase below with DevTools Console + Network open (`npm start`).
2. **Log** each issue: phase, steps, expected, actual, console/network clue, severity (`blocker` / `major` / `minor` / `polish`).
3. **Fix** blockers and majors in that phase before moving on (keeps regressions local).
4. **Validate** the failed cases plus a short smoke of the prior phase.
5. Advance to the next phase.

### Severity

| Level | Meaning | Examples |
|-------|---------|----------|
| Blocker | Cannot complete the journey | Auth crash, blank map, credentials in installer |
| Major | Feature broken or data wrong | Wrong AP coords, PoE cache never used, export empty |
| Minor | Workaround exists | Bad empty state, awkward focus |
| Polish | Looks/feel only | Spacing, label wording |

### Environments

| Pass | When | What |
|------|------|------|
| A — Dev | Every phase | `npm start` against a real tenant |
| B — Edge data | After map happy path | Dense floor, offline APs, no switches, single floor, many venues |
| C — Package | After Pass A is green | `npm run prebuild` then `build:mac-arm64` (or win); install with clean/cleared userData |

### Guided sessions (with the agent)

Run **one phase per session** (or one sub-section of Phase 4):

1. You run the checklist items and paste failures (or describe what you see).
2. Agent reproduces from code, patches, you re-test the validation bullets.
3. Mark the phase **PASS** only when its validation smoke is clean.

Say: *“Start guided QA — Phase 1”* (then 2, 3, 4a…4e, 5).

---

## Prep (once)

```bash
npm install
npm run prebuild
npm start
```

- Use a real Ruckus ONE tenant with at least one multi-floor venue if possible.
- Prefer a **read-only** token for most of the pass; use an **Admin** token only for Edit/move-device if that feature is in scope.
- Open Electron DevTools (Console + Network).
- Optional: clear app userData to test first-run (`~/Library/Application Support/ruckus-one-ap-mapper/` on macOS).

---

## Phase 1 — Login

**Goal:** Authenticate safely; no secrets in UI defaults or packages.

### Happy path
- [ ] App opens on login; Tenant / Client ID / Client Secret are **empty** (placeholders only)
- [ ] “See an example map” opens and closes without needing credentials
- [ ] Region select: na / eu / asia
- [ ] Show/hide client secret toggle works
- [ ] Valid credentials → Connect → venues screen
- [ ] Save credentials checked → quit → relaunch → fields restored, still connects
- [ ] Clear button empties fields; after clear + quit with save off, no leftover secrets on next launch
- [ ] Uncheck save / logout → saved credentials cleared from disk (userData `config.json` behavior)

### Negative / edge
- [ ] Wrong secret → clear error, stay on login, no crash
- [ ] Empty required fields → blocked by form validation
- [ ] Network offline / bad region host → graceful error
- [ ] Rapid double-click Connect → no duplicate auth storms / stuck spinner

### Validate after fixes
- Fresh start → example map → bad login → good login → logout → login again

**Gate:** Must pass before Phase 2. Also re-run `npm run prebuild` if login HTML/inputs changed.

---

## Phase 2 — Venues

**Goal:** List, navigate, and recover from API failures.

### Happy path
- [ ] Loading state then venue list
- [ ] Tile view and list view toggle; preference feels consistent within session
- [ ] Page size + Previous/Next pagination (use an account with enough venues, or temporarily lower page size)
- [ ] Click venue → floor plan screen; header shows venue name
- [ ] Logout returns to login and clears session API use

### Negative / edge
- [ ] Zero venues → sensible empty state (not a blank spinner forever)
- [ ] API error → venue error message; retry path if any (re-login / revisit)
- [ ] Slow network → loading remains visible until resolve; no double-render glitches

### Validate after fixes
- Login → venues → logout → login → open a venue

**Gate:** Must pass before Phase 3.

---

## Phase 3 — Floor plan(s)

**Goal:** Correct floors and device totals; clean back-navigation.

### Happy path
- [ ] Loading then floor list for the selected venue
- [ ] Venue device totals look plausible vs R1 (APs / switches if shown)
- [ ] Single-floor venue: one row, opens map
- [ ] Multi-floor venue: all floors listed; each opens the correct map
- [ ] Back → venues; venue selection still sane
- [ ] Logout from this screen works

### Negative / edge
- [ ] Venue with no floor plans → empty/error state, not a crash
- [ ] Floor fetch failure → error UI; Back still works
- [ ] Rapid Back / re-enter → no stale list from another venue

### Validate after fixes
- Venues → floors → Back → other venue → floors → open map → Back to floors

**Gate:** Must pass before Phase 4.

---

## Phase 4 — Floor map

Split into sub-phases so fixes stay focused. Finish **4a** before deep feature work.

### 4a — Load, navigate, chrome
- [ ] Loading then floor image draws
- [ ] AP markers in correct places vs R1 (spot-check 2–3 known APs)
- [ ] Switches appear when present; none when venue has none
- [ ] Legend counts (online/offline/other) match visible devices
- [ ] Freshness / stale badges behave (fresh after load; stale after age if you wait or mock time)
- [ ] Floor switcher (multi-floor): switch floors without returning to list; correct image + devices
- [ ] Back → floor list; Logout works
- [ ] Pan (drag), scroll zoom, + / − / reset zoom
- [ ] Opacity slider + typed %; image fades, overlays stay solid; preference persists **per floor**
- [ ] Font size S/M/L
- [ ] Legend collapse / expand
- [ ] Dark mode toggle (settings); title bar / UI coherent
- [ ] Keyboard shortcuts modal (Help) matches real bindings; Esc closes topmost overlay
- [ ] Window resize / maximize: canvas still usable

**Validate:** Load map → switch floor → adjust opacity/zoom/font → Back → re-open same floor (opacity restored)

### 4b — Selection, search, filter, CCI
- [ ] Hover AP → co-channel contention highlight on peers; leave hover clears
- [ ] Click AP → details (MAC, IP, status, model, serial, clients / by band)
- [ ] Click switch → details (model, MAC, IP, status, incidents, uptime, clients, PoE budget when known)
- [ ] Close popups via X and Esc
- [ ] Search (`/` or icon): hostname, serial, MAC, IP; keyboard nav in dropdown; clear
- [ ] No match → empty dropdown, no crash
- [ ] Filters: status, band, AFC, model; badge when active; Clear resets; hidden devices stay hidden until clear
- [ ] Settings toggles: hostname, PoE, LLDP, band info, APs, switches — each show/hide without full remount bugs

**Validate:** Search → open AP → filter offline → clear filter → toggle hostname off/on

### 4c — PoE & LLDP
- [ ] First Query PoE & LLDP → confirmation / progress; cancel stops cleanly
- [ ] Labels prefer LLDP form when present; fall back to switch-port style
- [ ] Second query → cache choice: Display cached vs Query again
- [ ] PoE chips in legend update; rollup button enables when budgets exist
- [ ] PoE budget rollup modal: usage, missing LLDP, underpowered — plausible vs labels
- [ ] Per-AP “Query PoE Type” in AP popup (when enabled)
- [ ] Leave floor and return: cache still available for that floor
- [ ] Other floor: independent cache (no cross-floor bleed)

**Validate:** Query → cancel mid-run → query complete → cached path → rollup → other floor → back

### 4d — Refresh & export
- [ ] Refresh API Calls updates labels; no duplicate markers; legend counts stay consistent
- [ ] Export PNG and PDF: overlays + opacity match on-screen intent; file opens
- [ ] Reveal-in-folder / save dialog cancel does not corrupt UI

**Validate:** Refresh → export PNG → export PDF

### 4e — Edit device location (Admin token only)
Skip with read-only token; confirm UI messaging instead.
- [ ] Read-only: Edit unavailable or clear error; login copy still honest
- [ ] Admin: Edit mode → drag → crosshairs → drop → R1 updated → reload shows new position
- [ ] Cancel / Esc abandons drag without writing
- [ ] Failed API write → user-visible error; marker not left in a lying position

**Validate:** Move one AP → Refresh / re-enter floor → position persists in R1

---

## Phase 5 — Cross-cutting (after map is green)

### Credentials & build safety
- [ ] `npm run prebuild` passes
- [ ] Project root has no `config.json` / `.env` / `credentials.json`
- [ ] Packaged app on clean userData does **not** pre-fill secrets
- [ ] Dev machine pre-fill after local run is userData only — not proof the DMG is clean

### Performance / efficient processing (observe, then fix hotspots)
- [ ] Dense floor: pan/zoom stays interactive; no multi-second freezes on filter toggle
- [ ] PoE query does not re-hit every AP when using cache
- [ ] Floor switch does not leak listeners / unbounded memory (toggle floors 10×; watch memory roughly)
- [ ] Search/filter does not redraw more than needed (jank = investigate `renderer.js` draw path)
- [ ] Leaving a venue clears or isolates floor-scoped caches as designed

### Regression smoke (5–7 minutes)
Login → venue → floors → map → search one AP → toggle one setting → PoE cached display → export PNG → Back → logout

---

## Fix discipline (keeps the guided workflow honest)

1. Fix inside the **current phase** first; avoid drive-by refactors in other screens.
2. Prefer smallest change: UI bug in `src/renderer.js` / `src/styles.css` / `src/index.html`; IPC in `main.js` / `preload.js`; API in `src/api/ruckus.js`.
3. After each fix: re-run that phase’s **Validate** bullets, then the **Regression smoke** if the change touched auth, IPC, or canvas draw.
4. Efficiency cleanup only after the related feature is functionally PASS (Phase 5), unless a freeze is a blocker.
5. Backup before large cleanup waves: `bash .cursor/skills/backup/scripts/backup.sh`

---

## Issue log template

```text
ID:
Phase: (1 | 2 | 3 | 4a–4e | 5)
Severity: blocker | major | minor | polish
Steps:
Expected:
Actual:
Console / Network:
Fix (PR/commit note):
Validated: yes/no
```

---

## Suggested order for guided runs

| Session | Focus |
|---------|--------|
| 1 | Phase 1 Login |
| 2 | Phase 2 Venues |
| 3 | Phase 3 Floors |
| 4 | Phase 4a Map chrome |
| 5 | Phase 4b Search / filter / popups |
| 6 | Phase 4c PoE |
| 7 | Phase 4d Refresh / export |
| 8 | Phase 4e Edit (optional) |
| 9 | Phase 5 Safety + perf + regression smoke |

Getting Started (FR#21) items map mostly into **4a–4d**; use that checklist as a user-facing smoke, not as the full QA plan.
