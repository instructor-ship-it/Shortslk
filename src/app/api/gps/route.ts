/**
 * API Route: /api/gps
 * 
 * Reverse geocoding - converts GPS coordinates to Road ID, Name, SLK
 * Uses MRWA Layer 17 which includes ALL roads (State + Local) with RA_NAME
 */

import { NextResponse } from 'next/server';
import { haversineDistance } from '@/lib/utils';

const ROAD_NETWORK_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/17/query"; // Layer 17 has RA_NAME for all roads

interface RoadResult {
  road_id: string;
  road_name: string;
  slk: number;
  distance_m: number;
  region: string | null;
  carriageway: string | null;
  network_type: string | null;
}

async function fetchArcGIS(params: Record<string, string>): Promise<any> {
  const url = new URL(ROAD_NETWORK_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  const response = await fetch(url.toString());
  return response.json();
}

function calculateSlkForPoint(
  targetLon: number,
  targetLat: number,
  features: any[]
): RoadResult[] {
  const results: RoadResult[] = [];
  
  for (const f of features) {
    const attrs = f.attributes;
    const geom = f.geometry;
    const paths = geom?.paths || [];
    
    if (!paths.length) continue;
    
    const startSlk = attrs.START_SLK || 0;
    const endSlk = attrs.END_SLK || 0;
    const slkRange = endSlk - startSlk;
    
    let minDist = Infinity;
    let bestSlk = startSlk;
    
    for (const path of paths) {
      // Calculate total path length using Haversine for accuracy
      let totalLen = 0;
      const segments: Array<{len: number; x1: number; y1: number; x2: number; y2: number}> = [];
      
      for (let i = 1; i < path.length; i++) {
        const x1 = path[i-1][0], y1 = path[i-1][1]; // lon, lat
        const x2 = path[i][0], y2 = path[i][1];
        // Haversine: lat is y, lon is x - swap for haversineDistance(lat1, lon1, lat2, lon2)
        const len = haversineDistance(y1, x1, y2, x2);
        segments.push({len, x1, y1, x2, y2});
        totalLen += len;
      }
      
      // Find closest point on path
      let cumLen = 0;
      for (const seg of segments) {
        const {len, x1, y1, x2, y2} = seg;
        const dx = x2 - x1, dy = y2 - y1;
        const lengthSq = dx*dx + dy*dy;
        
        if (lengthSq > 0) {
          // Project in degree space for proportion
          const t = Math.max(0, Math.min(1, ((targetLon-x1)*dx + (targetLat-y1)*dy) / lengthSq));
          const cx = x1 + t * dx;
          const cy = y1 + t * dy;
          
          // Haversine distance for accuracy (lat=y, lon=x)
          const dist = haversineDistance(targetLat, targetLon, cy, cx);
          
          if (dist < minDist) {
            minDist = dist;
            const posLen = cumLen + (len * t);
            bestSlk = totalLen > 0 ? startSlk + (posLen / totalLen) * slkRange : startSlk;
          }
        }
        cumLen += len;
      }
    }
    
    if (minDist < Infinity) {
      results.push({
        road_id: attrs.ROAD,
        road_name: attrs.ROAD_NAME,
        slk: Math.round(bestSlk * 100) / 100,
        distance_m: Math.round(minDist * 10) / 10,
        region: attrs.RA_NAME || null,
        carriageway: attrs.CWY || null,
        network_type: attrs.NETWORK_TYPE || null
      });
    }
  }
  
  return results.sort((a, b) => a.distance_m - b.distance_m);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lonStr = searchParams.get('lon');
  const radiusStr = searchParams.get('radius'); // optional search radius in meters
  
  if (!latStr || !lonStr) {
    return NextResponse.json({ 
      error: 'lat and lon parameters required',
      example: '/api/gps?lat=-31.638157&lon=117.005277'
    }, { status: 400 });
  }
  
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  const radius = radiusStr ? parseFloat(radiusStr) : 500; // default 500m search
  
  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }
  
  try {
    // Calculate bounding box (approx 1 degree = 111km)
    const buffer = radius / 111000; // convert meters to degrees
    const bbox = `${lon - buffer},${lat - buffer},${lon + buffer},${lat + buffer}`;
    
    const query = {
      geometry: bbox,
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME,CWY,NETWORK_TYPE',
      returnGeometry: 'true',
      f: 'json',
      resultRecordCount: '50'
    };
    
    const result = await fetchArcGIS(query);
    
    if (!result.features || result.features.length === 0) {
      return NextResponse.json({
        error: 'No roads found near this location',
        lat,
        lon,
        search_radius_m: radius
      }, { status: 404 });
    }
    
    // Calculate SLK for each nearby road
    const roads = calculateSlkForPoint(lon, lat, result.features);
    
    if (roads.length === 0) {
      return NextResponse.json({
        error: 'Could not calculate SLK for nearby roads',
        lat,
        lon
      }, { status: 404 });
    }
    
    const closest = roads[0];
    
    return NextResponse.json({
      // Primary result - closest road
      road_id: closest.road_id,
      road_name: closest.road_name,
      slk: closest.slk,
      distance_m: closest.distance_m,
      carriageway: closest.carriageway,
      network_type: closest.network_type,
      region: closest.region,
      
      // Location
      lat,
      lon,
      
      // Other nearby roads (within 100m)
      nearby_roads: roads
        .filter(r => r.road_id !== closest.road_id && r.distance_m < 100)
        .slice(0, 5),
      
      // All roads within search radius
      all_roads: roads.slice(0, 10),
      
      // Google Maps link
      google_maps: `https://www.google.com/maps?q=${lat},${lon}`
    });
    
  } catch (error) {
    console.error('GPS lookup error:', error);
    return NextResponse.json({ error: 'Failed to lookup location' }, { status: 500 });
  }
}
