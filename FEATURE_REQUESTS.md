# Feature Requests

Reference items in prompts by number, e.g. `Implement FR#9`.

Status: `open` | `in progress` | `done` | `wontfix`

| ID | Status | Title |
|----|--------|-------|
| FR#1 | done | Export / share the view (PNG or PDF) |
| FR#2 | done | Filter by band / status / model |
| FR#3 | done | Channel / co-channel highlight |
| FR#4 | done | PoE budget rollup |
| FR#5 | done | Legend + summary strip |
| FR#6 | done | Multi-floor jump / venue overview |
| FR#7 | done | Client density (read-only) |
| FR#8 | wontfix | Compare refresh (highlight changes) |
| FR#9 | done | Cable / uplink hint from LLDP |
| FR#10 | done | Favorites / recent venues |
| FR#11 | done | Keyboard shortcuts |
| FR#12 | done | Dark mode |
| FR#13 | done | Offline / stale badge |
| FR#14 | done | Check for updates upon app opening |
| FR#15 | done | Search by device MAC address or IP Address |
| FR#16 | done | Security issue:  The API credentials are 
stored in plain text |
| FR#17 | open | Global search |
| FR#18 | open | Move devices on the map chaning their coordinates |
| FR#19 | done | Map opacity |

---

## FR#1 — Export / share the view

Export the current floor plan with AP labels (hostname, RF, PoE) as PNG or PDF for surveys, tickets, and customer handoffs.

**Done:** Map toolbar export button (⤓) and File → Export Map as PNG/PDF. Renders the full floor (current hostname/PoE/switch/font settings, ignores zoom/pan) at 2× resolution; save dialog; reveals the file in Finder/Explorer.

## FR#2 — Filter by band / status / model

New icon Filter:  Map filters such as offline only or online only, tri-band or dual-band, 6 GHz only, or specific models (e.g. R770, ICX8200-C08ZP), AFC SP or AFC LPI. Complements existing search on large floors.  Change the icon if there's a filter applied so the user knows there are items potentially missing from the page.

**Done:** Funnel filter button beside search. Panel filters by status (online/offline), band (All / 6GHz enabled), AFC (SP/LPI), and multi-select models from the current floor. “6GHz enabled” shows only APs with a 6 GHz channel and hides switches. Active filters highlight the button (primary fill + badge); header shows visible-of-total counts; search, hit-testing, and export follow the same visibility rules. Band/AFC filters hide switches (AP-only).

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

Add search icon to the Select Venues page.  This will perform a global search using the same queries as the floor level search does (IP, MAC address, Hostname, Serial).  Provide a progress bar.  Large deployments with many venues and floors means they'll have a lot of devices.  Provide the user feedback as you acquire the data of each device then present the location of the device e.g. Found <hostname> in Venue: <name>, Floor: <name>.  Provide a user a link to jump to the venue/floor and circle the deivce just as if the user searched for that device while on the floor page.  Sync the search box with the floor level if the user clicks on the link to jump to the found location floor page.

## FR#18 - Move devices on the map

This requires API credentials with write access.  Add a edit icon to the floor plan page.  This is to edit the device location on the map.  Allow the use to click and drag the device from its current location to a new location.  Once dropped send the API endpoint call to update Ruckus One cloud.

## FR#19 - Map opacity

Come up with controls so that the user can control the map opacity.  1% ~ 100%  Set default at 75%.  Store the user preference so that it's persistent per floor.  Some maps may require 100% while others need default 75% or even lesser at 25%.

**Done:** Bottom-right panel groups opacity slider with font size and zoom. Slider is 1–100% (default 75%); click the `%` label to type a value. Fades only the floor-plan image; AP/switch overlays stay full opacity. Preference persists per floor plan in localStorage. PNG/PDF export uses the same opacity.

---

## Adding new requests

1. Add a row to the table with the next ID (`FR#14`, …).
2. Add a matching `## FR#N — Title` section with a short description.
3. Keep status in sync with the table.
