# RUCKUS One Device Mapper

Desktop app for viewing RUCKUS One access points and switches on venue floor plans, with RF details (channel, bandwidth, transmit power) and optional PoE/LLDP information.  Adds AFC power state if 6GHz is enabled.  This gives you a holistic view of all devices on a floor plan with RF info at a glance.

Major feature:  Move devices from Unplanned in a Venue onto the map with precision along with adjusting existing device locations.

Map images, floor-plan scale, and device locations are obtained through the RUCKUS One (R1) APIs.

## Disclaimer

This is an unofficial, community-developed tool. It is **not** affiliated with, endorsed by, or officially supported by Belden Inc., RUCKUS (a Belden Brand), or any of their affiliates. Use of RUCKUS / Belden trademarks is for identification only.

**Provided as-is, with no warranty of any kind.** The authors and contributors make no guarantees about fitness for a particular purpose, correctness, availability, or that use of this software will not cause issues in your environment. You use it at your own risk. The authors are not responsible for any damages, data loss, service disruption, or other consequences arising from use of this application.

## Download

Installers are on the **[Releases](https://github.com/MibenSmmod/Ruckus1-AP-Mapper/releases)** page (also linked in the repo sidebar under **About**).

**Latest (v1.3.0):**

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [RUCKUS One Device Mapper-1.3.0-arm64.dmg](https://github.com/MibenSmmod/Ruckus1-AP-Mapper/releases/download/v1.3.0/RUCKUS.One.Device.Mapper-1.3.0-arm64.dmg) |
| macOS (Intel) | [RUCKUS One Device Mapper-1.3.0-x64.dmg](https://github.com/MibenSmmod/Ruckus1-AP-Mapper/releases/download/v1.3.0/RUCKUS.One.Device.Mapper-1.3.0-x64.dmg) |
| Windows (x64) | [RUCKUS One Device Mapper-1.3.0-Setup.exe](https://github.com/MibenSmmod/Ruckus1-AP-Mapper/releases/download/v1.3.0/RUCKUS.One.Device.Mapper-1.3.0-Setup.exe) |

macOS builds are signed and notarized by Apple, so they open normally. The Windows installer is signed by WLAN GEEKS LLC; Windows SmartScreen may still show a prompt for a new release until it builds download reputation.

## Features

- Sign in with RUCKUS ONE API credentials (region, tenant ID, client ID, client secret)
- Browse venues and floor plans
- Overlay APs on floor plan images with status and RF labels
- Overlay switches on floor plan images with PoE budget shown
- Optional PoE/LLDP level display
- Search devices Globally or per Floor entering a hostname, serial number, IP address, or MAC address
- Opacity, zoom, pan, and font-size controls
- Click device icon for more information (IP address, MAC address, etc.)
- Edit mode (Administrator Scope): drag APs or switches to update floor-plan coordinates in RUCKUS One including Unplaced devices.

## Screenshots

### Login

![Login screen](screenshots/01-login-v1.2.0.png)

### Select venue

![Select venue](screenshots/02-select-venue.png)

### Select floor plan

![Select floor plan](screenshots/03-select-floor-plan.png)

### Map view

![Map view with APs, switches, and PoE](screenshots/04-map-view.png)

### AP details

![AP details popup](screenshots/05-ap-details.png)

### Switch details

![Switch details popup](screenshots/06-switch-details.png)

## Requirements

- A RUCKUS ONE account at [https://ruckus.cloud/](https://ruckus.cloud/)
- An Application Token and Tenant ID — **Read Only** is recommended for viewing; use **Administrator** Scope to Edit and move device locations on the map
- For running from source: Node.js 18 or higher

## Run from source

```bash
npm install
npm start
```

## Build installers

```bash
# macOS — Apple Silicon (M1 and later) .dmg
npm run build:mac-arm64

# macOS — Intel .dmg
npm run build:mac-x64

# Windows installer (.exe)
npm run build:win

# All three at once
npm run build:all
```

Installers are written to `dist/`. Build the macOS DMGs on a Mac; both architectures can be built from either an Apple Silicon or Intel Mac.

## Getting API credentials

1. Log in at [https://ruckus.cloud](https://ruckus.cloud)
2. **Administration** → **Account Management** → **Settings**
3. Under **Application Tokens**, add a token (Read Only recommended)
4. Copy the **Client ID** and **Shared Secret**
5. Get **Tenant ID** from the URL after login, or from **User Profile**

## License

[MIT](LICENSE)

## Author

Mike Rieben — [LinkedIn](https://www.linkedin.com/in/mikerieben/)
