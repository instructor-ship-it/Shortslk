import { NextRequest, NextResponse } from 'next/server';

const MRWA_BASE = 'https://mrgis.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_Data/MapServer';
const MRWA_PORTAL = 'https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer';

const FETCH_TIMEOUT = 30000;

interface RoadFeature {
  attributes: {
    ROAD_ID: string;
    ROAD_NAME: string;
    ROAD_NETWORK_TYPE: string;
    START_SLK: number;
    END_SLK: number;
    CWY: string;
  };
  geometry: {
    paths: number[][][];
  };
}

interface SpeedZoneFeature {
  attributes: {
    ROAD_ID: string;
    ROAD_NAME: string;
    START_SLK: number;
    END_SLK: number;
    SPEED_LIMIT: number;
    CWY: string;
  };
}

async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT): Promise<{ ok: boolean; data?: any; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data.error) {
      return { ok: false, error: data.error.message || 'API error' };
    }
    
    return { ok: true, data };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return { ok: false, error: error.message || 'Unknown error' };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const region = searchParams.get('region');
  const dataType = searchParams.get('dataType'); // 'roads', 'signs', 'all'
  
  if (action === 'test') {
    // Test connectivity to MRWA
    const testUrl = `${MRWA_BASE}/18?f=json`;
    const result = await fetchWithTimeout(testUrl, 10000);
    
    return NextResponse.json({
      connected: result.ok,
      error: result.error,
      layer: result.data?.name || null,
      message: result.ok 
        ? 'Successfully connected to MRWA' 
        : `Cannot connect to MRWA: ${result.error}`
    });
  }
  
  if (action === 'download' && region) {
    // Download a specific region using simple query
    try {
      const roads: any[] = [];
      const speedZones: any[] = [];
      const railCrossings: any[] = [];
      const regulatorySigns: any[] = [];
      const warningSigns: any[] = [];
      
      // Use a simpler WHERE clause - just get roads starting with specific letters
      let whereClause = "1=1";
      
      // Region-based filtering by ROAD_ID prefix
      if (region === 'Wheatbelt') {
        whereClause = "ROAD_ID LIKE 'W%'";
      } else if (region === 'Metropolitan') {
        whereClause = "(ROAD_ID LIKE 'H%' OR ROAD_ID LIKE 'M%')";
      } else if (region === 'South West') {
        whereClause = "ROAD_ID LIKE 'S%'";
      } else if (region === 'Goldfields-Esperance') {
        whereClause = "ROAD_ID LIKE 'G%'";
      } else if (region === 'Pilbara') {
        whereClause = "(ROAD_ID LIKE 'P%' OR ROAD_ID LIKE 'GR%')";
      } else if (region === 'Kimberley') {
        whereClause = "ROAD_ID LIKE 'K%'";
      } else if (region === 'Mid West') {
        whereClause = "ROAD_ID LIKE 'MID%'";
      } else if (region === 'Great Southern') {
        whereClause = "ROAD_ID LIKE 'GT%'";
      } else if (region === 'Gascoyne') {
        whereClause = "ROAD_ID LIKE 'GAS%'";
      }
      
      // Exclude local roads for road network
      const roadWhereClause = whereClause + " AND ROAD_NETWORK_TYPE <> 'Local Road'";
      
      console.log(`Downloading ${region} with WHERE: ${whereClause}`);
      
      // Fetch roads in batches
      let offset = 0;
      const batchSize = 200;
      let hasMore = true;
      
      // ========== FETCH ROADS (Layer 18) ==========
      while (hasMore) {
        const url = `${MRWA_BASE}/18/query?where=${encodeURIComponent(roadWhereClause)}&outFields=ROAD_ID,ROAD_NAME,ROAD_NETWORK_TYPE,START_SLK,END_SLK,CWY&returnGeometry=true&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
        
        const result = await fetchWithTimeout(url, 25000);
        
        if (!result.ok) {
          console.error(`Failed to fetch ${region} at offset ${offset}:`, result.error);
          if (offset === 0) {
            return NextResponse.json({
              error: `Cannot fetch roads for ${region}`,
              details: result.error,
              roads: [],
              speedZones: [],
              count: 0
            }, { status: 500 });
          }
          break;
        }
        
        const features = result.data?.features || [];
        
        if (features.length === 0) {
          hasMore = false;
          break;
        }
        
        // Process features
        for (const feature of features) {
          const roadId = feature.attributes.ROAD_ID;
          let roadEntry = roads.find(r => r.road_id === roadId);
          
          if (!roadEntry) {
            roadEntry = {
              road_id: roadId,
              road_name: feature.attributes.ROAD_NAME || '',
              min_slk: feature.attributes.START_SLK || 0,
              max_slk: feature.attributes.END_SLK || 0,
              network_type: feature.attributes.ROAD_NETWORK_TYPE || 'State Road',
              segments: []
            };
            roads.push(roadEntry);
          }
          
          roadEntry.min_slk = Math.min(roadEntry.min_slk, feature.attributes.START_SLK || 0);
          roadEntry.max_slk = Math.max(roadEntry.max_slk, feature.attributes.END_SLK || 0);
          
          const geometry = feature.geometry?.paths?.[0];
          if (geometry && geometry.length >= 2) {
            const convertedGeometry = geometry.map((point: number[]) => [point[1], point[0]]);
            roadEntry.segments.push({
              start_slk: feature.attributes.START_SLK || 0,
              end_slk: feature.attributes.END_SLK || 0,
              geometry: convertedGeometry
            });
          }
        }
        
        console.log(`${region}: fetched ${roads.length} roads so far...`);
        
        if (features.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        
        if (offset > 3000) {
          console.log(`${region}: reached safety limit`);
          break;
        }
      }
      
      // ========== FETCH SPEED ZONES (Layer 8) ==========
      offset = 0;
      hasMore = true;
      
      while (hasMore) {
        const url = `${MRWA_PORTAL}/8/query?where=${encodeURIComponent(whereClause)}&outFields=ROAD_ID,ROAD_NAME,START_SLK,END_SLK,SPEED_LIMIT,CWY&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
        
        const result = await fetchWithTimeout(url, 20000);
        
        if (!result.ok) break;
        
        const features = result.data?.features || [];
        
        for (const feature of features) {
          speedZones.push({
            road_id: feature.attributes.ROAD_ID,
            road_name: feature.attributes.ROAD_NAME || '',
            start_slk: feature.attributes.START_SLK || 0,
            end_slk: feature.attributes.END_SLK || 0,
            speed_limit: feature.attributes.SPEED_LIMIT || 100,
            carriageway: feature.attributes.CWY || 'Single'
          });
        }
        
        if (features.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        
        if (offset > 2000) break;
      }
      
      // ========== FETCH RAIL CROSSINGS (Layer 15) ==========
      offset = 0;
      hasMore = true;
      
      while (hasMore) {
        const url = `${MRWA_PORTAL}/15/query?where=${encodeURIComponent(whereClause)}&outFields=ROAD,ROAD_NAME,START_SLK,END_SLK,CWY,XING_TYPE,XING_NO&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
        
        const result = await fetchWithTimeout(url, 20000);
        
        if (!result.ok) break;
        
        const features = result.data?.features || [];
        
        for (const feature of features) {
          railCrossings.push({
            road_id: feature.attributes.ROAD || '',
            road_name: feature.attributes.ROAD_NAME || '',
            slk: feature.attributes.START_SLK || 0,
            carriageway: feature.attributes.CWY || 'Single',
            crossing_type: feature.attributes.XING_TYPE || 'Unknown',
            crossing_no: feature.attributes.XING_NO || ''
          });
        }
        
        if (features.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        
        if (offset > 500) break; // Fewer rail crossings expected
      }
      
      // ========== FETCH REGULATORY SIGNS (Layer 22) ==========
      offset = 0;
      hasMore = true;
      
      while (hasMore) {
        const url = `${MRWA_PORTAL}/22/query?where=${encodeURIComponent(whereClause)}&outFields=ROAD,ROAD_NAME,SLK,CWY,PANEL_01_DESIGN,PANEL_01_DESIGN_MEANING,REGULATORY_SIGN_TYPE&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
        
        const result = await fetchWithTimeout(url, 20000);
        
        if (!result.ok) break;
        
        const features = result.data?.features || [];
        
        for (const feature of features) {
          const design = feature.attributes.PANEL_01_DESIGN || '';
          const meaning = feature.attributes.PANEL_01_DESIGN_MEANING || '';
          
          regulatorySigns.push({
            road_id: feature.attributes.ROAD || '',
            road_name: feature.attributes.ROAD_NAME || '',
            slk: feature.attributes.SLK || 0,
            carriageway: feature.attributes.CWY || 'Single',
            sign_type: feature.attributes.REGULATORY_SIGN_TYPE || 'Other',
            panel_design: design,
            panel_meaning: meaning
          });
        }
        
        if (features.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        
        if (offset > 3000) break;
      }
      
      // ========== FETCH WARNING SIGNS (Layer 23) ==========
      offset = 0;
      hasMore = true;
      
      while (hasMore) {
        const url = `${MRWA_PORTAL}/23/query?where=${encodeURIComponent(whereClause)}&outFields=ROAD,ROAD_NAME,SLK,CWY,PANEL_01_DESIGN,PANEL_01_DESIGN_MEANING,WARNING_SIGN_TYPE&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
        
        const result = await fetchWithTimeout(url, 20000);
        
        if (!result.ok) break;
        
        const features = result.data?.features || [];
        
        for (const feature of features) {
          const design = feature.attributes.PANEL_01_DESIGN || '';
          const meaning = feature.attributes.PANEL_01_DESIGN_MEANING || '';
          
          warningSigns.push({
            road_id: feature.attributes.ROAD || '',
            road_name: feature.attributes.ROAD_NAME || '',
            slk: feature.attributes.SLK || 0,
            carriageway: feature.attributes.CWY || 'Single',
            sign_type: feature.attributes.WARNING_SIGN_TYPE || 'Other',
            panel_design: design,
            panel_meaning: meaning
          });
        }
        
        if (features.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        
        if (offset > 3000) break;
      }
      
      console.log(`${region}: completed with ${roads.length} roads, ${speedZones.length} speed zones, ${railCrossings.length} rail crossings, ${regulatorySigns.length} regulatory signs, ${warningSigns.length} warning signs`);
      
      return NextResponse.json({
        success: true,
        region,
        roads,
        speedZones,
        railCrossings,
        regulatorySigns,
        warningSigns,
        count: roads.length,
        speedZoneCount: speedZones.length,
        railCrossingCount: railCrossings.length,
        regulatorySignCount: regulatorySigns.length,
        warningSignCount: warningSigns.length
      });
      
    } catch (error: any) {
      return NextResponse.json({
        error: 'Failed to download region',
        details: error.message,
        roads: [],
        speedZones: [],
        count: 0
      }, { status: 500 });
    }
  }
  
  return NextResponse.json({ 
    error: 'Invalid action. Use ?action=test or ?action=download&region=RegionName' 
  }, { status: 400 });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    error: 'Use GET request with region parameter',
    usage: '/api/sync-data?action=download&region=Wheatbelt'
  }, { status: 400 });
}
