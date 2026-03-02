/**
 * API Route: /api/roads
 * 
 * Uses Main Roads WA ArcGIS API for accurate road data and GPS coordinates.
 * 
 * Actions:
 * - list: Get all roads
 * - detail: Get road details
 * - locate: Get GPS coordinates for a specific SLK
 */

import { NextResponse } from 'next/server';

const STATE_ROAD_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/24/query";
const ALL_ROADS_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/17/query"; // Layer 17 has RA_NAME for all roads
const SPEED_ZONE_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/8/query";

async function fetchArcGIS(params: Record<string, string>, baseUrl: string = STATE_ROAD_URL): Promise<any> {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  const response = await fetch(url.toString());
  return response.json();
}

function interpolateGpsFromGeometry(
  geometry: any,
  segmentStartSlk: number,
  segmentEndSlk: number,
  targetSlk: number
): { lat: number; lon: number } | null {
  if (!geometry?.paths || geometry.paths.length === 0) return null;
  
  const path = geometry.paths[0];
  if (path.length < 2) return null;
  
  const slkRange = segmentEndSlk - segmentStartSlk;
  if (slkRange <= 0) return null;
  
  const distances: number[] = [0];
  let totalDistance = 0;
  
  for (let i = 1; i < path.length; i++) {
    const [lon1, lat1] = path[i - 1];
    const [lon2, lat2] = path[i];
    totalDistance += Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
    distances.push(totalDistance);
  }
  
  if (totalDistance === 0) return { lat: path[0][1], lon: path[0][0] };
  
  const ratio = (targetSlk - segmentStartSlk) / slkRange;
  const targetDistance = ratio * totalDistance;
  
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= targetDistance || i === distances.length - 1) {
      const segRatio = distances[i] === distances[i - 1] ? 0 : 
        (targetDistance - distances[i - 1]) / (distances[i] - distances[i - 1]);
      
      const [lon1, lat1] = path[i - 1];
      const [lon2, lat2] = path[i];
      
      return {
        lon: lon1 + (lon2 - lon1) * segRatio,
        lat: lat1 + (lat2 - lat1) * segRatio
      };
    }
  }
  
  return { lat: path[path.length - 1][1], lon: path[path.length - 1][0] };
}

// Get speed limit for a specific road and SLK
async function getSpeedLimit(roadId: string, slk: number): Promise<{ speed: string; cwy: string }> {
  try {
    const query = {
      where: `ROAD = '${roadId}' AND START_SLK <= ${slk} AND END_SLK >= ${slk}`,
      outFields: "SPEED_LIMIT,CWY",
      returnGeometry: "false",
      f: "json"
    };
    
    const result = await fetchArcGIS(query, SPEED_ZONE_URL);
    
    if (result.features && result.features.length > 0) {
      const attrs = result.features[0].attributes;
      return {
        speed: attrs.SPEED_LIMIT || 'Unknown',
        cwy: attrs.CWY || 'Unknown'
      };
    }
    return { speed: 'Unknown', cwy: 'Unknown' };
  } catch {
    return { speed: 'Unknown', cwy: 'Unknown' };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  // REGIONS: Get list of available regions
  if (action === 'regions') {
    try {
      // Get all roads and extract unique regions
      const query = {
        where: "ROAD LIKE 'H%' OR ROAD LIKE 'M%'",
        outFields: "RA_NAME",
        returnGeometry: "false",
        f: "json",
        resultRecordCount: "2000"
      };
      
      const result = await fetchArcGIS(query);
      
      if (!result.features) {
        return NextResponse.json({ error: 'Failed to fetch regions' }, { status: 500 });
      }
      
      // Extract unique regions from features
      const regionSet = new Set<string>();
      for (const f of result.features) {
        const region = f.attributes.RA_NAME;
        if (region && region.trim() !== '') {
          regionSet.add(region.trim());
        }
      }
      
      const regions = Array.from(regionSet).sort();
      
      return NextResponse.json({ regions });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to fetch regions from MRWA API' }, { status: 500 });
    }
  }
  
  // LIST: Get all roads (optionally filtered by region)
  if (action === 'list') {
    const region = searchParams.get('region');
    
    try {
      // Build where clause - filter by region if provided
      let whereClause = "ROAD LIKE 'H%' OR ROAD LIKE 'M%'";
      if (region && region.trim() !== '') {
        whereClause = `(ROAD LIKE 'H%' OR ROAD LIKE 'M%') AND RA_NAME = '${region.replace(/'/g, "''")}'`;
      }
      
      const query = {
        where: whereClause,
        outFields: "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME",
        returnGeometry: "false",
        f: "json",
        resultRecordCount: "2000",
        orderByFields: "ROAD"
      };
      
      const result = await fetchArcGIS(query);
      
      if (!result.features) {
        return NextResponse.json({ error: 'Failed to fetch roads' }, { status: 500 });
      }
      
      // Aggregate SLK ranges per road
      const roadMap = new Map<string, { name: string; minSlk: number; maxSlk: number; region: string }>();
      
      for (const f of result.features) {
        const id = f.attributes.ROAD;
        const startSlk = f.attributes.START_SLK;
        const endSlk = f.attributes.END_SLK;
        
        if (roadMap.has(id)) {
          const existing = roadMap.get(id)!;
          existing.minSlk = Math.min(existing.minSlk, startSlk);
          existing.maxSlk = Math.max(existing.maxSlk, endSlk);
        } else {
          roadMap.set(id, {
            name: f.attributes.ROAD_NAME,
            minSlk: startSlk,
            maxSlk: endSlk,
            region: f.attributes.RA_NAME
          });
        }
      }
      
      const roads = Array.from(roadMap.entries()).map(([id, data]) => ({
        road_id: id,
        road_name: data.name,
        min_slk: data.minSlk,
        max_slk: data.maxSlk,
        region: data.region
      }));
      
      return NextResponse.json({ 
        roads: roads.sort((a, b) => a.road_id.localeCompare(b.road_id, undefined, { numeric: true }))
      });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to fetch roads from MRWA API' }, { status: 500 });
    }
  }
  
  // DETAIL: Get road details
  if (action === 'detail') {
    const roadId = searchParams.get('road_id');
    if (!roadId) {
      return NextResponse.json({ error: 'road_id required' }, { status: 400 });
    }
    
    try {
      const query = {
        where: `ROAD = '${roadId}'`,
        outFields: "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME",
        returnGeometry: "false",
        f: "json",
        resultRecordCount: "100"
      };
      
      const result = await fetchArcGIS(query);
      
      if (!result.features || result.features.length === 0) {
        return NextResponse.json({ error: 'Road not found' }, { status: 404 });
      }
      
      const segments = result.features.map((f: any) => ({
        start_slk: f.attributes.START_SLK,
        end_slk: f.attributes.END_SLK,
        region: f.attributes.RA_NAME
      }));
      
      const minSlk = Math.min(...segments.map((s: any) => s.start_slk));
      const maxSlk = Math.max(...segments.map((s: any) => s.end_slk));
      
      return NextResponse.json({
        road: {
          road_id: roadId,
          road_name: result.features[0].attributes.ROAD_NAME,
          min_slk: minSlk,
          max_slk: maxSlk,
          segments: segments
        }
      });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to fetch road details' }, { status: 500 });
    }
  }
  
  // LOCATE: Get GPS coordinates for SLK
  if (action === 'locate') {
    const roadId = searchParams.get('road_id');
    const slkStr = searchParams.get('slk');
    
    if (!roadId || !slkStr) {
      return NextResponse.json({ error: 'road_id and slk required' }, { status: 400 });
    }
    
    const targetSlk = parseFloat(slkStr);
    if (isNaN(targetSlk)) {
      return NextResponse.json({ error: 'Invalid SLK value' }, { status: 400 });
    }
    
    try {
      const query = {
        where: `ROAD = '${roadId}' AND START_SLK <= ${targetSlk} AND END_SLK >= ${targetSlk}`,
        outFields: "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME",
        returnGeometry: "true",
        f: "json"
      };
      
      const result = await fetchArcGIS(query);
      
      if (!result.features || result.features.length === 0) {
        // Try to find closest segment
        const rangeQuery = {
          where: `ROAD = '${roadId}'`,
          outFields: "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME",
          returnGeometry: "true",
          f: "json",
          resultRecordCount: "100"
        };
        
        const rangeResult = await fetchArcGIS(rangeQuery);
        
        if (!rangeResult.features || rangeResult.features.length === 0) {
          return NextResponse.json({ error: 'Road not found' }, { status: 404 });
        }
        
        let closest: any = null;
        let minDist = Infinity;
        
        for (const f of rangeResult.features) {
          const dist = Math.min(
            Math.abs(targetSlk - f.attributes.START_SLK),
            Math.abs(targetSlk - f.attributes.END_SLK)
          );
          if (dist < minDist) {
            minDist = dist;
            closest = f;
          }
        }
        
        if (closest && minDist < 5) {
          const coords = interpolateGpsFromGeometry(
            closest.geometry,
            closest.attributes.START_SLK,
            closest.attributes.END_SLK,
            targetSlk
          );
          
          if (coords) {
            return NextResponse.json({
              road_id: roadId,
              road_name: closest.attributes.ROAD_NAME,
              slk: targetSlk,
              latitude: coords.lat,
              longitude: coords.lon,
              speed_limit: 'Unknown',
              google_maps_url: `https://www.google.com/maps?q=${coords.lat},${coords.lon}`,
              google_maps_directions: `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}`,
              note: `SLK ${targetSlk} is outside the road range. Nearest position found.`
            });
          }
        }
        
        return NextResponse.json({ 
          error: `SLK ${targetSlk} is out of range for road ${roadId}` 
        }, { status: 400 });
      }
      
      const feature = result.features[0];
      const attrs = feature.attributes;
      const coords = interpolateGpsFromGeometry(feature.geometry, attrs.START_SLK, attrs.END_SLK, targetSlk);
      
      if (!coords) {
        return NextResponse.json({ error: 'Could not determine GPS coordinates' }, { status: 500 });
      }
      
      return NextResponse.json({
        road_id: attrs.ROAD,
        road_name: attrs.ROAD_NAME,
        slk: targetSlk,
        latitude: coords.lat,
        longitude: coords.lon,
        speed_limit: 'Unknown',
        google_maps_url: `https://www.google.com/maps?q=${coords.lat},${coords.lon}`,
        google_maps_directions: `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}`
      });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to get GPS coordinates' }, { status: 500 });
    }
  }
  
  return NextResponse.json({ error: 'Invalid action. Use: list, detail, or locate' }, { status: 400 });
}

// Work Zone POST handler
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { road_id, start_slk, end_slk } = body;
    
    if (!road_id || start_slk === undefined) {
      return NextResponse.json({ error: 'road_id and start_slk required' }, { status: 400 });
    }
    
    const startSlk = parseFloat(start_slk);
    const endSlk = end_slk !== undefined ? parseFloat(end_slk) : undefined;
    
    if (isNaN(startSlk) || (endSlk !== undefined && isNaN(endSlk))) {
      return NextResponse.json({ error: 'Invalid SLK values' }, { status: 400 });
    }
    
    if (endSlk !== undefined && startSlk > endSlk) {
      return NextResponse.json({ error: 'Start SLK must be less than or equal to End SLK' }, { status: 400 });
    }
    
    // Calculate TC Zone
    const tcStartSlk = startSlk - 0.1;
    const tcEndSlk = endSlk !== undefined ? endSlk + 0.1 : startSlk + 0.1;
    
    // Determine if this is a state road (H/M prefix) or local road
    const isStateRoad = road_id.startsWith('H') || road_id.startsWith('M');
    const roadLayerUrl = isStateRoad ? STATE_ROAD_URL : ALL_ROADS_URL;
    
    // Get road geometry within TC zone
    const query = {
      where: `ROAD = '${road_id}' AND START_SLK < ${tcEndSlk} AND END_SLK > ${tcStartSlk}`,
      outFields: "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME,NETWORK_TYPE",
      returnGeometry: "true",
      f: "json"
    };
    
    let result = await fetchArcGIS(query, roadLayerUrl);
    
    // If not found in expected layer, try the other layer
    if (!result.features || result.features.length === 0) {
      const fallbackUrl = isStateRoad ? ALL_ROADS_URL : STATE_ROAD_URL;
      result = await fetchArcGIS(query, fallbackUrl);
    }
    
    if (!result.features || result.features.length === 0) {
      return NextResponse.json({ error: 'Road not found or SLK range out of bounds' }, { status: 404 });
    }
    
    const getPosition = (slk: number) => {
      for (const f of result.features) {
        if (slk >= f.attributes.START_SLK && slk <= f.attributes.END_SLK) {
          return interpolateGpsFromGeometry(f.geometry, f.attributes.START_SLK, f.attributes.END_SLK, slk);
        }
      }
      return null;
    };
    
    const attrs = result.features[0].attributes;
    const networkType = attrs.NETWORK_TYPE || (isStateRoad ? 'State Road' : 'Local Road');
    
    const tcStart = getPosition(tcStartSlk);
    const tcEnd = getPosition(tcEndSlk);
    const workZoneStart = getPosition(startSlk);
    const workZoneEnd = endSlk !== undefined ? getPosition(endSlk) : null;
    const midSlk = (tcStartSlk + tcEndSlk) / 2;
    const midPosition = getPosition(midSlk);
    
    // Calculate TC zone length
    let tcLengthM = 0;
    if (tcStart && tcEnd) {
      const R = 6371000;
      const dLat = (tcEnd.lat - tcStart.lat) * Math.PI / 180;
      const dLon = (tcEnd.lon - tcStart.lon) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(tcStart.lat * Math.PI/180) * Math.cos(tcEnd.lat * Math.PI/180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      tcLengthM = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }
    
    // Calculate work zone length
    let workZoneLengthM = 0;
    if (endSlk !== undefined) {
      workZoneLengthM = Math.round((endSlk - startSlk) * 1000);
    }
    
    // Fetch speed limits for all positions (may not be available for local roads)
    const approachStartSpeed = await getSpeedLimit(road_id, startSlk - 0.2);
    const tcStartSpeed = await getSpeedLimit(road_id, tcStartSlk);
    const workZoneStartSpeed = await getSpeedLimit(road_id, startSlk);
    const workZoneEndSpeed = endSlk !== undefined ? await getSpeedLimit(road_id, endSlk) : workZoneStartSpeed;
    const tcEndSpeed = await getSpeedLimit(road_id, tcEndSlk);
    const approachEndSpeed = endSlk !== undefined ? await getSpeedLimit(road_id, endSlk + 0.2) : await getSpeedLimit(road_id, startSlk + 0.2);
    
    return NextResponse.json({
      road_id: attrs.ROAD,
      road_name: attrs.ROAD_NAME,
      network_type: networkType,
      
      // Work Zone (always provided)
      work_zone: {
        start_slk: startSlk,
        end_slk: endSlk !== undefined ? endSlk : startSlk,
        length_m: workZoneLengthM,
        start: workZoneStart ? { lat: workZoneStart.lat, lon: workZoneStart.lon, speed: workZoneStartSpeed.speed, cwy: workZoneStartSpeed.cwy } : null,
        end: workZoneEnd ? { lat: workZoneEnd.lat, lon: workZoneEnd.lon, speed: workZoneEndSpeed.speed, cwy: workZoneEndSpeed.cwy } : null,
      },
      
      // TC Positions (±100m from work zone)
      tc_positions: {
        start_slk: tcStartSlk,
        end_slk: tcEndSlk,
        start: tcStart ? { lat: tcStart.lat, lon: tcStart.lon, speed: tcStartSpeed.speed, cwy: tcStartSpeed.cwy } : null,
        end: tcEnd ? { lat: tcEnd.lat, lon: tcEnd.lon, speed: tcEndSpeed.speed, cwy: tcEndSpeed.cwy } : null,
      },
      
      // Approach Signs (±200m from work zone)
      approach_signs: {
        start_slk: startSlk - 0.2,
        end_slk: endSlk !== undefined ? endSlk + 0.2 : startSlk + 0.2,
        start: null,
        end: null,
      },
      
      speed_zones: {
        approach_start: approachStartSpeed.speed,
        tc_start: tcStartSpeed.speed,
        work_zone_start: workZoneStartSpeed.speed,
        work_zone_end: workZoneEndSpeed.speed,
        tc_end: tcEndSpeed.speed,
        approach_end: approachEndSpeed.speed,
      },
      
      carriageway: workZoneStartSpeed.cwy,
      
      midpoint: midPosition ? { lat: midPosition.lat, lon: midPosition.lon, slk: midSlk } : null,
      
      google_maps: {
        work_zone_start: workZoneStart ? `https://www.google.com/maps/dir/?api=1&destination=${workZoneStart.lat},${workZoneStart.lon}` : null,
        work_zone_end: workZoneEnd ? `https://www.google.com/maps/dir/?api=1&destination=${workZoneEnd.lat},${workZoneEnd.lon}` : null,
        tc_start: tcStart ? `https://www.google.com/maps/dir/?api=1&destination=${tcStart.lat},${tcStart.lon}` : null,
        tc_end: tcEnd ? `https://www.google.com/maps/dir/?api=1&destination=${tcEnd.lat},${tcEnd.lon}` : null,
      },
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process work zone request' }, { status: 500 });
  }
}
