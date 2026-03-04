#!/usr/bin/env node
/**
 * Update File Structure to RC 1.2.1
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak } from 'docx';
import fs from 'fs';

const VERSION = 'RC 1.2.1';

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
      new Paragraph({ children: [new TextRun({ text: 'File Structure Documentation', bold: true, size: 36 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `Version ${VERSION}`, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }),

      heading1('1. Project Overview'),
      p('The TC Work Zone Locator is a Next.js 15 application built with the App Router architecture. This document provides a comprehensive reference of all files and directories in the project.'),

      heading1('2. Root Directory Structure'),
      new Table({
        rows: [
          tableRow(['File/Directory', 'Purpose'], true),
          tableRow(['src/', 'Source code']),
          tableRow(['public/', 'Static assets']),
          tableRow(['docs/', 'Documentation']),
          tableRow(['scripts/', 'Build/utility scripts']),
          tableRow(['prisma/', 'Database schema']),
          tableRow(['package.json', 'Dependencies and scripts']),
          tableRow(['README.md', 'Project readme']),
          tableRow(['PROJECT_CONTEXT.md', 'Single source of truth for AI']),
          tableRow(['worklog.md', 'Development work log']),
          tableRow(['RC1_Test_Checklist.md', 'Testing checklist']),
        ],
      }),

      new PageBreak(),

      heading1('3. Source Code Structure (src/)'),

      heading2('3.1 Application Pages (src/app/)'),
      new Table({
        rows: [
          tableRow(['File', 'Purpose'], true),
          tableRow(['page.tsx', 'Home page - Work zone lookup']),
          tableRow(['drive/page.tsx', 'GPS tracking page']),
          tableRow(['overrides/page.tsx', 'Speed sign override management']),
          tableRow(['calibrate/page.tsx', 'GPS calibration tool']),
          tableRow(['layout.tsx', 'Root layout']),
          tableRow(['globals.css', 'Global styles']),
        ],
      }),

      heading2('3.2 API Routes (src/app/api/)'),
      new Table({
        rows: [
          tableRow(['Route', 'Purpose'], true),
          tableRow(['roads/route.ts', 'Road data, SLK coordinates']),
          tableRow(['gps/route.ts', 'GPS to SLK conversion']),
          tableRow(['weather/route.ts', 'Weather data (Open-Meteo)']),
          tableRow(['warnings/route.ts', 'BOM weather warnings RSS']),
          tableRow(['traffic/route.ts', 'Traffic volume data']),
          tableRow(['places/route.ts', 'Nearby amenities']),
          tableRow(['intersections/route.ts', 'Cross road detection']),
          tableRow(['admin-sync/route.ts', 'MRWA direct sync']),
          tableRow(['overrides/route.ts', 'Override storage pass-through']),
          tableRow(['speed-compare/route.ts', 'MRWA vs OSM comparison']),
          tableRow(['osm-speed/route.ts', 'OSM speed limit data']),
          tableRow(['speed-verify/route.ts', 'Speed verification']),
          tableRow(['speedlimit/route.ts', 'Speed limit lookup']),
          tableRow(['download-signs/route.ts', 'Sign data download']),
          tableRow(['export-pdf/route.ts', 'Work zone report export']),
          tableRow(['sync-data/route.ts', 'Offline data sync']),
        ],
      }),

      new PageBreak(),

      heading2('3.3 Library Modules (src/lib/)'),
      new Table({
        rows: [
          tableRow(['File', 'Purpose'], true),
          tableRow(['offline-db.ts', 'IndexedDB storage, sign-to-zone logic']),
          tableRow(['mrwa_api.ts', 'MRWA ArcGIS API integration']),
          tableRow(['gps-ekf.ts', 'Extended Kalman Filter for GPS']),
          tableRow(['utils.ts', 'Haversine distance calculation']),
          tableRow(['download-roads.ts', 'Static data loader']),
        ],
      }),

      heading2('3.4 React Hooks (src/hooks/)'),
      new Table({
        rows: [
          tableRow(['File', 'Purpose'], true),
          tableRow(['useGpsTracking.ts', 'GPS tracking with EKF, speed zones']),
        ],
      }),

      new PageBreak(),

      heading1('4. Scripts (scripts/)'),
      new Table({
        rows: [
          tableRow(['File', 'Purpose'], true),
          tableRow(['download-roads.js', 'Download MRWA road data']),
          tableRow(['download-signage.mjs', 'Download signage data']),
          tableRow(['version-check.sh', 'Version consistency checker']),
          tableRow(['read-docx.mjs', 'Document reader utility']),
          tableRow(['generate-rc121-doc.mjs', 'Generate RC 1.2.1 supplement']),
        ],
      }),

      heading1('5. Documentation (docs/)'),
      new Table({
        rows: [
          tableRow(['File', 'Purpose'], true),
          tableRow(['TC_Work_Zone_Locator_RC1_Documentation.docx', 'Main documentation']),
          tableRow(['TC_Work_Zone_Locator_RC1.2.1_Supplement.docx', 'RC 1.2.1 changes']),
          tableRow(['TC_Work_Zone_Locator_Data_Dictionary.docx', 'Data structures']),
          tableRow(['TC_Work_Zone_Locator_File_Structure.docx', 'This file']),
          tableRow(['TC_Work_Zone_Locator_Glossary.docx', 'Terms & definitions']),
          tableRow(['TC_Work_Zone_Locator_Procedures_Functions.docx', 'Function reference']),
          tableRow(['TC_Work_Zone_Locator_Direction_Aware_Zones.docx', 'Bidirectional zones']),
          tableRow(['TC_Work_Zone_Locator_Data_Sources.docx', 'Data sources']),
          tableRow(['TC_Work_Zone_Locator_Program_Logic.docx', 'Program logic']),
        ],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('docs/TC_Work_Zone_Locator_File_Structure.docx', buffer);
  console.log('✅ Updated: docs/TC_Work_Zone_Locator_File_Structure.docx');
});
