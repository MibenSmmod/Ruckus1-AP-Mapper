# Feature Requests

Reference items in prompts by number, e.g. `Implement FR#9`.

Status: `🟢 open` | `in progress` | `done` | `wontfix`

| ID | Status | Title |
|----|--------|-------|
| [FR#1](#fr1--export--share-the-view) | done | Export / share the view (PNG or PDF) |
| [FR#2](#fr2--filter-by-band--status--model) | done | Filter by band / status / model |
| [FR#3](#fr3--channel--co-channel-highlight) | done | Channel / co-channel highlight |
| [FR#4](#fr4--poe-budget-rollup) | done | PoE budget rollup |
| [FR#5](#fr5--legend--summary-strip) | done | Legend + summary strip |
| [FR#6](#fr6--multi-floor-jump--venue-overview) | done | Multi-floor jump / venue overview |
| [FR#7](#fr7--client-density-read-only) | done | Client density (read-only) |
| [FR#8](#fr8--compare-refresh) | wontfix | Compare refresh (highlight changes) |
| [FR#9](#fr9--cable--uplink-hint-from-lldp) | done | Cable / uplink hint from LLDP |
| [FR#10](#fr10--favorites--recent-venues) | done | Favorites / recent venues |
| [FR#11](#fr11--keyboard-shortcuts) | done | Keyboard shortcuts |
| [FR#12](#fr12--dark-mode) | done | Dark mode |
| [FR#13](#fr13--offline--stale-badge) | done | Offline / stale badge |
| [FR#14](#fr14--check-for-updates-upon-app-opening) | done | Check for updates upon app opening |
| [FR#15](#fr15--search-by-device-mac-address-or-ip-address) | done | Search by device MAC address or IP Address |
| [FR#16](#fr16---security-issue--the-api-credentials-are-stored-in-plain-text) | done | Security issue:  The API credentials are stored in plain text |
| [FR#17](#fr17---global-search) | done | Global search |
| [FR#18](#fr18---move-device-locations-on-the-map) | done | Move device locations on the map and update R1 |
| [FR#19](#fr19---map-opacity) | done | Map opacity |
| [FR#20](#fr20---create-a-getting-started-guide) | done | Create a getting started guide |
| [FR#21](#fr21---enhance-getting-started-guide) | 🟢 open | Ehhance Gettings Started feature |
| [FR#22](#fr22---network-topology) | 🟢 open | Network Topology |

---

## FR#1 — Export / share the view

Export the current floor plan with AP labels (hostname, RF, PoE) as PNG or PDF for surveys, tickets, and customer handoffs.

**Done:** Map toolbar export button (⤓) and File → Export Map as PNG/PDF. Renders the full floor (current hostname/PoE/switch/font settings, ignores zoom/pan) at 2× resolution; save dialog; reveals the file in Finder/Explorer.

## FR#2 — Filter by band / status / model

New icon Filter:  Map filters such as offline only or online only, tri-band or dual-band, 6 GHz only, or specific models (e.g. R770, ICX8200-C08ZP), AFC SP or AFC LPI. Complements existing search on large floors.  Change the icon if there's a filter applied so the user knows there are items potentially missing from the page.

**Done:** Funnel filter button beside search. Panel filters by status (online/offline), band (All / 6GHz enabled / 6GHz disabled), AFC (SP/LPI), and multi-select models from the current floor. “6GHz enabled” shows only APs with a 6 GHz channel; “6GHz disabled” shows the rest (including APs without a 6 GHz radio); both hide switches. Active filters highlight the button (primary fill + badge); header shows visible-of-total counts; search, hit-testing, and export follow the same visibility rules. Band/AFC filters hide switches (AP-only).

## FR#3 — Channel / co-channel highlight

Mouse hover an AP (not switches) and tint peers on the same channel for a quick RF sanity check.

**Done:** Hovering an AP highlights co-channel peers matched on band+operative channel (not channel number alone). Peers get band-colored rings (2.4 blue / 5 purple / 6 orange; concentric if multi-band); non-peers dim; matching channel label lines stay bright; PoE and non-matching bands mute to grey. Switches hide for the hover; export clears hover so the overlay stays ephemeral.

## FR#4 — PoE budget rollup

Per switch or floor: total draw vs budget, underpowered ports, missing LLDP. Builds on existing PoE query + cache.

**Done:** PoE query returns structured details alongside map labels (cached per floor). Bar-chart toolbar button opens a rollup modal with floor draw/budget %, per-switch usage and linked AP counts, and clickable Missing LLDP / Underpowered lists that pulse the AP on the map. Switch popup shows PoE budget and issue links when available.

## FR#5 — Legend + summary strip

Show online/offline counts, PoE classes present, and last-refreshed time. Useful for demos and at-a-glance status.

**Done:** Expanded the bottom-left map legend into a summary strip: separate AP and Switch online/offline(/other) counts, PoE class chips from the floor cache (or “Not queried”), and relative Floor / PoE ages. Ages refresh every 30s while the map is open. Works with FR#13 stale badges.

## FR#6 — Multi-floor jump / venue overview

Quick floor switcher without returning to the list;  venue-level page label "# Access Points · # Switches" which totals across all floors in a venue.

**Done:** Map header floor dropdown jumps between floors without leaving the map (venue device lists cached; Refresh re-fetches). Floor-list header shows venue-wide `N Access Points · M Switches` inventory totals (map uses the legend strip instead).

## FR#7 — Client density (read-only)

If the API exposes it, show light client count near the AP or in the popup only so map labels stay clean.  Show active connected client count per band.

**Done:** AP popup shows total + per-band (2.4 / 5 / 6) clients from `/venues/aps/clients/query` (total matches band sum). Map RF labels append `/Clients` per band; legend updated to `Channel / Bandwidth / TxPower / Clients`. Clients query soft-fails so the floor still loads.

## FR#8 — Compare refresh

Snapshot RF/PoE, refresh, then highlight what changed (channel, power, PoE class).

## FR#9 — Cable / uplink hint from LLDP

When available, show switch name + port under the PoE label (neighbor-aware uplink hint).

**Done:** Settings → Display LLDP Info (default on, under Display Power Levels) draws `LLDP: switchName · portId` above the PoE block from cached PoE details after a PoE query. Independent of Display Power Levels; muted during co-channel hover; included in PNG/PDF export.

## FR#10 — Favorites / recent venues

Quick access for users who repeatedly open the same 2–3 sites when they have many. Add the ability to star their favorites and those appear at the top front of the line.  Right now the venues are shown as tiles.  Have an option to show as a list while maintaining the new favorites feature.  Provide a table with full pagenation.  Default display is 10 venues with option to expand to 20, 50, 100, All.  Store this setting in memory for the user so they don't have to keep changing it from session to session.

**Done:** Venue screen toolbar with tiles/list toggle and Show 10/20/50/100/All. Star (☆/★) on tiles and table rows; favorites sort to the top (per tenant, persisted). List mode is a Name/Address/Country table with pagination controls. Page size and view mode persist in localStorage across sessions.

## FR#11 — Keyboard shortcuts

Keyboard shortcuts for search "/", zoom in "+", zoom out "-".  Anything else a user may want a shortcut for that makes sense?  I do not want to add shortcuts for Settings menu items.

**Done:** Map-screen `/` opens search; `+`/`=` zoom in, `-` zoom out, `0` resets zoom (ignored while typing in inputs). Search dropdown supports ↑/↓/Enter. Escape closes one topmost modal/popup at a time (PoE dialogs, device popups, then floating panels). Help → Keyboard Shortcuts (Cmd/Ctrl+/) lists them; Settings toggles stay mouse-only.

## FR#12 — Dark mode

Dark mode with a toggle option for light in the settings.  Export should remain in normal light background.

**Done:** Settings → Dark Mode toggle and View → Dark Mode menu checkbox (default on; persisted in localStorage; stay in sync). UI chrome, panels, and map letterbox follow the theme; PNG/PDF export always fills with a white background.

## FR#13 — Offline / stale badge

Indicate when floor data or PoE cache is old.  FR#5 has a feature last-refreshed time.

**Done:** Summary strip shows a Stale badge (and warning-colored age text) when floor data is older than 15 minutes or PoE cache is older than 30 minutes. Hover the age for the absolute timestamp.

## FR#14 — Check for updates upon app opening

When the user opens this app check Github if there's a new version.  Same behavior as Check for updates menu.  Only prompt the user if there's a new update avaiable.  If they're on the current version do nothing.  Let's say you can't reach the Github page.  Try two times then stop.  I don't want the app to hang if Github is not accessible.  If they have internet issues the API calls will fail anyway.

**Done:** On window ready, runs `checkForUpdates({ silent: true, retries: 2 })` after a short delay. Prompts with the same Download/Open Release/Later dialog only when a newer GitHub release exists; up-to-date and network failures are silent. Fetch uses a 10s timeout per attempt.

## FR#15 — Search by device MAC address or IP Address

Add the ability to also search by MAC address or IP address.  We already gather that information per device (AP & Switch).

**Done:** Map search matches APs and switches on hostname, serial, MAC (separator-agnostic), or IP. Dropdown shows device kind plus MAC/IP; selecting a hit pulses that marker on the map.

## FR#16 - Security issue:  The API credentials are stored in plain text.

Security issue:  The API credentials are stored in plain text in the json file.  Need to harden the security on credentials for both Mac and Windows deployments.

**Done:** Credentials are encrypted at rest with Electron `safeStorage` (macOS Keychain / Windows DPAPI). `config.json` stores only a versioned base64 ciphertext blob; legacy plaintext configs are migrated on load.

## FR#17 - Global Search

Add search icon to the Select Venues page.  This will perform a global search using the same queries as the floor level search does (IP, MAC address, Hostname, Serial).  Provide a progress bar.  Large deployments with many venues and floors means they'll have a lot of devices.  Provide the user feedback as you acquire the data of each device then present the location of the device e.g. Found < hostname > in Venue: < name >, Floor: < name >.  Provide a user a link to jump to the venue/floor and circle the deivce just as if the user searched for that device while on the floor page.  Sync the search box with the floor level if the user clicks on the link to jump to the found location floor page.

**Done:** Select Venue header button opens a modal; Search builds a lean session index (1× tenant APs, switches tenant-wide with per-venue fallback, floor plans per venue) with progress/cancel, then matches hostname/serial/MAC/IP. Results show venue/floor and Jump; Jump opens the floor, pulses the device, and syncs the map search box. Index is cached for the login session (Refresh rebuilds; cleared on logout).

## FR#18 - Move device locations on the map

Requires API credentials with write access (Administrator Scope). Add an Edit button on the right side of the floor plan page to edit device locations on the map. Tell the user they must provide credentials with Administrator Scope (rights to send R1 updates). Investigate a way to test whether the user has the correct level of write access to R1 via API. Login page currently notes that Read-Only credentials are recommended — add notes that if Administrator Scope is provided, editing device locations on the map is possible. Update the GitHub README accordingly. Allow the user to click and drag a device icon from its current location to a new location; on release, call the R1 API to update the device coordinates in the cloud. While dragging, remove the device icon and replace it with crosshairs for pinpoint accuracy; once dropped, restore the icon at the new location on the map.

**Done:** Map Edit toggle (Administrator Scope). Probe write access by re-writing a placed device's current coordinates on this floor (no-op move; 2xx vs 403). Floors with nothing placed skip the probe and the first real move confirms access. Drag AP/switch with crosshairs; drop writes via `PUT .../floorPositions` (AP) or `PUT .../switches/{id}/positions` (switch) only — guarded by `_placementWrite` + typed IPC. Login help + README note Administrator for editing. Esc / leave map cancels drag without write; failed write restores prior coords. Edit mode also shows a right-side **Unplaced Devices** panel (venue APs/switches with no floor placement); drag from the list onto the current floor to place via the same allowlisted PUTs.

## FR#19 - Map opacity

Come up with controls so that the user can control the map opacity.  1% ~ 100%  Set default at 75%.  Store the user preference so that it's persistent per floor.  Some maps may require 100% while others need default 75% or even lesser at 25%.

**Done:** Bottom-right panel groups opacity slider with font size and zoom. Slider is 1–100% (default 75%); click the `%` label to type a value. Fades only the floor-plan image; AP/switch overlays stay full opacity. Preference persists per floor plan in localStorage. PNG/PDF export uses the same opacity.

## FR#20 - Create a getting started guide

Provide a list of things the user can do and try in a checkbox format.  Add Getting Started to the menu.  Add a new button to the left of Search that looks like a check list.

**Done:** Help → Getting Started and a checklist toolbar button left of map Search open a modal with try-it checkboxes (Edit mode listed above Query PoE & LLDP). Progress persists in localStorage; Reset progress clears checks. Esc / Done / backdrop close like other modals.

## FR#21 - Enhance Getting Started Guide

Make the popout a floating window so it can stay on the screen while the user tries features.  Allow them to drag outside of the application window if possible.  Do not implement this if you can't make this happen.  It's too large and takes up a lot of space within the application window X/Y area.

## FR#22 - Network Topology

Create a page similar to the R1 UX that compiles a network topology with devices that are clickable.  If the device is offline then show it with a red dot and red cable.  Use LLDP to track connections and show a label with which ports are connected.

Reference (R1 topology view): tree layout with Cloud at the top, ICX switches below it, and APs below each switch. Each device shows a model icon, a full hostname, and a status dot; links are curved cables (green when online), with a collapse (⊖) toggle under each switch for its children.

---

## Adding new requests

1. Add a row to the table with the next ID (`FR#14`, …).
2. Add a matching `## FR#N — Title` section with a short description.
3. Keep status in sync with the table.
