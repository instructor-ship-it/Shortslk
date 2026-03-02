import { NextResponse } from 'next/server';

// Overpass API - Free OpenStreetMap data query
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

interface SpeedLimitResult {
  maxspeed: number | null;
  highway: string;
  name: string;
  source: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const radius = searchParams.get('radius') || '50'; // meters

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
  }

  try {
    // Query for roads with speed limits near the location
    const query = `
      [out:json][timeout:10];
      (
        way["maxspeed"](around:${radius},${lat},${lon});
        way["highway"~"primary|secondary|tertiary|residential|trunk|motorway"](around:${radius},${lat},${lon});
      );
      out tags geom(${parseFloat(lat) - 0.001},${parseFloat(lon) - 0.001},${parseFloat(lat) + 0.001},${parseFloat(lon) + 0.001});
    `;

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: query
    });

    const data = await response.json();

    if (!data.elements || data.elements.length === 0) {
      return NextResponse.json({ 
        maxspeed: null, 
        highway: 'unknown',
        name: 'Unknown road',
        source: 'No data found'
      });
    }

    // Find the closest road with speed limit
    let bestMatch: SpeedLimitResult = {
      maxspeed: null,
      highway: 'unknown',
      name: 'Unknown road',
      source: 'Overpass API'
    };

    for (const element of data.elements) {
      if (element.tags) {
        const maxspeed = parseMaxSpeed(element.tags.maxspeed);
        const highway = element.tags.highway || 'unknown';
        const name = element.tags.name || element.tags.ref || highway;

        // Prefer roads with speed limits
        if (maxspeed && !bestMatch.maxspeed) {
          bestMatch = { maxspeed, highway, name, source: 'Overpass API' };
        } else if (maxspeed && bestMatch.maxspeed) {
          // Keep the one with speed limit
          bestMatch = { maxspeed, highway, name, source: 'Overpass API' };
        } else if (!bestMatch.highway || bestMatch.highway === 'unknown') {
          bestMatch = { maxspeed, highway, name, source: 'Overpass API' };
        }
      }
    }

    // Apply default speed limits based on road type if not tagged
    if (!bestMatch.maxspeed) {
      bestMatch.maxspeed = getDefaultSpeedLimit(bestMatch.highway);
    }

    return NextResponse.json(bestMatch);
  } catch (error: any) {
    console.error('Speed limit error:', error);
    return NextResponse.json({ 
      maxspeed: null, 
      highway: 'unknown',
      name: 'Error',
      source: 'API error',
      error: error.message 
    }, { status: 500 });
  }
}

function parseMaxSpeed(maxspeed: string | undefined): number | null {
  if (!maxspeed) return null;

  // Handle various formats: "60", "60 km/h", "60 mph", "50;70", etc.
  const match = maxspeed.match(/(\d+)/);
  if (match) {
    const speed = parseInt(match[1]);
    // If mph, convert to km/h
    if (maxspeed.toLowerCase().includes('mph')) {
      return Math.round(speed * 1.60934);
    }
    return speed;
  }
  return null;
}

function getDefaultSpeedLimit(highwayType: string): number {
  // Australian default speed limits by road type
  const defaults: Record<string, number> = {
    'motorway': 110,
    'trunk': 110,
    'primary': 100,
    'secondary': 100,
    'tertiary': 80,
    'residential': 50,
    'unclassified': 80,
    'service': 40,
    'living_street': 30
  };

  return defaults[highwayType] || 100; // Default to 100 km/h
}
