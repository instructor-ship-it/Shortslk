import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Earth's radius in meters (WGS-84 ellipsoid mean radius)
 */
const EARTH_RADIUS_M = 6_371_000;

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Distance in meters
 *
 * @example
 * // Distance from Perth to Sydney (~3,290 km)
 * haversineDistance(-31.9505, 115.8605, -33.8688, 151.2093)
 * // Returns: ~3290000 meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Convert degrees to radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * Calculate the great-circle distance between two points and return in kilometers
 * Convenience wrapper around haversineDistance
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistance(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * Convert degrees to approximate meters at a given latitude
 * Useful for quick bounding box calculations
 *
 * @param degrees - Distance in degrees
 * @param latitude - Latitude at which to calculate (affects longitude scale)
 * @returns Approximate distance in meters
 */
export function degreesToMeters(degrees: number, latitude: number = 0): number {
  // 1 degree latitude ≈ 111,000m
  // 1 degree longitude ≈ 111,000m * cos(latitude)
  const latMeters = 111_000;
  const avgLonMeters = 111_000 * Math.cos((latitude * Math.PI) / 180);
  const avgMeters = (latMeters + avgLonMeters) / 2;
  return degrees * avgMeters;
}

/**
 * Convert meters to approximate degrees at a given latitude
 * Inverse of degreesToMeters
 *
 * @param meters - Distance in meters
 * @param latitude - Latitude at which to calculate
 * @returns Approximate distance in degrees
 */
export function metersToDegrees(meters: number, latitude: number = 0): number {
  const latMeters = 111_000;
  const avgLonMeters = 111_000 * Math.cos((latitude * Math.PI) / 180);
  const avgMeters = (latMeters + avgLonMeters) / 2;
  return meters / avgMeters;
}
