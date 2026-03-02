'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'

// Calibration data types
interface CalibrationCapture {
  timestamp: string
  buttonType: 'target' | 'pass'
  runNumber: number
  targetSpeed: number
  calculatedSlk: number
  gpsLat: number
  gpsLon: number
  gpsAccuracy: number
  gpsSpeed: number
  gpsHeading: number | null
}

interface CalibrationResult {
  runNumber: number
  targetSpeed: number
  targetSlk: number
  passSlk: number
  slkError: number // km (negative = behind)
  distanceError: number // meters
  timeError: number // seconds
  targetAccuracy: number
  passAccuracy: number
  timestamp: string
}

interface CalibrationSettings {
  lagCompensation: number // seconds
  calibratedDate: string | null
  testRuns: number
  results: CalibrationResult[]
  rawData: CalibrationCapture[]
}

const DEFAULT_SETTINGS: CalibrationSettings = {
  lagCompensation: 0,
  calibratedDate: null,
  testRuns: 0,
  results: [],
  rawData: [],
}

// Version constant
const APP_VERSION = '5.3.4'

export default function CalibratePage() {
  const [isTracking, setIsTracking] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<{
    lat: number
    lon: number
    accuracy: number
    speed: number
    heading: number | null
  } | null>(null)
  const [roadInfo, setRoadInfo] = useState<{
    road_id: string
    road_name: string
    slk: number
  } | null>(null)
  const [error, setError] = useState<string>('')
  
  // Calibration state
  const [settings, setSettings] = useState<CalibrationSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gpsCalibration')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to load calibration settings:', e)
        }
      }
    }
    return DEFAULT_SETTINGS
  })
  const [targetSpeed, setTargetSpeed] = useState<number>(80)
  const [runNumber, setRunNumber] = useState<number>(1)
  const [targetSet, setTargetSet] = useState(false)
  const [targetData, setTargetData] = useState<CalibrationCapture | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: CalibrationSettings) => {
    localStorage.setItem('gpsCalibration', JSON.stringify(newSettings))
    setSettings(newSettings)
  }, [])

  // Start GPS tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }

    setIsTracking(true)
    setError('')

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const pos = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: (position.coords.speed ?? 0) * 3.6, // m/s to km/h
          heading: position.coords.heading,
        }
        setCurrentPosition(pos)

        // Try to get road info
        try {
          const response = await fetch(
            `/api/gps?lat=${pos.lat}&lon=${pos.lon}`
          )
          if (response.ok) {
            const data = await response.json()
            setRoadInfo({
              road_id: data.road_id,
              road_name: data.road_name,
              slk: data.slk,
            })
          }
        } catch (e) {
          // Ignore road lookup errors
        }
      },
      (err) => {
        setError(`GPS Error: ${err.message}`)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    )

    setWatchId(id)
  }, [])

  // Stop GPS tracking
  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
    setIsTracking(false)
    setCurrentPosition(null)
    setRoadInfo(null)
  }, [watchId])

  // Capture target position
  const captureTarget = useCallback(() => {
    if (!currentPosition || !roadInfo) {
      setError('No GPS position available')
      return
    }

    const capture: CalibrationCapture = {
      timestamp: new Date().toISOString(),
      buttonType: 'target',
      runNumber,
      targetSpeed,
      calculatedSlk: roadInfo.slk,
      gpsLat: currentPosition.lat,
      gpsLon: currentPosition.lon,
      gpsAccuracy: currentPosition.accuracy,
      gpsSpeed: currentPosition.speed,
      gpsHeading: currentPosition.heading,
    }

    setTargetData(capture)
    setTargetSet(true)
    setError('')
  }, [currentPosition, roadInfo, runNumber, targetSpeed])

  // Capture pass position and calculate result
  const capturePass = useCallback(() => {
    if (!currentPosition || !roadInfo || !targetData) {
      setError('Set target first or no GPS position')
      return
    }

    const passCapture: CalibrationCapture = {
      timestamp: new Date().toISOString(),
      buttonType: 'pass',
      runNumber,
      targetSpeed,
      calculatedSlk: roadInfo.slk,
      gpsLat: currentPosition.lat,
      gpsLon: currentPosition.lon,
      gpsAccuracy: currentPosition.accuracy,
      gpsSpeed: currentPosition.speed,
      gpsHeading: currentPosition.heading,
    }

    // Calculate result
    const slkError = targetData.calculatedSlk - passCapture.calculatedSlk // positive = behind
    const distanceError = slkError * 1000 // km to meters
    const timeError = currentPosition.speed > 0 
      ? Math.abs(distanceError) / (currentPosition.speed / 3.6) // seconds
      : 0

    const result: CalibrationResult = {
      runNumber,
      targetSpeed,
      targetSlk: targetData.calculatedSlk,
      passSlk: passCapture.calculatedSlk,
      slkError,
      distanceError,
      timeError,
      targetAccuracy: targetData.gpsAccuracy,
      passAccuracy: passCapture.gpsAccuracy,
      timestamp: passCapture.timestamp,
    }

    // Update settings
    const newRawData = [...settings.rawData, targetData, passCapture]
    const newResults = [...settings.results, result]
    
    // Calculate average lag
    const avgLag = newResults.reduce((sum, r) => sum + r.timeError, 0) / newResults.length
    
    const newSettings: CalibrationSettings = {
      ...settings,
      lagCompensation: Math.round(avgLag * 10) / 10,
      calibratedDate: new Date().toISOString().split('T')[0],
      testRuns: newResults.length,
      results: newResults,
      rawData: newRawData,
    }

    saveSettings(newSettings)

    // Reset for next run
    setTargetData(null)
    setTargetSet(false)
    setRunNumber(runNumber + 1)
    setError('')
  }, [currentPosition, roadInfo, targetData, runNumber, targetSpeed, settings, saveSettings])

  // Clear all calibration data
  const clearCalibration = useCallback(() => {
    const newSettings: CalibrationSettings = {
      ...DEFAULT_SETTINGS,
    }
    saveSettings(newSettings)
    setTargetData(null)
    setTargetSet(false)
    setRunNumber(1)
    setError('')
  }, [saveSettings])

  // Export to CSV
  const exportCsv = useCallback(() => {
    if (settings.results.length === 0) {
      setError('No results to export')
      return
    }

    const headers = [
      'Run',
      'Target Speed (km/h)',
      'Target SLK',
      'Pass SLK',
      'SLK Error (km)',
      'Distance Error (m)',
      'Time Error (s)',
      'Target Accuracy (m)',
      'Pass Accuracy (m)',
      'Timestamp',
    ]

    const rows = settings.results.map(r => [
      r.runNumber,
      r.targetSpeed,
      r.targetSlk.toFixed(3),
      r.passSlk.toFixed(3),
      r.slkError.toFixed(3),
      r.distanceError.toFixed(1),
      r.timeError.toFixed(2),
      r.targetAccuracy.toFixed(1),
      r.passAccuracy.toFixed(1),
      r.timestamp,
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gps-calibration-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [settings.results])

  // Apply lag compensation to GPS settings
  const applyLagCompensation = useCallback(() => {
    // Update the main GPS settings
    const gpsSettings = localStorage.getItem('gpsSettings')
    if (gpsSettings) {
      try {
        const parsed = JSON.parse(gpsSettings)
        parsed.gpsLagCompensation = settings.lagCompensation
        localStorage.setItem('gpsSettings', JSON.stringify(parsed))
      } catch (e) {
        // If no existing settings, create new
        localStorage.setItem('gpsSettings', JSON.stringify({
          gpsLagCompensation: settings.lagCompensation,
        }))
      }
    } else {
      localStorage.setItem('gpsSettings', JSON.stringify({
        gpsLagCompensation: settings.lagCompensation,
      }))
    }
    setError(`Applied ${settings.lagCompensation}s lag compensation to GPS settings`)
  }, [settings.lagCompensation])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">GPS Calibration</h1>
          <span className="text-xs text-gray-500">v{APP_VERSION}</span>
        </div>

        {/* Version Display */}
        <div className="bg-gray-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-gray-400">
            Version: <span className="text-white font-mono">{APP_VERSION}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Calibrate GPS lag for accurate speed sign lookahead
          </p>
        </div>

        {/* Live GPS Display */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Live Position</span>
            <span className={`text-xs ${isTracking ? 'text-green-400' : 'text-gray-500'}`}>
              {isTracking ? '● Tracking' : '○ Stopped'}
            </span>
          </div>

          {currentPosition ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">SLK:</span>
                <span className="ml-2 font-mono">{roadInfo?.slk.toFixed(3) ?? '---'} km</span>
              </div>
              <div>
                <span className="text-gray-500">Speed:</span>
                <span className="ml-2 font-mono">{Math.round(currentPosition.speed)} km/h</span>
              </div>
              <div>
                <span className="text-gray-500">Accuracy:</span>
                <span className="ml-2 font-mono">±{Math.round(currentPosition.accuracy)} m</span>
              </div>
              <div>
                <span className="text-gray-500">Road:</span>
                <span className="ml-2">{roadInfo?.road_id ?? '---'}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No GPS data</p>
          )}

          <div className="mt-3">
            <Button
              onClick={isTracking ? stopTracking : startTracking}
              className={`w-full h-10 ${isTracking ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isTracking ? 'Stop GPS' : 'Start GPS'}
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded p-3 mb-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Calibration Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-blue-400 mb-3">Calibration</h2>

          {/* Speed Selection */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Target Speed</label>
            <div className="flex gap-2">
              {[60, 80, 100, 110].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setTargetSpeed(speed)}
                  className={`flex-1 py-2 rounded text-sm font-medium ${
                    targetSpeed === speed
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {speed}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">Run #{runNumber}</p>
          </div>

          {/* Target Button */}
          <div className="mb-3">
            <Button
              onClick={captureTarget}
              disabled={!isTracking || !currentPosition}
              className={`w-full h-14 text-lg ${targetSet ? 'bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              {targetSet ? '✓ Target Set' : '📍 SET TARGET'}
            </Button>
            <p className="text-xs text-gray-500 mt-1 text-center">
              Press when stationary at landmark
            </p>
            {targetData && (
              <p className="text-xs text-green-400 mt-1 text-center">
                Target SLK: {targetData.calculatedSlk.toFixed(3)} km
              </p>
            )}
          </div>

          {/* Pass Button */}
          <div>
            <Button
              onClick={capturePass}
              disabled={!isTracking || !currentPosition || !targetSet}
              className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600"
            >
              🏁 MARK PASS
            </Button>
            <p className="text-xs text-gray-500 mt-1 text-center">
              Press when alongside target
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-blue-400 mb-3">Results</h2>

          {settings.results.length > 0 ? (
            <>
              <div className="bg-gray-700/50 rounded p-3 mb-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Avg Lag:</span>
                    <span className="ml-2 text-lg font-bold text-yellow-400">
                      {settings.lagCompensation}s
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Tests:</span>
                    <span className="ml-2 text-lg">{settings.testRuns}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">Calibrated:</span>
                    <span className="ml-2">{settings.calibratedDate}</span>
                  </div>
                </div>
              </div>

              {/* Results Table */}
              <div className="text-xs overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="py-1 text-left">Run</th>
                      <th className="py-1 text-left">Speed</th>
                      <th className="py-1 text-right">Error</th>
                      <th className="py-1 text-right">Lag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.results.slice(-5).map((r, i) => (
                      <tr key={i} className="border-b border-gray-700/50">
                        <td className="py-1">#{r.runNumber}</td>
                        <td className="py-1">{r.targetSpeed} km/h</td>
                        <td className="py-1 text-right">{r.distanceError.toFixed(0)}m</td>
                        <td className="py-1 text-right text-yellow-400">{r.timeError.toFixed(1)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm">No calibration data yet</p>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Button
              onClick={exportCsv}
              disabled={settings.results.length === 0}
              className="bg-gray-600 hover:bg-gray-500 text-xs py-2"
            >
              📄 Export
            </Button>
            <Button
              onClick={applyLagCompensation}
              disabled={settings.lagCompensation === 0}
              className="bg-green-600 hover:bg-green-700 text-xs py-2"
            >
              ✓ Apply
            </Button>
            <Button
              onClick={clearCalibration}
              className="bg-red-600 hover:bg-red-700 text-xs py-2"
            >
              🗑️ Clear
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-blue-400 mb-2">Instructions</h2>
          <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
            <li>Start GPS and go to a landmark (cone, sign)</li>
            <li>Press SET TARGET while stationary at landmark</li>
            <li>Drive 1km+ away, turn around</li>
            <li>Maintain target speed, return to landmark</li>
            <li>Press MARK PASS when alongside landmark</li>
            <li>Repeat at different speeds</li>
            <li>Press Apply to use calculated lag</li>
          </ol>
        </div>

        {/* Back Button */}
        <Button
          onClick={() => window.location.href = '/'}
          className="w-full h-12 bg-blue-800 hover:bg-blue-900"
        >
          ← Back to Work Zone Locator
        </Button>
      </div>
    </div>
  )
}
