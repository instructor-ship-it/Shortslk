#!/usr/bin/env node
/**
 * Update Program Logic to RC 1.2.1
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak } from 'docx';
import fs from 'fs';

const heading1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
const p = (text) => new Paragraph({ children: [new TextRun(text)] });

const tableRow = (cells) => new TableRow({
  children: cells.map(cellText => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: cellText })] })],
  })),
});

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ children: [new TextRun({ text: 'TC Work Zone Locator', bold: true, size: 48 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Program Logic Documentation', bold: true, size: 36 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Version RC 1.2.1', size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 400 }),

      heading1('1. Speed Sign Override System'),
      
      heading1('1.1 signsToSpeedZones() Algorithm'),
      p('Converts sign data to speed zones based on sign type and replication status:'),
      p('Step 1: For each sign, determine zone type:'),
      p('Step 2: Double + Different speeds → TWO directional zones'),
      p('Step 3: Double + Same speeds → ONE Single carriageway zone'),
      p('Step 4: Single + Replicated → ONE directional zone'),
      p('Step 5: Single + Not Replicated → No zone (repeater)'),

      heading1('1.2 Override Zone Detection'),
      p('currentOverrideZone is computed using useMemo:'),
      p('1. Check if current SLK is within any override zone for current road'),
      p('2. Check if direction matches the override zone direction'),
      p('3. Return matching override or null'),

      heading1('1.3 Visual Indicator Logic'),
      p('When in override zone:'),
      p('• Speed circle border changes to green'),
      p('• Pulsating checkmark (✓) icon appears'),
      p('• "VERIFIED" label displayed'),

      new PageBreak(),

      heading1('2. Direction Detection'),
      
      heading1('2.1 SLK Movement Analysis'),
      p('The app tracks SLK changes over time to determine direction:'),
      p('• INCREASING SLK → True Right direction'),
      p('• DECREASING SLK → True Left direction'),

      heading1('2.2 Carriageway Mapping'),
      new Table({
        rows: [
          tableRow(['Direction', 'Carriageway', 'SLK Movement'], true),
          tableRow(['True Left', 'Left Carriageway', 'INCREASING SLK']),
          tableRow(['True Right', 'Right Carriageway', 'DECREASING SLK']),
        ],
      }),

      new PageBreak(),

      heading1('3. Speed Zone Lookahead'),
      
      p('The lookahead system warns of upcoming speed zone changes:'),
      p('• Calculates distance to next zone boundary'),
      p('• Applies GPS lag compensation'),
      p('• Warns if speed DECREASE ahead'),
      p('• Amber border for approaching speed decrease'),

      new PageBreak(),

      heading1('4. localStorage Pattern'),
      
      p('Override data stored in browser localStorage:'),
      p('• Persistent across sessions'),
      p('• No server-side storage required'),
      p('• Works on all hosting platforms'),

      heading1('4.1 Data Flow'),
      p('1. User adds override in UI'),
      p('2. Data saved to localStorage'),
      p('3. On next GPS position update:'),
      p('4. currentOverrideZone recomputed'),
      p('5. Visual indicator updates if in zone'),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('docs/TC_Work_Zone_Locator_Program_Logic.docx', buffer);
  console.log('✅ Updated: docs/TC_Work_Zone_Locator_Program_Logic.docx');
});
