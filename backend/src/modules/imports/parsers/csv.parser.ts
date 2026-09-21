import { parse } from 'csv-parse/sync';

export interface ParsedFileData {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
  previewRows: Record<string, any>[];
}

export class CsvParser {
  static parse(buffer: Buffer): ParsedFileData {
    let content = buffer.toString('utf8');
    // Strip BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const records: Record<string, any>[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const headers = records.length > 0 ? Object.keys(records[0]) : [];

    return {
      headers,
      rows: records,
      totalRows: records.length,
      previewRows: records.slice(0, 10),
    };
  }
}
