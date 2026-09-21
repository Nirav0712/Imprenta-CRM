import { XMLParser } from 'fast-xml-parser';
import { ParsedFileData } from './csv.parser';

export class SafeXmlParser {
  static parse(buffer: Buffer): ParsedFileData {
    const xmlContent = buffer.toString('utf8');

    // Secure XML Parser with XXE & entity expansion blocked
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      processEntities: false, // Block XXE / entity expansion attacks
      allowBooleanAttributes: true,
      trimValues: true,
      parseTagValue: false, // Preserve strings intact
    });

    const parsed = parser.parse(xmlContent);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid XML file structure');
    }

    // Find array of record objects within the XML tree
    const records = this.findRecordsArray(parsed);
    if (!records || records.length === 0) {
      return {
        headers: [],
        rows: [],
        totalRows: 0,
        previewRows: [],
      };
    }

    // Flatten first-level keys
    const headersSet = new Set<string>();
    const flattenedRows = records.map((record) => {
      const flat: Record<string, any> = {};
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'object' && value !== null) {
          flat[key] = JSON.stringify(value);
        } else {
          flat[key] = value !== undefined && value !== null ? String(value).trim() : '';
        }
        headersSet.add(key);
      }
      return flat;
    });

    const headers = Array.from(headersSet);

    return {
      headers,
      rows: flattenedRows,
      totalRows: flattenedRows.length,
      previewRows: flattenedRows.slice(0, 10),
    };
  }

  private static findRecordsArray(obj: any): any[] {
    // If the top level contains a root element that contains an array or items
    if (Array.isArray(obj)) return obj;

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (Array.isArray(val)) {
        return val;
      }
      if (typeof val === 'object' && val !== null) {
        // Look one level deeper (e.g. <contacts><contact>...</contact></contacts>)
        for (const subKey of Object.keys(val)) {
          const subVal = val[subKey];
          if (Array.isArray(subVal)) {
            return subVal;
          }
          if (typeof subVal === 'object' && subVal !== null) {
            // Single element wrapped as an object
            return [subVal];
          }
        }
      }
    }
    return [];
  }
}
