#!/usr/bin/env node
/**
 * Update Procedures & Functions to RC 1.2.1
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak } from 'docx';
import fs from 'fs';

const heading1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
const heading2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
const p = (text) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 150 } });

const tableRow = (cells, isHeader = false) => new TableRow({
  children: cells.map(cellText => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: cellText, bold: isHeader })] })],
    width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
  })),
});

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ children: [new TextRun({ text: 'TC Work Zone Locator', bold: true, size: 48 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Procedures & Functions Reference', bold: true, size: 36 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Version RC 1.2.1', size: 28 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Complete API Reference for All Modules', size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }),

      heading1('1. Utility Functions (src/lib/utils.ts)'),
      
      heading2('haversineDistance(lat1, lon1, lat2, lon2)'),
      p('Returns distance between two GPS coordinates in meters.'),
      p('Parameters: lat1, lon1 (point 1), lat2, lon2 (point 2)'),
      p('Returns: number (distance in meters)'),

      new PageBreak(),

      heading1('2. IndexedDB Functions (src/lib/offline-db.ts)'),
      
      heading2('2.1 Database Initialization'),
      p('initDB() - Initialize IndexedDB connection'),
      p('isOfflineDataAvailable() - Check if data exists'),
      p('getOfflineMetadata() - Get download metadata'),

      heading2('2.2 Speed Zone Functions'),
      p('getSpeedZones(roadId) - Get speed zones for a road'),
      p('signsToSpeedZones(signs) - Convert sign data to speed zones (NEW)'),

      heading2('2.3 Override Functions (NEW)'),
      new Table({
        rows: [
          tableRow(['Function', 'Purpose'], true),
          tableRow(['getSpeedSignOverrides()', 'Load overrides from localStorage']),
          tableRow(['saveSpeedSignOverrides(data)', 'Save overrides to localStorage']),
          tableRow(['deleteSpeedSignOverride(id)', 'Delete single override']),
          tableRow(['clearSpeedSignOverrides()', 'Clear all overrides']),
        ],
      }),

      heading2('2.4 Road Finding Functions'),
      p('findRoadNearGps(lat, lon, roads) - Find nearest road to GPS position'),
      p('getRoadTypePriority(networkType) - Get road type priority (1-4)'),

      new PageBreak(),

      heading1('3. GPS EKF Class (src/lib/gps-ekf.ts)'),
      
      heading2('GpsEkf Class'),
      p('constructor(config) - Initialize EKF with configuration'),
      p('update(gpsReading) - Update filter with new GPS reading'),
      p('predict(dt) - Predict position for time delta'),
      p('getState() - Get current filter state'),
      p('reset() - Reset filter to initial state'),

      new PageBreak(),

      heading1('4. GPS Tracking Hook (src/hooks/useGpsTracking.ts)'),
      
      heading2('useGpsTracking(config)'),
      p('Main hook for GPS tracking with EKF filtering.'),
      p('Returns: { position, slk, direction, speed, confidence, ... }'),

      heading2('useGpsSettings()'),
      p('Hook for GPS/EKF settings from localStorage.'),

      new PageBreak(),

      heading1('5. Page Component Functions'),

      heading2('5.1 Home Page (src/app/page.tsx)'),
      new Table({
        rows: [
          tableRow(['Function', 'Purpose'], true),
          tableRow(['getWorkZoneInfo()', 'Main function to fetch work zone data']),
          tableRow(['fetchRegions()', 'Load available regions']),
          tableRow(['fetchRoads(region)', 'Load roads for region']),
          tableRow(['fetchWeather(lat, lon)', 'Fetch weather data']),
          tableRow(['fetchPlaces(lat, lon)', 'Fetch nearby amenities']),
          tableRow(['getCurrentLocation()', 'Get GPS position from browser']),
        ],
      }),

      heading2('5.2 Drive Page (src/app/drive/page.tsx)'),
      new Table({
        rows: [
          tableRow(['Function/Value', 'Purpose'], true),
          tableRow(['currentOverrideZone', 'Computed override zone detection (NEW)']),
          tableRow(['startTracking()', 'Begin GPS tracking']),
          tableRow(['stopTracking()', 'Stop GPS tracking']),
          tableRow(['applyGpsLagCompensation()', 'Apply measured GPS lag']),
        ],
      }),

      heading2('5.3 Overrides Page (src/app/overrides/page.tsx)'),
      new Table({
        rows: [
          tableRow(['Function', 'Purpose'], true),
          tableRow(['loadOverrides()', 'Load overrides from localStorage']),
          tableRow(['handleAddOverride()', 'Add new override']),
          tableRow(['handleDeleteOverride(id)', 'Delete override by ID']),
          tableRow(['handleExport()', 'Export overrides for copy/paste']),
          tableRow(['handleImport(data)', 'Import overrides from JSON']),
        ],
      }),

      new PageBreak(),

      heading1('6. API Routes'),
      
      heading2('6.1 Roads API (/api/roads)'),
      p('GET - List regions and roads'),
      p('POST - Get SLK coordinates for work zone'),

      heading2('6.2 GPS API (/api/gps)'),
      p('GET - Convert GPS coordinates to SLK'),

      heading2('6.3 Overrides API (/api/overrides) (NEW)'),
      p('GET - Returns storage mode info (localStorage)'),
      p('POST - Deprecated (localStorage used directly)'),

      heading2('6.4 Speed Compare API (/api/speed-compare) (NEW)'),
      p('GET ?action=status - Check data availability'),
      p('GET ?action=compare - Full MRWA vs OSM comparison'),
      p('GET ?action=discrepancies - Speed discrepancies only'),

      new PageBreak(),

      heading1('7. Constants and Defaults'),
      
      heading2('7.1 Default Sign Direction'),
      p('Default direction: "True Left" (INCREASING SLK)'),
      p('This ensures correct carriageway assignment for new overrides.'),

      heading2('7.2 EKF Configuration'),
      new Table({
        rows: [
          tableRow(['Parameter', 'Default', 'Description'], true),
          tableRow(['processNoise', 5.0', 'GPS measurement noise (meters)'),
          tableRow(['velocityNoise', 10.0', 'Velocity noise (m/s)'),
          tableRow(['initialUncertainty', 100', 'Initial position uncertainty (meters)'),
        ],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('docs/TC_Work_Zone_Locator_Procedures_Functions.docx', buffer);
  console.log('✅ Updated: docs/TC_Work_Zone_Locator_Procedures_Functions.docx');
});
