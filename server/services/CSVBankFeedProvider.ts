import crypto from "crypto";
import { CsvColumnMapping } from "@/lib/validation/banking";
import { CalculationEngine } from "./CalculationEngine";

export interface ParsedTransactionRow {
  rowNumber: number;
  transactionDate: Date;
  description: string;
  reference?: string;
  payee?: string;
  amount: number;
  fingerprint: string;
  isDuplicate?: boolean;
}

export interface ParsedStatementResult {
  headers: string[];
  rows: ParsedTransactionRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  totalInflow: number;
  totalOutflow: number;
  netAmount: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

export class CSVBankFeedProvider {
  /**
   * Generates a deterministic SHA-256 fingerprint for deduplication.
   *
   * The occurrenceIndex disambiguates legitimate same-day transactions with
   * identical amounts and descriptions (e.g., two ATM withdrawals).
   * Re-importing the same CSV file produces the same fingerprints (same row
   * order → same occurrence index), so true file-level duplicates are still
   * detected, while distinct real transactions are preserved.
   */
  static generateFingerprint(
    organizationId: string,
    bankAccountId: string,
    date: Date,
    amount: number,
    reference?: string,
    description?: string,
    occurrenceIndex?: number
  ): string {
    const dateStr = date.toISOString().split("T")[0];
    const amountStr = amount.toFixed(2);
    const cleanRef = (reference || "").trim().toLowerCase();
    const cleanDesc = (description || "").trim().toLowerCase().slice(0, 50);
    const occSuffix = occurrenceIndex !== undefined && occurrenceIndex > 0 ? `:${occurrenceIndex}` : "";

    const raw = `${organizationId}:${bankAccountId}:${dateStr}:${amountStr}:${cleanRef || cleanDesc}${occSuffix}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  /**
   * Parse a CSV string into rows handling quoted cells and custom delimiters.
   */
  static parseCsvLines(csvContent: string, delimiter = ","): string[][] {
    const lines = csvContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const result: string[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row: string[] = [];
      let inQuotes = false;
      let currentField = "";

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          if (inQuotes && line[j + 1] === '"') {
            currentField += '"';
            j++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          row.push(currentField.trim());
          currentField = "";
        } else {
          currentField += char;
        }
      }
      row.push(currentField.trim());
      result.push(row);
    }

    return result;
  }

  /**
   * Parses flexible date formats (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, ISO).
   */
  static parseDate(dateStr: string, preferredFormat = "YYYY-MM-DD"): Date {
    const clean = dateStr.trim();
    if (!clean) throw new Error("Empty date field");

    // ISO format or YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) return d;
    }

    // Slash or dot or dash separated: MM/DD/YYYY or DD/MM/YYYY
    const parts = clean.split(/[/.-]/);
    if (parts.length === 3) {
      if (preferredFormat === "DD/MM/YYYY") {
        const [day, month, year] = parts.map(Number);
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) return d;
      } else {
        const [month, day, year] = parts.map(Number);
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) return d;
      }
    }

    const fallback = new Date(clean);
    if (!isNaN(fallback.getTime())) return fallback;

    throw new Error(`Unable to parse date string: "${clean}"`);
  }

  /**
   * Sanitizes cell text to prevent formula injection (=, +, -, @).
   */
  static sanitizeCell(val: string): string {
    const trimmed = val.trim();
    if (!trimmed) return "";
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      if (/^[+\-]\d+(\.\d+)?$/.test(trimmed)) {
        return trimmed;
      }
      return `'${trimmed}`;
    }
    return trimmed;
  }

  /**
   * Parses CSV content according to column mappings and calculates fingerprints.
   */
  static parse(
    organizationId: string,
    bankAccountId: string,
    csvContent: string,
    mapping: CsvColumnMapping
  ): ParsedStatementResult {
    const rawRows = this.parseCsvLines(csvContent, mapping.delimiter || ",");
    if (rawRows.length === 0) {
      throw new Error("CSV file is empty.");
    }

    const headers = mapping.hasHeader ? rawRows[0] : rawRows[0].map((_, i) => `Column_${i + 1}`);
    const dataRows = mapping.hasHeader ? rawRows.slice(1) : rawRows;

    if (dataRows.length > 5000) {
      throw new Error("CSV file exceeds maximum limit of 5,000 rows per batch.");
    }

    const getColIndex = (colName?: string | null): number => {
      if (!colName) return -1;
      return headers.findIndex((h) => h.toLowerCase() === colName.toLowerCase());
    };

    const dateIdx = getColIndex(mapping.dateColumn);
    const descIdx = getColIndex(mapping.descriptionColumn);
    const amountIdx = getColIndex(mapping.amountColumn);
    const inflowIdx = getColIndex(mapping.inflowColumn);
    const outflowIdx = getColIndex(mapping.outflowColumn);
    const refIdx = getColIndex(mapping.referenceColumn);
    const payeeIdx = getColIndex(mapping.payeeColumn);

    if (dateIdx === -1) {
      throw new Error(`Date column '${mapping.dateColumn}' not found in CSV headers.`);
    }
    if (descIdx === -1) {
      throw new Error(`Description column '${mapping.descriptionColumn}' not found in CSV headers.`);
    }
    if (amountIdx === -1 && (inflowIdx === -1 || outflowIdx === -1)) {
      throw new Error("Specified Amount or Inflow/Outflow columns not found in CSV headers.");
    }

    const rows: ParsedTransactionRow[] = [];
    const errors: Array<{ rowNumber: number; message: string }> = [];

    let totalInflow = 0;
    let totalOutflow = 0;

    // Track occurrence counts for same base fingerprint to disambiguate
    // legitimate duplicate transactions (e.g., two identical ATM withdrawals)
    const baseFingerprintCounts = new Map<string, number>();

    dataRows.forEach((row, idx) => {
      const rowNumber = idx + (mapping.hasHeader ? 2 : 1);

      try {
        const rawDate = row[dateIdx];
        if (!rawDate) {
          throw new Error("Missing date value");
        }
        const transactionDate = this.parseDate(rawDate, mapping.dateFormat);

        const description = this.sanitizeCell(row[descIdx] || "");
        if (!description) {
          throw new Error("Missing description value");
        }

        let amount = 0;
        if (amountIdx !== -1 && row[amountIdx]) {
          const cleaned = row[amountIdx].replace(/[$,\s]/g, "");
          const parsed = parseFloat(cleaned);
          if (isNaN(parsed)) throw new Error(`Invalid amount: "${row[amountIdx]}"`);
          amount = CalculationEngine.roundMoney(parsed);
        } else {
          const inflowRaw = inflowIdx !== -1 && row[inflowIdx] ? row[inflowIdx].replace(/[$,\s]/g, "") : "0";
          const outflowRaw = outflowIdx !== -1 && row[outflowIdx] ? row[outflowIdx].replace(/[$,\s]/g, "") : "0";

          const inflow = parseFloat(inflowRaw) || 0;
          const outflow = parseFloat(outflowRaw) || 0;
          amount = CalculationEngine.roundMoney(inflow - Math.abs(outflow));
        }

        if (amount === 0) {
          // Skip zero amounts
          return;
        }

        const reference = refIdx !== -1 && row[refIdx] ? this.sanitizeCell(row[refIdx]) : undefined;
        const payee = payeeIdx !== -1 && row[payeeIdx] ? this.sanitizeCell(row[payeeIdx]) : undefined;

        // Generate base fingerprint (without occurrence) to detect duplicates within file
        const baseFingerprint = this.generateFingerprint(
          organizationId,
          bankAccountId,
          transactionDate,
          amount,
          reference,
          description
        );

        // Track how many times we've seen this base fingerprint in this file
        const occurrenceCount = baseFingerprintCounts.get(baseFingerprint) || 0;
        baseFingerprintCounts.set(baseFingerprint, occurrenceCount + 1);

        // Generate final fingerprint with occurrence index for disambiguation
        const fingerprint = occurrenceCount === 0
          ? baseFingerprint
          : this.generateFingerprint(
              organizationId,
              bankAccountId,
              transactionDate,
              amount,
              reference,
              description,
              occurrenceCount
            );

        if (amount > 0) {
          totalInflow = CalculationEngine.roundMoney(totalInflow + amount);
        } else {
          totalOutflow = CalculationEngine.roundMoney(totalOutflow + Math.abs(amount));
        }

        rows.push({
          rowNumber,
          transactionDate,
          description,
          reference,
          payee,
          amount,
          fingerprint,
        });
      } catch (err: any) {
        errors.push({
          rowNumber,
          message: err.message || "Failed to parse row",
        });
      }
    });

    const netAmount = CalculationEngine.roundMoney(totalInflow - totalOutflow);

    return {
      headers,
      rows,
      totalRows: dataRows.length,
      validRows: rows.length,
      invalidRows: errors.length,
      totalInflow,
      totalOutflow,
      netAmount,
      errors,
    };
  }
}
