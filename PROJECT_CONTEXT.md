# TC Work Zone Locator - Project Context

> **Last Updated:** 2026-03-02
> **Current Version:** RC 1.0.2
> **GitHub:** https://github.com/instructor-ship-it/roadfinder.git
> **Branches:** master, main (kept in sync)
> **Project Directory:** `/home/z/my-project/`

---

## ⚠️ IMPORTANT: Starting a New Chat Session

**Each new chat session starts with a FRESH file system.** Previous work is NOT automatically available.

### At the start of EVERY new session, tell the AI:

```
This is the TC Work Zone Locator project. The code is on GitHub.

Run these commands to get the latest code:
cd /home/z/my-project
rm -rf * .* 2>/dev/null || true
git clone https://github.com/instructor-ship-it/roadfinder.git .
bun install

Then read PROJECT_CONTEXT.md and worklog.md to get up to speed.
```

### ✅ This workflow was tested and confirmed working on 2026-02-28

### Why this is needed:
| What Persists | What Doesn't |
|---------------|--------------|
| Code pushed to GitHub | Local file system changes |
| Git history | Uncommitted work |
| PROJECT_CONTEXT.md | Session memory |

**GitHub is the only true persistence.** Always push changes before ending a session.

---

## Overview

A mobile-first web application for Traffic Controllers (TC) in Western Australia to:
- Locate work zones by road ID and SLK (Straight Line Kilometre)
- Track real-time GPS position with EKF filtering
- Display speed limits with lookahead warnings
- Work offline with 69,000+ roads downloaded

## Target Users

Traffic Controllers working on WA roads who need to:
- Find work zone coordinates for setup
- Navigate to work zone start/end points
- Track their position in real-time while driving
- Know upcoming speed zone changes before passing signs
- Work in remote areas without internet

---

## Architecture

### Tech Stack
- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Offline Storage:** IndexedDB (client-side)
- **Maps:** Google Maps Links (no API key required)

### Key Files

```
src/
├── app/
│   ├── page.tsx              # Main work zone lookup page
│   ├── drive/page.tsx        # SLK tracking page (GPS)
│   ├── calibrate/page.tsx    # GPS calibration tool
│   └── api/
│       ├── roads/route.ts    # Road data, SLK coordinates
│       ├── gps/route.ts       # GPS to SLK conversion
│       ├── weather/route.ts   # Weather data (Open-Meteo)
│       ├── warnings/route.ts  # BOM weather warnings RSS feed
│       ├── traffic/route.ts   # Traffic volume data
│       ├── places/route.ts    # Nearby amenities (hospital, fuel, toilet)
│       ├── intersections/route.ts  # Cross road detection
│       └── admin-sync/route.ts     # MRWA direct sync
├── lib/
│   ├── offline-db.ts        # IndexedDB storage, signage corridor
│   ├── mrwa_api.ts          # MRWA ArcGIS API integration
│   ├── gps-ekf.ts           # Extended Kalman Filter for GPS
│   └── utils.ts             # Haversine distance calculation
├── hooks/
│   └── useGpsTracking.ts     # GPS tracking with EKF, speed zones
└── components/ui/            # shadcn components
```

---

## Data Sources

### Main Roads WA ArcGIS
| Layer | Data | URL Variable |
|-------|------|--------------|
| 17 | Road Network (has SLK geometry, region) | STATE_ROAD_URL |
| 8 | Speed Zones | SPEED_ZONE_URL |
| 15 | Rail Crossings | RAIL_CROSSING_URL |
| 22 | Regulatory Signs | REGULATORY_SIGNS_URL |
| 23 | Warning Signs | WARNING_SIGNS_URL |
| 18 | All Roads (for local roads) | ALL_ROADS_URL |

**Base URL:** `https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/Projects/RoadInfo/MapServer`

### External APIs
| Data | Source | Notes |
|------|--------|-------|
| Weather | Open-Meteo | Free, no API key |
| Weather Warnings | BOM RSS (IDZ00067) | WA land warnings, 5-min cache |
| Places/Amenities | Overpass API | OpenStreetMap |
| Traffic Volume | Static MRWA data | Pre-downloaded |

---

## Key Features

### GPS Calibration Tool (v5.3.0)
- New `/calibrate` page for measuring GPS lag
- Capture target position (stationary)
- Capture pass position (moving)
- Calculate lag time automatically
- Export results to CSV
- Apply lag compensation to speed zone lookahead

### Speed Zone Lookahead
- Shows upcoming speed zone changes BEFORE reaching the sign
- **Yellow border**: Speed DECREASE ahead (warning shown)
- **White border**: Current speed (no warning for increases)
- Uses GPS lag compensation for accurate timing
- Configurable lookahead time (default 5 seconds)

### Work Zone Lookup (`/` route)
1. Select region → road → SLK range
2. Get work zone coordinates
3. See TC positions (±100m from work zone)
4. View signage corridor (±700m for signs, ±100m for intersections)
5. Weather, traffic volume, nearby amenities
6. Navigate to Google Maps / Street View

### SLK Tracking (`/drive` route)
1. GPS tracking with EKF filtering
2. Real-time SLK display
3. Current speed vs speed limit
4. Speed zone lookahead (amber border = upcoming decrease)
5. Direction indicator (towards/away from destination)
6. Distance remaining and ETA
7. SLK calibration for accuracy tuning

---

## Settings (⚙️)

### GPS Calibration
- **Lag Compensation:** Applied to speed lookahead calculations
- Measured using calibration tool
- Stored in localStorage

### GPS Filtering (EKF)
| Setting | Default | Description |
|---------|---------|-------------|
| EKF Filtering | On | Kalman filter for smoother GPS |
| Road Constraint | On | Snap predictions to road geometry |
| Max Prediction Time | 30s | How long to predict during GPS outage |
| Show Uncertainty | On | Display ±Xm accuracy |
| Early Warnings | On | Alert earlier at higher speeds |

### Wind Gust Alert
| Setting | Default | Description |
|---------|---------|-------------|
| Threshold | 60 km/h | Alert when gusts exceed this |

---

## Recent Changes (v5.x)

### RC 1.0.2 - Bug Fix Release
- **Fixed road priority causing opposite problem**
  - Issue: RC 1.0.1 was preferring State Roads even when far away (e.g., 103m)
  - Fix: Priority now only applies as tiebreaker when distances are within 50m
  - If State Road is 103m away and Local Road is 20m away → Local Road is selected (correct)
  - If State Road is 50m away and Local Road is 45m away → State Road is selected (correct)
- **Added automatic data clearing before download**
  - IndexedDB is now cleared before downloading new data
  - Prevents corruption from partial/incomplete previous downloads
- Root cause of original issue was corrupt IndexedDB data, not priority logic

### RC 1.0.1 - Bug Fix Release
- **Fixed GPS tracking prioritizing Local Roads over State Roads**
  - Issue: GPS tracking was incorrectly matching nearby Local Roads instead of State Roads (M-roads, H-roads)
  - Root cause: `findRoadNearGps()` simply returned the closest road without considering road importance
  - Fix: Added `getRoadTypePriority()` function to prioritize State Roads over Local Roads
  - Priority order: State Roads (1) > Regional Roads (2) > Local Roads (3) > Miscellaneous (4)
  - Example: M031 at SLK 64.64 is now correctly matched instead of nearby Seabrook St
- Added `worklog.md` for tracking development history
- Updated documentation with road priority system details

### RC 1.0 - Release Candidate
- **Official Release Candidate for production deployment**
- All UI/UX finalized and documented
- Complete feature set for Traffic Controller work zone operations
- Documentation: 
  - TC_Work_Zone_Locator_RC1_Documentation.docx (Layout & Functionality)
  - TC_Work_Zone_Locator_Data_Sources.docx (Data Query Sources)

### v5.3.7
- **UI Improvements**
  - Local roads: Added manual road ID entry (no longer requires GPS lookup)
  - Drive page: Removed lookahead compensation message
  - Drive page: Removed Accuracy display from Current Location dialog

### v5.3.6
- **UI Improvements**
  - Changed "Back to Work Zone Locator" button from red to dark blue (consistency)
  - Updated on both drive and calibrate pages

### v5.3.5
- **UI Improvements**
  - Amenities dialog: Navigate/Street View buttons converted to small icon buttons
  - Signage Corridor: Intersections now filtered to ±100m from work zone (previously ±700m)
  - Signage Corridor: Removed Regulatory Signs section (clutter reduction)

### v5.3.4
- **UI Cosmetic Updates**
  - Changed "Start SLK Tracking" buttons from orange to dark blue
  - Work Zone Summary: Moved large buttons to small icon buttons right-justified
  - TC Positions: Moved large buttons to small icon buttons, removed coordinates
  - Cleaner, more compact layout

### v5.3.3
- **BOM Weather Warnings RSS Integration** (RESTORED)
  - Created `/api/warnings/route.ts` for BOM RSS feed fetching
  - Real-time WA land warnings from BOM RSS feed (IDZ00067)
  - Warnings displayed inline in Weather section with links
  - Warning count badge in Weather section header
  - 5-minute cache to avoid overloading BOM servers
- **Wind Gust Alert Threshold**
  - New setting to configure wind gust alert threshold (default 60 km/h)
  - Alert displayed when gusts exceed threshold
  - Important for traffic control device safety
  - Configurable threshold buttons: 40, 50, 60, 80 km/h
- **BOM Radar/Warnings Links**
  - Added quick links to BOM Radar and BOM Warnings pages
  - Links at bottom of Weather section for easy access
- **Weather Section Enhancements**
  - Wind gust value now highlighted amber when exceeding threshold
  - Better visual feedback for hazardous wind conditions

### v5.3.2
- **Bidirectional Speed Zone Detection**
  - Fixed speed zone lookahead to work in both SLK directions
  - Previously only detected speed decreases when traveling increasing SLK
  - Now correctly warns of speed decreases when traveling decreasing SLK too
  - Example: M031 SLK 67.64 has 60→90 (increasing) and 90→60 (decreasing) signs
  - Drivers approaching from either direction now get proper advance warning
- **SLK Direction Tracking**
  - Added `slkDirection` state to track 'increasing' or 'decreasing' travel
  - Display shows direction indicator (↑/↓) next to SLK value
  - Lookahead calculation uses appropriate zone boundary based on direction

### v5.3.1
- **Removed SLK Calibration Feature**
  - Removed per-road SLK offset calibration from drive page
  - SLK now displays raw GPS values without manual offset
  - Old `slkCalibrations` localStorage data cleared automatically
  - Simplified Tools menu - only Debug Info option remains
- **GPS Lag Calibration** (separate feature, kept)
  - GPS lag compensation at `/calibrate` for speed sign lookahead
  - This feature remains and is accessible from Settings menu

### v5.3.0
- **GPS Calibration Tool**
  - New `/calibrate` page for measuring GPS lag
  - Set target (stationary) and mark pass (moving)
  - Calculate lag time for speed lookahead compensation
  - Export calibration data to CSV
- **Speed Display Logic Update**
  - Yellow/amber border for approaching speed DECREASES only
  - White border for current speed or speed INCREASES
  - Shows upcoming speed limit in circle with distance countdown
- **Version Display** in app header

### v5.2.1
- **Manual Road ID Entry for Local Roads**
  - Local roads can now have road ID entered manually
  - No longer requires GPS lookup to use local roads

### v5.2.0
- **BOM Weather Warnings RSS Integration**
  - Real-time WA land warnings from BOM RSS feed (IDZ00067)
  - Warnings displayed inline in Weather section
  - Warning count badge in section header

### v5.1.x
- Track button color changes
- Intersection filtering fixes
- Speed zone lookahead feature
- EKF GPS filtering
- BOM radar/warnings links

---

## Environment Variables

None required - all APIs are free or use static data.

---

## Git Repository

`https://github.com/instructor-ship-it/roadfinder.git`

Branches: `master` and `main` (kept in sync)

---

## How to Update This File

After each development session:
1. Update version number if changed
2. Add entry to Recent Changes
3. Update any new features or settings
4. Commit and push to GitHub
