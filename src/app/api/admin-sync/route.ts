/**
 * Admin Data Sync API
 * Downloads data from MRWA in chunks to avoid memory issues
 * Supports incremental updates for individual datasets
 */

import { NextRequest, NextResponse } from 'next/server'

// MRWA ArcGIS Server endpoints
// IMPORTANT: Use gisservices.mainroads.wa.gov.au (NOT mrgis) - mrgis is blocked from some networks
// Layer IDs from MRWA MapServer:
// - Layer 8: Legal Speed Limit (has SPEED_LIMIT field with actual speed data)
// - Layer 9: Legal Speed Zones (different schema, often empty)
const MRWA_BASE = 'https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer'
const ROAD_NETWORK_URL = `${MRWA_BASE}/17`  // Road Network (geometry, road info)
const SPEED_ZONES_URL = `${MRWA_BASE}/8`    // Legal Speed Limit (has SPEED_LIMIT field)
const RAIL_CROSSINGS_URL = `${MRWA_BASE}/15`
const REGULATORY_SIGNS_URL = `${MRWA_BASE}/22`
const WARNING_SIGNS_URL = `${MRWA_BASE}/23`

// Chunk size for fetching records (MRWA limits to 2000 per request)
const CHUNK_SIZE = 2000

// Timeout for MRWA requests (60 seconds - MRWA can be slow)
const MRWA_TIMEOUT = 60000

// Max retries for failed requests
const MAX_RETRIES = 3

/**
 * Fetch with timeout and retry
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = MRWA_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Fetch attempt ${attempt}/${retries}: ${url.substring(0, 100)}...`)
      const response = await fetchWithTimeout(url)
      if (response.ok) {
        return response
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch (error: any) {
      lastError = error
      console.error(`Attempt ${attempt} failed:`, error.message)
      if (attempt < retries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 2000))
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed')
}

interface SyncProgress {
  dataset: string
  total: number
  fetched: number
  percent: number
  status: 'fetching' | 'processing' | 'complete' | 'error'
  message: string
}

// Store active sync sessions
const activeSyncs = new Map<string, SyncProgress>()

/**
 * Fetch total record count from MRWA
 */
async function getRecordCount(url: string, where: string = '1=1'): Promise<number> {
  const params = new URLSearchParams({
    where,
    returnCountOnly: 'true',
    f: 'json'
  })

  const response = await fetchWithRetry(`${url}/query?${params}`)
  const data = await response.json()
  return data.count || 0
}

/**
 * Fetch records in chunks from MRWA
 * Uses resultOffset for proper pagination (MRWA limits to 2000 records per request)
 */
async function* fetchRecordsInChunks(
  url: string,
  where: string = '1=1',
  outFields: string = '*',
  orderByFields: string = 'OBJECTID'
): AsyncGenerator<{ features: any[]; fetched: number; total: number }, void, unknown> {
  // Get total count
  const total = await getRecordCount(url, where)
  console.log(`Total records to fetch: ${total}`)

  let offset = 0

  while (offset < total) {
    const params = new URLSearchParams({
      where,
      outFields,
      orderByFields,
      resultOffset: String(offset),
      resultRecordCount: String(CHUNK_SIZE),
      f: 'json',
      outSR: '4326'
    })

    const response = await fetchWithRetry(`${url}/query?${params}`)
    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    const features = data.features || []

    if (features.length === 0) {
      break
    }

    offset += features.length
    yield { features, fetched: offset, total }
  }
}

/**
 * Transform road network feature to road data
 */
function transformRoadFeature(feature: any): any {
  const attrs = feature.attributes
  const geometry = feature.geometry?.paths?.[0] || null

  return {
    road_id: attrs.ROAD_ID || attrs.ROAD || '',
    road_name: attrs.ROAD_NAME || '',
    min_slk: attrs.START_SLK || 0,
    max_slk: attrs.END_SLK || attrs.ROAD_LENGTH || 0,
    network_type: attrs.NETWORK_TYPE || attrs.ROAD_TYPE || 'State Road',
    region: attrs.REGION || attrs.RA_NAME || '',
    segments: geometry ? [{
      start_slk: attrs.START_SLK || 0,
      end_slk: attrs.END_SLK || attrs.ROAD_LENGTH || 0,
      geometry: geometry.map((p: number[]) => [p[1], p[0]]) // Swap lat/lon
    }] : []
  }
}

/**
 * Parse speed limit from MRWA text - handles default zones correctly
 * Default zones have text like "50km/h applies in built up areas or 110km/h outside built up areas"
 * These represent WA state default speed limits that apply automatically based on location
 */
function parseSpeedLimit(speedStr: string | number | undefined): {
  speed_limit: number;
  is_default: boolean;
  raw_text: string;
  requires_verification: boolean;
} {
  if (!speedStr) {
    return { speed_limit: 110, is_default: true, raw_text: '', requires_verification: true };
  }

  // If already a number, return as-is
  if (typeof speedStr === 'number') {
    return { speed_limit: speedStr, is_default: false, raw_text: '', requires_verification: false };
  }

  const raw = String(speedStr).trim();
  const lower = raw.toLowerCase();

  // Check for default/unrestricted zones
  const isDefaultZone =
    lower.includes('built up area') ||
    lower.includes('outside built up area') ||
    lower.includes('unrestricted') ||
    lower.includes('derestricted') ||
    lower.includes('default') ||
    lower.includes('or 110');

  if (isDefaultZone) {
    // This is a default speed zone - return 110 as WA default
    // But flag it as a default zone requiring verification
    // The correction logic (50 vs 110 based on adjacent zones) will be applied client-side
    return {
      speed_limit: 110, // WA state default
      is_default: true,
      raw_text: raw,
      requires_verification: true
    };
  }

  // Normal speed zone - extract the speed limit
  const numbers = raw.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    return {
      speed_limit: parseInt(numbers[0], 10),
      is_default: false,
      raw_text: raw,
      requires_verification: false
    };
  }

  // Fallback
  return { speed_limit: 110, is_default: true, raw_text: raw, requires_verification: true };
}

/**
 * Transform speed zone feature
 */
function transformSpeedZoneFeature(feature: any): any {
  const attrs = feature.attributes
  const rawSpeed = attrs.SPEED_LIMIT || attrs.SPEED
  const parsed = parseSpeedLimit(rawSpeed)

  return {
    road_id: attrs.ROAD_ID || attrs.ROAD || '',
    road_name: attrs.ROAD_NAME || '',
    start_slk: attrs.START_SLK || attrs.START_SLK || 0,
    end_slk: attrs.END_SLK || attrs.END_SLK || 0,
    speed_limit: parsed.speed_limit,
    is_default: parsed.is_default,
    raw_text: parsed.raw_text,
    requires_verification: parsed.requires_verification,
    carriageway: attrs.CWY || attrs.CARRIAGEWAY || 'Single'
  }
}

/**
 * Transform rail crossing feature
 */
function transformRailCrossingFeature(feature: any): any {
  const attrs = feature.attributes
  return {
    road_id: attrs.ROAD_ID || attrs.ROAD || '',
    road_name: attrs.ROAD_NAME || '',
    slk: attrs.SLK || attrs.START_SLK || 0,
    carriageway: attrs.CWY || 'Single',
    crossing_type: attrs.CROSSING_TYPE || attrs.XING_TYPE || 'Public',
    crossing_no: attrs.CROSSING_NO || attrs.XING_NO || ''
  }
}

/**
 * Transform regulatory sign feature (filter to speed/railway only)
 */
function transformRegulatorySignFeature(feature: any): any | null {
  const attrs = feature.attributes
  const meaning = (attrs.PANEL_MEANING || attrs.PANEL_01_DESIGN_MEANING || '').toUpperCase()

  // Filter: only keep speed and railway related signs
  const isSpeedRelated = meaning.includes('SPEED') || /\d+\s*(KM|KPH|KM\/H)/.test(meaning)
  const isRailwayRelated = meaning.includes('RAILWAY') || meaning.includes('RAIL CROSSING') || meaning.includes('TRAIN')

  if (!isSpeedRelated && !isRailwayRelated) {
    return null
  }

  return {
    road_id: attrs.ROAD_ID || attrs.ROAD || '',
    road_name: attrs.ROAD_NAME || '',
    slk: attrs.SLK || 0,
    carriageway: attrs.CWY || 'Single',
    sign_type: attrs.SIGN_TYPE || attrs.REGULATORY_SIGN_TYPE || '',
    panel_design: attrs.PANEL_DESIGN || attrs.PANEL_01_DESIGN || '',
    panel_meaning: attrs.PANEL_MEANING || attrs.PANEL_01_DESIGN_MEANING || ''
  }
}

/**
 * Transform warning sign feature (filter to curves/speed/railway only)
 */
function transformWarningSignFeature(feature: any): any | null {
  const attrs = feature.attributes
  const meaning = (attrs.PANEL_MEANING || attrs.PANEL_01_DESIGN_MEANING || '').toUpperCase()

  // Filter: only keep curve, advisory speed, signals, railway related
  const isRelevant = meaning.includes('CURVE') ||
    meaning.includes('ADVISORY') ||
    meaning.includes('SPEED') ||
    meaning.includes('RAILWAY') ||
    meaning.includes('SIGNALS') ||
    meaning.includes('STOP SIGN AHEAD') ||
    meaning.includes('GIVE WAY AHEAD')

  if (!isRelevant) {
    return null
  }

  return {
    road_id: attrs.ROAD_ID || attrs.ROAD || '',
    road_name: attrs.ROAD_NAME || '',
    slk: attrs.SLK || 0,
    carriageway: attrs.CWY || 'Single',
    sign_type: attrs.SIGN_TYPE || attrs.WARNING_SIGN_TYPE || '',
    panel_design: attrs.PANEL_DESIGN || attrs.PANEL_01_DESIGN || '',
    panel_meaning: attrs.PANEL_MEANING || attrs.PANEL_01_DESIGN_MEANING || ''
  }
}

/**
 * GET - Check sync status
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')

  if (action === 'status') {
    // Return status of all datasets with individual error handling
    const fetchCount = async (url: string, name: string): Promise<{count: number | null, error?: string}> => {
      try {
        const count = await getRecordCount(url)
        return { count }
      } catch (error: any) {
        console.error(`Failed to get count for ${name}:`, error.message)
        return { count: null, error: 'MRWA server unreachable - try again later' }
      }
    }

    // Fetch all counts in parallel
    const [roads, speedZones, railCrossings, regulatorySigns, warningSigns] = await Promise.all([
      fetchCount(ROAD_NETWORK_URL, 'roads'),
      fetchCount(SPEED_ZONES_URL, 'speedZones'),
      fetchCount(RAIL_CROSSINGS_URL, 'railCrossings'),
      fetchCount(REGULATORY_SIGNS_URL, 'regulatorySigns'),
      fetchCount(WARNING_SIGNS_URL, 'warningSigns')
    ])

    const hasError = roads.error || speedZones.error
    
    const statuses = {
      _meta: {
        mrwaReachable: !hasError,
        message: hasError ? 'MRWA server is slow or unreachable. Use static data download instead.' : 'Connected'
      },
      roads: {
        total: roads.count,
        lastSync: null,
        status: activeSyncs.get('roads')?.status || 'ready'
      },
      speedZones: {
        total: speedZones.count,
        lastSync: null,
        status: activeSyncs.get('speedZones')?.status || 'ready'
      },
      railCrossings: {
        total: railCrossings.count,
        lastSync: null,
        status: activeSyncs.get('railCrossings')?.status || 'ready'
      },
      regulatorySigns: {
        total: regulatorySigns.count,
        filtered: 'Speed & Railway only',
        lastSync: null,
        status: activeSyncs.get('regulatorySigns')?.status || 'ready'
      },
      warningSigns: {
        total: warningSigns.count,
        filtered: 'Curves, Speed, Railway only',
        lastSync: null,
        status: activeSyncs.get('warningSigns')?.status || 'ready'
      }
    }

    return NextResponse.json(statuses)
  }

  if (action === 'progress') {
    const dataset = searchParams.get('dataset')
    if (dataset && activeSyncs.has(dataset)) {
      return NextResponse.json(activeSyncs.get(dataset))
    }
    return NextResponse.json({ status: 'no active sync' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

/**
 * POST - Start sync for specific datasets
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { datasets, streamToClient } = body

    if (!datasets || !Array.isArray(datasets) || datasets.length === 0) {
      return NextResponse.json({ error: 'No datasets specified' }, { status: 400 })
    }

    // If streaming to client, use streaming response
    if (streamToClient) {
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        async start(controller) {
          const sendProgress = (data: any) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          }

          try {
            for (const dataset of datasets) {
              await syncDataset(dataset, sendProgress)
            }

            sendProgress({ type: 'complete', message: 'All datasets synced successfully' })
            controller.close()
          } catch (error: any) {
            sendProgress({ type: 'error', message: error.message })
            controller.close()
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    }

    // Non-streaming: return data for client to store
    const results: any = {}

    for (const dataset of datasets) {
      results[dataset] = await syncDatasetToMemory(dataset)
    }

    return NextResponse.json(results)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Sync dataset and stream progress
 */
async function syncDataset(dataset: string, sendProgress: (data: any) => void): Promise<void> {
  const syncId = dataset
  activeSyncs.set(syncId, {
    dataset,
    total: 0,
    fetched: 0,
    percent: 0,
    status: 'fetching',
    message: 'Starting...'
  })

  let url: string
  let where = '1=1'
  let outFields = '*'
  let transformer: (f: any) => any

  switch (dataset) {
    case 'roads':
      url = ROAD_NETWORK_URL
      transformer = transformRoadFeature
      break
    case 'speedZones':
      url = SPEED_ZONES_URL
      transformer = transformSpeedZoneFeature
      break
    case 'railCrossings':
      url = RAIL_CROSSINGS_URL
      transformer = transformRailCrossingFeature
      break
    case 'regulatorySigns':
      url = REGULATORY_SIGNS_URL
      transformer = transformRegulatorySignFeature
      break
    case 'warningSigns':
      url = WARNING_SIGNS_URL
      transformer = transformWarningSignFeature
      break
    default:
      throw new Error(`Unknown dataset: ${dataset}`)
  }

  try {
    const records: any[] = []
    let total = 0

    for await (const chunk of fetchRecordsInChunks(url, where, outFields)) {
      total = chunk.total

      activeSyncs.set(syncId, {
        dataset,
        total,
        fetched: chunk.fetched,
        percent: Math.round((chunk.fetched / total) * 100),
        status: 'fetching',
        message: `Fetched ${chunk.fetched} of ${total} records...`
      })

      sendProgress({
        type: 'progress',
        dataset,
        fetched: chunk.fetched,
        total,
        percent: Math.round((chunk.fetched / total) * 100)
      })

      for (const feature of chunk.features) {
        const transformed = transformer(feature)
        if (transformed) {
          records.push(transformed)
        }
      }
    }

    activeSyncs.set(syncId, {
      dataset,
      total,
      fetched: total,
      percent: 100,
      status: 'processing',
      message: `Processing ${records.length} records...`
    })

    sendProgress({
      type: 'data',
      dataset,
      records,
      total: records.length
    })

    activeSyncs.set(syncId, {
      dataset,
      total,
      fetched: total,
      percent: 100,
      status: 'complete',
      message: `Synced ${records.length} records`
    })

    sendProgress({
      type: 'complete',
      dataset,
      count: records.length
    })

  } catch (error: any) {
    activeSyncs.set(syncId, {
      dataset,
      total: 0,
      fetched: 0,
      percent: 0,
      status: 'error',
      message: error.message
    })
    throw error
  }
}

/**
 * Sync dataset to memory (non-streaming)
 */
async function syncDatasetToMemory(dataset: string): Promise<any> {
  let url: string
  let where = '1=1'
  let outFields = '*'
  let transformer: (f: any) => any

  switch (dataset) {
    case 'roads':
      url = ROAD_NETWORK_URL
      transformer = transformRoadFeature
      break
    case 'speedZones':
      url = SPEED_ZONES_URL
      transformer = transformSpeedZoneFeature
      break
    case 'railCrossings':
      url = RAIL_CROSSINGS_URL
      transformer = transformRailCrossingFeature
      break
    case 'regulatorySigns':
      url = REGULATORY_SIGNS_URL
      transformer = transformRegulatorySignFeature
      break
    case 'warningSigns':
      url = WARNING_SIGNS_URL
      transformer = transformWarningSignFeature
      break
    default:
      throw new Error(`Unknown dataset: ${dataset}`)
  }

  const records: any[] = []
  let total = 0

  for await (const chunk of fetchRecordsInChunks(url, where, outFields)) {
    total = chunk.total
    for (const feature of chunk.features) {
      const transformed = transformer(feature)
      if (transformed) {
        records.push(transformed)
      }
    }
  }

  return { records, totalFetched: total, filtered: records.length }
}
