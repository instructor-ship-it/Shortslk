#!/usr/bin/env node
/**
 * Download signage data from MRWA ArcGIS API
 * Run with: node scripts/download-signage.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'public', 'data');

const MRWA_PORTAL = 'https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer';

const BATCH_SIZE = 500;
const MAX_RECORDS = 150000; // Safety limit

async function fetchAllRecords(layerId, outFields) {
  console.log(`Fetching Layer ${layerId}...`);
  const records = [];
  let offset = 0;
  
  while (true) {
    const url = `${MRWA_PORTAL}/${layerId}/query?where=1%3D1&outFields=${encodeURIComponent(outFields)}&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${BATCH_SIZE}&f=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const features = data.features || [];
    
    for (const feature of features) {
      records.push(feature.attributes);
    }
    
    console.log(`  Fetched ${records.length} records...`);
    
    if (features.length < BATCH_SIZE) {
      break;
    }
    
    offset += BATCH_SIZE;
    
    if (records.length >= MAX_RECORDS) {
      console.log(`  Reached safety limit of ${MAX_RECORDS}`);
      break;
    }
  }
  
  return records;
}

async function main() {
  // Ensure data directory exists
  mkdirSync(DATA_DIR, { recursive: true });
  
  // Download Rail Crossings (Layer 15)
  console.log('\n=== Downloading Rail Crossings (Layer 15) ===');
  const railCrossingsRaw = await fetchAllRecords(15, 'ROAD,ROAD_NAME,START_SLK,END_SLK,CWY,XING_TYPE,XING_NO');
  
  const railCrossings = railCrossingsRaw.map(attr => ({
    road_id: attr.ROAD || '',
    road_name: attr.ROAD_NAME || '',
    slk: attr.START_SLK || 0,
    carriageway: attr.CWY || 'Single',
    crossing_type: attr.XING_TYPE || 'Unknown',
    crossing_no: attr.XING_NO || ''
  }));
  
  writeFileSync(join(DATA_DIR, 'rail-crossings.json'), JSON.stringify({ railCrossings }, null, 2));
  console.log(`✓ Saved ${railCrossings.length} rail crossings to rail-crossings.json`);
  
  // Download Regulatory Signs (Layer 22)
  console.log('\n=== Downloading Regulatory Signs (Layer 22) ===');
  const regulatorySignsRaw = await fetchAllRecords(22, 'ROAD,ROAD_NAME,SLK,CWY,PANEL_01_DESIGN,PANEL_01_DESIGN_MEANING,REGULATORY_SIGN_TYPE');
  
  const regulatorySigns = regulatorySignsRaw.map(attr => ({
    road_id: attr.ROAD || '',
    road_name: attr.ROAD_NAME || '',
    slk: attr.SLK || 0,
    carriageway: attr.CWY || 'Single',
    sign_type: attr.REGULATORY_SIGN_TYPE || 'Other',
    panel_design: attr.PANEL_01_DESIGN || '',
    panel_meaning: attr.PANEL_01_DESIGN_MEANING || ''
  }));
  
  writeFileSync(join(DATA_DIR, 'regulatory-signs.json'), JSON.stringify({ regulatorySigns }, null, 2));
  console.log(`✓ Saved ${regulatorySigns.length} regulatory signs to regulatory-signs.json`);
  
  // Download Warning Signs (Layer 23)
  console.log('\n=== Downloading Warning Signs (Layer 23) ===');
  const warningSignsRaw = await fetchAllRecords(23, 'ROAD,ROAD_NAME,SLK,CWY,PANEL_01_DESIGN,PANEL_01_DESIGN_MEANING,WARNING_SIGN_TYPE');
  
  const warningSigns = warningSignsRaw.map(attr => ({
    road_id: attr.ROAD || '',
    road_name: attr.ROAD_NAME || '',
    slk: attr.SLK || 0,
    carriageway: attr.CWY || 'Single',
    sign_type: attr.WARNING_SIGN_TYPE || 'Other',
    panel_design: attr.PANEL_01_DESIGN || '',
    panel_meaning: attr.PANEL_01_DESIGN_MEANING || ''
  }));
  
  writeFileSync(join(DATA_DIR, 'warning-signs.json'), JSON.stringify({ warningSigns }, null, 2));
  console.log(`✓ Saved ${warningSigns.length} warning signs to warning-signs.json`);
  
  console.log('\n=== Summary ===');
  console.log(`Rail Crossings: ${railCrossings.length}`);
  console.log(`Regulatory Signs: ${regulatorySigns.length}`);
  console.log(`Warning Signs: ${warningSigns.length}`);
  console.log('\nAll files saved to public/data/');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
