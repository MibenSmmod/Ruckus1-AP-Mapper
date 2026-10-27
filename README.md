# Ruckus One AP Mapper

Desktop app for viewing Ruckus ONE access points on venue floor plans, with RF details (channel, bandwidth, transmit power) and optional PoE information.

This is an unofficial, community-developed tool and is not affiliated with Belden Inc. or Ruckus a Belden Brand.

## Features

- Sign in with Ruckus ONE API credentials (region, tenant ID, client ID, client secret)
- Browse venues and floor plans
- Overlay APs on floor plan images with status and RF labels
- Optional hostname and PoE level display
- Search APs by hostname or serial number
- Zoom, pan, and font-size controls

## Requirements

- Node.js 18 or higher
- A Ruckus ONE account at [https://ruckus.cloud/](https://ruckus.cloud/)
- An Application Token (Read Only recommended) and Tenant ID

## Setup

```bash
npm install
npm start
```

## Build installers

```bash
# macOS .dmg
npm run build:dmg

# Windows installer
npm run build:win
```

## Getting API credentials

1. Log in at [https://ruckus.cloud](https://ruckus.cloud)
2. **Administration** → **Account Management** → **Settings**
3. Under **Application Tokens**, add a token (Read Only recommended)
4. Copy the **Client ID** and **Shared Secret**
5. Get **Tenant ID** from the URL after login, or from **User Profile**

## Author

Mike Rieben — [LinkedIn](https://www.linkedin.com/in/mikerieben/)
