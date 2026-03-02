/**
 * Speed Limit Comparison API
 * 
 * Compares speed limits from MRWA and OpenStreetMap
 * to identify discrepancies and validate data accuracy.
 */

import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// Cache for loaded data
let mrwaData: any = null
let osmData: any = null
let comparisonCache: any = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Load MRWA speed zones from static file
 */
function loadMRWAData(): any {
  if (mrwaData) return mrwaData
  
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'speed-zones.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    mrwaData = JSON.parse(content)
    return mrwaData
  } catch (error) {
    console.error('Failed to load MRWA speed zones:', error)
    return null
  }
}

/**
 * Load OSM speed limits from static file
 */
function loadOSMData(): any {
  if (osmData) return osmData
  
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'osm-speed-limits.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    osmData = JSON.parse(content)
    return osmData
  } catch (error) {
    console.error('Failed to load OSM speed limits:', error)
    return null
  }
}

/**
 * Normalize road name for matching
 */
function normalizeRoadName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // Remove special chars
    .replace(/\s+/g, ' ')          // Normalize spaces
    .trim()
    .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|highway|hwy|freeway|fwy|boulevard|blvd|lane|ln|way|circuit|cct|place|pl|court|ct|parade|pde|crescent|cr|terrace|tce|loop|gateway|gwy|parkway|pwy)\b/g, '')
    .trim()
}

/**
 * Compare MRWA and OSM speed limits
 */
function compareSpeedLimits(): any {
  // Check cache
  if (comparisonCache && Date.now() - cacheTime < CACHE_TTL) {
    return comparisonCache
  }
  
  const mrwa = loadMRWAData()
  const osm = loadOSMData()
  
  if (!mrwa || !osm) {
    return { error: 'Failed to load data files' }
  }
  
  // Build MRWA lookup by normalized name
  const mrwaByName = new Map<string, any[]>()
  for (const zone of mrwa.speedZones || []) {
    const normalizedName = normalizeRoadName(zone.road_name || '')
    if (!normalizedName) continue
    
    if (!mrwaByName.has(normalizedName)) {
      mrwaByName.set(normalizedName, [])
    }
    mrwaByName.get(normalizedName)!.push(zone)
  }
  
  // Build OSM lookup by normalized name
  const osmByName = new Map<string, any>()
  for (const road of osm.roads || []) {
    const normalizedName = normalizeRoadName(road.road_name || '')
    if (!normalizedName) continue
    osmByName.set(normalizedName, road)
  }
  
  // Compare
  const matches: any[] = []
  const mrwaOnly: string[] = []
  const osmOnly: string[] = []
  const discrepancies: any[] = []
  
  // Find matches and discrepancies
  const processedMRWA = new Set<string>()
  
  for (const [normalizedName, osmRoad] of osmByName) {
    const mrwaZones = mrwaByName.get(normalizedName)
    
    if (mrwaZones && mrwaZones.length > 0) {
      processedMRWA.add(normalizedName)
      
      // Get unique speeds from each source
      const mrwaSpeeds = [...new Set(mrwaZones.map((z: any) => z.speed_limit))].sort((a, b) => a - b)
      const osmSpeeds = osmRoad.speed_limits || []
      
      // Check for discrepancies
      const speedsMatch = mrwaSpeeds.length === osmSpeeds.length && 
        mrwaSpeeds.every((s, i) => s === osmSpeeds[i])
      
      if (speedsMatch) {
        matches.push({
          road_name: osmRoad.road_name,
          mrwa_speeds: mrwaSpeeds,
          osm_speeds: osmSpeeds,
          match: 'exact'
        })
      } else {
        // Check for overlap
        const overlap = mrwaSpeeds.filter(s => osmSpeeds.includes(s))
        const mrwaOnlySpeeds = mrwaSpeeds.filter(s => !osmSpeeds.includes(s))
        const osmOnlySpeeds = osmSpeeds.filter(s => !mrwaSpeeds.includes(s))
        
        discrepancies.push({
          road_name: osmRoad.road_name,
          mrwa_speeds: mrwaSpeeds,
          osm_speeds: osmSpeeds,
          mrwa_segments: mrwaZones.length,
          osm_segments: osmRoad.segment_count,
          overlap_speeds: overlap,
          mrwa_only_speeds: mrwaOnlySpeeds,
          osm_only_speeds: osmOnlySpeeds,
          severity: mrwaSpeeds[0] !== osmSpeeds[0] ? 'high' : 'medium'
        })
      }
    } else {
      osmOnly.push(osmRoad.road_name)
    }
  }
  
  // Find MRWA-only roads
  for (const [normalizedName, zones] of mrwaByName) {
    if (!processedMRWA.has(normalizedName) && zones.length > 0) {
      mrwaOnly.push(zones[0].road_name)
    }
  }
  
  // Build result
  const result = {
    summary: {
      mrwa_total: mrwa.speedZones?.length || 0,
      osm_total: osm.total_segments || 0,
      mrwa_unique_roads: mrwaByName.size,
      osm_unique_roads: osmByName.size,
      matched_roads: matches.length + discrepancies.length,
      exact_matches: matches.length,
      discrepancies: discrepancies.length,
      mrwa_only: mrwaOnly.length,
      osm_only: osmOnly.length
    },
    matches: matches.slice(0, 100), // Limit for response size
    discrepancies: discrepancies
      .sort((a, b) => {
        // Sort by severity first, then by road name
        if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
        return a.road_name.localeCompare(b.road_name)
      })
      .slice(0, 500),
    mrwa_only_roads: mrwaOnly.slice(0, 200),
    osm_only_roads: osmOnly.slice(0, 200)
  }
  
  // Cache result
  comparisonCache = result
  cacheTime = Date.now()
  
  return result
}

/**
 * GET - Get comparison results
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')
  
  try {
    if (action === 'status') {
      // Check if data files exist
      const mrwaPath = path.join(process.cwd(), 'public', 'data', 'speed-zones.json')
      const osmPath = path.join(process.cwd(), 'public', 'data', 'osm-speed-limits.json')
      
      const mrwaExists = fs.existsSync(mrwaPath)
      const osmExists = fs.existsSync(osmPath)
      
      let mrwaStats: { total: number; download_date: string | null } | null = null
      let osmStats: { total_segments: number; unique_roads: number; download_date: string | null } | null = null
      
      if (mrwaExists) {
        const mrwa = loadMRWAData()
        mrwaStats = {
          total: mrwa?.speedZones?.length || 0,
          download_date: mrwa?.download_date || null
        }
      }
      
      if (osmExists) {
        const osm = loadOSMData()
        osmStats = {
          total_segments: osm?.total_segments || 0,
          unique_roads: osm?.unique_roads || 0,
          download_date: osm?.download_date || null
        }
      }
      
      return NextResponse.json({
        mrwa: { exists: mrwaExists, stats: mrwaStats },
        osm: { exists: osmExists, stats: osmStats },
        ready: mrwaExists && osmExists
      })
    }
    
    if (action === 'compare') {
      const result = compareSpeedLimits()
      return NextResponse.json(result)
    }
    
    if (action === 'discrepancies') {
      const result = compareSpeedLimits()
      const filter = searchParams.get('severity')
      
      let discrepancies = result.discrepancies || []
      if (filter === 'high') {
        discrepancies = discrepancies.filter((d: any) => d.severity === 'high')
      }
      
      return NextResponse.json({
        total: discrepancies.length,
        high_severity: discrepancies.filter((d: any) => d.severity === 'high').length,
        discrepancies: discrepancies
      })
    }
    
    if (action === 'road') {
      // Get comparison for a specific road
      const roadName = searchParams.get('name')
      if (!roadName) {
        return NextResponse.json({ error: 'Road name required' }, { status: 400 })
      }
      
      const mrwa = loadMRWAData()
      const osm = loadOSMData()
      
      const normalizedSearch = normalizeRoadName(roadName)
      
      // Find in MRWA
      const mrwaZones = (mrwa?.speedZones || []).filter(
        (z: any) => normalizeRoadName(z.road_name) === normalizedSearch
      )
      
      // Find in OSM
      const osmRoad = (osm?.roads || []).find(
        (r: any) => normalizeRoadName(r.road_name) === normalizedSearch
      )
      
      return NextResponse.json({
        road_name: roadName,
        mrwa: mrwaZones.length > 0 ? {
          segments: mrwaZones.length,
          speeds: [...new Set(mrwaZones.map((z: any) => z.speed_limit))].sort((a, b) => Number(a) - Number(b)),
          raw: mrwaZones.slice(0, 10)
        } : null,
        osm: osmRoad ? {
          speeds: osmRoad.speed_limits,
          highway_types: osmRoad.highway_types,
          segment_count: osmRoad.segment_count,
          regions: osmRoad.regions
        } : null
      })
    }
    
    // Default: return usage info
    return NextResponse.json({
      usage: {
        status: '?action=status',
        compare: '?action=compare',
        discrepancies: '?action=discrepancies[&severity=high]',
        road: '?action=road&name=Mitchell Freeway'
      }
    })
    
  } catch (error: any) {
    console.error('Speed comparison error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
