import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
  signs: SpeedSignOverride[];
}

function readOverridesFile(): OverridesData {
  try {
    const content = fs.readFileSync(OVERRIDES_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Return default structure if file doesn't exist
    return {
      version: '2.0',
      last_updated: new Date().toISOString().split('T')[0],
      signs: []
    };
  }
}

function writeOverridesFile(data: OverridesData): void {
  data.last_updated = new Date().toISOString().split('T')[0];
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// GET - Read all overrides
export async function GET() {
  try {
    const data = readOverridesFile();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading overrides:', error);
    return NextResponse.json({ error: 'Failed to read overrides' }, { status: 500 });
  }
}

// POST - Add, Update, or Delete a sign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sign } = body;

    const data = readOverridesFile();

    switch (action) {
      case 'add':
        // Generate ID if not provided
        if (!sign.id) {
          sign.id = `${sign.road_id}-S${Date.now().toString().slice(-4)}`;
        }
        sign.verified_date = new Date().toISOString().split('T')[0];
        data.signs.push(sign);
        break;

      case 'update':
        const updateIndex = data.signs.findIndex(s => s.id === sign.id);
        if (updateIndex === -1) {
          return NextResponse.json({ error: 'Sign not found' }, { status: 404 });
        }
        sign.verified_date = new Date().toISOString().split('T')[0];
        data.signs[updateIndex] = sign;
        break;

      case 'delete':
        const deleteIndex = data.signs.findIndex(s => s.id === sign.id);
        if (deleteIndex === -1) {
          return NextResponse.json({ error: 'Sign not found' }, { status: 404 });
        }
        data.signs.splice(deleteIndex, 1);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    writeOverridesFile(data);

    return NextResponse.json({
      success: true,
      sign: sign,
      totalSigns: data.signs.length
    });
  } catch (error) {
    console.error('Error processing override:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
