import { NextResponse } from 'next/server';

interface ExportRequest {
  road_id: string;
  road_name: string;
  work_zone: {
    start_slk: number;
    end_slk: number;
    length_m: number;
  };
  tc_positions: {
    start_slk: number;
    end_slk: number;
  };
  speed_zones: {
    approach_start: string;
    tc_start: string;
    work_zone_start: string;
    work_zone_end: string;
    tc_end: string;
    approach_end: string;
  };
  carriageway: string;
  weather?: {
    location: string;
    current: {
      temp: number;
      humidity: number;
      windSpeed: number;
      windDir: string;
      windGust: number;
      condition: string;
    };
    sun: {
      sunrise: string;
      sunset: string;
      daylightHours: string;
      uvIndex: number;
      uvLevel: string;
    };
  };
  traffic?: {
    aadt: number;
    aadt_year?: string;
    heavy_vehicle_percent: number;
    peak_hour_volume: number;
    source: string;
    distance_to_site?: number;
    nearest_sites?: Array<{
      location: string;
      aadt: number;
      distance_km: number | null;
    }>;
  };
  side_roads?: Array<{
    name: string;
    distance: string;
    roadType: string;
  }>;
  amenities?: {
    hospital?: { name: string; distance: string };
    fuelStation?: { name: string; distance: string };
    toilet?: { name: string; distance: string };
  };
}

export async function POST(request: Request) {
  try {
    const data: ExportRequest = await request.json();
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-AU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    const timeStr = now.toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });

    // Generate plain text report (no special characters)
    const lines: string[] = [];
    
    lines.push('================================================================');
    lines.push('                    TC WORK ZONE REPORT');
    lines.push('================================================================');
    lines.push('');
    lines.push(`Generated: ${dateStr} at ${timeStr} (AWST)`);
    lines.push('');
    lines.push('----------------------------------------------------------------');
    lines.push('ROAD INFORMATION');
    lines.push('----------------------------------------------------------------');
    lines.push(`Road ID:           ${data.road_id}`);
    lines.push(`Road Name:         ${data.road_name}`);
    lines.push(`Carriageway:       ${data.carriageway}`);
    lines.push('');
    lines.push('----------------------------------------------------------------');
    lines.push('WORK ZONE DETAILS');
    lines.push('----------------------------------------------------------------');
    lines.push(`Start SLK:         ${data.work_zone.start_slk.toFixed(2)} km`);
    lines.push(`End SLK:           ${data.work_zone.end_slk.toFixed(2)} km`);
    lines.push(`Zone Length:       ${data.work_zone.length_m} m`);
    lines.push('');
    lines.push('----------------------------------------------------------------');
    lines.push('TC POSITIONS (+/- 100m from work zone)');
    lines.push('----------------------------------------------------------------');
    lines.push(`TC Start:          SLK ${data.tc_positions.start_slk.toFixed(2)} km`);
    lines.push(`TC End:            SLK ${data.tc_positions.end_slk.toFixed(2)} km`);
    lines.push('');
    lines.push('----------------------------------------------------------------');
    lines.push('SPEED ZONES');
    lines.push('----------------------------------------------------------------');
    lines.push(`Reinstatement Signs (Start):  ${data.speed_zones.approach_start}`);
    lines.push(`TC Position (Start):          ${data.speed_zones.tc_start}`);
    lines.push(`Work Zone:                    ${data.speed_zones.work_zone_start}`);
    lines.push(`TC Position (End):            ${data.speed_zones.tc_end}`);
    lines.push(`Reinstatement Signs (End):    ${data.speed_zones.approach_end}`);
    lines.push('');
    
    if (data.traffic) {
      lines.push('----------------------------------------------------------------');
      lines.push('TRAFFIC VOLUME');
      lines.push('----------------------------------------------------------------');
      lines.push(`AADT:              ${data.traffic.aadt?.toLocaleString() || 'N/A'} vehicles/day`);
      lines.push(`Data Year:         ${data.traffic.aadt_year || 'N/A'}`);
      lines.push(`Heavy Vehicles:    ${data.traffic.heavy_vehicle_percent}%`);
      lines.push(`Peak Hour (est.):  ${data.traffic.peak_hour_volume || 'N/A'} vehicles/hr`);
      if (data.traffic.distance_to_site !== undefined) {
        lines.push(`Distance to Site:  ${data.traffic.distance_to_site} km from work zone`);
      }
      lines.push(`Source:            ${data.traffic.source}`);
      lines.push('');
      
      if (data.traffic.nearest_sites && data.traffic.nearest_sites.length > 1) {
        lines.push('Other nearby count sites:');
        for (const site of data.traffic.nearest_sites.slice(1, 4)) {
          lines.push(`  - ${site.location}: ${site.aadt?.toLocaleString()} v/d (${site.distance_km} km)`);
        }
        lines.push('');
      }
    }
    
    if (data.weather) {
      lines.push('----------------------------------------------------------------');
      lines.push('WEATHER & SUN');
      lines.push('----------------------------------------------------------------');
      lines.push(`Location:          ${data.weather.location}`);
      lines.push(`Condition:         ${data.weather.current.condition}`);
      lines.push(`Temperature:       ${data.weather.current.temp} C`);
      lines.push(`Humidity:          ${data.weather.current.humidity}%`);
      lines.push(`Wind:              ${data.weather.current.windSpeed} km/h ${data.weather.current.windDir}`);
      lines.push(`Wind Gusts:        ${data.weather.current.windGust} km/h`);
      lines.push('');
      lines.push(`Sunrise:           ${data.weather.sun.sunrise}`);
      lines.push(`Sunset:            ${data.weather.sun.sunset}`);
      lines.push(`Daylight Hours:    ${data.weather.sun.daylightHours}`);
      lines.push(`UV Index:          ${data.weather.sun.uvIndex} (${data.weather.sun.uvLevel})`);
      lines.push('');
    }
    
    if (data.side_roads && data.side_roads.length > 0) {
      lines.push('----------------------------------------------------------------');
      lines.push('SIDE ROADS IN TC ZONE');
      lines.push('----------------------------------------------------------------');
      for (const road of data.side_roads) {
        lines.push(`* ${road.name} (${road.roadType}) - SLK ${road.distance}`);
      }
      lines.push('');
      lines.push('NOTE: Consider TC coverage for these intersecting roads');
      lines.push('');
    }
    
    if (data.amenities) {
      lines.push('----------------------------------------------------------------');
      lines.push('NEARBY AMENITIES');
      lines.push('----------------------------------------------------------------');
      if (data.amenities.hospital) {
        lines.push(`Hospital:          ${data.amenities.hospital.name} (${data.amenities.hospital.distance} km)`);
      } else {
        lines.push('Hospital:          None within 100km');
      }
      if (data.amenities.fuelStation) {
        lines.push(`Fuel Station:      ${data.amenities.fuelStation.name} (${data.amenities.fuelStation.distance} km)`);
      } else {
        lines.push('Fuel Station:      None within 100km');
      }
      if (data.amenities.toilet) {
        lines.push(`Toilet:            ${data.amenities.toilet.name} (${data.amenities.toilet.distance} km)`);
      } else {
        lines.push('Toilet:            None within 100km');
      }
      lines.push('');
    }
    
    lines.push('================================================================');
    lines.push('Created by John Jarrett using Z.AI');
    lines.push('Sources: Main Roads WA GIS | Open-Meteo | OpenStreetMap');
    lines.push('================================================================');

    const report = lines.join('\n');

    return new NextResponse(report, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="work-zone-${data.road_id}-${data.work_zone.start_slk.toFixed(2)}.txt"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
