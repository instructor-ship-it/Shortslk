#!/usr/bin/env node
/**
 * Generate RC 1.2.1 Documentation Supplement
 * Creates a Word document with all new features and changes
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak } from 'docx';
import fs from 'fs';

const VERSION = 'RC 1.2.1';
const DATE = 'March 4, 2026';

// Helper functions
const p = (text, options = {}) => new Paragraph({
  children: [new TextRun({ text, ...options })],
  spacing: { after: 200 },
});

const bold = (text) => new TextRun({ text, bold: true });
const normal = (text) => new TextRun(text);

const heading1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
const heading2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
const heading3 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } });

const tableRow = (cells, isHeader = false) => new TableRow({
  children: cells.map(cellText => new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: cellText, bold: isHeader })],
    })],
    width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
  })),
});

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      // Title
      new Paragraph({
        children: [new TextRun({ text: 'TC Work Zone Locator', bold: true, size: 48 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'RC 1.2.1 Documentation Supplement', bold: true, size: 32 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'New Features and Changes', size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Version: ${VERSION}`, size: 22 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 50 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Date: ${DATE}`, size: 22 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),

      // Table of Contents
      heading1('Table of Contents'),
      p('1. Version History Summary'),
      p('2. Speed Sign Override System'),
      p('3. Override Zone Visual Indicator'),
      p('4. New API Endpoints'),
      p('5. New Data Structures'),
      p('6. New Functions'),
      p('7. New Glossary Terms'),
      p('8. New Files'),
      p('9. Version Consistency Check'),

      new PageBreak(),

      // Section 1: Version History
      heading1('1. Version History Summary'),
      
      heading2('RC 1.2.1 - Override Zone Visual Indicator'),
      p('Released: March 2026'),
      heading3('New Features:'),
      p('• Pulsating ✓ icon appears when driving through community-verified speed zones'),
      p('• Green border around speed limit circle indicates override zone'),
      p('• "VERIFIED" label and "Community Verified Zone" text for clarity'),
      p('• Added currentOverrideZone computed value using useMemo'),
      heading3('Bug Fixes:'),
      p('• Fixed DEFAULT_SIGNS having wrong default direction (True Right → True Left)'),
      p('• Prevents inverted speed zones from incorrect carriageway assignments'),

      heading2('RC 1.2.0 - Speed Sign Override System'),
      p('Released: March 2026'),
      heading3('Major Changes:'),
      p('• Fixed double-sided sign interpretation - back_speed now used correctly'),
      p('• Double signs with different speeds create TWO zones (one per direction)'),
      p('• Double signs with same speeds create ONE Single carriageway zone'),
      heading3('Carriageway Mapping Corrections:'),
      p('• True Left = Left Carriageway = INCREASING SLK'),
      p('• True Right = Right Carriageway = DECREASING SLK'),
      heading3('Mobile Export Fix:'),
      p('• Export displays data in textarea for copy/paste (mobile-friendly)'),
      p('• Added "Copy to Clipboard" button'),
      heading3('Documentation:'),
      p('• Merged AI_CONTEXT.md into PROJECT_CONTEXT.md'),

      heading2('RC 1.0.4 - Sign-Based Override System'),
      p('Released: March 2026'),
      p('• New sign-based override system with direction, sign_type, replicated fields'),
      p('• Zone generation logic for single/double sided signs'),
      p('• New override UI with full sign configuration form'),

      heading2('RC 1.0.3 - Speed Zone Override System'),
      p('Released: March 2026'),
      p('• Override management page at /overrides'),
      p('• MRWA Exception Report generator'),
      p('• GPS-verified sign locations'),
      p('• Community-verified corrections take precedence over MRWA data'),

      heading2('RC 1.0.2 - Road Priority Fix'),
      p('Released: March 2026'),
      p('• Fixed road priority causing State Road shown when on Local Road'),
      p('• Priority now used as 50m tiebreaker only'),
      p('• Automatic IndexedDB clearing before download'),

      heading2('RC 1.0.1 - GPS Priority Fix'),
      p('Released: March 2026'),
      p('• Fixed GPS tracking prioritizing Local Roads over State Roads'),
      p('• Added road type priority system'),

      new PageBreak(),

      // Section 2: Speed Sign Override System
      heading1('2. Speed Sign Override System'),
      
      heading2('2.1 Overview'),
      p('The Speed Sign Override System allows Traffic Controllers to record community-verified corrections to MRWA speed zone data. This is essential when physical signs differ from MRWA database records, which can occur after road works, sign relocations, or data entry errors.'),

      heading2('2.2 Override Page (/overrides)'),
      p('The override management page provides:'),
      p('• Table of all existing overrides with full metadata'),
      p('• Form for adding new speed sign overrides'),
      p('• Export functionality (copy/paste for mobile)'),
      p('• Import from JSON file'),
      p('• Delete individual overrides'),
      p('• Clear all overrides option'),

      heading2('2.3 Sign Data Structure'),
      p('Each override captures complete sign information:'),

      new Table({
        rows: [
          tableRow(['Field', 'Type', 'Description'], true),
          tableRow(['id', 'string', 'Unique identifier (e.g., M031-S001)']),
          tableRow(['road_id', 'string', 'Road identifier (e.g., M031)']),
          tableRow(['road_name', 'string', 'Official road name']),
          tableRow(['common_usage_name', 'string?', 'Common name if different']),
          tableRow(['slk', 'number', 'Sign location SLK']),
          tableRow(['lat', 'number?', 'GPS latitude of sign']),
          tableRow(['lon', 'number?', 'GPS longitude of sign']),
          tableRow(['direction', 'enum', 'True Left or True Right']),
          tableRow(['sign_type', 'enum', 'Single or Double']),
          tableRow(['replicated', 'boolean', 'Matching sign on opposite side?']),
          tableRow(['start_slk', 'number', 'Zone start SLK']),
          tableRow(['end_slk', 'number?', 'Zone end SLK']),
          tableRow(['approach_speed', 'number?', 'Speed before this sign']),
          tableRow(['front_speed', 'number', 'Speed on front face']),
          tableRow(['back_speed', 'number?', 'Speed on back face (double only)']),
          tableRow(['verified_by', 'string?', 'Who verified this sign']),
          tableRow(['verified_date', 'string?', 'Date of verification']),
          tableRow(['source', 'string?', 'community_verified, etc.']),
        ],
      }),

      heading2('2.4 Zone Generation Logic'),
      p('The signsToSpeedZones() function converts signs to zones:'),

      new Table({
        rows: [
          tableRow(['Sign Type', 'Replicated', 'Zone Created'], true),
          tableRow(['Single', 'No', 'None (repeater sign only)']),
          tableRow(['Single', 'Yes', 'One direction-specific zone']),
          tableRow(['Double', 'Yes (same speeds)', 'One Single carriageway zone']),
          tableRow(['Double', 'Yes (diff speeds)', 'Two directional zones']),
        ],
      }),

      new PageBreak(),

      // Section 3: Override Zone Visual Indicator
      heading1('3. Override Zone Visual Indicator'),
      
      heading2('3.1 Purpose'),
      p('When driving through a community-verified speed zone, the application provides clear visual feedback to distinguish MRWA data from field-verified zones.'),

      heading2('3.2 Visual Elements'),
      p('When in an override zone:'),
      p('• Speed limit circle has GREEN border (instead of white)'),
      p('• Pulsating ✓ icon appears next to speed limit'),
      p('• "VERIFIED" label displayed'),
      p('• "Community Verified Zone" text shown below'),

      heading2('3.3 Implementation'),
      p('The drive page computes currentOverrideZone using useMemo:'),
      p('• Checks if current SLK is within any override zone for current road'),
      p('• Checks if direction matches the override zone direction'),
      p('• Returns matching override or null'),

      new PageBreak(),

      // Section 4: New API Endpoints
      heading1('4. New API Endpoints'),
      
      heading2('4.1 Override Storage'),
      new Table({
        rows: [
          tableRow(['Endpoint', 'Method', 'Description'], true),
          tableRow(['/api/overrides', 'GET', 'Returns storage mode info (localStorage)']),
          tableRow(['/api/overrides', 'POST', 'Deprecated - localStorage used instead']),
        ],
      }),

      heading2('4.2 Speed Comparison'),
      new Table({
        rows: [
          tableRow(['Endpoint', 'Method', 'Description'], true),
          tableRow(['/api/speed-compare', 'GET', 'Compare MRWA vs OSM speed limits']),
          tableRow(['/api/speed-compare?action=status', 'GET', 'Check data availability']),
          tableRow(['/api/speed-compare?action=compare', 'GET', 'Full comparison results']),
          tableRow(['/api/speed-compare?action=discrepancies', 'GET', 'Speed discrepancies only']),
        ],
      }),

      heading2('4.3 Other New Endpoints'),
      new Table({
        rows: [
          tableRow(['Endpoint', 'Method', 'Description'], true),
          tableRow(['/api/osm-speed', 'GET', 'OpenStreetMap speed limit data']),
          tableRow(['/api/speed-verify', 'GET', 'Speed verification']),
          tableRow(['/api/speedlimit', 'GET', 'Speed limit lookup']),
          tableRow(['/api/download-signs', 'GET', 'Sign data download']),
          tableRow(['/api/export-pdf', 'POST', 'Work zone report export']),
          tableRow(['/api/sync-data', 'POST', 'Offline data synchronization']),
        ],
      }),

      new PageBreak(),

      // Section 5: New Data Structures
      heading1('5. New Data Structures'),
      
      heading2('5.1 SpeedSignOverride'),
      p('TypeScript interface for speed sign overrides:'),
      p('interface SpeedSignOverride {'),
      p('  id: string;'),
      p('  road_id: string;'),
      p('  road_name: string;'),
      p('  common_usage_name?: string;'),
      p('  slk: number;'),
      p('  lat?: number;'),
      p('  lon?: number;'),
      p('  direction: "True Left" | "True Right";'),
      p('  sign_type: "Single" | "Double";'),
      p('  replicated: boolean;'),
      p('  start_slk: number;'),
      p('  end_slk?: number;'),
      p('  approach_speed?: number;'),
      p('  front_speed: number;'),
      p('  back_speed?: number;'),
      p('  verified_by?: string;'),
      p('  verified_date?: string;'),
      p('  note?: string;'),
      p('  source?: string;'),
      p('}'),

      heading2('5.2 GeneratedSpeedZone'),
      p('Zone generated from sign data:'),
      p('interface GeneratedSpeedZone {'),
      p('  road_id: string;'),
      p('  start_slk: number;'),
      p('  end_slk: number;'),
      p('  speed_limit: number;'),
      p('  carriageway: "Left" | "Right" | "Single";'),
      p('  source_id: string;'),
      p('  is_override: true;'),
      p('}'),

      new PageBreak(),

      // Section 6: New Functions
      heading1('6. New Functions'),
      
      heading2('6.1 offline-db.ts'),
      new Table({
        rows: [
          tableRow(['Function', 'Purpose'], true),
          tableRow(['signsToSpeedZones()', 'Convert sign data to speed zones']),
          tableRow(['getSpeedSignOverrides()', 'Load overrides from localStorage']),
          tableRow(['saveSpeedSignOverrides()', 'Save overrides to localStorage']),
          tableRow(['deleteSpeedSignOverride()', 'Delete single override']),
          tableRow(['clearSpeedSignOverrides()', 'Clear all overrides']),
        ],
      }),

      heading2('6.2 signsToSpeedZones() Logic'),
      p('1. For each sign, determine zone creation based on sign_type and replicated'),
      p('2. Double signs with different front/back speeds → TWO zones'),
      p('3. Double signs with same speeds → ONE Single carriageway zone'),
      p('4. Single replicated signs → ONE directional zone'),
      p('5. Single non-replicated → No zone (repeater only)'),

      new PageBreak(),

      // Section 7: New Glossary Terms
      heading1('7. New Glossary Terms'),
      
      heading2('Speed Sign Override'),
      p('A community-verified correction to MRWA speed zone data. Overrides are stored locally and take precedence over MRWA data for speed limit display.'),

      heading2('Override Zone'),
      p('A speed zone that has been corrected through user field verification. Identified in the UI by green border and pulsating checkmark icon.'),

      heading2('Double-Sided Sign'),
      p('A speed restriction sign with different speed limits displayed on each face, for different directions of traffic. Uses front_speed for the face in the indicated direction, and back_speed for the opposite face.'),

      heading2('Replicated Sign'),
      p('A speed sign that has a matching sign on the opposite side of the road, creating zones for both directions of travel.'),

      heading2('Community Verified'),
      p('Data that has been verified by field observation rather than from MRWA database. Marked with source: "community_verified" in override data.'),

      heading2('localStorage Override'),
      p('Override data stored in the browser\'s localStorage, enabling persistence across sessions without server-side storage.'),

      new PageBreak(),

      // Section 8: New Files
      heading1('8. New Files'),
      
      heading2('8.1 Page Components'),
      new Table({
        rows: [
          tableRow(['File', 'Purpose'], true),
          tableRow(['src/app/overrides/page.tsx', 'Override management page']),
        ],
      }),

      heading2('8.2 API Routes'),
      new Table({
        rows: [
          tableRow(['File', 'Purpose'], true),
          tableRow(['src/app/api/overrides/route.ts', 'Override storage pass-through']),
          tableRow(['src/app/api/speed-compare/route.ts', 'MRWA vs OSM comparison']),
          tableRow(['src/app/api/osm-speed/route.ts', 'OSM speed limit data']),
          tableRow(['src/app/api/speed-verify/route.ts', 'Speed verification']),
          tableRow(['src/app/api/speedlimit/route.ts', 'Speed limit lookup']),
          tableRow(['src/app/api/download-signs/route.ts', 'Sign data download']),
          tableRow(['src/app/api/export-pdf/route.ts', 'Report export']),
          tableRow(['src/app/api/sync-data/route.ts', 'Offline data sync']),
        ],
      }),

      heading2('8.3 Scripts'),
      new Table({
        rows: [
          tableRow(['File', 'Purpose'], true),
          tableRow(['scripts/version-check.sh', 'Version consistency checker']),
          tableRow(['scripts/read-docx.mjs', 'Document reader utility']),
        ],
      }),

      new PageBreak(),

      // Section 9: Version Consistency Check
      heading1('9. Version Consistency Check'),
      
      heading2('9.1 Overview'),
      p('An automated script checks version consistency across all project files to prevent documentation drift.'),

      heading2('9.2 Usage'),
      p('bun run version-check'),

      heading2('9.3 Files Checked'),
      p('• src/app/page.tsx - App header version'),
      p('• src/app/drive/page.tsx - Drive page version'),
      p('• src/app/overrides/page.tsx - Overrides page version'),
      p('• PROJECT_CONTEXT.md - Current Version header'),
      p('• README.md - Version history (Current) marker'),
      p('• worklog.md - Current Version header'),
      p('• RC1_Test_Checklist.md - Title version'),

      heading2('9.4 Output Example'),
      p('✅ All versions match: RC 1.2.1'),
      p(''),
      p('Or on mismatch:'),
      p('⚠️ VERSION MISMATCH DETECTED!'),
      p('   Found 2 different versions:'),
      p('   - RC 1.2.0'),
      p('   - RC 1.2.1'),

    ],
  }],
});

// Generate the document
const outputPath = 'docs/TC_Work_Zone_Locator_RC1.2.1_Supplement.docx';
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Created: ${outputPath}`);
});
