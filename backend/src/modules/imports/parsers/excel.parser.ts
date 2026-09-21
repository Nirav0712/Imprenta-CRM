import * as XLSX from 'xlsx';
import { ParsedFileData } from './csv.parser';

export class ExcelParser {
  static parse(buffer: Buffer): ParsedFileData {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel workbook has no sheets');
    }

    // Read first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON objects with raw values formatted
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      blankrows: false,
      raw: false,
    });

    if (rawRows.length === 0) {
      return {
        headers: [],
        rows: [],
        totalRows: 0,
        previewRows: [],
      };
    }

    // Extract trimmed headers
    const headers = Object.keys(rawRows[0]).map((h) => h.trim());

    // Normalize row keys to trimmed headers
    const rows = rawRows.map((row) => {
      const normalizedRow: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        normalizedRow[key.trim()] = typeof value === 'string' ? value.trim() : value;
      }
      return normalizedRow;
    });

    return {
      headers,
      rows,
      totalRows: rows.length,
      previewRows: rows.slice(0, 10),
    };
  }
}
