/**
 * Multi-Source Speed Limit Verification API
 * 
 * Cross-references speed limits from multiple sources:
 * - MRWA (Western Australia Government)
 * - OpenStreetMap
 * - Google Roads API (paid)
 * - TomTom (free tier available)
 * - HERE Maps (free tier available)
 * - Mapbox (free tier available)
 */

import { NextRequest, NextResponse } from 'next/server'

// API Configuration
const APIS = {
  google: {
    name: 'Google Roads API',
    requiresKey: true,
    pricing: '$0.02 per request (1000 requests = $20)',
    freeQuota: '$200 monthly credit (10,000 requests)',
    url: 'https://roads.googleapis.com/v1/speedLimits',
    docs: 'https://developers.google.com/maps/documentation/roads/speed-limits'
  },
  tomtom: {
    name: 'TomTom Snap to Roads',
    requiresKey: true,
    pricing: 'Free tier: 2,500 requests/day',
    freeQuota: '2,500 requests/day free',
    url: 'https://api.tomtom.com/routing/1/snapToRoads',
    docs: 'https://developer.tomtom.com/snap-to-roads-api'
  },
  here: {
    name: 'HERE Route Matching',
    requiresKey: true,
    pricing: 'Free tier: 250,000 requests/month',
    freeQuota: '250,000 requests/month free',
    url: 'https://routematching.hereapi.com/v8/match',
    docs: 'https://www.here.com/learn/blog/finding-speed-limit-hls'
  },
  mapbox: {
    name: 'Mapbox Map Matching',
    requiresKey: true,
    pricing: 'Free tier: 100,000 requests/month',
    freeQuota: '100,000 requests/month free',
    url: 'https://api.mapbox.com/matching/v5/mapbox/driving',
    docs: 'https://docs.mapbox.com/api/navigation/map-matching'
  }
}

// Note: Waze does NOT provide a public speed limit API
// Waze only offers traffic data feeds for government partners
// Their speed limit data is proprietary and used only in their app

interface SpeedLimitResult {
  source: string
  speed_limit: number | null
  speed_limit_raw: string | null
  confidence: 'high' | 'medium' | 'low'
  last_updated: string | null
  error?: string
}

/**
 * Query Google Roads API for speed limits
 * Requires: GOOGLE_MAPS_API_KEY environment variable
 */
async function queryGoogleSpeedLimit(lat: number, lon: number): Promise<SpeedLimitResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  
  if (!apiKey) {
    return {
      source: 'Google Roads',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: 'API key not configured'
    }
  }
  
  try {
    const url = `https://roads.googleapis.com/v1/speedLimits?path=${lat},${lon}&key=${apiKey}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.speedLimits && data.speedLimits.length > 0) {
      const limit = data.speedLimits[0]
      return {
        source: 'Google Roads',
        speed_limit: limit.speedLimit ? Math.round(limit.speedLimit * 3.6) : null, // Convert m/s to km/h
        speed_limit_raw: limit.speedLimit ? `${limit.speedLimit} m/s` : null,
        confidence: 'high',
        last_updated: new Date().toISOString()
      }
    }
    
    return {
      source: 'Google Roads',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: 'No speed limit found'
    }
  } catch (error: any) {
    return {
      source: 'Google Roads',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: error.message
    }
  }
}

/**
 * Query TomTom Snap to Roads API
 * Requires: TOMTOM_API_KEY environment variable
 */
async function queryTomTomSpeedLimit(lat: number, lon: number): Promise<SpeedLimitResult> {
  const apiKey = process.env.TOMTOM_API_KEY
  
  if (!apiKey) {
    return {
      source: 'TomTom',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: 'API key not configured'
    }
  }
  
  try {
    const url = `https://api.tomtom.com/routing/1/snapToRoads?points=${lat},${lon}&key=${apiKey}&fields={projectedPoints{speedLimit}}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.projectedPoints && data.projectedPoints.length > 0) {
      const point = data.projectedPoints[0]
      const speedKmh = point.speedLimit ? Math.round(point.speedLimit * 3.6) : null
      return {
        source: 'TomTom',
        speed_limit: speedKmh,
        speed_limit_raw: point.speedLimit ? `${point.speedLimit} m/s` : null,
        confidence: 'high',
        last_updated: new Date().toISOString()
      }
    }
    
    return {
      source: 'TomTom',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: 'No speed limit found'
    }
  } catch (error: any) {
    return {
      source: 'TomTom',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: error.message
    }
  }
}

/**
 * Query HERE Route Matching API
 * Requires: HERE_API_KEY environment variable
 */
async function queryHERESpeedLimit(lat: number, lon: number): Promise<SpeedLimitResult> {
  const apiKey = process.env.HERE_API_KEY
  
  if (!apiKey) {
    return {
      source: 'HERE Maps',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: 'API key not configured'
    }
  }
  
  try {
    const url = `https://routematching.hereapi.com/v8/match?apiKey=${apiKey}&waypoints=${lat},${lon}&attributes=SPEED_LIMITS_FCn(1)`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.routes && data.routes[0]?.legs?.[0]) {
      const leg = data.routes[0].legs[0]
      const speedLimit = leg.speedLimit
      return {
        source: 'HERE Maps',
        speed_limit: speedLimit || null,
        speed_limit_raw: speedLimit ? `${speedLimit} km/h` : null,
        confidence: 'high',
        last_updated: new Date().toISOString()
      }
    }
    
    return {
      source: 'HERE Maps',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: 'No speed limit found'
    }
  } catch (error: any) {
    return {
      source: 'HERE Maps',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: error.message
    }
  }
}

/**
 * Query Mapbox Map Matching API
 * Requires: MAPBOX_ACCESS_TOKEN environment variable
 */
async function queryMapboxSpeedLimit(lat: number, lon: number): Promise<SpeedLimitResult> {
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN
  
  if (!accessToken) {
    return {
      source: 'Mapbox',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: 'API key not configured'
    }
  }
  
  try {
    // Mapbox uses lon,lat order
    const url = `https://api.mapbox.com/matching/v5/mapbox/driving/${lon},${lat}?access_token=${accessToken}&annotations=maxspeed`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.matchings && data.matchings[0]?.legs?.[0]) {
      const leg = data.matchings[0].legs[0]
      const maxSpeed = leg.annotation?.maxspeed?.[0]
      
      if (maxSpeed && typeof maxSpeed === 'number') {
        return {
          source: 'Mapbox',
          speed_limit: maxSpeed,
          speed_limit_raw: `${maxSpeed} km/h`,
          confidence: 'high',
          last_updated: new Date().toISOString()
        }
      }
    }
    
    return {
      source: 'Mapbox',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: 'No speed limit found'
    }
  } catch (error: any) {
    return {
      source: 'Mapbox',
      speed_limit: null,
      speed_limit_raw: null,
      confidence: 'low',
      last_updated: null,
      error: error.message
    }
  }
}

/**
 * GET - Get API info and status
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')
  
  if (action === 'sources') {
    // Return available sources and their status
    return NextResponse.json({
      sources: {
        mrwa: {
          name: 'MRWA (WA Government)',
          type: 'Static File',
          status: 'Available',
          cost: 'Free',
          coverage: 'Western Australia only',
          accuracy: 'Official government data'
        },
        osm: {
          name: 'OpenStreetMap',
          type: 'Static File',
          status: 'Available',
          cost: 'Free',
          coverage: 'Global',
          accuracy: 'Community-sourced, varies by region'
        },
        google: {
          ...APIS.google,
          status: process.env.GOOGLE_MAPS_API_KEY ? 'Configured' : 'Not configured',
          coverage: 'Global',
          accuracy: 'High - Google Maps data'
        },
        tomtom: {
          ...APIS.tomtom,
          status: process.env.TOMTOM_API_KEY ? 'Configured' : 'Not configured',
          coverage: 'Global',
          accuracy: 'High - TomTom maps data'
        },
        here: {
          ...APIS.here,
          status: process.env.HERE_API_KEY ? 'Configured' : 'Not configured',
          coverage: 'Global',
          accuracy: 'High - HERE maps data'
        },
        mapbox: {
          ...APIS.mapbox,
          status: process.env.MAPBOX_ACCESS_TOKEN ? 'Configured' : 'Not configured',
          coverage: 'Global (uses OSM data)',
          accuracy: 'Medium-High (based on OSM)'
        },
        waze: {
          name: 'Waze',
          type: 'API',
          status: 'Not available',
          cost: 'Partner only',
          coverage: 'Global',
          accuracy: 'High - but no public API',
          note: 'Waze does not provide public speed limit API. Only traffic data feeds for government partners.'
        }
      }
    })
  }
  
  if (action === 'verify') {
    // Verify speed limit from multiple sources for a specific location
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lon = parseFloat(searchParams.get('lon') || '0')
    
    if (!lat || !lon) {
      return NextResponse.json({ error: 'lat and lon parameters required' }, { status: 400 })
    }
    
    // Query all configured sources in parallel
    const results = await Promise.all([
      queryGoogleSpeedLimit(lat, lon),
      queryTomTomSpeedLimit(lat, lon),
      queryHERESpeedLimit(lat, lon),
      queryMapboxSpeedLimit(lat, lon)
    ])
    
    // Calculate consensus
    const validResults = results.filter(r => r.speed_limit !== null)
    const speeds = validResults.map(r => r.speed_limit!)
    
    let consensus: number | null = null
    let agreement = 0
    
    if (speeds.length > 0) {
      // Find most common speed
      const counts = new Map<number, number>()
      speeds.forEach(s => counts.set(s, (counts.get(s) || 0) + 1))
      
      let maxCount = 0
      counts.forEach((count, speed) => {
        if (count > maxCount) {
          maxCount = count
          consensus = speed
        }
      })
      
      agreement = speeds.length > 0 ? maxCount / speeds.length : 0
    }
    
    return NextResponse.json({
      location: { lat, lon },
      results,
      analysis: {
        sources_with_data: validResults.length,
        total_sources_queried: results.length,
        consensus_speed: consensus,
        agreement_rate: Math.round(agreement * 100) + '%',
        all_speeds: speeds,
        discrepancy: speeds.length > 1 ? Math.max(...speeds) - Math.min(...speeds) : 0
      }
    })
  }
  
  // Default: return usage info
  return NextResponse.json({
    usage: {
      sources: '?action=sources',
      verify: '?action=verify&lat=-31.95&lon=115.86'
    },
    note: 'Configure API keys in environment variables to enable external sources',
    env_vars: [
      'GOOGLE_MAPS_API_KEY',
      'TOMTOM_API_KEY', 
      'HERE_API_KEY',
      'MAPBOX_ACCESS_TOKEN'
    ]
  })
}
