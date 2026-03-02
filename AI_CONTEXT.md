# TC Work Zone Locator - AI Context File

> **READ THIS FILE AT THE START OF EACH SESSION**

## Project Overview

**TC Work Zone Locator** is a road work zone management app for Western Australian traffic controllers. It helps locate work zones, display speed limits, generate corridor reports, and manage speed sign overrides.

**Tech Stack:**
- Next.js 15 with App Router
- React with TypeScript
- Tailwind CSS + shadcn/ui components
- IndexedDB for offline road data
- localStorage for speed sign overrides
- Deployed on Vercel

---

## Key Terminology (Australian Road System)

### Carriageway & Direction
| Term | Definition | Also Known As |
|------|------------|---------------|
| **True Left** | Traffic travelling INCREASING SLK | Left Carriageway |
| **True Right** | Traffic travelling DECREASING SLK | Right Carriageway |
| **Left Carriageway** | Used by INCREASING SLK traffic | True Left |
| **Right Carriageway** | Used by DECREASING SLK traffic | True Right |

**Important:** When facing INCREASING SLK direction:
- Left side of road = Left Carriageway = True Left
- Right side of road = Right Carriageway = True Right

### SLK (Straight Line Kilometre)
- Road distance marker used in WA
- Increases in one direction along the road
- Used to locate signs, zones, work areas

### Speed Signs
| Type | Description | Zone Created |
|------|-------------|--------------|
| **Single + Not Replicated** | Repeater sign (informational) | None |
| **Single + Replicated** | One-sided, paired with opposite sign | 1 directional zone |
| **Double + Replicated** | Two-sided sign (most common) | 2 zones if speeds differ |

### Double-Sided Sign Fields
- **front_speed**: Speed shown on the face pointing in `direction` field
- **back_speed**: Speed shown on opposite face (for opposite traffic)
- **direction**: Which way the front face points (True Left or True Right)

**Example:** Sign at SLK 64.81, direction="True Left", front_speed=80, back_speed=110:
- Left Carriageway (increasing SLK) sees 80 km/h
- Right Carriageway (decreasing SLK) sees 110 km/h

---

## Architecture Decisions

### Data Storage
| Data Type | Storage | Why |
|-----------|---------|-----|
| Road geometry, MRWA data | IndexedDB | Large datasets, offline access |
| Speed sign overrides | localStorage | User-editable, works on Vercel (read-only filesystem) |
| App preferences | localStorage | Simple key-value |

### File Downloads on Mobile
**Problem:** Programmatic file downloads (Blob URLs) create empty files on some mobile browsers due to security restrictions.

**Solution:** Display data in a textarea for copy/paste. Export shows content on screen with "Copy" button.

### Sign-to-Zone Conversion Logic
Located in `/src/lib/offline-db.ts` → `signsToSpeedZones()` function:

1. Double sign with different front/back speeds → Creates TWO zones
2. Double sign with same speeds → Creates ONE Single carriageway zone
3. Single replicated sign → Creates ONE directional zone

---

## Current Features

### Working
- ✅ Road search and selection
- ✅ GPS tracking with SLK calculation
- ✅ Speed limit display with directional zones
- ✅ Speed sign override system (add/edit/delete)
- ✅ MRWA Exception Report generation
- ✅ Export data (copy to clipboard)
- ✅ Import data from JSON file
- ✅ Offline mode with IndexedDB

### Known Limitations
- ⚠️ File download creates empty file on mobile (use Copy instead)
- ⚠️ Share API may not work on all mobile browsers

---

## File Structure

```
/src
  /app
    /page.tsx          - Main app entry
    /overrides/page.tsx - Speed sign override management
    /api/              - Backend API routes
  /lib
    /offline-db.ts     - IndexedDB, speed zones, sign conversion logic
    /utils.ts          - Helper functions
  /components/ui/      - shadcn/ui components
```

---

## Speed Sign Override Data Structure

```json
{
  "version": "2.0",
  "last_updated": "2026-03-02",
  "signs": [
    {
      "id": "M031-S001",
      "road_id": "M031",
      "road_name": "Northam Cranbrook Rd",
      "common_usage_name": "Great Southern Hwy",
      "slk": 64.81,
      "lat": -32.09942741,
      "lon": 116.90796019,
      "direction": "True Left",
      "sign_type": "Double",
      "replicated": true,
      "start_slk": 64.81,
      "end_slk": 65.98,
      "approach_speed": 110,
      "front_speed": 80,
      "back_speed": 110,
      "verified_by": "field_observation",
      "verified_date": "2026-03-02",
      "note": "110→80 zone boundary.",
      "source": "community_verified",
      "mrwa_slk": 64.80,
      "discrepancy_m": 10
    }
  ]
}
```

---

## User Preferences

- User works on mobile phone
- Cannot edit JSON files directly on mobile
- Prefers copy/paste for data export
- Works with Australian road terminology daily

---

## Git Branches

- `main` - Primary development branch
- `master` - Synced with main, used for production

Both branches should be pushed together after changes.

---

## Common Tasks

### Push to both branches
```bash
git push origin main && git checkout master && git merge main && git push origin master && git checkout main
```

### Run lint check
```bash
bun run lint
```

---

## Recent Work

- Fixed double-sided sign interpretation (creates two zones for different speeds)
- Fixed carriageway mapping (True Left = Left Carriageway = INCREASING SLK)
- Added copy/paste export for mobile compatibility
- Switched from file-based storage to localStorage for Vercel compatibility

---

## Questions for Future Sessions

When starting a new session, consider asking:
1. Any new speed signs added or edited recently?
2. Any issues with the app on mobile?
3. Any new roads or regions to add?
4. Any discrepancies found with MRWA data?
