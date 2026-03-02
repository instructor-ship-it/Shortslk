# TC Work Zone Locator

A mobile-friendly web application for Traffic Controller (TC) work zone planning and real-time SLK (Straight Line Kilometre) tracking using Main Roads WA ArcGIS data.

## Features

### 🔧 Speed Zone Overrides (RC 1.0.3+)
- **Community-verified corrections** for MRWA speed zone data
- **Override management page** at `/overrides`
- **MRWA Exception Report generator** for reporting discrepancies
- GPS-verified sign locations with ±4m accuracy
- Automatic precedence over MRWA database when verified

### 📍 Work Zone Location Lookup
- Search roads by region and road ID
- Enter SLK (Start/End) to get work zone coordinates
- Get TC positions (±100m from work zone)
- View speed zones for the corridor
- See intersecting roads within the TC zone
- Navigate directly to Google Maps

### 📦 Offline SLK Tracking
- Download road data for offline use (no internet required)
- Real-time GPS-based SLK tracking
- Direction indicator (towards/away from target)
- Speed limit display from MRWA data
- Speed warning (turns red when over limit)
- SLK calibration for fine-tuning accuracy
- **EKF GPS Filtering** (v5.0+):
  - Extended Kalman Filter for optimal position accuracy
  - Position prediction during GPS outages (up to 60 seconds)
  - Road constraint for snapping predictions to road geometry
  - Uncertainty display (±X meters accuracy)
  - Configurable prediction timeout
- **Early Warnings** (v4.2+):
  - Alerts based on 3 seconds travel time at current speed

### 🗺️ Navigation Integration
- One-tap navigation to Google Maps
- Street View links for all locations
- Direct link to start SLK tracking from any result

### 🌤️ Weather & Traffic Data
- Current weather conditions at work zone
- Sunrise/sunset times and daylight hours
- UV index with safety levels
- 8-hour weather forecast
- Traffic volume (AADT) data

### 🏥 Nearby Amenities
- Nearest hospital with emergency status
- Fuel stations
- Public toilets
- Distance and navigation links

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- Modern web browser with Geolocation support

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the application.

### Production Build

```bash
bun run build
bun start
```

## Usage Guide

### Work Zone Lookup
1. Select a **Region** (e.g., Wheatbelt, Metropolitan)
2. Select a **Road ID** from the dropdown
3. Enter **Start SLK** (and optionally End SLK)
4. Click **"Get Work Zone Info"**
5. View results including TC positions, speed zones, weather, and nearby amenities

### GPS Location Lookup
1. Expand **"📍 Find by GPS Location"**
2. Click **"Get My Location"** or enter coordinates manually
3. The app will auto-fill the road and SLK based on your location

### Offline SLK Tracking
1. Click the **⚙️ setup icon** in the header
2. Click **"Download Data"** to store road data locally
3. Click **"📍 Start SLK Tracking"** to begin real-time tracking
4. The app works offline after downloading data

### Admin Data Sync (v4.1+)
For updating data without developer assistance:

1. Click the **⚙️ setup icon** in the header
2. Expand **"🔧 Admin Data Sync"** section
3. View **MRWA Server Status** (record counts available)
4. View **Local Data Status** (what's synced and when)
5. Click **"🔄 Sync All from MRWA"** or individual dataset buttons
6. Data downloads in 5,000-record chunks to prevent crashes
7. Signage is automatically filtered to speed/railway signs only
8. **Speed zones are automatically corrected** for default zones (v4.2+)

**Speed Zone Correction** (v4.2+):
- MRWA default zones (e.g., "50km/h in built-up areas or 110km/h outside") are intelligently corrected
- Built-up areas: 50 km/h (detected by adjacent zones ≤80 km/h)
- Rural areas: 110 km/h (detected by adjacent zones ≥90 km/h)
- Validates max 30 km/h speed drops per transition (Australian standard)
- Original MRWA text preserved in `raw_text` field for verification

**Note**: MRWA sync requires internet. Static files provide offline baseline.

#### SLK Calibration
If the SLK reading is inaccurate:
1. While tracking, tap **"🎯 Calibrate SLK"**
2. Enter the known correct SLK at your location
3. The offset is saved per-road for future use

### Direction Color Codes
- 🟢 **Green** - Moving towards target SLK
- 🔴 **Red (blinking)** - Moving away from target SLK
- 🟡 **Yellow** - Stationary

## Data Sources

- **Road Data**: Main Roads WA ArcGIS REST API
  - Layer 17: Road Network with SLK geometry AND region info (RA_NAME) for ALL roads
  - Layer 8: Speed Zones

### Offline Data

The app includes pre-downloaded road data for **69,471 roads** across all 8 MRWA regions:
- **Metropolitan**: 37,995 roads
- **South West**: 10,952 roads
- **Wheatbelt**: 7,895 roads
- **Great Southern**: 3,760 roads
- **Mid West-Gascoyne**: 3,707 roads
- **Pilbara**: 1,793 roads
- **Kimberley**: 1,132 roads
- **Other/Unknown**: 2,237 roads

Plus **69,455 speed zones** for accurate speed limit display.

**Speed Zone Overrides** (`/public/data/speed-overrides.json`):
- Community-verified corrections for MRWA data
- GPS-verified sign locations
- Currently includes M031 corrections (2024 road widening updates)

- **Weather**: Open-Meteo API
- **Traffic**: Main Roads WA Traffic Count Data
- **Amenities**: Overpass API (OpenStreetMap)

## Technical Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Offline Storage**: IndexedDB (client-side)
- **Maps**: Google Maps Links (no API key required)

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main work zone lookup page
│   ├── drive/page.tsx    # SLK tracking page
│   ├── overrides/page.tsx # Speed zone override management
│   └── api/              # API routes
│       ├── roads/        # Road data queries
│       ├── gps/          # GPS to SLK conversion
│       ├── sync-data/    # Offline data download
│       ├── weather/      # Weather data
│       ├── traffic/      # Traffic volume
│       ├── places/       # Nearby amenities
│       ├── intersections/# Cross road detection
│       └── admin-sync/   # MRWA direct sync
├── lib/
│   ├── offline-db.ts     # IndexedDB client-side storage
│   └── offline-data.ts   # Server-side data loading
└── components/ui/        # UI components
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/roads` | GET | List regions and roads |
| `/api/roads` | POST | Get SLK coordinates |
| `/api/gps` | GET | Convert GPS to SLK |
| `/api/sync-data` | POST | Download offline data |
| `/api/weather` | GET | Weather at coordinates |
| `/api/traffic` | GET | Traffic volume data |
| `/api/places` | GET | Nearby amenities |
| `/api/intersections` | GET | Cross roads in zone |
| `/api/admin-sync` | GET/POST | Sync data from MRWA |

## Browser Support

- Chrome (recommended)
- Safari
- Firefox
- Edge

**Note**: Geolocation requires HTTPS in production.

## Version History

### RC 1.0.3 (Current) - Speed Zone Override System
- **NEW: Speed Zone Override System** - Community-verified corrections for MRWA data
  - Override management page at `/overrides`
  - View all active overrides with MRWA comparison
  - Generate MRWA Exception Report for submitting discrepancies
  - GPS-verified sign locations with ±4m accuracy
- **Override precedence**: Community-verified overrides take priority over MRWA data
- **M031 corrections added**: 5 zones with verified sign locations after 2024 road widening
- Discrepancies range from 10m to 280m between MRWA database and physical signs

### RC 1.0 - Release Candidate
- **Official Release Candidate for production deployment**
- All UI/UX finalized and documented
- Complete feature set for Traffic Controller work zone operations

### v5.3.7
- **UI Improvements**:
  - Local roads: Added manual road ID entry (no longer requires GPS lookup)
  - Drive page: Removed lookahead compensation message
  - Drive page: Removed Accuracy display from Current Location dialog

### v5.3.6
- **UI Improvements**:
  - Changed "Back to Work Zone Locator" button from red to dark blue (consistency)
  - Updated on both drive and calibrate pages

### v5.3.5
- **UI Improvements**:
  - Amenities dialog: Navigate/Street View buttons converted to small icon buttons
  - Signage Corridor: Intersections now filtered to ±100m from work zone (previously ±700m)
  - Signage Corridor: Removed Regulatory Signs section (clutter reduction)

### v5.0.0
- **NEW: Extended Kalman Filter (EKF) GPS** - Complete GPS filtering rewrite:
  - **EKF Filtering**: Optimal Kalman filter for 50-60% accuracy improvement
  - **Position Prediction**: Continues tracking during GPS outages (10-60 seconds)
  - **Road Constraint**: Snaps predictions to road geometry for accuracy
  - **Uncertainty Display**: Shows ±X meters accuracy indicator
  - **Confidence Levels**: High ●, Medium ◐, Low ○, Predicted ◈
- **NEW: Haversine Distance Calculation**:
  - Meter-accurate distance between GPS coordinates
  - Replaced Euclidean approximations throughout
  - Eliminates ~1km error on 50km roads
- **Updated Settings**:
  - Removed: Position Interpolation, SLK Smoothing (now built into EKF)
  - Added: EKF Filtering toggle, Road Constraint, Prediction Timeout, Show Uncertainty
  - Kept: Early Warnings (separate feature)
- **New Files**: `src/lib/gps-ekf.ts`, `src/hooks/useGpsTracking.ts`

### v4.2.0
- **NEW: GPS Enhancements** - Three optional improvements for smoother tracking:
  - **Position Interpolation**: Estimates position between GPS updates using speed and heading (100ms updates)
  - **SLK Smoothing**: Weighted average of last 3 readings to reduce GPS jitter
  - **Early Warnings**: Alerts earlier at higher speeds (3 seconds travel time ahead)
  - Toggle all features in Settings menu
  - Active features shown in header: 🔄📊⚠️
- **NEW: Speed Zone Correction System** - Two-phase sync with proper default zone handling:
  - Server parses MRWA text (e.g., "50km/h applies in built up areas or 110km/h outside")
  - Client corrects based on adjacent zones (built-up = 50 km/h, rural = 110 km/h)
  - Validates max 30 km/h speed drops per transition (Australian standard)
  - Original MRWA text preserved for verification
- **Improved: Debug info** now includes GPS settings, SLK history, and GPS age

### v4.1.4
- **Fixed: Real-time progress display** - Shows "Fetching X of Y records..." during sync
- Uses Server-Sent Events (SSE) streaming for live progress updates
- No more "Starting..." stuck state

### v4.1.3
- **Fixed: Pagination** - MRWA limits to 2,000 records per request (not 5,000)
- Uses `resultOffset` for proper pagination

### v4.1.2
- **Fixed: MRWA server URL** - Uses `gisservices.mainroads.wa.gov.au` (not blocked)
- Previous server `mrgis.mainroads.wa.gov.au` was unreachable from some networks

### v4.1.1
- **Fixed: Error handling** - Graceful fallback when MRWA unreachable
- Connection status display (green = connected, amber = unreachable)
- Increased timeout to 60 seconds

### v4.1.0
- **NEW: Admin Data Sync Panel** - Sync data directly from MRWA servers
  - No developer assistance needed for data updates
  - Per-dataset sync controls (roads, speed zones, signage)
  - Automatic signage filtering (speed & railway signs only)
  - Sync metadata tracking (last sync date, record counts)
- **Hybrid data approach**: Static files for quick start + MRWA sync for fresh data
- **Dataset management**: View local data status, clear individual datasets

### v4.0
- **NEW: Signage Corridor Report** - Replaces Speed Zones section
  - Shows all signage within ±700m of work zone
  - Railway crossings with Public/Private type
  - Speed zone changes by carriageway (Left/Right/Single)
  - Regulatory signs (STOP, GIVE WAY, speed restrictions)
  - Warning signs (advisory speeds, curves, signals ahead, railway ahead)
- **New data layers downloaded**:
  - Layer 15: Rail Crossings
  - Layer 22: Signs Regulatory  
  - Layer 23: Signs Warning
- **Removed**: "Posted Speed Limit at Start SLK" dialog
- **Improved**: Download now shows counts for all data types

### v3.2.3
- **SLK precision fix**: SLK now correctly shows 3 decimal places when speed < 20 km/h
- **Accuracy in metres**: GPS accuracy displayed as ±Xm instead of ±0.00Xkm

### v3.2.2
- **GPS accuracy display**: Shows ±X.XXX km accuracy when speed < 20 km/h

### v3.2.1
- **Fix: Build error** - Fixed TypeScript error where currentSpeedKmh was used before declaration

### v3.2
- **Sticky road for speed zones**: Only uses speed zones from locked-in road
- **Look-ahead speed display**: Shows speed limit BEFORE reaching the sign

### v3.1
- **Searchable dropdowns**: Type to filter regions and roads
- **Larger distance display**: Distance remaining shows larger text when under 2km

### v3.0
- **Carriageway direction support**: Left = increasing SLK, Right = decreasing SLK
- **SLK stall fix**: Sticky road logic prevents losing track on H005
- **Event logging**: Troubleshooting info stored in localStorage
- **Direction flickering fix**: 3-reading confidence threshold
- **High precision mode**: Shows 3 decimal places when speed < 20 km/h

### v2.8.5
- **Tools menu on drive page**: Added 🔧 spanner icon with Generate Debug Info and Calibrate SLK options
- **Destination navigation**: Added Navigate and Street View buttons to destination info dialog
- **Equally spaced buttons**: All Navigate/Street View buttons now equal width with text labels
- **Export in Setup menu**: Export Report button moved to Settings (⚙️) dialog
- **Default region setting**: Users can set a default region in Settings that pre-selects on load

### v2.8.4
- **Hidden inputs during restore**: Inputs stay hidden while restoring work zone info
- **Persistent params**: Work zone params persist in sessionStorage until Reset is clicked
- **Multiple tracking sessions**: User can go back and forth between tracking and main page
- **Loading indicator**: Shows "Restoring work zone info..." during restore process
- Params only cleared when "Reset Work Zone Info" is clicked

### v2.8.3
- **Auto-restore work zone info**: Results automatically display when returning from SLK tracking
- **New `getWorkZoneInfo()` function**: Clean parameter-based architecture with `keepInfo` flag
- Parameters saved to sessionStorage, results fetched fresh on return
- No need to click "Get Work Zone Info" button after returning from tracking

### v2.8.2
- **Fixed state restoration bug**: Work zone info now correctly restores when returning from SLK tracking
- Added `isRestoring` ref to prevent `fetchRoads` from clearing selected road during state restore
- State persistence now works reliably with sessionStorage

### v2.8.1
- **Cleaner UI when results displayed**: GPS section, region, road ID, and SLK inputs are hidden when work zone results are shown
- **Reset button**: "Get Work Zone Info" changes to "Reset Work Zone Info" when results are displayed
- **State persistence**: Work zone info is maintained when returning from SLK tracking using sessionStorage
- No duplicate inputs - cleaner, more focused interface

### v2.8.0
- **UI Cleanup**: Replaced "Stop Tracking" button with "Back to Work Zone Locator" link on drive page
- **Cleaner interface**: "Start SLK Tracking" button on front page now hidden when results are displayed
- No duplicate tracking buttons - tracking button only appears in relevant context

### v2.7.9
- **Fixed speed limit timing**: Speed limit is now looked up AFTER GPS confirms current location
- Added useEffect that triggers speed lookup when roadInfo changes
- Removed duplicate speed logic - single source of truth for speed limit updates
- Speed limit now updates correctly while tracking without needing to stop/restart

### v2.7.8
- **Fixed speed limit logic**: Speed limit is now ALWAYS based on current GPS position, never on destination SLK
- Pre-loads speed zones for destination road (optimization) but doesn't set speed limit until GPS locks
- Correctly handles both scenarios: tracking with or without destination

### v2.7.7
- **Fixed speed limit using URL SLK**: Now uses the SLK from URL params immediately, not waiting for GPS-calibrated SLK
- Speed limit displays correctly as soon as page loads with road_id and slk parameters

### v2.7.6
- **Fixed speed limit display on page load**: Speed limit now shows immediately when opening SLK tracking from URL parameters
- No longer waits for GPS lock to display the correct posted speed limit
- Speed zones are loaded as soon as road_id is available from URL params

### v2.7.5
- **Fixed speed limit calculation**: Speed zones now correctly display the actual speed limit at your current SLK position
- Speed limits are now numeric values (e.g., 110 instead of "110km/h") for accurate comparison
- Posted limit display now correctly shows the speed limit from MRWA data based on current road ID and SLK

### v2.7.0
- **Complete WA road coverage**: 69,471 roads across all 8 MRWA regions
- **69,455 speed zones** for speed limit lookup
- Data sourced from Layer 17 (Road Network with RA_NAME for all roads)
- Static data files in `/public/data/` for reliable offline loading
- Updated status indicator shows "69K Roads • 8 Regions"

### v2.6.1
- **Major data improvement**: Now using Layer 17 which includes region (RA_NAME) for ALL roads
- **67,000+ roads** with correct MRWA region assignments
- **Local roads now included** with proper region mapping
- Fixed H005 showing only Metropolitan (now correctly spans Metro/Wheatbelt/Goldfields)
- Fixed M056 now correctly shows Wheatbelt region
- Local roads like Hovea Crescent in Wundowie now correctly show Wheatbelt/Northam

### v2.5.5
- Fixed TypeScript build error (parameter order)
- Region-based downloading (downloads one region at a time)
- Avoids Vercel timeout by fetching smaller chunks

### v2.5.4
- Region-based downloading (downloads one region at a time)
- Avoids Vercel timeout by fetching smaller chunks
- Better progress messages showing current region
- Continues with other regions if one fails

### v2.5.3
- Changed to client-side downloading (bypasses server restrictions)
- Downloads road data directly from browser to MRWA API
- Better progress messages during download
- Connection test before starting download

### v2.5.2
- Improved offline data download with timeout handling
- Added connectivity test before downloading
- Shows detailed error messages from API
- Smaller batch sizes for more reliable downloads
- Better error recovery during fetch

### v2.5.1
- Added setup icon (⚙️) for offline data download
- Added auto-start SLK tracking button
- Added Street View links to all navigation buttons
- Shows offline ready status indicator

### v2.5
- Client-side IndexedDB for true offline support
- SLK calibration per road
- Direction color coding (towards/away/static)
- Speed limit from MRWA data
- Speed warning indicator

### v2.4
- Weather and UV index integration
- Traffic volume data
- Nearby amenities

### v2.0
- Complete rewrite with Next.js App Router
- MRWA ArcGIS API integration
- Work zone calculation

## License

This project is for internal use by Traffic Controllers for work zone planning and navigation.

## Acknowledgments

- Main Roads Western Australia for providing open road data
- OpenStreetMap contributors for amenity data
- Open-Meteo for weather API
