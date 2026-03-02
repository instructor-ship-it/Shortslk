import { NextResponse } from 'next/server';

// BOM Weather Warnings RSS Feed for WA Land Areas
// Feed ID: IDZ00067
const BOM_RSS_URL = 'https://www.bom.gov.au/fwo/IDZ00067.warnings_wa.xml';

interface WarningItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  category: string;
  urgency: string;
  severity: string;
}

interface WarningData {
  warnings: WarningItem[];
  count: number;
  lastUpdated: string;
  source: string;
}

// Parse RSS XML to extract warning items
function parseRssXml(xml: string): WarningItem[] {
  const warnings: WarningItem[] = [];
  
  // Match all <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];
    
    // Extract fields from item
    const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                       itemContent.match(/<title>(.*?)<\/title>/);
    const descMatch = itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                      itemContent.match(/<description>(.*?)<\/description>/);
    const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
    const categoryMatch = itemContent.match(/<category>(.*?)<\/category>/);
    const urgencyMatch = itemContent.match(/<urgency>(.*?)<\/urgency>/);
    const severityMatch = itemContent.match(/<severity>(.*?)<\/severity>/);
    
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Filter out nil notices and cancellations that are old
    if (title.toLowerCase().includes('nil') || 
        title.toLowerCase().includes('no warnings') ||
        title.toLowerCase().includes('no current warnings')) {
      continue;
    }
    
    warnings.push({
      title: title,
      description: descMatch ? descMatch[1].trim() : '',
      link: linkMatch ? linkMatch[1].trim() : '',
      pubDate: pubDateMatch ? pubDateMatch[1].trim() : '',
      category: categoryMatch ? categoryMatch[1].trim() : 'Weather',
      urgency: urgencyMatch ? urgencyMatch[1].trim() : 'Expected',
      severity: severityMatch ? severityMatch[1].trim() : 'Minor',
    });
  }
  
  return warnings;
}

export async function GET() {
  try {
    // Fetch RSS feed from BOM
    const response = await fetch(BOM_RSS_URL, {
      headers: {
        // BOM requires a User-Agent header to avoid blocking
        'User-Agent': 'TCWorkZoneLocator/5.3 (WA Traffic Control Application)',
        'Accept': 'application/xml, text/xml, */*',
      },
      // Cache for 5 minutes
      next: { revalidate: 300 },
    });
    
    if (!response.ok) {
      throw new Error(`BOM RSS fetch failed: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const warnings = parseRssXml(xmlText);
    
    const data: WarningData = {
      warnings,
      count: warnings.length,
      lastUpdated: new Date().toISOString(),
      source: 'BOM RSS IDZ00067',
    };
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch BOM warnings:', error);
    
    // Return empty warnings on error (graceful degradation)
    return NextResponse.json({
      warnings: [],
      count: 0,
      lastUpdated: new Date().toISOString(),
      source: 'BOM RSS IDZ00067',
      error: 'Failed to fetch warnings',
    });
  }
}
