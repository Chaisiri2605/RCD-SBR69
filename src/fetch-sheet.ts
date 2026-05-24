import fs from 'fs';
import path from 'path';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1GALPx7W49r67-8Rbgjpl_sJ8PDU4JO9f0qBoMI-EA2U/export?format=csv";

async function fetchSheet() {
  try {
    console.log("Fetching Google Sheet...");
    const res = await fetch(SHEET_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch sheet: ${res.statusText}`);
    }
    const csvText = await res.text();
    console.log("Fetched spreadsheet successfully. Parsing CSV...");
    
    // Parse CSV simple parser
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) {
      throw new Error("Empty spreadsheet");
    }
    
    const headers = parseCSVLine(lines[0]);
    console.log("CSV Headers:", headers);
    
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseCSVLine(lines[i]);
      rows.push(values);
    }
    
    console.log(`Parsed ${rows.length} rows.`);
    console.log("Sample Row 1:", rows[0]);
    
    // Let's print out all headers and sample values
    const dataDir = path.join(process.cwd(), 'src', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(dataDir, 'schools_seed.json'), 
      JSON.stringify({ headers, rows }, null, 2), 
      'utf-8'
    );
    console.log("Saved dynamic seed data to src/data/schools_seed.json");
  } catch (error) {
    console.error("Error fetching or parsing spreadsheet:", error);
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

fetchSheet();
