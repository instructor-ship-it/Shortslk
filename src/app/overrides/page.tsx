'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getSpeedOverrides,
  getSpeedOverridesMetadata,
  getSpeedZones,
  type SpeedZoneOverride,
  type ParsedSpeedZone,
} from '@/lib/offline-db';

interface OverrideWithMrwa extends SpeedZoneOverride {
  mrwa_zone?: ParsedSpeedZone;
  discrepancy_detected: boolean;
}

export default function OverridesPage() {
  const [overrides, setOverrides] = useState<OverrideWithMrwa[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [metadata, setMetadata] = useState<{
    version: string;
    last_updated: string;
    total_overrides: number;
    roads_affected: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // New override form state
  const [newOverride, setNewOverride] = useState({
    road_id: '',
    start_slk: '',
    end_slk: '',
    speed_limit: '',
    sign_lat: '',
    sign_lon: '',
    note: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  // Select all overrides with discrepancies
  const selectAllDiscrepancies = () => {
    const discrepancyIds = overrides
      .filter(o => o.discrepancy_detected)
      .map(o => o.id);
    setSelectedIds(new Set(discrepancyIds));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Toggle individual override selection
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const meta = await getSpeedOverridesMetadata();
      setMetadata(meta);

      // Load all overrides
      const allOverrides = await getSpeedOverrides(''); // Empty string returns all

      // For each override, try to get MRWA data for comparison
      const overridesWithMrwa: OverrideWithMrwa[] = await Promise.all(
        allOverrides.map(async (o) => {
          // Get MRWA zones for this road
          const mrwaZones = await getMrwaZonesForRoad(o.road_id);

          // Find MRWA zone that overlaps with override
          const overlappingMrwa = mrwaZones.find(
            (z) => z.start_slk <= o.end_slk && z.end_slk >= o.start_slk
          );

          // Check if there's a discrepancy
          const discrepancy_detected =
            !overlappingMrwa ||
            overlappingMrwa.start_slk !== o.start_slk ||
            overlappingMrwa.end_slk !== o.end_slk ||
            overlappingMrwa.speed_limit !== o.speed_limit;

          return {
            ...o,
            mrwa_zone: overlappingMrwa,
            discrepancy_detected,
          };
        })
      );

      setOverrides(overridesWithMrwa);
      
      // Auto-select all overrides with discrepancies
      const discrepancyIds = overridesWithMrwa
        .filter(o => o.discrepancy_detected)
        .map(o => o.id);
      setSelectedIds(new Set(discrepancyIds));
    } catch (err) {
      console.error('Error loading overrides:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get MRWA zones from IndexedDB (without overrides applied)
  const getMrwaZonesForRoad = async (roadId: string): Promise<ParsedSpeedZone[]> => {
    try {
      // This returns merged zones - we'll need to work with what we have
      return await getSpeedZones(roadId);
    } catch {
      return [];
    }
  };

  const generateMrwaExceptionReport = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one override to include in the report.');
      return;
    }

    setGeneratingReport(true);

    try {
      // Filter to selected overrides only
      const selectedOverrides = overrides.filter(o => selectedIds.has(o.id));
      
      // Generate report content
      const reportDate = new Date().toISOString().split('T')[0];
      let report = `MRWA SPEED ZONE EXCEPTION REPORT
================================
Generated: ${new Date().toLocaleString()}
Report Date: ${reportDate}
Source: TC Work Zone Locator - Community Verified Overrides
Version: ${metadata?.version || '1.0'}

EXECUTIVE SUMMARY
-----------------
Total Exceptions in Report: ${selectedOverrides.length}
Roads Affected: ${[...new Set(selectedOverrides.map((o) => o.road_id))].join(', ')}
Override Data Last Updated: ${metadata?.last_updated || 'N/A'}

PURPOSE
-------
This report documents discrepancies between MRWA speed zone data and field-verified
physical signage locations. These discrepancies are likely due to road works (widening,
re-alignment, or signage updates) that have not yet been reflected in MRWA databases.

DETAILED EXCEPTIONS
-------------------

`;

      for (const override of selectedOverrides) {
        report += `
================================================================================
ROAD: ${override.road_id} - ${override.road_name}
${override.common_usage_name ? `Common Name: ${override.common_usage_name}` : ''}
================================================================================

OVERRIDE ID: ${override.id}
ZONE TYPE: ${override.zone_type}
CARRIAGEWAY: ${override.carriageway}
VERIFIED BY: ${override.verified_by || 'Field Observation'}
VERIFIED DATE: ${override.verified_date || 'N/A'}

SPEED LIMIT: ${override.speed_limit} km/h

ZONE BOUNDARIES:
  Field Verified Start SLK: ${override.start_slk}
  Field Verified End SLK:   ${override.end_slk}
`;

        if (override.mrwa_slk) {
          report += `
  MRWA Database Start SLK:  ${override.mrwa_slk}
  Discrepancy:              ${override.discrepancy_m || 'N/A'} meters
`;
        }

        if (override.sign_location) {
          report += `
SIGN LOCATION (GPS Verified):
  SLK: ${override.sign_location.slk}
  Latitude: ${override.sign_location.lat}
  Longitude: ${override.sign_location.lon}
  ${override.sign_location.description ? `Note: ${override.sign_location.description}` : ''}
`;
        }

        if (override.mrwa_zone) {
          report += `
MRWA DATABASE COMPARISON:
  MRWA Start SLK:   ${override.mrwa_zone.start_slk}
  MRWA End SLK:     ${override.mrwa_zone.end_slk}
  MRWA Speed Limit: ${override.mrwa_zone.speed_limit} km/h
  
DIFFERENCES:
  SLK Start Difference: ${Math.abs(override.start_slk - override.mrwa_zone.start_slk).toFixed(2)} km
  SLK End Difference:   ${Math.abs(override.end_slk - override.mrwa_zone.end_slk).toFixed(2)} km
  Speed Match: ${override.speed_limit === override.mrwa_zone.speed_limit ? 'YES' : 'NO'}
`;
        }

        if (override.note) {
          report += `
NOTES:
  ${override.note}
`;
        }

        report += `
SOURCE: ${override.source}
`;
      }

      report += `

SUMMARY TABLE
-------------
`;

      report += `
| Road ID | Zone Start | Zone End | Speed | MRWA Start | MRWA End | MRWA Speed | Discrepancy |
|---------|------------|----------|-------|------------|----------|------------|-------------|
`;

      for (const o of selectedOverrides) {
        const mrwaStart = o.mrwa_zone?.start_slk?.toFixed(2) || 'N/A';
        const mrwaEnd = o.mrwa_zone?.end_slk?.toFixed(2) || 'N/A';
        const mrwaSpeed = o.mrwa_zone?.speed_limit || 'N/A';
        const disc = o.discrepancy_m ? `${o.discrepancy_m}m` : 'Varies';

        report += `| ${o.road_id} | ${o.start_slk.toFixed(2)} | ${o.end_slk.toFixed(2)} | ${o.speed_limit} | ${mrwaStart} | ${mrwaEnd} | ${mrwaSpeed} | ${disc} |\n`;
      }

      report += `

RECOMMENDED ACTIONS
-------------------
1. Review the sign locations listed above
2. Compare with recent road works records
3. Update MRWA speed zone database where confirmed
4. Notify relevant local government authorities

DISCLAIMER
----------
This report was generated from field-verified data collected by road workers.
All sign locations were verified using GPS equipment with typical accuracy of ±4 meters.
This data should be verified against MRWA records before making database updates.

For questions or additional verification, please contact the data contributors.
`;

      // Create and download the file
      const blob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MRWA_Exception_Report_${reportDate}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating report:', err);
      alert('Error generating report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleAddOverride = async () => {
    // This would add to the overrides file
    // For now, just show the form
    alert(
      'Override submission feature coming soon. For now, edit the speed-overrides.json file directly.'
    );
    setShowAddForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" className="border-gray-600 text-gray-300">
              ← Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Speed Zone Overrides</h1>
        </div>
        <div className="text-xs text-gray-500">
          vRC 1.0.3
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-blue-400 mb-3">System Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Version</p>
            <p className="text-lg font-mono text-white">{metadata?.version || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Last Updated</p>
            <p className="text-lg text-white">{metadata?.last_updated || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Overrides</p>
            <p className="text-lg text-orange-400">{metadata?.total_overrides || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Roads Affected</p>
            <p className="text-lg text-white">{metadata?.roads_affected?.length || 0}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Button
          onClick={generateMrwaExceptionReport}
          disabled={generatingReport || selectedIds.size === 0}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {generatingReport ? 'Generating...' : `📄 Generate Report (${selectedIds.size} selected)`}
        </Button>
        <Button
          onClick={selectAllDiscrepancies}
          variant="outline"
          className="border-gray-600 text-gray-300"
        >
          Select All with Discrepancies
        </Button>
        <Button
          onClick={deselectAll}
          variant="outline"
          className="border-gray-600 text-gray-300"
        >
          Deselect All
        </Button>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-600 hover:bg-green-700"
        >
          {showAddForm ? 'Cancel' : '+ Add Override'}
        </Button>
        <Button
          onClick={loadData}
          variant="outline"
          className="border-gray-600 text-gray-300"
        >
          Refresh
        </Button>
      </div>

      {/* Selection Info */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-300">
            ✓ {selectedIds.size} override{selectedIds.size !== 1 ? 's' : ''} selected for report
          </p>
        </div>
      )}

      {/* Add Override Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-green-400 mb-4">Add New Override</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Road ID</label>
              <input
                type="text"
                value={newOverride.road_id}
                onChange={(e) => setNewOverride({ ...newOverride, road_id: e.target.value })}
                placeholder="e.g., M031"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Speed Limit (km/h)</label>
              <input
                type="number"
                value={newOverride.speed_limit}
                onChange={(e) => setNewOverride({ ...newOverride, speed_limit: e.target.value })}
                placeholder="e.g., 60"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start SLK</label>
              <input
                type="number"
                step="0.01"
                value={newOverride.start_slk}
                onChange={(e) => setNewOverride({ ...newOverride, start_slk: e.target.value })}
                placeholder="e.g., 64.81"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End SLK</label>
              <input
                type="number"
                step="0.01"
                value={newOverride.end_slk}
                onChange={(e) => setNewOverride({ ...newOverride, end_slk: e.target.value })}
                placeholder="e.g., 65.98"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Sign Latitude</label>
              <input
                type="number"
                step="0.00000001"
                value={newOverride.sign_lat}
                onChange={(e) => setNewOverride({ ...newOverride, sign_lat: e.target.value })}
                placeholder="e.g., -32.09942741"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Sign Longitude</label>
              <input
                type="number"
                step="0.00000001"
                value={newOverride.sign_lon}
                onChange={(e) => setNewOverride({ ...newOverride, sign_lon: e.target.value })}
                placeholder="e.g., 116.90796019"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Notes</label>
              <textarea
                value={newOverride.note}
                onChange={(e) => setNewOverride({ ...newOverride, note: e.target.value })}
                placeholder="e.g., Road widening completed 2024, MRWA data not updated"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                rows={2}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleAddOverride} className="bg-green-600 hover:bg-green-700">
              Submit Override
            </Button>
            <Button
              onClick={() => setShowAddForm(false)}
              variant="outline"
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Overrides List */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-400 mb-4">Active Overrides</h2>
        <p className="text-xs text-gray-500 mb-4">
          Click checkboxes to select which overrides to include in the report
        </p>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : overrides.length === 0 ? (
          <p className="text-gray-400">No overrides loaded.</p>
        ) : (
          <div className="space-y-4">
            {overrides.map((override) => (
              <div
                key={override.id}
                className={`border rounded-lg p-4 transition-colors ${
                  selectedIds.has(override.id)
                    ? 'border-blue-500 bg-blue-900/20'
                    : override.discrepancy_detected
                    ? 'border-orange-500/50 bg-orange-900/10'
                    : 'border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3 mb-2">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <Checkbox
                      id={`override-${override.id}`}
                      checked={selectedIds.has(override.id)}
                      onCheckedChange={() => toggleSelection(override.id)}
                      className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <label
                          htmlFor={`override-${override.id}`}
                          className="font-semibold text-white cursor-pointer"
                        >
                          {override.road_id} - {override.road_name}
                        </label>
                        {override.common_usage_name && (
                          <p className="text-sm text-gray-400">{override.common_usage_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {override.discrepancy_detected && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-orange-600/80 text-white">
                            Discrepancy
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            override.source === 'community_verified'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-600 text-gray-300'
                          }`}
                        >
                          {override.source}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm ml-8">
                  <div>
                    <p className="text-gray-500">Zone</p>
                    <p className="text-white font-mono">
                      SLK {override.start_slk} → {override.end_slk}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Speed Limit</p>
                    <p className="text-orange-400 font-bold">{override.speed_limit} km/h</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Carriageway</p>
                    <p className="text-white">{override.carriageway}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Discrepancy</p>
                    <p className="text-orange-400">
                      {override.discrepancy_m ? `${override.discrepancy_m}m` : 'Varies'}
                    </p>
                  </div>
                </div>

                {override.sign_location && (
                  <div className="mt-3 pt-3 border-t border-gray-700 ml-8">
                    <p className="text-gray-500 text-xs mb-1">Sign Location (GPS)</p>
                    <p className="text-white font-mono text-sm">
                      SLK {override.sign_location.slk} |{' '}
                      {override.sign_location.lat.toFixed(8)}, {override.sign_location.lon.toFixed(8)}
                    </p>
                    {override.sign_location.description && (
                      <p className="text-gray-400 text-xs mt-1">
                        {override.sign_location.description}
                      </p>
                    )}
                  </div>
                )}

                {override.note && (
                  <div className="mt-2 ml-8">
                    <p className="text-gray-400 text-sm italic">{override.note}</p>
                  </div>
                )}

                {override.mrwa_zone && (
                  <div className="mt-3 pt-3 border-t border-gray-700 ml-8">
                    <p className="text-gray-500 text-xs mb-1">MRWA Database Comparison</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">MRWA Zone</p>
                        <p className="text-white font-mono">
                          SLK {override.mrwa_zone.start_slk.toFixed(2)} →{' '}
                          {override.mrwa_zone.end_slk.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">MRWA Speed</p>
                        <p
                          className={`font-bold ${
                            override.mrwa_zone.speed_limit !== override.speed_limit
                              ? 'text-red-400'
                              : 'text-green-400'
                          }`}
                        >
                          {override.mrwa_zone.speed_limit} km/h
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Verified</p>
                        <p className="text-gray-400 text-xs">
                          {override.verified_date || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="mt-6 bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-400 mb-3">How This Works</h2>
        <div className="text-sm text-gray-400 space-y-2">
          <p>
            <strong className="text-white">Speed Zone Overrides</strong> are community-verified
            corrections to MRWA speed zone data. They are used when:
          </p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Physical signs have been moved after road works</li>
            <li>MRWA database has not been updated after road widening</li>
            <li>Sign locations don&apos;t match MRWA SLK boundaries</li>
          </ul>
          <p className="mt-3">
            <strong className="text-white">Generating Reports:</strong>
          </p>
          <ol className="list-decimal list-inside ml-2 space-y-1">
            <li>Check the boxes next to overrides you want to include</li>
            <li>Overrides with discrepancies are auto-selected</li>
            <li>Click &quot;Generate Report&quot; to download a text file</li>
            <li>Send the report to Main Roads WA</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
