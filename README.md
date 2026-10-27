# Social Medium Kiosk Check-In System

**Version:** 4.7  
**Live Application:** [https://neon-kiosk.onrender.com](https://neon-kiosk.onrender.com)  
**Repository:** [github.com/socialmediumben/neon_kiosk](https://github.com/socialmediumben/neon_kiosk)

---

## 📖 Overview

The **Social Medium Kiosk** is an in-person, touchscreen check-in station deployed at the Social Medium makerspace. It integrates with the **Neon CRM (Neon One) API v2** to handle:

- **Quick Authentication**: Member lookup by RFID/NFC Tap Card, Neon Account ID, or Last Name.
- **Waiver & Membership Verification**: Enforces signed liability waivers and differentiates between active members and day pass visitors/guests.
- **Nametag Printing**: Direct formatted label printing for visitor nametags showing preferred names, pronouns, interests, and member status badges.
- **RFID/NFC Card Provisioning**: Allows anyone with a signed waiver to link or re-assign a physical tap card to their Neon CRM profile.
- **Daily Attendance Tracking**: Restricts general "Check-In" activities to one per person per day to eliminate duplicate entries in Neon CRM.
- **Club Check-In & Time Tracking**: Quick one-tap logging for club attendance (Cosplay, Electronics, TTRPG, Process Art, Drawing & Storytelling) and a dual Check-In / Check-Out time tracker for Creative Teens Club.
- **Upcoming Events & RSVP System**: Browse upcoming events with pagination, 1-click free RSVP for active members, automatic segregation of already-registered events, and QR code redirection for paid workshops and non-members.

---

## 🏗️ System Architecture

The project consists of a lightweight Node.js/Express proxy backend and a single-page frontend:

```
neon_kiosk/
├── index.html         # Main kiosk user interface (Vanilla JS + Tailwind CSS)
├── index.js           # Express API proxy & static file server
├── discovery.html     # Interactive API explorer for Neon CRM testing
├── package.json       # Project dependencies (Express, CORS, node-fetch)
└── README.md          # Hand-off and maintenance documentation
```

### 1. Backend Proxy (`index.js`)
Neon CRM requires Basic Authentication using an Org ID and API Key. To avoid exposing credentials on the client side and avoid browser CORS restrictions, `index.js` acts as a transparent reverse proxy:
- All calls to `/api/*` are forwarded directly to `https://api.neoncrm.com/*` with the `Authorization: Basic <base64(orgId:apiKey)>` header attached.
- Serves `index.html` at the root `/`.
- Serves static assets including `discovery.html`.

### 2. Frontend (`index.html`)
- Built with **Vanilla JavaScript** (no bundler, build step, or framework overhead).
- **Tailwind CSS** loaded via CDN.
- **QRCode.js** loaded via CDN to generate dynamic QR codes for phone registrations, waivers, and day passes.
- State-machine driven interface using visual "stages":
  - `stage-search`: Initial idle screen waiting for tap card or search input.
  - `stage-results`: Account disambiguation list when multiple last names match.
  - `stage-confirm`: Pre-checkin nametag review, waiver warning, or Day Pass purchase prompt.
  - `stage-success`: Welcome screen displaying nametag print trigger, club buttons, tap card linking, and upcoming events list.
  - `stage-waiver`: Standalone waiver screen for first-time walk-ins.

---

## 🔑 Neon CRM Configuration & Data Dictionary

The kiosk relies on specific Neon CRM custom fields, system properties, and account attributes. When incorporating this system into other projects, maintain alignment with these IDs:

### Custom Fields (`accountCustomFields`)
| Field ID | Name / Purpose | Type | Notes |
| :--- | :--- | :--- | :--- |
| **`87`** | Liability Waiver | Checkbox / Text | Checked or non-empty string indicates waiver signed. |
| **`81`** | Interests | Multi-Select Options | Displayed on the nametag ("I'm Nerdy for..."). |
| **`83`** | Custom Interests | Text | Freeform interests entered by the constituent. |
| **`114`** | Tap Card | Text | RFID/NFC Card serial number / UID. Used for instant tap search. |

### System Accounts & Activity Constants
| Constant | Value | Purpose |
| :--- | :--- | :--- |
| `SYSTEM_USER_ID` | `"3508"` | The Neon CRM user ID assigned as creator of check-in activities. |
| `status.id` | `"4"` | Default activity status: **Completed**. |
| `timeZone.id` | `"82"` | Time zone identifier for **America/Los_Angeles** (Pacific Time). |

### Club Custom Statuses (`/api/v2/properties/activityCustomStatuses`)
When check-in activities are created, they optionally receive a `customStatus` object:
| Club Name | Activity Subject | Neon CRM Status ID |
| :--- | :--- | :--- |
| **Cosplay Club** | `Cosplay Club Check-In` | `7` |
| **Creative Teens Club** | `Creative Teens Club Check-In` | `8` |
| **Maker Mixer Club** | *(Legacy / Inactive)* | `9` |
| **Electronics Club** | `Electronics Club Check-In` | `10` |
| **TTRPG Club** | `TTRPG Club Check-In` | `11` |
| **Process Art Club** | `Process Art Club Check-In` | `12` |
| **Drawing & Storytelling** | `Drawing & Storytelling Club Check-In` | Dynamic discovery via API (or omitted if not configured) |

> **Note on Custom Status Failsafe:** Neon CRM rejects activity creation with HTTP 400 if an unknown `customStatus.id` is supplied. The kiosk dynamically queries `/properties/activityCustomStatuses` on startup and only includes `customStatus` if the ID is verified in Neon CRM.

### Standard External URLs
- **Waiver Form**: `https://socialmedium.app.neoncrm.com/forms/waiver`
- **Day Pass Purchase**: `https://socialmedium.app.neoncrm.com/np/clients/socialmedium/product.jsp?product=3&`
- **Public Events Calendar**: `https://socialmedium.app.neoncrm.com/np/constituent/eventList.do?orgId=socialmedium`

---

## ⚡ Core Business Logic & Workflows

### 1. Unified Search (`performUnifiedSearch`)
The single input field on the home screen handles three inputs interchangeably:
1. **Tap Card**: Searches accounts where custom field `Tap Card` (`114`) equals the scanned string.
2. **Numeric Input**: If purely numeric, queries `GET /api/v2/accounts/{id}` directly.
3. **Name Search**: Searches constituents with `Last Name EQUAL {input}`. If multiple accounts match, shows `stage-results`.

### 2. RFID / NFC Card Scanner Integration
- Physical USB RFID/NFC card readers typically act as **keyboard wedge devices** (they type the card's UID characters rapidly and end with `Enter`).
- A global `keydown` event listener on `document` listens for keystrokes.
- If the kiosk is on `stage-search` and an input field is not active, any typed keystroke automatically refocuses the search bar.
- If the **"Link Tap Card"** modal is active, all keystrokes are intercepted into an internal memory buffer (`linkedCardBuffer`), debounced with a 15-second timeout, and saved directly to Custom Field `114` via `PATCH /api/v2/accounts/{id}`.

### 3. Member vs. Non-Member Logic
Membership is determined by `currentAccount.accountCurrentMembershipStatus`:
- **Active Member** (`active`):
  - Kiosk background becomes **Cyan** (`#3BC0CD`).
  - Auto-bypasses the confirmation stage and immediately confirms check-in.
  - Nametag renders a **solid black Star (★)** badge.
  - Gets **1-click free RSVP** on upcoming community events.
- **Non-Member / Inactive / Guest**:
  - Kiosk background becomes **Orange** (`#F16622FF`).
  - Routes to `stage-confirm` showing:
    - If waiver is missing: Big red QR code to sign the waiver.
    - If waiver signed: QR code to purchase a Day Pass, an optional field for "+1 Host Name", and a "Confirm Check-In" button.
  - Nametag renders an **open circular badge**.
  - Events display a "Register" button opening a QR code for mobile web payment.

### 4. Once-Per-Day Check-In Prevention
Constituents often return to the kiosk during a single visit to RSVP for events, print extra nametags, or check into evening clubs. To prevent polluting CRM reporting with multiple general check-in activities:
- When an account checks in, their ID is saved in browser `localStorage` under key `checkins_YYYY-MM-DD` (evaluated in Pacific Time).
- If they check in again on the same calendar day, the API call to create the general `"Check-In"` activity is skipped.
- The screen updates immediately to `"Welcome back, {FirstName}!"` and presents all kiosk actions without penalty.
- Old daily keys in `localStorage` are pruned automatically.

### 5. Creative Teens Club Single-Activity Tracking
To measure how long teen members stay in the space without creating messy disjointed records:
- **Arrival (Check-In)**: Creates a single Neon CRM activity `Creative Teens Club Check-In` with `startDate` and `startTime`. The returned Neon `activityId` is saved in `localStorage` under `ct_activity_YYYY-MM-DD`. The button turns amber and changes label to **"Creative Teens Club Check-Out"**.
- **Departure (Check-Out)**: Sends a `PATCH /api/v2/activities/{activityId}` adding `endDate` and `endTime`. The button disables and changes label to **"✅ Checked Out"** for the rest of the day.

### 6. Events & Workshop RSVP Rules
Upcoming events are retrieved via `GET /api/v2/events` (with pagination support):
- **Club Event Filtering**: Any event records in category `"Clubs"` or containing the word `"Club"` are excluded from the upcoming events list because clubs are handled in the club check-in panel.
- **Pagination**: Displayed **10 events per page** with responsive `← Prev Page` and `Next Page →` controls and a `Page X of Y` indicator.
- **Free RSVP**: For active members on standard community events, clicking `"RSVP (Free)"` sends a `POST /api/v2/eventRegistrations` with `totalCharge: 0`.
- **Workshops (Paid Events)**: Events categorized with `"Workshops"` are **not free for members**. The kiosk detects `category: ['Workshops']`, applies an amber `Workshop` badge, and renders a `"Register"` button opening a QR code for phone payment instead of a free RSVP button.
- **Already RSVP'd**: Any events the user is registered for are split into an **"Already RSVP'd"** section to prevent accidental duplicate registrations.

### 7. Idle Auto-Reset Timer
- Once a user reaches `stage-success`, a **120-second countdown timer** begins.
- When the timer reaches 0 (or if the user clicks "Next Person"), the kiosk executes `location.reload()` to clear all account memory and return to the search screen ready for the next constituent.

---

## 🚀 Deployment & Environment Setup

### Environment Variables
The Express server requires the following environment variables configured (e.g. in Render Dashboard):

| Variable | Description |
| :--- | :--- |
| `NEON_ORG_ID` | Your Neon One Organization ID. |
| `NEON_API_KEY` | Your Neon One API Key. |
| `PORT` | *(Optional)* Port to bind server. Defaults to `3000` (Render provides this automatically). |

### Running Locally
```bash
# 1. Clone repository
git clone https://github.com/socialmediumben/neon_kiosk.git
cd neon_kiosk

# 2. Install dependencies
npm install

# 3. Set environment variables (PowerShell example)
$env:NEON_ORG_ID="your_org_id"
$env:NEON_API_KEY="your_api_key"

# 4. Start server
npm start
```
Visit `http://localhost:3000` in your browser.

### Continuous Deployment on Render
- Connected to GitHub repository `socialmediumben/neon_kiosk`.
- **Branch**: `main`
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- Any push to `main` automatically triggers a zero-downtime redeploy on Render.

---

## 🛠️ Developer Tips & Extension Guide

If you are building new projects, integrations, or sidecars based on this kiosk:

1. **Testing Neon API Endpoints (`discovery.html`)**:
   Open `/discovery.html` in your browser on the deployed site or locally. It is an interactive API client that uses the kiosk proxy credentials, allowing you to test GET, POST, and PATCH endpoints and inspect payload schemas directly against live CRM data without writing throwaway scripts.

2. **Touchscreen & Screen Orientation**:
   The layout is optimized for a vertically-oriented touchscreen display (1080×1920 or standard 16:9 rotated). Buttons have generous touch padding (`py-3`, `py-4`) and high-contrast color states.

3. **Label Printing Configuration**:
   Nametag printing is handled using native browser `window.print()` targeting `#nametag-to-print`. When deploying a physical kiosk printer (e.g., Brother QL series), set the browser print dialog defaults to:
   - Margins: None
   - Headers/Footers: Disabled
   - Paper Size: Continuous or Standard Die-Cut Address / Badge Label

4. **Timezone Considerations**:
   All daily limits and activity dates are hardcoded to the `'America/Los_Angeles'` timezone via `Intl.DateTimeFormat` so that kiosks running across UTC day boundaries don't prematurely roll over dates.
