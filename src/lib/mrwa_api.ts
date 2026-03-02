/**
 * Main Roads WA ArcGIS API Integration
 * 
 * This module provides functions to:
 * 1. Get GPS coordinates for a road at a specific SLK
 * 2. Find intersecting roads within a TC zone
 * 
 * TC Zone Definition:
 * - If only slk_start provided: TC Zone = slk_start - 0.1 to slk_start + 0.1
 * - If slk_start and slk_end provided: TC Zone = slk_start - 0.1 to slk_end + 0.1
 */

// API endpoints
const STATE_ROAD_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/24/query";
const LOCAL_ROAD_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/25/query";
const ALL_ROADS_URL = "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer/17/query"; // Layer 17 has RA_NAME for all roads

// ============================================================
// TYPES
// ============================================================

export interface IntersectionNode {
  nodeNo: string;
  nodeName: string;
  slkOnRefRoad: number;
  hasConnectedRoad: boolean;
  connectedRoadId?: string;
  lat: number;
  lon: number;
}

export interface IntersectingRoad {
  roadId: string;
  roadName: string;
  slkStart: number;
  slkEnd: number;
  region: string;
  source: string;
  intersectionNode?: string;
  intersectionSlk: number;
  lat: number;
  lon: number;
}

export interface GpsCoordinate {
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
}

export interface RoadInfo {
  roadId: string;
  roadName: string;
  slkStart: number;
  slkEnd: number;
  region: string;
}

export interface TcZoneResult {
  referenceRoad: RoadInfo;
  tcZone: {
    startSlk: number;
    endSlk: number;
    startCoord: { lat: number; lon: number } | null;
    endCoord: { lat: number; lon: number } | null;
  };
  workZone?: {
    startSlk: number;
    endSlk: number;
  };
  intersectingRoads: IntersectingRoad[];
  intersectionNodes: IntersectionNode[];
}

export interface GpsResult {
  roadId: string;
  roadName: string;
  slk: number;
  region: string;
  coordinate: GpsCoordinate;
}

// ============================================================
// CORE FUNCTIONS
// ============================================================

async function fetchArcGIS(baseUrl: string, params: Record<string, string>): Promise<any> {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  const response = await fetch(url.toString());
  return response.json();
}

function getGeometryBounds(features: any[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const feature of features) {
    const geom = feature.geometry;
    if (geom?.paths) {
      for (const path of geom.paths) {
        for (const point of path) {
          if (point[0] < minX) minX = point[0];
          if (point[1] < minY) minY = point[1];
          if (point[0] > maxX) maxX = point[0];
          if (point[1] > maxY) maxY = point[1];
        }
      }
    }
  }
  
  return { minX, minY, maxX, maxY };
}

function interpolateGpsFromGeometry(
  geometry: any,
  segmentStartSlk: number,
  segmentEndSlk: number,
  targetSlk: number
): { lat: number; lon: number } | null {
  if (!geometry?.paths || geometry.paths.length === 0) return null;
  
  const path = geometry.paths[0];
  if (path.length < 2) return null;
  
  const slkRange = segmentEndSlk - segmentStartSlk;
  if (slkRange <= 0) return null;
  
  const distances: number[] = [0];
  let totalDistance = 0;
  
  for (let i = 1; i < path.length; i++) {
    const [lon1, lat1] = path[i - 1];
    const [lon2, lat2] = path[i];
    totalDistance += Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
    distances.push(totalDistance);
  }
  
  if (totalDistance === 0) {
    return { lat: path[0][1], lon: path[0][0] };
  }
  
  const ratio = (targetSlk - segmentStartSlk) / slkRange;
  const targetDistance = ratio * totalDistance;
  
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= targetDistance || i === distances.length - 1) {
      const segRatio = distances[i] === distances[i - 1] ? 0 : 
        (targetDistance - distances[i - 1]) / (distances[i] - distances[i - 1]);
      
      const [lon1, lat1] = path[i - 1];
      const [lon2, lat2] = path[i];
      
      return {
        lon: lon1 + (lon2 - lon1) * segRatio,
        lat: lat1 + (lat2 - lat1) * segRatio
      };
    }
  }
  
  return { lat: path[path.length - 1][1], lon: path[path.length - 1][0] };
}

/**
 * Get GPS coordinates for a specific SLK on a feature
 */
function getGpsForFeatureSlk(features: any[], targetSlk: number): { lat: number; lon: number } | null {
  for (const f of features) {
    if (targetSlk >= f.attributes.START_SLK && targetSlk <= f.attributes.END_SLK) {
      return interpolateGpsFromGeometry(f.geometry, f.attributes.START_SLK, f.attributes.END_SLK, targetSlk);
    }
  }
  return null;
}

// ============================================================
// PUBLIC API FUNCTIONS
// ============================================================

/**
 * Get GPS coordinates for a road at a specific SLK
 */
export async function getGpsForSlk(roadId: string, slk: number): Promise<GpsResult | null> {
  const query = {
    where: `ROAD = '${roadId}' AND START_SLK <= ${slk} AND END_SLK >= ${slk}`,
    outFields: "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME",
    returnGeometry: "true",
    f: "json"
  };
  
  const result = await fetchArcGIS(STATE_ROAD_URL, query);
  
  if (!result.features || result.features.length === 0) {
    return null;
  }
  
  const feature = result.features[0];
  const attrs = feature.attributes;
  const coords = interpolateGpsFromGeometry(feature.geometry, attrs.START_SLK, attrs.END_SLK, slk);
  
  if (!coords) return null;
  
  return {
    roadId: attrs.ROAD,
    roadName: attrs.ROAD_NAME,
    slk: slk,
    region: attrs.RA_NAME,
    coordinate: {
      latitude: coords.lat,
      longitude: coords.lon,
      googleMapsUrl: `https://www.google.com/maps?q=${coords.lat},${coords.lon}`
    }
  };
}

/**
 * Find roads intersecting within the TC zone
 * 
 * TC Zone Definition:
 * - If only slkStart provided: TC Zone = slkStart - 0.1 to slkStart + 0.1
 * - If slkStart and slkEnd provided: TC Zone = slkStart - 0.1 to slkEnd + 0.1
 * 
 * Intersections are only found WITHIN the TC zone
 * Supports both State Roads (H/M prefix) and Local Roads
 */
export async function findIntersectingRoads(
  roadId: string,
  slkStart: number,
  slkEnd?: number
): Promise<TcZoneResult | null> {
  
  // Calculate TC Zone boundaries
  const tcStartSlk = slkStart - 0.1;
  const tcEndSlk = slkEnd !== undefined ? slkEnd + 0.1 : slkStart + 0.1;
  
  // Determine if this is a state road (H/M prefix) or local road
  const isStateRoad = roadId.startsWith('H') || roadId.startsWith('M');
  
  // Get reference road geometry and nodes within TC zone
  // Use Layer 18 (All Roads) for local roads, Layer 24 for state roads
  const roadLayerUrl = isStateRoad ? STATE_ROAD_URL : ALL_ROADS_URL;
  
  const refQuery = {
    where: `ROAD = '${roadId}' AND START_SLK < ${tcEndSlk} AND END_SLK > ${tcStartSlk}`,
    outFields: isStateRoad 
      ? "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME,START_NODE_NO,START_NODE_NAME,END_NODE_NO,END_NODE_NAME"
      : "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME,NETWORK_TYPE",
    returnGeometry: "true",
    f: "json"
  };
  
  let refResult = await fetchArcGIS(roadLayerUrl, refQuery);
  
  // If not found in expected layer, try the other layer
  if (!refResult.features || refResult.features.length === 0) {
    const fallbackUrl = isStateRoad ? ALL_ROADS_URL : STATE_ROAD_URL;
    refResult = await fetchArcGIS(fallbackUrl, refQuery);
  }
  
  if (!refResult.features || refResult.features.length === 0) {
    return null;
  }
  
  // Extract road info
  const refAttrs = refResult.features[0].attributes;
  const actualSlkStart = Math.min(...refResult.features.map((f: any) => f.attributes.START_SLK));
  const actualSlkEnd = Math.max(...refResult.features.map((f: any) => f.attributes.END_SLK));
  
  const referenceRoad: RoadInfo = {
    roadId: refAttrs.ROAD,
    roadName: refAttrs.ROAD_NAME,
    slkStart: actualSlkStart,
    slkEnd: actualSlkEnd,
    region: refAttrs.RA_NAME || 'Local'
  };
  
  // Get TC zone coordinates
  const tcStartCoord = getGpsForFeatureSlk(refResult.features, tcStartSlk);
  const tcEndCoord = getGpsForFeatureSlk(refResult.features, tcEndSlk);
  
  // Get bounding box for spatial queries
  const bounds = getGeometryBounds(refResult.features);
  const buffer = 0.002; // ~200m buffer
  const bbox = `${bounds.minX - buffer},${bounds.minY - buffer},${bounds.maxX + buffer},${bounds.maxY + buffer}`;
  
  // Find intersecting roads
  const intersectingRoads: IntersectingRoad[] = [];
  const intersectionNodes: IntersectionNode[] = [];
  const addedRoads = new Set<string>();
  
  if (isStateRoad) {
    // STATE ROAD: Use node-based intersection detection
    
    // Extract intersection nodes WITHIN TC zone only
    const nodeMap = new Map<string, { name: string; slk: number }>();
    
    for (const f of refResult.features) {
      const attrs = f.attributes;
      
      // Only include nodes that fall WITHIN the TC zone (between tcStartSlk and tcEndSlk)
      if (attrs.START_SLK >= tcStartSlk && attrs.START_SLK <= tcEndSlk) {
        if (attrs.START_NODE_NO) {
          nodeMap.set(attrs.START_NODE_NO, { name: attrs.START_NODE_NAME, slk: attrs.START_SLK });
        }
      }
      if (attrs.END_SLK >= tcStartSlk && attrs.END_SLK <= tcEndSlk) {
        if (attrs.END_NODE_NO) {
          nodeMap.set(attrs.END_NODE_NO, { name: attrs.END_NODE_NAME, slk: attrs.END_SLK });
        }
      }
    }
    
    const nodeNumbers = Array.from(nodeMap.keys());
    const nodesWithRoads = new Map<string, string>();
    
    // Method 1: Node-based matching (most accurate - finds roads sharing intersection nodes)
    if (nodeNumbers.length > 0) {
      const nodeQuery = {
        where: `START_NODE_NO IN ('${nodeNumbers.join("','")}') OR END_NODE_NO IN ('${nodeNumbers.join("','")}')`,
        outFields: "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME,START_NODE_NO,END_NODE_NO",
        returnGeometry: "false",
        f: "json",
        resultRecordCount: "2000"
      };
      
      const nodeResult = await fetchArcGIS(STATE_ROAD_URL, nodeQuery);
      if (nodeResult.features) {
        for (const f of nodeResult.features) {
          const attrs = f.attributes;
          if (attrs.ROAD === roadId) continue;
          
          const key = attrs.ROAD;
          if (addedRoads.has(key)) continue;
          addedRoads.add(key);
          
          const nodeNo = nodeNumbers.includes(attrs.START_NODE_NO) 
            ? attrs.START_NODE_NO 
            : attrs.END_NODE_NO;
          const nodeInfo = nodeMap.get(nodeNo)!;
          
          // Get GPS for intersection
          const gps = getGpsForFeatureSlk(refResult.features, nodeInfo.slk);
          
          intersectingRoads.push({
            roadId: attrs.ROAD,
            roadName: attrs.ROAD_NAME,
            slkStart: attrs.START_SLK,
            slkEnd: attrs.END_SLK,
            region: attrs.RA_NAME,
            source: 'State Road Network',
            intersectionNode: nodeInfo.name,
            intersectionSlk: nodeInfo.slk,
            lat: gps?.lat || 0,
            lon: gps?.lon || 0
          });
          
          nodesWithRoads.set(nodeNo, attrs.ROAD);
        }
      }
    }
    
    // Method 2: Search for local roads by intersection node name
    for (const [nodeNo, info] of nodeMap) {
      const nodeName = info.name;
      
      // Skip generic node names
      if (nodeName.includes('Start') || nodeName.includes('End') || 
          nodeName.includes('Slip') || nodeName.includes('Dual') ||
          nodeName.includes('Link Rd') || nodeName.includes('Great Eastern Hwy')) {
        continue;
      }
      
      // Get GPS for this intersection
      const gps = getGpsForFeatureSlk(refResult.features, info.slk);
      
      // Search for local roads matching this node name
      const cleanName = nodeName.replace(' Slip Rd', '').replace(' Link Rd', '').split(' & ')[0].trim();
      
      // Try multiple search patterns
      const searchPatterns = [
        `ROAD_NAME LIKE '%${cleanName}%'`,
        `ROAD_NAME LIKE '%${cleanName.replace(/ /g, '%')}%'`,
      ];
      
      let foundRoad = nodesWithRoads.has(nodeNo);
      
      for (const pattern of searchPatterns) {
        if (foundRoad) break;
        
        const nameQuery = {
          where: pattern,
          outFields: "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME",
          returnGeometry: "false",
          f: "json",
          resultRecordCount: "50"
        };
        
        try {
          const localResult = await fetchArcGIS(LOCAL_ROAD_URL, nameQuery);
          if (localResult.features && localResult.features.length > 0) {
            for (const f of localResult.features) {
              if (addedRoads.has(f.attributes.ROAD)) continue;
              // Check if the road name actually matches
              const roadName = f.attributes.ROAD_NAME.toLowerCase();
              if (roadName.includes(cleanName.toLowerCase())) {
                addedRoads.add(f.attributes.ROAD);
                
                intersectingRoads.push({
                  roadId: f.attributes.ROAD,
                  roadName: f.attributes.ROAD_NAME,
                  slkStart: f.attributes.START_SLK,
                  slkEnd: f.attributes.END_SLK,
                  region: f.attributes.RA_NAME,
                  source: 'Local Road Network',
                  intersectionNode: nodeName,
                  intersectionSlk: info.slk,
                  lat: gps?.lat || 0,
                  lon: gps?.lon || 0
                });
                
                nodesWithRoads.set(nodeNo, f.attributes.ROAD);
                foundRoad = true;
              }
            }
          }
        } catch (e) {
          // Local road layer might not be available
        }
      }
      
      // Add intersection node (even if no road found)
      intersectionNodes.push({
        nodeNo,
        nodeName,
        slkOnRefRoad: info.slk,
        hasConnectedRoad: nodesWithRoads.has(nodeNo),
        connectedRoadId: nodesWithRoads.get(nodeNo),
        lat: gps?.lat || 0,
        lon: gps?.lon || 0
      });
    }
  } else {
    // LOCAL ROAD: Use spatial intersection detection
    
    // Query Layer 18 for all roads that spatially intersect with the TC zone
    const spatialQuery = {
      geometry: bbox,
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: "ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME,NETWORK_TYPE",
      returnGeometry: "true",
      f: "json",
      resultRecordCount: "200"
    };
    
    try {
      const spatialResult = await fetchArcGIS(ALL_ROADS_URL, spatialQuery);
      
      if (spatialResult.features) {
        for (const f of spatialResult.features) {
          const attrs = f.attributes;
          if (attrs.ROAD === roadId) continue;
          if (addedRoads.has(attrs.ROAD)) continue;
          
          // Check if this road actually intersects with the reference road geometry
          // For simplicity, we check if any part of the road is within the TC zone bounds
          const roadGeom = f.geometry;
          if (roadGeom?.paths) {
            let intersects = false;
            let intersectionLon = 0, intersectionLat = 0;
            
            for (const path of roadGeom.paths) {
              for (const point of path) {
                if (point[0] >= bounds.minX - buffer && point[0] <= bounds.maxX + buffer &&
                    point[1] >= bounds.minY - buffer && point[1] <= bounds.maxY + buffer) {
                  intersects = true;
                  intersectionLon = point[0];
                  intersectionLat = point[1];
                  break;
                }
              }
              if (intersects) break;
            }
            
            if (intersects) {
              // Calculate approximate SLK on reference road for this intersection
              // Find closest point on reference road
              let minDist = Infinity;
              let closestSlk = slkStart;
              
              for (const refF of refResult.features) {
                const refGeom = refF.geometry;
                if (!refGeom?.paths) continue;
                
                for (const path of refGeom.paths) {
                  for (let i = 0; i < path.length; i++) {
                    const dist = Math.sqrt(
                      Math.pow(path[i][0] - intersectionLon, 2) + 
                      Math.pow(path[i][1] - intersectionLat, 2)
                    );
                    if (dist < minDist) {
                      minDist = dist;
                      // Interpolate SLK
                      const startSlk = refF.attributes.START_SLK;
                      const endSlk = refF.attributes.END_SLK;
                      // Simplified: use midpoint of segment
                      closestSlk = (startSlk + endSlk) / 2;
                    }
                  }
                }
              }
              
              addedRoads.add(attrs.ROAD);
              
              intersectingRoads.push({
                roadId: attrs.ROAD,
                roadName: attrs.ROAD_NAME,
                slkStart: attrs.START_SLK,
                slkEnd: attrs.END_SLK,
                region: attrs.RA_NAME || 'Local',
                source: attrs.NETWORK_TYPE || 'Local Road Network',
                intersectionSlk: closestSlk,
                lat: intersectionLat,
                lon: intersectionLon
              });
              
              // Add as intersection node
              intersectionNodes.push({
                nodeNo: attrs.ROAD,
                nodeName: attrs.ROAD_NAME,
                slkOnRefRoad: closestSlk,
                hasConnectedRoad: true,
                connectedRoadId: attrs.ROAD,
                lat: intersectionLat,
                lon: intersectionLon
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Spatial intersection query failed:', e);
    }
  }
  
  // Sort results
  intersectingRoads.sort((a, b) => a.intersectionSlk - b.intersectionSlk);
  intersectionNodes.sort((a, b) => a.slkOnRefRoad - b.slkOnRefRoad);
  
  return {
    referenceRoad,
    tcZone: {
      startSlk: tcStartSlk,
      endSlk: tcEndSlk,
      startCoord: tcStartCoord,
      endCoord: tcEndCoord
    },
    workZone: slkEnd !== undefined ? { startSlk: slkStart, endSlk: slkEnd } : undefined,
    intersectingRoads,
    intersectionNodes
  };
}

/**
 * Get a list of all available roads
 */
export async function listRoads(): Promise<{ roadId: string; roadName: string }[]> {
  const query = {
    where: "ROAD LIKE 'H%' OR ROAD LIKE 'M%'",
    outFields: "ROAD,ROAD_NAME",
    returnGeometry: "false",
    f: "json",
    resultRecordCount: "2000",
    orderByFields: "ROAD"
  };
  
  const result = await fetchArcGIS(STATE_ROAD_URL, query);
  
  if (!result.features) return [];
  
  const seen = new Set<string>();
  const roads: { roadId: string; roadName: string }[] = [];
  
  for (const f of result.features) {
    if (!seen.has(f.attributes.ROAD)) {
      seen.add(f.attributes.ROAD);
      roads.push({
        roadId: f.attributes.ROAD,
        roadName: f.attributes.ROAD_NAME
      });
    }
  }
  
  return roads.sort((a, b) => a.roadId.localeCompare(b.roadId, undefined, { numeric: true }));
}
