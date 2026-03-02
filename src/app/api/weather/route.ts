import { NextResponse } from 'next/server';

interface WeatherResponse {
  latitude: number;
  longitude: number;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
  daily: {
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    weather_code: number[];
  };
}

interface WeatherData {
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
  forecast: Array<{
    time: string;
    temp: number;
    windSpeed: number;
    windDir: string;
    condition: string;
  }>;
}

// Convert wind direction degrees to cardinal
function windDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Convert WMO weather code to description
function weatherCodeToText(code: number): string {
  const codes: Record<number, string> = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Heavy freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Light showers',
    81: 'Showers',
    82: 'Heavy showers',
    85: 'Light snow showers',
    86: 'Snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm + hail',
    99: 'Heavy thunderstorm + hail',
  };
  return codes[code] || 'Unknown';
}

// Convert UTC time to Western Australian Time (AWST = UTC+8)
function toWATime(utcString: string): string {
  const utcDate = new Date(utcString);
  // WA is UTC+8, no daylight saving
  const waTime = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
  return waTime.toLocaleTimeString('en-AU', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

// Format sunrise/sunset time
function formatSunTime(utcString: string): string {
  const utcDate = new Date(utcString);
  const waTime = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
  return waTime.toLocaleTimeString('en-AU', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

// Calculate daylight hours
function calculateDaylightHours(sunrise: string, sunset: string): string {
  const sunriseDate = new Date(sunrise);
  const sunsetDate = new Date(sunset);
  const diffMs = sunsetDate.getTime() - sunriseDate.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// Get UV level description
function getUvLevel(uvIndex: number): string {
  if (uvIndex <= 2) return 'Low';
  if (uvIndex <= 5) return 'Moderate';
  if (uvIndex <= 7) return 'High';
  if (uvIndex <= 10) return 'Very High';
  return 'Extreme';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  try {
    // Get current time and next 8 hours
    const now = new Date();
    const endDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    
    const startDateStr = now.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch weather with daily sunrise/sunset/UV
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&daily=sunrise,sunset,uv_index_max&start_date=${startDateStr}&end_date=${endDateStr}&timezone=UTC&wind_speed_unit=kmh`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Weather API failed');
    }

    const data: WeatherResponse = await response.json();

    // Get location name via reverse geocoding
    let locationName = 'Wheatbelt, WA';
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
      const geoResponse = await fetch(geoUrl, {
        headers: { 'User-Agent': 'WheatbeltRoadLocator/1.0' }
      });
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        const address = geoData.address || {};
        locationName = address.city || address.town || address.village || address.hamlet || address.county || 'Wheatbelt, WA';
        if (address.state) {
          locationName += ', ' + address.state;
        }
      }
    } catch {
      // Keep default location name
    }

    // Get next 8 hours forecast in WA time
    const currentHourUTC = new Date().toISOString().slice(0, 13) + ':00';
    const forecast: Array<{
      time: string;
      temp: number;
      windSpeed: number;
      windDir: string;
      condition: string;
    }> = [];
    
    for (let i = 0; i < 8; i++) {
      const targetTime = new Date(currentHourUTC);
      targetTime.setHours(targetTime.getHours() + i);
      const targetStr = targetTime.toISOString().slice(0, 13) + ':00';
      
      const hourIndex = data.hourly.time.findIndex(t => t === targetStr);

      if (hourIndex !== -1) {
        forecast.push({
          time: toWATime(data.hourly.time[hourIndex]),
          temp: Math.round(data.hourly.temperature_2m[hourIndex]),
          windSpeed: Math.round(data.hourly.wind_speed_10m[hourIndex]),
          windDir: windDirection(data.hourly.wind_direction_10m[hourIndex]),
          condition: weatherCodeToText(data.hourly.weather_code[hourIndex]),
        });
      }
    }

    // Process sunrise/sunset/UV data
    const sunData = {
      sunrise: data.daily.sunrise[0] ? formatSunTime(data.daily.sunrise[0]) : 'N/A',
      sunset: data.daily.sunset[0] ? formatSunTime(data.daily.sunset[0]) : 'N/A',
      daylightHours: data.daily.sunrise[0] && data.daily.sunset[0] 
        ? calculateDaylightHours(data.daily.sunrise[0], data.daily.sunset[0]) 
        : 'N/A',
      uvIndex: data.daily.uv_index_max[0] || 0,
      uvLevel: getUvLevel(data.daily.uv_index_max[0] || 0),
    };

    const weatherData: WeatherData = {
      location: locationName,
      current: {
        temp: Math.round(data.current.temperature_2m),
        humidity: data.current.relative_humidity_2m,
        windSpeed: Math.round(data.current.wind_speed_10m),
        windDir: windDirection(data.current.wind_direction_10m),
        windGust: Math.round(data.current.wind_gusts_10m),
        condition: weatherCodeToText(data.current.weather_code),
      },
      sun: sunData,
      forecast,
    };

    return NextResponse.json(weatherData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}
