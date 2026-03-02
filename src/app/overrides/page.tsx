'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getSpeedSignOverrides,
  getSpeedOverridesMetadata,
  type SpeedSignOverride,
} from '@/lib/offline-db';

export default function OverridesPage() {
  const [signs, setSigns] = useState<SpeedSignOverride[]>([]);
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // New sign form state
  const [newSign, setNewSign] = useState({
    road_id: '',
    road_name: '',
    common_usage_name: '',
    slk: '',
    lat: '',
    lon: '',
    direction: 'True Right' as 'True Left' | 'True Right',
    sign_type: 'Double' as 'Single' | 'Double',
    replicated: true,
    start_slk: '',
    end_slk: '',
    approach_speed: '',
    front_speed: '',
    back_speed: '',
    note: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const meta = await getSpeedOverridesMetadata();
      setMetadata(meta);

      const allSigns = await getSpeedSignOverrides('');
      setSigns(allSigns);

      // Auto-select all signs with discrepancies
      const discrepancyIds = allSigns
        .filter(s => s.discrepancy_m && s.discrepancy_m > 0)
        .map(s => s.id);
      setSelectedIds(new Set(discrepancyIds));
    } catch (err) {
      console.error('Error loading signs:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAllDiscrepancies = () => {
    const ids = signs.filter(s => s.discrepancy_m && s.discrepancy_m > 0).map(s => s.id);
    setSelectedIds(new Set(ids));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const handleDeleteSign = async (id: string) => {
    // For now, show instructions since we can't write to JSON directly from client
    alert(`To delete sign ${id}, edit /public/data/speed-overrides.json and remove the sign entry with that ID.`);
    setDeleteConfirm(null);
  };

  const handleAddSign = async () => {
    // Validate required fields
    if (!newSign.road_id || !newSign.slk || !newSign.front_speed) {
      alert('Please fill in Road ID, SLK, and Front Speed');
      return;
    }

    if (newSign.replicated && !newSign.end_slk) {
      alert('End SLK is required when sign is replicated');
      return;
    }

    if (newSign.sign_type === 'Double' && !newSign.back_speed) {
      alert('Back Speed is required for double-sided signs');
      return;
    }

    // Generate JSON for user to copy
    const signJson = {
      id: `${newSign.road_id}-S${Date.now().toString().slice(-3)}`,
      road_id: newSign.road_id,
      road_name: newSign.road_name || newSign.road_id,
      common_usage_name: newSign.common_usage_name || undefined,
      slk: parseFloat(newSign.slk),
      lat: newSign.lat ? parseFloat(newSign.lat) : undefined,
      lon: newSign.lon ? parseFloat(newSign.lon) : undefined,
      direction: newSign.direction,
      sign_type: newSign.sign_type,
      replicated: newSign.replicated,
      start_slk: parseFloat(newSign.slk),
      end_slk: newSign.replicated && newSign.end_slk ? parseFloat(newSign.end_slk) : undefined,
      approach_speed: newSign.approach_speed ? parseInt(newSign.approach_speed) : undefined,
      front_speed: parseInt(newSign.front_speed),
      back_speed: newSign.sign_type === 'Double' && newSign.back_speed ? parseInt(newSign.back_speed) : undefined,
      verified_by: 'user_input',
      verified_date: new Date().toISOString().split('T')[0],
      note: newSign.note || undefined,
      source: 'community_verified'
    };

    // Show JSON for user to copy
    const jsonStr = JSON.stringify(signJson, null, 2);
    alert(`Add this to /public/data/speed-overrides.json:\n\n${jsonStr}`);
    
    setShowAddForm(false);
    // Reset form
    setNewSign({
      road_id: '',
      road_name: '',
      common_usage_name: '',
      slk: '',
      lat: '',
      lon: '',
      direction: 'True Right',
      sign_type: 'Double',
      replicated: true,
      start_slk: '',
      end_slk: '',
      approach_speed: '',
      front_speed: '',
      back_speed: '',
      note: '',
    });
  };

  const generateMrwaExceptionReport = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one sign to include in the report.');
      return;
    }

    setGeneratingReport(true);

    try {
      const selectedSigns = signs.filter(s => selectedIds.has(s.id));
      const reportDate = new Date().toISOString().split('T')[0];
      
      let report = `MRWA SPEED ZONE EXCEPTION REPORT
================================
Generated: ${new Date().toLocaleString()}
Report Date: ${reportDate}
Source: TC Work Zone Locator - Community Verified Speed Signs
Version: ${metadata?.version || '2.0'}

EXECUTIVE SUMMARY
-----------------
Total Signs in Report: ${selectedSigns.length}
Roads Affected: ${[...new Set(selectedSigns.map(s => s.road_id))].join(', ')}
Data Last Updated: ${metadata?.last_updated || 'N/A'}

PURPOSE
-------
This report documents discrepancies between MRWA speed zone data and field-verified
physical signage locations. These discrepancies are likely due to road works (widening,
re-alignment, or signage updates) that have not yet been reflected in MRWA databases.

SIGN TYPES EXPLAINED
--------------------
- Single + Not Replicated: Repeater sign (informational only)
- Single + Replicated: Direction-specific zone (different speeds each direction)  
- Double + Replicated: Same speed both directions (Single carriageway zone)

DETAILED SIGN RECORDS
---------------------

`;

      for (const sign of selectedSigns) {
        report += `
================================================================================
ROAD: ${sign.road_id} - ${sign.road_name}
${sign.common_usage_name ? `Common Name: ${sign.common_usage_name}` : ''}
================================================================================

SIGN ID: ${sign.id}
SIGN TYPE: ${sign.sign_type}${sign.replicated ? ' (Replicated)' : ''}
DIRECTION: ${sign.direction} (sign faces this direction)

LOCATION:
  SLK: ${sign.slk}${sign.lat ? `\n  GPS: ${sign.lat.toFixed(8)}, ${sign.lon?.toFixed(8)}` : ''}

ZONE DEFINITION:
  Start SLK: ${sign.start_slk}${sign.end_slk ? `\n  End SLK: ${sign.end_slk}` : ''}

SPEEDS:
  Approach Speed: ${sign.approach_speed ? `${sign.approach_speed} km/h` : 'N/A'}
  Front Face (facing ${sign.direction}): ${sign.front_speed} km/h
  ${sign.sign_type === 'Double' ? `Back Face (opposite direction): ${sign.back_speed || 'N/A'} km/h` : ''}
`;

        if (sign.mrwa_slk !== undefined) {
          report += `
MRWA COMPARISON:
  MRWA SLK: ${sign.mrwa_slk}
  Discrepancy: ${sign.discrepancy_m || 0} meters
`;
        }

        if (sign.note) {
          report += `
NOTES:
  ${sign.note}
`;
        }

        report += `
VERIFIED BY: ${sign.verified_by || 'Field Observation'}
VERIFIED DATE: ${sign.verified_date || 'N/A'}
SOURCE: ${sign.source}
`;
      }

      report += `

SUMMARY TABLE
-------------
| Sign ID | Road | SLK | Type | Replicated | Zone Start | Zone End | Front Speed | Back Speed | Discrepancy |
|---------|------|-----|------|------------|------------|----------|-------------|------------|-------------|
`;

      for (const s of selectedSigns) {
        const type = s.sign_type === 'Double' ? 'Dbl' : 'Sgl';
        const rep = s.replicated ? 'Yes' : 'No';
        const end = s.end_slk?.toFixed(2) || '-';
        const back = s.back_speed || '-';
        const disc = s.discrepancy_m ? `${s.discrepancy_m}m` : '-';

        report += `| ${s.id} | ${s.road_id} | ${s.slk.toFixed(2)} | ${type} | ${rep} | ${s.start_slk.toFixed(2)} | ${end} | ${s.front_speed} | ${back} | ${disc} |\n`;
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
`;

      // Download
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
          <h1 className="text-xl font-bold">Speed Sign Overrides</h1>
        </div>
        <div className="text-xs text-gray-500">
          vRC 1.0.4
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-blue-400 mb-3">System Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Data Version</p>
            <p className="text-lg font-mono text-white">{metadata?.version || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Last Updated</p>
            <p className="text-lg text-white">{metadata?.last_updated || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Signs</p>
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
          Select Discrepancies
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
          {showAddForm ? '✕ Cancel' : '+ Add Sign'}
        </Button>
        <Button
          onClick={loadData}
          variant="outline"
          className="border-gray-600 text-gray-300"
        >
          Refresh
        </Button>
      </div>

      {/* Add Sign Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-green-700">
          <h3 className="text-lg font-semibold text-green-400 mb-4">Add New Speed Sign</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Road Info */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Road ID *</label>
              <input
                type="text"
                value={newSign.road_id}
                onChange={(e) => setNewSign({ ...newSign, road_id: e.target.value })}
                placeholder="e.g., M031"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Road Name</label>
              <input
                type="text"
                value={newSign.road_name}
                onChange={(e) => setNewSign({ ...newSign, road_name: e.target.value })}
                placeholder="e.g., Northam Cranbrook Rd"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Common Name</label>
              <input
                type="text"
                value={newSign.common_usage_name}
                onChange={(e) => setNewSign({ ...newSign, common_usage_name: e.target.value })}
                placeholder="e.g., Great Southern Hwy"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Sign Location */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">SLK *</label>
              <input
                type="number"
                step="0.01"
                value={newSign.slk}
                onChange={(e) => setNewSign({ ...newSign, slk: e.target.value })}
                placeholder="e.g., 64.81"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Latitude (optional)</label>
              <input
                type="number"
                step="0.00000001"
                value={newSign.lat}
                onChange={(e) => setNewSign({ ...newSign, lat: e.target.value })}
                placeholder="-32.09942741"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Longitude (optional)</label>
              <input
                type="number"
                step="0.00000001"
                value={newSign.lon}
                onChange={(e) => setNewSign({ ...newSign, lon: e.target.value })}
                placeholder="116.90796019"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Sign Configuration */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Direction *</label>
              <select
                value={newSign.direction}
                onChange={(e) => setNewSign({ ...newSign, direction: e.target.value as 'True Left' | 'True Right' })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="True Right">True Right (↗ increasing SLK)</option>
                <option value="True Left">True Left (↙ decreasing SLK)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Sign Type *</label>
              <select
                value={newSign.sign_type}
                onChange={(e) => setNewSign({ ...newSign, sign_type: e.target.value as 'Single' | 'Double' })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="Single">Single Sided</option>
                <option value="Double">Double Sided</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Replicated? *</label>
              <select
                value={newSign.replicated ? 'yes' : 'no'}
                onChange={(e) => setNewSign({ ...newSign, replicated: e.target.value === 'yes' })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="yes">Yes - matching sign opposite</option>
                <option value="no">No - standalone sign</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End SLK {newSign.replicated ? '*' : ''}</label>
              <input
                type="number"
                step="0.01"
                value={newSign.end_slk}
                onChange={(e) => setNewSign({ ...newSign, end_slk: e.target.value })}
                placeholder={newSign.replicated ? "Required if replicated" : "Not needed"}
                disabled={!newSign.replicated}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Speeds */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Approach Speed {newSign.replicated ? '*' : ''}</label>
              <input
                type="number"
                step="10"
                value={newSign.approach_speed}
                onChange={(e) => setNewSign({ ...newSign, approach_speed: e.target.value })}
                placeholder="e.g., 110"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Front Speed *</label>
              <input
                type="number"
                step="10"
                value={newSign.front_speed}
                onChange={(e) => setNewSign({ ...newSign, front_speed: e.target.value })}
                placeholder="e.g., 80"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Back Speed {newSign.sign_type === 'Double' ? '*' : ''}</label>
              <input
                type="number"
                step="10"
                value={newSign.back_speed}
                onChange={(e) => setNewSign({ ...newSign, back_speed: e.target.value })}
                placeholder={newSign.sign_type === 'Double' ? "Required for double" : "Single sided"}
                disabled={newSign.sign_type !== 'Double'}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Note</label>
              <input
                type="text"
                value={newSign.note}
                onChange={(e) => setNewSign({ ...newSign, note: e.target.value })}
                placeholder="e.g., Road widening 2024"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Zone Preview */}
          {newSign.replicated && newSign.sign_type === 'Double' && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-300 font-semibold mb-1">Zone Preview:</p>
              <p className="text-sm text-blue-200">
                SLK {newSign.slk || '?'} → {newSign.end_slk || '?'} @ {newSign.front_speed || '?'} km/h
                <span className="text-green-400"> (Both directions - Single carriageway)</span>
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleAddSign} className="bg-green-600 hover:bg-green-700">
              Generate JSON
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

      {/* Signs List */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-400 mb-4">Active Speed Signs</h2>
        
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : signs.length === 0 ? (
          <p className="text-gray-400">No speed signs loaded.</p>
        ) : (
          <div className="space-y-4">
            {signs.map((sign) => (
              <div
                key={sign.id}
                className={`border rounded-lg p-4 transition-colors ${
                  selectedIds.has(sign.id)
                    ? 'border-blue-500 bg-blue-900/20'
                    : sign.discrepancy_m && sign.discrepancy_m > 0
                    ? 'border-orange-500/50 bg-orange-900/10'
                    : 'border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="pt-1">
                    <Checkbox
                      id={`sign-${sign.id}`}
                      checked={selectedIds.has(sign.id)}
                      onCheckedChange={() => toggleSelection(sign.id)}
                      className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <label className="font-semibold text-white cursor-pointer">
                          {sign.road_id} - {sign.road_name}
                        </label>
                        {sign.common_usage_name && (
                          <p className="text-sm text-gray-400">{sign.common_usage_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {sign.discrepancy_m && sign.discrepancy_m > 0 && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-orange-600/80 text-white">
                            {sign.discrepancy_m}m discrepancy
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          sign.sign_type === 'Double' ? 'bg-purple-600' : 'bg-blue-600'
                        } text-white`}>
                          {sign.sign_type}
                        </span>
                        {sign.replicated && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-green-600 text-white">
                            Replicated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm ml-8">
                  <div>
                    <p className="text-gray-500">Location</p>
                    <p className="text-white font-mono">SLK {sign.slk}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Direction</p>
                    <p className="text-white">{sign.direction}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Zone</p>
                    <p className="text-white font-mono">
                      {sign.end_slk ? `${sign.start_slk} → ${sign.end_slk}` : 'Repeater'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Speed</p>
                    <p className="text-orange-400 font-bold">
                      {sign.front_speed} km/h
                      {sign.sign_type === 'Double' && sign.back_speed && (
                        <span className="text-gray-400 font-normal"> / {sign.back_speed} back</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Approach</p>
                    <p className="text-gray-300">{sign.approach_speed ? `${sign.approach_speed} km/h` : '-'}</p>
                  </div>
                </div>

                {sign.note && (
                  <div className="mt-2 ml-8">
                    <p className="text-gray-400 text-sm italic">{sign.note}</p>
                  </div>
                )}

                {/* Delete button */}
                <div className="mt-3 pt-3 border-t border-gray-700 ml-8 flex justify-end">
                  {deleteConfirm === sign.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 text-sm">Delete this sign?</span>
                      <Button
                        onClick={() => handleDeleteSign(sign.id)}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 h-7 text-xs"
                      >
                        Confirm
                      </Button>
                      <Button
                        onClick={() => setDeleteConfirm(null)}
                        size="sm"
                        variant="outline"
                        className="border-gray-600 text-gray-300 h-7 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setDeleteConfirm(sign.id)}
                      size="sm"
                      variant="outline"
                      className="border-red-600 text-red-400 hover:bg-red-900/30 h-7 text-xs"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="mt-6 bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-400 mb-3">How Speed Signs Work</h2>
        <div className="text-sm text-gray-400 space-y-3">
          <div>
            <strong className="text-white">Direction:</strong>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li><span className="text-green-400">True Right</span>: Sign faces traffic travelling INCREASING SLK</li>
              <li><span className="text-yellow-400">True Left</span>: Sign faces traffic travelling DECREASING SLK</li>
            </ul>
          </div>
          
          <div>
            <strong className="text-white">Sign Types:</strong>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li><span className="text-blue-400">Single + Not Replicated</span>: Repeater (info only, no zone)</li>
              <li><span className="text-blue-400">Single + Replicated</span>: Direction-specific zone</li>
              <li><span className="text-purple-400">Double + Replicated</span>: Same speed both directions (Single carriageway)</li>
            </ul>
          </div>

          <div>
            <strong className="text-white">Speeds:</strong>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li><span className="text-gray-300">Approach Speed</span>: Speed BEFORE reaching this sign</li>
              <li><span className="text-orange-400">Front Speed</span>: Speed shown to selected direction</li>
              <li><span className="text-gray-300">Back Speed</span>: Speed on reverse face (opposite direction)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
