/**
 * OpenStreetMap Speed Limit Import API
 * Queries OSM Overpass API for speed limits and stores in IndexedDB
 * Can cross-reference with MRWA road data for validation
 */

import { NextRequest, NextResponse } from 'next/server'

// Multiple Overpass API endpoints for reliability
const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
]

let currentEndpoint = 0

function getOverpassUrl(): string {
  return OVERPASS_ENDPOINTS[currentEndpoint]
}

function rotateEndpoint(): void {
  currentEndpoint = (currentEndpoint + 1) % OVERPASS_ENDPOINTS.length
}

// Western Australia bounding box (approximate)
const WA_BOUNDS = {
  south: -35.2,
  west: 112.9,
  north: -13.7,
  east: 129.0
}

// Perth Metro bounding box
const PERTH_METRO = {
  south: -32.5,
  west: 115.5,
  north: -31.5,
  east: 116.5
}

interface OSMWay {
  type: 'way'
  id: number
  nodes: number[]
  tags: {
    name?: string
    maxspeed?: string
    'maxspeed:forward'?: string
    'maxspeed:backward'?: string
    'source:maxspeed'?: string
    highway?: string
    ref?: string
  }
}

interface OSMSpeedLimit {
  osm_id: number
  road_name: string
  road_ref: string | null
  maxspeed: string
  maxspeed_forward: string | null
  maxspeed_backward: string | null
  source: string | null
  highway_type: string
  geometry?: number[][] // [lat, lon] pairs
}

/**
 * Parse speed limit string to numeric value
 * Handles formats like "60", "60 km/h", "50 mph", "AU:urban"
 */
function parseSpeedLimit(speedStr: string): number | null {
  if (!speedStr) return null

  // Already numeric
  if (/^\d+$/.test(speedStr)) {
    return parseInt(speedStr, 10)
  }

  // Extract number from "60 km/h" or "50 mph"
  const match = speedStr.match(/(\d+)/)
  if (match) {
    const value = parseInt(match[1], 10)
    // Convert mph to km/h if needed
    if (speedStr.toLowerCase().includes('mph')) {
      return Math.round(value * 1.60934)
    }
    return value
  }

  // Handle special values
  if (speedStr.includes('urban') || speedStr.includes('AU:urban')) {
    return 50 // Default urban speed in Australia
  }
  if (speedStr.includes('rural') || speedStr.includes('AU:rural')) {
    return 100 // Default rural speed in Australia
  }
  if (speedStr.includes('living_street')) {
    return 20
  }
  if (speedStr.includes('motorway')) {
    return 110
  }

  return null
}

/**
 * Fetch from Overpass API with automatic endpoint rotation on failure
 */
async function fetchOverpass(query: string): Promise<any> {
  const maxRetries = OVERPASS_ENDPOINTS.length
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const url = getOverpassUrl()
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        signal: AbortSignal.timeout(90000) // 90 second timeout
      })

      if (!response.ok) {
        console.warn(`Overpass endpoint ${url} returned ${response.status}, trying next...`)
        rotateEndpoint()
        continue
      }

      const data = await response.json()
      if (data.error) {
        console.warn(`Overpass API error: ${data.error}, trying next endpoint...`)
        rotateEndpoint()
        continue
      }

      return data
    } catch (error: any) {
      console.warn(`Overpass endpoint ${url} failed: ${error.message}, trying next...`)
      rotateEndpoint()
    }
  }

  throw new Error('All Overpass API endpoints failed')
}

/**
 * Query OSM Overpass API for speed limits in a bounding box
 */
async function queryOSMSpeedLimits(
  south: number,
  west: number,
  north: number,
  east: number,
  limit: number = 5000
): Promise<OSMSpeedLimit[]> {
  const query = `
    [out:json][timeout:120];
    way['highway']['maxspeed'](${south},${west},${north},${east});
    out body ${limit};
  `

  const data = await fetchOverpass(query)
  const elements: OSMWay[] = data.elements || []

  // Transform to our format
  const speedLimits: OSMSpeedLimit[] = elements
    .filter((el: any) => el.type === 'way' && el.tags?.maxspeed)
    .map((way: any) => ({
      osm_id: way.id,
      road_name: way.tags?.name || '',
      road_ref: way.tags?.ref || null,
      maxspeed: way.tags?.maxspeed || '',
      maxspeed_forward: way.tags?.['maxspeed:forward'] || null,
      maxspeed_backward: way.tags?.['maxspeed:backward'] || null,
      source: way.tags?.['source:maxspeed'] || null,
      highway_type: way.tags?.highway || 'unknown'
    }))

  return speedLimits
}

/**
 * Query OSM for a specific road by name
 */
async function queryRoadByName(roadName: string): Promise<OSMSpeedLimit[]> {
  const query = `
    [out:json][timeout:60];
    way['highway']['name'='${roadName.replace(/'/g, "\\'")}']['maxspeed'];
    out body;
  `

  const data = await fetchOverpass(query)
  const elements: OSMWay[] = data.elements || []

  return elements
    .filter((el: any) => el.type === 'way' && el.tags?.maxspeed)
    .map((way: any) => ({
      osm_id: way.id,
      road_name: way.tags?.name || '',
      road_ref: way.tags?.ref || null,
      maxspeed: way.tags?.maxspeed || '',
      maxspeed_forward: way.tags?.['maxspeed:forward'] || null,
      maxspeed_backward: way.tags?.['maxspeed:backward'] || null,
      source: way.tags?.['source:maxspeed'] || null,
      highway_type: way.tags?.highway || 'unknown'
    }))
}

/**
 * GET - Query OSM speed limits
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')

  try {
    if (action === 'query') {
      // Query by bounding box
      const south = parseFloat(searchParams.get('south') || String(PERTH_METRO.south))
      const west = parseFloat(searchParams.get('west') || String(PERTH_METRO.west))
      const north = parseFloat(searchParams.get('north') || String(PERTH_METRO.north))
      const east = parseFloat(searchParams.get('east') || String(PERTH_METRO.east))
      const limit = parseInt(searchParams.get('limit') || '5000', 10)

      const speedLimits = await queryOSMSpeedLimits(south, west, north, east, limit)

      // Group by road name
      const grouped: Record<string, {
        name: string
        ref: string | null
        limits: number[]
        highway_types: string[]
        sources: string[]
      }> = {}

      for (const sl of speedLimits) {
        const key = sl.road_name || `ref:${sl.road_ref || sl.osm_id}`
        if (!grouped[key]) {
          grouped[key] = {
            name: sl.road_name,
            ref: sl.road_ref,
            limits: [],
            highway_types: [],
            sources: []
          }
        }

        const speed = parseSpeedLimit(sl.maxspeed)
        if (speed && !grouped[key].limits.includes(speed)) {
          grouped[key].limits.push(speed)
        }

        if (sl.highway_type && !grouped[key].highway_types.includes(sl.highway_type)) {
          grouped[key].highway_types.push(sl.highway_type)
        }

        if (sl.source && !grouped[key].sources.includes(sl.source)) {
          grouped[key].sources.push(sl.source)
        }
      }

      return NextResponse.json({
        success: true,
        total: speedLimits.length,
        unique_roads: Object.keys(grouped).length,
        bounds: { south, west, north, east },
        speed_limits: Object.values(grouped)
      })
    }

    if (action === 'road') {
      // Query specific road by name
      const roadName = searchParams.get('name')
      if (!roadName) {
        return NextResponse.json({ error: 'Road name required' }, { status: 400 })
      }

      const speedLimits = await queryRoadByName(roadName)

      return NextResponse.json({
        success: true,
        road_name: roadName,
        segments: speedLimits.length,
        results: speedLimits.map((sl) => ({
          osm_id: sl.osm_id,
          maxspeed: sl.maxspeed,
          maxspeed_numeric: parseSpeedLimit(sl.maxspeed),
          highway_type: sl.highway_type,
          source: sl.source
        }))
      })
    }

    if (action === 'stats') {
      // Get statistics about OSM speed data coverage in WA
      const perthData = await queryOSMSpeedLimits(
        PERTH_METRO.south,
        PERTH_METRO.west,
        PERTH_METRO.north,
        PERTH_METRO.east,
        10000
      )

      const speedDistribution: Record<number, number> = {}
      const highwayTypes: Record<string, number> = {}

      for (const sl of perthData) {
        const speed = parseSpeedLimit(sl.maxspeed)
        if (speed) {
          speedDistribution[speed] = (speedDistribution[speed] || 0) + 1
        }
        highwayTypes[sl.highway_type] = (highwayTypes[sl.highway_type] || 0) + 1
      }

      return NextResponse.json({
        success: true,
        perth_metro: {
          total_ways: perthData.length,
          speed_distribution: Object.entries(speedDistribution)
            .map(([speed, count]) => ({ speed: parseInt(speed), count }))
            .sort((a, b) => b.count - a.count),
          highway_types: Object.entries(highwayTypes)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
        }
      })
    }

    return NextResponse.json({
      usage: {
        query: '?action=query&south=-32.5&west=115.5&north=-31.5&east=116.5',
        road: '?action=road&name=Great Eastern Highway',
        stats: '?action=stats'
      }
    })

  } catch (error: any) {
    console.error('OSM query error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to query OSM'
    }, { status: 500 })
  }
}

/**
 * POST - Bulk import OSM speed limits to indexed data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bounds, region } = body

    // Default to Perth Metro if no bounds specified
    const queryBounds = bounds || PERTH_METRO

    const speedLimits = await queryOSMSpeedLimits(
      queryBounds.south,
      queryBounds.west,
      queryBounds.north,
      queryBounds.east,
      10000
    )

    // Group by road name and deduplicate
    const roadSpeedMap: Record<string, {
      road_name: string
      speeds: number[]
      sources: string[]
      highway_types: string[]
      osm_ids: number[]
    }> = {}

    for (const sl of speedLimits) {
      const name = sl.road_name || sl.road_ref || `OSM_${sl.osm_id}`
      if (!roadSpeedMap[name]) {
        roadSpeedMap[name] = {
          road_name: name,
          speeds: [],
          sources: [],
          highway_types: [],
          osm_ids: []
        }
      }

      const speed = parseSpeedLimit(sl.maxspeed)
      if (speed && !roadSpeedMap[name].speeds.includes(speed)) {
        roadSpeedMap[name].speeds.push(speed)
      }

      if (sl.source && !roadSpeedMap[name].sources.includes(sl.source)) {
        roadSpeedMap[name].sources.push(sl.source)
      }

      if (sl.highway_type && !roadSpeedMap[name].highway_types.includes(sl.highway_type)) {
        roadSpeedMap[name].highway_types.push(sl.highway_type)
      }

      roadSpeedMap[name].osm_ids.push(sl.osm_id)
    }

    // Return data for client to store
    return NextResponse.json({
      success: true,
      region: region || 'custom',
      total_ways: speedLimits.length,
      unique_roads: Object.keys(roadSpeedMap).length,
      data: Object.values(roadSpeedMap).map((road) => ({
        road_name: road.road_name,
        speed_limits: road.speeds.sort((a, b) => a - b),
        primary_speed: road.speeds[0] || null,
        sources: road.sources,
        highway_types: road.highway_types,
        osm_way_count: road.osm_ids.length
      }))
    })

  } catch (error: any) {
    console.error('OSM import error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to import OSM data'
    }, { status: 500 })
  }
}
