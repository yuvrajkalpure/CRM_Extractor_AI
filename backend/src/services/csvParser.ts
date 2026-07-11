import { parse } from 'csv-parse/sync';

/**
 * Parses a CSV buffer into an array of raw row objects.
 * Keys are the CSV column headers; values are strings.
 */
export function parseCsvBuffer(buffer: Buffer): Record<string, string>[] {
  const records = parse(buffer, {
    columns: true,          // Use first row as header keys
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,              // Strip BOM if present
  }) as Record<string, string>[];

  return records;
}

/**
 * Splits an array into chunks of the given size.
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
