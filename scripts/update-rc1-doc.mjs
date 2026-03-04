#!/usr/bin/env node
/**
 * Update RC1 Documentation to RC 1.2.1
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak } from 'docx';
import fs from 'fs';

const VERSION = 'RC 1.2.1';
const DATE = 'March 4, 2026';

const heading1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
const heading2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
const heading3 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } });
const p = (text) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 150 } });
const pBold = (text) => new Paragraph({ children: [new TextRun({ text, bold: true })], spacing: { after: 150 } });

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
      // Title Page
      new Paragraph({
        children: [new TextRun({ text: 'TC Work Zone Locator', bold: true, size: 56 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Release Candidate 1.2.1', bold: true, size: 36 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 150 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Complete Layout & Functionality Documentation', size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Version: ${VERSION}`, size: 24 })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: `Date: ${DATE}`, size: 24 })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Repository: https://github.com/instructor-ship-it/roadfinder', size: 22 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),

      // Table of Contents
      heading1('Table of Contents'),
      p('1. Overview'),
      p('2. Application Pages'),
      p('3. Color Scheme & Styling'),
      p('4. Home Page Layout'),
      p('5. Drive Page Layout'),
      p('6. Overrides Page Layout'),
      p('7. Calibrate Page Layout'),
      p('8. Settings Dialog'),
      p('9. Speed Sign Override System'),
      p('10. API Endpoints'),
      p('11. Version History'),

      new PageBreak(),

      // Section 1: Overview
      heading1('1. Overview'),
      p('TC Work Zone Locator is a mobile-first Progressive Web Application (PWA) designed for Traffic Controllers in Western Australia. The application provides real-time GPS-based SLK (Straight Line Kilometre) tracking, work zone location lookup, weather information, speed sign overrides, and offline capability for remote area operations.'),
      
      heading2('1.1 Key Features'),
      p('• Work zone location lookup by region, road, and SLK'),
      p('• Real-time GPS tracking with Extended Kalman Filter (EKF) smoothing'),
      p('• Speed zone lookahead with advance warning of speed changes'),
      p('• Community-verified speed sign override system'),
      p('• Offline capability with 69,000+ roads downloaded'),
      p('• Weather data, traffic volume, and nearby amenities'),
      p('• GPS lag calibration tool'),

      heading2('1.2 Technology Stack'),
      new Table({
        rows: [
          tableRow(['Technology', 'Description'], true),
          tableRow(['Framework', 'Next.js 15 with App Router']),
          tableRow(['Language', 'TypeScript']),
          tableRow(['Styling', 'Tailwind CSS with shadcn/ui']),
          tableRow(['Offline Storage', 'IndexedDB + localStorage']),
          tableRow(['GPS Filtering', 'Extended Kalman Filter (EKF)']),
          tableRow(['Maps', 'Google Maps Links (no API key)']),
        ],
      }),

      new PageBreak(),

      // Section 2: Application Pages
      heading1('2. Application Pages'),
      p('The application has four main pages:'),
      
      new Table({
        rows: [
          tableRow(['Page', 'Route', 'Purpose'], true),
          tableRow(['Home', '/', 'Work zone lookup interface']),
          tableRow(['Drive', '/drive', 'Real-time GPS tracking']),
          tableRow(['Overrides', '/overrides', 'Speed sign override management']),
          tableRow(['Calibrate', '/calibrate', 'GPS lag measurement']),
        ],
      }),

      new PageBreak(),

      // Section 3: Color Scheme
      heading1('3. Color Scheme & Styling'),
      
      heading2('3.1 Primary Colors'),
      new Table({
        rows: [
          tableRow(['Element', 'Tailwind Class', 'Hex Color'], true),
          tableRow(['Background', 'bg-gray-900', '#111827']),
          tableRow(['Cards', 'bg-gray-800', '#1F2937']),
          tableRow(['Primary Buttons', 'bg-blue-600', '#2563EB']),
          tableRow(['Dark Buttons', 'bg-blue-800', '#1E40AF']),
          tableRow(['Section Headers', 'text-blue-400', '#60A5FA']),
          tableRow(['Warning Text', 'text-amber-400', '#FBBF24']),
          tableRow(['Success Text', 'text-green-400', '#4ADE80']),
        ],
      }),

      heading2('3.2 Status Colors'),
      new Table({
        rows: [
          tableRow(['Status', 'Color', 'Meaning'], true),
          tableRow(['Direction: Towards', 'Green', 'Moving towards destination']),
          tableRow(['Direction: Away', 'Red pulsing', 'Moving away from destination']),
          tableRow(['Direction: Static', 'Yellow', 'Stationary']),
          tableRow(['Speed: Normal', 'Green', 'At or below limit']),
          tableRow(['Speed: Speeding', 'Red pulsing', 'Exceeding limit']),
          tableRow(['Override Zone', 'Green border + ✓', 'Community-verified zone']),
          tableRow(['Speed Decrease Ahead', 'Amber border', 'Approaching lower limit']),
        ],
      }),

      new PageBreak(),

      // Section 4: Home Page Layout
      heading1('4. Home Page Layout (/)'),
      
      heading2('4.1 Header Section'),
      p('• Application title: "TC Work Zone Locator"'),
      p('• Version display: "vRC 1.2.1"'),
      p('• Offline status indicator (green when data downloaded)'),
      p('• Settings gear icon (⚙️)'),

      heading2('4.2 Input Section'),
      p('• Region dropdown (8 MRWA regions + Local option)'),
      p('• Road ID dropdown (searchable) or text input (Local roads)'),
      p('• Start SLK input'),
      p('• End SLK input (optional)'),
      p('• "Get Work Zone Info" button'),

      heading2('4.3 Results Sections'),
      p('• Work Zone Summary - Road info, SLK range, navigation buttons'),
      p('• Traffic Volume - AADT, peak hour, heavy vehicle %'),
      p('• Signage Corridor - Intersections, speed signs, warning signs'),
      p('• TC Positions - Start/end positions with navigation'),
      p('• Weather - Current conditions, forecast, UV index'),
      p('• Amenities - Hospital, fuel station, toilet'),

      new PageBreak(),

      // Section 5: Drive Page Layout
      heading1('5. Drive Page Layout (/drive)'),
      
      heading2('5.1 Speed Display'),
      p('• Current speed in large green text (red if over limit)'),
      p('• Speed limit in circle with border:'),
      p('  - White: Current speed'),
      p('  - Amber: Approaching speed decrease'),
      p('  - Green + pulsing ✓: In override zone'),
      p('• EKF status indicator with confidence level'),

      heading2('5.2 Current Location Section'),
      p('• Road ID (green text)'),
      p('• Road Name (white text)'),
      p('• SLK with direction indicator ↑/↓ (yellow text)'),
      p('• Road Type (State Road/Local Road)'),

      heading2('5.3 Direction Indicators'),
      p('• Green: Moving towards destination'),
      p('• Red blinking: Moving away from destination'),
      p('• Yellow: Stationary'),

      new PageBreak(),

      // Section 6: Overrides Page Layout
      heading1('6. Overrides Page Layout (/overrides)'),
      
      heading2('6.1 Header'),
      p('• Version: "vRC 1.2.1"'),
      p('• Storage mode: "Local Storage"'),
      p('• Back to Work Zone Locator button'),

      heading2('6.2 Override Table'),
      p('Columns: ID, Road, SLK, Direction, Sign Type, Front Speed, Back Speed, Actions'),

      heading2('6.3 Add Override Form'),
      p('• Road ID (text input)'),
      p('• Road Name (text input)'),
      p('• SLK (number)'),
      p('• Direction: True Left / True Right buttons'),
      p('• Sign Type: Single / Double buttons'),
      p('• Replicated checkbox'),
      p('• Start SLK, End SLK'),
      p('• Approach Speed, Front Speed, Back Speed'),

      heading2('6.4 Actions'),
      p('• Export - Shows data in textarea for copy/paste'),
      p('• Import - Load from JSON file'),
      p('• Delete - Remove individual override'),
      p('• Clear All - Remove all overrides'),

      new PageBreak(),

      // Section 7: Calibrate Page
      heading1('7. Calibrate Page Layout (/calibrate)'),
      p('GPS lag calibration tool for speed sign lookahead accuracy.'),
      p('• SET TARGET - Capture stationary position'),
      p('• MARK PASS - Capture moving position'),
      p('• Calculate lag from SLK difference'),
      p('• APPLY - Save to GPS settings'),
      p('• EXPORT - Generate CSV report'),

      new PageBreak(),

      // Section 8: Settings Dialog
      heading1('8. Settings Dialog'),
      
      heading2('8.1 Default Region'),
      p('Dropdown to set default region for page load'),

      heading2('8.2 GPS Settings'),
      new Table({
        rows: [
          tableRow(['Setting', 'Default', 'Description'], true),
          tableRow(['EKF Filtering', 'On', 'Extended Kalman Filter for GPS']),
          tableRow(['Road Constraint', 'On', 'Snap predictions to road']),
          tableRow(['Max Prediction Time', '30s', 'GPS outage prediction limit']),
          tableRow(['Show Uncertainty', 'On', 'Display ±Xm accuracy']),
          tableRow(['Early Warnings', 'On', 'Alert earlier at higher speeds']),
          tableRow(['Speed Lookahead', '5s', 'Lookahead time for warnings']),
          tableRow(['GPS Lag Compensation', '0s', 'Measured lag offset']),
        ],
      }),

      heading2('8.3 Wind Gust Alert'),
      p('Threshold buttons: 40, 50, 60, 80 km/h'),

      new PageBreak(),

      // Section 9: Speed Sign Override System
      heading1('9. Speed Sign Override System'),
      
      heading2('9.1 Overview'),
      p('Community-verified corrections to MRWA speed zone data. Stored in localStorage, takes precedence over MRWA data.'),

      heading2('9.2 Sign Data Fields'),
      new Table({
        rows: [
          tableRow(['Field', 'Description'], true),
          tableRow(['direction', 'True Left (INCREASING SLK) or True Right (DECREASING SLK)']),
          tableRow(['sign_type', 'Single or Double sided']),
          tableRow(['replicated', 'Matching sign on opposite side?']),
          tableRow(['front_speed', 'Speed on face pointing in direction']),
          tableRow(['back_speed', 'Speed on opposite face (double only)']),
        ],
      }),

      heading2('9.3 Zone Generation'),
      new Table({
        rows: [
          tableRow(['Sign Type', 'Replicated', 'Zones Created'], true),
          tableRow(['Single', 'No', 'None (repeater only)']),
          tableRow(['Single', 'Yes', 'One directional zone']),
          tableRow(['Double', 'Same speeds', 'One Single carriageway zone']),
          tableRow(['Double', 'Diff speeds', 'Two directional zones']),
        ],
      }),

      new PageBreak(),

      // Section 10: API Endpoints
      heading1('10. API Endpoints'),
      
      new Table({
        rows: [
          tableRow(['Endpoint', 'Method', 'Description'], true),
          tableRow(['/api/roads', 'GET/POST', 'Road data, SLK coordinates']),
          tableRow(['/api/gps', 'GET', 'GPS to SLK conversion']),
          tableRow(['/api/weather', 'GET', 'Weather data (Open-Meteo)']),
          tableRow(['/api/warnings', 'GET', 'BOM weather warnings']),
          tableRow(['/api/traffic', 'GET', 'Traffic volume data']),
          tableRow(['/api/places', 'GET', 'Nearby amenities']),
          tableRow(['/api/intersections', 'GET', 'Cross road detection']),
          tableRow(['/api/admin-sync', 'GET/POST', 'MRWA direct sync']),
          tableRow(['/api/overrides', 'GET/POST', 'Override storage']),
          tableRow(['/api/speed-compare', 'GET', 'MRWA vs OSM comparison']),
          tableRow(['/api/osm-speed', 'GET', 'OSM speed limits']),
          tableRow(['/api/speed-verify', 'GET', 'Speed verification']),
          tableRow(['/api/speedlimit', 'GET', 'Speed limit lookup']),
          tableRow(['/api/download-signs', 'GET', 'Sign data download']),
          tableRow(['/api/export-pdf', 'POST', 'Report export']),
          tableRow(['/api/sync-data', 'POST', 'Offline data sync']),
        ],
      }),

      new PageBreak(),

      // Section 11: Version History
      heading1('11. Version History'),
      
      heading2('RC 1.2.1 (Current)'),
      p('• Override zone visual indicator (green border, pulsating ✓)'),
      p('• Fixed default sign direction bug'),

      heading2('RC 1.2.0'),
      p('• Fixed double-sided sign interpretation'),
      p('• Mobile export fix (copy/paste)'),
      p('• Merged context files'),

      heading2('RC 1.0.4'),
      p('• Sign-based override system'),

      heading2('RC 1.0.3'),
      p('• Override management page'),
      p('• MRWA Exception Report generator'),

      heading2('RC 1.0.2'),
      p('• Road priority as tiebreaker only'),

      heading2('RC 1.0.1'),
      p('• GPS tracking prioritization fix'),

      heading2('RC 1.0'),
      p('• Initial release candidate'),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('docs/TC_Work_Zone_Locator_RC1_Documentation.docx', buffer);
  console.log('✅ Updated: docs/TC_Work_Zone_Locator_RC1_Documentation.docx');
});
