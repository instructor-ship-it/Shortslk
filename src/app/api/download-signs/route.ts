import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const MRWA_PORTAL = 'https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer';

const FETCH_TIMEOUT = 60000;

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
  const layer = searchParams.get('layer'); // 'rail', 'regulatory', 'warning', 'all'
  
  const results: any = {};
  
  try {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'public', 'data');
    await mkdir(dataDir, { recursive: true });
    
    const batchSize = 500;
    
    // Download Rail Crossings (Layer 15)
    if (layer === 'rail' || layer === 'all') {
      console.log('Downloading Rail Crossings (Layer 15)...');
      const railCrossings: any[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const url = `${MRWA_PORTAL}/15/query?where=1%3D1&outFields=ROAD,ROAD_NAME,START_SLK,END_SLK,CWY,XING_TYPE,XING_NO&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
        const result = await fetchWithTimeout(url, 45000);
        
        if (!result.ok) {
          results.railCrossings = { error: result.error };
          break;
        }
        
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
        
        console.log(`Rail crossings: ${railCrossings.length} fetched...`);
        
        if (features.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        
        if (offset > 5000) break; // Safety limit
      }
      
      // Save to file
      const filePath = path.join(dataDir, 'rail-crossings.json');
      await writeFile(filePath, JSON.stringify({ railCrossings }, null, 2));
      results.railCrossings = { count: railCrossings.length, file: 'rail-crossings.json' };
    }
    
    // Download Regulatory Signs (Layer 22)
    if (layer === 'regulatory' || layer === 'all') {
      console.log('Downloading Regulatory Signs (Layer 22)...');
      const regulatorySigns: any[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const url = `${MRWA_PORTAL}/22/query?where=1%3D1&outFields=ROAD,ROAD_NAME,SLK,CWY,PANEL_01_DESIGN,PANEL_01_DESIGN_MEANING,REGULATORY_SIGN_TYPE&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
        const result = await fetchWithTimeout(url, 45000);
        
        if (!result.ok) {
          results.regulatorySigns = { error: result.error };
          break;
        }
        
        const features = result.data?.features || [];
        
        for (const feature of features) {
          regulatorySigns.push({
            road_id: feature.attributes.ROAD || '',
            road_name: feature.attributes.ROAD_NAME || '',
            slk: feature.attributes.SLK || 0,
            carriageway: feature.attributes.CWY || 'Single',
            sign_type: feature.attributes.REGULATORY_SIGN_TYPE || 'Other',
            panel_design: feature.attributes.PANEL_01_DESIGN || '',
            panel_meaning: feature.attributes.PANEL_01_DESIGN_MEANING || ''
          });
        }
        
        console.log(`Regulatory signs: ${regulatorySigns.length} fetched...`);
        
        if (features.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        
        if (offset > 50000) break; // Safety limit
      }
      
      // Save to file
      const filePath = path.join(dataDir, 'regulatory-signs.json');
      await writeFile(filePath, JSON.stringify({ regulatorySigns }, null, 2));
      results.regulatorySigns = { count: regulatorySigns.length, file: 'regulatory-signs.json' };
    }
    
    // Download Warning Signs (Layer 23)
    if (layer === 'warning' || layer === 'all') {
      console.log('Downloading Warning Signs (Layer 23)...');
      const warningSigns: any[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const url = `${MRWA_PORTAL}/23/query?where=1%3D1&outFields=ROAD,ROAD_NAME,SLK,CWY,PANEL_01_DESIGN,PANEL_01_DESIGN_MEANING,WARNING_SIGN_TYPE&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${batchSize}&f=json`;
        const result = await fetchWithTimeout(url, 45000);
        
        if (!result.ok) {
          results.warningSigns = { error: result.error };
          break;
        }
        
        const features = result.data?.features || [];
        
        for (const feature of features) {
          warningSigns.push({
            road_id: feature.attributes.ROAD || '',
            road_name: feature.attributes.ROAD_NAME || '',
            slk: feature.attributes.SLK || 0,
            carriageway: feature.attributes.CWY || 'Single',
            sign_type: feature.attributes.WARNING_SIGN_TYPE || 'Other',
            panel_design: feature.attributes.PANEL_01_DESIGN || '',
            panel_meaning: feature.attributes.PANEL_01_DESIGN_MEANING || ''
          });
        }
        
        console.log(`Warning signs: ${warningSigns.length} fetched...`);
        
        if (features.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        
        if (offset > 50000) break; // Safety limit
      }
      
      // Save to file
      const filePath = path.join(dataDir, 'warning-signs.json');
      await writeFile(filePath, JSON.stringify({ warningSigns }, null, 2));
      results.warningSigns = { count: warningSigns.length, file: 'warning-signs.json' };
    }
    
    return NextResponse.json({
      success: true,
      message: 'Signage data downloaded successfully',
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }
}
