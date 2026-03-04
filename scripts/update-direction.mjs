#!/usr/bin/env node
/**
 * Update Direction Aware Zones to RC 1.2.1
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
      new Paragraph({ children: [new TextRun({ text: 'Direction-Aware Speed Zones', bold: true, size: 36 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Technical Addendum for RC 1.2.1', size: 28 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Bidirectional Speed Zone Detection and Override Zone Visual Indicator', size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 400 }),

      new PageBreak(),

      heading1('1. Override Zone Visual Indicator'),
      p('Version: RC 1.2.1 adds a visual indicator to community-verified speed zones:'),
      heading2('1.1 Visual Elements'),
      p('When driving through a community-verified speed zone:'),
      p('• Speed limit circle has GREEN border'),
      p('• Pulsating checkmark (✓) icon appears'),
      p('• "VERIFIED" label displayed'),
      p('• "Community Verified Zone" text shown'),

      heading2('1.2 Implementation'),
      p('The drive page uses useMemo to compute currentOverrideZone:'),
      p('1. Check if current SLK is within any override zone for current road'),
      p('2. Check if direction matches the override zone direction'),
      p('3. Returns matching override or null'),

      new PageBreak(),

      heading1('2. signsToSpeedZones() Function'),
      p('Converts sign data to speed zones based on sign_type and replicated status:'),
      heading2('2.1 Logic'),
      p('1. For each sign, determine zone creation:'),
      p('2. Double + Different speeds → TWO zones'),
      p('3. Double + Same speeds → ONE Single carriageway zone'),
      p('4. Single + Replicated → ONE directional zone'),
      p('5. Single + Not Replicated → No zone (repeater only)'),

      new PageBreak(),

      heading1('3. Direction Bug Fix'),
      p('Issue: DEFAULT_SIGNS had direction: "True Right" instead of "True Left"'),
      p('This would create inverted speed zones (wrong carriageway assignments)'),
      p('Fix: Changed all default signs to direction: "True Left"'),
      p('Fix: Changed form default from True Right to True Left'),

      new PageBreak(),

      heading1('4. Carriageway Mapping'),
      p('Corrected mapping between direction terminology and carriageways:'),
      new Table({
        rows: [
          tableRow(['Direction', 'Carriageway', 'SLK Movement'], true),
          tableRow(['True Left', 'Left Carriageway', 'INCREASING SLK']),
          tableRow(['True Right', 'Right Carriageway', 'DECREASING SLK']),
        ],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('docs/TC_Work_Zone_Locator_Direction_Aware_Zones.docx', buffer);
  console.log('✅ Updated: docs/TC_Work_Zone_Locator_Direction_Aware_Zones.docx');
});
