const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = require('docx');
const fs = require('fs');

// Create a simple, clean document
const doc = new Document({
  numbering: {
    config: [{
      reference: "main-list",
      levels: [{
        level: 0,
        format: "decimal",
        text: "%1.",
        alignment: AlignmentType.START
      }]
    }]
  },
  sections: [{
    properties: {},
    children: [
      // Title
      new Paragraph({
        text: "TC SLK - User Manual",
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 }
      }),
      
      // Version info
      new Paragraph({
        children: [
          new TextRun({ text: "Version: ", bold: true }),
          new TextRun("RC 1.2.1")
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Date: ", bold: true }),
          new TextRun("March 2026")
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "For: ", bold: true }),
          new TextRun("Traffic Controllers in Western Australia")
        ],
        spacing: { after: 400 }
      }),
      
      // Section 1: Introduction
      new Paragraph({ text: "1. Introduction", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({ text: "1.1 What is TC SLK?", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "TC SLK is a mobile-first web application designed specifically for Traffic Controllers working on Western Australian roads. It helps you locate work zones, track your position in real-time, and know the speed limits for any location - even in remote areas without internet access.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "1.2 Key Features", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "Work Zone Lookup - Find coordinates for any road by SLK (Straight Line Kilometre)", spacing: { after: 50 } }),
      new Paragraph({ text: "Real-time GPS Tracking - Track your position with EKF smoothing for accuracy", spacing: { after: 50 } }),
      new Paragraph({ text: "Speed Zone Display - See current speed limit with advance warning of changes", spacing: { after: 50 } }),
      new Paragraph({ text: "Speed Sign Overrides - Record community-verified corrections to MRWA data", spacing: { after: 50 } }),
      new Paragraph({ text: "Offline Operation - Works without internet after downloading data", spacing: { after: 50 } }),
      new Paragraph({ text: "Signage Corridor - View all signage near your work zone", spacing: { after: 50 } }),
      new Paragraph({ text: "Weather Integration - Current conditions and forecast when online", spacing: { after: 200 } }),
      
      // Section 2: Getting Started
      new Paragraph({ text: "2. Getting Started", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({ text: "2.1 Accessing the Application", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Open your web browser and navigate to the application URL. The app works on any modern browser (Chrome, Safari, Firefox, Edge) on your phone, tablet, or computer. For best results, use Chrome on a mobile phone.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "2.2 First-Time Setup", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Step 1: Download Offline Data - Before you can use the app offline, you must download the road data. Tap the gear icon in the top-right corner, tap Download Data button, wait for the download to complete (about 69,000 roads). The gear icon will turn green when ready.",
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: "Step 2: Set Your Default Region - In Settings, find Default Region and select your region (e.g., Wheatbelt, Metropolitan). This region will be pre-selected each time you open the app.",
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: "Step 3: Enable Location Access - When prompted, allow the app to access your location. This is required for GPS-based road detection, real-time SLK tracking, and speed limit display.",
        spacing: { after: 200 }
      }),
      
      // Section 3: Offline Capability
      new Paragraph({ text: "3. Offline Capability", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({ text: "3.1 Does This App Work Offline?", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "YES! The core features work 100% offline after downloading data. This is essential for Traffic Controllers working in remote areas of Western Australia where cell coverage is unreliable or non-existent.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "3.2 What Works Offline", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "Work Zone Lookup - stored in IndexedDB - YES, works offline", spacing: { after: 50 } }),
      new Paragraph({ text: "GPS Tracking - uses device GPS + IndexedDB - YES, works offline", spacing: { after: 50 } }),
      new Paragraph({ text: "SLK Position - computed locally - YES, works offline", spacing: { after: 50 } }),
      new Paragraph({ text: "Speed Zones - IndexedDB + localStorage - YES, works offline", spacing: { after: 50 } }),
      new Paragraph({ text: "Speed Sign Overrides - localStorage - YES, works offline", spacing: { after: 50 } }),
      new Paragraph({ text: "Signage Corridor - IndexedDB - YES, works offline", spacing: { after: 50 } }),
      new Paragraph({ text: "TC Position Calculation - computed locally - YES, works offline", spacing: { after: 50 } }),
      new Paragraph({ text: "Direction Detection - computed from GPS - YES, works offline", spacing: { after: 50 } }),
      new Paragraph({ text: "Google Maps Links - generated URLs - YES, works offline", spacing: { after: 200 } }),
      
      new Paragraph({ text: "3.3 What Requires Internet", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "Weather Data - from Open-Meteo API - requires internet", spacing: { after: 50 } }),
      new Paragraph({ text: "BOM Weather Warnings - from RSS Feed - requires internet", spacing: { after: 50 } }),
      new Paragraph({ text: "Nearby Amenities - from Overpass API - requires internet", spacing: { after: 50 } }),
      new Paragraph({ text: "Traffic Volume - from MRWA API - requires internet", spacing: { after: 50 } }),
      new Paragraph({ text: "Street View Images - from Google Maps - requires internet", spacing: { after: 200 } }),
      
      new Paragraph({ text: "3.4 Tips for Remote Work", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "Download data before leaving coverage area", spacing: { after: 50 } }),
      new Paragraph({ text: "Test the app in coverage area first", spacing: { after: 50 } }),
      new Paragraph({ text: "Weather and amenities sections will show unavailable offline", spacing: { after: 50 } }),
      new Paragraph({ text: "All core TC functions work without internet", spacing: { after: 200 } }),
      
      // Section 4: Home Page
      new Paragraph({ text: "4. Home Page - Work Zone Lookup", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({ text: "4.1 Overview", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "The home page is where you look up work zone information. Select a road, enter SLK values, and get coordinates for your work zone and TC positions.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "4.2 Selecting a Road", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Option 1: Browse by Region - Select a region from the dropdown (Wheatbelt, Metropolitan, etc.), then select a road ID from the searchable dropdown. The road name and valid SLK range will be displayed.",
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: "Option 2: Local Roads - Select Local from the region dropdown (amber colored), enter the road ID manually (e.g., L00123), or use GPS to auto-detect your current road.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "4.3 Entering SLK Values", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Start SLK (required): Enter the starting SLK of your work zone. Use decimal values if needed (e.g., 67.62). End SLK (optional): Leave blank for a single point lookup, or enter the end SLK for a work zone range.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "4.4 Understanding Results", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Work Zone Summary shows road name and ID, start and end SLK, zone length in meters, carriageway type (Left, Right, Single), and navigation buttons (Maps, Street View, Track). Traffic Volume shows Annual Average Daily Traffic (AADT), peak hour volume estimate, and heavy vehicle percentage. Signage Corridor shows intersections within 100m, speed restriction signs within 700m, warning signs within 700m, and rail crossings. TC Positions shows TC Start at 100m before work zone and TC End at 100m after work zone, with navigation buttons for each position.",
        spacing: { after: 200 }
      }),
      
      // Section 5: Drive Page
      new Paragraph({ text: "5. Drive Page - GPS Tracking", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({ text: "5.1 Overview", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "The drive page provides real-time GPS tracking with SLK position, speed limit display, and advance warning of speed zone changes.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "5.2 Starting GPS Tracking", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "From home page, tap the tracking icon next to your work zone. Or tap Start SLK Tracking button. Grant location permission if prompted. The page will automatically start tracking.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "5.3 Understanding the Display", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "Speed Circle: Green = At or below speed limit. Red = Exceeding speed limit. Amber border = Speed decrease ahead. Green border with checkmark = Community-verified zone.", spacing: { after: 100 } }),
      new Paragraph({ text: "Current Speed: Large green numbers show your current speed. Turns red when speeding.", spacing: { after: 100 } }),
      new Paragraph({ text: "EKF Status: Green dot = High confidence. Yellow dot = Medium confidence. Orange dot = Low confidence. Cyan diamond = Predicted position (GPS outage).", spacing: { after: 200 } }),
      
      new Paragraph({ text: "5.4 Speed Zone Lookahead", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "The app warns you before reaching speed zone changes. Amber border appears when approaching a speed decrease. Shows upcoming speed limit in the circle. Distance countdown to the sign. GPS lag compensation improves timing.",
        spacing: { after: 200 }
      }),
      
      // Section 6: Overrides Page
      new Paragraph({ text: "6. Overrides Page - Speed Sign Corrections", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({ text: "6.1 Why Override Speed Zones?", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Sometimes MRWA database doesn't match physical signs. This can happen after road works and sign relocations, recent speed limit changes, or data entry errors. The override system lets you record the correct speed limits based on field observation.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "6.2 Adding a Speed Sign Override", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "Required Fields:", spacing: { after: 50 } }),
      new Paragraph({ text: "Road ID - e.g., M031", spacing: { after: 50 } }),
      new Paragraph({ text: "Road Name - e.g., Northam Cranbrook Rd", spacing: { after: 50 } }),
      new Paragraph({ text: "SLK - Location of the physical sign", spacing: { after: 50 } }),
      new Paragraph({ text: "Direction - True Left (INCREASING SLK) or True Right (DECREASING SLK)", spacing: { after: 50 } }),
      new Paragraph({ text: "Sign Type - Single or Double sided", spacing: { after: 50 } }),
      new Paragraph({ text: "Start SLK - Where the zone begins", spacing: { after: 50 } }),
      new Paragraph({ text: "End SLK - Where the zone ends", spacing: { after: 50 } }),
      new Paragraph({ text: "Front Speed - Speed shown on the sign face", spacing: { after: 200 } }),
      
      new Paragraph({ text: "6.3 Direction Reference", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "True Left = Left Carriageway = INCREASING SLK", spacing: { after: 50 } }),
      new Paragraph({ text: "True Right = Right Carriageway = DECREASING SLK", spacing: { after: 200 } }),
      
      // Section 7: Calibrate Page
      new Paragraph({ text: "7. Calibrate Page - GPS Lag Measurement", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({ text: "7.1 What is GPS Lag?", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "GPS reports your position with a slight delay. This delay (typically 1-3 seconds) affects the accuracy of speed zone lookahead warnings. The calibration tool measures this delay so the app can compensate.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "7.2 How to Calibrate", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "Step 1: Set Target - Stand at a known location (e.g., a speed sign). Note the SLK of this location. Tap SET TARGET while stationary.", spacing: { after: 100 } }),
      new Paragraph({ text: "Step 2: Mark Pass - Drive past the same location. When you pass the sign, tap MARK PASS immediately. Drive at normal speed for accurate measurement.", spacing: { after: 100 } }),
      new Paragraph({ text: "Step 3: Calculate and Apply - The app calculates lag based on SLK difference. Tap APPLY to save to GPS settings. Lag compensation improves speed zone warnings.", spacing: { after: 200 } }),
      
      // Section 8: Settings
      new Paragraph({ text: "8. Settings", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({
        text: "Access settings by tapping the gear icon in the header.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "8.1 GPS Settings", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "EKF Filtering (default On) - Kalman filter for smoother GPS", spacing: { after: 50 } }),
      new Paragraph({ text: "Road Constraint (default On) - Snap predictions to road", spacing: { after: 50 } }),
      new Paragraph({ text: "Max Prediction Time (default 30s) - GPS outage prediction limit", spacing: { after: 50 } }),
      new Paragraph({ text: "Show Uncertainty (default On) - Display accuracy", spacing: { after: 50 } }),
      new Paragraph({ text: "Early Warnings (default On) - Alert earlier at higher speeds", spacing: { after: 50 } }),
      new Paragraph({ text: "Speed Lookahead (default 5s) - Lookahead time for warnings", spacing: { after: 50 } }),
      new Paragraph({ text: "GPS Lag Compensation (default 0s) - Measured lag offset", spacing: { after: 200 } }),
      
      new Paragraph({ text: "8.2 Wind Gust Alert", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Set threshold for wind gust warnings. Default is 60 km/h. Choose from 40, 50, 60, or 80 km/h buttons.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "8.3 Offline Data", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "Download Data - Downloads all road data to your device. Required before offline use.", spacing: { after: 100 } }),
      new Paragraph({ text: "Clear Data - Removes all offline data. Use if you want to re-download fresh data.", spacing: { after: 200 } }),
      
      // Section 9: Troubleshooting
      new Paragraph({ text: "9. Troubleshooting", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({ text: "9.1 App Shows Wrong Road", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Make sure offline data is downloaded (green gear icon). Check GPS accuracy - low confidence indicates poor signal. Try clearing and re-downloading data. For local roads, use manual entry instead of GPS.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "9.2 Speed Limit Incorrect", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "MRWA data may be outdated. Add an override in the Overrides page. Record the physical sign details. Override will take precedence over MRWA data.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "9.3 GPS Not Working", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Check location permissions in browser settings. Make sure you're not in a building or underground. Wait for GPS signal (can take 30+ seconds). Try refreshing the page.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "9.4 Data Won't Download", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Check your internet connection. Clear browser cache and try again. Try a different browser. Check available storage on device.",
        spacing: { after: 200 }
      }),
      
      new Paragraph({ text: "9.5 Speed Warnings Too Early/Late", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({
        text: "Use the Calibrate page to measure GPS lag. Apply the measured lag compensation. Recalibrate if you change devices.",
        spacing: { after: 200 }
      }),
      
      // Section 10: Quick Reference
      new Paragraph({ text: "10. Quick Reference", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({ text: "10.1 Direction Terminology", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "True Left = Left Carriageway = INCREASING SLK", spacing: { after: 50 } }),
      new Paragraph({ text: "True Right = Right Carriageway = DECREASING SLK", spacing: { after: 200 } }),
      
      new Paragraph({ text: "10.2 Status Colors", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "Green text = At/below speed limit, moving towards destination", spacing: { after: 50 } }),
      new Paragraph({ text: "Red text = Exceeding speed limit, moving away from destination", spacing: { after: 50 } }),
      new Paragraph({ text: "Yellow text = Stationary", spacing: { after: 50 } }),
      new Paragraph({ text: "Amber border = Speed decrease ahead", spacing: { after: 50 } }),
      new Paragraph({ text: "Green border with checkmark = Community-verified override zone", spacing: { after: 200 } }),
      
      new Paragraph({ text: "10.3 Key Distances", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "TC Positions = 100m from work zone", spacing: { after: 50 } }),
      new Paragraph({ text: "Signage Corridor = 700m from work zone", spacing: { after: 50 } }),
      new Paragraph({ text: "Intersection Display = 100m from work zone", spacing: { after: 50 } }),
      new Paragraph({ text: "Speed Sign Detection = 700m from work zone", spacing: { after: 200 } }),
      
      new Paragraph({ text: "10.4 Offline Data Summary", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
      new Paragraph({ text: "Roads: 69,000+", spacing: { after: 50 } }),
      new Paragraph({ text: "Speed Zones: 69,000+", spacing: { after: 50 } }),
      new Paragraph({ text: "Regions: 8 MRWA regions", spacing: { after: 200 } }),
      
      // Glossary
      new Paragraph({ text: "Appendix: Glossary", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      
      new Paragraph({
        text: "SLK (Straight Line Kilometre) - A linear reference system used to identify locations along a road. SLK values increase from one end of the road to the other.",
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: "True Left / True Right - Direction terminology for Western Australian roads. True Left = traffic travelling INCREASING SLK. True Right = traffic travelling DECREASING SLK.",
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: "EKF (Extended Kalman Filter) - An algorithm that smooths GPS position data for more accurate tracking, especially useful during GPS signal fluctuations.",
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: "Override - A user-recorded correction to MRWA speed zone data, based on physical sign observation.",
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: "IndexedDB - Browser database that stores road data locally on your device for offline access.",
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: "localStorage - Browser storage for user preferences and speed sign overrides.",
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: "MRWA - Main Roads Western Australia - the government authority that manages WA roads and provides road data.",
        spacing: { after: 200 }
      })
    ]
  }]
});

// Save the document
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/home/z/my-project/download/TC_Work_Zone_Locator_User_Manual.docx', buffer);
  console.log('User Manual created successfully at /home/z/my-project/download/TC_Work_Zone_Locator_User_Manual.docx');
}).catch(err => {
  console.error('Error creating document:', err);
});
