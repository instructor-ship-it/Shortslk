/**
 * GPS Tracking Hook with EKF Integration
 *
 * This hook provides comprehensive GPS tracking with:
 * - Extended Kalman Filter for position smoothing
 * - Road constraint for improved accuracy
 * - Position prediction during GPS outages
 * - Speed zone detection
 * - Destination tracking
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GpsEkf,
  GpsReading,
  EkfOutput,
  EkfConfig,
  DEFAULT_EKF_CONFIG,
  constrainToRoad,
} from '@/lib/gps-ekf';
import {
  findRoadNearGps,
  getSpeedZones,
  getSpeedLimitForDirection,
  type ParsedSpeedZone,
} from '@/lib/offline-db';

// ============================================================================
// Types
// ============================================================================

export interface GpsTrackingConfig {
  // EKF settings
  ekfEnabled: boolean;
  roadConstraint: boolean;
  maxPredictionTime: number;  // seconds
  showUncertainty: boolean;

  // Early warning settings (kept from original)
  earlyWarnings: boolean;
  warningLeadTime: number;    // seconds

  // GPS settings
  enableHighAccuracy: boolean;
  updateInterval: number;     // ms
}

export interface RoadInfo {
  road_id: string;
  road_name: string;
  slk: number;
  network_type: string;
  distance_m: number;
  is_predicted?: boolean;
}

export interface TrackingState {
  // Current position
  position: {
    lat: number;
    lon: number;
  } | null;

  // EKF output
  ekfOutput: EkfOutput | null;

  // Road information
  roadInfo: RoadInfo | null;
  slkDirection: 'increasing' | 'decreasing' | null;  // Direction of SLK travel

  // Speed information
  currentSpeed: number;       // km/h
  speedLimit: number;         // km/h
  isSpeeding: boolean;
  speedZones: ParsedSpeedZone[];
  hasDirectionalZones: boolean;  // True if road has different speed limits per direction

  // Destination tracking
  distanceToDest: number | null;  // km
  eta: number | null;             // seconds
  direction: 'towards' | 'away' | 'static' | null;

  // Status
  isTracking: boolean;
  isPredicted: boolean;
  uncertainty: number;            // meters
  confidence: 'high' | 'medium' | 'low' | 'predicted';
  outageDuration: number;         // ms
  lastUpdate: number | null;      // timestamp

  // Errors
  error: string | null;
}

export const DEFAULT_TRACKING_CONFIG: GpsTrackingConfig = {
  ekfEnabled: true,
  roadConstraint: true,
  maxPredictionTime: 30,
  showUncertainty: true,
  earlyWarnings: true,
  warningLeadTime: 3,
  enableHighAccuracy: true,
  updateInterval: 500,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGpsTracking(
  destRoadId?: string,
  destSlk?: number,
  config: Partial<GpsTrackingConfig> = {}
) {
  const fullConfig = { ...DEFAULT_TRACKING_CONFIG, ...config };

  // State
  const [state, setState] = useState<TrackingState>({
    position: null,
    ekfOutput: null,
    roadInfo: null,
    slkDirection: null,
    currentSpeed: 0,
    speedLimit: 100,
    isSpeeding: false,
    speedZones: [],
    hasDirectionalZones: false,
    distanceToDest: null,
    eta: null,
    direction: null,
    isTracking: false,
    isPredicted: false,
    uncertainty: 0,
    confidence: 'high',
    outageDuration: 0,
    lastUpdate: null,
    error: null,
  });

  // Refs
  const ekfRef = useRef<GpsEkf | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastRoadFetchRef = useRef<number>(0);
  const prevSlkRef = useRef<number | null>(null);
  const roadGeometryRef = useRef<any>(null);
  const slkDirectionRef = useRef<'increasing' | 'decreasing' | null>(null);

  // Initialize EKF
  useEffect(() => {
    if (fullConfig.ekfEnabled) {
      const ekfConfig: Partial<EkfConfig> = {
        maxPredictionTime: fullConfig.maxPredictionTime * 1000,
        roadConstraintEnabled: fullConfig.roadConstraint,
      };
      ekfRef.current = new GpsEkf(ekfConfig);
    } else {
      ekfRef.current = null;
    }

    return () => {
      ekfRef.current?.reset();
    };
  }, [fullConfig.ekfEnabled, fullConfig.maxPredictionTime, fullConfig.roadConstraint]);

  // Fetch speed zones when road changes
  const fetchSpeedZones = useCallback(async (roadId: string, slk: number, slkDirection: 'increasing' | 'decreasing' | null) => {
    try {
      const zones = await getSpeedZones(roadId);
      if (zones && zones.length > 0) {
        // Use direction-aware speed limit lookup with corrections
        const { speedLimit, hasDirectionalZones, hasCorrection } = getSpeedLimitForDirection(zones, slk, slkDirection, roadId);

        setState(prev => ({
          ...prev,
          speedZones: zones,
          speedLimit,
          isSpeeding: prev.currentSpeed > speedLimit,
          hasDirectionalZones,
        }));
      }
    } catch (e) {
      console.error('Failed to fetch speed zones:', e);
    }
  }, []);

  // Fetch road info
  const fetchRoadInfo = useCallback(async (lat: number, lon: number) => {
    try {
      const result = await findRoadNearGps(lat, lon, 0.5);

      if (result) {
        const roadInfo: RoadInfo = {
          road_id: result.road_id,
          road_name: result.road_name,
          slk: result.slk,
          network_type: result.network_type,
          distance_m: result.distance_m,
        };

        // Apply road constraint if enabled
        if (fullConfig.roadConstraint && roadGeometryRef.current) {
          const constrained = constrainToRoad(
            lat, lon, roadGeometryRef.current, fullConfig.maxPredictionTime
          );
          if (constrained) {
            roadInfo.slk = constrained.slk;
            roadInfo.distance_m = constrained.distance;
          }
        }

        setState(prev => {
          // Calculate SLK direction (increasing or decreasing)
          let slkDirection: 'increasing' | 'decreasing' | null = null;
          const currentSlk = roadInfo.slk;
          
          if (prev.currentSpeed >= 5 && prevSlkRef.current !== null) {
            const diff = currentSlk - prevSlkRef.current;
            if (Math.abs(diff) > 0.001) {
              slkDirection = diff > 0 ? 'increasing' : 'decreasing';
              slkDirectionRef.current = slkDirection;
            } else {
              slkDirection = slkDirectionRef.current; // Keep previous direction
            }
          } else {
            slkDirection = slkDirectionRef.current; // Keep previous direction when slow
          }

          // Calculate direction towards destination
          let direction: 'towards' | 'away' | 'static' | null = null;

          if (destRoadId && destSlk !== undefined && result.road_id === destRoadId) {
            if (prev.currentSpeed < 3) {
              direction = 'static';
            } else if (prevSlkRef.current !== null) {
              const currentDist = Math.abs(destSlk - currentSlk);
              const prevDist = Math.abs(destSlk - prevSlkRef.current);

              if (currentDist < prevDist - 0.001) {
                direction = 'towards';
              } else if (currentDist > prevDist + 0.001) {
                direction = 'away';
              } else {
                direction = 'static';
              }
            }
          }

          prevSlkRef.current = currentSlk;

          // Calculate distance and ETA
          let distanceToDest: number | null = null;
          let eta: number | null = null;

          if (destRoadId && destSlk !== undefined && result.road_id === destRoadId) {
            distanceToDest = Math.abs(destSlk - currentSlk);
            if (prev.currentSpeed > 3 && distanceToDest) {
              eta = (distanceToDest / prev.currentSpeed) * 3600;
            }
          }

          return {
            ...prev,
            roadInfo,
            slkDirection,
            distanceToDest,
            eta,
            direction,
            isSpeeding: prev.currentSpeed > prev.speedLimit,
          };
        });

        // Fetch speed zones with current direction
        await fetchSpeedZones(result.road_id, result.slk, slkDirectionRef.current);
      }
    } catch (e) {
      console.error('Failed to fetch road info:', e);
    }
  }, [destRoadId, destSlk, fetchSpeedZones, fullConfig]);

  // Process GPS update
  const processGpsUpdate = useCallback((position: GeolocationPosition) => {
    const now = Date.now();
    const reading: GpsReading = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      speed: position.coords.speed ?? undefined,
      heading: position.coords.heading ?? undefined,
      accuracy: position.coords.accuracy,
      timestamp: now,
    };

    // Process through EKF
    let ekfOutput: EkfOutput | null = null;

    if (fullConfig.ekfEnabled && ekfRef.current) {
      ekfOutput = ekfRef.current.update(reading);
    }

    // Determine position to use
    const useLat = ekfOutput?.lat ?? reading.lat;
    const useLon = ekfOutput?.lon ?? reading.lon;

    // Calculate current speed with safety checks
    // Raw GPS speed in km/h (with NaN/infinity protection)
    const rawSpeedMs = reading.speed ?? 0;
    const rawSpeedKmh = Number.isFinite(rawSpeedMs) && rawSpeedMs >= 0 
      ? Math.min(rawSpeedMs * 3.6, 500) // Cap at 500 km/h
      : 0;
    
    // EKF speed in km/h (already has safety checks in gps-ekf.ts)
    const ekfSpeedKmh = ekfOutput?.speedKmh ?? 0;
    
    // Use EKF speed only if it's reasonable, otherwise fall back to raw GPS
    let currentSpeed: number;
    if (ekfSpeedKmh > 0 && ekfSpeedKmh < 200 && Number.isFinite(ekfSpeedKmh)) {
      currentSpeed = ekfSpeedKmh;
    } else {
      currentSpeed = rawSpeedKmh;
    }
    
    // Apply stationary threshold - speeds below 2 km/h are likely GPS noise
    // This prevents showing 0.5-1.5 km/h when sitting still
    const STATIONARY_THRESHOLD_KMH = 2;
    if (currentSpeed < STATIONARY_THRESHOLD_KMH) {
      currentSpeed = 0;
    }

    // Calculate uncertainty with explicit fallback and safety checks
    let uncertainty: number = ekfOutput?.uncertaintyM ?? reading.accuracy ?? 50;
    if (!Number.isFinite(uncertainty) || uncertainty < 0) {
      uncertainty = 50;
    }

    // Update state
    setState(prev => ({
      ...prev,
      position: { lat: useLat, lon: useLon },
      ekfOutput,
      currentSpeed,
      isPredicted: ekfOutput?.isPredicted ?? false,
      uncertainty,
      confidence: ekfOutput?.confidence ?? 'high',
      outageDuration: ekfOutput?.outageDuration ?? 0,
      lastUpdate: now,
      error: null,
    }));

    // Fetch road info at throttled rate
    if (now - lastRoadFetchRef.current > fullConfig.updateInterval) {
      lastRoadFetchRef.current = now;
      fetchRoadInfo(useLat, useLon);
    }
  }, [fullConfig, fetchRoadInfo]);

  // Handle GPS error
  const handleGpsError = useCallback((error: GeolocationPositionError) => {
    let errorMessage: string;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please allow location access.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out.';
        break;
      default:
        errorMessage = `GPS Error: ${error.message}`;
    }

    setState(prev => ({ ...prev, error: errorMessage }));
  }, []);

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    // Reset state
    setState(prev => ({
      ...prev,
      isTracking: true,
      error: null,
      position: null,
      roadInfo: null,
    }));

    // Reset EKF
    ekfRef.current?.reset();
    prevSlkRef.current = null;

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      processGpsUpdate,
      handleGpsError,
      {
        enableHighAccuracy: fullConfig.enableHighAccuracy,
        maximumAge: 500,
        timeout: 10000,
      }
    );
  }, [fullConfig.enableHighAccuracy, processGpsUpdate, handleGpsError]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isTracking: false,
      position: null,
      roadInfo: null,
      slkDirection: null,
      ekfOutput: null,
    }));

    ekfRef.current?.reset();
    prevSlkRef.current = null;
    slkDirectionRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Update speed limit from zones when SLK or direction changes
  useEffect(() => {
    if (state.roadInfo && state.speedZones.length > 0) {
      const slk = state.roadInfo.slk;
      const { speedLimit, hasDirectionalZones, hasCorrection } = getSpeedLimitForDirection(
        state.speedZones, 
        slk, 
        state.slkDirection,
        state.roadInfo.road_id
      );

      setState(prev => ({
        ...prev,
        speedLimit,
        isSpeeding: prev.currentSpeed > speedLimit,
        hasDirectionalZones,
      }));
    }
  }, [state.roadInfo?.slk, state.speedZones, state.slkDirection]);

  // Return state and controls
  return {
    // State
    ...state,

    // Controls
    startTracking,
    stopTracking,

    // Utilities
    getEkfInfo: () => ekfRef.current?.getPredictionInfo(),
    resetEkf: () => ekfRef.current?.reset(),
  };
}

// ============================================================================
// Settings Hook
// ============================================================================

export function useGpsSettings() {
  const [settings, setSettings] = useState<GpsTrackingConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gpsTrackingConfig');
      if (saved) {
        try {
          return { ...DEFAULT_TRACKING_CONFIG, ...JSON.parse(saved) };
        } catch {
          return DEFAULT_TRACKING_CONFIG;
        }
      }
    }
    return DEFAULT_TRACKING_CONFIG;
  });

  const updateSetting = useCallback(<K extends keyof GpsTrackingConfig>(
    key: K,
    value: GpsTrackingConfig[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      localStorage.setItem('gpsTrackingConfig', JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  const resetSettings = useCallback(() => {
    localStorage.removeItem('gpsTrackingConfig');
    setSettings(DEFAULT_TRACKING_CONFIG);
  }, []);

  return {
    settings,
    updateSetting,
    resetSettings,
  };
}
