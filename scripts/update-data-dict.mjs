#!/usr/bin/env node
/**
 * Update Data Dictionary to RC 1.2.1
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak } from 'docx';
import fs from 'fs';

const VERSION = 'RC 1.2.1';
const DATE = 'March 4, 2026';

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
    properties: {},
    children: [
      // Title Page
      new Paragraph({
        children: [new TextRun({ text: 'TC Work Zone Locator', bold: true, size: 48 })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Data Dictionary', bold: true, size: 36 })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: `Version ${VERSION}`, size: 28 })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Comprehensive Data Structure Reference', size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),

      // Table of Contents
      heading1('Table of Contents'),
      p('1. Core Road Data Structures'),
      p('2. Work Zone Result Structures'),
      p('3. Speed Zone Data Structures'),
      p('4. Speed Sign Override Structures (NEW)'),
      p('5. Signage Data Structures'),
      p('6. GPS Tracking Data Structures'),
      p('7. Weather Data Structures'),
      p('8. Places and Amenities'),
      p('9. Traffic Data Structures'),
      p('10. Storage Data Structures'),

      new PageBreak(),

      // Section 1: Core Road Data
      heading1('1. Core Road Data Structures'),
      
      heading2('1.1 Road (UI Selection)'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['road_id', 'string', 'Unique road identifier (e.g., M031)']),
          tableRow(['road_name', 'string', 'Official road name']),
          tableRow(['min_slk', 'number', 'Minimum SLK value']),
          tableRow(['max_slk', 'number', 'Maximum SLK value']),
          tableRow(['region', 'string?', 'MRWA region name']),
        ],
      }),

      heading2('1.2 RoadData (IndexedDB Storage)'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['road_id', 'string', 'Unique identifier']),
          tableRow(['road_name', 'string', 'Road name']),
          tableRow(['slk_from', 'number', 'Start SLK']),
          tableRow(['slk_to', 'number', 'End SLK']),
          tableRow(['geometry', 'GeoJSON', 'Road geometry']),
          tableRow(['network_type', 'string', 'State Road, Local Road, etc.']),
          tableRow(['region', 'string', 'MRWA region']),
        ],
      }),

      new PageBreak(),

      // Section 2: Work Zone Result
      heading1('2. Work Zone Result Structures'),
      
      heading2('2.1 WorkZoneResult'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['road_id', 'string', 'Road identifier']),
          tableRow(['road_name', 'string', 'Road name']),
          tableRow(['network_type', 'string?', 'Road type']),
          tableRow(['work_zone', 'WorkZone', 'Work zone boundaries']),
          tableRow(['tc_positions', 'TCPositions', 'TC start/end positions']),
          tableRow(['speed_zones', 'SpeedZones', 'Zone speed limits']),
          tableRow(['carriageway', 'string', 'Left, Right, or Single']),
          tableRow(['midpoint', 'GeoPoint?', 'Work zone center']),
          tableRow(['google_maps', 'GoogleMapsLinks', 'Navigation links']),
        ],
      }),

      new PageBreak(),

      // Section 3: Speed Zone Data
      heading1('3. Speed Zone Data Structures'),
      
      heading2('3.1 ParsedSpeedZone'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['road_id', 'string', 'Road identifier']),
          tableRow(['road_name', 'string', 'Road name']),
          tableRow(['start_slk', 'number', 'Zone start SLK']),
          tableRow(['end_slk', 'number', 'Zone end SLK']),
          tableRow(['speed_limit', 'number', 'Speed limit in km/h']),
          tableRow(['carriageway', 'string', 'Left, Right, or Single']),
          tableRow(['is_override', 'boolean?', 'Is this an override?']),
          tableRow(['override_id', 'string?', 'Override source ID']),
          tableRow(['override_source', 'string?', 'Override source type']),
        ],
      }),

      new PageBreak(),

      // Section 4: Speed Sign Override (NEW)
      heading1('4. Speed Sign Override Structures (NEW)'),
      
      heading2('4.1 SpeedSignOverride'),
      p('Primary structure for community-verified speed sign data:'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Required', 'Description'], true),
          tableRow(['id', 'string', 'Yes', 'Unique identifier (e.g., M031-S001)']),
          tableRow(['road_id', 'string', 'Yes', 'Road identifier']),
          tableRow(['road_name', 'string', 'Yes', 'Official road name']),
          tableRow(['common_usage_name', 'string', 'No', 'Common name if different']),
          tableRow(['slk', 'number', 'Yes', 'Sign location SLK']),
          tableRow(['lat', 'number', 'No', 'GPS latitude of sign']),
          tableRow(['lon', 'number', 'No', 'GPS longitude of sign']),
          tableRow(['direction', 'enum', 'Yes', '"True Left" or "True Right"']),
          tableRow(['sign_type', 'enum', 'Yes', '"Single" or "Double"']),
          tableRow(['replicated', 'boolean', 'Yes', 'Matching sign on opposite side']),
          tableRow(['start_slk', 'number', 'Yes', 'Zone start SLK']),
          tableRow(['end_slk', 'number', 'No', 'Zone end SLK (if replicated)']),
          tableRow(['approach_speed', 'number', 'No', 'Speed before this sign']),
          tableRow(['front_speed', 'number', 'Yes', 'Speed on front face']),
          tableRow(['back_speed', 'number', 'No', 'Speed on back face (double only)']),
          tableRow(['verified_by', 'string', 'No', 'Who verified this sign']),
          tableRow(['verified_date', 'string', 'No', 'Date of verification']),
          tableRow(['note', 'string', 'No', 'Additional notes']),
          tableRow(['source', 'string', 'No', 'e.g., "community_verified"']),
          tableRow(['mrwa_slk', 'number', 'No', 'MRWA database SLK (for comparison)']),
          tableRow(['discrepancy_m', 'number', 'No', 'Distance discrepancy in meters']),
        ],
      }),

      heading2('4.2 GeneratedSpeedZone'),
      p('Zone generated from sign data by signsToSpeedZones():'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['road_id', 'string', 'Road identifier']),
          tableRow(['start_slk', 'number', 'Zone start SLK']),
          tableRow(['end_slk', 'number', 'Zone end SLK']),
          tableRow(['speed_limit', 'number', 'Speed limit in km/h']),
          tableRow(['carriageway', 'string', '"Left", "Right", or "Single"']),
          tableRow(['source_id', 'string', 'ID of source sign']),
          tableRow(['is_override', 'true', 'Always true for overrides']),
        ],
      }),

      heading2('4.3 Direction Values'),
      new Table({
        rows: [
          tableRow(['Direction', 'Carriageway', 'SLK Movement'], true),
          tableRow(['True Left', 'Left Carriageway', 'INCREASING SLK']),
          tableRow(['True Right', 'Right Carriageway', 'DECREASING SLK']),
        ],
      }),

      new PageBreak(),

      // Section 5: Signage Data
      heading1('5. Signage Data Structures'),
      
      heading2('5.1 SignageItem'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['type', 'string', 'Intersection, SpeedSign, WarningSign, etc.']),
          tableRow(['slk', 'number', 'Location SLK']),
          tableRow(['lat', 'number', 'Latitude']),
          tableRow(['lon', 'number', 'Longitude']),
          tableRow(['description', 'string', 'Sign description']),
          tableRow(['speed_limit', 'number?', 'For speed signs']),
          tableRow(['carriageway', 'string?', 'Left, Right, or Single']),
        ],
      }),

      new PageBreak(),

      // Section 6: GPS Tracking
      heading1('6. GPS Tracking Data Structures'),
      
      heading2('6.1 GpsReading'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['lat', 'number', 'Latitude in degrees']),
          tableRow(['lon', 'number', 'Longitude in degrees']),
          tableRow(['accuracy', 'number', 'Accuracy in meters']),
          tableRow(['speed', 'number', 'Speed in m/s']),
          tableRow(['heading', 'number', 'Heading in degrees']),
          tableRow(['timestamp', 'number', 'Unix timestamp']),
        ],
      }),

      heading2('6.2 EkfState'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['x', 'number[]', 'State vector [lat, lon, v_lat, v_lon]']),
          tableRow(['P', 'number[][]', 'Covariance matrix']),
          tableRow(['lastUpdate', 'number', 'Last update timestamp']),
        ],
      }),

      heading2('6.3 EkfOutput'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['lat', 'number', 'Filtered latitude']),
          tableRow(['lon', 'number', 'Filtered longitude']),
          tableRow(['uncertainty', 'number', 'Position uncertainty in meters']),
          tableRow(['confidence', 'string', 'High, Medium, Low, or Predicted']),
          tableRow(['isPredicted', 'boolean', 'Is this a prediction?']),
        ],
      }),

      new PageBreak(),

      // Section 7: Weather Data
      heading1('7. Weather Data Structures'),
      
      heading2('7.1 WeatherData'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['location', 'string', 'Location name']),
          tableRow(['current', 'object', 'Current conditions']),
          tableRow(['sun', 'object', 'Sunrise/sunset info']),
          tableRow(['forecast', 'array', '8-hour forecast']),
        ],
      }),

      new PageBreak(),

      // Section 8: Places
      heading1('8. Places and Amenities'),
      
      heading2('8.1 Place'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['name', 'string', 'Place name']),
          tableRow(['distance', 'string', 'Distance from work zone']),
          tableRow(['lat', 'number', 'Latitude']),
          tableRow(['lon', 'number', 'Longitude']),
          tableRow(['phone', 'string?', 'Phone number']),
          tableRow(['address', 'string?', 'Street address']),
          tableRow(['googleMapsUrl', 'string', 'Google Maps link']),
          tableRow(['isEmergency', 'boolean?', 'Emergency facility?']),
        ],
      }),

      new PageBreak(),

      // Section 9: Traffic Data
      heading1('9. Traffic Data Structures'),
      
      heading2('9.1 TrafficData'),
      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['road_id', 'string', 'Road identifier']),
          tableRow(['aadt', 'number', 'Annual Average Daily Traffic']),
          tableRow(['aadt_year', 'string', 'Data year']),
          tableRow(['heavy_vehicle_percent', 'number', 'Heavy vehicle %']),
          tableRow(['peak_hour_volume', 'number', 'Peak hour volume']),
          tableRow(['source', 'string', 'Data source']),
        ],
      }),

      new PageBreak(),

      // Section 10: Storage
      heading1('10. Storage Data Structures'),
      
      heading2('10.1 localStorage Keys'),
      new Table({
        rows: [
          tableRow(['Key', 'Type', 'Description'], true),
          tableRow(['speedSignOverrides', 'SpeedSignOverride[]', 'Speed sign overrides']),
          tableRow(['gpsSettings', 'object', 'GPS/EKF settings']),
          tableRow(['windGustThreshold', 'number', 'Wind gust alert threshold']),
          tableRow(['defaultRegion', 'string', 'Default region selection']),
        ],
      }),

      heading2('10.2 IndexedDB Stores'),
      new Table({
        rows: [
          tableRow(['Store', 'Description'], true),
          tableRow(['roads', 'Road network data']),
          tableRow(['speedZones', 'MRWA speed zone data']),
          tableRow(['railCrossings', 'Rail crossing locations']),
          tableRow(['regulatorySigns', 'Regulatory signage']),
          tableRow(['warningSigns', 'Warning signage']),
        ],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('docs/TC_Work_Zone_Locator_Data_Dictionary.docx', buffer);
  console.log('✅ Updated: docs/TC_Work_Zone_Locator_Data_Dictionary.docx');
});
