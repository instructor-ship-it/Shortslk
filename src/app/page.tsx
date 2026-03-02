'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  initDB,
  isOfflineDataAvailable,
  getOfflineMetadata,
  storeRegionData,
  storeSpeedZones,
  storeMetadata,
  clearOfflineData,
  getSpeedZones,
  storeRailCrossings,
  storeRegulatorySigns,
  storeWarningSigns,
  getSignageInCorridor,
  getDetailedStats,
  storeRoadsData,
  storeSpeedZonesData,
  storeRailCrossingsData,
  storeRegulatorySignsData,
  storeWarningSignsData,
  clearDataset,
  type SignageItem,
  type DatasetMetadata,
} from '@/lib/offline-db'
import {
  loadStaticData,
  checkStaticData,
} from '@/lib/download-roads'

interface Road {
  road_id: string
  road_name: string
  min_slk: number
  max_slk: number
  region?: string
}

interface Position {
  lat: number
  lon: number
  speed: string
  cwy: string
}

interface WorkZoneResult {
  road_id: string
  road_name: string
  network_type?: string
  work_zone: {
    start_slk: number
    end_slk: number
    length_m: number
    start: Position | null
    end: Position | null
  }
  tc_positions: {
    start_slk: number
    end_slk: number
    start: Position | null
    end: Position | null
  }
  approach_signs: {
    start_slk: number
    end_slk: number
    start: Position | null
    end: Position | null
  }
  speed_zones: {
    approach_start: string
    tc_start: string
    work_zone_start: string
    work_zone_end: string
    tc_end: string
    approach_end: string
  }
  carriageway: string
  midpoint: { lat: number; lon: number; slk: number } | null
  google_maps: {
    work_zone_start: string | null
    work_zone_end: string | null
    tc_start: string | null
    tc_end: string | null
  }
}

interface WeatherData {
  location: string
  current: {
    temp: number
    humidity: number
    windSpeed: number
    windDir: string
    windGust: number
    condition: string
  }
  sun: {
    sunrise: string
    sunset: string
    daylightHours: string
    uvIndex: number
    uvLevel: string
  }
  forecast: Array<{
    time: string
    temp: number
    windSpeed: number
    windDir: string
    condition: string
  }>
}

interface WarningItem {
  title: string
  description: string
  link: string
  pubDate: string
  category: string
  urgency: string
  severity: string
}

interface WarningData {
  warnings: WarningItem[]
  count: number
  lastUpdated: string
  source: string
}

interface TrafficData {
  road_id: string
  road_name?: string
  aadt: number
  aadt_year: string
  heavy_vehicle_percent: number
  peak_hour_volume: number
  source: string
  distance_to_site?: number
  nearest_sites?: Array<{
    site_no: string
    location: string
    year: string
    aadt: number
    heavy_percent: number
    distance_km: number | null
  }>
  note?: string
}

interface Place {
  name: string
  distance: string
  lat: number
  lon: number
  phone?: string
  address?: string
  googleMapsUrl: string
  isEmergency?: boolean
}

interface PlacesData {
  hospital: Place | null
  toilet: Place | null
  fuelStation: Place | null
}

interface CrossRoad {
  name: string
  distance: string
  lat: number
  lon: number
  roadType: string
  googleMapsUrl: string
}

export default function Home() {
  const [regions, setRegions] = useState<string[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string>('')
  const [roads, setRoads] = useState<Road[]>([])
  const [selectedRoad, setSelectedRoad] = useState<string>('')
  const [startSlk, setStartSlk] = useState<string>('')
  const [endSlk, setEndSlk] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [loadingRegions, setLoadingRegions] = useState<boolean>(true)
  const [loadingRoads, setLoadingRoads] = useState<boolean>(false)
  const [result, setResult] = useState<WorkZoneResult | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [warnings, setWarnings] = useState<WarningData | null>(null)
  const [traffic, setTraffic] = useState<TrafficData | null>(null)
  const [places, setPlaces] = useState<PlacesData | null>(null)
  const [crossRoads, setCrossRoads] = useState<CrossRoad[]>([])
  const [error, setError] = useState<string>('')
  const [roadInfo, setRoadInfo] = useState<Road | null>(null)
  const [isSinglePoint, setIsSinglePoint] = useState<boolean>(false)
  const [exporting, setExporting] = useState<boolean>(false)
  
  // GPS location state
  const [gpsLat, setGpsLat] = useState<string>('')
  const [gpsLon, setGpsLon] = useState<string>('')
  const [loadingGps, setLoadingGps] = useState<boolean>(false)
  const [gpsError, setGpsError] = useState<string>('')
  const [gpsRoadInfo, setGpsRoadInfo] = useState<{road_id: string; road_name: string; network_type: string, slk: number} | null>(null)
  const [showGpsDialog, setShowGpsDialog] = useState<boolean>(false)
  
  // Offline data state
  const [offlineReady, setOfflineReady] = useState<boolean>(false)
  const [defaultRegion, setDefaultRegion] = useState<string>('')
  const [showSetup, setShowSetup] = useState<boolean>(false)
  const [downloading, setDownloading] = useState<boolean>(false)
  const [downloadProgress, setDownloadProgress] = useState<string>('')
  const [offlineStats, setOfflineStats] = useState<{total_roads: number; download_date: string} | null>(null)
  const [speedLimit, setSpeedLimit] = useState<number | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [showDebug, setShowDebug] = useState<boolean>(false)
  
  // Admin sync state
  const [showAdminSync, setShowAdminSync] = useState<boolean>(false)
  const [syncProgress, setSyncProgress] = useState<Record<string, {status: string; percent: number; message: string}>>({})
  const [datasetStats, setDatasetStats] = useState<{
    roads: { count: number; lastSync: string | null };
    speedZones: { count: number; lastSync: string | null };
    railCrossings: { count: number; lastSync: string | null };
    regulatorySigns: { count: number; lastSync: string | null };
    warningSigns: { count: number; lastSync: string | null };
  } | null>(null)
  const [mrwaStatus, setMrwaStatus] = useState<any>(null)
  const [syncingDatasets, setSyncingDatasets] = useState<Set<string>>(new Set())
  
  // GPS Enhancement Settings (EKF-based)
  const [gpsSettings, setGpsSettings] = useState<{
    ekfEnabled: boolean;
    roadConstraint: boolean;
    maxPredictionTime: number;
    showUncertainty: boolean;
    earlyWarnings: boolean;
    speedLookaheadTime: number;
    gpsLagCompensation: number;
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gpsSettings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // Migrate old settings to new format
          if ('interpolation' in parsed || 'smoothing' in parsed) {
            return {
              ekfEnabled: true,
              roadConstraint: true,
              maxPredictionTime: 30,
              showUncertainty: true,
              earlyWarnings: parsed.earlyWarnings ?? true,
              speedLookaheadTime: 5,
              gpsLagCompensation: 0,
            }
          }
          // Add speedLookaheadTime if missing (migration)
          if (!('speedLookaheadTime' in parsed)) {
            return { ...parsed, speedLookaheadTime: 5, gpsLagCompensation: parsed.gpsLagCompensation ?? 0 }
          }
          // Add gpsLagCompensation if missing (migration)
          if (!('gpsLagCompensation' in parsed)) {
            return { ...parsed, gpsLagCompensation: 0 }
          }
          return parsed
        } catch {
          return { ekfEnabled: true, roadConstraint: true, maxPredictionTime: 30, showUncertainty: true, earlyWarnings: true, speedLookaheadTime: 5, gpsLagCompensation: 0 }
        }
      }
    }
    return { ekfEnabled: true, roadConstraint: true, maxPredictionTime: 30, showUncertainty: true, earlyWarnings: true, speedLookaheadTime: 5, gpsLagCompensation: 0 }
  })
  
  const updateGpsSetting = (key: string, value: boolean | number) => {
    const newSettings = { ...gpsSettings, [key]: value }
    setGpsSettings(newSettings)
    localStorage.setItem('gpsSettings', JSON.stringify(newSettings))
  }
  
  // Wind Gust Alert Settings
  const [windGustThreshold, setWindGustThreshold] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('windGustThreshold')
      if (saved) {
        try {
          return parseInt(saved, 10)
        } catch {
          return 60
        }
      }
    }
    return 60 // Default 60 km/h
  })
  
  const updateWindGustThreshold = (value: number) => {
    setWindGustThreshold(value)
    localStorage.setItem('windGustThreshold', value.toString())
  }
  
  // Signage corridor data
  const [signageCorridor, setSignageCorridor] = useState<SignageItem[]>([])
  const [signageLoading, setSignageLoading] = useState<boolean>(false)
  
  // Collapsible sections state
  const [showTraffic, setShowTraffic] = useState<boolean>(true)
  const [showSignageCorridor, setShowSignageCorridor] = useState<boolean>(true)
  const [showTcPositions, setShowTcPositions] = useState<boolean>(true)
  const [showIntersections, setShowIntersections] = useState<boolean>(true)
  const [showWeather, setShowWeather] = useState<boolean>(true)
  const [showAmenities, setShowAmenities] = useState<boolean>(true)

  // Ref to track when we're restoring state (prevents fetchRoads from clearing selectedRoad)
  const isRestoring = useRef(false)
  // Ref to store pending restore params (to call getWorkZoneInfo after roads load)
  const pendingRestoreParams = useRef<{region: string, roadId: string, startSlk: string, endSlk: string} | null>(null)
  // State to trigger UI re-render during restore (hides inputs)
  const [isRestoringUI, setIsRestoringUI] = useState<boolean>(false)

  // Check offline data status on mount
  useEffect(() => {
    checkOfflineStatus()
  }, [])

  // Load default region from localStorage on mount
  useEffect(() => {
    const savedDefaultRegion = localStorage.getItem('defaultRegion')
    if (savedDefaultRegion) {
      setDefaultRegion(savedDefaultRegion)
      // Don't set selectedRegion here - wait for regions to load
    }
  }, [])

  // Fetch regions on mount
  useEffect(() => {
    fetchRegions()
  }, [])

  // Restore state from sessionStorage when returning from tracking
  useEffect(() => {
    const savedParams = sessionStorage.getItem('workZoneParams')
    if (savedParams) {
      try {
        const params = JSON.parse(savedParams)
        isRestoring.current = true
        setIsRestoringUI(true) // Trigger UI to hide inputs
        
        // Store params for later use (after roads load)
        pendingRestoreParams.current = params
        
        // Set region to trigger roads fetch
        if (params.region) {
          setSelectedRegion(params.region)
        }
        
        // Don't clear params here - keep them until user clicks Reset
        // Clean up old format if it exists
        sessionStorage.removeItem('workZoneState')
      } catch (e) {
        console.error('Failed to restore params:', e)
        isRestoring.current = false
        setIsRestoringUI(false)
      }
    }
  }, [])

  // Fetch roads when region changes
  useEffect(() => {
    if (selectedRegion) {
      fetchRoads(selectedRegion)
    }
  }, [selectedRegion])

  const checkOfflineStatus = async () => {
    try {
      await initDB()
      const hasData = await isOfflineDataAvailable()
      setOfflineReady(hasData)

      // Load existing metadata if available
      if (hasData) {
        const metadata = await getOfflineMetadata()
        if (metadata) {
          setOfflineStats({
            total_roads: metadata.total_roads,
            download_date: metadata.download_date
          })
        }
      }
    } catch (e) {
      console.error('Failed to check offline status:', e)
    }
  }

  const handleDownloadOfflineData = async () => {
    setDownloading(true)
    setDownloadProgress('Clearing old data...')
    
    try {
      // Always clear old data before downloading new data to prevent corruption
      await clearOfflineData()
      
      // Check if static data is available
      setDownloadProgress('Checking for static data...')
      const { available, metadata } = await checkStaticData()
      
      if (!available) {
        setDownloadProgress('No static data available. Please run: node scripts/download-roads.js locally and commit the data files.')
        setTimeout(() => setDownloading(false), 5000)
        return
      }
      
      setDownloadProgress(`Found data from ${metadata.download_date ? new Date(metadata.download_date).toLocaleDateString() : 'unknown date'}. Loading...`)
      
      const downloadDate = new Date().toISOString()
      
      // Load static data into IndexedDB
      const result = await loadStaticData(
        async (region, roads, speedZones, railCrossings, regulatorySigns, warningSigns) => {
          await storeRegionData(region, roads)
          await storeSpeedZones(speedZones)
          if (railCrossings && railCrossings.length > 0) {
            await storeRailCrossings(railCrossings)
          }
          if (regulatorySigns && regulatorySigns.length > 0) {
            await storeRegulatorySigns(regulatorySigns)
          }
          if (warningSigns && warningSigns.length > 0) {
            await storeWarningSigns(warningSigns)
          }
        },
        (progress) => {
          setDownloadProgress(progress.message)
        }
      )
      
      // Save metadata
      await storeMetadata({
        download_date: downloadDate,
        total_roads: result.totalRoads,
        regions: result.regions
      })
      
      setOfflineReady(true)
      setOfflineStats({
        total_roads: result.totalRoads,
        download_date: downloadDate
      })
      
      setDownloadProgress(`✓ Loaded ${result.totalRoads} roads, ${result.totalSpeedZones} speed zones, ${result.totalRailCrossings || 0} rail crossings, ${result.totalRegulatorySigns || 0} regulatory signs, ${result.totalWarningSigns || 0} warning signs from ${result.regions.length} regions`)
      
      setTimeout(() => {
        setShowSetup(false)
        setDownloadProgress('')
      }, 3000)
      
    } catch (e: any) {
      setDownloadProgress(`Error: ${e.message}`)
    } finally {
      setDownloading(false)
    }
  }

  const handleClearOfflineData = async () => {
    try {
      await clearOfflineData()
      setOfflineReady(false)
      setOfflineStats(null)
      setDatasetStats(null)
      setDownloadProgress('Offline data cleared')
      setTimeout(() => setDownloadProgress(''), 2000)
    } catch (e) {
      setDownloadProgress('Failed to clear data')
    }
  }

  // Load dataset stats from IndexedDB
  const loadDatasetStats = async () => {
    try {
      const stats = await getDetailedStats()
      setDatasetStats(stats)
    } catch (e) {
      console.error('Failed to load dataset stats:', e)
    }
  }

  // Fetch MRWA status (record counts)
  const fetchMrwaStatus = async () => {
    try {
      const response = await fetch('/api/admin-sync?action=status')
      if (response.ok) {
        const data = await response.json()
        setMrwaStatus(data)
      }
    } catch (e) {
      console.error('Failed to fetch MRWA status:', e)
    }
  }

  // Sync a single dataset from MRWA with real-time progress
  const syncDatasetFromMrwa = async (dataset: string) => {
    setSyncingDatasets(prev => new Set(prev).add(dataset))
    setSyncProgress(prev => ({
      ...prev,
      [dataset]: { status: 'syncing', percent: 0, message: 'Starting...' }
    }))

    try {
      // Use streaming for real-time progress
      const response = await fetch('/api/admin-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasets: [dataset],
          streamToClient: true
        })
      })

      if (!response.ok) {
        throw new Error('Sync failed')
      }

      // Read the stream for progress updates
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let records: any[] = []
      
      if (reader) {
        let buffer = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          
          // Parse SSE events (format: "data: {...}\n\n")
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.substring(6))
                
                if (event.type === 'progress') {
                  // Update progress
                  const fetched = event.fetched ?? 0
                  const total = event.total ?? 0
                  const percent = event.percent ?? 0
                  setSyncProgress(prev => ({
                    ...prev,
                    [dataset]: { 
                      status: 'syncing', 
                      percent, 
                      message: `Fetching ${fetched.toLocaleString()} of ${total.toLocaleString()}...` 
                    }
                  }))
                } else if (event.type === 'data') {
                  // Store the records
                  records = event.records || []
                  setSyncProgress(prev => ({
                    ...prev,
                    [dataset]: { status: 'syncing', percent: 100, message: `Storing ${records.length.toLocaleString()} records...` }
                  }))
                } else if (event.type === 'complete') {
                  const count = event.count ?? 0
                  setSyncProgress(prev => ({
                    ...prev,
                    [dataset]: { status: 'complete', percent: 100, message: `Synced ${count.toLocaleString()} records` }
                  }))
                } else if (event.type === 'error') {
                  throw new Error(event.message || 'Unknown error')
                }
              } catch (parseError) {
                console.error('Failed to parse event:', line)
              }
            }
          }
        }
      }

      // Store in IndexedDB
      if (records && records.length > 0) {
        let storedCount = 0
        switch (dataset) {
          case 'roads':
            storedCount = await storeRoadsData(records, 'mrwa')
            break
          case 'speedZones':
            storedCount = await storeSpeedZonesData(records, 'mrwa')
            break
          case 'railCrossings':
            storedCount = await storeRailCrossingsData(records, 'mrwa')
            break
          case 'regulatorySigns':
            storedCount = await storeRegulatorySignsData(records, 'mrwa')
            break
          case 'warningSigns':
            storedCount = await storeWarningSignsData(records, 'mrwa')
            break
        }
        
        setSyncProgress(prev => ({
          ...prev,
          [dataset]: { status: 'complete', percent: 100, message: `Stored ${(storedCount || 0).toLocaleString()} records` }
        }))
      }

      // Refresh stats
      await loadDatasetStats()
      await checkOfflineStatus()

    } catch (e: any) {
      setSyncProgress(prev => ({
        ...prev,
        [dataset]: { status: 'error', percent: 0, message: e.message || 'Sync failed' }
      }))
    } finally {
      setSyncingDatasets(prev => {
        const next = new Set(prev)
        next.delete(dataset)
        return next
      })
    }
  }

  // Sync all datasets
  const syncAllDatasets = async () => {
    const datasets = ['roads', 'speedZones', 'railCrossings', 'regulatorySigns', 'warningSigns']
    for (const dataset of datasets) {
      await syncDatasetFromMrwa(dataset)
    }
  }

  // Clear a specific dataset
  const handleClearDataset = async (dataset: string) => {
    try {
      await clearDataset(dataset)
      await loadDatasetStats()
      setSyncProgress(prev => ({
        ...prev,
        [dataset]: { status: 'cleared', percent: 0, message: 'Dataset cleared' }
      }))
    } catch (e) {
      console.error('Failed to clear dataset:', e)
    }
  }

  const generateDebugInfo = async () => {
    const lines: string[] = []
    lines.push('=== TC Work Zone Locator Debug Info ===')
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push(`Version: 4.0`)
    lines.push('')
    lines.push('=== Offline Data Status ===')
    lines.push(`Offline Ready: ${offlineReady}`)
    lines.push(`Offline Stats: ${JSON.stringify(offlineStats)}`)
    lines.push('')
    lines.push('=== Current Selection ===')
    lines.push(`Region: ${selectedRegion}`)
    lines.push(`Road ID: ${selectedRoad}`)
    lines.push(`Road Info: ${JSON.stringify(roadInfo)}`)
    lines.push(`Start SLK: ${startSlk}`)
    lines.push(`End SLK: ${endSlk}`)
    lines.push('')
    lines.push('=== GPS Location ===')
    lines.push(`GPS Lat: ${gpsLat}`)
    lines.push(`GPS Lon: ${gpsLon}`)
    lines.push(`GPS Road Info: ${JSON.stringify(gpsRoadInfo)}`)
    lines.push('')
    lines.push('=== Result ===')
    if (result) {
      lines.push(`Road ID: ${result.road_id}`)
      lines.push(`Road Name: ${result.road_name}`)
      lines.push(`Network Type: ${result.network_type}`)
      lines.push(`Work Zone: SLK ${result.work_zone.start_slk} - ${result.work_zone.end_slk}`)
      lines.push(`Carriageway: ${result.carriageway}`)
      lines.push(`Speed Zones: ${JSON.stringify(result.speed_zones)}`)
    } else {
      lines.push('No result')
    }
    lines.push('')
    lines.push('=== Error ===')
    lines.push(`Error: ${error || 'None'}`)
    lines.push('')
    lines.push('=== Weather ===')
    lines.push(JSON.stringify(weather, null, 2))
    lines.push('')
    lines.push('=== Traffic ===')
    lines.push(JSON.stringify(traffic, null, 2))
    
    setDebugInfo(lines.join('\n'))
    setShowDebug(true)
  }

  const fetchRegions = async () => {
    try {
      const response = await fetch('/api/roads?action=regions')
      const data = await response.json()
      if (data.regions && data.regions.length > 0) {
        setRegions(data.regions)
        // Check for saved default region first
        const savedDefault = localStorage.getItem('defaultRegion')
        if (savedDefault && data.regions.includes(savedDefault)) {
          setSelectedRegion(savedDefault)
        } else if (data.regions.includes('Wheatbelt')) {
          setSelectedRegion('Wheatbelt')
        } else {
          setSelectedRegion(data.regions[0])
        }
      }
    } catch (err) {
      setError('Failed to load regions')
    } finally {
      setLoadingRegions(false)
    }
  }

  const fetchRoads = async (region: string) => {
    setLoadingRoads(true)
    // Only reset road selection if we're not restoring state
    if (!isRestoring.current) {
      setSelectedRoad('')
    }
    try {
      const response = await fetch(`/api/roads?action=list&region=${encodeURIComponent(region)}`)
      const data = await response.json()
      setRoads(data.roads || [])
    } catch (err) {
      setError('Failed to load roads')
    } finally {
      setLoadingRoads(false)
    }
  }

  useEffect(() => {
    if (selectedRoad) {
      const road = roads.find(r => r.road_id === selectedRoad)
      setRoadInfo(road || null)
    } else {
      setRoadInfo(null)
    }
    // Only clear results if not restoring
    if (!isRestoring.current) {
      setResult(null)
      setWeather(null)
      setWarnings(null)
      setTraffic(null)
      setPlaces(null)
      setCrossRoads([])
      setError('')
    }
  }, [selectedRoad, roads])

  // When roads are loaded during restore, call getWorkZoneInfo
  useEffect(() => {
    if (pendingRestoreParams.current && roads.length > 0) {
      const params = pendingRestoreParams.current
      pendingRestoreParams.current = null
      
      // Small delay to ensure state is settled
      setTimeout(async () => {
        isRestoring.current = false
        await getWorkZoneInfo(params.region, params.roadId, params.startSlk, params.endSlk, false)
        setIsRestoringUI(false) // Show inputs are hidden by result now
      }, 100)
    }
  }, [roads])

  // Main function to get work zone info - can be called with parameters or from UI
  const getWorkZoneInfo = async (
    region: string,
    roadId: string,
    startSlkVal: string,
    endSlkVal: string,
    keepInfo: boolean = false
  ) => {
    if (!roadId) {
      setError('Select a road')
      return
    }
    if (!startSlkVal) {
      setError('Enter Start SLK')
      return
    }

    // Save parameters to sessionStorage if keepInfo is true
    if (keepInfo) {
      sessionStorage.setItem('workZoneParams', JSON.stringify({
        region,
        roadId,
        startSlk: startSlkVal,
        endSlk: endSlkVal
      }))
    }

    // Set state variables
    if (region && region !== selectedRegion) {
      setSelectedRegion(region)
    }
    setSelectedRoad(roadId)
    setStartSlk(startSlkVal)
    setEndSlk(endSlkVal)

    setLoading(true)
    setError('')
    setResult(null)
    setWeather(null)
    setWarnings(null)
    setTraffic(null)
    setPlaces(null)
    setCrossRoads([])
    
    // Track if this is a single point lookup (no end SLK provided)
    const singlePoint = !endSlkVal || endSlkVal === ''
    setIsSinglePoint(singlePoint)

    try {
      // Use end_slk if provided, otherwise same as start (single point)
      const endSlkValue = endSlkVal || startSlkVal
      
      const response = await fetch('/api/roads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          road_id: roadId,
          start_slk: parseFloat(startSlkVal),
          end_slk: parseFloat(endSlkValue),
        }),
      })
      
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Error')
      } else {
        setResult(data)
        
        // Fetch speed limit for this road at the start SLK
        fetchSpeedLimit(roadId, parseFloat(startSlkVal))
        
        // Fetch signage corridor for work zone
        fetchSignageCorridor(roadId, parseFloat(startSlkVal), endSlkValue ? parseFloat(endSlkValue) : undefined)
        
        // Fetch additional data using midpoint
        if (data.midpoint) {
          fetchWeather(data.midpoint.lat, data.midpoint.lon)
          fetchWarnings() // BOM weather warnings for WA
          fetchTraffic(roadId, data.midpoint.lat, data.midpoint.lon)
          fetchPlaces(data.midpoint.lat, data.midpoint.lon)
        }
        // Fetch cross roads using TC corridor
        fetchCrossRoads(data)
      }
    } catch (err) {
      setError('Failed to get location')
    } finally {
      setLoading(false)
    }
  }

  // Handle search from UI button - uses current state
  const handleSearch = async () => {
    await getWorkZoneInfo(selectedRegion, selectedRoad, startSlk, endSlk, true)
  }

  // Reset work zone info and return to default state
  const handleReset = () => {
    // Clear saved params from sessionStorage
    sessionStorage.removeItem('workZoneParams')
    sessionStorage.removeItem('workZoneState')
    
    // Reset all state
    setResult(null)
    setWeather(null)
    setWarnings(null)
    setTraffic(null)
    setPlaces(null)
    setCrossRoads([])
    setError('')
    setSelectedRegion('')
    setSelectedRoad('')
    setStartSlk('')
    setEndSlk('')
    setSpeedLimit(null)
    setIsSinglePoint(false)
    setGpsRoadInfo(null)
    setSignageCorridor([])
    isRestoring.current = false
    pendingRestoreParams.current = null
    setIsRestoringUI(false)
  }

  // Look up speed limit for a road at a specific SLK
  const fetchSpeedLimit = async (roadId: string, slk: number) => {
    try {
      const zones = await getSpeedZones(roadId)
      if (zones.length === 0) {
        setSpeedLimit(null)
        return
      }
      // Find the zone that contains this SLK
      const matchingZone = zones.find(z => slk >= z.start_slk && slk <= z.end_slk)
      if (matchingZone) {
        setSpeedLimit(matchingZone.speed_limit)
      } else {
        // Find nearest zone if not in any zone
        const sortedZones = [...zones].sort((a, b) => {
          const distA = Math.min(Math.abs(a.start_slk - slk), Math.abs(a.end_slk - slk))
          const distB = Math.min(Math.abs(b.start_slk - slk), Math.abs(b.end_slk - slk))
          return distA - distB
        })
        if (sortedZones.length > 0) {
          setSpeedLimit(sortedZones[0].speed_limit)
        }
      }
    } catch (err) {
      console.error('Error fetching speed limit:', err)
      setSpeedLimit(null)
    }
  }

  // Fetch signage corridor data for work zone
  const fetchSignageCorridor = async (roadId: string, startSlk: number, endSlk?: number) => {
    setSignageLoading(true)
    setSignageCorridor([])
    
    try {
      // Calculate corridor bounds
      // If only start SLK: corridor is start-0.7 to start+0.7
      // If start and end SLK: corridor is start-0.7 to end+0.7
      const corridorStart = startSlk - 0.7
      const corridorEnd = (endSlk && endSlk > startSlk) ? endSlk + 0.7 : startSlk + 0.7
      
      const signage = await getSignageInCorridor(roadId, corridorStart, corridorEnd)
      setSignageCorridor(signage)
    } catch (err) {
      console.error('Error fetching signage corridor:', err)
      setSignageCorridor([])
    } finally {
      setSignageLoading(false)
    }
  }

  const fetchWeather = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`)
      const data = await response.json()
      if (response.ok) setWeather(data)
    } catch (err) {}
  }

  const fetchTraffic = async (roadId: string, lat?: number, lon?: number) => {
    try {
      let url = `/api/traffic?road_id=${roadId}`
      if (lat && lon) {
        url += `&lat=${lat}&lon=${lon}`
      }
      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) setTraffic(data)
    } catch (err) {}
  }

  const fetchPlaces = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`/api/places?lat=${lat}&lon=${lon}`)
      const data = await response.json()
      if (response.ok) setPlaces(data)
    } catch (err) {}
  }

  const fetchWarnings = async () => {
    try {
      const response = await fetch('/api/warnings')
      const data = await response.json()
      if (response.ok) setWarnings(data)
    } catch (err) {
      // Graceful degradation - warnings not critical
    }
  }

  const fetchCrossRoads = async (result: WorkZoneResult) => {
    try {
      // Use MRWA node-based intersection detection
      const response = await fetch(
        `/api/intersections?road_id=${result.road_id}&slk_start=${result.work_zone.start_slk}&slk_end=${result.work_zone.end_slk}`
      )
      const data = await response.json()
      if (response.ok) setCrossRoads(data.crossRoads || [])
    } catch (err) {}
  }

  // Get current GPS location from device
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported by this browser')
      return
    }
    
    setLoadingGps(true)
    setGpsError('')
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLat(position.coords.latitude.toFixed(6))
        setGpsLon(position.coords.longitude.toFixed(6))
        setLoadingGps(false)
        // Auto-lookup the location
        lookupGpsLocation(position.coords.latitude, position.coords.longitude)
      },
      (err) => {
        setLoadingGps(false)
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError('Location permission denied. Please allow location access.')
            break
          case err.POSITION_UNAVAILABLE:
            setGpsError('Location information unavailable')
            break
          case err.TIMEOUT:
            setGpsError('Location request timed out')
            break
          default:
            setGpsError('An unknown error occurred')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // Lookup road info from GPS coordinates
  const lookupGpsLocation = async (lat?: number, lon?: number) => {
    const latitude = lat ?? parseFloat(gpsLat)
    const longitude = lon ?? parseFloat(gpsLon)
    
    if (isNaN(latitude) || isNaN(longitude)) {
      setGpsError('Please enter valid coordinates')
      return
    }
    
    setLoadingGps(true)
    setGpsError('')
    
    try {
      const response = await fetch(`/api/gps?lat=${latitude}&lon=${longitude}`)
      const data = await response.json()
      
      if (!response.ok) {
        setGpsError(data.error || 'Location not found')
        setGpsRoadInfo(null)
      } else {
        // Store GPS road info
        setGpsRoadInfo({
          road_id: data.road_id,
          road_name: data.road_name,
          network_type: data.network_type,
          slk: data.slk
        })
        
        // Set the road and SLK from GPS lookup
        setSelectedRoad(data.road_id)
        setStartSlk(data.slk.toString())
        setEndSlk('') // Clear end SLK for single point
        
        // Set region based on road type
        if (data.network_type === 'Local Road') {
          setSelectedRegion('Local')
        }
        
        // Clear any previous error
        setGpsError('')
      }
    } catch (err) {
      setGpsError('Failed to lookup location')
      setGpsRoadInfo(null)
    } finally {
      setLoadingGps(false)
    }
  }

  const openGoogleMaps = (url: string | null) => {
    if (url) window.open(url, '_blank')
  }

  const openStreetView = (lat: number, lon: number) => {
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`, '_blank')
  }

  const exportReport = async () => {
    if (!result) return
    
    setExporting(true)
    try {
      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          road_id: result.road_id,
          road_name: result.road_name,
          work_zone: result.work_zone,
          tc_positions: result.tc_positions,
          speed_zones: result.speed_zones,
          carriageway: result.carriageway,
          weather: weather,
          traffic: traffic,
          side_roads: crossRoads.filter(road => 
            road.name.toLowerCase() !== result.road_name.toLowerCase()
          ),
          amenities: places,
        }),
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `work-zone-${result.road_id}-${result.work_zone.start_slk.toFixed(2)}.txt`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  // Get UV level color
  const getUvColor = (level: string): string => {
    switch (level) {
      case 'Low': return 'text-green-400'
      case 'Moderate': return 'text-yellow-400'
      case 'High': return 'text-orange-400'
      case 'Very High': return 'text-red-400'
      case 'Extreme': return 'text-purple-400'
      default: return 'text-gray-400'
    }
  }

  // Start SLK tracking with autostart
  const startSlkTracking = () => {
    // Save current params to sessionStorage before navigating (if road is selected)
    if (selectedRoad && startSlk) {
      sessionStorage.setItem('workZoneParams', JSON.stringify({
        region: selectedRegion,
        roadId: selectedRoad,
        startSlk: startSlk,
        endSlk: endSlk
      }))
    }
    
    const params = new URLSearchParams()
    if (selectedRoad) {
      params.set('road_id', selectedRoad)
      params.set('road_name', roadInfo?.road_name || '')
      if (startSlk) params.set('slk', startSlk)
    }
    params.set('autostart', 'true')
    window.location.href = `/drive?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header with Setup Icon */}
        <div className="flex items-center justify-between mb-1">
          <div className="w-8"></div>
          <h1 className="text-xl font-bold text-center flex-1">
            TC Work Zone Locator
          </h1>
          <button
            onClick={() => setShowSetup(!showSetup)}
            className={`w-8 h-8 flex items-center justify-center rounded-full text-lg ${
              offlineReady ? 'bg-green-600' : 'bg-gray-700'
            } hover:opacity-80`}
            title="Setup offline data"
          >
            ⚙️
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mb-4">
          vRC 1.2.0 {offlineReady && <span className="text-green-400">• EKF GPS • Haversine • 69K Roads • Local Storage Overrides</span>}
        </p>

        {/* Setup Dialog */}
        {showSetup && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-blue-400 mb-3">⚙️ Settings</h3>
            
            {/* Default Region Selector */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Default Region</label>
              <Select
                value={defaultRegion || "__none__"}
                onValueChange={(value) => {
                  const regionValue = value === "__none__" ? "" : value
                  setDefaultRegion(regionValue)
                  localStorage.setItem('defaultRegion', regionValue)
                }}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white h-10">
                  <SelectValue placeholder="Select default region" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="__none__" className="text-gray-400">None</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region} value={region} className="text-white">
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Pre-selects this region on load</p>
            </div>
            
            {/* GPS Enhancement Settings */}
            <div className="mb-4 pt-4 border-t border-gray-700">
              <h4 className="text-sm font-semibold text-purple-400 mb-3">📡 GPS Filtering (EKF)</h4>
              
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm text-white">EKF Filtering</span>
                    <p className="text-xs text-gray-500">Kalman filter for smoother, accurate GPS tracking</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={gpsSettings.ekfEnabled}
                    onChange={(e) => updateGpsSetting('ekfEnabled', e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                  />
                </label>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm text-white">Road Constraint</span>
                    <p className="text-xs text-gray-500">Snap predictions to road geometry for accuracy</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={gpsSettings.roadConstraint}
                    onChange={(e) => updateGpsSetting('roadConstraint', e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                    disabled={!gpsSettings.ekfEnabled}
                  />
                </label>
                
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-white">Prediction Timeout</span>
                    <p className="text-xs text-gray-500">Max time to predict during GPS outage</p>
                  </div>
                  <select
                    value={gpsSettings.maxPredictionTime}
                    onChange={(e) => updateGpsSetting('maxPredictionTime', parseInt(e.target.value))}
                    className="bg-gray-700 border-gray-600 text-white text-sm rounded px-2 py-1"
                    disabled={!gpsSettings.ekfEnabled}
                  >
                    <option value={10}>10 sec</option>
                    <option value={20}>20 sec</option>
                    <option value={30}>30 sec</option>
                    <option value={60}>60 sec</option>
                  </select>
                </div>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm text-white">Show Uncertainty</span>
                    <p className="text-xs text-gray-500">Display position accuracy indicator</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={gpsSettings.showUncertainty}
                    onChange={(e) => updateGpsSetting('showUncertainty', e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                    disabled={!gpsSettings.ekfEnabled}
                  />
                </label>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm text-white">Early Warnings</span>
                    <p className="text-xs text-gray-500">Alert earlier at higher speeds (3 sec travel time)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={gpsSettings.earlyWarnings}
                    onChange={(e) => updateGpsSetting('earlyWarnings', e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
            
            {/* GPS Calibration Section */}
            <div className="bg-gray-900 rounded-lg p-3 mb-4">
              <h4 className="text-sm font-semibold text-amber-400 mb-3">🎯 GPS Calibration</h4>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Lag Compensation</span>
                  <span className="text-sm font-mono text-yellow-400">
                    {gpsSettings.gpsLagCompensation > 0 ? `+${gpsSettings.gpsLagCompensation}s` : 'Not set'}
                  </span>
                </div>
                
                <p className="text-xs text-gray-500">
                  Calibrate GPS lag to improve speed sign lookahead accuracy.
                </p>
                
                <Button
                  onClick={() => window.location.href = '/calibrate'}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-sm"
                >
                  🎯 Open Calibration Tool
                </Button>
              </div>
            </div>
            
            {/* Wind Gust Alert Section */}
            <div className="bg-gray-900 rounded-lg p-3 mb-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3">💨 Wind Gust Alert</h4>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Alert Threshold</span>
                  <span className="text-sm font-mono text-cyan-400">{windGustThreshold} km/h</span>
                </div>
                
                <p className="text-xs text-gray-500">
                  Alert when wind gusts exceed this threshold. Important for traffic control safety.
                </p>
                
                <div className="grid grid-cols-4 gap-2">
                  {[40, 50, 60, 80].map((threshold) => (
                    <button
                      key={threshold}
                      onClick={() => updateWindGustThreshold(threshold)}
                      className={`py-2 rounded text-sm font-medium ${
                        windGustThreshold === threshold
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {threshold}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Version Display */}
            <div className="bg-gray-900/50 rounded-lg p-2 mb-4 text-center">
              <span className="text-xs text-gray-500">Version </span>
              <span className="text-xs font-mono text-gray-400">5.3.4</span>
            </div>
            
            <h3 className="text-sm font-semibold text-blue-400 mb-3">📦 Offline Data</h3>
            
            {offlineStats ? (
              <div className="mb-3 text-sm">
                <p className="text-green-400">✓ Offline data downloaded</p>
                <p className="text-gray-400">{offlineStats.total_roads} roads</p>
                <p className="text-gray-500 text-xs">Downloaded: {new Date(offlineStats.download_date).toLocaleDateString()}</p>
              </div>
            ) : (
              <p className="text-gray-400 text-sm mb-3">
                Download road data for offline SLK tracking without internet.
              </p>
            )}
            
            {downloadProgress && (
              <p className={`text-sm mb-3 ${downloadProgress.startsWith('✓') ? 'text-green-400' : downloadProgress.startsWith('Error') ? 'text-red-400' : 'text-blue-400'}`}>
                {downloadProgress}
              </p>
            )}
            
            <div className="flex gap-2 mb-2">
              <Button
                onClick={handleDownloadOfflineData}
                disabled={downloading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {downloading ? 'Downloading...' : offlineStats ? 'Update Data' : 'Download Data'}
              </Button>
              {offlineStats && (
                <Button
                  onClick={handleClearOfflineData}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={downloading}
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Speed Zone Overrides Section */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h3 className="text-sm font-semibold text-orange-400 mb-3">🔧 Speed Zone Overrides</h3>
              <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-400 mb-2">
                  Community-verified corrections for MRWA speed zone data. 
                  Overrides are applied automatically when you search or track on affected roads.
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-400">✓ Active (M031 corrections loaded)</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-500">Version:</span>
                  <span className="text-gray-400">1.0 • Updated: 2025-03-02</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-500">Affected Roads:</span>
                  <span className="text-orange-400">M031 (4 zone corrections)</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Override data is bundled with the app and loaded automatically. 
                Corrections are field-verified where MRWA data is outdated after road works.
              </p>
              <Link href="/overrides">
                <Button className="w-full bg-orange-600 hover:bg-orange-700 text-sm">
                  📋 Manage Overrides & Generate Reports
                </Button>
              </Link>
            </div>

            {/* Admin Data Sync Panel */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setShowAdminSync(!showAdminSync)
                  if (!showAdminSync) {
                    loadDatasetStats()
                    fetchMrwaStatus()
                  }
                }}
                className="w-full text-left text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2"
              >
                🔧 Admin Data Sync {showAdminSync ? '−' : '+'}
              </button>
              
              {showAdminSync && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Sync data directly from MRWA servers. Downloads in chunks to avoid memory issues.
                    Signage data is filtered to speed/railway signs only.
                  </p>
                  
                  {/* MRWA Connection Status */}
                  {mrwaStatus?._meta && (
                    <div className={`rounded p-2 text-xs ${mrwaStatus._meta.mrwaReachable ? 'bg-green-900/30' : 'bg-amber-900/30'}`}>
                      <p className={`font-semibold mb-1 ${mrwaStatus._meta.mrwaReachable ? 'text-green-400' : 'text-amber-400'}`}>
                        {mrwaStatus._meta.mrwaReachable ? '✓ MRWA Connected' : '⚠ MRWA Unreachable'}
                      </p>
                      <p className="text-gray-400">{mrwaStatus._meta.message}</p>
                    </div>
                  )}
                  
                  {/* MRWA Status */}
                  {mrwaStatus && mrwaStatus._meta?.mrwaReachable && (
                    <div className="bg-gray-900 rounded p-2 text-xs">
                      <p className="text-gray-400 font-semibold mb-1">MRWA Server Status:</p>
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-gray-500">Roads:</span>
                        <span className="text-gray-300">{mrwaStatus.roads?.total?.toLocaleString() || '?'}</span>
                        <span className="text-gray-500">Speed Zones:</span>
                        <span className="text-gray-300">{mrwaStatus.speedZones?.total?.toLocaleString() || '?'}</span>
                        <span className="text-gray-500">Rail Crossings:</span>
                        <span className="text-gray-300">{mrwaStatus.railCrossings?.total?.toLocaleString() || '?'}</span>
                        <span className="text-gray-500">Reg Signs:</span>
                        <span className="text-gray-300">{mrwaStatus.regulatorySigns?.total?.toLocaleString() || '?'}</span>
                        <span className="text-gray-500">Warn Signs:</span>
                        <span className="text-gray-300">{mrwaStatus.warningSigns?.total?.toLocaleString() || '?'}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Local Dataset Status */}
                  {datasetStats && (
                    <div className="bg-gray-900 rounded p-2 text-xs">
                      <p className="text-gray-400 font-semibold mb-1">Local Data Status:</p>
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-gray-500">Dataset</span>
                        <span className="text-gray-500">Count</span>
                        <span className="text-gray-500">Sync Date</span>
                        
                        <span className="text-gray-300">Roads</span>
                        <span className="text-gray-300">{datasetStats.roads.count}</span>
                        <span className="text-gray-400">{datasetStats.roads.lastSync ? new Date(datasetStats.roads.lastSync).toLocaleDateString() : '-'}</span>
                        
                        <span className="text-gray-300">Speed Zones</span>
                        <span className="text-gray-300">{datasetStats.speedZones.count}</span>
                        <span className="text-gray-400">{datasetStats.speedZones.lastSync ? new Date(datasetStats.speedZones.lastSync).toLocaleDateString() : '-'}</span>
                        
                        <span className="text-gray-300">Rail Crossings</span>
                        <span className="text-gray-300">{datasetStats.railCrossings.count}</span>
                        <span className="text-gray-400">{datasetStats.railCrossings.lastSync ? new Date(datasetStats.railCrossings.lastSync).toLocaleDateString() : '-'}</span>
                        
                        <span className="text-gray-300">Reg Signs</span>
                        <span className="text-gray-300">{datasetStats.regulatorySigns.count}</span>
                        <span className="text-gray-400">{datasetStats.regulatorySigns.lastSync ? new Date(datasetStats.regulatorySigns.lastSync).toLocaleDateString() : '-'}</span>
                        
                        <span className="text-gray-300">Warn Signs</span>
                        <span className="text-gray-300">{datasetStats.warningSigns.count}</span>
                        <span className="text-gray-400">{datasetStats.warningSigns.lastSync ? new Date(datasetStats.warningSigns.lastSync).toLocaleDateString() : '-'}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Sync Progress */}
                  {Object.keys(syncProgress).length > 0 && (
                    <div className="bg-gray-900 rounded p-2 text-xs">
                      <p className="text-gray-400 font-semibold mb-1">Sync Progress:</p>
                      {Object.entries(syncProgress).map(([dataset, progress]) => (
                        <div key={dataset} className="mb-1">
                          <div className="flex justify-between">
                            <span className="text-gray-300 capitalize">{dataset.replace(/([A-Z])/g, ' $1')}</span>
                            <span className={progress.status === 'complete' ? 'text-green-400' : progress.status === 'error' ? 'text-red-400' : 'text-blue-400'}>
                              {progress.message}
                            </span>
                          </div>
                          {progress.status === 'syncing' && (
                            <div className="w-full bg-gray-700 h-1 rounded mt-1">
                              <div className="bg-blue-500 h-1 rounded" style={{ width: `${progress.percent}%` }}></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Sync Buttons */}
                  <div className="space-y-2">
                    <Button
                      onClick={syncAllDatasets}
                      disabled={syncingDatasets.size > 0}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-sm"
                    >
                      {syncingDatasets.size > 0 ? `Syncing ${syncingDatasets.size} dataset(s)...` : '🔄 Sync All from MRWA'}
                    </Button>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {['roads', 'speedZones', 'railCrossings', 'regulatorySigns', 'warningSigns'].map(dataset => (
                        <Button
                          key={dataset}
                          onClick={() => syncDatasetFromMrwa(dataset)}
                          disabled={syncingDatasets.has(dataset)}
                          className="bg-gray-600 hover:bg-gray-500 text-xs py-1 h-8"
                        >
                          {syncingDatasets.has(dataset) ? '...' : `Sync ${dataset.replace(/([A-Z])/g, ' $1')}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Export Reports Button */}
            {result && (
              <Button
                onClick={exportReport}
                disabled={exporting}
                className="w-full bg-purple-600 hover:bg-purple-700 mt-2"
              >
                {exporting ? 'Exporting...' : '📄 Export Report'}
              </Button>
            )}
            
            {/* Debug Button */}
            <Button
              onClick={generateDebugInfo}
              className="w-full bg-gray-600 hover:bg-gray-500 text-sm mt-2"
            >
              🔧 Generate Debug Info
            </Button>
          </div>
        )}

        {/* Debug Info Popup */}
        {showDebug && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg p-4 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-blue-400">🔧 Debug Info</h3>
                <Button
                  onClick={() => setShowDebug(false)}
                  className="h-8 w-8 p-0 bg-gray-700 hover:bg-gray-600"
                >
                  ✕
                </Button>
              </div>
              <textarea
                readOnly
                value={debugInfo}
                className="flex-1 w-full bg-gray-900 text-gray-300 text-xs font-mono p-3 rounded border border-gray-700 resize-none min-h-[300px]"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(debugInfo)
                    setDownloadProgress('Debug info copied!')
                    setTimeout(() => setDownloadProgress(''), 2000)
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  📋 Copy to Clipboard
                </Button>
                <Button
                  onClick={() => setShowDebug(false)}
                  className="bg-gray-600 hover:bg-gray-500"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Start SLK Tracking Button - only show when no results displayed */}
        {!result && !isRestoringUI && (
          <div className="mb-4">
            <Button 
              onClick={startSlkTracking}
              className="w-full h-12 text-lg bg-blue-800 hover:bg-blue-900"
            >
              📍 Start SLK Tracking
            </Button>
            <p className="text-xs text-gray-500 text-center mt-1">
              Auto-start GPS tracking for real-time SLK updates
            </p>
          </div>
        )}

        {/* Input sections - hide when results are displayed or during restore */}
        {!result && !isRestoringUI && (
          <>
            {/* GPS Location Section - Collapsible */}
            <div className="bg-gray-800 rounded-lg mb-4">
              <button
                onClick={() => setShowGpsDialog(!showGpsDialog)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <h3 className="text-sm font-semibold text-green-400">
                  📍 Find by GPS Location
                </h3>
                <span className="text-gray-400 text-lg">
                  {showGpsDialog ? '−' : '+'}
                </span>
              </button>
          
          {showGpsDialog && (
            <div className="px-4 pb-4">
              {/* Get My Location Button */}
              <Button 
                onClick={getCurrentLocation}
                disabled={loadingGps}
                className="w-full h-12 mb-3 text-base bg-green-600 hover:bg-green-700"
              >
                {loadingGps ? 'Getting Location...' : '📍 Get My Location'}
              </Button>
              
              {/* Manual GPS Input */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => setGpsLat(prev => prev.startsWith('-') ? prev.slice(1) : '-' + prev)}
                      className="h-10 w-10 text-lg bg-gray-600 hover:bg-gray-500 shrink-0 px-0"
                      title="Toggle negative"
                    >
                      −
                    </Button>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="-31.638157"
                      value={gpsLat}
                      onChange={(e) => setGpsLat(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white h-10 text-sm flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                  <Input
                    type="number"
                    step="0.000001"
                    placeholder="117.005277"
                    value={gpsLon}
                    onChange={(e) => setGpsLon(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white h-10 text-sm"
                  />
                </div>
              </div>
              
              <Button 
                onClick={() => lookupGpsLocation()}
                disabled={loadingGps || !gpsLat || !gpsLon}
                className="w-full h-10 text-sm bg-blue-600 hover:bg-blue-700"
              >
                {loadingGps ? 'Looking up...' : '🔍 Lookup Location'}
              </Button>
              
              {/* GPS Error/Success */}
              {gpsError && (
                <p className="text-xs text-red-400 mt-2">{gpsError}</p>
              )}
              
              <p className="text-xs text-gray-500 mt-2">
                Works for all roads (State H/M and Local roads)
              </p>
            </div>
          )}
        </div>

        <div className="text-center text-gray-600 text-xs mb-4">— or select manually —</div>

        {/* Region Selection */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">Region</label>
          <Select
            value={selectedRegion}
            onValueChange={(value) => {
              setSelectedRegion(value)
              // Clear GPS road info if manually changing region
              if (value !== 'Local' || !gpsRoadInfo) {
                setGpsRoadInfo(null)
                setSelectedRoad('')
                setStartSlk('')
                setEndSlk('')
              }
            }}
            disabled={loadingRegions}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-12 text-base">
              <SelectValue placeholder={loadingRegions ? "Loading regions..." : "Select region"} />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 max-h-64">
              {/* Local option at top */}
              <SelectItem 
                value="Local"
                className="text-amber-400 focus:bg-gray-700 py-3"
              >
                📍 Local Roads (use GPS lookup)
              </SelectItem>
              {regions.map((region) => (
                <SelectItem 
                  key={region} 
                  value={region}
                  className="text-white focus:bg-gray-700 py-3"
                >
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Road Selection - different behavior for Local */}
        {selectedRegion === 'Local' ? (
          // Local road - allow manual entry
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">Road ID</label>
            {gpsRoadInfo ? (
              // GPS found a local road
              <div className="bg-gray-800 border border-green-600 rounded-lg p-3">
                <p className="font-mono text-green-400 text-lg">{gpsRoadInfo.road_id}</p>
                <p className="text-sm text-gray-300">{gpsRoadInfo.road_name}</p>
                <p className="text-xs text-gray-500 mt-1">📍 Found via GPS lookup</p>
              </div>
            ) : (
              // Manual entry for local road
              <div>
                <Input
                  type="text"
                  placeholder="Enter local road ID"
                  value={selectedRoad}
                  onChange={(e) => setSelectedRoad(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white h-12 text-base font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter local road ID manually or use GPS lookup above
                </p>
              </div>
            )}
          </div>
        ) : (
          // State road - normal dropdown
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">Road ID</label>
            <Select
              value={selectedRoad}
              onValueChange={setSelectedRoad}
              disabled={loadingRoads}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-12 text-base">
                <SelectValue placeholder={loadingRoads ? "Loading..." : "Select road"} />
              </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 max-h-64">
              {roads.map((road) => (
                <SelectItem 
                  key={road.road_id} 
                  value={road.road_id}
                  className="text-white focus:bg-gray-700 py-3"
                >
                  <span className="font-mono text-blue-400">{road.road_id}</span>
                  <span className="ml-2">{road.road_name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {roadInfo && (
            <p className="text-xs text-gray-500 mt-1">
              Valid SLK: {roadInfo.min_slk.toFixed(1)} – {roadInfo.max_slk.toFixed(1)} km
            </p>
          )}
        </div>
        )}

        {/* SLK Inputs */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Start SLK (km)</label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="e.g. 100.0"
              value={startSlk}
              onChange={(e) => setStartSlk(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white h-12 text-base"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">End SLK (km)</label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="e.g. 100.5"
              value={endSlk}
              onChange={(e) => setEndSlk(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white h-12 text-base"
            />
          </div>
        </div>
        
        <p className="text-xs text-gray-500 mb-4">
          Leave End SLK blank for single point lookup
        </p>

        <Button 
          onClick={handleSearch} 
          disabled={loading || !selectedRoad}
          className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
        >
          {loading ? 'Searching...' : 'Get Work Zone Info'}
        </Button>
          </>
        )}

        {/* Loading indicator during restore */}
        {isRestoringUI && !result && (
          <div className="text-center py-8">
            <p className="text-gray-400">Restoring work zone info...</p>
          </div>
        )}

        {/* Reset Button - show when results are displayed */}
        {result && (
          <Button 
            onClick={handleReset}
            className="w-full h-12 text-lg bg-gray-600 hover:bg-gray-500 mb-4"
          >
            🔄 Reset Work Zone Info
          </Button>
        )}

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mt-4">{error}</p>
        )}

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-4">
            
            {/* Work Zone Summary */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2 mb-3">
                <h3 className="text-sm font-semibold text-blue-400">
                  📍 Work Zone Summary
                </h3>
                {isSinglePoint && result.work_zone.start && (
                  <div className="flex gap-1">
                    <Button 
                      onClick={() => openGoogleMaps(result.google_maps.work_zone_start)}
                      className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                      title="Navigate"
                    >
                      🗺️
                    </Button>
                    <Button 
                      onClick={() => openStreetView(result.work_zone.start!.lat, result.work_zone.start!.lon)}
                      className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                      title="Street View"
                    >
                      🏠
                    </Button>
                    <Button 
                      onClick={() => {
                        const params = new URLSearchParams({
                          road_id: result.road_id,
                          road_name: result.road_name,
                          slk: result.work_zone.start_slk.toString(),
                          autostart: 'true'
                        })
                        window.location.href = `/drive?${params.toString()}`
                      }}
                      className="h-8 w-8 p-0 bg-blue-800 hover:bg-blue-900"
                      title="Track"
                    >
                      📍
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-lg font-medium">{result.road_name}</p>
              <p className="text-sm text-gray-400">
                Road ID: {result.road_id}
                {result.network_type && (
                  <span className={`ml-2 ${result.network_type === 'Local Road' ? 'text-amber-400' : 'text-gray-500'}`}>
                    ({result.network_type})
                  </span>
                )}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Start SLK</p>
                  <p className="font-mono">{result.work_zone.start_slk.toFixed(2)} km</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">End SLK</p>
                  <p className="font-mono">{result.work_zone.end_slk.toFixed(2)} km</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Zone Length</p>
                  <p className="font-medium">{result.work_zone.length_m} m</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Carriageway</p>
                  <p className="font-medium">{result.carriageway}</p>
                </div>
              </div>
            </div>

            {/* Traffic Volume */}
            {traffic && (
              <div className="bg-gray-800 rounded-lg">
                <button
                  onClick={() => setShowTraffic(!showTraffic)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <h3 className="text-sm font-semibold text-blue-400">
                    🚗 Traffic Volume
                  </h3>
                  <span className="text-gray-400 text-lg">{showTraffic ? '−' : '+'}</span>
                </button>
                {showTraffic && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400">AADT</p>
                        <p className="font-medium text-lg">{traffic.aadt?.toLocaleString() || 'N/A'}</p>
                        <p className="text-xs text-gray-500">vehicles/day</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Peak Hour (est.)</p>
                        <p className="font-medium text-lg">{traffic.peak_hour_volume || 'N/A'}</p>
                        <p className="text-xs text-gray-500">vehicles/hour</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Heavy Vehicles</p>
                        <p className="font-medium text-lg">{traffic.heavy_vehicle_percent}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Data Year</p>
                        <p className="font-medium text-lg">{traffic.aadt_year}</p>
                      </div>
                    </div>
                    
                    {traffic.distance_to_site !== undefined && (
                      <p className="text-xs text-cyan-400 mt-2">
                        📍 Nearest count site: {traffic.distance_to_site} km from work zone
                      </p>
                    )}
                    
                    <p className="text-xs text-gray-500 mt-2">
                      Source: {traffic.source}
                    </p>
                    
                    {traffic.nearest_sites && traffic.nearest_sites.length > 1 && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs text-gray-400 mb-2">Other nearby count sites:</p>
                        <div className="text-xs space-y-1">
                          {traffic.nearest_sites.slice(1, 4).map((site, i) => (
                            <div key={i} className="flex justify-between text-gray-300">
                              <span>{site.location}</span>
                              <span className="text-gray-500">
                                {site.aadt?.toLocaleString()} v/d ({site.distance_km} km)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {traffic.note && (
                      <p className="text-xs text-amber-400 mt-2">{traffic.note}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Signage Corridor Report */}
            <div className="bg-gray-800 rounded-lg">
              <button
                onClick={() => setShowSignageCorridor(!showSignageCorridor)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <h3 className="text-sm font-semibold text-blue-400">
                  📋 Signage in Corridor
                </h3>
                <span className="text-gray-400 text-lg">{showSignageCorridor ? '−' : '+'}</span>
              </button>
              {showSignageCorridor && (
                <div className="px-4 pb-4">
                  {/* Corridor Info */}
                  <div className="mb-3 text-xs text-gray-500">
                    Corridor: SLK {Math.max(0, result.work_zone.start_slk - 0.7).toFixed(2)} - 
                    {((result.work_zone.end_slk || result.work_zone.start_slk) + 0.7).toFixed(2)} km
                    (±700m from work zone)
                  </div>
                  
                  {signageLoading ? (
                    <p className="text-sm text-gray-400">Loading signage data...</p>
                  ) : signageCorridor.length === 0 ? (
                    <p className="text-sm text-gray-400">No signage data available for this corridor. 
                      Download offline data to see speed zones, rail crossings, and signs.</p>
                  ) : (
                    <div className="space-y-3">
                      {/* Intersections - Only within ±100m of work zone */}
                      {signageCorridor.filter(s => {
                        if (s.category !== 'intersection') return false;
                        // Only show intersections within ±100m (0.1 km) of work zone
                        const workZoneStart = result.work_zone.start_slk;
                        const workZoneEnd = result.work_zone.end_slk || result.work_zone.start_slk;
                        return s.slk >= (workZoneStart - 0.1) && s.slk <= (workZoneEnd + 0.1);
                      }).length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-purple-400 mb-2">🔀 INTERSECTIONS NEAR WORK ZONE (±100m)</h4>
                          <div className="space-y-1">
                            {signageCorridor.filter(s => {
                              if (s.category !== 'intersection') return false;
                              const workZoneStart = result.work_zone.start_slk;
                              const workZoneEnd = result.work_zone.end_slk || result.work_zone.start_slk;
                              return s.slk >= (workZoneStart - 0.1) && s.slk <= (workZoneEnd + 0.1);
                            }).map((sign, i) => (
                              <div key={`int-${i}`} className="flex justify-between items-center text-sm bg-purple-900/20 px-2 py-1 rounded">
                                <span className="font-mono text-yellow-400">SLK {sign.slk.toFixed(2)}</span>
                                <span className="text-gray-300">{sign.description}</span>
                                <span className="text-xs text-purple-400">{sign.action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Railway Crossings */}
                      {signageCorridor.filter(s => s.category === 'railway').length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-red-400 mb-2">🚂 RAILWAY CROSSINGS</h4>
                          <div className="space-y-1">
                            {signageCorridor.filter(s => s.category === 'railway').map((sign, i) => (
                              <div key={`rail-${i}`} className="flex justify-between items-center text-sm bg-red-900/20 px-2 py-1 rounded">
                                <span className="font-mono text-yellow-400">SLK {sign.slk.toFixed(2)}</span>
                                <span className="text-gray-300">{sign.description}</span>
                                <span className="text-xs text-amber-400">{sign.action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Speed Signs */}
                      {signageCorridor.filter(s => s.category === 'speed').length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-green-400 mb-2">⚡ SPEED RESTRICTION SIGNS</h4>
                          <div className="space-y-1">
                            {signageCorridor.filter(s => s.category === 'speed').map((sign, i) => {
                              return (
                              <div key={`speed-${i}`} className="flex justify-between items-center text-sm bg-gray-700/50 px-2 py-1 rounded">
                                <span className="font-mono text-yellow-400">SLK {sign.slk.toFixed(2)}</span>
                                <span className="text-gray-300">{sign.description}</span>
                                <span className="text-xs text-gray-400">{sign.carriageway}</span>
                              </div>
                            )})}
                          </div>
                        </div>
                      )}
                      
                      {/* Warning Signs */}
                      {signageCorridor.filter(s => s.category === 'warning').length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-yellow-400 mb-2">⚠️ WARNING SIGNS</h4>
                          <div className="space-y-1">
                            {signageCorridor.filter(s => s.category === 'warning').map((sign, i) => (
                              <div key={`warn-${i}`} className="flex justify-between items-center text-sm bg-yellow-900/20 px-2 py-1 rounded">
                                <span className="font-mono text-yellow-400">SLK {sign.slk.toFixed(2)}</span>
                                <span className="text-gray-300 flex-1 mx-2 truncate" title={sign.description}>{sign.description}</span>
                                <span className="text-xs text-gray-500">{sign.carriageway}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Summary */}
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Total items in corridor:</span>
                          <span className="text-white font-semibold">{signageCorridor.length}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-3">
                    Check site for all signage. Speed zones from MRWA data.
                  </p>
                </div>
              )}
            </div>

            {/* TC Positions */}
            <div className="bg-gray-800 rounded-lg">
              <button
                onClick={() => setShowTcPositions(!showTcPositions)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <h3 className="text-sm font-semibold text-blue-400">
                  🚧 TC Positions (±100m from work zone)
                </h3>
                <span className="text-gray-400 text-lg">{showTcPositions ? '−' : '+'}</span>
              </button>
              {showTcPositions && (
                <div className="px-4 pb-4">
                  <div className="space-y-2">
                    <div className="bg-gray-700/50 rounded p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">TC Start - SLK {result.tc_positions.start_slk.toFixed(2)}</p>
                        <div className="flex gap-1">
                          <Button 
                            onClick={() => openGoogleMaps(result.google_maps.tc_start)}
                            className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700"
                            title="Navigate"
                          >
                            🗺️
                          </Button>
                          {result.tc_positions.start && (
                            <Button 
                              onClick={() => openStreetView(result.tc_positions.start!.lat, result.tc_positions.start!.lon)}
                              className="h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700"
                              title="Street View"
                            >
                              🏠
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-700/50 rounded p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">TC End - SLK {result.tc_positions.end_slk.toFixed(2)}</p>
                        <div className="flex gap-1">
                          <Button 
                            onClick={() => openGoogleMaps(result.google_maps.tc_end)}
                            className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700"
                            title="Navigate"
                          >
                            🗺️
                          </Button>
                          {result.tc_positions.end && (
                            <Button 
                              onClick={() => openStreetView(result.tc_positions.end!.lat, result.tc_positions.end!.lon)}
                              className="h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700"
                              title="Street View"
                            >
                              🏠
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Intersecting Roads */}
            {(crossRoads.filter(road => 
              road.name.toLowerCase() !== result.road_name.toLowerCase()
            ).length > 0) && (
              <div className="bg-gray-800 rounded-lg">
                <button
                  onClick={() => setShowIntersections(!showIntersections)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <h3 className="text-sm font-semibold text-blue-400">
                    🔀 Intersecting Roads in TC Zone
                  </h3>
                  <span className="text-gray-400 text-lg">{showIntersections ? '−' : '+'}</span>
                </button>
                {showIntersections && (
                  <div className="px-4 pb-4">
                    <div className="space-y-2 text-sm">
                      {crossRoads.filter(road => 
                        road.name.toLowerCase() !== result.road_name.toLowerCase()
                      ).map((road, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-gray-700/50">
                          <div className="flex-1">
                            <span className="font-medium">{road.name}</span>
                            <span className="text-xs text-gray-500 ml-2">({road.roadType})</span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-400">{road.distance} km</span>
                            <span className="text-xs text-gray-500 block">from TC start</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-amber-400 mt-3">
                      ⚠️ Consider TC coverage for these intersecting roads
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Weather with Sun Data */}
            {weather && (
              <div className="bg-gray-800 rounded-lg">
                <button
                  onClick={() => setShowWeather(!showWeather)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <h3 className="text-sm font-semibold text-blue-400">
                    🌤️ Weather - {weather.location}
                    {warnings && warnings.count > 0 && (
                      <span className="ml-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {warnings.count} warning{warnings.count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </h3>
                  <span className="text-gray-400 text-lg">{showWeather ? '−' : '+'}</span>
                </button>
                {showWeather && (
                  <div className="px-4 pb-4">
                    {/* Weather Warnings */}
                    {warnings && warnings.warnings.length > 0 && (
                      <div className="bg-red-900/30 border border-red-500/50 rounded p-3 mb-4">
                        <h4 className="text-sm font-semibold text-red-400 mb-2">⚠️ Weather Warnings</h4>
                        <div className="space-y-2">
                          {warnings.warnings.map((warning, i) => (
                            <div key={i} className="text-sm">
                              <a 
                                href={warning.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-red-300 hover:text-red-200 underline"
                              >
                                {warning.title}
                              </a>
                              {warning.description && (
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{warning.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Wind Gust Alert */}
                    {weather.current.windGust >= windGustThreshold && (
                      <div className="bg-amber-900/30 border border-amber-500/50 rounded p-3 mb-4">
                        <p className="text-sm font-semibold text-amber-400">
                          💨 High Wind Gust Alert: {weather.current.windGust} km/h
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Threshold: {windGustThreshold} km/h - Exercise caution with traffic control devices
                        </p>
                      </div>
                    )}
                    
                    {/* Sun Data - First */}
                    <div className="bg-gray-700/30 rounded p-3 mb-4">
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="text-gray-400 text-xs">🌅 Sunrise</p>
                          <p className="font-medium">{weather.sun.sunrise}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">🌇 Sunset</p>
                          <p className="font-medium">{weather.sun.sunset}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">☀️ Daylight</p>
                          <p className="font-medium">{weather.sun.daylightHours}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-center">
                        <p className="text-gray-400 text-xs">UV Index</p>
                        <p className={`text-lg font-bold ${getUvColor(weather.sun.uvLevel)}`}>
                          {weather.sun.uvIndex} ({weather.sun.uvLevel})
                        </p>
                      </div>
                    </div>
                    
                    {/* Current Conditions */}
                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div>
                        <p className="text-gray-400">Condition</p>
                        <p className="font-medium">{weather.current.condition}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Temp</p>
                        <p className="font-medium">{weather.current.temp}°C</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Wind</p>
                        <p className="font-medium">{weather.current.windSpeed} km/h {weather.current.windDir}</p>
                        <p className={`text-xs ${weather.current.windGust >= windGustThreshold ? 'text-amber-400 font-semibold' : 'text-gray-500'}`}>
                          Gusts: {weather.current.windGust} km/h
                          {weather.current.windGust >= windGustThreshold && ' ⚠️'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Humidity</p>
                        <p className="font-medium">{weather.current.humidity}%</p>
                      </div>
                    </div>
                    
                    <h4 className="text-xs text-gray-400 mb-2">8 Hour Forecast</h4>
                    <div className="text-xs space-y-1">
                      {weather.forecast.map((hour, i) => (
                        <p key={i} className="flex justify-between text-gray-300">
                          <span className="w-12">{hour.time}</span>
                          <span className="flex-1 text-center">{hour.condition}</span>
                          <span className="w-10 text-right">{hour.temp}°</span>
                          <span className="w-20 text-right text-gray-500">{hour.windSpeed} km/h</span>
                        </p>
                      ))}
                    </div>
                    
                    {/* BOM Links */}
                    <div className="mt-4 pt-3 border-t border-gray-700 flex gap-2">
                      <a 
                        href="https://www.bom.gov.au/products/IDR703.shtml" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 text-center text-xs bg-gray-700 hover:bg-gray-600 text-blue-400 py-2 rounded"
                      >
                        📡 BOM Radar
                      </a>
                      <a 
                        href="https://www.bom.gov.au/wa/warnings/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 text-center text-xs bg-gray-700 hover:bg-gray-600 text-blue-400 py-2 rounded"
                      >
                        ⚠️ BOM Warnings
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nearby Amenities */}
            {places && (
              <div className="bg-gray-800 rounded-lg">
                <button
                  onClick={() => setShowAmenities(!showAmenities)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <h3 className="text-sm font-semibold text-blue-400">
                    🏥 Amenities
                  </h3>
                  <span className="text-gray-400 text-lg">{showAmenities ? '−' : '+'}</span>
                </button>
                {showAmenities && (
                  <div className="px-4 pb-4">
                    {/* Hospital */}
                    {places.hospital ? (
                      <div className="mb-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-red-400">
                            🏥 {places.hospital.name}
                            <span className="text-gray-500 text-sm ml-2">({places.hospital.distance} km)</span>
                            {places.hospital.isEmergency && (
                              <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded ml-1">Emergency</span>
                            )}
                          </p>
                          <div className="flex gap-1">
                            <Button 
                              onClick={() => openGoogleMaps(places.hospital?.googleMapsUrl || null)}
                              className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700"
                              title="Navigate"
                            >
                              🗺️
                            </Button>
                            <Button 
                              onClick={() => openStreetView(places.hospital!.lat, places.hospital!.lon)}
                              className="h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700"
                              title="Street View"
                            >
                              🏠
                            </Button>
                          </div>
                        </div>
                        {places.hospital.phone && (
                          <p className="text-sm text-gray-400">📞 {places.hospital.phone}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm mb-4">No hospital found nearby</p>
                    )}
                    
                    {/* Fuel Station */}
                    {places.fuelStation ? (
                      <div className="mb-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-yellow-400">
                            ⛽ {places.fuelStation.name}
                            <span className="text-gray-500 text-sm ml-2">({places.fuelStation.distance} km)</span>
                          </p>
                          <div className="flex gap-1">
                            <Button 
                              onClick={() => openGoogleMaps(places.fuelStation?.googleMapsUrl || null)}
                              className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700"
                              title="Navigate"
                            >
                              🗺️
                            </Button>
                            <Button 
                              onClick={() => openStreetView(places.fuelStation!.lat, places.fuelStation!.lon)}
                              className="h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700"
                              title="Street View"
                            >
                              🏠
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm mb-4">No fuel station found nearby</p>
                    )}
                    
                    {/* Toilet */}
                    {places.toilet ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-blue-400">
                            🚻 {places.toilet.name}
                            <span className="text-gray-500 text-sm ml-2">({places.toilet.distance} km)</span>
                          </p>
                          <div className="flex gap-1">
                            <Button 
                              onClick={() => openGoogleMaps(places.toilet?.googleMapsUrl || null)}
                              className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700"
                              title="Navigate"
                            >
                              🗺️
                            </Button>
                            <Button 
                              onClick={() => openStreetView(places.toilet!.lat, places.toilet!.lon)}
                              className="h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700"
                              title="Street View"
                            >
                              🏠
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No public toilet found nearby</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
