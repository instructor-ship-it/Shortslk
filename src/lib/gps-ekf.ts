/**
 * Extended Kalman Filter for GPS Position Tracking
 *
 * This module implements an EKF optimized for road-based vehicle tracking.
 * It provides:
 * - Position filtering to reduce GPS noise
 * - Velocity estimation from GPS readings
 * - Position prediction during GPS outages
 * - Road geometry constraint for improved accuracy
 * - Uncertainty estimation for reliability feedback
 *
 * Key advantages over simple averaging:
 * - Optimal filtering (mathematically proven)
 * - Handles varying GPS accuracy
 * - Predicts during outages using velocity
 * - Provides uncertainty estimates
 */

import { haversineDistance } from './utils';

// ============================================================================
// Types
// ============================================================================

export interface GpsReading {
  lat: number;
  lon: number;
  speed?: number;        // m/s from GPS
  heading?: number;      // degrees from GPS
  accuracy?: number;     // meters (1 sigma)
  timestamp: number;     // milliseconds
}

export interface EkfState {
  // Position (lat, lon in degrees)
  lat: number;
  lon: number;

  // Velocity (m/s, converted to degrees for internal use)
  vLat: number;          // North-South velocity component
  vLon: number;          // East-West velocity component

  // Uncertainty (variances)
  pLat: number;          // Position variance (degrees²)
  pLon: number;
  pVLat: number;         // Velocity variance ((degrees/s)²)
  pVLon: number;

  // Metadata
  lastUpdate: number;    // timestamp of last update
  isPredicted: boolean;  // true if position is predicted (not measured)
  outageDuration: number; // milliseconds since last GPS fix
}

export interface EkfConfig {
  // Process noise - how much we expect the vehicle to move unpredictably
  processNoisePosition: number;    // Default: 5.0 (meters/second²)
  processNoiseVelocity: number;    // Default: 1.0 (meters/second³)

  // Measurement noise scaling
  measurementNoiseScale: number;   // Default: 1.0 (use GPS accuracy as-is)

  // Prediction limits
  maxPredictionTime: number;       // Max time to predict during outage (ms)
  maxPredictionDistance: number;   // Max distance to predict (meters)
  maxVelocityAge: number;          // Max age of velocity estimate (ms)

  // Initial uncertainty
  initialPositionVariance: number; // meters²
  initialVelocityVariance: number; // (m/s)²

  // Road constraint
  roadConstraintEnabled: boolean;  // Snap predictions to road geometry
  roadSearchRadius: number;        // meters - max distance to search for road
}

export interface EkfOutput {
  // Filtered position
  lat: number;
  lon: number;

  // Estimated velocity
  speedKmh: number;
  heading: number;

  // Uncertainty
  uncertaintyM: number;          // Position uncertainty in meters
  confidence: 'high' | 'medium' | 'low' | 'predicted';

  // Status
  isPredicted: boolean;
  outageDuration: number;        // ms since last GPS fix
  shouldWarn: boolean;           // True if uncertainty is high
}

// ============================================================================
// Constants
// ============================================================================

// Conversion factors
const METERS_PER_DEG_LAT = 111000;  // Approximate meters per degree latitude
const DEG_LAT_PER_METER = 1 / METERS_PER_DEG_LAT;

/**
 * Get meters per degree longitude at a given latitude
 */
function metersPerDegLon(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos(lat * Math.PI / 180);
}

function degLonPerMeter(lat: number): number {
  return 1 / metersPerDegLon(lat);
}

/**
 * Default EKF configuration optimized for road vehicles
 */
export const DEFAULT_EKF_CONFIG: EkfConfig = {
  processNoisePosition: 5.0,      // 5 m/s² - reasonable for road vehicles
  processNoiseVelocity: 1.0,      // 1 m/s³ - smooth acceleration changes
  measurementNoiseScale: 1.0,     // Use GPS accuracy as-is
  maxPredictionTime: 30_000,      // 30 seconds max prediction
  maxPredictionDistance: 500,     // 500 meters max
  maxVelocityAge: 60_000,         // 1 minute
  initialPositionVariance: 100,   // 100m² initial uncertainty
  initialVelocityVariance: 25,    // 25 (m/s)² - about 90 km/h
  roadConstraintEnabled: true,
  roadSearchRadius: 500,
};

// ============================================================================
// EKF Implementation
// ============================================================================

export class GpsEkf {
  private state: EkfState | null = null;
  private config: EkfConfig;
  private lastReading: GpsReading | null = null;
  private velocityReadings: Array<{ vLat: number; vLon: number; time: number }> = [];

  constructor(config: Partial<EkfConfig> = {}) {
    this.config = { ...DEFAULT_EKF_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EkfConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current state
   */
  getState(): EkfState | null {
    return this.state;
  }

  /**
   * Get current output (filtered position with metadata)
   */
  getOutput(): EkfOutput | null {
    if (!this.state) return null;

    const now = Date.now();
    const outageDuration = now - this.state.lastUpdate;

    // Calculate speed from velocity components (stored in degrees/second)
    // Convert to m/s: vLat * METERS_PER_DEG_LAT, vLon * metersPerDegLon
    const vNorthMs = this.state.vLat * METERS_PER_DEG_LAT;
    const vEastMs = this.state.vLon * metersPerDegLon(this.state.lat);
    const speedMs = Math.sqrt(vNorthMs * vNorthMs + vEastMs * vEastMs);
    
    // Handle NaN, Infinity, or unreasonably high speed (>500 km/h is clearly wrong)
    const MAX_REASONABLE_SPEED_MS = 500 / 3.6; // ~139 m/s = 500 km/h
    const clampedSpeedMs = Number.isFinite(speedMs) ? Math.min(speedMs, MAX_REASONABLE_SPEED_MS) : 0;
    const speedKmh = clampedSpeedMs * 3.6;

    // Heading: 0 = North, 90 = East, 180 = South, 270 = West
    let heading = Math.atan2(vEastMs, vNorthMs) * (180 / Math.PI);
    if (heading < 0) heading += 360;
    if (!Number.isFinite(heading)) heading = 0;

    // Uncertainty in meters
    const uncertaintyM = Math.sqrt(this.state.pLat) * METERS_PER_DEG_LAT;
    const safeUncertainty = Number.isFinite(uncertaintyM) ? Math.min(uncertaintyM, 1000) : 50;

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low' | 'predicted';
    if (this.state.isPredicted) {
      confidence = 'predicted';
    } else if (safeUncertainty < 15) {
      confidence = 'high';
    } else if (safeUncertainty < 50) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      lat: this.state.lat,
      lon: this.state.lon,
      speedKmh,
      heading,
      uncertaintyM: safeUncertainty,
      confidence,
      isPredicted: this.state.isPredicted,
      outageDuration,
      shouldWarn: safeUncertainty > 50 || outageDuration > 10_000,
    };
  }

  /**
   * Process a new GPS reading
   */
  update(reading: GpsReading): EkfOutput {
    const now = reading.timestamp || Date.now();

    // Initialize if first reading
    if (!this.state) {
      this.state = this.initialize(reading);
      this.lastReading = reading;
      return this.getOutput()!;
    }

    const dt = (now - this.state.lastUpdate) / 1000; // seconds

    // Predict step - propagate state forward
    this.predict(dt);

    // If we have a valid GPS reading, update step
    if (reading.accuracy && reading.accuracy < 100) {
      this.updateWithMeasurement(reading);
      this.state.isPredicted = false;
      this.state.outageDuration = 0;
      this.lastReading = reading;

      // Store velocity for averaging
      if (reading.speed !== undefined && reading.heading !== undefined) {
        this.storeVelocityReading(reading);
      }
    } else {
      // GPS is poor or missing - continue prediction
      this.state.isPredicted = true;
      this.state.outageDuration = now - this.state.lastUpdate;
    }

    return this.getOutput()!;
  }

  /**
   * Predict state forward (time update)
   * Uses constant velocity model
   */
  private predict(dt: number): void {
    if (!this.state) return;

    // Check prediction limits
    if (this.state.isPredicted) {
      const outageSeconds = this.state.outageDuration / 1000;
      if (outageSeconds > this.config.maxPredictionTime / 1000) {
        // Stop predicting - uncertainty too high
        return;
      }
    }

    // Convert process noise to degrees
    const qPos = this.config.processNoisePosition * dt * dt; // meters²
    const qVel = this.config.processNoiseVelocity * dt * dt * dt; // (m/s)²

    const qLatPos = (qPos * DEG_LAT_PER_METER) ** 2;
    const qLonPos = (qPos * degLonPerMeter(this.state.lat)) ** 2;
    const qLatVel = (qVel * DEG_LAT_PER_METER) ** 2;
    const qLonVel = (qVel * degLonPerMeter(this.state.lat)) ** 2;

    // State transition: x' = x + v * dt
    this.state.lat += this.state.vLat * dt;
    this.state.lon += this.state.vLon * dt;

    // Covariance propagation: P' = F * P * F' + Q
    // For constant velocity: F = [1, dt; 0, 1]
    // Simplified: P' = P + Q (since we're not doing full matrix math)
    this.state.pLat += qLatPos + this.state.pVLat * dt * dt;
    this.state.pLon += qLonPos + this.state.pVLon * dt * dt;
    this.state.pVLat += qLatVel;
    this.state.pVLon += qLonVel;

    // Enforce minimum variance
    const minVar = 1e-10;
    this.state.pLat = Math.max(this.state.pLat, minVar);
    this.state.pLon = Math.max(this.state.pLon, minVar);
    this.state.pVLat = Math.max(this.state.pVLat, minVar);
    this.state.pVLon = Math.max(this.state.pVLon, minVar);
  }

  /**
   * Update state with GPS measurement
   */
  private updateWithMeasurement(reading: GpsReading): void {
    if (!this.state) return;

    // Measurement noise from GPS accuracy
    const r = (reading.accuracy || 10) * this.config.measurementNoiseScale;
    const rLat = (r * DEG_LAT_PER_METER) ** 2;
    const rLon = (r * degLonPerMeter(reading.lat)) ** 2;

    // Kalman gain: K = P / (P + R)
    const kLat = this.state.pLat / (this.state.pLat + rLat);
    const kLon = this.state.pLon / (this.state.pLon + rLon);

    // Innovation: y = z - x (measurement - prediction)
    const yLat = reading.lat - this.state.lat;
    const yLon = reading.lon - this.state.lon;

    // State update: x = x + K * y
    this.state.lat += kLat * yLat;
    this.state.lon += kLon * yLon;

    // Covariance update: P = (I - K) * P
    this.state.pLat *= (1 - kLat);
    this.state.pLon *= (1 - kLon);

    // Update velocity if GPS provides speed/heading
    if (reading.speed !== undefined && reading.heading !== undefined) {
      this.updateVelocity(reading);
    }
  }

  /**
   * Update velocity from GPS speed and heading
   */
  private updateVelocity(reading: GpsReading): void {
    if (!this.state) return;
    
    // These should be defined when this method is called
    const speed = reading.speed ?? 0;
    const heading = reading.heading ?? 0;

    // Convert speed (m/s) and heading (degrees) to velocity components
    const headingRad = heading * Math.PI / 180;
    const vNorth = speed * Math.cos(headingRad); // m/s
    const vEast = speed * Math.sin(headingRad);  // m/s

    // Convert to degrees/second
    const measuredVLat = vNorth * DEG_LAT_PER_METER;
    const measuredVLon = vEast * degLonPerMeter(reading.lat);

    // Measurement noise for velocity (GPS speed accuracy is typically 0.5-2 m/s)
    const rV = 2.0; // m/s
    const rVLat = (rV * DEG_LAT_PER_METER) ** 2;
    const rVLon = (rV * degLonPerMeter(reading.lat)) ** 2;

    // Kalman gain for velocity
    const kVLat = this.state.pVLat / (this.state.pVLat + rVLat);
    const kVLon = this.state.pVLon / (this.state.pVLon + rVLon);

    // Update velocity
    this.state.vLat += kVLat * (measuredVLat - this.state.vLat);
    this.state.vLon += kVLon * (measuredVLon - this.state.vLon);

    // Update velocity covariance
    this.state.pVLat *= (1 - kVLat);
    this.state.pVLon *= (1 - kVLon);
  }

  /**
   * Store velocity reading for averaging
   */
  private storeVelocityReading(reading: GpsReading): void {
    const headingRad = reading.heading! * Math.PI / 180;
    const vLat = reading.speed! * Math.cos(headingRad) * DEG_LAT_PER_METER;
    const vLon = reading.speed! * Math.sin(headingRad) * degLonPerMeter(reading.lat);

    this.velocityReadings.push({
      vLat,
      vLon,
      time: reading.timestamp || Date.now()
    });

    // Keep only recent readings (last 30 seconds)
    const cutoff = Date.now() - 30_000;
    this.velocityReadings = this.velocityReadings.filter(r => r.time > cutoff);
  }

  /**
   * Initialize state from first GPS reading
   */
  private initialize(reading: GpsReading): EkfState {
    // Initialize velocity from speed/heading if available
    let vLat = 0;
    let vLon = 0;

    if (reading.speed !== undefined && reading.heading !== undefined) {
      const headingRad = reading.heading * Math.PI / 180;
      vLat = reading.speed * Math.cos(headingRad) * DEG_LAT_PER_METER;
      vLon = reading.speed * Math.sin(headingRad) * degLonPerMeter(reading.lat);
    }

    return {
      lat: reading.lat,
      lon: reading.lon,
      vLat,
      vLon,
      pLat: this.config.initialPositionVariance * DEG_LAT_PER_METER ** 2,
      pLon: this.config.initialPositionVariance * degLonPerMeter(reading.lat) ** 2,
      pVLat: this.config.initialVelocityVariance * DEG_LAT_PER_METER ** 2,
      pVLon: this.config.initialVelocityVariance * degLonPerMeter(reading.lat) ** 2,
      lastUpdate: reading.timestamp || Date.now(),
      isPredicted: false,
      outageDuration: 0,
    };
  }

  /**
   * Force a position update (e.g., from road constraint)
   */
  forcePosition(lat: number, lon: number): void {
    if (!this.state) return;
    this.state.lat = lat;
    this.state.lon = lon;
  }

  /**
   * Reset the filter
   */
  reset(): void {
    this.state = null;
    this.lastReading = null;
    this.velocityReadings = [];
  }

  /**
   * Get prediction info for display
   */
  getPredictionInfo(): { canPredict: boolean; remainingTime: number; uncertainty: number } | null {
    if (!this.state) return null;

    const outageMs = this.state.outageDuration;
    const remainingMs = Math.max(0, this.config.maxPredictionTime - outageMs);
    const uncertaintyM = Math.sqrt(this.state.pLat) * METERS_PER_DEG_LAT;

    return {
      canPredict: outageMs < this.config.maxPredictionTime && uncertaintyM < this.config.maxPredictionDistance,
      remainingTime: Math.round(remainingMs / 1000),
      uncertainty: Math.round(uncertaintyM),
    };
  }
}

// ============================================================================
// Road Constraint Helper
// ============================================================================

export interface RoadGeometry {
  road_id: string;
  road_name: string;
  geometry: Array<{ lat: number; lon: number; slk: number }>;
}

/**
 * Constrain a position to road geometry
 * Returns the closest point on the road and SLK
 */
export function constrainToRoad(
  lat: number,
  lon: number,
  roadGeometry: RoadGeometry,
  maxDistance: number = 50
): { lat: number; lon: number; slk: number; distance: number } | null {
  if (!roadGeometry.geometry || roadGeometry.geometry.length < 2) return null;

  let closestPoint: { lat: number; lon: number; slk: number; distance: number } | null = null;
  let minDistance = maxDistance;

  const points = roadGeometry.geometry;

  // Find closest point on road
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];

    // Project position onto line segment
    const result = projectPointOnSegment(lat, lon, p1.lat, p1.lon, p2.lat, p2.lon);

    if (result && result.distance < minDistance) {
      minDistance = result.distance;
      // Interpolate SLK
      const ratio = result.t;
      const slk = p1.slk + (p2.slk - p1.slk) * ratio;

      closestPoint = {
        lat: result.lat,
        lon: result.lon,
        slk,
        distance: result.distance,
      };
    }
  }

  return closestPoint;
}

/**
 * Project a point onto a line segment
 */
function projectPointOnSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): { lat: number; lon: number; t: number; distance: number } | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) return null;

  // Project point onto line (in degree space)
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  // Closest point on segment
  const closestLat = x1 + t * dx;
  const closestLon = y1 + t * dy;

  // Distance in meters using Haversine
  const distance = haversineDistance(px, py, closestLat, closestLon);

  return { lat: closestLat, lon: closestLon, t, distance };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate bearing between two points
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Calculate speed between two points
 */
export function calculateSpeedMs(
  lat1: number, lon1: number, lat2: number, lon2: number, dtMs: number
): number {
  if (dtMs === 0) return 0;
  const distanceM = haversineDistance(lat1, lon1, lat2, lon2);
  return distanceM / (dtMs / 1000);
}
