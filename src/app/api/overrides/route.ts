import { NextRequest, NextResponse } from 'next/server';

// This API is now a pass-through for localStorage-based storage
// The actual data is stored in the browser's localStorage

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

// GET - Return info about storage mode
export async function GET() {
  return NextResponse.json({ 
    mode: 'localStorage',
    message: 'Data is stored in browser localStorage'
  });
}

// POST - This is deprecated, but kept for compatibility
export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Server-side storage is not available on this deployment.',
    message: 'Data is stored in your browser localStorage. It persists on your device.',
    hint: 'Use the browser localStorage instead - data is stored locally on your device.'
  }, { status: 200 });
}
