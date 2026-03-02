import { NextResponse } from 'next/server';

const STATE_ROAD_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/24/query";
const TRAFFIC_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/27/query";

async function fetchArcGIS(baseUrl: string, params: Record<string, string>): Promise<any> {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  const response = await fetch(url.toString());
  return response.json();
}

// Calculate distance between two points in km
function calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roadId = searchParams.get('road_id');
  const targetLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const targetLon = searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : null;

  if (!roadId) {
    return NextResponse.json({ error: 'road_id required' }, { status: 400 });
  }

  try {
    // Step 1: Get road name from road ID
    const roadQuery = {
      where: `ROAD = '${roadId}'`,
      outFields: "ROAD_NAME",
      returnGeometry: "false",
      f: "json",
      resultRecordCount: "1"
    };
    
    const roadResult = await fetchArcGIS(STATE_ROAD_URL, roadQuery);
    
    if (!roadResult.features || roadResult.features.length === 0) {
      return NextResponse.json({ 
        error: 'Road not found',
        road_id: roadId 
      }, { status: 404 });
    }
    
    const roadName = roadResult.features[0].attributes.ROAD_NAME;
    
    // Step 2: Search for traffic data by road name (get all sites with geometry)
    const trafficQuery = {
      where: `ROAD_NAME = '${roadName.replace(/'/g, "''")}'`,
      outFields: "SITE_NO,ROAD_NAME,LOCATION_DESC,TRAFFIC_YEAR,COLLECTION_TYPE,MON_SUN,MON_FRI,PCT_HEAVY_MON_SUN",
      returnGeometry: "true",
      f: "json",
      resultRecordCount: "100",
      orderByFields: "TRAFFIC_YEAR DESC"
    };
    
    const trafficResult = await fetchArcGIS(TRAFFIC_URL, trafficQuery);
    
    if (!trafficResult.features || trafficResult.features.length === 0) {
      return NextResponse.json({
        road_id: roadId,
        road_name: roadName,
        aadt: null,
        aadt_year: null,
        heavy_vehicle_percent: null,
        peak_hour_volume: null,
        source: 'No traffic data available',
        sites: []
      });
    }
    
    // Process all sites and calculate distance if target location provided
    const sites = trafficResult.features.map((f: any) => {
      const attrs = f.attributes;
      const geom = f.geometry;
      let distanceKm: number | null = null;
      
      if (targetLat && targetLon && geom?.x && geom?.y) {
        distanceKm = calcDistanceKm(targetLat, targetLon, geom.y, geom.x);
      }
      
      return {
        site_no: attrs.SITE_NO,
        location: attrs.LOCATION_DESC,
        year: attrs.TRAFFIC_YEAR,
        aadt: attrs.MON_SUN || attrs.MON_FRI || 0,
        heavy_percent: attrs.PCT_HEAVY_MON_SUN || 0,
        lat: geom?.y || null,
        lon: geom?.x || null,
        distance_km: distanceKm ? Math.round(distanceKm * 10) / 10 : null
      };
    });
    
    // Sort by distance if target location provided, otherwise by year
    if (targetLat && targetLon) {
      sites.sort((a: any, b: any) => (a.distance_km || Infinity) - (b.distance_km || Infinity));
    }
    
    // Get the closest/most recent site
    const closest = sites[0];
    
    // Get latest data by year for summary
    const byYear = new Map<string, { count: number; avgAadt: number; avgHeavy: number }>();
    for (const site of sites) {
      const year = site.year;
      if (!byYear.has(year)) {
        byYear.set(year, { count: 0, avgAadt: 0, avgHeavy: 0 });
      }
      const data = byYear.get(year)!;
      data.count++;
      data.avgAadt += site.aadt;
      data.avgHeavy += site.heavy_percent;
    }
    
    // Calculate averages
    const yearSummaries = Array.from(byYear.entries()).map(([year, data]) => ({
      year,
      site_count: data.count,
      avg_aadt: Math.round(data.avgAadt / data.count),
      avg_heavy_percent: Math.round(data.avgHeavy / data.count * 10) / 10
    })).sort((a, b) => b.year.localeCompare(a.year));
    
    return NextResponse.json({
      road_id: roadId,
      road_name: roadName,
      
      // Primary data from closest site
      aadt: closest.aadt,
      aadt_year: closest.year,
      heavy_vehicle_percent: Math.round(closest.heavy_percent * 10) / 10,
      peak_hour_volume: Math.round(closest.aadt * 0.1),
      source: `MRWA Traffic Digest (${closest.location})`,
      distance_to_site: closest.distance_km,
      
      // All sites summary
      total_sites: sites.length,
      
      // Top 5 closest sites
      nearest_sites: sites.slice(0, 5),
      
      // Year-by-year summaries
      yearly_summaries: yearSummaries.slice(0, 3),
      
      // Note about peak hour
      note: "Peak hour volume is estimated at 10% of AADT. MRWA Traffic Digest does not provide peak hour timing data."
    });
    
  } catch (error) {
    console.error('Traffic API error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch traffic data',
      road_id: roadId 
    }, { status: 500 });
  }
}
