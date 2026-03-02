import { NextResponse } from 'next/server';

// OSRM Route API - Free and open source routing
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

interface RouteResult {
  distance: number; // meters
  duration: number; // seconds
  geometry: string; // encoded polyline
  legs: {
    distance: number;
    duration: number;
  }[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startLat = searchParams.get('startLat');
  const startLon = searchParams.get('startLon');
  const endLat = searchParams.get('endLat');
  const endLon = searchParams.get('endLon');

  if (!startLat || !startLon || !endLat || !endLon) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }

  try {
    // OSRM expects coordinates as lon,lat
    const coords = `${startLon},${startLat};${endLon},${endLat}`;
    const url = `${OSRM_URL}/${coords}?overview=full&geometries=polyline`;

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'TC-Work-Zone-Locator/2.4',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`OSRM returned ${response.status}`);
    }
    
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return NextResponse.json({ error: 'No route found' }, { status: 404 });
    }

    const route = data.routes[0] as RouteResult;

    return NextResponse.json({
      distance: route.distance, // meters
      duration: route.duration, // seconds
      distanceKm: Math.round(route.distance / 1000 * 10) / 10,
      durationMin: Math.round(route.duration / 60 * 10) / 10,
      geometry: route.geometry,
      legs: route.legs
    });
  } catch (error: any) {
    console.error('Route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Geocoding - find coordinates from address using Nominatim (free)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    // Add Australia focus for MRWA context
    const searchQuery = `${address}, Western Australia, Australia`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TC-Work-Zone-Locator/2.3'
      }
    });
    const data = await response.json();

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    const results = data.map((r: any) => ({
      name: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon)
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Geocoding error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
