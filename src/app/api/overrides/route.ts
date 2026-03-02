import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Force Node.js runtime (required for fs operations)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Use project root data directory (more reliable for writes)
const DATA_DIR = path.join(process.cwd(), 'data');
const OVERRIDES_PATH = path.join(DATA_DIR, 'speed-overrides.json');
const PUBLIC_PATH = path.join(process.cwd(), 'public', 'data', 'speed-overrides.json');

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
}

interface OverridesData {
  version: string;
  last_updated: string;
  description?: string;
  disclaimer?: string;
  signs: SpeedSignOverride[];
}

function getDefaultData(): OverridesData {
  return {
    version: '2.0',
    last_updated: new Date().toISOString().split('T')[0],
    description: 'Community-verified speed zone corrections',
    disclaimer: 'Field-verified data. Use at own discretion.',
    signs: []
  };
}

function readOverridesFile(): OverridesData {
  // Try data directory first, then public
  const paths = [OVERRIDES_PATH, PUBLIC_PATH];
  
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        console.log('[API] Reading from:', filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.log('[API] Error reading', filePath, error);
    }
  }
  
  return getDefaultData();
}

function writeOverridesFile(data: OverridesData): { success: boolean; error?: string; path?: string } {
  const paths = [OVERRIDES_PATH, PUBLIC_PATH];
  let lastError: string | undefined;
  
  for (const filePath of paths) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      data.last_updated = new Date().toISOString().split('T')[0];
      
      console.log('[API] Attempting write to:', filePath);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log('[API] Write successful to:', filePath);
      
      // Also sync to public if we wrote to data directory
      if (filePath === OVERRIDES_PATH && fs.existsSync(PUBLIC_PATH)) {
        try {
          fs.copyFileSync(filePath, PUBLIC_PATH);
          console.log('[API] Synced to public directory');
        } catch {
          // Ignore sync errors
        }
      }
      
      return { success: true, path: filePath };
    } catch (error) {
      console.error('[API] Write failed for', filePath, error);
      lastError = String(error);
    }
  }
  
  return { success: false, error: lastError };
}

// GET - Read all overrides
export async function GET() {
  try {
    const data = readOverridesFile();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to read', details: String(error) }, { status: 500 });
  }
}

// POST - Add, Update, or Delete a sign
export async function POST(request: NextRequest) {
  try {
    console.log('[API] === POST request received ===');
    console.log('[API] CWD:', process.cwd());
    console.log('[API] Data path:', OVERRIDES_PATH);
    console.log('[API] Public path:', PUBLIC_PATH);
    
    const body = await request.json();
    const { action, sign } = body;

    console.log('[API] Action:', action, 'Sign ID:', sign?.id);

    if (!action || !sign) {
      return NextResponse.json({ error: 'Missing action or sign data' }, { status: 400 });
    }

    const data = readOverridesFile();

    switch (action) {
      case 'add':
        if (!sign.id) {
          sign.id = `${sign.road_id}-S${Date.now().toString().slice(-4)}`;
        }
        sign.verified_date = new Date().toISOString().split('T')[0];
        data.signs.push(sign);
        console.log('[API] Added sign:', sign.id);
        break;

      case 'update':
        const updateIndex = data.signs.findIndex(s => s.id === sign.id);
        if (updateIndex === -1) {
          return NextResponse.json({ error: 'Sign not found', id: sign.id }, { status: 404 });
        }
        sign.verified_date = new Date().toISOString().split('T')[0];
        data.signs[updateIndex] = sign;
        console.log('[API] Updated sign:', sign.id);
        break;

      case 'delete':
        const deleteIndex = data.signs.findIndex(s => s.id === sign.id);
        if (deleteIndex === -1) {
          return NextResponse.json({ error: 'Sign not found', id: sign.id }, { status: 404 });
        }
        data.signs.splice(deleteIndex, 1);
        console.log('[API] Deleted sign:', sign.id);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action: ' + action }, { status: 400 });
    }

    const writeResult = writeOverridesFile(data);
    
    if (!writeResult.success) {
      return NextResponse.json({ 
        error: 'Failed to write file', 
        details: writeResult.error,
        attemptedPaths: [OVERRIDES_PATH, PUBLIC_PATH],
        cwd: process.cwd()
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sign: sign,
      totalSigns: data.signs.length,
      path: writeResult.path
    });
  } catch (error) {
    console.error('[API] POST Error:', error);
    return NextResponse.json({ 
      error: 'Failed to process request', 
      details: String(error) 
    }, { status: 500 });
  }
}
