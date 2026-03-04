const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer, 
        AlignmentType, PageOrientation, LevelFormat, HeadingLevel, BorderStyle, WidthType, 
        ShadingType, VerticalAlign, PageNumber, PageBreak, TableOfContents } = require('docx');
const fs = require('fs');

// Color palette - Midnight Code style
const colors = {
  primary: "020617",      // Midnight Black
  body: "1E293B",         // Deep Slate Blue  
  secondary: "64748B",    // Cool Blue-Gray
  accent: "94A3B8",       // Steady Silver
  tableBg: "F8FAFC",      // Glacial Blue-White
  headerBg: "E2E8F0",     // Light gray for table headers
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
      { reference: "numbered-list-1",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbered-list-2",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbered-list-3",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbered-list-4",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
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
        children: [new TextRun({ text: "TC SLK - RC 1.0 Documentation", size: 18, color: colors.secondary })]
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
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "Release Candidate 1.0", size: 36, bold: true, color: colors.secondary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: "Complete Layout & Functionality Documentation", size: 24, color: colors.body })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 800 }, children: [new TextRun({ text: "Version: RC 1.0 (5.3.7)", size: 22, color: colors.secondary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [new TextRun({ text: "Date: March 1, 2026", size: 22, color: colors.secondary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [new TextRun({ text: "Repository: https://github.com/instructor-ship-it/Shortslk", size: 20, color: colors.accent })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // Table of Contents
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Table of Contents")] }),
      new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "Note: Right-click the Table of Contents and select 'Update Field' to refresh page numbers.", size: 18, color: "999999", italics: true })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // Section 1: Overview
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. Overview")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("TC SLK is a mobile-first Progressive Web Application (PWA) designed for Traffic Controllers in Western Australia. The application provides real-time GPS-based SLK (Straight Line Kilometre) tracking, work zone location lookup, weather information, and offline capability for remote area operations. This documentation serves as the complete reference for RC 1.0, capturing all layout specifications, functionality details, and code implementations to enable full restoration if needed.")] }),
      
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.1 Application Architecture")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("The application is built using Next.js 15 with App Router architecture, featuring three main pages:")] }),
      new Paragraph({ numbering: { reference: "numbered-list-1", level: 0 }, children: [new TextRun({ text: "Home Page (/)", bold: true }), new TextRun(" - Work zone lookup interface with region/road/SLK selection")] }),
      new Paragraph({ numbering: { reference: "numbered-list-1", level: 0 }, children: [new TextRun({ text: "Drive Page (/drive)", bold: true }), new TextRun(" - Real-time GPS tracking with EKF filtering")] }),
      new Paragraph({ numbering: { reference: "numbered-list-1", level: 0 }, children: [new TextRun({ text: "Calibrate Page (/calibrate)", bold: true }), new TextRun(" - GPS lag measurement tool for speed sign lookahead")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.2 Technology Stack")] }),
      createTechTable(),

      // Section 2: Color Scheme
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. Color Scheme & Styling")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The application uses a dark theme optimized for outdoor visibility. The color scheme follows a navy/dark blue palette with accent colors for interactive elements and status indicators.")] }),
      
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 Primary Colors")] }),
      createColorTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.2 Status Colors")] }),
      createStatusColorTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.3 Tailwind CSS Classes Reference")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("The following Tailwind classes are used throughout the application for consistent styling:")] }),
      createTailwindTable(),

      // Section 3: Home Page Layout
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. Home Page Layout (page.tsx)")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The home page serves as the primary work zone lookup interface. It features a collapsible GPS section, region/road selection dropdowns, SLK input fields, and comprehensive results display with multiple data sections.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 Header Section")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("The header contains the application title, version information, and settings access button.")] }),
      createHeaderCodeSnippet(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2 Region Selection")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Region selection uses a Select component with eight MRWA regions plus a Local Roads option at the top. The Local Roads option enables GPS-based lookup or manual road ID entry.")] }),
      createRegionCodeSnippet(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.3 Road ID Selection")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Road ID selection behavior varies based on the selected region. For state roads, a searchable dropdown is provided. For Local roads, a text input allows manual entry.")] }),
      createRoadIdCodeSnippet(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.4 Results Sections")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("After searching, results are displayed in collapsible sections. Each section can be expanded/collapsed by clicking the header.")] }),
      createResultsSectionsTable(),

      // Section 4: Drive Page Layout
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. Drive Page Layout (drive/page.tsx)")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The drive page provides real-time GPS tracking with EKF (Extended Kalman Filter) filtering for accurate SLK positioning. It displays current speed, speed limit, location information, and trip progress when a destination is set.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.1 Speed Display Section")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("The speed display shows current GPS speed and posted speed limit in a two-column layout. Speed turns red when exceeding the limit.")] }),
      createSpeedDisplayCodeSnippet(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.2 Current Location Section")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Displays current road ID, road name, SLK position, and road type. The accuracy display has been removed in RC 1.0.")] }),
      createCurrentLocationCodeSnippet(),

      // Section 5: Amenities Section
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. Amenities Section Layout")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The Amenities section displays nearby services including hospitals, fuel stations, and public toilets. Each amenity has small icon buttons for navigation and street view.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.1 Amenity Card Structure")] }),
      createAmenityCodeSnippet(),

      // Section 6: Signage Corridor
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. Signage Corridor Report")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The Signage Corridor Report displays all signage within a corridor around the work zone. Intersections are filtered to ±100m from the work zone boundaries. The Regulatory Signs section has been removed in RC 1.0.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.1 Corridor Bounds")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("The corridor extends ±700m from work zone boundaries for signage data, but intersections are filtered to ±100m only.")] }),
      createCorridorCodeSnippet(),

      // Section 7: Settings Dialog
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. Settings Dialog")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The settings dialog (accessed via the gear icon) provides access to default region selection, GPS filtering options, wind gust alert threshold, and admin data sync features.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.1 GPS Settings")] }),
      createGpsSettingsTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.2 Wind Gust Alert Threshold")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("Configurable threshold for wind gust alerts (default 60 km/h). Options: 40, 50, 60, 80 km/h. When gusts exceed the threshold, an amber warning banner is displayed in the Weather section.")] }),

      // Section 8: Button Specifications
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. Button Specifications")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("All buttons in the application follow consistent styling patterns. This section documents the exact specifications for each button type.")] }),

      createButtonTable(),

      // Section 9: localStorage Keys
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("9. Data Persistence")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The application uses localStorage for user preferences and sessionStorage for work zone state restoration. IndexedDB stores offline road data.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("9.1 localStorage Keys")] }),
      createLocalStorageTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("9.2 sessionStorage Keys")] }),
      createSessionStorageTable(),

      // Section 10: API Endpoints
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("10. API Endpoints")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The application uses Next.js API routes for backend functionality. All endpoints are server-side and do not require external API keys.")] }),
      createApiTable(),

      // Section 11: Screenshot Analysis
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("11. Screenshot Analysis")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("This section documents the visual layout based on screenshot analysis of RC 1.0.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("11.1 Home Page - Input State")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("When the home page loads without results, the following elements are visible:")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Header: TC SLK title, v5.3.7 subtitle with green offline status, green gear icon (settings)")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Start SLK Tracking button: Dark blue (bg-blue-800), full width, with red pin icon")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("GPS Location section: Collapsible, red pin icon, green 'Find by GPS Location' text")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Region dropdown: Dark gray background, white text, shows selected region")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Road ID dropdown: Dark gray background, placeholder 'Select road'")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("SLK inputs: Two side-by-side inputs for Start/End SLK")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Get Work Zone Info button: Blue (bg-blue-600), full width")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("11.2 Home Page - Results State")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("After searching, the following sections are displayed:")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Reset Work Zone Info button: Gray background, replaces search button")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Work Zone Summary: Blue header with location pin, three small icon buttons (map/home/track) right-justified")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Traffic Volume: Collapsible, shows AADT, peak hour, heavy vehicle percentage")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Signage in Corridor: Shows speed restriction signs, intersections (±100m only), warning signs")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("TC Positions: Two cards for TC Start and TC End, each with small icon buttons")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Weather: Sunrise/sunset, UV index, current conditions, 8-hour forecast, BOM links")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Amenities: Hospital, fuel station, toilet - each with small icon buttons")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("11.3 Drive Page - Tracking Active")] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun("When GPS tracking is active:")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Header: SLK Tracking title, v5.3.7, purple 'EKF Filtering Active' text, wrench icon")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Back to Work Zone Locator button: Dark blue (bg-blue-800), replaces Start Tracking button")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Speed display: Large green number, km/h label, speed limit in black circle")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("EKF Status: Confidence indicator (green/yellow/orange/cyan), ±Xm accuracy")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Current Location: Road ID, Road Name, SLK, Road Type (no accuracy in RC 1.0)")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Destination: Target road ID, name, SLK (when destination set)")] }),

      // Section 12: Version History
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("12. Version History")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("RC 1.0 is based on v5.3.7 with the following recent changes:")] }),

      createVersionTable(),

      // Section 13: Restoration Guide
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("13. Restoration Guide")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun("To restore any missing functionality or layout, refer to the specific sections above. Key files to modify:")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("13.1 File Reference")] }),
      createFileReferenceTable(),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("13.2 Quick Restoration Steps")] }),
      new Paragraph({ numbering: { reference: "numbered-list-4", level: 0 }, children: [new TextRun("Clone repository: git clone https://github.com/instructor-ship-it/Shortslk.git")] }),
      new Paragraph({ numbering: { reference: "numbered-list-4", level: 0 }, children: [new TextRun("Install dependencies: bun install")] }),
      new Paragraph({ numbering: { reference: "numbered-list-4", level: 0 }, children: [new TextRun("Run development server: bun run dev")] }),
      new Paragraph({ numbering: { reference: "numbered-list-4", level: 0 }, children: [new TextRun("Access at http://localhost:3000")] }),
      new Paragraph({ numbering: { reference: "numbered-list-4", level: 0 }, children: [new TextRun("Download offline data via Settings (gear icon) for full functionality")] }),
    ]
  }]
});

// Helper functions for tables
function createTechTable() {
  return new Table({
    columnWidths: [3000, 6360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Technology", "Description"]),
      createTableRow(["Framework", "Next.js 15 with App Router"]),
      createTableRow(["Language", "TypeScript"]),
      createTableRow(["Styling", "Tailwind CSS with shadcn/ui components"]),
      createTableRow(["Offline Storage", "IndexedDB for client-side data persistence"]),
      createTableRow(["GPS Filtering", "Extended Kalman Filter (EKF) for accurate positioning"]),
      createTableRow(["Distance Calculation", "Haversine formula for accurate meter-level distances"]),
      createTableRow(["Maps Integration", "Google Maps Links (no API key required)"]),
    ]
  });
}

function createColorTable() {
  return new Table({
    columnWidths: [2500, 2500, 4360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Element", "Tailwind Class", "Hex Color"]),
      createTableRow(["Background", "bg-gray-900", "#111827 (Dark Navy)"]),
      createTableRow(["Cards", "bg-gray-800", "#1F2937 (Slightly Lighter)"]),
      createTableRow(["Primary Buttons", "bg-blue-600", "#2563EB (Bright Blue)"]),
      createTableRow(["Dark Buttons", "bg-blue-800", "#1E40AF (Dark Blue)"]),
      createTableRow(["Navigate Buttons", "bg-green-600", "#16A34A (Green)"]),
      createTableRow(["Street View Buttons", "bg-blue-600", "#2563EB (Blue)"]),
      createTableRow(["Text (Primary)", "text-white", "#FFFFFF"]),
      createTableRow(["Text (Secondary)", "text-gray-400", "#9CA3AF"]),
      createTableRow(["Section Headers", "text-blue-400", "#60A5FA"]),
      createTableRow(["Warning Text", "text-amber-400", "#FBBF24"]),
      createTableRow(["Error/Alert Text", "text-red-400", "#F87171"]),
      createTableRow(["Success Text", "text-green-400", "#4ADE80"]),
    ]
  });
}

function createStatusColorTable() {
  return new Table({
    columnWidths: [2500, 2500, 4360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Status", "Color", "Meaning"]),
      createTableRow(["Direction: Towards", "Green (text-green-400)", "Moving towards destination SLK"]),
      createTableRow(["Direction: Away", "Red pulsing (text-red-500)", "Moving away from destination SLK"]),
      createTableRow(["Direction: Static", "Yellow (text-yellow-400)", "Stationary"]),
      createTableRow(["Speed: Normal", "Green (text-green-400)", "At or below speed limit"]),
      createTableRow(["Speed: Speeding", "Red pulsing (text-red-500)", "Exceeding speed limit"]),
      createTableRow(["Confidence: High", "Green dot (●)", "GPS accuracy high"]),
      createTableRow(["Confidence: Medium", "Yellow dot (◐)", "GPS accuracy medium"]),
      createTableRow(["Confidence: Low", "Orange dot (○)", "GPS accuracy low"]),
      createTableRow(["Confidence: Predicted", "Cyan diamond (◈)", "Position predicted during GPS outage"]),
    ]
  });
}

function createTailwindTable() {
  return new Table({
    columnWidths: [3000, 6360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Component", "Tailwind Classes"]),
      createTableRow(["Main Container", "min-h-screen bg-gray-900 text-white max-w-md mx-auto px-4 py-6"]),
      createTableRow(["Card/Section", "bg-gray-800 rounded-lg p-4 mb-4"]),
      createTableRow(["Collapsible Header", "w-full p-4 flex items-center justify-between text-left"]),
      createTableRow(["Input Field", "bg-gray-800 border-gray-700 text-white h-12 text-base"]),
      createTableRow(["Primary Button", "w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"]),
      createTableRow(["Small Icon Button", "h-7 w-7 p-0 bg-green-600 hover:bg-green-700"]),
      createTableRow(["Badge", "text-xs bg-red-600 text-white px-1.5 py-0.5 rounded"]),
      createTableRow(["Mono Text (SLK)", "font-mono text-yellow-400"]),
    ]
  });
}

function createHeaderCodeSnippet() {
  return new Paragraph({ spacing: { after: 100 }, children: [
    new TextRun({ text: "Code Reference:", bold: true }),
    new TextRun({ text: " Lines 1173-1192 in page.tsx", italics: true })
  ]});
}

function createRegionCodeSnippet() {
  return new Paragraph({ spacing: { after: 100 }, children: [
    new TextRun({ text: "Code Reference:", bold: true }),
    new TextRun({ text: " Lines 1700-1739 in page.tsx. Local Roads option appears first with amber color (text-amber-400).", italics: true })
  ]});
}

function createRoadIdCodeSnippet() {
  return new Paragraph({ spacing: { after: 100 }, children: [
    new TextRun({ text: "Code Reference:", bold: true }),
    new TextRun({ text: " Lines 1741-1796 in page.tsx. For Local region, uses Input component with manual entry. For state roads, uses Select component with searchable dropdown.", italics: true })
  ]});
}

function createResultsSectionsTable() {
  return new Table({
    columnWidths: [3000, 6360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Section", "Contents"]),
      createTableRow(["Work Zone Summary", "Road name, road ID, start/end SLK, zone length, carriageway, small icon buttons for Navigate/Street View/Track"]),
      createTableRow(["Traffic Volume", "AADT, peak hour estimate, heavy vehicle %, data year, nearby count sites"]),
      createTableRow(["Signage in Corridor", "Speed restriction signs, Intersections (±100m), Warning signs. Regulatory Signs removed in RC 1.0."]),
      createTableRow(["TC Positions", "TC Start/End SLK with small Navigate/Street View icon buttons. Coordinates removed in RC 1.0."]),
      createTableRow(["Weather", "Sunrise/sunset/daylight, UV index, current conditions, 8-hour forecast, BOM Radar/Warnings links, Weather warnings badge"]),
      createTableRow(["Amenities", "Hospital (with Emergency badge), Fuel Station, Public Toilet - each with small icon buttons"]),
    ]
  });
}

function createSpeedDisplayCodeSnippet() {
  return new Paragraph({ spacing: { after: 100 }, children: [
    new TextRun({ text: "Code Reference:", bold: true }),
    new TextRun({ text: " Lines 417-498 in drive/page.tsx. Two-column layout with current speed (left) and speed limit circle (right). Speed limit circle shows amber border for approaching speed decrease, red for speeding.", italics: true })
  ]});
}

function createCurrentLocationCodeSnippet() {
  return new Paragraph({ spacing: { after: 100 }, children: [
    new TextRun({ text: "Code Reference:", bold: true }),
    new TextRun({ text: " Lines 582-621 in drive/page.tsx. Shows Road ID, Road Name, SLK (with direction indicator), Road Type. Accuracy section removed in RC 1.0.", italics: true })
  ]});
}

function createAmenityCodeSnippet() {
  return new Paragraph({ spacing: { after: 100 }, children: [
    new TextRun({ text: "Code Reference:", bold: true }),
    new TextRun({ text: " Lines 2412-2505 in page.tsx. Each amenity uses flex layout with name/distance left and small icon buttons (h-7 w-7) right-justified.", italics: true })
  ]});
}

function createCorridorCodeSnippet() {
  return new Paragraph({ spacing: { after: 100 }, children: [
    new TextRun({ text: "Code Reference:", bold: true }),
    new TextRun({ text: " Lines 928-948 in page.tsx for fetchSignageCorridor(). Lines 2031-2056 for intersection filtering logic - only shows intersections within ±100m (0.1 km) of work zone.", italics: true })
  ]});
}

function createGpsSettingsTable() {
  return new Table({
    columnWidths: [3000, 2000, 4360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Setting", "Default", "Description"]),
      createTableRow(["EKF Filtering", "On", "Extended Kalman Filter for smooth GPS positioning"]),
      createTableRow(["Road Constraint", "On", "Snaps predictions to road geometry"]),
      createTableRow(["Max Prediction Time", "30s", "How long to predict during GPS outage"]),
      createTableRow(["Show Uncertainty", "On", "Display ±Xm accuracy indicator"]),
      createTableRow(["Early Warnings", "On", "Alert earlier at higher speeds"]),
      createTableRow(["Speed Lookahead Time", "5s", "Lookahead time for speed zone changes"]),
      createTableRow(["GPS Lag Compensation", "0s", "Additional lookahead for GPS lag (measured via Calibrate page)"]),
    ]
  });
}

function createButtonTable() {
  return new Table({
    columnWidths: [2800, 2500, 4060],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Button", "Style", "Location"]),
      createTableRow(["Start SLK Tracking", "bg-blue-800 h-12 text-base", "Home page header"]),
      createTableRow(["Get Work Zone Info", "bg-blue-600 h-12 text-lg", "Home page"]),
      createTableRow(["Reset Work Zone Info", "bg-gray-600 h-12 text-lg", "Home page (results state)"]),
      createTableRow(["Back to Work Zone Locator", "bg-blue-800 h-12 text-base", "Drive/Calibrate pages"]),
      createTableRow(["Navigate (small)", "bg-green-600 h-7 w-7 p-0", "Work Zone Summary, TC Positions, Amenities"]),
      createTableRow(["Street View (small)", "bg-blue-600 h-7 w-7 p-0", "Work Zone Summary, TC Positions, Amenities"]),
      createTableRow(["Track (small)", "bg-blue-800 h-7 w-7 p-0", "Work Zone Summary only"]),
      createTableRow(["BOM Radar", "bg-gray-700 text-xs", "Weather section footer"]),
      createTableRow(["BOM Warnings", "bg-gray-700 text-xs", "Weather section footer"]),
    ]
  });
}

function createLocalStorageTable() {
  return new Table({
    columnWidths: [3500, 5860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Key", "Purpose"]),
      createTableRow(["defaultRegion", "Pre-selected region on app load"]),
      createTableRow(["gpsSettings", "GPS filtering configuration object"]),
      createTableRow(["windGustThreshold", "Wind gust alert threshold (default 60)"]),
    ]
  });
}

function createSessionStorageTable() {
  return new Table({
    columnWidths: [3500, 5860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Key", "Purpose"]),
      createTableRow(["workZoneParams", "JSON object with region, roadId, startSlk, endSlk for state restoration when returning from tracking"]),
    ]
  });
}

function createApiTable() {
  return new Table({
    columnWidths: [2500, 1500, 5360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Endpoint", "Method", "Description"]),
      createTableRow(["/api/roads", "GET/POST", "List regions/roads, get SLK coordinates"]),
      createTableRow(["/api/gps", "GET", "Convert GPS coordinates to road/SLK"]),
      createTableRow(["/api/weather", "GET", "Weather data from Open-Meteo API"]),
      createTableRow(["/api/warnings", "GET", "BOM RSS weather warnings (IDZ00067)"]),
      createTableRow(["/api/traffic", "GET", "Traffic volume data from MRWA"]),
      createTableRow(["/api/places", "GET", "Nearby amenities via Overpass API"]),
      createTableRow(["/api/intersections", "GET", "Cross roads detection within work zone"]),
      createTableRow(["/api/admin-sync", "GET/POST", "Direct sync from MRWA servers"]),
    ]
  });
}

function createVersionTable() {
  return new Table({
    columnWidths: [1500, 7860],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["Version", "Changes"]),
      createTableRow(["RC 1.0 (5.3.7)", "Current release. Local road manual entry, removed lookahead compensation message, removed accuracy display from Current Location."]),
      createTableRow(["5.3.6", "Changed Back to Work Zone Locator button to dark blue."]),
      createTableRow(["5.3.5", "Amenities icon buttons, intersections ±100m filter, removed Regulatory Signs section."]),
      createTableRow(["5.3.4", "Start SLK Tracking buttons dark blue, Work Zone Summary icon buttons, TC Positions icon buttons, removed coordinates."]),
      createTableRow(["5.3.3", "BOM Weather Warnings RSS, Wind Gust Alert Threshold, BOM Radar/Warnings links."]),
      createTableRow(["5.3.2", "Bidirectional speed zone detection."]),
      createTableRow(["5.3.1", "Removed SLK Calibration feature (separate from GPS Lag Calibration)."]),
      createTableRow(["5.3.0", "GPS Calibration Tool, speed display logic update."]),
    ]
  });
}

function createFileReferenceTable() {
  return new Table({
    columnWidths: [4000, 5360],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      createTableHeaderRow(["File", "Purpose"]),
      createTableRow(["src/app/page.tsx", "Home page - work zone lookup interface"]),
      createTableRow(["src/app/drive/page.tsx", "Drive page - GPS tracking with EKF"]),
      createTableRow(["src/app/calibrate/page.tsx", "Calibration tool for GPS lag measurement"]),
      createTableRow(["src/lib/offline-db.ts", "IndexedDB operations, signage corridor logic"]),
      createTableRow(["src/lib/gps-ekf.ts", "Extended Kalman Filter implementation"]),
      createTableRow(["src/hooks/useGpsTracking.ts", "GPS tracking hook with speed zones"]),
      createTableRow(["src/app/api/warnings/route.ts", "BOM weather warnings RSS feed"]),
      createTableRow(["PROJECT_CONTEXT.md", "Project overview and version history"]),
      createTableRow(["README.md", "User documentation and version history"]),
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
        alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.LEFT,
        children: [new TextRun({ text, size: 20 })]
      })]
    }))
  });
}

// Generate document
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/home/z/my-project/download/TC_Work_Zone_Locator_RC1_Documentation.docx", buffer);
  console.log("Document created: /home/z/my-project/download/TC_Work_Zone_Locator_RC1_Documentation.docx");
});
