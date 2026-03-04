# TC SLK - User Manual

**Version:** RC 1.2.1  
**Date:** March 4, 2026  
**For:** Traffic Controllers in Western Australia

---

## Table of Contents

1. Introduction
2. Getting Started
3. Offline Capability
4. Home Page - Work Zone Lookup
5. Drive Page - GPS Tracking
6. Overrides Page - Speed Sign Corrections
7. Calibrate Page - GPS Lag Measurement
8. Settings
9. Troubleshooting
10. Quick Reference

---

## 1. Introduction

### 1.1 What is TC SLK?

TC SLK is a mobile-first web application designed specifically for Traffic Controllers working on Western Australian roads. It helps you locate work zones, track your position in real-time, and know the speed limits for any location - even in remote areas without internet access.

### 1.2 Key Features

- **Work Zone Lookup** - Find coordinates for any road by SLK (Straight Line Kilometre)
- **Real-time GPS Tracking** - Track your position with EKF smoothing for accuracy
- **Speed Zone Display** - See current speed limit with advance warning of changes
- **Speed Sign Overrides** - Record community-verified corrections to MRWA data
- **Offline Operation** - Works without internet after downloading data
- **Signage Corridor** - View all signage near your work zone
- **Weather Integration** - Current conditions and forecast when online

### 1.3 Who Should Use This App

This application is designed for Traffic Controllers in Western Australia who need to:

- Locate work zones on state and local roads
- Navigate to TC positions (±100m from work zone)
- Know speed limits for the road they are working on
- Record discrepancies between physical signs and MRWA database
- Work in remote areas without reliable internet

---

## 2. Getting Started

### 2.1 Accessing the Application

Open your web browser and navigate to the application URL. The app works on any modern browser (Chrome, Safari, Firefox, Edge) on your phone, tablet, or computer.

**For best results, use Chrome on a mobile phone.**

### 2.2 First-Time Setup

**Step 1: Download Offline Data**

Before you can use the app offline, you must download the road data:

1. Tap the ⚙️ (gear) icon in the top-right corner
2. Tap "Download Data" button
3. Wait for the download to complete (about 69,000 roads)
4. The gear icon will turn green when ready

**Step 2: Set Your Default Region**

To save time, set your most commonly used region:

1. In Settings (⚙️), find "Default Region"
2. Select your region (e.g., Wheatbelt, Metropolitan)
3. This region will be pre-selected each time you open the app

**Step 3: Enable Location Access**

When prompted, allow the app to access your location. This is required for:

- GPS-based road detection
- Real-time SLK tracking
- Speed limit display

### 2.3 App Header

The header shows important status information:

- Version number (e.g., vRC 1.2.1)
- Green status = Offline data ready
- Gear icon = Settings access

---

## 3. Offline Capability

### 3.1 Does This App Work Offline?

**YES! The core features work 100% offline after downloading data.**

This is essential for Traffic Controllers working in remote areas of Western Australia where cell coverage is unreliable or non-existent.

### 3.2 What Works Offline

| Feature | Storage | Offline? |
|---------|---------|----------|
| Work Zone Lookup | IndexedDB | ✅ Yes |
| GPS Tracking | Device + IndexedDB | ✅ Yes |
| SLK Position | Computed locally | ✅ Yes |
| Speed Zones | IndexedDB + localStorage | ✅ Yes |
| Speed Sign Overrides | localStorage | ✅ Yes |
| Signage Corridor | IndexedDB | ✅ Yes |
| TC Position Calculation | Computed locally | ✅ Yes |
| Direction Detection | Computed from GPS | ✅ Yes |
| Google Maps Links | Generated URLs | ✅ Yes |

### 3.3 What Requires Internet

| Feature | Source | Offline? |
|---------|--------|----------|
| Weather Data | Open-Meteo API | ❌ No |
| BOM Weather Warnings | RSS Feed | ❌ No |
| Nearby Amenities | Overpass API | ❌ No |
| Traffic Volume | MRWA API | ❌ No |
| Street View Images | Google Maps | ❌ No |

### 3.4 Data Storage

**IndexedDB (downloaded once):**
- 69,000+ roads with geometry
- Speed zones from MRWA
- Rail crossings
- Regulatory signs
- Warning signs

**localStorage (always available):**
- Speed sign overrides (your corrections)
- GPS settings
- User preferences

### 3.5 Tips for Remote Work

- Download data before leaving coverage area
- Test the app in coverage area first
- Weather and amenities sections will show "unavailable" offline
- All core TC functions work without internet

---

## 4. Home Page - Work Zone Lookup

### 4.1 Overview

The home page is where you look up work zone information. Select a road, enter SLK values, and get coordinates for your work zone and TC positions.

### 4.2 Selecting a Road

**Option 1: Browse by Region**

1. Select a region from the dropdown (Wheatbelt, Metropolitan, etc.)
2. Select a road ID from the searchable dropdown
3. The road name and valid SLK range will be displayed

**Option 2: Local Roads**

1. Select "Local" from the region dropdown (amber colored)
2. Enter the road ID manually (e.g., "L00123")
3. Or use GPS to auto-detect your current road

### 4.3 Entering SLK Values

**Start SLK (required):**
Enter the starting SLK of your work zone. Use decimal values if needed (e.g., 67.62).

**End SLK (optional):**
Leave blank for a single point lookup, or enter the end SLK for a work zone range.

### 4.4 Using GPS Location

Tap "Find by GPS Location" to auto-fill the road and SLK based on your current position:

1. Tap "Get My Location"
2. Grant location permission if prompted
3. The app will auto-fill road ID and SLK

### 4.5 Understanding Results

**Work Zone Summary:**
- Road name and ID
- Start and End SLK
- Zone length in meters
- Carriageway type (Left, Right, Single)
- Navigation buttons (Maps, Street View, Track)

**Traffic Volume:**
- Annual Average Daily Traffic (AADT)
- Peak hour volume estimate
- Heavy vehicle percentage

**Signage Corridor:**
- Intersections within ±100m
- Speed restriction signs within ±700m
- Warning signs within ±700m
- Rail crossings

**TC Positions:**
- TC Start: 100m before work zone
- TC End: 100m after work zone
- Navigation buttons for each position

**Weather (requires internet):**
- Current temperature and conditions
- Wind speed and gusts
- UV index
- Sunrise/sunset times
- 8-hour forecast

**Amenities (requires internet):**
- Nearest hospital
- Nearest fuel station
- Nearest public toilet

---

## 5. Drive Page - GPS Tracking

### 5.1 Overview

The drive page provides real-time GPS tracking with SLK position, speed limit display, and advance warning of speed zone changes.

### 5.2 Starting GPS Tracking

1. From home page, tap the tracking icon (📍) next to your work zone
2. Or tap "Start SLK Tracking" button
3. Grant location permission if prompted
4. The page will automatically start tracking

### 5.3 Understanding the Display

**Speed Circle:**
- Green = At or below speed limit
- Red = Exceeding speed limit
- Amber border = Speed decrease ahead
- Green border + ✓ = Community-verified zone

**Current Speed:**
Large green numbers show your current speed. Turns red when speeding.

**EKF Status:**
- Green dot ● = High confidence
- Yellow dot ◐ = Medium confidence
- Orange dot ○ = Low confidence
- Cyan diamond ◈ = Predicted position (GPS outage)

### 5.4 Current Location Section

- Road ID (green text)
- Road Name (white text)
- SLK with direction indicator ↑↓ (yellow text)
- Road Type (State Road, Local Road)

### 5.5 Direction Indicators

- Green = Moving towards destination
- Red blinking = Moving away from destination
- Yellow = Stationary

### 5.6 Speed Zone Lookahead

The app warns you before reaching speed zone changes:

- Amber border appears when approaching a speed decrease
- Shows upcoming speed limit in the circle
- Distance countdown to the sign
- GPS lag compensation improves timing

### 5.7 Community-Verified Zones

When driving through an override zone:

- Speed circle has green border
- Pulsating ✓ icon appears
- "VERIFIED" label displayed
- "Community Verified Zone" text shown

---

## 6. Overrides Page - Speed Sign Corrections

### 6.1 Why Override Speed Zones?

Sometimes MRWA database doesn't match physical signs. This can happen after:

- Road works and sign relocations
- Recent speed limit changes
- Data entry errors

The override system lets you record the correct speed limits based on field observation.

### 6.2 Accessing Overrides

Navigate to /overrides or use the link in Settings (⚙️).

### 6.3 Adding a Speed Sign Override

**Required Fields:**

- **Road ID** - e.g., M031
- **Road Name** - e.g., Northam Cranbrook Rd
- **SLK** - Location of the physical sign
- **Direction** - True Left (INCREASING SLK) or True Right (DECREASING SLK)
- **Sign Type** - Single or Double sided
- **Replicated** - Is there a matching sign on the opposite side?
- **Start SLK** - Where the zone begins
- **End SLK** - Where the zone ends
- **Front Speed** - Speed shown on the sign face
- **Back Speed** - For double-sided signs, speed on opposite face

### 6.4 Direction Reference

| Direction | Carriageway | SLK Movement |
|-----------|-------------|--------------|
| True Left | Left Carriageway | INCREASING SLK |
| True Right | Right Carriageway | DECREASING SLK |

### 6.5 Exporting Overrides

To backup or share your overrides:

1. Tap "Export" button
2. Data appears in a text area
3. Tap "Copy to Clipboard"
4. Paste into notes, email, or save as file

### 6.6 Importing Overrides

To restore overrides from a backup:

1. Tap "Import" button
2. Select a JSON file
3. Overrides are merged with existing data

---

## 7. Calibrate Page - GPS Lag Measurement

### 7.1 What is GPS Lag?

GPS reports your position with a slight delay. This delay (typically 1-3 seconds) affects the accuracy of speed zone lookahead warnings. The calibration tool measures this delay so the app can compensate.

### 7.2 How to Calibrate

**Step 1: Set Target (Stationary)**

1. Stand at a known location (e.g., a speed sign)
2. Note the SLK of this location
3. Tap "SET TARGET" while stationary

**Step 2: Mark Pass (Moving)**

1. Drive past the same location
2. When you pass the sign, tap "MARK PASS" immediately
3. Drive at normal speed for accurate measurement

**Step 3: Calculate and Apply**

1. The app calculates lag based on SLK difference
2. Tap "APPLY" to save to GPS settings
3. Lag compensation improves speed zone warnings

### 7.3 When to Recalibrate

- If speed warnings seem early or late
- After changing phones
- Different vehicles may have different GPS receivers
- Typical lag is 1-3 seconds

---

## 8. Settings

Access settings by tapping the ⚙️ gear icon in the header.

### 8.1 Default Region

Pre-selects your region when opening the app. Choose the region you work in most often.

### 8.2 GPS Settings

| Setting | Default | Description |
|---------|---------|-------------|
| EKF Filtering | On | Kalman filter for smoother GPS |
| Road Constraint | On | Snap predictions to road |
| Max Prediction Time | 30s | GPS outage prediction limit |
| Show Uncertainty | On | Display ±Xm accuracy |
| Early Warnings | On | Alert earlier at higher speeds |
| Speed Lookahead | 5s | Lookahead time for warnings |
| GPS Lag Compensation | 0s | Measured lag offset |

### 8.3 Wind Gust Alert

Set threshold for wind gust warnings. Default is 60 km/h. Choose from 40, 50, 60, or 80 km/h buttons.

### 8.4 Offline Data

**Download Data:**
Downloads all road data to your device. Required before offline use.

**Clear Data:**
Removes all offline data. Use if you want to re-download fresh data.

### 8.5 Admin Data Sync

For advanced users - sync fresh data from MRWA servers when online.

---

## 9. Troubleshooting

### 9.1 App Shows Wrong Road

If GPS is detecting the wrong road:

- Make sure offline data is downloaded (green gear icon)
- Check GPS accuracy - low confidence indicates poor signal
- Try clearing and re-downloading data
- For local roads, use manual entry instead of GPS

### 9.2 Speed Limit Incorrect

If speed limit doesn't match physical signs:

- MRWA data may be outdated
- Add an override in the Overrides page
- Record the physical sign details
- Override will take precedence over MRWA data

### 9.3 GPS Not Working

If GPS tracking won't start:

- Check location permissions in browser settings
- Make sure you're not in a building or underground
- Wait for GPS signal (can take 30+ seconds)
- Try refreshing the page

### 9.4 Data Won't Download

If download fails:

- Check your internet connection
- Clear browser cache and try again
- Try a different browser
- Check available storage on device

### 9.5 App Slow or Unresponsive

If app is running slowly:

- Close other browser tabs
- Clear browser cache
- Restart the browser
- Check device storage

### 9.6 Speed Warnings Too Early/Late

If lookahead timing seems off:

- Use the Calibrate page to measure GPS lag
- Apply the measured lag compensation
- Recalibrate if you change devices

---

## 10. Quick Reference

### 10.1 Direction Terminology

| Term | Meaning | SLK Direction |
|------|---------|---------------|
| True Left | Left Carriageway | INCREASING SLK |
| True Right | Right Carriageway | DECREASING SLK |

### 10.2 Status Colors

| Color | Meaning |
|-------|---------|
| Green text | At/below speed limit, moving towards destination |
| Red text | Exceeding speed limit, moving away from destination |
| Yellow text | Stationary |
| Amber border | Speed decrease ahead |
| Green border + ✓ | Community-verified override zone |

### 10.3 EKF Confidence Indicators

| Symbol | Confidence |
|--------|------------|
| ● Green dot | High accuracy |
| ◐ Yellow dot | Medium accuracy |
| ○ Orange dot | Low accuracy |
| ◈ Cyan diamond | Predicted position (GPS outage) |

### 10.4 Key Distances

| Feature | Distance |
|---------|----------|
| TC Positions | ±100m from work zone |
| Signage Corridor | ±700m from work zone |
| Intersection Display | ±100m from work zone |
| Speed Sign Detection | ±700m from work zone |

### 10.5 Offline Data Summary

| Data Type | Count |
|-----------|-------|
| Roads | 69,000+ |
| Speed Zones | 69,000+ |
| Regions | 8 MRWA regions |

### 10.6 Keyboard Shortcuts (Desktop)

When using on a computer:

- **Enter** - Submit form / Start search
- **Tab** - Move between fields
- **Escape** - Close dialogs

---

## Appendix: Glossary

**SLK (Straight Line Kilometre)** - A linear reference system used to identify locations along a road. SLK values increase from one end of the road to the other.

**True Left / True Right** - Direction terminology for Western Australian roads. True Left = traffic travelling INCREASING SLK. True Right = traffic travelling DECREASING SLK.

**EKF (Extended Kalman Filter)** - An algorithm that smooths GPS position data for more accurate tracking, especially useful during GPS signal fluctuations.

**Override** - A user-recorded correction to MRWA speed zone data, based on physical sign observation.

**IndexedDB** - Browser database that stores road data locally on your device for offline access.

**localStorage** - Browser storage for user preferences and speed sign overrides.

**MRWA** - Main Roads Western Australia - the government authority that manages WA roads and provides road data.

---

*End of User Manual*
