'use client';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  initDB,
  isOfflineDataAvailable as checkOfflineData,
  getSpeedZones,
  getSpeedZoneCorrections,
  addSpeedZoneCorrection,
  removeSpeedZoneCorrection,
  clearSpeedZoneCorrections,
  type ParsedSpeedZone,
  type SpeedZoneCorrection
} from '@/lib/offline-db';
import { useGpsTracking, useGpsSettings, type GpsTrackingConfig } from '@/hooks/useGpsTracking';

// App version
const APP_VERSION = 'RC 1.0.2';

// GPS lag compensation from localStorage
interface GpsLagSettings {
  gpsLagCompensation?: number;
  speedLookaheadTime?: number;
}

function DriveContent() {
  const searchParams = useSearchParams();

  // Destination from URL params
  const destRoadId = searchParams.get('road_id') || '';
  const destRoadName = searchParams.get('road_name') || '';
  const destSlkStr = searchParams.get('slk') || '';
  const destSlk = destSlkStr ? parseFloat(destSlkStr) : 0;

  // Get GPS settings from localStorage
  const { settings } = useGpsSettings();

  // Get GPS lag compensation from main gpsSettings
  const [lagSettings, setLagSettings] = useState<GpsLagSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gpsSettings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });

  // GPS tracking with EKF
  const {
    position,
    ekfOutput,
    roadInfo,
    currentSpeed,
    speedLimit,
    isSpeeding,
    speedZones,
    hasDirectionalZones,
    slkDirection,
    distanceToDest,
    eta,
    direction,
    isTracking,
    isPredicted,
    uncertainty,
    confidence,
    outageDuration,
    lastUpdate,
    error,
    startTracking,
    stopTracking,
    getEkfInfo,
  } = useGpsTracking(destRoadId, destSlk, settings as Partial<GpsTrackingConfig>);

  // Calculate upcoming speed zone with bidirectional support
  const upcomingZone = (() => {
    if (!roadInfo || speedZones.length === 0 || currentSpeed < 5) {
      return null;
    }

    const currentSlk = roadInfo.slk;
    const speedMs = currentSpeed / 3.6;
    const baseLookahead = lagSettings.speedLookaheadTime || 5;
    const lagCompensation = lagSettings.gpsLagCompensation || 0;
    const effectiveLookahead = baseLookahead + lagCompensation;
    const lookaheadDistanceKm = (speedMs * effectiveLookahead) / 1000;

    // slkDirection is now from state
    
    // Find current zone
    const currentZone = speedZones.find(z => currentSlk >= z.start_slk && currentSlk <= z.end_slk);
    const currentSpeedLimit = currentZone?.speed_limit || speedLimit;

    if (slkDirection === 'increasing') {
      // Traveling towards higher SLK values
      // Look for zone boundaries ahead (zone.start_slk > currentSlk)
      for (const zone of speedZones) {
        if (zone.start_slk > currentSlk && zone.start_slk <= currentSlk + lookaheadDistanceKm * 2) {
          const distanceToZone = (zone.start_slk - currentSlk) * 1000;
          const isDecrease = zone.speed_limit < currentSpeedLimit;
          
          if (isDecrease) {
            return {
              speedLimit: zone.speed_limit,
              distance: distanceToZone,
              isDecrease: true,
              direction: 'increasing' as const,
            };
          }
        }
      }
    } else if (slkDirection === 'decreasing') {
      // Traveling towards lower SLK values
      // Look for zone boundaries ahead (zone.end_slk < currentSlk)
      // When decreasing SLK, we're approaching the END of higher-SLK zones
      // which is the START of lower-SLK zones
      
      for (const zone of speedZones) {
        // We're looking for a zone that ENDS ahead of us (lower SLK)
        // This means we're entering this zone from its end_slk side
        if (zone.end_slk < currentSlk && zone.end_slk >= currentSlk - lookaheadDistanceKm * 2) {
          const distanceToZone = (currentSlk - zone.end_slk) * 1000;
          const isDecrease = zone.speed_limit < currentSpeedLimit;
          
          if (isDecrease) {
            return {
              speedLimit: zone.speed_limit,
              distance: distanceToZone,
              isDecrease: true,
              direction: 'decreasing' as const,
            };
          }
        }
      }
    }

    return null;
  })();

  // Offline data state
  const [offlineReady, setOfflineReady] = useState(false);

  // Debug state
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [showDebug, setShowDebug] = useState(false);

  // Tools menu state
  const [showTools, setShowTools] = useState(false);

  // Speed zone corrections state
  const [showCorrections, setShowCorrections] = useState(false);
  const [corrections, setCorrections] = useState<SpeedZoneCorrection[]>(() => {
    if (typeof window !== 'undefined') {
      return getSpeedZoneCorrections();
    }
    return [];
  });
  const [newCorrection, setNewCorrection] = useState({
    road_id: '',
    start_slk: '',
    end_slk: '',
    direction: '' as 'increasing' | 'decreasing' | '',
    correct_speed: '',
    original_speed: '',
    notes: ''
  });

  // Destination coordinates state
  const [destCoords, setDestCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Initialize offline database
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await initDB();
        const hasData = await checkOfflineData();
        if (mounted) {
          setOfflineReady(hasData);
        }
      } catch (e) {
        console.error('Failed to init offline DB:', e);
      }
    };
    init();

    return () => { mounted = false; };
  }, []);

  // Clear old SLK calibration data from localStorage (deprecated feature)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('slkCalibrations');
    }
  }, []);

  // Fetch destination coordinates when destination is set
  useEffect(() => {
    const fetchDestCoords = async () => {
      if (!destRoadId || !destSlk) return;

      try {
        const response = await fetch(`/api/roads?action=locate&road_id=${encodeURIComponent(destRoadId)}&slk=${destSlk}`);
        if (response.ok) {
          const data = await response.json();
          if (data.latitude && data.longitude) {
            setDestCoords({ lat: data.latitude, lon: data.longitude });
          }
        }
      } catch (e) {
        console.error('Failed to fetch destination coords:', e);
      }
    };

    fetchDestCoords();
  }, [destRoadId, destSlk]);

  // Auto-start if autostart=true
  useEffect(() => {
    const autostart = searchParams.get('autostart');
    if (autostart === 'true' && !isTracking) {
      const timer = setTimeout(() => {
        startTracking();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isTracking, startTracking]);

  // Generate debug info for troubleshooting
  const generateDebugInfo = () => {
    const lines: string[] = [];
    lines.push('=== SLK Tracking Debug Info ===');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Version: ${APP_VERSION} (EKF GPS Filtering)`);
    lines.push('');
    lines.push('=== Destination ===');
    lines.push(`Road ID: ${destRoadId}`);
    lines.push(`Road Name: ${destRoadName}`);
    lines.push(`Target SLK: ${destSlk}`);
    lines.push('');
    lines.push('=== Current Location ===');
    lines.push(`Lat: ${position?.lat}`);
    lines.push(`Lon: ${position?.lon}`);
    lines.push(`Speed: ${Math.round(currentSpeed)} km/h`);
    lines.push('');
    lines.push('=== EKF Status ===');
    lines.push(`EKF Enabled: ${settings.ekfEnabled}`);
    lines.push(`Is Predicted: ${isPredicted}`);
    lines.push(`Uncertainty: ${uncertainty.toFixed(2)}m`);
    lines.push(`Confidence: ${confidence}`);
    lines.push(`Outage Duration: ${outageDuration}ms`);
    const ekfInfo = getEkfInfo();
    if (ekfInfo) {
      lines.push(`Can Predict: ${ekfInfo.canPredict}`);
      lines.push(`Remaining Time: ${ekfInfo.remainingTime}s`);
    }
    lines.push('');
    lines.push('=== Road Info ===');
    lines.push(`Road ID: ${roadInfo?.road_id}`);
    lines.push(`Road Name: ${roadInfo?.road_name}`);
    lines.push(`Current SLK: ${roadInfo?.slk}`);
    lines.push(`SLK Direction: ${slkDirection || 'unknown'}`);
    lines.push(`Network Type: ${roadInfo?.network_type}`);
    lines.push(`Distance from road: ${roadInfo?.distance_m}m`);
    lines.push('');
    lines.push('=== Speed Zones ===');
    lines.push(`Total zones loaded: ${speedZones.length}`);
    lines.push(`Current speed limit: ${speedLimit} km/h`);
    lines.push(`Is speeding: ${isSpeeding}`);
    if (upcomingZone) {
      lines.push(`Upcoming zone: ${upcomingZone.speedLimit} km/h in ${Math.round(upcomingZone.distance)}m (${upcomingZone.direction})`);
    }
    lines.push('');
    lines.push('=== GPS Lag Compensation ===');
    lines.push(`Lag compensation: ${lagSettings.gpsLagCompensation || 0}s`);
    lines.push('');
    lines.push('=== Direction ===');
    lines.push(`Direction: ${direction}`);
    lines.push(`Distance to dest: ${distanceToDest?.toFixed(3)} km`);
    lines.push('');
    lines.push('=== Offline Status ===');
    lines.push(`Offline Ready: ${offlineReady}`);
    lines.push('');
    lines.push('=== Error ===');
    lines.push(`Error: ${error || 'None'}`);

    setDebugInfo(lines.join('\n'));
    setShowDebug(true);
  };

  // Format time for ETA
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  // Open Google Maps navigation to destination
  const openGoogleMaps = () => {
    if (destCoords) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${destCoords.lat},${destCoords.lon}`, '_blank')
    }
  }

  // Open Street View at destination
  const openStreetView = () => {
    if (destCoords) {
      window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${destCoords.lat},${destCoords.lon}`, '_blank')
    }
  }

  // Get confidence color
  const getConfidenceColor = (): string => {
    switch (confidence) {
      case 'high': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-orange-400';
      case 'predicted': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  // Get confidence badge
  const getConfidenceBadge = (): string => {
    switch (confidence) {
      case 'high': return '●';
      case 'medium': return '◐';
      case 'low': return '○';
      case 'predicted': return '◈';
      default: return '?';
    }
  };

  // Handle adding a speed zone correction
  const handleAddCorrection = () => {
    if (!newCorrection.road_id || !newCorrection.direction) return;
    
    const startSlk = parseFloat(newCorrection.start_slk);
    const endSlk = parseFloat(newCorrection.end_slk);
    const correctSpeed = parseInt(newCorrection.correct_speed);
    const originalSpeed = parseInt(newCorrection.original_speed) || speedLimit;
    
    if (isNaN(startSlk) || isNaN(endSlk) || isNaN(correctSpeed)) {
      return;
    }
    
    addSpeedZoneCorrection({
      road_id: newCorrection.road_id.toUpperCase(),
      start_slk: Math.min(startSlk, endSlk),
      end_slk: Math.max(startSlk, endSlk),
      direction: newCorrection.direction as 'increasing' | 'decreasing',
      correct_speed: correctSpeed,
      original_speed: originalSpeed,
      notes: newCorrection.notes
    });
    
    // Refresh corrections list
    setCorrections(getSpeedZoneCorrections());
    setNewCorrection({ road_id: '', start_slk: '', end_slk: '', direction: '', correct_speed: '', original_speed: '', notes: '' });
  };

  // Handle removing a correction
  const handleRemoveCorrection = (correction: SpeedZoneCorrection) => {
    removeSpeedZoneCorrection(
      correction.road_id,
      correction.start_slk,
      correction.end_slk,
      correction.direction
    );
    setCorrections(getSpeedZoneCorrections());
  };

  // Handle clearing all corrections
  const handleClearCorrections = () => {
    clearSpeedZoneCorrections();
    setCorrections([]);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 max-w-lg mx-auto">
      {/* Back Link - only show when not tracking */}
      {!isTracking && (
        <a href="/" className="inline-flex items-center text-blue-400 text-sm mb-4 hover:text-blue-300">
          ← Back to Work Zone Locator
        </a>
      )}

      {/* Header with Tools Menu */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-8"></div>
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold text-blue-400">SLK Tracking</h1>
          <p className="text-xs text-gray-400">v{APP_VERSION} EKF {offlineReady && <span className="text-green-400">• Offline Ready</span>}</p>
          {settings.ekfEnabled && (
            <p className="text-xs text-purple-400 mt-1">📡 EKF Filtering Active</p>
          )}
        </div>
        {/* Tools Menu */}
        <div className="relative">
          <button
            onClick={() => setShowTools(!showTools)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg bg-gray-700 hover:bg-gray-600"
            title="Tools"
          >
            🔧
          </button>
          {showTools && (
            <div className="absolute right-0 top-10 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 min-w-[200px]">
              <button
                onClick={() => {
                  setShowTools(false);
                  generateDebugInfo();
                }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
              >
                📋 Generate Debug Info
              </button>
              <button
                onClick={() => {
                  setShowTools(false);
                  setShowCorrections(true);
                }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-700 rounded-b-lg flex items-center gap-2"
              >
                🚦 Speed Zone Corrections ({corrections.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* GPS Controls */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">SLK Tracking</span>
          {isTracking ? (
            <span className="text-green-400 text-sm flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Active
            </span>
          ) : (
            <span className="text-gray-500 text-sm">Inactive</span>
          )}
        </div>

        {!isTracking ? (
          <Button onClick={startTracking} className="w-full bg-blue-800 hover:bg-blue-900 h-12 text-base">
            📍 Start SLK Tracking
          </Button>
        ) : (
          <a href="/" onClick={() => { stopTracking(); }} className="block w-full text-center bg-blue-800 hover:bg-blue-900 h-12 text-base rounded-lg leading-[48px] font-medium cursor-pointer">
            ← Back to Work Zone Locator
          </a>
        )}

        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}
      </div>

      {/* Current Speed Display */}
      {position && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            {/* Current Speed */}
            <div className="text-center flex-1">
              <div className={`text-5xl font-bold font-mono ${isSpeeding ? 'text-red-500' : 'text-green-400'}`}>
                {Math.round(currentSpeed)}
              </div>
              <p className="text-gray-400 text-sm">km/h</p>
              {isSpeeding && (
                <p className="text-red-400 text-xs mt-1">⚠️ Over limit</p>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-16 bg-gray-600 mx-4"></div>

            {/* Speed Limit */}
            <div className="text-center flex-1">
              <div className="flex items-center justify-center">
                <div className={`rounded-full w-16 h-16 flex items-center justify-center ${
                  isSpeeding
                    ? 'bg-red-900 border-4 border-red-500 animate-pulse'
                    : upcomingZone && upcomingZone.isDecrease
                      ? 'bg-black border-4 border-amber-400'  // Yellow/amber for approaching decrease
                      : 'bg-black border-4 border-white'     // White for current
                }`}>
                  <span className={`font-bold text-xl ${
                    isSpeeding 
                      ? 'text-red-400' 
                      : upcomingZone && upcomingZone.isDecrease
                        ? 'text-amber-400'
                        : 'text-white'
                  }`}>
                    {upcomingZone && upcomingZone.isDecrease ? upcomingZone.speedLimit : speedLimit}
                  </span>
                </div>
              </div>
              <p className="text-gray-400 text-sm mt-1">
                {upcomingZone && upcomingZone.isDecrease ? '↓ ' + Math.round(upcomingZone.distance) + 'm' : 'Posted Limit'}
              </p>
              {upcomingZone && upcomingZone.isDecrease && (
                <p className="text-xs text-amber-400">Slow down ahead</p>
              )}
              {speedZones.length > 0 && !upcomingZone && (
                <p className="text-xs text-gray-500">From MRWA Data</p>
              )}
            </div>
          </div>

          {/* EKF Status Indicator */}
          {settings.ekfEnabled && settings.showUncertainty && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={getConfidenceColor()}>{getConfidenceBadge()}</span>
                  <span className="text-gray-400">
                    {isPredicted ? 'Predicted' : confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
                  </span>
                </div>
                <div className="text-gray-400">
                  ±{uncertainty.toFixed(2)}m accuracy
                  {isPredicted && outageDuration > 0 && (
                    <span className="text-cyan-400 ml-2">
                      ({Math.round(outageDuration / 1000)}s outage)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trip Progress - Only when on same road as destination */}
      {position && roadInfo && destRoadId && roadInfo.road_id === destRoadId && distanceToDest !== null && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-green-400 mb-3">📊 Trip Progress</h3>

          {/* Current SLK with direction color */}
          <div className="text-center mb-4">
            <div className={`text-5xl font-bold font-mono ${
              direction === 'away'
                ? 'text-red-500 animate-pulse'
                : direction === 'towards'
                  ? 'text-green-400'
                  : 'text-yellow-400'
            }`}>
              {roadInfo?.slk?.toFixed(2)}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {direction === 'away' && '⚠️ Moving away from target'}
              {direction === 'towards' && '✓ Approaching target'}
              {direction === 'static' && '📍 Stationary'}
              {direction === null && 'Current SLK (km)'}
              {slkDirection && (
                <span className="text-blue-400 ml-2">
                  ({slkDirection === 'increasing' ? '↑' : '↓'} SLK)
                </span>
              )}
              {isPredicted && (
                <span className="text-purple-400 ml-2">◈ predicted</span>
              )}
            </p>
          </div>

          {/* Destination Info */}
          <div className="bg-gray-700 rounded-lg p-3 mb-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-400">Road ID</p>
                <p className="font-mono text-purple-400 font-medium">{destRoadId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Road Name</p>
                <p className="text-white font-medium truncate">{destRoadName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Target SLK</p>
                <p className="font-mono text-yellow-400 font-medium">{destSlk.toFixed(2)} km</p>
              </div>
            </div>

            {/* Navigation buttons */}
            {destCoords && (
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={openGoogleMaps}
                  className="flex-1 h-10 text-sm bg-green-600 hover:bg-green-700"
                >
                  🗺️ Navigate
                </Button>
                <Button
                  onClick={openStreetView}
                  className="flex-1 h-10 text-sm bg-blue-600 hover:bg-blue-700"
                >
                  🏠 Street View
                </Button>
              </div>
            )}
          </div>

          {/* Distance & ETA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400">Distance Remaining</p>
              {distanceToDest < 0.1 ? (
                <p className="text-xl font-bold text-green-400">ARRIVED!</p>
              ) : distanceToDest < 1 ? (
                <p className="text-3xl font-bold text-white">{Math.round(distanceToDest * 1000)} m</p>
              ) : (
                <p className="text-xl font-bold text-white">{distanceToDest.toFixed(2)} km</p>
              )}
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400">ETA</p>
              <p className="text-xl font-bold text-white">{eta ? formatTime(eta) : '--:--'}</p>
              {eta && currentSpeed > 3 && (
                <p className="text-xs text-gray-500">@ {Math.round(currentSpeed)} km/h</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current Location - When on different road */}
      {position && (!destRoadId || !roadInfo || roadInfo.road_id !== destRoadId) && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-blue-400 mb-3">📍 Current Location</h3>

          {roadInfo ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Road ID</span>
                <span className="font-mono text-green-400">{roadInfo.road_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Road Name</span>
                <span className="text-white">{roadInfo.road_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">SLK</span>
                <div className="text-right">
                  <span className="font-mono text-yellow-400 text-lg">{roadInfo?.slk?.toFixed(2)} km</span>
                  {slkDirection && (
                    <span className="text-xs text-blue-400 ml-2">
                      ({slkDirection === 'increasing' ? '↑' : '↓'})
                    </span>
                  )}
                  {isPredicted && (
                    <span className="text-xs text-purple-400 ml-2">◈</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Road Type</span>
                <span className={`text-sm ${roadInfo.network_type === 'Local Road' ? 'text-amber-400' : 'text-blue-400'}`}>
                  {roadInfo.network_type}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Looking up road info...</p>
          )}
        </div>
      )}

      {/* Destination Location */}
      {position && destRoadId && (!roadInfo || roadInfo.road_id !== destRoadId) && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-purple-400 mb-3">🎯 Destination</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Road ID</span>
              <span className="font-mono text-purple-400">{destRoadId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Road Name</span>
              <span className="text-white">{destRoadName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Target SLK</span>
              <span className="font-mono text-yellow-400">{destSlk.toFixed(2)} km</span>
            </div>
          </div>
        </div>
      )}

      {/* No GPS fix yet */}
      {isTracking && !position && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4 text-center">
          <p className="text-gray-400">Waiting for GPS fix...</p>
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
                  navigator.clipboard.writeText(debugInfo);
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

      {/* Speed Zone Corrections Popup */}
      {showCorrections && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-4 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-amber-400">🚦 Speed Zone Corrections</h3>
              <Button
                onClick={() => setShowCorrections(false)}
                className="h-8 w-8 p-0 bg-gray-700 hover:bg-gray-600"
              >
                ✕
              </Button>
            </div>

            {/* Current road info (if tracking) */}
            {roadInfo && (
              <div className="bg-gray-700 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-400 mb-1">Current Road</p>
                <p className="font-mono text-green-400">{roadInfo.road_id}</p>
                <p className="text-sm text-white">{roadInfo.road_name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  SLK: {roadInfo.slk?.toFixed(3)} | Direction: {slkDirection === 'increasing' ? 'True Right' : slkDirection === 'decreasing' ? 'True Left' : 'unknown'}
                </p>
                <p className="text-xs text-gray-400">
                  Current Limit: <span className="text-amber-400 font-bold">{speedLimit} km/h</span>
                </p>
              </div>
            )}

            {/* Add new correction form - always visible */}
            <div className="bg-gray-700 rounded-lg p-3 mb-4">
              <p className="text-sm font-semibold text-white mb-3">Add New Correction</p>
              
              {/* Road ID */}
              <div className="mb-2">
                <label className="text-xs text-gray-400">Road ID (e.g., M031)</label>
                <input
                  type="text"
                  value={newCorrection.road_id}
                  onChange={(e) => setNewCorrection({...newCorrection, road_id: e.target.value.toUpperCase()})}
                  placeholder="M031"
                  className="w-full bg-gray-800 text-white text-sm p-2 rounded border border-gray-600"
                />
              </div>
              
              {/* Direction selector */}
              <div className="mb-2">
                <label className="text-xs text-gray-400">Direction of Travel</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCorrection({...newCorrection, direction: 'increasing'})}
                    className={`p-2 rounded text-sm font-medium ${
                      newCorrection.direction === 'increasing' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-400 border border-gray-600'
                    }`}
                  >
                    True Right
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCorrection({...newCorrection, direction: 'decreasing'})}
                    className={`p-2 rounded text-sm font-medium ${
                      newCorrection.direction === 'decreasing' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-400 border border-gray-600'
                    }`}
                  >
                    True Left
                  </button>
                </div>
              </div>
              
              {/* SLK Range */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs text-gray-400">Start SLK</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newCorrection.start_slk}
                    onChange={(e) => setNewCorrection({...newCorrection, start_slk: e.target.value})}
                    placeholder="67.340"
                    className="w-full bg-gray-800 text-white text-sm p-2 rounded border border-gray-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">End SLK</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newCorrection.end_slk}
                    onChange={(e) => setNewCorrection({...newCorrection, end_slk: e.target.value})}
                    placeholder="67.620"
                    className="w-full bg-gray-800 text-white text-sm p-2 rounded border border-gray-600"
                  />
                </div>
              </div>
              
              {/* Speed fields */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs text-gray-400">MRWA Speed (km/h)</label>
                  <input
                    type="number"
                    value={newCorrection.original_speed}
                    onChange={(e) => setNewCorrection({...newCorrection, original_speed: e.target.value})}
                    placeholder="90"
                    className="w-full bg-gray-800 text-white text-sm p-2 rounded border border-gray-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Correct Speed (km/h)</label>
                  <input
                    type="number"
                    value={newCorrection.correct_speed}
                    onChange={(e) => setNewCorrection({...newCorrection, correct_speed: e.target.value})}
                    placeholder="60"
                    className="w-full bg-gray-800 text-white text-sm p-2 rounded border border-gray-600"
                  />
                </div>
              </div>
              
              {/* Notes */}
              <div className="mb-3">
                <label className="text-xs text-gray-400">Notes (optional)</label>
                <input
                  type="text"
                  value={newCorrection.notes}
                  onChange={(e) => setNewCorrection({...newCorrection, notes: e.target.value})}
                  placeholder="Double-sided sign: 60 True Right, 90 True Left"
                  className="w-full bg-gray-800 text-white text-sm p-2 rounded border border-gray-600"
                />
              </div>
              
              <Button
                onClick={handleAddCorrection}
                className="w-full bg-amber-600 hover:bg-amber-700"
                disabled={!newCorrection.road_id || !newCorrection.direction || !newCorrection.start_slk || !newCorrection.end_slk || !newCorrection.correct_speed}
              >
                ➕ Add Correction
              </Button>
            </div>

            {/* Existing corrections list */}
            <div className="mb-2">
              <p className="text-sm font-semibold text-white mb-2">Saved Corrections</p>
              {corrections.length === 0 ? (
                <p className="text-gray-400 text-sm">No corrections saved</p>
              ) : (
                <div className="space-y-2">
                  {corrections.map((c, i) => (
                    <div key={i} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-mono text-green-400 text-sm">{c.road_id}</p>
                          <p className="text-xs text-gray-400">
                            SLK {c.start_slk.toFixed(3)} - {c.end_slk.toFixed(3)}
                          </p>
                          <p className="text-xs">
                            <span className="text-red-400">{c.original_speed} km/h</span>
                            <span className="text-gray-500 mx-1">→</span>
                            <span className="text-green-400 font-bold">{c.correct_speed} km/h</span>
                          </p>
                          <p className="text-xs text-blue-400">
                            Direction: {c.direction === 'increasing' ? 'True Right' : 'True Left'}
                          </p>
                          {c.notes && <p className="text-xs text-gray-500 mt-1">{c.notes}</p>}
                        </div>
                        <Button
                          onClick={() => handleRemoveCorrection(c)}
                          className="h-6 w-6 p-0 bg-red-600 hover:bg-red-700 text-xs"
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              {corrections.length > 0 && (
                <Button
                  onClick={handleClearCorrections}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-sm"
                >
                  🗑️ Clear All
                </Button>
              )}
              <Button
                onClick={() => setShowCorrections(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DrivePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 text-white p-4">Loading...</div>}>
      <DriveContent />
    </Suspense>
  );
}
