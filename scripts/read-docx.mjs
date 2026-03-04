#!/usr/bin/env node
/**
 * Extract text content from Word documents for auditing
 * Usage: node scripts/read-docx.mjs docs/filename.docx
 */

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node scripts/read-docx.mjs <path-to-docx>');
  process.exit(1);
}

try {
  const zip = new AdmZip(filePath);
  const docXml = zip.readAsText('word/document.xml');
  
  // Extract text from XML - simple regex approach
  const textMatches = docXml.match(/<w:t[^>]*>[^<]+<\/w:t>/g) || [];
  const text = textMatches
    .map(match => match.replace(/<[^>]+>/g, ''))
    .join('');
  
  // Try to preserve some structure by looking for paragraph breaks
  const paragraphs = docXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g) || [];
  const structuredText = paragraphs
    .map(p => {
      const texts = p.match(/<w:t[^>]*>[^<]+<\/w:t>/g) || [];
      return texts.map(t => t.replace(/<[^>]+>/g, '')).join('');
    })
    .filter(p => p.trim())
    .join('\n');
  
  console.log(structuredText);
} catch (error) {
  console.error('Error reading document:', error.message);
  process.exit(1);
}
