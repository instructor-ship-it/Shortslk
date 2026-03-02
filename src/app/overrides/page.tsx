'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

// Storage key for localStorage
const STORAGE_KEY = 'speed-sign-overrides';

interface SpeedSignOverride {
  id: string;
  road_id: string;
  road_name: string;
  common_usage_name?: string;
  slk: number;
  lat?: number;
  lon?: number;
  direction: 'True Left' | 'True Right';
  sign_type: 'Single' | 'Double';
  replicated: boolean;
  start_slk: number;
  end_slk?: number;
  approach_speed?: number;
  front_speed: number;
  back_speed?: number;
  verified_by?: string;
  verified_date?: string;
  note?: string;
  source?: string;
  mrwa_slk?: number;
  discrepancy_m?: number;
}

interface OverridesData {
  version: string;
  last_updated: string;
  signs: SpeedSignOverride[];
}

// Default data from the static file
const DEFAULT_SIGNS: SpeedSignOverride[] = [
  {
    id: "M031-S001",
    road_id: "M031",
    road_name: "Northam Cranbrook Rd",
    common_usage_name: "Great Southern Hwy",
    slk: 64.81,
    lat: -32.09942741,
    lon: 116.90796019,
    direction: "True Right",
    sign_type: "Double",
    replicated: true,
    start_slk: 64.81,
    end_slk: 65.98,
    approach_speed: 110,
    front_speed: 80,
    back_speed: 110,
    verified_by: "field_observation",
    verified_date: "2025-03-01",
    note: "110→80 zone boundary. Road widening completed 2024.",
    source: "community_verified",
    mrwa_slk: 64.80,
    discrepancy_m: 10
  },
  {
    id: "M031-S002",
    road_id: "M031",
    road_name: "Northam Cranbrook Rd",
    common_usage_name: "Great Southern Hwy",
    slk: 65.98,
    lat: -32.10420020,
    lon: 116.91892960,
    direction: "True Right",
    sign_type: "Double",
    replicated: true,
    start_slk: 65.98,
    end_slk: 67.62,
    approach_speed: 80,
    front_speed: 60,
    back_speed: 80,
    verified_by: "field_observation",
    verified_date: "2025-03-01",
    note: "80→60 zone boundary. Road widening completed 2024. 250m discrepancy from MRWA.",
    source: "community_verified",
    mrwa_slk: 65.73,
    discrepancy_m: 250
  },
  {
    id: "M031-S003",
    road_id: "M031",
    road_name: "Northam Cranbrook Rd",
    common_usage_name: "Great Southern Hwy",
    slk: 67.62,
    lat: -32.11706637,
    lon: 116.92667158,
    direction: "True Right",
    sign_type: "Double",
    replicated: true,
    start_slk: 67.62,
    end_slk: 69.19,
    approach_speed: 60,
    front_speed: 90,
    back_speed: 60,
    verified_by: "field_observation",
    verified_date: "2025-03-01",
    note: "60→90 zone boundary. Road widening completed 2024. 280m discrepancy from MRWA.",
    source: "community_verified",
    mrwa_slk: 67.34,
    discrepancy_m: 280
  },
  {
    id: "M031-S004",
    road_id: "M031",
    road_name: "Northam Cranbrook Rd",
    common_usage_name: "Great Southern Hwy",
    slk: 69.19,
    lat: -32.13044808,
    lon: 116.92978109,
    direction: "True Right",
    sign_type: "Double",
    replicated: true,
    start_slk: 69.19,
    end_slk: 75.00,
    approach_speed: 90,
    front_speed: 110,
    back_speed: 90,
    verified_by: "field_observation",
    verified_date: "2025-03-01",
    note: "90→110 zone boundary. Road widening completed 2024.",
    source: "community_verified",
    mrwa_slk: 69.18,
    discrepancy_m: 10
  }
];

// Load data from localStorage
function loadFromStorage(): OverridesData {
  // Default data structure
  const defaultData: OverridesData = {
    version: '2.0',
    last_updated: new Date().toISOString().split('T')[0],
    signs: DEFAULT_SIGNS
  };

  if (typeof window === 'undefined') {
    return defaultData;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Validate the data structure
      if (parsed && typeof parsed === 'object') {
        // Ensure we have a valid signs array
        const signs = Array.isArray(parsed.signs) ? parsed.signs : [];
        
        return {
          version: parsed.version || '2.0',
          last_updated: parsed.last_updated || new Date().toISOString().split('T')[0],
          signs: signs.length > 0 ? signs : DEFAULT_SIGNS
        };
      }
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
  }
  
  // Initialize with default data if nothing stored or error occurred
  saveToStorage(defaultData);
  return defaultData;
}

// Save data to localStorage
function saveToStorage(data: OverridesData): void {
  if (typeof window === 'undefined') return;
  
  data.last_updated = new Date().toISOString().split('T')[0];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

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
  const [editingSign, setEditingSign] = useState<SpeedSignOverride | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const loadData = () => {
    setLoading(true);
    const data = loadFromStorage();
    setSigns(data.signs);
    
    const roads = [...new Set(data.signs.map(s => s.road_id))];
    setMetadata({
      version: data.version,
      last_updated: data.last_updated,
      total_overrides: data.signs.length,
      roads_affected: roads
    });

    // Auto-select all signs with discrepancies
    const discrepancyIds = data.signs
      .filter(s => s.discrepancy_m && s.discrepancy_m > 0)
      .map(s => s.id);
    setSelectedIds(new Set(discrepancyIds));
    
    setLoading(false);
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

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteSign = (id: string) => {
    setSaving(true);
    try {
      const data = loadFromStorage();
      const index = data.signs.findIndex(s => s.id === id);
      if (index === -1) {
        showMessage('error', 'Sign not found');
        return;
      }
      data.signs.splice(index, 1);
      saveToStorage(data);
      showMessage('success', 'Sign deleted successfully');
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      showMessage('error', 'Failed to delete sign');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSign = () => {
    if (!editingSign) return;
    
    if (!editingSign.front_speed) {
      showMessage('error', 'Front Speed is required');
      return;
    }

    if (editingSign.replicated && !editingSign.end_slk) {
      showMessage('error', 'End SLK is required when sign is replicated');
      return;
    }

    if (editingSign.sign_type === 'Double' && !editingSign.back_speed) {
      showMessage('error', 'Back Speed is required for double-sided signs');
      return;
    }

    setSaving(true);
    try {
      const data = loadFromStorage();
      const index = data.signs.findIndex(s => s.id === editingSign.id);
      if (index === -1) {
        showMessage('error', 'Sign not found');
        return;
      }
      
      editingSign.verified_date = new Date().toISOString().split('T')[0];
      data.signs[index] = editingSign;
      saveToStorage(data);
      
      showMessage('success', 'Sign updated successfully');
      setEditingSign(null);
      loadData();
    } catch (error) {
      showMessage('error', 'Failed to update sign');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSign = () => {
    if (!newSign.road_id || !newSign.slk || !newSign.front_speed) {
      showMessage('error', 'Please fill in Road ID, SLK, and Front Speed');
      return;
    }

    if (newSign.replicated && !newSign.end_slk) {
      showMessage('error', 'End SLK is required when sign is replicated');
      return;
    }

    if (newSign.sign_type === 'Double' && !newSign.back_speed) {
      showMessage('error', 'Back Speed is required for double-sided signs');
      return;
    }

    setSaving(true);
    try {
      const data = loadFromStorage();
      
      const sign: SpeedSignOverride = {
        id: `${newSign.road_id}-S${Date.now().toString().slice(-4)}`,
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

      data.signs.push(sign);
      saveToStorage(data);
      
      showMessage('success', `Sign added successfully (ID: ${sign.id})`);
      setShowAddForm(false);
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
      loadData();
    } catch (error) {
      showMessage('error', 'Failed to add sign');
    } finally {
      setSaving(false);
    }
  };

  const exportData = () => {
    const data = loadFromStorage();
    
    // Ensure we have data to export
    if (!data || !data.signs || data.signs.length === 0) {
      showMessage('error', 'No data to export');
      return;
    }
    
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `speed-overrides-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage('success', `Exported ${data.signs.length} signs successfully`);
    } catch (error) {
      console.error('Export error:', error);
      showMessage('error', 'Failed to export data');
    }
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        // Validate the structure
        if (!parsed.signs || !Array.isArray(parsed.signs)) {
          showMessage('error', 'Invalid file format: missing signs array');
          return;
        }

        // Validate each sign has required fields
        for (const sign of parsed.signs) {
          if (!sign.id || !sign.road_id || sign.slk === undefined || !sign.front_speed) {
            showMessage('error', 'Invalid sign data: some signs missing required fields');
            return;
          }
        }

        // Save to localStorage
        const dataToSave: OverridesData = {
          version: parsed.version || '2.0',
          last_updated: parsed.last_updated || new Date().toISOString().split('T')[0],
          signs: parsed.signs
        };
        
        saveToStorage(dataToSave);
        showMessage('success', `Imported ${parsed.signs.length} signs successfully`);
        loadData();
      } catch (error) {
        console.error('Import error:', error);
        showMessage('error', 'Failed to parse JSON file');
      }
    };
    
    reader.readAsText(file);
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      showMessage('success', 'All data cleared. Refreshing...');
      setTimeout(() => loadData(), 500);
    }
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
Storage: Local Device (localStorage)

EXECUTIVE SUMMARY
-----------------
Total Signs in Report: ${selectedSigns.length}
Roads Affected: ${[...new Set(selectedSigns.map(s => s.road_id))].join(', ')}
Data Last Updated: ${metadata?.last_updated || 'N/A'}

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
      {/* Message Banner */}
      {message && (
        <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-3 text-center font-medium ${
          message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        } text-white`}>
          {message.text}
        </div>
      )}
      
      {/* Saving Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-gray-800 rounded-lg p-6 flex items-center gap-3">
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full"></div>
            <span>Saving...</span>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button className="bg-gray-700 hover:bg-gray-600 text-white">
              ← Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Speed Sign Overrides</h1>
        </div>
        <div className="text-xs text-gray-500">
          vRC 1.2.0 | Local Storage
        </div>
      </div>

      {/* Storage Info */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-6">
        <p className="text-sm text-blue-200">
          📱 <strong>Data is stored locally on your device</strong> - Changes persist in your browser&apos;s localStorage.
          Use &quot;Export&quot; to backup your data.
        </p>
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
        {/* Hidden file input for import */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          onChange={importData}
          className="hidden"
        />
        
        <Button
          onClick={generateMrwaExceptionReport}
          disabled={generatingReport || selectedIds.size === 0}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {generatingReport ? 'Generating...' : `📄 Report (${selectedIds.size} selected)`}
        </Button>
        <Button
          onClick={selectAllDiscrepancies}
          className="bg-blue-700 hover:bg-blue-600 text-white"
        >
          Select Discrepancies
        </Button>
        <Button
          onClick={deselectAll}
          className="bg-gray-700 hover:bg-gray-600 text-white"
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
          onClick={exportData}
          className="bg-purple-600 hover:bg-purple-700"
        >
          📤 Export
        </Button>
        <Button
          onClick={triggerImport}
          className="bg-cyan-600 hover:bg-cyan-700"
        >
          📥 Import
        </Button>
        <Button
          onClick={loadData}
          className="bg-gray-700 hover:bg-gray-600 text-white"
        >
          Refresh
        </Button>
        <Button
          onClick={clearAllData}
          className="bg-red-900 hover:bg-red-800 text-red-300"
        >
          Clear All
        </Button>
      </div>

      {/* Add Sign Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-green-700">
          <h3 className="text-lg font-semibold text-green-400 mb-4">Add New Speed Sign</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
              <label className="block text-sm text-gray-400 mb-1">Latitude</label>
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
              <label className="block text-sm text-gray-400 mb-1">Longitude</label>
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
            <div>
              <label className="block text-sm text-gray-400 mb-1">Direction *</label>
              <select
                value={newSign.direction}
                onChange={(e) => setNewSign({ ...newSign, direction: e.target.value as 'True Left' | 'True Right' })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="True Left">True Left (↗ increasing SLK)</option>
                <option value="True Right">True Right (↙ decreasing SLK)</option>
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
                <option value="yes">Yes - matching sign</option>
                <option value="no">No - standalone</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End SLK {newSign.replicated ? '*' : ''}</label>
              <input
                type="number"
                step="0.01"
                value={newSign.end_slk}
                onChange={(e) => setNewSign({ ...newSign, end_slk: e.target.value })}
                placeholder={newSign.replicated ? "Required" : "Not needed"}
                disabled={!newSign.replicated}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Approach Speed</label>
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
                placeholder={newSign.sign_type === 'Double' ? "Required" : "N/A"}
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

          <div className="flex gap-3">
            <Button onClick={handleAddSign} className="bg-green-600 hover:bg-green-700" disabled={saving}>
              {saving ? 'Saving...' : '💾 Save Sign'}
            </Button>
            <Button onClick={() => setShowAddForm(false)} className="bg-gray-700 hover:bg-gray-600 text-white">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Edit Sign Modal */}
      {editingSign && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-blue-400">Edit: {editingSign.id}</h3>
              <Button onClick={() => setEditingSign(null)} className="bg-gray-700 hover:bg-gray-600 text-white h-8 w-8 p-0">✕</Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Road ID</label>
                <input type="text" value={editingSign.road_id} onChange={(e) => setEditingSign({ ...editingSign, road_id: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Road Name</label>
                <input type="text" value={editingSign.road_name || ''} onChange={(e) => setEditingSign({ ...editingSign, road_name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Common Name</label>
                <input type="text" value={editingSign.common_usage_name || ''} onChange={(e) => setEditingSign({ ...editingSign, common_usage_name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">SLK</label>
                <input type="number" step="0.01" value={editingSign.slk} onChange={(e) => setEditingSign({ ...editingSign, slk: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Latitude</label>
                <input type="number" step="0.00000001" value={editingSign.lat || ''} onChange={(e) => setEditingSign({ ...editingSign, lat: e.target.value ? parseFloat(e.target.value) : undefined })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Longitude</label>
                <input type="number" step="0.00000001" value={editingSign.lon || ''} onChange={(e) => setEditingSign({ ...editingSign, lon: e.target.value ? parseFloat(e.target.value) : undefined })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Direction</label>
                <select value={editingSign.direction} onChange={(e) => setEditingSign({ ...editingSign, direction: e.target.value as 'True Left' | 'True Right' })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
                  <option value="True Left">True Left (↗)</option>
                  <option value="True Right">True Right (↙)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sign Type</label>
                <select value={editingSign.sign_type} onChange={(e) => setEditingSign({ ...editingSign, sign_type: e.target.value as 'Single' | 'Double' })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Replicated?</label>
                <select value={editingSign.replicated ? 'yes' : 'no'} onChange={(e) => setEditingSign({ ...editingSign, replicated: e.target.value === 'yes' })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">End SLK</label>
                <input type="number" step="0.01" value={editingSign.end_slk || ''} onChange={(e) => setEditingSign({ ...editingSign, end_slk: e.target.value ? parseFloat(e.target.value) : undefined })} disabled={!editingSign.replicated} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white disabled:opacity-50" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Approach Speed</label>
                <input type="number" step="10" value={editingSign.approach_speed || ''} onChange={(e) => setEditingSign({ ...editingSign, approach_speed: e.target.value ? parseInt(e.target.value) : undefined })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Front Speed *</label>
                <input type="number" step="10" value={editingSign.front_speed} onChange={(e) => setEditingSign({ ...editingSign, front_speed: parseInt(e.target.value) || 0 })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Back Speed</label>
                <input type="number" step="10" value={editingSign.back_speed || ''} onChange={(e) => setEditingSign({ ...editingSign, back_speed: e.target.value ? parseInt(e.target.value) : undefined })} disabled={editingSign.sign_type !== 'Double'} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Note</label>
                <input type="text" value={editingSign.note || ''} onChange={(e) => setEditingSign({ ...editingSign, note: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-700">
              <Button onClick={handleEditSign} className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
                {saving ? 'Saving...' : '💾 Save Changes'}
              </Button>
              <Button onClick={() => setEditingSign(null)} className="bg-gray-700 hover:bg-gray-600 text-white">Cancel</Button>
            </div>
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
              <div key={sign.id} className={`border rounded-lg p-4 transition-colors ${
                selectedIds.has(sign.id) ? 'border-blue-500 bg-blue-900/20' :
                sign.discrepancy_m && sign.discrepancy_m > 0 ? 'border-orange-500/50 bg-orange-900/10' : 'border-gray-700'
              }`}>
                <div className="flex items-start gap-3 mb-2">
                  <div className="pt-1">
                    <Checkbox id={`sign-${sign.id}`} checked={selectedIds.has(sign.id)} onCheckedChange={() => toggleSelection(sign.id)} className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <label className="font-semibold text-white cursor-pointer">{sign.road_id} - {sign.road_name}</label>
                        {sign.common_usage_name && <p className="text-sm text-gray-400">{sign.common_usage_name}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {sign.discrepancy_m && sign.discrepancy_m > 0 && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-orange-600/80 text-white">{sign.discrepancy_m}m discrepancy</span>
                        )}
                        <span className={`px-2 py-1 rounded text-xs font-medium ${sign.sign_type === 'Double' ? 'bg-purple-600' : 'bg-blue-600'} text-white`}>{sign.sign_type}</span>
                        {sign.replicated && <span className="px-2 py-1 rounded text-xs font-medium bg-green-600 text-white">Replicated</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm ml-8">
                  <div><p className="text-gray-500">Location</p><p className="text-white font-mono">SLK {sign.slk}</p></div>
                  <div><p className="text-gray-500">Direction</p><p className="text-white">{sign.direction}</p></div>
                  <div><p className="text-gray-500">Zone</p><p className="text-white font-mono">{sign.end_slk ? `${sign.start_slk} → ${sign.end_slk}` : 'Repeater'}</p></div>
                  <div><p className="text-gray-500">Speed</p><p className="text-orange-400 font-bold">{sign.front_speed} km/h{sign.sign_type === 'Double' && sign.back_speed && <span className="text-gray-400 font-normal"> / {sign.back_speed} back</span>}</p></div>
                  <div><p className="text-gray-500">Approach</p><p className="text-gray-300">{sign.approach_speed ? `${sign.approach_speed} km/h` : '-'}</p></div>
                </div>

                {sign.note && <div className="mt-2 ml-8"><p className="text-gray-400 text-sm italic">{sign.note}</p></div>}

                <div className="mt-3 pt-3 border-t border-gray-700 ml-8 flex justify-end gap-2">
                  <Button onClick={() => setEditingSign(sign)} size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs">Edit</Button>
                  {deleteConfirm === sign.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 text-sm">Delete?</span>
                      <Button onClick={() => handleDeleteSign(sign.id)} size="sm" className="bg-red-600 hover:bg-red-700 h-7 text-xs">Yes</Button>
                      <Button onClick={() => setDeleteConfirm(null)} size="sm" className="bg-gray-700 hover:bg-gray-600 h-7 text-xs">No</Button>
                    </div>
                  ) : (
                    <Button onClick={() => setDeleteConfirm(sign.id)} size="sm" className="bg-red-900/50 hover:bg-red-800 text-red-300 h-7 text-xs">Delete</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
