#!/usr/bin/env node
/**
 * Update Data Sources to RC 1.2.1
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import fs from 'fs';

const heading1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
const p = (text) => new Paragraph({ children: [new TextRun(text)] });

const tableRow = (cells) => new TableRow({
  children: cells.map(cellText => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: cellText })] })],
  })),
}));

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ children: [new TextRun({ text: 'TC Work Zone Locator', bold: true, size: 48 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Data Sources Documentation', bold: true, size: 36 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Version RC 1.2.1', size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 400 }),

      heading1('1. Main Roads WA ArcGIS'),
      p('Base URL: https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer'),
      
      new Table({
        rows: [
          tableRow(['Layer', 'Data', true),
          tableRow(['17', 'Road Network with SLK geometry']),
          tableRow(['8', 'Speed Zones']),
          tableRow(['15', 'Rail Crossings']),
          tableRow(['22', 'Regulatory Signs']),
          tableRow(['23', 'Warning Signs']),
          tableRow(['18', 'All Roads (local roads)']),
        ],
      }),

      heading1('2. External APIs'),
      new Table({
        rows: [
          tableRow(['Source', 'Data', 'Notes'], true),
          tableRow(['Open-Meteo', 'Weather', 'Free, no API key']),
          tableRow(['BOM RSS', 'Weather Warnings', 'WA land warnings']),
          tableRow(['Overpass API', 'Amenities', 'OpenStreetMap']),
          tableRow(['Nominatim', 'Geocoding', 'Reverse geocoding']),
        ],
      }),

      heading1('3. Internal API Endpoints'),
      new Table({
        rows: [
          tableRow(['Endpoint', 'Description'], true),
          tableRow(['/api/roads', 'Road data, SLK coordinates']),
          tableRow(['/api/gps', 'GPS to SLK conversion']),
          tableRow(['/api/weather', 'Weather data']),
          tableRow(['/api/warnings', 'BOM weather warnings']),
          tableRow(['/api/traffic', 'Traffic volume']),
          tableRow(['/api/places', 'Nearby amenities']),
          tableRow(['/api/intersections', 'Cross road detection']),
          tableRow(['/api/admin-sync', 'MRWA direct sync']),
          tableRow(['/api/overrides', 'Override storage (localStorage)']),
          tableRow(['/api/speed-compare', 'MRWA vs OSM comparison']),
          tableRow(['/api/osm-speed', 'OSM speed limits']),
          tableRow(['/api/speed-verify', 'Speed verification']),
          tableRow(['/api/speedlimit', 'Speed limit lookup']),
          tableRow(['/api/download-signs', 'Sign data download']),
          tableRow(['/api/export-pdf', 'Work zone report export']),
          tableRow(['/api/sync-data', 'Offline data sync']),
        ],
      }),

      heading1('4. Override Data Storage'),
      p('Speed sign overrides are stored in browser localStorage:'),
      p('Key: speedSignOverrides'),
      p('Type: SpeedSignOverride[]'),
      p('This enables persistence without server-side storage.'),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('docs/TC_Work_Zone_Locator_Data_Sources.docx', buffer);
  console.log('✅ Updated: docs/TC_Work_Zone_Locator_Data_Sources.docx');
});
