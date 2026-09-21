import { CsvParser } from './csv.parser';
import { ExcelParser } from './excel.parser';
import { SafeXmlParser } from './xml.parser';
import * as XLSX from 'xlsx';

describe('File Parsers', () => {
  describe('CsvParser', () => {
    it('should parse CSV with headers and records', () => {
      const csvData = `First Name,Last Name,Email,Phone\nJohn,Doe,john@example.com,+1234567890\nJane,Smith,jane@example.com,+1987654321`;
      const result = CsvParser.parse(Buffer.from(csvData));
      expect(result.headers).toEqual(['First Name', 'Last Name', 'Email', 'Phone']);
      expect(result.totalRows).toBe(2);
      expect(result.rows[0]['Email']).toBe('john@example.com');
      expect(result.rows[1]['First Name']).toBe('Jane');
    });

    it('should strip UTF-8 BOM if present', () => {
      const csvWithBom = `\ufeffName,Email\nAlice,alice@example.com`;
      const result = CsvParser.parse(Buffer.from(csvWithBom));
      expect(result.headers).toEqual(['Name', 'Email']);
      expect(result.totalRows).toBe(1);
    });
  });

  describe('ExcelParser', () => {
    it('should parse XLSX worksheet buffer', () => {
      const ws = XLSX.utils.json_to_sheet([
        { Name: 'John Doe', Email: 'john@example.com', City: 'New York' },
        { Name: 'Jane Smith', Email: 'jane@example.com', City: 'London' },
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const result = ExcelParser.parse(buffer);
      expect(result.headers).toContain('Name');
      expect(result.headers).toContain('Email');
      expect(result.headers).toContain('City');
      expect(result.totalRows).toBe(2);
      expect(result.rows[0]['Name']).toBe('John Doe');
    });
  });

  describe('SafeXmlParser', () => {
    it('should parse XML with contact list', () => {
      const xml = `
        <contacts>
          <contact>
            <firstName>John</firstName>
            <email>john@example.com</email>
          </contact>
          <contact>
            <firstName>Jane</firstName>
            <email>jane@example.com</email>
          </contact>
        </contacts>
      `;
      const result = SafeXmlParser.parse(Buffer.from(xml));
      expect(result.headers).toContain('firstName');
      expect(result.headers).toContain('email');
      expect(result.totalRows).toBe(2);
      expect(result.rows[0]['email']).toBe('john@example.com');
    });
  });
});
