# TC Work Zone Locator - RC 1.2.1 Test Checklist

## Pre-Test Setup

- [ ] Clone repository: `git clone https://github.com/instructor-ship-it/roadfinder.git`
- [ ] Install dependencies: `bun install`
- [ ] Start dev server: `bun run dev`
- [ ] Open http://localhost:3000
- [ ] Click ⚙️ Settings icon
- [ ] Click "Download Data" and wait for completion (69K roads)

---

## Home Page Tests

### Region Selection
- [ ] Region dropdown shows all 8 MRWA regions
- [ ] "Local" option appears first with amber color
- [ ] Selecting a region populates the Road ID dropdown
- [ ] Default region setting persists after page reload

### Road Selection - State Roads
- [ ] Road ID dropdown is searchable
- [ ] Shows road_id in blue and road_name in white
- [ ] Shows "Valid SLK: X.X – Y.Y km" hint
- [ ] Roads from selected region only are shown

### Road Selection - Local Roads
- [ ] Selecting "Local" shows text input field
- [ ] Can manually type any road ID
- [ ] GPS lookup still works and auto-fills the field

### SLK Input
- [ ] Start SLK accepts decimal values (e.g., 100.50)
- [ ] End SLK accepts decimal values
- [ ] "Leave End SLK blank for single point lookup" hint shows

### Search Function
- [ ] "Get Work Zone Info" button disabled until road selected
- [ ] Search shows loading indicator
- [ ] Error message shown if SLK out of range

---

## Results Display Tests

### Work Zone Summary Section
- [ ] Road name displayed prominently
- [ ] Road ID with network type badge
- [ ] Start/End SLK shown in two columns
- [ ] Zone Length and Carriageway shown
- [ ] Three small icon buttons (Map/Home/Track) right-justified
- [ ] Map button opens Google Maps
- [ ] Home button opens Street View
- [ ] Track button navigates to /drive page

### Traffic Volume Section
- [ ] Collapsible (click header to expand/collapse)
- [ ] AADT displayed with "vehicles/day" label
- [ ] Peak Hour (est.) displayed
- [ ] Heavy Vehicle % displayed
- [ ] Data Year shown
- [ ] "Nearest count site: X km" shown if location provided
- [ ] Other nearby count sites listed

### Signage Corridor Section
- [ ] Collapsible
- [ ] Corridor bounds shown (±700m)
- [ ] INTERSECTIONS show only within ±100m of work zone
- [ ] SPEED RESTRICTION SIGNS listed
- [ ] WARNING SIGNS listed (curves, advisory speeds)
- [ ] Total items summary
- [ ] NO Regulatory Signs section (removed in RC 1.0)

### TC Positions Section
- [ ] Collapsible
- [ ] TC Start SLK shown (work zone start - 0.1 km)
- [ ] TC End SLK shown (work zone end + 0.1 km)
- [ ] Two small icon buttons per position
- [ ] Map button opens Google Maps navigation
- [ ] Home button opens Street View
- [ ] NO coordinates displayed (removed in RC 1.0)

### Weather Section
- [ ] Collapsible
- [ ] Location name from reverse geocoding
- [ ] Sunrise/Sunset times in 12-hour format
- [ ] Daylight hours duration
- [ ] UV Index with level description (Low/Moderate/High/Very High/Extreme)
- [ ] Current conditions: Temp, Condition, Wind, Gusts, Humidity
- [ ] Wind gusts highlighted amber if > threshold
- [ ] 8-hour forecast table
- [ ] BOM Radar link opens in new tab
- [ ] BOM Warnings link opens in new tab
- [ ] Weather warnings badge in header if warnings active
- [ ] Warning cards with clickable links

### Amenities Section
- [ ] Collapsible
- [ ] Hospital shown with:
  - [ ] Red hospital icon and name
  - [ ] "Emergency" badge if applicable
  - [ ] Phone number if available
  - [ ] Distance in km
  - [ ] Two small icon buttons (Navigate/Street View)
- [ ] Fuel Station shown with:
  - [ ] Yellow gas icon
  - [ ] Distance
  - [ ] Two small icon buttons
- [ ] Public Toilet shown with:
  - [ ] Blue toilet icon
  - [ ] Distance
  - [ ] Two small icon buttons

### Reset Button
- [ ] "Reset Work Zone Info" button appears after search
- [ ] Clicking it clears results and shows input form

---

## GPS Location Tests

### GPS Lookup
- [ ] "Find by GPS Location" section expands on click
- [ ] "Get My Location" button requests permission
- [ ] Location fetched and coordinates shown
- [ ] Road ID auto-filled if match found
- [ ] SLK auto-filled if match found
- [ ] Manual coordinate entry works

---

## SLK Tracking Tests (/drive)

### Page Load
- [ ] Version shows "RC 1.2.1"
- [ ] "EKF Filtering Active" shows in purple
- [ ] "Offline Ready" shows in green if data downloaded

### Tracking Controls
- [ ] "Start SLK Tracking" button is dark blue (bg-blue-800)
- [ ] Click starts GPS tracking
- [ ] Status shows "Active" with green dot
- [ ] "Back to Work Zone Locator" button is dark blue (bg-blue-800)
- [ ] Clicking back stops tracking and returns home

### Speed Display
- [ ] Current speed shown in large green text
- [ ] Speed turns red when over limit
- [ ] Speed limit shown in black circle
- [ ] Circle border amber if approaching speed decrease
- [ ] Circle border white for current speed or speed increases
- [ ] Circle border GREEN if in community-verified override zone
- [ ] Pulsating ✓ icon shows when in override zone
- [ ] "VERIFIED" label shows for override zones
- [ ] EKF status indicator shows:
  - [ ] Confidence dot (green/yellow/orange/cyan)
  - [ ] "High/Medium/Low/Predicted Confidence" text
  - [ ] "±X.XXm accuracy" text

### Current Location Section
- [ ] Road ID shown in green
- [ ] Road Name shown in white
- [ ] SLK shown in yellow with direction indicator (↑/↓)
- [ ] Road Type shown (State Road/Local Road)
- [ ] NO Accuracy row (removed in RC 1.0)

### Destination Section
- [ ] Shows when destination road differs from current road
- [ ] Target Road ID, Name, SLK displayed

### Direction Indicators
- [ ] Green when moving towards destination
- [ ] Red blinking when moving away
- [ ] Yellow when stationary
- [ ] SLK direction indicator (↑/↓) next to SLK

---

## GPS Calibration Tests (/calibrate)

### Page Load
- [ ] "Back to Work Zone Locator" button is dark blue
- [ ] Instructions displayed

### Calibration Process
- [ ] SET TARGET captures stationary position
- [ ] MARK PASS captures moving position
- [ ] Lag time calculated from SLK difference
- [ ] APPLY button saves to GPS settings
- [ ] EXPORT button generates CSV

---

## Speed Sign Override Tests (/overrides)

### Page Load
- [ ] Version shows "RC 1.2.1"
- [ ] Storage mode shows "Local Storage"
- [ ] Existing overrides displayed in table

### Add Override
- [ ] Form shows all fields:
  - [ ] Road ID (text input)
  - [ ] Road Name (text input)
  - [ ] SLK (number input)
  - [ ] Direction (True Left/True Right buttons)
  - [ ] Sign Type (Single/Double buttons)
  - [ ] Replicated (checkbox)
  - [ ] Start SLK (number input)
  - [ ] End SLK (number input)
  - [ ] Approach Speed (number input)
  - [ ] Front Speed (number input)
  - [ ] Back Speed (number input, double-sided only)
- [ ] Default direction is "True Left"
- [ ] Add button saves override
- [ ] New override appears in table

### Export/Import
- [ ] Export shows data in textarea (mobile-friendly)
- [ ] Copy to Clipboard button works
- [ ] Import from JSON file works

### Delete Override
- [ ] Delete button shows confirmation
- [ ] Confirm removes override from list

---

## Settings Dialog Tests

### Access
- [ ] ⚙️ icon in header opens dialog
- [ ] Green background if offline data ready

### Default Region
- [ ] Dropdown shows all regions
- [ ] Selection persists after page reload

### GPS Settings
- [ ] EKF Filtering toggle
- [ ] Road Constraint toggle
- [ ] Max Prediction Time slider
- [ ] Show Uncertainty toggle
- [ ] Early Warnings toggle
- [ ] Speed Lookahead Time setting
- [ ] GPS Lag Compensation setting

### Wind Gust Alert
- [ ] Threshold buttons (40/50/60/80 km/h)
- [ ] Selection persists

### Admin Data Sync
- [ ] MRWA Server Status shows record counts
- [ ] Local Data Status shows synced datasets
- [ ] Individual sync buttons for each dataset
- [ ] "Sync All from MRWA" button works
- [ ] Progress shown during sync

---

## Offline Data Tests

### Download
- [ ] Download button triggers data load
- [ ] Progress messages shown
- [ ] Success message with counts
- [ ] Gear icon turns green

### Offline Operation
- [ ] App works without internet after download
- [ ] Road search works
- [ ] SLK tracking works
- [ ] Speed zones display correctly

---

## Error Handling Tests

### Invalid SLK
- [ ] Error message for SLK out of range
- [ ] Error message for non-numeric SLK

### GPS Errors
- [ ] Permission denied message
- [ ] Position unavailable message
- [ ] Timeout message

### Network Errors
- [ ] Graceful degradation when APIs unavailable
- [ ] Offline data used when network fails

---

## Visual Regression Checks

### Colors
- [ ] Background: Dark navy (#111827)
- [ ] Cards: Slightly lighter (#1F2937)
- [ ] Primary buttons: Blue (#2563EB)
- [ ] Dark buttons: Dark blue (#1E40AF)
- [ ] Section headers: Blue text (#60A5FA)
- [ ] Warning text: Amber (#FBBF24)
- [ ] Override zone border: Green

### Button Sizes
- [ ] Small icon buttons: h-7 w-7
- [ ] Primary buttons: h-12
- [ ] All buttons have rounded corners

### Typography
- [ ] Road ID: Font mono, blue
- [ ] SLK values: Font mono, yellow
- [ ] Section headers: Bold, blue

---

## Final Checks

- [ ] Version displays "RC 1.2.1" on all pages
- [ ] No console errors in browser dev tools
- [ ] No TypeScript build errors
- [ ] All features documented in Word docs
- [ ] Code pushed to GitHub (master + main)

---

## Test Results

| Tester | Date | Result | Notes |
|--------|------|--------|-------|
| | | | |
| | | | |
| | | | |
