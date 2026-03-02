/**
 * Client-side Offline Database
 * Uses IndexedDB to store road data for fast offline access
 */

import { haversineDistance } from './utils';

const DB_NAME = 'RoadFinderDB';
const DB_VERSION = 3; // Incremented for dataset metadata store

// ============================================================================
// Speed Sign Overrides (Community-Verified Corrections)
// ============================================================================

/**
 * Speed sign override based on physical signage.
 * 
 * Sign Types:
 * - Single + Not Replicated: Repeater sign (informational only, no zone created)
 * - Single + Replicated: Direction-specific zone (different speeds each direction)
 * - Double + Replicated: Same speed both directions (Single carriageway zone)
 * 
 * Direction (Australian Left-Hand Driving):
 * - "True Left": Sign faces traffic travelling INCREASING SLK (driving on left side of road)
 * - "True Right": Sign faces traffic travelling DECREASING SLK (driving on left side of road)
 * 
 * Example: On M031, a sign at SLK 64.81 facing "True Right" traffic shows the speed
 * for vehicles travelling DECREASING SLK (towards SLK 64.00, 63.00, etc.)
 */
export interface SpeedSignOverride {
  id: string;
  road_id: string;
  road_name: string;
  common_usage_name?: string;
  
  // Sign location
  slk: number;
  lat?: number;
  lon?: number;
  
  // Sign configuration
  direction: 'True Left' | 'True Right';
  sign_type: 'Single' | 'Double';
  replicated: boolean;  // Is there a matching sign on the other side of road?
  
  // Zone definition (only if replicated)
  start_slk: number;
  end_slk?: number;
  
  // Speeds
  approach_speed?: number;  // Speed BEFORE this sign in selected direction
  front_speed: number;      // Speed shown on front face (selected direction)
  back_speed?: number;      // Speed on back face (opposite direction) - only for Double
  
  // Verification
  verified_by?: string;
  verified_date?: string;
  note?: string;
  source: 'community_verified' | 'mrwa_corrected';
  
  // MRWA comparison
  mrwa_slk?: number;
  discrepancy_m?: number;
}

interface SpeedSignsFile {
  version: string;
  last_updated: string;
  description: string;
  disclaimer: string;
  signs: SpeedSignOverride[];
}

// Cached signs
let cachedSigns: SpeedSignOverride[] | null = null;

/**
 * Load speed sign overrides from the API (which reads from file)
 */
export async function loadSpeedSignOverrides(): Promise<SpeedSignOverride[]> {
  if (cachedSigns) {
    return cachedSigns;
  }

  try {
    // Fetch from API to get the most recent data
    const response = await fetch('/api/overrides');
    if (!response.ok) {
      console.warn('Speed overrides API not available, trying static file');
      // Fallback to static file
      const staticResponse = await fetch(`/data/speed-overrides.json?t=${Date.now()}`);
      if (!staticResponse.ok) {
        return [];
      }
      const data = await staticResponse.json();
      const signs: SpeedSignOverride[] = data.signs || [];
      cachedSigns = signs;
      return cachedSigns;
    }

    const data: SpeedSignsFile = await response.json();
    const signs: SpeedSignOverride[] = data.signs || [];
    cachedSigns = signs;
    return cachedSigns;
  } catch (error) {
    console.error('Failed to load speed overrides:', error);
    return [];
  }
}

/**
 * Get speed sign overrides for a specific road
 * Pass empty string or null to get ALL signs
 */
export async function getSpeedSignOverrides(roadId: string): Promise<SpeedSignOverride[]> {
  const signs = await loadSpeedSignOverrides();
  // If roadId is empty or null, return all signs
  if (!roadId || roadId === '') {
    return signs;
  }
  return signs.filter(s => s.road_id === roadId);
}

/**
 * Clear the cached signs (call when signs are updated)
 */
export function clearSpeedOverridesCache(): void {
  cachedSigns = null;
}

/**
 * Get all overrides metadata (for display in UI)
 */
export async function getSpeedOverridesMetadata(): Promise<{
  version: string;
  last_updated: string;
  total_overrides: number;
  roads_affected: string[];
}> {
  try {
    // Fetch from API first
    const response = await fetch('/api/overrides');
    if (!response.ok) {
      // Fallback to static file
      const staticResponse = await fetch(`/data/speed-overrides.json?t=${Date.now()}`);
      if (!staticResponse.ok) {
        return { version: '0', last_updated: '', total_overrides: 0, roads_affected: [] };
      }
      const data: SpeedSignsFile = await staticResponse.json();
      const roads: string[] = [...new Set(data.signs?.map(s => s.road_id) || [])];
      return {
        version: data.version || '0',
        last_updated: data.last_updated || '',
        total_overrides: data.signs?.length || 0,
        roads_affected: roads
      };
    }

    const data: SpeedSignsFile = await response.json();
    const roads: string[] = [...new Set(data.signs?.map(s => s.road_id) || [])];

    return {
      version: data.version || '0',
      last_updated: data.last_updated || '',
      total_overrides: data.signs?.length || 0,
      roads_affected: roads
    };
  } catch {
    return { version: '0', last_updated: '', total_overrides: 0, roads_affected: [] };
  }
}

/**
 * Convert speed signs to parsed speed zones for use in the app.
 * 
 * Logic:
 * - Single + Not Replicated: No zone created (repeater sign only)
 * - Single + Replicated: Direction-specific zone (Left or Right carriageway)
 * - Double + Replicated: Single carriageway zone (same speed both directions)
 * 
 * Australian Left-Hand Driving:
 * - True Left = faces INCREASING SLK traffic = Left carriageway
 * - True Right = faces DECREASING SLK traffic = Right carriageway
 */
export function signsToSpeedZones(signs: SpeedSignOverride[]): ParsedSpeedZone[] {
  const zones: ParsedSpeedZone[] = [];
  
  for (const sign of signs) {
    // Skip non-replicated single signs (repeaters don't define zones)
    if (sign.sign_type === 'Single' && !sign.replicated) {
      continue;
    }
    
    // Must have end_slk if replicated
    if (sign.replicated && !sign.end_slk) {
      console.warn(`Sign ${sign.id} is replicated but has no end_slk`);
      continue;
    }
    
    if (sign.sign_type === 'Double' && sign.replicated) {
      // Double + Replicated = Same speed both directions (Single carriageway)
      zones.push({
        road_id: sign.road_id,
        road_name: sign.road_name,
        start_slk: sign.start_slk,
        end_slk: sign.end_slk!,
        speed_limit: sign.front_speed,
        carriageway: 'Single',
        is_override: true,
        override_id: sign.id,
        override_note: sign.note,
        override_source: sign.source
      });
    } else if (sign.sign_type === 'Single' && sign.replicated) {
      // Single + Replicated = Direction-specific zone
      // True Left = INCREASING SLK = Left carriageway
      // True Right = DECREASING SLK = Right carriageway
      const carriageway = sign.direction === 'True Right' ? 'Right' : 'Left';
      zones.push({
        road_id: sign.road_id,
        road_name: sign.road_name,
        start_slk: sign.start_slk,
        end_slk: sign.end_slk!,
        speed_limit: sign.front_speed,
        carriageway: carriageway,
        is_override: true,
        override_id: sign.id,
        override_note: sign.note,
        override_source: sign.source
      });
    }
  }
  
  // Sort by start_slk
  zones.sort((a, b) => a.start_slk - b.start_slk);
  
  return zones;
}

// Legacy compatibility alias
export type SpeedZoneOverride = SpeedSignOverride;
export const getSpeedOverrides = getSpeedSignOverrides;
export const loadSpeedOverrides = loadSpeedSignOverrides;

interface RoadData {
  road_id: string;
  road_name: string;
  min_slk: number;
  max_slk: number;
  network_type: string;
  segments: Array<{
    start_slk: number;
    end_slk: number;
    geometry: [number, number][] | null;
  }>;
}

interface SpeedZoneData {
  road_id: string;
  road_name: string;
  start_slk: number;
  end_slk: number;
  speed_limit: number | string; // Can be number or "110km/h" string from MRWA
  carriageway: string;
  is_default?: boolean; // True for default/unrestricted zones
  raw_text?: string; // Original MRWA text for verification
  requires_verification?: boolean; // Flag for zones needing site verification
  speed_corrected?: boolean; // True if this zone was corrected from default
  correction_reason?: string; // Reason for the correction
  correction_confidence?: 'high' | 'medium' | 'low'; // Confidence level
  correction_note?: string; // Additional notes
}

// Parsed speed zone with numeric speed_limit
export interface ParsedSpeedZone {
  road_id: string;
  road_name: string;
  start_slk: number;
  end_slk: number;
  speed_limit: number;
  carriageway: string;
  is_default?: boolean; // True for default/unrestricted zones (state limit applies)
  raw_text?: string; // Original MRWA text for verification
  requires_verification?: boolean; // Flag for zones needing site verification
  speed_corrected?: boolean; // True if this zone was corrected from default
  correction_reason?: string; // Reason for the correction
  correction_confidence?: 'high' | 'medium' | 'low'; // Confidence level
  // Override fields
  is_override?: boolean; // True if this zone is from an override
  override_id?: string; // ID of the override
  override_note?: string; // Note from the override
  override_source?: 'default' | 'community_verified' | 'mrwa_corrected'; // Source of override
}

// Rail Crossing data
export interface RailCrossingData {
  road_id: string;
  road_name: string;
  slk: number;
  carriageway: string;
  crossing_type: string; // Public, Private
  crossing_no: string;
}

// Regulatory Sign data
export interface RegulatorySignData {
  road_id: string;
  road_name: string;
  slk: number;
  carriageway: string;
  sign_type: string;
  panel_design: string;
  panel_meaning: string;
}

// Warning Sign data
export interface WarningSignData {
  road_id: string;
  road_name: string;
  slk: number;
  carriageway: string;
  sign_type: string;
  panel_design: string;
  panel_meaning: string;
}

// Sign for corridor report
export interface SignageItem {
  slk: number;
  carriageway: string;
  category: 'speed' | 'regulatory' | 'warning' | 'railway' | 'intersection';
  sign_type: string;
  description: string;
  action: string;
  // Intersection context for speed signs near intersections
  nearIntersection?: {
    roadName: string;
    roadId: string;
    intersectionSlk: number;
    distanceToIntersection: number; // in meters
  };
  // Speed limit value if applicable
  speedLimit?: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('regions')) {
        db.createObjectStore('regions', { keyPath: 'region' });
      }

      if (!db.objectStoreNames.contains('speedZones')) {
        db.createObjectStore('speedZones', { keyPath: 'road_id' });
      }

      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }

      // New object stores for signage data
      if (!db.objectStoreNames.contains('railCrossings')) {
        db.createObjectStore('railCrossings', { keyPath: 'road_id' });
      }

      if (!db.objectStoreNames.contains('regulatorySigns')) {
        db.createObjectStore('regulatorySigns', { keyPath: 'road_id' });
      }

      if (!db.objectStoreNames.contains('warningSigns')) {
        db.createObjectStore('warningSigns', { keyPath: 'road_id' });
      }

      // Dataset sync metadata
      if (!db.objectStoreNames.contains('datasetMeta')) {
        db.createObjectStore('datasetMeta', { keyPath: 'dataset' });
      }
    };
  });
}

/**
 * Check if offline data is available
 */
export async function isOfflineDataAvailable(): Promise<boolean> {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get('download_date');

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Get offline data metadata (download date, total roads)
 */
export async function getOfflineMetadata(): Promise<{
  download_date: string;
  total_roads: number;
  regions: string[];
} | null> {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');

      const dateRequest = store.get('download_date');
      const roadsRequest = store.get('total_roads');
      const regionsRequest = store.get('regions');

      let download_date = '';
      let total_roads = 0;
      let regions: string[] = [];

      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed === 3) {
          if (download_date) {
            resolve({ download_date, total_roads, regions });
          } else {
            resolve(null);
          }
        }
      };

      dateRequest.onsuccess = () => {
        download_date = dateRequest.result?.value || '';
        checkComplete();
      };
      roadsRequest.onsuccess = () => {
        total_roads = roadsRequest.result?.value || 0;
        checkComplete();
      };
      regionsRequest.onsuccess = () => {
        regions = regionsRequest.result?.value || [];
        checkComplete();
      };

      dateRequest.onerror = () => checkComplete();
      roadsRequest.onerror = () => checkComplete();
      regionsRequest.onerror = () => checkComplete();
    });
  } catch {
    return null;
  }
}

/**
 * Parse speed limit from various formats (number or "110km/h" string)
 */
function parseSpeedLimit(speedLimit: number | string): number {
  if (typeof speedLimit === 'number') {
    return speedLimit;
  }
  if (typeof speedLimit === 'string') {
    const match = speedLimit.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return 100; // Default
}

/**
 * Get speed zones for a road, with sign-based overrides applied
 * 
 * Priority:
 * 1. Community-verified signs converted to zones
 * 2. MRWA data from IndexedDB
 */
export async function getSpeedZones(roadId: string): Promise<ParsedSpeedZone[]> {
  try {
    // First, get sign overrides for this road and convert to zones
    const signs = await getSpeedSignOverrides(roadId);
    const overrideZones = signsToSpeedZones(signs);
    
    // Get MRWA data from IndexedDB
    const db = await initDB();
    const mrwaZones = await new Promise<ParsedSpeedZone[]>((resolve) => {
      const tx = db.transaction('speedZones', 'readonly');
      const store = tx.objectStore('speedZones');
      const request = store.get(roadId);

      request.onsuccess = () => {
        const zones = request.result?.zones || [];
        // Parse speed limits to numbers
        const parsedZones: ParsedSpeedZone[] = zones.map((zone: SpeedZoneData) => ({
          road_id: zone.road_id,
          road_name: zone.road_name,
          start_slk: zone.start_slk,
          end_slk: zone.end_slk,
          speed_limit: parseSpeedLimit(zone.speed_limit),
          carriageway: zone.carriageway
        }));
        resolve(parsedZones);
      };

      request.onerror = () => resolve([]);
    });

    // If no overrides, just return MRWA data
    if (overrideZones.length === 0) {
      return mrwaZones;
    }

    // Filter out MRWA zones that are completely covered by community overrides
    const filteredMrwaZones = mrwaZones.filter(mrwa => {
      for (const override of overrideZones) {
        // If override completely contains the MRWA zone, don't include MRWA zone
        if (override.start_slk <= mrwa.start_slk && override.end_slk >= mrwa.end_slk) {
          return false;
        }
        // If MRWA zone starts within an override, skip it
        if (mrwa.start_slk >= override.start_slk && mrwa.start_slk < override.end_slk) {
          return false;
        }
      }
      return true;
    });

    // Combine filtered MRWA zones with override zones
    const combinedZones = [...filteredMrwaZones, ...overrideZones];
    
    // Sort by start_slk
    combinedZones.sort((a, b) => a.start_slk - b.start_slk);

    return combinedZones;
  } catch {
    return [];
  }
}

/**
 * Get speed limit considering direction of travel (True Right vs True Left)
 * 
 * In WA road terminology:
 * - "True Right" = right side when facing direction of increasing SLK
 * - "True Left" = left side when facing direction of increasing SLK
 * 
 * For bidirectional zones with different speed limits:
 * - If SLK direction is INCREASING, you're on the RIGHT side (True Right)
 * - If SLK direction is DECREASING, you're on the LEFT side (True Left)
 */
export function getSpeedLimitForDirection(
  zones: ParsedSpeedZone[],
  slk: number,
  slkDirection: 'increasing' | 'decreasing' | null,
  roadId?: string
): { speedLimit: number; zone: ParsedSpeedZone | null; hasDirectionalZones: boolean; hasCorrection: boolean } {
  // Find zones that contain this SLK
  const matchingZones = zones.filter(z => slk >= z.start_slk && slk <= z.end_slk);
  
  if (matchingZones.length === 0) {
    return { speedLimit: 100, zone: null, hasDirectionalZones: false, hasCorrection: false };
  }
  
  // Check if we have directional zones (Right/Left carriageways)
  const rightZones = matchingZones.filter(z => z.carriageway === 'Right');
  const leftZones = matchingZones.filter(z => z.carriageway === 'Left');
  const singleZones = matchingZones.filter(z => z.carriageway === 'Single');
  
  const hasDirectionalZones = rightZones.length > 0 || leftZones.length > 0;
  
  let speedLimit: number;
  let zone: ParsedSpeedZone | null = null;
  
  // If we have directional zones, use them based on travel direction
  if (hasDirectionalZones && slkDirection) {
    // INCREASING SLK = True Right side
    // DECREASING SLK = True Left side
    zone = slkDirection === 'increasing' 
      ? (rightZones[0] || leftZones[0] || singleZones[0])
      : (leftZones[0] || rightZones[0] || singleZones[0]);
    
    if (zone) {
      speedLimit = zone.speed_limit;
    } else {
      speedLimit = 100;
    }
  } else if (singleZones.length > 0) {
    // Fall back to Single carriageway zone
    zone = singleZones[0];
    speedLimit = zone.speed_limit;
  } else {
    // Last resort: use first matching zone
    zone = matchingZones[0];
    speedLimit = zone.speed_limit;
  }
  
  // Apply manual corrections if roadId is provided
  let hasCorrection = false;
  if (roadId && slkDirection) {
    const correctedSpeed = applySpeedZoneCorrections(roadId, slk, slkDirection, speedLimit);
    if (correctedSpeed !== speedLimit) {
      hasCorrection = true;
      speedLimit = correctedSpeed;
    }
  }
  
  return { speedLimit, zone, hasDirectionalZones, hasCorrection };
}

/**
 * Speed zone with directional info for regulatory sign cross-reference
 */
export interface SpeedSignInfo {
  slk: number;
  carriageway: string;
  sign_type: string;
}

/**
 * Get speed signs near a specific SLK for validation
 * Returns regulatory signs within 200m of the given SLK
 */
export async function getSpeedSignsNearSlk(
  roadId: string,
  slk: number,
  radiusKm: number = 0.2
): Promise<SpeedSignInfo[]> {
  try {
    const signs = await getRegulatorySigns(roadId);
    
    // Filter to speed restriction signs (R4-1 series)
    const speedSigns = signs.filter(s => 
      s.panel_design?.startsWith('R4-1') ||
      s.panel_meaning?.toUpperCase().includes('SPEED')
    );
    
    // Filter to signs within radius
    const nearbySigns = speedSigns.filter(s => 
      Math.abs(s.slk - slk) <= radiusKm
    );
    
    return nearbySigns.map(s => ({
      slk: s.slk,
      carriageway: s.carriageway,
      sign_type: s.panel_design
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// Manual Speed Zone Corrections
// ============================================================================

/**
 * Manual speed zone correction for cases where MRWA data is incorrect
 * (e.g., bidirectional zones recorded as "Single" with wrong speed)
 */
export interface SpeedZoneCorrection {
  road_id: string;
  start_slk: number;
  end_slk: number;
  direction: 'increasing' | 'decreasing';  // True Right = increasing, True Left = decreasing
  correct_speed: number;
  original_speed: number;
  notes?: string;
  created_at: string;
}

const CORRECTIONS_KEY = 'speedZoneCorrections';

/**
 * Get all stored speed zone corrections
 */
export function getSpeedZoneCorrections(): SpeedZoneCorrection[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CORRECTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add a speed zone correction
 */
export function addSpeedZoneCorrection(correction: Omit<SpeedZoneCorrection, 'created_at'>): void {
  const corrections = getSpeedZoneCorrections();
  const newCorrection: SpeedZoneCorrection = {
    ...correction,
    created_at: new Date().toISOString(),
  };
  
  // Remove any existing correction for the same road/SLK range/direction
  const filtered = corrections.filter(c => 
    !(c.road_id === correction.road_id &&
      c.start_slk === correction.start_slk &&
      c.end_slk === correction.end_slk &&
      c.direction === correction.direction)
  );
  
  filtered.push(newCorrection);
  localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(filtered));
}

/**
 * Remove a speed zone correction
 */
export function removeSpeedZoneCorrection(
  roadId: string,
  startSlk: number,
  endSlk: number,
  direction: 'increasing' | 'decreasing'
): void {
  const corrections = getSpeedZoneCorrections();
  const filtered = corrections.filter(c => 
    !(c.road_id === roadId &&
      c.start_slk === startSlk &&
      c.end_slk === endSlk &&
      c.direction === direction)
  );
  localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(filtered));
}

/**
 * Clear all speed zone corrections
 */
export function clearSpeedZoneCorrections(): void {
  localStorage.removeItem(CORRECTIONS_KEY);
}

/**
 * Apply speed zone corrections to a road's speed zones
 * Returns the speed limit to use, or null if no correction applies
 */
export function applySpeedZoneCorrections(
  roadId: string,
  slk: number,
  slkDirection: 'increasing' | 'decreasing' | null,
  originalSpeedLimit: number
): number {
  if (!slkDirection) return originalSpeedLimit;
  
  const corrections = getSpeedZoneCorrections();
  
  // Find a correction that applies to this location
  const applicableCorrection = corrections.find(c => 
    c.road_id === roadId &&
    slk >= c.start_slk &&
    slk <= c.end_slk &&
    c.direction === slkDirection
  );
  
  return applicableCorrection?.correct_speed ?? originalSpeedLimit;
}

/**
 * Get rail crossings for a road
 */
export async function getRailCrossings(roadId: string): Promise<RailCrossingData[]> {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('railCrossings', 'readonly');
      const store = tx.objectStore('railCrossings');
      const request = store.get(roadId);

      request.onsuccess = () => {
        resolve(request.result?.crossings || []);
      };

      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Get regulatory signs for a road
 */
export async function getRegulatorySigns(roadId: string): Promise<RegulatorySignData[]> {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('regulatorySigns', 'readonly');
      const store = tx.objectStore('regulatorySigns');
      const request = store.get(roadId);

      request.onsuccess = () => {
        resolve(request.result?.signs || []);
      };

      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Get warning signs for a road
 */
export async function getWarningSigns(roadId: string): Promise<WarningSignData[]> {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('warningSigns', 'readonly');
      const store = tx.objectStore('warningSigns');
      const request = store.get(roadId);

      request.onsuccess = () => {
        resolve(request.result?.signs || []);
      };

      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Find intersections for a road within a corridor
 * This checks road geometries for points that intersect with the main road
 */
async function findIntersectionsInCorridor(
  roadId: string,
  corridorStart: number,
  corridorEnd: number
): Promise<{ slk: number; roadName: string; roadId: string }[]> {
  const intersections: { slk: number; roadName: string; roadId: string }[] = [];
  
  try {
    const db = await initDB();
    
    // Get the main road's geometry first
    const mainRoadData = await new Promise<RoadData | null>((resolve) => {
      const tx = db.transaction('regions', 'readonly');
      const store = tx.objectStore('regions');
      const request = store.getAll();
      
      request.onsuccess = () => {
        for (const region of request.result) {
          const road = region.roads?.find((r: RoadData) => r.road_id === roadId);
          if (road) {
            resolve(road);
            return;
          }
        }
        resolve(null);
      };
      request.onerror = () => resolve(null);
    });
    
    if (!mainRoadData || !mainRoadData.segments) {
      return intersections;
    }
    
    // Get segments within corridor and their geometry bounds
    const corridorSegments = mainRoadData.segments.filter(seg => 
      seg.start_slk <= corridorEnd && seg.end_slk >= corridorStart
    );
    
    if (corridorSegments.length === 0 || !corridorSegments[0].geometry) {
      return intersections;
    }
    
    // Get geometry bounds for the corridor
    const allPoints = corridorSegments.flatMap(seg => seg.geometry || []);
    if (allPoints.length === 0) return intersections;
    
    const minLat = Math.min(...allPoints.map(p => p[0])) - 0.005; // ~500m buffer
    const maxLat = Math.max(...allPoints.map(p => p[0])) + 0.005;
    const minLon = Math.min(...allPoints.map(p => p[1])) - 0.005;
    const maxLon = Math.max(...allPoints.map(p => p[1])) + 0.005;
    
    // Search all roads for intersections
    const allRegions = await new Promise<any[]>((resolve) => {
      const tx = db.transaction('regions', 'readonly');
      const store = tx.objectStore('regions');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
    
    // Find roads that have geometry points within our corridor bounds
    for (const region of allRegions) {
      for (const road of region.roads || []) {
        if (road.road_id === roadId) continue; // Skip the main road
        
        if (road.segments) {
          for (const seg of road.segments) {
            if (!seg.geometry) continue;
            
            // Check if any point is within the corridor bounds
            for (const point of seg.geometry) {
              const [lat, lon] = point;
              
              if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
                // This road has geometry near our corridor - find the closest main road point
                // to estimate the intersection SLK
                let closestSlk: number | null = null;
                let minDist = Infinity;
                
                for (const mainSeg of corridorSegments) {
                  if (!mainSeg.geometry) continue;
                  
                  for (let i = 0; i < mainSeg.geometry.length; i++) {
                    const [mainLat, mainLon] = mainSeg.geometry[i];
                    // Use Haversine for accurate distance in meters
                    const dist = haversineDistance(lat, lon, mainLat, mainLon);
                    
                    if (dist < minDist && dist < 200) { // Within 200m
                      minDist = dist;
                      // Estimate SLK based on position in segment
                      const segLen = mainSeg.end_slk - mainSeg.start_slk;
                      const ratio = i / (mainSeg.geometry.length - 1 || 1);
                      closestSlk = mainSeg.start_slk + segLen * ratio;
                    }
                  }
                }
                
                if (closestSlk !== null) {
                  // Check we haven't already found this intersection
                  const exists = intersections.some(i => 
                    Math.abs(i.slk - closestSlk!) < 0.1 && i.roadId === road.road_id
                  );
                  
                  if (!exists) {
                    intersections.push({
                      slk: closestSlk,
                      roadName: road.road_name,
                      roadId: road.road_id
                    });
                  }
                }
                break; // Only need one point per segment
              }
            }
          }
        }
      }
    }
    
    // Sort by SLK
    intersections.sort((a, b) => a.slk - b.slk);
    
  } catch (e) {
    console.error('Error finding intersections:', e);
  }
  
  return intersections;
}

/**
 * Get all signage in corridor for Signage Corridor Report
 * @param roadId Road ID
 * @param corridorStart SLK start of corridor
 * @param corridorEnd SLK end of corridor
 */
export async function getSignageInCorridor(
  roadId: string,
  corridorStart: number,
  corridorEnd: number
): Promise<SignageItem[]> {
  const signage: SignageItem[] = [];

  // Find intersections in the corridor first
  const intersections = await findIntersectionsInCorridor(roadId, corridorStart, corridorEnd);
  
  // Get speed zones
  const speedZones = await getSpeedZones(roadId);
  
  // Group zones by carriageway and find boundaries (sign locations)
  const zoneBoundaries = new Map<string, { slk: number; fromSpeed: number; toSpeed: number }[]>();
  
  for (const zone of speedZones) {
    const cwy = zone.carriageway;
    if (!zoneBoundaries.has(cwy)) {
      zoneBoundaries.set(cwy, []);
    }
    
    // Start of zone is a sign location (if within corridor)
    if (zone.start_slk >= corridorStart && zone.start_slk <= corridorEnd) {
      zoneBoundaries.get(cwy)!.push({
        slk: zone.start_slk,
        fromSpeed: 0, // Unknown previous speed
        toSpeed: zone.speed_limit
      });
    }
  }
  
  // Sort zones by SLK and determine speed changes
  for (const [cwy, boundaries] of zoneBoundaries) {
    boundaries.sort((a, b) => a.slk - b.slk);
    
    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      const prevSpeed = i > 0 ? boundaries[i - 1].toSpeed : 0;
      
      // Check if this speed sign is near an intersection
      let nearestIntersection: { roadName: string; roadId: string; intersectionSlk: number; distanceToIntersection: number } | undefined;
      
      for (const intersection of intersections) {
        const distKm = Math.abs(boundary.slk - intersection.slk);
        const distM = distKm * 1000;
        
        // If within 500m of intersection, mark it
        if (distM <= 500) {
          if (!nearestIntersection || distM < nearestIntersection.distanceToIntersection) {
            nearestIntersection = {
              roadName: intersection.roadName,
              roadId: intersection.roadId,
              intersectionSlk: intersection.slk,
              distanceToIntersection: distM
            };
          }
        }
      }
      
      const signItem: SignageItem = {
        slk: boundary.slk,
        carriageway: cwy,
        category: 'speed',
        sign_type: 'Speed Restriction',
        description: prevSpeed > 0 ? `${prevSpeed} → ${boundary.toSpeed} km/h` : `${boundary.toSpeed} km/h zone`,
        action: nearestIntersection ? 'COVER REQUIRED' : 'Check if covering needed',
        speedLimit: boundary.toSpeed
      };
      
      if (nearestIntersection) {
        signItem.nearIntersection = nearestIntersection;
      }
      
      signage.push(signItem);
    }
  }

  // Get rail crossings
  const railCrossings = await getRailCrossings(roadId);
  for (const crossing of railCrossings) {
    if (crossing.slk >= corridorStart && crossing.slk <= corridorEnd) {
      signage.push({
        slk: crossing.slk,
        carriageway: crossing.carriageway,
        category: 'railway',
        sign_type: 'Railway Crossing',
        description: `${crossing.crossing_type} crossing`,
        action: 'Contact Arc Infrastructure'
      });
    }
  }

  // Get regulatory signs (speed restriction signs)
  const regulatorySigns = await getRegulatorySigns(roadId);
  for (const sign of regulatorySigns) {
    if (sign.slk >= corridorStart && sign.slk <= corridorEnd) {
      // Check if this is a speed restriction sign
      const isSpeedSign = sign.panel_meaning.toUpperCase().includes('SPEED') || 
                          sign.panel_design?.startsWith('R4-');
      
      if (isSpeedSign) {
        // Check if near an intersection
        let nearestIntersection: { roadName: string; roadId: string; intersectionSlk: number; distanceToIntersection: number } | undefined;
        
        for (const intersection of intersections) {
          const distKm = Math.abs(sign.slk - intersection.slk);
          const distM = distKm * 1000;
          
          if (distM <= 500) {
            if (!nearestIntersection || distM < nearestIntersection.distanceToIntersection) {
              nearestIntersection = {
                roadName: intersection.roadName,
                roadId: intersection.roadId,
                intersectionSlk: intersection.slk,
                distanceToIntersection: distM
              };
            }
          }
        }
        
        const signItem: SignageItem = {
          slk: sign.slk,
          carriageway: sign.carriageway,
          category: 'regulatory',
          sign_type: sign.panel_design,
          description: sign.panel_meaning,
          action: nearestIntersection ? 'COVER REQUIRED' : 'Check if covering needed'
        };
        
        if (nearestIntersection) {
          signItem.nearIntersection = nearestIntersection;
        }
        
        signage.push(signItem);
      } else {
        // Other important regulatory signs
        const importantSigns = ['STOP', 'GIVE WAY', 'KEEP LEFT', 'NO ENTRY'];
        const isImportant = importantSigns.some(s => 
          sign.panel_meaning.toUpperCase().includes(s)
        );
        
        if (isImportant) {
          signage.push({
            slk: sign.slk,
            carriageway: sign.carriageway,
            category: 'regulatory',
            sign_type: sign.panel_design,
            description: sign.panel_meaning,
            action: 'Check site'
          });
        }
      }
    }
  }

  // Get warning signs
  const warningSigns = await getWarningSigns(roadId);
  for (const sign of warningSigns) {
    if (sign.slk >= corridorStart && sign.slk <= corridorEnd) {
      // Filter to important signs only
      const importantSigns = ['ADVISORY', 'CURVE', 'SPEED', 'RAILWAY', 'SIGNALS', 'STOP SIGN AHEAD', 'GIVE WAY AHEAD'];
      const isImportant = importantSigns.some(s => 
        sign.panel_meaning.toUpperCase().includes(s)
      );
      
      if (isImportant) {
        signage.push({
          slk: sign.slk,
          carriageway: sign.carriageway,
          category: 'warning',
          sign_type: sign.panel_design,
          description: sign.panel_meaning,
          action: 'Check site'
        });
      }
    }
  }

  // Add intersection markers
  for (const intersection of intersections) {
    signage.push({
      slk: intersection.slk,
      carriageway: 'Intersection',
      category: 'intersection',
      sign_type: 'Cross Road',
      description: intersection.roadName,
      action: 'Check TC coverage'
    });
  }

  // Sort by SLK
  signage.sort((a, b) => a.slk - b.slk);

  return signage;
}

/**
 * Get road type priority (lower = higher priority)
 * State Roads (M-roads, H-roads) should be prioritized over Local Roads
 * when distances are very close (within 50m)
 */
function getRoadTypePriority(networkType: string, roadId: string): number {
  // State Roads (Main Highways, Highways) - highest priority
  if (networkType === 'State Road') return 1;
  if (roadId.startsWith('M') || roadId.startsWith('H')) return 1;
  
  // Regional Roads - second priority
  if (networkType === 'Regional Road') return 2;
  if (roadId.startsWith('R')) return 2;
  
  // Local Roads - third priority
  if (networkType === 'Local Road') return 3;
  
  // Miscellaneous and unknown - lowest priority
  return 4;
}

/**
 * Find road near GPS coordinates
 * Uses projection math for accurate SLK calculation
 * Prioritizes State Roads over Local Roads only when distances are very close (within 50m)
 */
export async function findRoadNearGps(
  lat: number,
  lon: number,
  maxDistanceKm: number = 0.5
): Promise<{
  road_id: string;
  road_name: string;
  slk: number;
  distance_m: number;
  network_type: string;
} | null> {
  try {
    const db = await initDB();

    return new Promise((resolve) => {
      const tx = db.transaction('regions', 'readonly');
      const store = tx.objectStore('regions');
      const request = store.getAll();

      request.onsuccess = () => {
        // Collect all candidates within range
        const candidates: any[] = [];

        for (const region of request.result) {
          for (const road of region.roads) {
            for (const segment of road.segments) {
              if (!segment.geometry || segment.geometry.length < 2) continue;

              const geometry = segment.geometry;
              const segmentSlkLength = segment.end_slk - segment.start_slk;
              if (segmentSlkLength <= 0) continue;

              // Calculate cumulative distances along the path using Haversine
              let totalPathDist = 0;
              const pathDists: number[] = [0];

              for (let i = 1; i < geometry.length; i++) {
                const [lat1, lon1] = geometry[i - 1];
                const [lat2, lon2] = geometry[i];
                // Haversine gives accurate distance in meters
                const dist = haversineDistance(lat1, lon1, lat2, lon2);
                totalPathDist += dist;
                pathDists.push(totalPathDist);
              }

              if (totalPathDist === 0) continue;

              // Find closest point on each line segment
              for (let i = 1; i < geometry.length; i++) {
                const [lat1, lon1] = geometry[i - 1];
                const [lat2, lon2] = geometry[i];

                const dx = lat2 - lat1;
                const dy = lon2 - lon1;
                const segmentDistDeg = Math.sqrt(dx * dx + dy * dy);

                if (segmentDistDeg === 0) continue;

                // Project GPS point onto line segment (in degree space for proportional calculation)
                const t = Math.max(0, Math.min(1,
                  ((lat - lat1) * dx + (lon - lon1) * dy) / (segmentDistDeg * segmentDistDeg)
                ));

                const closestLat = lat1 + t * dx;
                const closestLon = lon1 + t * dy;

                // Use Haversine for accurate distance in meters
                const distM = haversineDistance(lat, lon, closestLat, closestLon);
                const maxDistM = maxDistanceKm * 1000;

                if (distM < maxDistM) {
                  // Calculate segment distance in meters using Haversine
                  const segmentDistM = haversineDistance(lat1, lon1, lat2, lon2);
                  // Proportional distance along segment
                  const distAlongSegment = t * segmentDistM;
                  const distAlongPath = pathDists[i - 1] + distAlongSegment;
                  const ratio = distAlongPath / totalPathDist;
                  const slk = segment.start_slk + segmentSlkLength * ratio;

                  candidates.push({
                    road_id: road.road_id,
                    road_name: road.road_name,
                    slk: Math.round(slk * 1000) / 1000,  // 3 decimal places for high precision
                    distance_m: Math.round(distM),
                    network_type: road.network_type,
                    priority: getRoadTypePriority(road.network_type, road.road_id)
                  });
                }
              }
            }
          }
        }

        if (candidates.length === 0) {
          resolve(null);
          return;
        }

        // Sort by distance first (closest is usually correct)
        // Then use priority as tiebreaker only when distances are very close (within 50m)
        const PRIORITY_DISTANCE_THRESHOLD = 50; // meters
        
        candidates.sort((a, b) => {
          const distDiff = Math.abs(a.distance_m - b.distance_m);
          
          // If distances are very close, use priority to break the tie
          if (distDiff <= PRIORITY_DISTANCE_THRESHOLD && a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          
          // Otherwise, just use distance (closer is better)
          return a.distance_m - b.distance_m;
        });

        // Return the best match
        resolve({
          road_id: candidates[0].road_id,
          road_name: candidates[0].road_name,
          slk: candidates[0].slk,
          distance_m: candidates[0].distance_m,
          network_type: candidates[0].network_type
        });
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Store region data
 */
export async function storeRegionData(region: string, roads: RoadData[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('regions', 'readwrite');
    const store = tx.objectStore('regions');
    store.put({ region, roads });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Store speed zones (merges with existing zones for multi-region roads)
 */
export async function storeSpeedZones(zones: SpeedZoneData[]): Promise<void> {
  if (!zones.length) return;
  
  const db = await initDB();
  
  // Group new zones by road_id
  const byRoad = new Map<string, SpeedZoneData[]>();
  for (const zone of zones) {
    if (!byRoad.has(zone.road_id)) {
      byRoad.set(zone.road_id, []);
    }
    byRoad.get(zone.road_id)!.push(zone);
  }

  // First, get all existing zones for these roads (separate transaction)
  const existingZones = new Map<string, SpeedZoneData[]>();
  
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('speedZones', 'readonly');
    const store = tx.objectStore('speedZones');
    
    let pending = byRoad.size;
    
    for (const road_id of byRoad.keys()) {
      const request = store.get(road_id);
      request.onsuccess = () => {
        if (request.result?.zones) {
          existingZones.set(road_id, request.result.zones);
        }
        pending--;
        if (pending === 0) resolve();
      };
      request.onerror = () => {
        pending--;
        if (pending === 0) resolve();
      };
    }
    
    tx.onerror = () => reject(tx.error);
    
    // Handle case where byRoad is empty
    if (pending === 0) resolve();
  });

  // Now merge and store in a single write transaction
  return new Promise((resolve, reject) => {
    const tx = db.transaction('speedZones', 'readwrite');
    const store = tx.objectStore('speedZones');

    for (const [road_id, newZones] of byRoad) {
      const existing = existingZones.get(road_id) || [];
      
      // Merge: create a map to dedupe by SLK range
      const mergedMap = new Map<string, SpeedZoneData>();
      
      // Add existing zones first
      for (const z of existing) {
        const key = `${z.start_slk}-${z.end_slk}-${z.carriageway}`;
        mergedMap.set(key, z);
      }
      
      // Add/overwrite with new zones
      for (const z of newZones) {
        const key = `${z.start_slk}-${z.end_slk}-${z.carriageway}`;
        mergedMap.set(key, z);
      }
      
      // Store merged result
      const mergedZones = Array.from(mergedMap.values());
      store.put({ road_id, zones: mergedZones });
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Store rail crossings
 */
export async function storeRailCrossings(crossings: RailCrossingData[] | undefined): Promise<void> {
  if (!crossings || !crossings.length) return;
  
  const db = await initDB();
  
  // Group by road_id
  const byRoad = new Map<string, RailCrossingData[]>();
  for (const crossing of crossings) {
    if (!crossing.road_id) continue;
    if (!byRoad.has(crossing.road_id)) {
      byRoad.set(crossing.road_id, []);
    }
    byRoad.get(crossing.road_id)!.push(crossing);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('railCrossings', 'readwrite');
    const store = tx.objectStore('railCrossings');

    for (const [road_id, roadCrossings] of byRoad) {
      store.put({ road_id, crossings: roadCrossings });
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Store regulatory signs
 */
export async function storeRegulatorySigns(signs: RegulatorySignData[] | undefined): Promise<void> {
  if (!signs || !signs.length) return;
  
  const db = await initDB();
  
  // Group by road_id
  const byRoad = new Map<string, RegulatorySignData[]>();
  for (const sign of signs) {
    if (!sign.road_id) continue;
    if (!byRoad.has(sign.road_id)) {
      byRoad.set(sign.road_id, []);
    }
    byRoad.get(sign.road_id)!.push(sign);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('regulatorySigns', 'readwrite');
    const store = tx.objectStore('regulatorySigns');

    for (const [road_id, roadSigns] of byRoad) {
      store.put({ road_id, signs: roadSigns });
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Store warning signs
 */
export async function storeWarningSigns(signs: WarningSignData[] | undefined): Promise<void> {
  if (!signs || !signs.length) return;
  
  const db = await initDB();
  
  // Group by road_id
  const byRoad = new Map<string, WarningSignData[]>();
  for (const sign of signs) {
    if (!sign.road_id) continue;
    if (!byRoad.has(sign.road_id)) {
      byRoad.set(sign.road_id, []);
    }
    byRoad.get(sign.road_id)!.push(sign);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('warningSigns', 'readwrite');
    const store = tx.objectStore('warningSigns');

    for (const [road_id, roadSigns] of byRoad) {
      store.put({ road_id, signs: roadSigns });
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Store metadata
 */
export async function storeMetadata(data: {
  download_date: string;
  total_roads: number;
  regions: string[];
}): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('metadata', 'readwrite');
    const store = tx.objectStore('metadata');

    store.put({ key: 'download_date', value: data.download_date });
    store.put({ key: 'total_roads', value: data.total_roads });
    store.put({ key: 'regions', value: data.regions });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clear all offline data
 */
export async function clearOfflineData(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['regions', 'speedZones', 'metadata', 'railCrossings', 'regulatorySigns', 'warningSigns', 'datasetMeta'], 'readwrite');

    tx.objectStore('regions').clear();
    tx.objectStore('speedZones').clear();
    tx.objectStore('metadata').clear();
    tx.objectStore('railCrossings').clear();
    tx.objectStore('regulatorySigns').clear();
    tx.objectStore('warningSigns').clear();
    tx.objectStore('datasetMeta').clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Dataset metadata for tracking sync status
 */
export interface DatasetMetadata {
  dataset: string;
  lastSync: string;
  recordCount: number;
  source: 'static' | 'mrwa';
}

/**
 * Store dataset metadata after sync
 */
export async function storeDatasetMeta(meta: DatasetMetadata): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('datasetMeta', 'readwrite');
    const store = tx.objectStore('datasetMeta');
    store.put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get metadata for a specific dataset
 */
export async function getDatasetMeta(dataset: string): Promise<DatasetMetadata | null> {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('datasetMeta', 'readonly');
    const store = tx.objectStore('datasetMeta');
    const request = store.get(dataset);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

/**
 * Get all dataset metadata
 */
export async function getAllDatasetMeta(): Promise<DatasetMetadata[]> {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('datasetMeta', 'readonly');
    const store = tx.objectStore('datasetMeta');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

/**
 * Get detailed stats for all datasets
 */
export async function getDetailedStats(): Promise<{
  roads: { count: number; lastSync: string | null };
  speedZones: { count: number; lastSync: string | null };
  railCrossings: { count: number; lastSync: string | null };
  regulatorySigns: { count: number; lastSync: string | null };
  warningSigns: { count: number; lastSync: string | null };
}> {
  const db = await initDB();

  const countStore = async (storeName: string): Promise<number> => {
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  };

  const [roadsCount, speedZonesCount, railCrossingsCount, regulatorySignsCount, warningSignsCount] =
    await Promise.all([
      countStore('regions'),
      countStore('speedZones'),
      countStore('railCrossings'),
      countStore('regulatorySigns'),
      countStore('warningSigns')
    ]);

  const allMeta = await getAllDatasetMeta();
  const getSyncDate = (dataset: string) => {
    const meta = allMeta.find(m => m.dataset === dataset);
    return meta?.lastSync || null;
  };

  return {
    roads: { count: roadsCount, lastSync: getSyncDate('roads') },
    speedZones: { count: speedZonesCount, lastSync: getSyncDate('speedZones') },
    railCrossings: { count: railCrossingsCount, lastSync: getSyncDate('railCrossings') },
    regulatorySigns: { count: regulatorySignsCount, lastSync: getSyncDate('regulatorySigns') },
    warningSigns: { count: warningSignsCount, lastSync: getSyncDate('warningSigns') }
  };
}

/**
 * Store roads data (for MRWA sync - grouped by region)
 */
export async function storeRoadsData(roads: any[], source: 'static' | 'mrwa' = 'mrwa'): Promise<number> {
  if (!roads.length) return 0;

  const db = await initDB();

  // Group roads by region
  const byRegion = new Map<string, any[]>();
  for (const road of roads) {
    const region = road.region || 'Unknown';
    if (!byRegion.has(region)) {
      byRegion.set(region, []);
    }
    byRegion.get(region)!.push(road);
  }

  // Store each region
  return new Promise((resolve, reject) => {
    const tx = db.transaction('regions', 'readwrite');
    const store = tx.objectStore('regions');

    for (const [region, regionRoads] of byRegion) {
      // Get existing roads for this region
      const getRequest = store.get(region);
      getRequest.onsuccess = () => {
        const existing = getRequest.result?.roads || [];
        // Merge roads
        const mergedMap = new Map<string, any>();
        for (const r of existing) {
          mergedMap.set(r.road_id, r);
        }
        for (const r of regionRoads) {
          mergedMap.set(r.road_id, r);
        }
        store.put({ region, roads: Array.from(mergedMap.values()) });
      };
    }

    tx.oncomplete = async () => {
      // Store metadata
      await storeDatasetMeta({
        dataset: 'roads',
        lastSync: new Date().toISOString(),
        recordCount: roads.length,
        source
      });
      resolve(roads.length);
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Correct default speed zones based on adjacent zones
 * Default zones have text like "50km/h applies in built up areas or 110km/h outside built up areas"
 * Logic:
 *   - If adjacent zones are ≤80 km/h → built-up area → 50 km/h
 *   - If adjacent zones are ≥90 km/h → rural area → 110 km/h
 *   - Validate: no more than 30 km/h speed drop in one step (Australian standard)
 */
export function correctDefaultZones(zones: SpeedZoneData[]): SpeedZoneData[] {
  // Group zones by road for adjacency analysis
  const byRoad = new Map<string, SpeedZoneData[]>();
  for (const zone of zones) {
    if (!byRoad.has(zone.road_id)) {
      byRoad.set(zone.road_id, []);
    }
    byRoad.get(zone.road_id)!.push(zone);
  }

  // Sort each road's zones by SLK
  for (const [_, roadZones] of byRoad) {
    roadZones.sort((a, b) => a.start_slk - b.start_slk);
  }

  const corrected: SpeedZoneData[] = [];

  for (const zone of zones) {
    // Only correct default zones
    if (!zone.is_default) {
      corrected.push(zone);
      continue;
    }

    const roadZones = byRoad.get(zone.road_id) || [];

    // Find adjacent zones (overlapping or nearby SLK ranges)
    const adjacentZones = roadZones.filter(z =>
      z.road_id === zone.road_id &&
      z.carriageway === zone.carriageway &&
      !z.is_default && // Only use non-default zones for context
      (
        // Zone starts within or adjacent to this zone
        (z.start_slk >= zone.start_slk - 1 && z.start_slk <= zone.end_slk + 1) ||
        // Zone ends within or adjacent to this zone
        (z.end_slk >= zone.start_slk - 1 && z.end_slk <= zone.end_slk + 1) ||
        // Zone encompasses this zone
        (z.start_slk <= zone.start_slk && z.end_slk >= zone.end_slk)
      )
    );

    if (adjacentZones.length === 0) {
      // No adjacent zones to determine context - keep as 110
      corrected.push({
        ...zone,
        speed_limit: 110,
        correction_note: 'No adjacent zones found - using rural default'
      });
      continue;
    }

    // Count low-speed vs high-speed adjacent zones
    const lowSpeedAdjacents = adjacentZones.filter(z => {
      const speed = typeof z.speed_limit === 'number' ? z.speed_limit : 110;
      return speed <= 80;
    });
    const highSpeedAdjacents = adjacentZones.filter(z => {
      const speed = typeof z.speed_limit === 'number' ? z.speed_limit : 110;
      return speed >= 90;
    });

    const avgAdjacentSpeed = adjacentZones.reduce((sum, z) => {
      const speed = typeof z.speed_limit === 'number' ? z.speed_limit : 110;
      return sum + speed;
    }, 0) / adjacentZones.length;

    // Determine correct speed
    let correctedSpeed = 110;
    let reason = '';

    if (lowSpeedAdjacents.length > highSpeedAdjacents.length) {
      correctedSpeed = 50;
      reason = `Built-up area: ${lowSpeedAdjacents.length} low-speed (≤80) vs ${highSpeedAdjacents.length} high-speed (≥90) adjacent zones`;
    } else if (highSpeedAdjacents.length > lowSpeedAdjacents.length) {
      correctedSpeed = 110;
      reason = `Rural area: ${highSpeedAdjacents.length} high-speed (≥90) vs ${lowSpeedAdjacents.length} low-speed (≤80) adjacent zones`;
    } else if (avgAdjacentSpeed <= 80) {
      correctedSpeed = 50;
      reason = `Built-up area: avg adjacent speed ${Math.round(avgAdjacentSpeed)} km/h`;
    } else {
      correctedSpeed = 110;
      reason = `Rural area: avg adjacent speed ${Math.round(avgAdjacentSpeed)} km/h`;
    }

    // Validate speed transition (max 30 km/h drop)
    // Check if setting this to 50 would cause an invalid transition
    const prevZone = roadZones.find(z =>
      z.carriageway === zone.carriageway &&
      z.end_slk <= zone.start_slk + 0.1 &&
      z.end_slk >= zone.start_slk - 0.1
    );
    const nextZone = roadZones.find(z =>
      z.carriageway === zone.carriageway &&
      z.start_slk <= zone.end_slk + 0.1 &&
      z.start_slk >= zone.end_slk - 0.1
    );

    if (correctedSpeed === 50) {
      // Check if previous zone is high speed (would cause >30 km/h drop)
      const prevSpeed = prevZone?.speed_limit;
      if (prevSpeed && typeof prevSpeed === 'number' && prevSpeed >= 90) {
        // Invalid transition: 90→50 would be 40 km/h drop
        correctedSpeed = 110;
        reason = `Override: prevented invalid ${prevSpeed}→50 transition (max 30 km/h drop)`;
      }
    }

    corrected.push({
      ...zone,
      speed_limit: correctedSpeed,
      speed_corrected: true,
      correction_reason: reason,
      correction_confidence: adjacentZones.length >= 2 ? 'high' : 'medium'
    });
  }

  return corrected;
}

/**
 * Store speed zones data (for MRWA sync)
 * Applies default zone corrections before storing
 */
export async function storeSpeedZonesData(zones: any[], source: 'static' | 'mrwa' = 'mrwa'): Promise<number> {
  if (!zones.length) return 0;

  // Apply corrections to default zones before storing
  const correctedZones = correctDefaultZones(zones);

  await storeSpeedZones(correctedZones);
  await storeDatasetMeta({
    dataset: 'speedZones',
    lastSync: new Date().toISOString(),
    recordCount: correctedZones.length,
    source
  });
  return correctedZones.length;
}

/**
 * Store rail crossings data (for MRWA sync)
 */
export async function storeRailCrossingsData(crossings: any[], source: 'static' | 'mrwa' = 'mrwa'): Promise<number> {
  if (!crossings.length) return 0;
  await storeRailCrossings(crossings);
  await storeDatasetMeta({
    dataset: 'railCrossings',
    lastSync: new Date().toISOString(),
    recordCount: crossings.length,
    source
  });
  return crossings.length;
}

/**
 * Store regulatory signs data (for MRWA sync)
 */
export async function storeRegulatorySignsData(signs: any[], source: 'static' | 'mrwa' = 'mrwa'): Promise<number> {
  if (!signs.length) return 0;
  await storeRegulatorySigns(signs);
  await storeDatasetMeta({
    dataset: 'regulatorySigns',
    lastSync: new Date().toISOString(),
    recordCount: signs.length,
    source
  });
  return signs.length;
}

/**
 * Store warning signs data (for MRWA sync)
 */
export async function storeWarningSignsData(signs: any[], source: 'static' | 'mrwa' = 'mrwa'): Promise<number> {
  if (!signs.length) return 0;
  await storeWarningSigns(signs);
  await storeDatasetMeta({
    dataset: 'warningSigns',
    lastSync: new Date().toISOString(),
    recordCount: signs.length,
    source
  });
  return signs.length;
}

/**
 * Clear a specific dataset
 */
export async function clearDataset(dataset: string): Promise<void> {
  const db = await initDB();

  const storeMap: Record<string, string> = {
    roads: 'regions',
    speedZones: 'speedZones',
    railCrossings: 'railCrossings',
    regulatorySigns: 'regulatorySigns',
    warningSigns: 'warningSigns'
  };

  const storeName = storeMap[dataset];
  if (!storeName) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName, 'datasetMeta'], 'readwrite');
    tx.objectStore(storeName).clear();
    tx.objectStore('datasetMeta').delete(dataset);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
