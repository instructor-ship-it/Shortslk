#!/usr/bin/env node
/**
 * Generate TC Work Zone Locator User Manual
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak, LevelFormat } from 'docx';
import fs from 'fs';

const VERSION = 'RC 1.2.1';
const DATE = 'March 4, 2026';

const heading1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
const heading2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
const heading3 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } });
const p = (text) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 150 } });
const pBold = (text) => new Paragraph({ children: [new TextRun({ text, bold: true })], spacing: { after: 150 } });
const pItalic = (text) => new Paragraph({ children: [new TextRun({ text, italics: true })], spacing: { after: 150 } });
const bullet = (text, level = 0) => new Paragraph({
  children: [new TextRun(text)],
  spacing: { after: 100 },
  indent: { left: 720 + (level * 360) },
  bullet: { level },
});

const tableRow = (cells, isHeader = false) => new TableRow({
  children: cells.map(cellText => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: cellText, bold: isHeader })] })],
    width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
  })),
});

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      // ========== COVER PAGE ==========
      new Paragraph({ spacing: { after: 1000 } }),
      new Paragraph({
        children: [new TextRun({ text: 'TC Work Zone Locator', bold: true, size: 72 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'User Manual', bold: true, size: 48 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Version ${VERSION}`, size: 32 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: DATE, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'For Traffic Controllers in Western Australia', size: 24, italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'https://github.com/instructor-ship-it/roadfinder', size: 22 })],
        alignment: AlignmentType.CENTER,
      }),

      new PageBreak(),

      // ========== TABLE OF CONTENTS ==========
      heading1('Table of Contents'),
      p('1. Introduction'),
      p('2. Getting Started'),
      p('3. Offline Capability'),
      p('4. Home Page - Work Zone Lookup'),
      p('5. Drive Page - GPS Tracking'),
      p('6. Overrides Page - Speed Sign Corrections'),
      p('7. Calibrate Page - GPS Lag Measurement'),
      p('8. Settings'),
      p('9. Troubleshooting'),
      p('10. Quick Reference'),

      new PageBreak(),

      // ========== SECTION 1: INTRODUCTION ==========
      heading1('1. Introduction'),
      
      heading2('1.1 What is TC Work Zone Locator?'),
      p('TC Work Zone Locator is a mobile-first web application designed specifically for Traffic Controllers working on Western Australian roads. It helps you locate work zones, track your position in real-time, and know the speed limits for any location - even in remote areas without internet access.'),

      heading2('1.2 Key Features'),
      bullet('Work Zone Lookup - Find coordinates for any road by SLK (Straight Line Kilometre)'),
      bullet('Real-time GPS Tracking - Track your position with EKF smoothing for accuracy'),
      bullet('Speed Zone Display - See current speed limit with advance warning of changes'),
      bullet('Speed Sign Overrides - Record community-verified corrections to MRWA data'),
      bullet('Offline Operation - Works without internet after downloading data'),
      bullet('Signage Corridor - View all signage near your work zone'),
      bullet('Weather Integration - Current conditions and forecast when online'),

      heading2('1.3 Who Should Use This App'),
      p('This application is designed for Traffic Controllers in Western Australia who need to:'),
      bullet('Locate work zones on state and local roads'),
      bullet('Navigate to TC positions (±100m from work zone)'),
      bullet('Know speed limits for the road they are working on'),
      bullet('Record discrepancies between physical signs and MRWA database'),
      bullet('Work in remote areas without reliable internet'),

      new PageBreak(),

      // ========== SECTION 2: GETTING STARTED ==========
      heading1('2. Getting Started'),

      heading2('2.1 Accessing the Application'),
      p('Open your web browser and navigate to the application URL. The app works on any modern browser (Chrome, Safari, Firefox, Edge) on your phone, tablet, or computer.'),
      p('For best results, use Chrome on a mobile phone.'),

      heading2('2.2 First-Time Setup'),
      pBold('Step 1: Download Offline Data'),
      p('Before you can use the app offline, you must download the road data:'),
      bullet('Tap the ⚙️ (gear) icon in the top-right corner'),
      bullet('Tap "Download Data" button'),
      bullet('Wait for the download to complete (about 69,000 roads)'),
      bullet('The gear icon will turn green when ready'),

      pBold('Step 2: Set Your Default Region'),
      p('To save time, set your most commonly used region:'),
      bullet('In Settings (⚙️), find "Default Region"'),
      bullet('Select your region (e.g., Wheatbelt, Metropolitan)'),
      bullet('This region will be pre-selected each time you open the app'),

      pBold('Step 3: Enable Location Access'),
      p('When prompted, allow the app to access your location. This is required for:'),
      bullet('GPS-based road detection'),
      bullet('Real-time SLK tracking'),
      bullet('Speed limit display'),

      heading2('2.3 App Header'),
      p('The header shows important status information:'),
      bullet('Version number (e.g., vRC 1.2.1)'),
      bullet('Green status = Offline data ready'),
      bullet('Gear icon = Settings access'),

      new PageBreak(),

      // ========== SECTION 3: OFFLINE CAPABILITY ==========
      heading1('3. Offline Capability'),

      heading2('3.1 Does This App Work Offline?'),
      pBold('YES! The core features work 100% offline after downloading data.'),
      p('This is essential for Traffic Controllers working in remote areas of Western Australia where cell coverage is unreliable or non-existent.'),

      heading2('3.2 What Works Offline'),
      new Table({
        rows: [
          tableRow(['Feature', 'Storage', 'Offline?'], true),
          tableRow(['Work Zone Lookup', 'IndexedDB', '✅ Yes']),
          tableRow(['GPS Tracking', 'Device + IndexedDB', '✅ Yes']),
          tableRow(['SLK Position', 'Computed locally', '✅ Yes']),
          tableRow(['Speed Zones', 'IndexedDB + localStorage', '✅ Yes']),
          tableRow(['Speed Sign Overrides', 'localStorage', '✅ Yes']),
          tableRow(['Signage Corridor', 'IndexedDB', '✅ Yes']),
          tableRow(['TC Position Calculation', 'Computed locally', '✅ Yes']),
          tableRow(['Direction Detection', 'Computed from GPS', '✅ Yes']),
          tableRow(['Google Maps Links', 'Generated URLs', '✅ Yes']),
        ],
      }),

      heading2('3.3 What Requires Internet'),
      new Table({
        rows: [
          tableRow(['Feature', 'Source', 'Offline?'], true),
          tableRow(['Weather Data', 'Open-Meteo API', '❌ No']),
          tableRow(['BOM Weather Warnings', 'RSS Feed', '❌ No']),
          tableRow(['Nearby Amenities', 'Overpass API', '❌ No']),
          tableRow(['Traffic Volume', 'MRWA API', '❌ No']),
          tableRow(['Street View Images', 'Google Maps', '❌ No']),
        ],
      }),

      heading2('3.4 Data Storage'),
      pBold('IndexedDB (downloaded once):'),
      bullet('69,000+ roads with geometry'),
      bullet('Speed zones from MRWA'),
      bullet('Rail crossings'),
      bullet('Regulatory signs'),
      bullet('Warning signs'),

      pBold('localStorage (always available):'),
      bullet('Speed sign overrides (your corrections)'),
      bullet('GPS settings'),
      bullet('User preferences'),

      heading2('3.5 Tips for Remote Work'),
      bullet('Download data before leaving coverage area'),
      bullet('Test the app in coverage area first'),
      bullet('Weather and amenities sections will show "unavailable" offline'),
      bullet('All core TC functions work without internet'),

      new PageBreak(),

      // ========== SECTION 4: HOME PAGE ==========
      heading1('4. Home Page - Work Zone Lookup'),

      heading2('4.1 Overview'),
      p('The home page is where you look up work zone information. Select a road, enter SLK values, and get coordinates for your work zone and TC positions.'),

      heading2('4.2 Selecting a Road'),
      pBold('Option 1: Browse by Region'),
      bullet('Select a region from the dropdown (Wheatbelt, Metropolitan, etc.)'),
      bullet('Select a road ID from the searchable dropdown'),
      bullet('The road name and valid SLK range will be displayed'),

      pBold('Option 2: Local Roads'),
      bullet('Select "Local" from the region dropdown (amber colored)'),
      bullet('Enter the road ID manually (e.g., "L00123")'),
      bullet('Or use GPS to auto-detect your current road'),

      heading2('4.3 Entering SLK Values'),
      pBold('Start SLK (required):'),
      p('Enter the starting SLK of your work zone. Use decimal values if needed (e.g., 67.62).'),

      pBold('End SLK (optional):'),
      p('Leave blank for a single point lookup, or enter the end SLK for a work zone range.'),

      heading2('4.4 Using GPS Location'),
      p('Tap "Find by GPS Location" to auto-fill the road and SLK based on your current position:'),
      bullet('Tap "Get My Location"'),
      bullet('Grant location permission if prompted'),
      bullet('The app will auto-fill road ID and SLK'),

      heading2('4.5 Understanding Results'),
      pBold('Work Zone Summary:'),
      bullet('Road name and ID'),
      bullet('Start and End SLK'),
      bullet('Zone length in meters'),
      bullet('Carriageway type (Left, Right, Single)'),
      bullet('Navigation buttons (Maps, Street View, Track)'),

      pBold('Traffic Volume:'),
      bullet('Annual Average Daily Traffic (AADT)'),
      bullet('Peak hour volume estimate'),
      bullet('Heavy vehicle percentage'),

      pBold('Signage Corridor:'),
      bullet('Intersections within ±100m'),
      bullet('Speed restriction signs within ±700m'),
      bullet('Warning signs within ±700m'),
      bullet('Rail crossings'),

      pBold('TC Positions:'),
      bullet('TC Start: 100m before work zone'),
      bullet('TC End: 100m after work zone'),
      bullet('Navigation buttons for each position'),

      pBold('Weather (requires internet):'),
      bullet('Current temperature and conditions'),
      bullet('Wind speed and gusts'),
      bullet('UV index'),
      bullet('Sunrise/sunset times'),
      bullet('8-hour forecast'),

      pBold('Amenities (requires internet):'),
      bullet('Nearest hospital'),
      bullet('Nearest fuel station'),
      bullet('Nearest public toilet'),

      new PageBreak(),

      // ========== SECTION 5: DRIVE PAGE ==========
      heading1('5. Drive Page - GPS Tracking'),

      heading2('5.1 Overview'),
      p('The drive page provides real-time GPS tracking with SLK position, speed limit display, and advance warning of speed zone changes.'),

      heading2('5.2 Starting GPS Tracking'),
      bullet('From home page, tap the tracking icon (📍) next to your work zone'),
      bullet('Or tap "Start SLK Tracking" button'),
      bullet('Grant location permission if prompted'),
      bullet('The page will automatically start tracking'),

      heading2('5.3 Understanding the Display'),

      pBold('Speed Circle:'),
      bullet('Green = At or below speed limit'),
      bullet('Red = Exceeding speed limit'),
      bullet('Amber border = Speed decrease ahead'),
      bullet('Green border + ✓ = Community-verified zone'),

      pBold('Current Speed:'),
      p('Large green numbers show your current speed. Turns red when speeding.'),

      pBold('EKF Status:'),
      bullet('Green dot ● = High confidence'),
      bullet('Yellow dot ◐ = Medium confidence'),
      bullet('Orange dot ○ = Low confidence'),
      bullet('Cyan diamond ◈ = Predicted position (GPS outage)'),

      heading2('5.4 Current Location Section'),
      bullet('Road ID (green text)'),
      bullet('Road Name (white text)'),
      bullet('SLK with direction indicator ↑↓ (yellow text)'),
      bullet('Road Type (State Road, Local Road)'),

      heading2('5.5 Direction Indicators'),
      bullet('Green = Moving towards destination'),
      bullet('Red blinking = Moving away from destination'),
      bullet('Yellow = Stationary'),

      heading2('5.6 Speed Zone Lookahead'),
      p('The app warns you before reaching speed zone changes:'),
      bullet('Amber border appears when approaching a speed decrease'),
      bullet('Shows upcoming speed limit in the circle'),
      bullet('Distance countdown to the sign'),
      bullet('GPS lag compensation improves timing'),

      heading2('5.7 Community-Verified Zones'),
      p('When driving through an override zone:'),
      bullet('Speed circle has green border'),
      bullet('Pulsating ✓ icon appears'),
      bullet('"VERIFIED" label displayed'),
      bullet('"Community Verified Zone" text shown'),

      new PageBreak(),

      // ========== SECTION 6: OVERRIDES PAGE ==========
      heading1('6. Overrides Page - Speed Sign Corrections'),

      heading2('6.1 Why Override Speed Zones?'),
      p('Sometimes MRWA database doesn\'t match physical signs. This can happen after:'),
      bullet('Road works and sign relocations'),
      bullet('Recent speed limit changes'),
      bullet('Data entry errors'),
      p('The override system lets you record the correct speed limits based on field observation.'),

      heading2('6.2 Accessing Overrides'),
      p('Navigate to /overrides or use the link in Settings (⚙️).'),

      heading2('6.3 Adding a Speed Sign Override'),
      pBold('Required Fields:'),
      bullet('Road ID - e.g., M031'),
      bullet('Road Name - e.g., Northam Cranbrook Rd'),
      bullet('SLK - Location of the physical sign'),
      bullet('Direction - True Left (INCREASING SLK) or True Right (DECREASING SLK)'),
      bullet('Sign Type - Single or Double sided'),
      bullet('Replicated - Is there a matching sign on the opposite side?'),
      bullet('Start SLK - Where the zone begins'),
      bullet('End SLK - Where the zone ends'),
      bullet('Front Speed - Speed shown on the sign face'),
      bullet('Back Speed - For double-sided signs, speed on opposite face'),

      heading2('6.4 Direction Reference'),
      new Table({
        rows: [
          tableRow(['Direction', 'Carriageway', 'SLK Movement'], true),
          tableRow(['True Left', 'Left Carriageway', 'INCREASING SLK']),
          tableRow(['True Right', 'Right Carriageway', 'DECREASING SLK']),
        ],
      }),

      heading2('6.5 Exporting Overrides'),
      p('To backup or share your overrides:'),
      bullet('Tap "Export" button'),
      bullet('Data appears in a text area'),
      bullet('Tap "Copy to Clipboard"'),
      bullet('Paste into notes, email, or save as file'),

      heading2('6.6 Importing Overrides'),
      p('To restore overrides from a backup:'),
      bullet('Tap "Import" button'),
      bullet('Select a JSON file'),
      bullet('Overrides are merged with existing data'),

      new PageBreak(),

      // ========== SECTION 7: CALIBRATE PAGE ==========
      heading1('7. Calibrate Page - GPS Lag Measurement'),

      heading2('7.1 What is GPS Lag?'),
      p('GPS reports your position with a slight delay. This delay (typically 1-3 seconds) affects the accuracy of speed zone lookahead warnings. The calibration tool measures this delay so the app can compensate.'),

      heading2('7.2 How to Calibrate'),
      pBold('Step 1: Set Target (Stationary)'),
      bullet('Stand at a known location (e.g., a speed sign)'),
      bullet('Note the SLK of this location'),
      bullet('Tap "SET TARGET" while stationary'),

      pBold('Step 2: Mark Pass (Moving)'),
      bullet('Drive past the same location'),
      bullet('When you pass the sign, tap "MARK PASS" immediately'),
      bullet('Drive at normal speed for accurate measurement'),

      pBold('Step 3: Calculate and Apply'),
      bullet('The app calculates lag based on SLK difference'),
      bullet('Tap "APPLY" to save to GPS settings'),
      bullet('Lag compensation improves speed zone warnings'),

      heading2('7.3 When to Recalibrate'),
      bullet('If speed warnings seem early or late'),
      bullet('After changing phones'),
      bullet('Different vehicles may have different GPS receivers'),
      bullet('Typical lag is 1-3 seconds'),

      new PageBreak(),

      // ========== SECTION 8: SETTINGS ==========
      heading1('8. Settings'),

      p('Access settings by tapping the ⚙️ gear icon in the header.'),

      heading2('8.1 Default Region'),
      p('Pre-selects your region when opening the app. Choose the region you work in most often.'),

      heading2('8.2 GPS Settings'),
      new Table({
        rows: [
          tableRow(['Setting', 'Default', 'Description'], true),
          tableRow(['EKF Filtering', 'On', 'Kalman filter for smoother GPS']),
          tableRow(['Road Constraint', 'On', 'Snap predictions to road']),
          tableRow(['Max Prediction Time', '30s', 'GPS outage prediction limit']),
          tableRow(['Show Uncertainty', 'On', 'Display ±Xm accuracy']),
          tableRow(['Early Warnings', 'On', 'Alert earlier at higher speeds']),
          tableRow(['Speed Lookahead', '5s', 'Lookahead time for warnings']),
          tableRow(['GPS Lag Compensation', '0s', 'Measured lag offset']),
        ],
      }),

      heading2('8.3 Wind Gust Alert'),
      p('Set threshold for wind gust warnings. Default is 60 km/h. Choose from 40, 50, 60, or 80 km/h buttons.'),

      heading2('8.4 Offline Data'),
      pBold('Download Data:'),
      p('Downloads all road data to your device. Required before offline use.'),

      pBold('Clear Data:'),
      p('Removes all offline data. Use if you want to re-download fresh data.'),

      heading2('8.5 Admin Data Sync'),
      p('For advanced users - sync fresh data from MRWA servers when online.'),

      new PageBreak(),

      // ========== SECTION 9: TROUBLESHOOTING ==========
      heading1('9. Troubleshooting'),

      heading2('9.1 App Shows Wrong Road'),
      p('If GPS is detecting the wrong road:'),
      bullet('Make sure offline data is downloaded (green gear icon)'),
      bullet('Check GPS accuracy - low confidence indicates poor signal'),
      bullet('Try clearing and re-downloading data'),
      bullet('For local roads, use manual entry instead of GPS'),

      heading2('9.2 Speed Limit Incorrect'),
      p('If speed limit doesn\'t match physical signs:'),
      bullet('MRWA data may be outdated'),
      bullet('Add an override in the Overrides page'),
      bullet('Record the physical sign details'),
      bullet('Override will take precedence over MRWA data'),

      heading2('9.3 GPS Not Working'),
      p('If GPS tracking won\'t start:'),
      bullet('Check location permissions in browser settings'),
      bullet('Make sure you\'re not in a building or underground'),
      bullet('Wait for GPS signal (can take 30+ seconds)'),
      bullet('Try refreshing the page'),

      heading2('9.4 Data Won\'t Download'),
      p('If download fails:'),
      bullet('Check your internet connection'),
      bullet('Clear browser cache and try again'),
      bullet('Try a different browser'),
      bullet('Check available storage on device'),

      heading2('9.5 App Slow or Unresponsive'),
      p('If app is running slowly:'),
      bullet('Close other browser tabs'),
      bullet('Clear browser cache'),
      bullet('Restart the browser'),
      bullet('Check device storage'),

      heading2('9.6 Speed Warnings Too Early/Late'),
      p('If lookahead timing seems off:'),
      bullet('Use the Calibrate page to measure GPS lag'),
      bullet('Apply the measured lag compensation'),
      bullet('Recalibrate if you change devices'),

      new PageBreak(),

      // ========== SECTION 10: QUICK REFERENCE ==========
      heading1('10. Quick Reference'),

      heading2('10.1 Direction Terminology'),
      new Table({
        rows: [
          tableRow(['Term', 'Meaning', 'SLK Direction'], true),
          tableRow(['True Left', 'Left Carriageway', 'INCREASING SLK']),
          tableRow(['True Right', 'Right Carriageway', 'DECREASING SLK']),
        ],
      }),

      heading2('10.2 Status Colors'),
      new Table({
        rows: [
          tableRow(['Color', 'Meaning'], true),
          tableRow(['Green text', 'At/below speed limit, moving towards destination']),
          tableRow(['Red text', 'Exceeding speed limit, moving away from destination']),
          tableRow(['Yellow text', 'Stationary']),
          tableRow(['Amber border', 'Speed decrease ahead']),
          tableRow(['Green border + ✓', 'Community-verified override zone']),
        ],
      }),

      heading2('10.3 EKF Confidence Indicators'),
      new Table({
        rows: [
          tableRow(['Symbol', 'Confidence'], true),
          tableRow(['● Green dot', 'High accuracy']),
          tableRow(['◐ Yellow dot', 'Medium accuracy']),
          tableRow(['○ Orange dot', 'Low accuracy']),
          tableRow(['◈ Cyan diamond', 'Predicted position (GPS outage)']),
        ],
      }),

      heading2('10.4 Key Distances'),
      new Table({
        rows: [
          tableRow(['Feature', 'Distance'], true),
          tableRow(['TC Positions', '±100m from work zone']),
          tableRow(['Signage Corridor', '±700m from work zone']),
          tableRow(['Intersection Display', '±100m from work zone']),
          tableRow(['Speed Sign Detection', '±700m from work zone']),
        ],
      }),

      heading2('10.5 Offline Data Summary'),
      new Table({
        rows: [
          tableRow(['Data Type', 'Count'], true),
          tableRow(['Roads', '69,000+']),
          tableRow(['Speed Zones', '69,000+']),
          tableRow(['Regions', '8 MRWA regions']),
        ],
      }),

      heading2('10.6 Keyboard Shortcuts (Desktop)'),
      p('When using on a computer:'),
      bullet('Enter - Submit form / Start search'),
      bullet('Tab - Move between fields'),
      bullet('Escape - Close dialogs'),

      new PageBreak(),

      // ========== APPENDIX ==========
      heading1('Appendix: Glossary'),

      heading2('SLK (Straight Line Kilometre)'),
      p('A linear reference system used to identify locations along a road. SLK values increase from one end of the road to the other.'),

      heading2('True Left / True Right'),
      p('Direction terminology for Western Australian roads. True Left = traffic travelling INCREASING SLK. True Right = traffic travelling DECREASING SLK.'),

      heading2('EKF (Extended Kalman Filter)'),
      p('An algorithm that smooths GPS position data for more accurate tracking, especially useful during GPS signal fluctuations.'),

      heading2('Override'),
      p('A user-recorded correction to MRWA speed zone data, based on physical sign observation.'),

      heading2('IndexedDB'),
      p('Browser database that stores road data locally on your device for offline access.'),

      heading2('localStorage'),
      p('Browser storage for user preferences and speed sign overrides.'),

      heading2('MRWA'),
      p('Main Roads Western Australia - the government authority that manages WA roads and provides road data.'),

    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('docs/TC_Work_Zone_Locator_User_Manual.docx', buffer);
  console.log('✅ Created: docs/TC_Work_Zone_Locator_User_Manual.docx');
});
