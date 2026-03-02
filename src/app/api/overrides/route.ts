import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Force Node.js runtime (required for fs operations)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Single path - must match where frontend reads from
const OVERRIDES_PATH = path.join(process.cwd(), 'public', 'data', 'speed-overrides.json');

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

function readOverridesFile(): OverridesData {
  try {
    console.log('[API] Reading from:', OVERRIDES_PATH);
    const content = fs.readFileSync(OVERRIDES_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[API] Error reading file:', error);
    // Return default structure if file doesn't exist
    return {
      version: '2.0',
      last_updated: new Date().toISOString().split('T')[0],
      signs: []
    };
  }
}

function writeOverridesFile(data: OverridesData): { success: boolean; error?: string } {
  try {
    data.last_updated = new Date().toISOString().split('T')[0];
    
    // Ensure directory exists
    const dir = path.dirname(OVERRIDES_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    console.log('[API] Writing to:', OVERRIDES_PATH);
    fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[API] Write successful');
    return { success: true };
  } catch (error) {
    console.error('[API] Error writing file:', error);
    return { success: false, error: String(error) };
  }
}

// GET - Read all overrides
export async function GET() {
  try {
    const data = readOverridesFile();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to read overrides', details: String(error) }, { status: 500 });
  }
}

// POST - Add, Update, or Delete a sign
export async function POST(request: NextRequest) {
  try {
    console.log('[API] POST request received');
    const body = await request.json();
    const { action, sign } = body;

    console.log('[API] Action:', action, 'Sign ID:', sign?.id);

    if (!action || !sign) {
      return NextResponse.json({ error: 'Missing action or sign data' }, { status: 400 });
    }

    const data = readOverridesFile();

    switch (action) {
      case 'add':
        // Generate ID if not provided
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
          console.log('[API] Sign not found for update:', sign.id);
          return NextResponse.json({ error: 'Sign not found', id: sign.id }, { status: 404 });
        }
        sign.verified_date = new Date().toISOString().split('T')[0];
        data.signs[updateIndex] = sign;
        console.log('[API] Updated sign:', sign.id);
        break;

      case 'delete':
        const deleteIndex = data.signs.findIndex(s => s.id === sign.id);
        if (deleteIndex === -1) {
          console.log('[API] Sign not found for delete:', sign.id);
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
        path: OVERRIDES_PATH 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sign: sign,
      totalSigns: data.signs.length,
      path: OVERRIDES_PATH
    });
  } catch (error) {
    console.error('[API] POST Error:', error);
    return NextResponse.json({ 
      error: 'Failed to process request', 
      details: String(error) 
    }, { status: 500 });
  }
}
