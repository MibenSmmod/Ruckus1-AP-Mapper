# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ruckus One AP Mapper is an Electron desktop application for visualizing Ruckus ONE access point locations on venue floor plans with RF and power information overlay. Built with Node.js (CommonJS modules), it integrates with the Ruckus ONE REST API for AP data and for Power over Ethernet (PoE) information (AP LLDP neighbors and ICX switch ports).

## Architecture

```
ruckus-one-ap-mapper/
├── main.js                 # Electron main process
├── preload.js              # Secure bridge between main/renderer
├── src/
│   ├── index.html          # Main window UI
│   ├── styles.css          # Application styles
│   ├── renderer.js         # UI logic, canvas rendering
│   └── api/
│       └── ruckus.js       # Ruckus ONE API client
└── config.json             # User credentials (gitignored)
```

## Commands

```bash
# Install dependencies
npm install

# Run the application
npm start

# Credential safety check (also runs automatically before every build)
npm run prebuild

# Build installers (mac / Windows / both)
npm run build:dmg
npm run build:win
npm run build:all

# Run tests (not yet configured)
npm test
```

## Build safety — never package credentials

- Tenant ID, Client ID, and Client Secret must never appear in source, git, or installers.
- Saved credentials live only in Electron userData (`config.json` under the app’s Application Support folder), not inside the DMG/EXE.
- Before every build/release: run `npm run prebuild`. It fails if project-root `config.json` / `.env` exists, if login inputs are pre-filled, or if `config.json` is not excluded from `build.files`.
- Seeing a pre-filled login form after opening a local build usually means userData on this machine — not that the installer contains secrets. Clear userData when verifying a clean package.
- If credentials may have shipped: delete the GitHub release/tag, bump the version, rebuild, and rotate the RUCKUS One Application Token.

## Requirements

- Node.js 18.0.0 or higher
- Electron 28.x

## Dependencies

**Runtime**: none beyond Node.js and Electron.

**Development**:
- `electron` (^28.0.0) - Framework for building desktop applications
- `electron-builder` (^24.9.1) - Build and packaging tool for creating installers (macOS .dmg, Windows .exe)

## Ruckus ONE API

The app connects to Ruckus ONE cloud via REST API:
- Authentication: OAuth2 client credentials flow
- Regions supported: North America (na), Europe (eu), Asia (asia)
- Endpoints: venues, floor plans, access points

## Key Features

- Login with Ruckus ONE API credentials
- Browse venues and floor plans
- Display floor plan images with AP overlay
- Click APs to view details (name, MAC, status, model)
- Settings menu with display options (hostname, PoE level)
- PoE (Power over Ethernet) data retrieval from the RUCKUS One API (LLDP neighbors and switch ports)
- PoE data caching per floor plan to avoid redundant queries
- Credential persistence (optional)

## UI Screens

1. **Login Screen**: Region selection, tenant/client credentials, save option
2. **Venue Selection**: List of venues from Ruckus ONE account
3. **Floor Plan Selection**: List of floor plans for selected venue
4. **Map Screen**: Floor plan image with AP overlay, search, zoom, settings, refresh

## State Management

The app uses a `state` object in `renderer.js` to track:
- Authentication (token, credentials, region)
- Selected venue and floor plan
- AP data and coordinates
- Display settings (showHostname, showPoE)
- PoE data cache per floor plan
- AP popup selection
- Font size preferences
- Search filters

## PoE (Power over Ethernet) System

### Overview
PoE is read from RUCKUS One, using the same calls as `r1_poe_audit.py`:
- `POST /venues/switches/switchPorts/query` for ICX port PoE type, draw, and budget
- `PATCH /venues/{venueId}/aps/{serial}/neighbors` to refresh LLDP on each operational AP (does not change AP configuration)
- `POST /venues/{venueId}/aps/{serial}/neighbors/query` for negotiated class and allocated power
- Results are cached per floor plan
- The map label prefers LLDP (for example `802.3bt C6 45W`) and falls back to the switch port (`802.3bt 9.9W`)

### Data Flow
1. User toggles "Display PoE Level" in settings menu
2. App checks if cached PoE data exists for current floor plan
3. **If cached**: Shows modal with "Display Cached Data" or "Query Again" options
4. **If not cached**: Shows a confirmation that RUCKUS One will refresh LLDP and read switch ports
5. On confirmation: main process queries switch ports, refreshes LLDP, waits, then reads neighbors
6. Shows progress modal during the query
7. Caches results in `state.poeDataByFloorPlan[floorPlanId]`, keyed by AP MAC
8. Renders PoE information on canvas alongside AP markers

### Caching Structure
```javascript
state.poeDataByFloorPlan = {
  [floorPlanId]: {
    [apMac]: '802.3bt C6 45W',
    ...
  }
}
```

## Settings Menu

Located in floating panel (top-right of map screen):
- **Display Hostname**: Shows AP hostname (ap.name) above channel labels in AP color
- **Display PoE Level**: Enables PoE querying and display

Toggles update via checkbox symbols: ☐ (unchecked) / ☑ (checked)

## Canvas Rendering

### Access Points
- **Dot color** indicates AP status: green (online), red (offline), orange/yellow (other states)
- **Channel labels** show band/channel/bandwidth/txpower below AP dot
- **Hostname** (optional) shows AP name above channel labels in AP color
- **PoE level** (optional) shows power info below channel labels

### Floor Plan
- Background: floor plan image from Ruckus ONE
- Interactive canvas with zoom controls (±, reset)
- Font size controls (small, medium, large)
- Pan support on canvas

## IPC Communication

Main process (`main.js`) and renderer (`renderer.js`) communicate via:
- `queryApPoe`: Read PoE labels for the APs on the current floor
- `getVenues`: Fetch user's venues
- `getFloorPlans`: Fetch floor plans for venue
- `getAccessPoints`: Fetch AP details and coordinates

## API Endpoints Used

- `GET /venues` - List user's venues
- `GET /venues/{venueId}/floorplans` - Floor plans for venue
- `GET /venues/{venueId}/floorplans/{floorplanId}/aps` - AP details and coordinates
- `POST /venues/switches/switchPorts/query` - ICX port PoE
- `PATCH /venues/{venueId}/aps/{serial}/neighbors` - refresh AP LLDP
- `POST /venues/{venueId}/aps/{serial}/neighbors/query` - read AP LLDP neighbors

## Modals

1. **PoE Confirmation Modal**: Displays before a PoE query and explains the LLDP refresh and switch-port read
2. **PoE Cache Choice Modal**: Shows when cached data exists, allows user to display cached or query fresh data
3. **PoE Progress Modal**: Shows during the API query, with progress and the current step
4. **AP Details Popup**: Shows when clicking an AP on the map (MAC, status, model, serial)
