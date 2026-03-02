#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Download ALL roads from Layer 17 (has RA_NAME for ALL roads including local)
 * Layer 17 = Road Network with region and local government info
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROADS_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/17/query";
const SPEED_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/8/query";

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function fetchAllRoads(batchSize = 1000) {
  const allFeatures = [];
  let offset = 0;
  let hasMore = true;
  
  console.log('Fetching all roads from Layer 17 (with regions)...');
  
  while (hasMore) {
    // Get all fields including RA_NAME (region) and LG_NAME (local government)
    const url = `${ROADS_URL}?where=1%3D1&outFields=ROAD,ROAD_NAME,START_SLK,END_SLK,NETWORK_TYPE,RA_NAME,LG_NAME&returnGeometry=true&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
    
    console.log(`  Batch ${Math.floor(offset/batchSize) + 1}: offset ${offset}...`);
    const data = await fetchJson(url);
    
    if (data.error) {
      console.error(`  Error: ${JSON.stringify(data.error)}`);
      break;
    }
    
    if (!data.features || data.features.length === 0) {
      console.log('  No more features');
      break;
    }
    
    allFeatures.push(...data.features);
    console.log(`  Got ${data.features.length} features, total: ${allFeatures.length}`);
    
    hasMore = data.exceededTransferLimit === true;
    offset += batchSize;
  }
  
  return allFeatures;
}

async function fetchAllSpeedZones(batchSize = 1000) {
  const allFeatures = [];
  let offset = 0;
  let hasMore = true;
  
  console.log('Fetching all speed zones...');
  
  while (hasMore) {
    const url = `${SPEED_URL}?where=1%3D1&outFields=ROAD,ROAD_NAME,START_SLK,END_SLK,SPEED_LIMIT,CWY&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
    
    const data = await fetchJson(url);
    
    if (data.error) {
      console.error(`  Error: ${JSON.stringify(data.error)}`);
      break;
    }
    if (!data.features || data.features.length === 0) break;
    
    allFeatures.push(...data.features);
    console.log(`  Got ${allFeatures.length} speed zones`);
    
    hasMore = data.exceededTransferLimit === true;
    offset += batchSize;
  }
  
  return allFeatures;
}

function processRoads(features) {
  const roadsMap = new Map();
  
  for (const f of features) {
    const roadId = f.attributes.ROAD;
    const region = f.attributes.RA_NAME || 'Unknown';
    const lgName = f.attributes.LG_NAME || '';
    
    let road = roadsMap.get(roadId);
    
    if (!road) {
      road = {
        road_id: roadId,
        road_name: f.attributes.ROAD_NAME || '',
        min_slk: f.attributes.START_SLK || 0,
        max_slk: f.attributes.END_SLK || 0,
        network_type: f.attributes.NETWORK_TYPE || 'Unknown',
        region: region,
        local_government: lgName,
        segments: []
      };
      roadsMap.set(roadId, road);
    }
    
    road.min_slk = Math.min(road.min_slk, f.attributes.START_SLK || 0);
    road.max_slk = Math.max(road.max_slk, f.attributes.END_SLK || 0);
    
    const geometry = f.geometry?.paths?.[0];
    if (geometry && geometry.length >= 2) {
      road.segments.push({
        start_slk: f.attributes.START_SLK || 0,
        end_slk: f.attributes.END_SLK || 0,
        geometry: geometry.map(p => [p[1], p[0]]) // lon,lat -> lat,lon
      });
    }
  }
  
  return Array.from(roadsMap.values());
}

async function main() {
  console.log('=== MRWA Road Data Downloader (Layer 17 - All Roads with Regions) ===\n');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Fetch all roads from Layer 17 (has region info for ALL roads)
  const roadFeatures = await fetchAllRoads();
  const roads = processRoads(roadFeatures);
  
  console.log(`\nProcessed ${roads.length} unique roads`);
  
  // Count by network type
  const typeCount = {};
  roads.forEach(r => {
    typeCount[r.network_type] = (typeCount[r.network_type] || 0) + 1;
  });
  console.log('\nRoads by type:');
  Object.entries(typeCount).forEach(([t, c]) => console.log(`  ${t}: ${c}`));
  
  // Group by region
  const regions = {
    'Metropolitan': [],
    'Wheatbelt': [],
    'South West': [],
    'Goldfields-Esperance': [],
    'Great Southern': [],
    'Kimberley': [],
    'Mid West-Gascoyne': [],
    'Pilbara': [],
    'Unknown': []
  };
  
  for (const road of roads) {
    const region = road.region;
    if (regions[region]) {
      regions[region].push(road);
    } else {
      regions['Unknown'].push(road);
    }
  }
  
  // Save each region
  const regionsList = [];
  for (const [regionName, regionRoads] of Object.entries(regions)) {
    if (regionRoads.length === 0) continue;
    
    const filename = `roads-${regionName.toLowerCase().replace(/[^a-z]/g, '-')}.json`;
    fs.writeFileSync(
      path.join(OUTPUT_DIR, filename),
      JSON.stringify({ region: regionName, roads: regionRoads }, null, 2)
    );
    console.log(`Saved ${regionName}: ${regionRoads.length} roads`);
    regionsList.push(regionName);
  }
  
  // Fetch speed zones
  const speedFeatures = await fetchAllSpeedZones();
  const speedZones = speedFeatures.map(f => {
    // Parse speed limit - MRWA returns it as "110km/h" string, extract the number
    let speedLimit = 100;
    const speedStr = f.attributes.SPEED_LIMIT;
    if (speedStr) {
      const match = String(speedStr).match(/(\d+)/);
      if (match) {
        speedLimit = parseInt(match[1], 10);
      }
    }
    return {
      road_id: f.attributes.ROAD,
      road_name: f.attributes.ROAD_NAME || '',
      start_slk: f.attributes.START_SLK || 0,
      end_slk: f.attributes.END_SLK || 0,
      speed_limit: speedLimit,
      carriageway: f.attributes.CWY || 'Single'
    };
  });
  
  console.log(`\nDownloaded ${speedZones.length} speed zones`);
  
  // Save files
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'speed-zones.json'),
    JSON.stringify({ speedZones }, null, 2)
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'metadata.json'),
    JSON.stringify({
      download_date: new Date().toISOString(),
      total_roads: roads.length,
      total_speed_zones: speedZones.length,
      regions: regionsList,
      source: 'Layer 17 - Road Network (with RA_NAME)'
    }, null, 2)
  );
  
  console.log(`\n=== Complete ===`);
  console.log(`Total: ${roads.length} roads, ${speedZones.length} speed zones`);
  
  // Show sample roads
  console.log(`\nSample roads with correct regions:`);
  const sampleRoads = ['H005', 'M056', 'P001', '4211006'];
  for (const roadId of sampleRoads) {
    const road = roads.find(r => r.road_id === roadId);
    if (road) {
      console.log(`  ${road.road_id} (${road.road_name.substring(0,25)}): ${road.region} - ${road.network_type}`);
    }
  }
}

main().catch(console.error);
