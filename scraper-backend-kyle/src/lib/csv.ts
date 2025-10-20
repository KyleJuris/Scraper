import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import fs from 'fs/promises';
import { RowInput } from './types.js';

/**
 * Read and parse CSV file with flexible header detection
 */
export async function readInputCsv(path: string): Promise<RowInput[]> {
  try {
    const csvContent = await fs.readFile(path, 'utf-8');
    
    // Parse CSV with flexible options
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    if (!Array.isArray(records) || records.length === 0) {
      console.log('No data found in CSV file');
      return [];
    }

    // Normalize headers - lowercase, trim, collapse spaces
    const normalizedHeaders = Object.keys(records[0]).map(header => 
      header.toLowerCase().trim().replace(/\s+/g, ' ')
    );

    // Find Facebook and Google URL columns
    let facebookColumnIndex = -1;
    let googleColumnIndex = -1;

    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      if (header.includes('facebook') || header.includes('fb')) {
        if (facebookColumnIndex === -1) {
          facebookColumnIndex = i;
        }
      }
      if (header.includes('google')) {
        if (googleColumnIndex === -1) {
          googleColumnIndex = i;
        }
      }
    }

    const originalHeaders = Object.keys(records[0]);

    // Process each row
    const processedRows: RowInput[] = records.map((record: Record<string, string>) => {
      const facebookUrl = facebookColumnIndex >= 0 ? 
        (record[originalHeaders[facebookColumnIndex]] || null) : null;
      const googleUrl = googleColumnIndex >= 0 ? 
        (record[originalHeaders[googleColumnIndex]] || null) : null;

      return {
        facebookUrl: facebookUrl?.trim() || null,
        googleUrl: googleUrl?.trim() || null,
        raw: record,
      };
    });

    console.log(`📊 Parsed ${processedRows.length} rows from CSV`);
    console.log(`   Facebook column: ${facebookColumnIndex >= 0 ? originalHeaders[facebookColumnIndex] : 'Not found'}`);
    console.log(`   Google column: ${googleColumnIndex >= 0 ? originalHeaders[googleColumnIndex] : 'Not found'}`);

    return processedRows;
  } catch (error) {
    console.error('❌ Error reading CSV file:', error);
    throw error;
  }
}

/**
 * Write data to CSV file
 */
export async function writeCsv(path: string, rows: any[]): Promise<void> {
  try {
    if (rows.length === 0) {
      console.log('⚠️  No data to write to CSV');
      return;
    }

    // Ensure output directory exists
    const outputDir = path.split('/').slice(0, -1).join('/');
    if (outputDir) {
      await fs.mkdir(outputDir, { recursive: true });
    }

    const csvContent = stringify(rows, {
      header: true,
      columns: Object.keys(rows[0]),
    });

    await fs.writeFile(path, csvContent, 'utf-8');
    console.log(`✅ Successfully wrote ${rows.length} rows to ${path}`);
  } catch (error) {
    console.error('❌ Error writing CSV file:', error);
    throw error;
  }
}
