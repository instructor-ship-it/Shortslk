#!/usr/bin/env node
/**
 * Update Glossary to RC 1.2.1
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak } from 'docx';
import fs from 'fs';

const VERSION = 'RC 1.2.1';

const heading1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
const heading2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
const p = (text) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 150 } });
const pBold = (label, text) => new Paragraph({ 
  children: [new TextRun({ text: label, bold: true }), new TextRun(text)], 
  spacing: { after: 150 } 
});

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ children: [new TextRun({ text: 'TC Work Zone Locator', bold: true, size: 48 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Glossary of Terms', bold: true, size: 36 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: VERSION, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }),

      heading1('1. Road & SLK Terminology'),
      
      pBold('SLK (Straight Line Kilometre)', ' - A linear reference system used to identify locations along a road. SLK values increase from one end of the road to the other, providing a consistent method for locating features, signage, and work zones independent of GPS coordinates.'),
      pBold('True Right', ' - The right side of a road when facing in the direction of increasing SLK values. In Western Australia, where traffic drives on the left, True Right corresponds to the lane traveling toward lower SLK values (DECREASING SLK).'),
      pBold('True Left', ' - The left side of a road when facing in the direction of increasing SLK values. In Western Australia, True Left corresponds to the lane traveling toward higher SLK values (INCREASING SLK).'),
      pBold('Carriageway', ' - A section of road designated for traffic in a specific direction. MRWA records carriageways as Single, Right, or Left.'),
      pBold('Road ID', ' - A unique identifier assigned to each road in the MRWA network. Typically consists of a letter prefix indicating road classification followed by a number (e.g., M031, H021).'),

      heading1('2. Speed Zone Terminology'),
      
      pBold('Speed Zone', ' - A defined section of road with a specific legal speed limit. Speed zones are recorded with start and end SLK values, the applicable speed limit, and the carriageway designation.'),
      pBold('Bidirectional Speed Zone', ' - A road section where different speed limits apply to different directions of travel. This can occur on single carriageways with double-sided signage or on dual carriageways.'),
      pBold('Speed Restriction Sign', ' - A regulatory sign displaying the legal speed limit for a road section. May be single-sided (one limit) or double-sided (different limits for each direction).'),
      pBold('Lookahead', ' - A feature that predicts and displays upcoming speed zone changes before the driver reaches them. Considers current speed and GPS lag compensation.'),

      heading1('3. Speed Sign Override Terminology (NEW)'),
      
      pBold('Speed Sign Override', ' - A community-verified correction to MRWA speed zone data. Overrides are stored locally and take precedence over MRWA data for speed limit display.'),
      pBold('Override Zone', ' - A speed zone that has been corrected through user field verification. Identified in the UI by green border and pulsating checkmark icon.'),
      pBold('Double-Sided Sign', ' - A speed restriction sign with different speed limits displayed on each face, for different directions of traffic. Uses front_speed for the face in the indicated direction, and back_speed for the opposite face.'),
      pBold('Replicated Sign', ' - A speed sign that has a matching sign on the opposite side of the road, creating zones for both directions of travel.'),
      pBold('Community Verified', ' - Data that has been verified by field observation rather than from MRWA database. Marked with source: "community_verified" in override data.'),
      pBold('localStorage Override', ' - Override data stored in the browser\'s localStorage, enabling persistence across sessions without server-side storage.'),

      heading1('4. GPS & Navigation Terminology'),
      
      pBold('EKF (Extended Kalman Filter)', ' - An algorithm for smoothing GPS position data. Provides optimal position estimates by combining GPS readings with motion predictions.'),
      pBold('GPS Lag', ' - The delay between actual position and GPS-reported position. Can be measured using the calibration tool and applied to speed zone lookahead timing.'),
      pBold('Road Constraint', ' - A GPS filtering option that snaps position predictions to the nearby road geometry for improved accuracy.'),

      heading1('5. Data Storage Terminology'),
      
      pBold('IndexedDB', ' - A browser database for storing large amounts of structured data, including all road network data (69,000+ roads), speed zones, and signage.'),
      pBold('localStorage', ' - Browser storage for key-value data. Used for user preferences, settings, and speed sign overrides.'),

      heading1('6. Application Feature Terminology'),
      
      pBold('Signage Corridor', ' - All signage within ±700m of a work zone, including intersections (±100m), speed restriction signs, and warning signs.'),
      pBold('TC Positions', ' - Traffic Controller positions at ±100m from work zone boundaries.'),
      pBold('Work Zone', ' - The section of road between start and end SLK values where work is being performed.'),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('docs/TC_Work_Zone_Locator_Glossary.docx', buffer);
  console.log('✅ Updated: docs/TC_Work_Zone_Locator_Glossary.docx');
});
