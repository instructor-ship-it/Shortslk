const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer, 
        AlignmentType, PageOrientation, LevelFormat, HeadingLevel, BorderStyle, WidthType, 
        ShadingType, VerticalAlign, PageNumber, PageBreak, TableOfContents, ExternalHyperlink } = require('docx');
const fs = require('fs');

// Color palette
const colors = {
  primary: "020617",
  body: "1E293B",
  secondary: "64748B",
  accent: "94A3B8",
  tableBg: "F8FAFC",
  headerBg: "E2E8F0",
};

const tableBorder = { style: BorderStyle.SINGLE, size: 8, color: colors.secondary };
const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Times New Roman", size: 22 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal",
        run: { size: 56, bold: true, color: colors.primary, font: "Times New Roman" },
        paragraph: { spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: colors.primary, font: "Times New Roman" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: colors.body, font: "Times New Roman" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: colors.secondary, font: "Times New Roman" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullet-list",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
    },
    headers: {
      default: new Header({ children: [new Paragraph({ 
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "TC SLK - Data Query Sources", size: 18, color: colors.secondary })]
      })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ 
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Page ", size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 }), new TextRun({ text: " of ", size: 18 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 })]
      })] })
    },
    children: [
      // Cover Page
      new Paragraph({ spacing: { before: 2400 } }),
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("TC SLK")] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "Data Query Sources Documentation", size: 36, bold: true, color: colors.secondary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: "Complete Reference for All Data APIs and Sources", size: 24, color: colors.body })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 800 }, children: [new TextRun({ text: "Version: RC 1.0", size: 22, color: colors.secondary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [new TextRun({ text: "Date: March 1, 2026", size: 22, color: colors.secondary })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // Table of Contents
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Table of Contents")] }),
      new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "Note: Right-click the Table of Contents and select 'Update Field' to refresh page numbers.", size: 18, color: "999999", italics: true })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // Section 1: Overview
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. Overview")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("TC SLK integrates data from multiple sources to provide comprehensive work zone information for Traffic Controllers in Western Australia. This document details all data sources, their API endpoints, query parameters, data structures, and how they are used within the application. Understanding these sources is essential for troubleshooting, maintenance, and future enhancements.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.1 Data Source Categories")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("The application uses three main categories of data sources:")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun({ text: "MRWA ArcGIS Services", bold: true }), new TextRun(" - Official road network, speed zones, rail crossings, and signage data from Main Roads Western Australia")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun({ text: "External Weather APIs", bold: true }), new TextRun(" - Open-Meteo for weather forecasts and BOM for weather warnings")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun({ text: "OpenStreetMap Services", bold: true }), new TextRun(" - Overpass API for amenities and Nominatim for geocoding")] }),

      // Section 2: MRWA ArcGIS Services
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. Main Roads WA ArcGIS Services")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("Main Roads Western Australia (MRWA) provides open access to their road data through an ArcGIS REST API. This is the primary data source for all road-related information. The base URL for all MRWA queries is:")] }),

      new Paragraph({ shading: { fill: "F1F5F9", type: ShadingType.CLEAR }, spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "https://gisservices.mainroads.wa.gov.au/arcgis/rest/services/OpenData/RoadAssets_DataPortal/MapServer", font: "Courier New", size: 18 })
      ]}),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 Available Layers")] }),
      createMrwaLayersTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.2 Layer 17 - Road Network (All Roads)")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Layer 17 is the primary road network layer containing geometry and attributes for all roads in WA, including state highways, main roads, and local roads. This is the most comprehensive layer with region (RA_NAME) information for all roads.")] }),
      createLayer17Table(),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Query Example - Get Road by ID")] }),
      new Paragraph({ shading: { fill: "F1F5F9", type: ShadingType.CLEAR }, spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "GET /17/query?where=ROAD='H005'&outFields=ROAD,ROAD_NAME,START_SLK,END_SLK,RA_NAME&returnGeometry=true&f=json", font: "Courier New", size: 16 })
      ]}),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.3 Layer 24 - State Road Network")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Layer 24 contains state roads only (H and M prefix roads) with additional node information for intersection detection. Used for finding intersection nodes with START_NODE_NO and END_NODE_NO fields.")] }),
      createLayer24Table(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.4 Layer 8 - Legal Speed Limit")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Layer 8 contains legal speed zones with the SPEED_LIMIT field containing actual speed values or descriptive text for default zones. This layer is used for speed zone lookahead and corridor signage reporting.")] }),
      createLayer8Table(),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Speed Limit Parsing Logic")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("The SPEED_LIMIT field can contain:")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Numeric values (e.g., 110, 80, 60)")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Default zone text (e.g., '50km/h applies in built up areas or 110km/h outside built up areas')")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("Default zones are flagged as requires_verification=true and default to 110 km/h. Client-side correction logic adjusts to 50 km/h for built-up areas based on adjacent zones.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.5 Layer 15 - Railway Crossings")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Layer 15 contains all railway crossings on the road network with crossing type (Public/Private) and crossing numbers for contacting Arc Infrastructure.")] }),
      createLayer15Table(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.6 Layer 22 - Regulatory Signs")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Layer 22 contains regulatory signs including speed restriction signs, STOP signs, and GIVE WAY signs. The application filters this layer to only include speed and railway-related signs for the signage corridor report.")] }),
      createLayer22Table(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.7 Layer 23 - Warning Signs")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Layer 23 contains warning signs including curve warnings, advisory speeds, and hazard warnings. The application filters to keep only curves, advisory speeds, signals, and railway-related signs.")] }),
      createLayer23Table(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.8 Layer 27 - Traffic Count Sites")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Layer 27 contains traffic count data from MRWA Traffic Digest. Used for AADT (Annual Average Daily Traffic) and heavy vehicle percentage information.")] }),
      createLayer27Table(),

      // Section 3: Weather APIs
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. Weather APIs")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 Open-Meteo Weather API")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Open-Meteo provides free weather API access without requiring an API key. The application uses this for current conditions, forecasts, and astronomical data.")] }),
      new Paragraph({ shading: { fill: "F1F5F9", type: ShadingType.CLEAR }, spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "Base URL: https://api.open-meteo.com/v1/forecast", font: "Courier New", size: 18 })
      ]}),
      createOpenMeteoTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Query Parameters")] }),
      new Paragraph({ shading: { fill: "F1F5F9", type: ShadingType.CLEAR }, spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&daily=sunrise,sunset,uv_index_max&timezone=UTC&wind_speed_unit=kmh", font: "Courier New", size: 14 })
      ]}),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("WMO Weather Codes")] }),
      createWeatherCodesTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2 BOM Weather Warnings RSS")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("The Bureau of Meteorology (BOM) provides RSS feeds for weather warnings. The application uses the WA Land Areas feed (IDZ00067) for real-time weather alerts.")] }),
      new Paragraph({ shading: { fill: "F1F5F9", type: ShadingType.CLEAR }, spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "RSS URL: https://www.bom.gov.au/fwo/IDZ00067.warnings_wa.xml", font: "Courier New", size: 18 })
      ]}),
      createBomRssTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("RSS Item Structure")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Each warning item in the RSS feed contains:")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("title - Warning title (e.g., 'Severe Weather Warning for Heavy Rainfall')")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("description - Full warning text")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("link - URL to full warning on BOM website")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("pubDate - Publication timestamp")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("category - Warning category")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("urgency - 'Immediate', 'Expected', or 'Future'")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("severity - 'Minor', 'Moderate', 'Severe', or 'Extreme'")] }),

      // Section 4: OpenStreetMap Services
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. OpenStreetMap Services")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.1 Overpass API - Amenities")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("The Overpass API queries OpenStreetMap data for nearby amenities including hospitals, fuel stations, and public toilets. Multiple servers are used with automatic fallback.")] }),
      createOverpassTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Amenity Queries")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("The application searches within 100km radius for rural WA coverage:")] }),
      new Paragraph({ shading: { fill: "F1F5F9", type: ShadingType.CLEAR }, spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "Hospital: node[\"amenity\"=\"hospital\"](around:100000,{lat},{lon});\nFuel: node[\"amenity\"=\"fuel\"](around:100000,{lat},{lon});\nToilets: node[\"amenity\"=\"toilets\"](around:100000,{lat},{lon});", font: "Courier New", size: 16 })
      ]}),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Hospital Filtering")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("Hospitals are filtered to exclude non-emergency medical facilities. Excluded terms: dental, orthodontic, fertility, IVF, day surgery, cosmetic, psychology, counselling, private clinic. Emergency hospitals are prioritized in results.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.2 Nominatim - Reverse Geocoding")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Nominatim provides reverse geocoding to convert coordinates to location names for weather display.")] }),
      new Paragraph({ shading: { fill: "F1F5F9", type: ShadingType.CLEAR }, spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "URL: https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json", font: "Courier New", size: 18 })
      ]}),

      // Section 5: Internal API Routes
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. Internal API Routes")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The application provides internal API routes that aggregate data from multiple sources. These routes are server-side only and do not expose external API keys.")] }),
      createApiRoutesTable(),

      // Section 6: Data Storage
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. Offline Data Storage")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("For offline capability, MRWA data is stored in IndexedDB on the client device. This allows the application to work without internet connectivity in remote areas.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.1 IndexedDB Object Stores")] }),
      createIndexedDbTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.2 Data Flow")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("1. User clicks 'Download Data' in Settings")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("2. Static JSON files from /public/data/ are loaded OR MRWA ArcGIS API is queried directly")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("3. Data is transformed and stored in IndexedDB")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("4. Metadata (download date, record counts) is saved")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("5. Application can now operate offline using stored data")] }),

      // Section 7: Code References
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. Code References")] }),
      createCodeReferenceTable(),

      // Section 8: Rate Limits and Caching
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. Rate Limits and Caching")] }),
      createRateLimitsTable(),
    ]
  }]
});

// Helper functions
function createMrwaLayersTable() {
  return new Table({
    columnWidths: [1000, 3500, 4860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Layer", "Name", "Description"]),
      createTableRow(["17", "Road Network", "All roads with geometry, SLK, and region (RA_NAME)"]),
      createTableRow(["24", "State Road Network", "State roads (H/M prefix) with intersection nodes"]),
      createTableRow(["8", "Legal Speed Limit", "Speed zones with SPEED_LIMIT field"]),
      createTableRow(["15", "Rail Crossings", "Railway crossing locations and types"]),
      createTableRow(["22", "Regulatory Signs", "Speed restriction, STOP, GIVE WAY signs"]),
      createTableRow(["23", "Warning Signs", "Curve, advisory speed, hazard warnings"]),
      createTableRow(["25", "Local Road Network", "Local roads layer"]),
      createTableRow(["27", "Traffic Count Sites", "AADT and heavy vehicle data"]),
    ]
  });
}

function createLayer17Table() {
  return new Table({
    columnWidths: [2500, 6860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Field", "Description"]),
      createTableRow(["ROAD / ROAD_ID", "Unique road identifier (e.g., H005, M031)"]),
      createTableRow(["ROAD_NAME", "Full road name (e.g., Great Eastern Hwy)"]),
      createTableRow(["START_SLK", "Start SLK of road segment"]),
      createTableRow(["END_SLK", "End SLK of road segment"]),
      createTableRow(["RA_NAME", "MRWA region name (e.g., Wheatbelt, Metropolitan)"]),
      createTableRow(["NETWORK_TYPE", "Road type (State Road, Local Road)"]),
      createTableRow(["geometry.paths", "Array of [lon, lat] coordinates"]),
    ]
  });
}

function createLayer24Table() {
  return new Table({
    columnWidths: [2500, 6860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Field", "Description"]),
      createTableRow(["START_NODE_NO", "Intersection node number at segment start"]),
      createTableRow(["START_NODE_NAME", "Intersection name at segment start"]),
      createTableRow(["END_NODE_NO", "Intersection node number at segment end"]),
      createTableRow(["END_NODE_NAME", "Intersection name at segment end"]),
      createTableRow(["CWY", "Carriageway (Left, Right, Single)"]),
    ]
  });
}

function createLayer8Table() {
  return new Table({
    columnWidths: [2500, 6860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Field", "Description"]),
      createTableRow(["SPEED_LIMIT", "Speed limit value or default zone text"]),
      createTableRow(["START_SLK", "Start SLK of speed zone"]),
      createTableRow(["END_SLK", "End SLK of speed zone"]),
      createTableRow(["CWY", "Carriageway direction"]),
    ]
  });
}

function createLayer15Table() {
  return new Table({
    columnWidths: [2500, 6860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Field", "Description"]),
      createTableRow(["CROSSING_TYPE", "Public or Private crossing"]),
      createTableRow(["CROSSING_NO", "Crossing identifier for Arc Infrastructure"]),
      createTableRow(["SLK", "SLK location of crossing"]),
    ]
  });
}

function createLayer22Table() {
  return new Table({
    columnWidths: [2500, 6860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Field", "Description"]),
      createTableRow(["PANEL_DESIGN", "Sign design code (e.g., R4-1)"]),
      createTableRow(["PANEL_MEANING", "Sign meaning text (e.g., 'Speed Limit 60')"]),
      createTableRow(["SIGN_TYPE", "Sign type classification"]),
    ]
  });
}

function createLayer23Table() {
  return new Table({
    columnWidths: [2500, 6860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Field", "Description"]),
      createTableRow(["PANEL_DESIGN", "Warning sign design code"]),
      createTableRow(["PANEL_MEANING", "Warning text (e.g., 'Curve 65 km/h')"]),
      createTableRow(["SIGN_TYPE", "Warning sign type"]),
    ]
  });
}

function createLayer27Table() {
  return new Table({
    columnWidths: [2500, 6860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Field", "Description"]),
      createTableRow(["SITE_NO", "Traffic count site number"]),
      createTableRow(["LOCATION_DESC", "Location description (e.g., 'East of Leeming Rd')"]),
      createTableRow(["TRAFFIC_YEAR", "Year of traffic count"]),
      createTableRow(["MON_SUN", "AADT (Annual Average Daily Traffic)"]),
      createTableRow(["PCT_HEAVY_MON_SUN", "Heavy vehicle percentage"]),
    ]
  });
}

function createOpenMeteoTable() {
  return new Table({
    columnWidths: [3000, 6360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Parameter", "Values"]),
      createTableRow(["current", "temperature_2m, relative_humidity_2m, wind_speed_10m, wind_direction_10m, wind_gusts_10m, weather_code"]),
      createTableRow(["hourly", "temperature_2m, wind_speed_10m, wind_direction_10m, weather_code"]),
      createTableRow(["daily", "sunrise, sunset, uv_index_max"]),
      createTableRow(["wind_speed_unit", "kmh (kilometers per hour)"]),
      createTableRow(["timezone", "UTC (converted to AWST client-side)"]),
    ]
  });
}

function createWeatherCodesTable() {
  return new Table({
    columnWidths: [1500, 4000, 3860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Code", "Condition", "Description"]),
      createTableRow(["0", "Clear", "No clouds"]),
      createTableRow(["1-3", "Cloudy", "Mainly clear to overcast"]),
      createTableRow(["45-48", "Fog", "Fog conditions"]),
      createTableRow(["51-67", "Rain", "Drizzle to heavy rain"]),
      createTableRow(["71-77", "Snow", "Snow conditions"]),
      createTableRow(["80-82", "Showers", "Light to heavy showers"]),
      createTableRow(["95-99", "Storms", "Thunderstorms with possible hail"]),
    ]
  });
}

function createBomRssTable() {
  return new Table({
    columnWidths: [3000, 6360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Property", "Value"]),
      createTableRow(["Feed ID", "IDZ00067"]),
      createTableRow(["Coverage", "Western Australia Land Areas"]),
      createTableRow(["Cache Duration", "5 minutes (300 seconds)"]),
      createTableRow(["User-Agent", "TCWorkZoneLocator/5.3 (WA Traffic Control Application)"]),
    ]
  });
}

function createOverpassTable() {
  return new Table({
    columnWidths: [4000, 5360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Server", "URL"]),
      createTableRow(["Primary", "https://overpass-api.de/api/interpreter"]),
      createTableRow(["Fallback 1", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]),
      createTableRow(["Fallback 2", "https://overpass.kumi.systems/api/interpreter"]),
    ]
  });
}

function createApiRoutesTable() {
  return new Table({
    columnWidths: [2000, 1500, 5860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Route", "Method", "Purpose"]),
      createTableRow(["/api/roads", "GET/POST", "Region list, road search, SLK coordinate lookup"]),
      createTableRow(["/api/gps", "GET", "Convert GPS coordinates to road/SLK"]),
      createTableRow(["/api/weather", "GET", "Weather conditions from Open-Meteo"]),
      createTableRow(["/api/warnings", "GET", "BOM weather warnings RSS feed"]),
      createTableRow(["/api/traffic", "GET", "AADT data from MRWA Layer 27"]),
      createTableRow(["/api/places", "GET", "Nearby amenities from Overpass API"]),
      createTableRow(["/api/intersections", "GET", "Cross road detection using MRWA nodes"]),
      createTableRow(["/api/admin-sync", "GET/POST", "Direct sync from MRWA servers"]),
    ]
  });
}

function createIndexedDbTable() {
  return new Table({
    columnWidths: [2500, 2000, 4860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Store Name", "Key", "Contents"]),
      createTableRow(["regions", "region", "Road data grouped by MRWA region"]),
      createTableRow(["speedZones", "road_id", "Speed zones indexed by road"]),
      createTableRow(["railCrossings", "road_id", "Rail crossings indexed by road"]),
      createTableRow(["regulatorySigns", "road_id", "Filtered regulatory signs"]),
      createTableRow(["warningSigns", "road_id", "Filtered warning signs"]),
      createTableRow(["metadata", "key", "Download date, total roads, regions"]),
      createTableRow(["datasetMeta", "dataset", "Sync status per dataset"]),
    ]
  });
}

function createCodeReferenceTable() {
  return new Table({
    columnWidths: [4000, 5360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["File", "Purpose"]),
      createTableRow(["src/lib/mrwa_api.ts", "MRWA ArcGIS queries and transforms"]),
      createTableRow(["src/app/api/weather/route.ts", "Open-Meteo weather integration"]),
      createTableRow(["src/app/api/warnings/route.ts", "BOM RSS warning parser"]),
      createTableRow(["src/app/api/places/route.ts", "Overpass API amenity search"]),
      createTableRow(["src/app/api/traffic/route.ts", "MRWA traffic count queries"]),
      createTableRow(["src/app/api/admin-sync/route.ts", "MRWA bulk data sync"]),
      createTableRow(["src/lib/offline-db.ts", "IndexedDB operations"]),
    ]
  });
}

function createRateLimitsTable() {
  return new Table({
    columnWidths: [2500, 2500, 4360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["API", "Rate Limit", "Caching Strategy"]),
      createTableRow(["MRWA ArcGIS", "2000 records/request", "Client-side IndexedDB"]),
      createTableRow(["Open-Meteo", "None (free)", "Per-request, no server cache"]),
      createTableRow(["BOM RSS", "Reasonable use", "5-minute server cache"]),
      createTableRow(["Overpass", "Varies by server", "No caching, fallback servers"]),
      createTableRow(["Nominatim", "1 req/sec", "No caching, used once per lookup"]),
    ]
  });
}

function createTableHeaderRow(cells) {
  return new TableRow({
    tableHeader: true,
    children: cells.map(text => new TableCell({
      borders: cellBorders,
      shading: { fill: colors.headerBg, type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ 
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 22 })]
      })]
    }))
  });
}

function createTableRow(cells) {
  return new TableRow({
    children: cells.map((text, index) => new TableCell({
      borders: cellBorders,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ 
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text, size: 20 })]
      })]
    }))
  });
}

// Generate document
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/home/z/my-project/download/TC_Work_Zone_Locator_Data_Sources.docx", buffer);
  console.log("Document created: /home/z/my-project/download/TC_Work_Zone_Locator_Data_Sources.docx");
});
