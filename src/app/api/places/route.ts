import { NextResponse } from 'next/server';

interface Place {
  name: string;
  distance: string;
  lat: number;
  lon: number;
  phone?: string;
  address?: string;
  googleMapsUrl: string;
  isEmergency?: boolean;
}

interface PlacesResult {
  hospital: Place | null;
  toilet: Place | null;
  fuelStation: Place | null;
}

// Calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Search for places using Overpass API with fallback servers
async function searchOverpass(lat: number, lon: number, query: string): Promise<any[]> {
  const overpassQuery = `
    [out:json][timeout:30];
    (
      ${query}
    );
    out center;
  `;
  
  // Try multiple Overpass servers
  const servers = [
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  
  for (const server of servers) {
    try {
      const response = await fetch(server, {
        method: 'POST',
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      continue;
    }
  }
  
  return [];
}

// Check if facility is a real hospital (not dental, fertility, etc.)
function isRealHospital(tags: Record<string, string>): boolean {
  const name = (tags.name || '').toLowerCase();
  
  // Exclude non-hospital medical facilities
  const excludeTerms = ['dental', 'dentist', 'orthodontic', 'fertility', 'ivf', 
                        'day surgery', 'cosmetic', 'psychology', 'counselling',
                        'private clinic', 'eye hospital'];
  
  if (excludeTerms.some(term => name.includes(term))) {
    return false;
  }
  
  return true;
}

// Check if fuel station is legitimate (exclude obviously foreign entries)
function isValidFuelStation(tags: Record<string, string>): boolean {
  const name = (tags.name || '').toLowerCase();
  
  // Exclude obviously non-Australian stations
  const excludeTerms = ['e. leclerc', 'leclerc', 'carrefour', 'total', 'esso', 
                        'shell france', 'bp france', 'intermarché'];
  
  if (excludeTerms.some(term => name.includes(term))) {
    return false;
  }
  
  // Check for Australian brands or valid names
  const auBrands = ['bp', 'shell', 'caltex', 'woolworths', 'coles express', 'united', 
                    '7-eleven', 'ampol', 'puma', 'liberty', 'metro', 'speedway',
                    'roadhouse', 'service station'];
  
  const brand = (tags.brand || '').toLowerCase();
  
  // Accept if it's an Australian brand or has a reasonable name
  if (auBrands.some(b => name.includes(b) || brand.includes(b))) {
    return true;
  }
  
  // Accept if it has a name that doesn't look foreign
  if (name && !name.includes('station service')) {
    return true;
  }
  
  return false;
}

// Get coordinates from element (handles both nodes and ways with center)
function getCoordinates(el: any): { lat: number; lon: number } | null {
  // Node has direct lat/lon
  if (el.lat && el.lon) {
    return { lat: el.lat, lon: el.lon };
  }
  
  // Way has center property (from 'out center' query)
  if (el.center && el.center.lat && el.center.lon) {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  
  return null;
}

// Process and sort places by distance, prioritizing emergency facilities
function processPlaces(elements: any[], targetLat: number, targetLon: number, filterType: 'hospital' | 'fuel' | 'other' = 'other'): Place[] {
  let places: Place[] = elements
    .filter((el: any) => getCoordinates(el))
    .filter((el: any) => {
      const tags = el.tags || {};
      if (filterType === 'hospital') {
        return isRealHospital(tags);
      }
      if (filterType === 'fuel') {
        return isValidFuelStation(tags);
      }
      return true;
    })
    .map((el: any) => {
      const tags = el.tags || {};
      const coords = getCoordinates(el)!;
      const distance = calculateDistance(targetLat, targetLon, coords.lat, coords.lon);
      
      // Get best available name
      let name = tags.name || tags.operator || tags.official_name || '';
      if (!name) {
        name = tags.amenity === 'hospital' ? 'Hospital' : 
               tags.amenity === 'fuel' ? 'Service Station' :
               tags.amenity === 'toilets' ? 'Public Toilets' : 'Unknown';
      }
      
      const phone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || undefined;
      
      // Build address from available tags
      let address: string | undefined = '';
      if (tags['addr:housenumber']) address += tags['addr:housenumber'] + ' ';
      if (tags['addr:street']) address += tags['addr:street'];
      if (tags['addr:suburb']) address += ', ' + tags['addr:suburb'];
      if (tags['addr:city']) address += ', ' + tags['addr:city'];
      if (tags['addr:postcode']) address += ' ' + tags['addr:postcode'];
      address = address.trim() || undefined;
      
      const isEmergency = tags.emergency === 'yes';
      
      return {
        name,
        distance: distance.toFixed(1),
        lat: coords.lat,
        lon: coords.lon,
        phone: phone ? phone.replace(/;/g, ', ') : undefined,
        address,
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}`,
        isEmergency,
      };
    });

  // For hospitals, prioritize emergency facilities, then sort by distance
  if (filterType === 'hospital') {
    places.sort((a, b) => {
      // Emergency hospitals first
      if (a.isEmergency && !b.isEmergency) return -1;
      if (!a.isEmergency && b.isEmergency) return 1;
      // Then by distance
      return parseFloat(a.distance) - parseFloat(b.distance);
    });
  } else {
    places.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
  }
  
  return places;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  const targetLat = parseFloat(lat);
  const targetLon = parseFloat(lon);
  const radius = 100000; // 100km radius for rural WA

  try {
    // Search for hospitals/medical centres with emergency services
    const hospitalQuery = `
      node["amenity"="hospital"](around:${radius},${targetLat},${targetLon});
      way["amenity"="hospital"](around:${radius},${targetLat},${targetLon});
      node["healthcare"="hospital"](around:${radius},${targetLat},${targetLon});
      way["healthcare"="hospital"](around:${radius},${targetLat},${targetLon});
    `;
    
    // Search for toilets
    const toiletQuery = `
      node["amenity"="toilets"](around:${radius},${targetLat},${targetLon});
      way["amenity"="toilets"](around:${radius},${targetLat},${targetLon});
    `;
    
    // Search for fuel/service stations
    const fuelQuery = `
      node["amenity"="fuel"](around:${radius},${targetLat},${targetLon});
      way["amenity"="fuel"](around:${radius},${targetLat},${targetLon});
    `;

    // Run searches in parallel
    const [hospitalElements, toiletElements, fuelElements] = await Promise.all([
      searchOverpass(targetLat, targetLon, hospitalQuery),
      searchOverpass(targetLat, targetLon, toiletQuery),
      searchOverpass(targetLat, targetLon, fuelQuery),
    ]);

    const hospitals = processPlaces(hospitalElements, targetLat, targetLon, 'hospital');
    const toilets = processPlaces(toiletElements, targetLat, targetLon, 'other');
    const fuelStations = processPlaces(fuelElements, targetLat, targetLon, 'fuel');

    const result: PlacesResult = {
      hospital: hospitals[0] || null,
      toilet: toilets[0] || null,
      fuelStation: fuelStations[0] || null,
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
  }
}
