/**
 * High-Precision Italian PDF & Document Installment Detector
 * Dedicated to detecting installment schedules, multiple payment deadlines,
 * PagoPA avvisi, and postal slips from parsed PDF text and documents.
 */

import { InvoiceInstallment } from '../types';

export const ITALIAN_MONTHS_MAP: Record<string, string> = {
  gennaio: '01',
  febbraio: '02',
  marzo: '03',
  aprile: '04',
  maggio: '05',
  giugno: '06',
  luglio: '07',
  agosto: '08',
  settembre: '09',
  ottobre: '10',
  novembre: '11',
  dicembre: '12',
  gen: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  mag: '05',
  giu: '06',
  lug: '07',
  ago: '08',
  set: '09',
  ott: '10',
  nov: '11',
  dic: '12',
};

const ORDINAL_NUMBERS_MAP: Record<string, number> = {
  prima: 1,
  seconda: 2,
  terza: 3,
  quarta: 4,
  quinta: 5,
  sesta: 6,
  settima: 7,
  ottava: 8,
  nona: 9,
  decima: 10,
  '1a': 1,
  '2a': 2,
  '3a': 3,
  '4a': 4,
  '5a': 5,
  '6a': 6,
  '1ª': 1,
  '2ª': 2,
  '3ª': 3,
  '4ª': 4,
  '5ª': 5,
  '6ª': 6,
  '1°': 1,
  '2°': 2,
  '3°': 3,
  '4°': 4,
  '1^': 1,
  '2^': 2,
  '3^': 3,
  '4^': 4,
};

/**
 * Normalizes an Italian date string to DD/MM/YYYY
 */
export function normalizeDateString(rawDate: string): string | null {
  if (!rawDate) return null;
  const clean = rawDate.trim();

  // 1. Numerical format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const numMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    let year = numMatch[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    const dNum = parseInt(day, 10);
    const mNum = parseInt(month, 10);
    if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12) {
      return `${day}/${month}/${year}`;
    }
  }

  // 2. Month name in Italian: "15 aprile 2025"
  const textMatch = clean.match(/^(\d{1,2})\s+([a-zA-Z]{3,10})\s+(\d{2,4})$/i);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const mStr = textMatch[2].toLowerCase();
    const month = ITALIAN_MONTHS_MAP[mStr];
    let year = textMatch[3];
    if (year.length === 2) year = `20${year}`;
    if (month) {
      return `${day}/${month}/${year}`;
    }
  }

  return null;
}

/**
 * Parses Italian currency format: "1.234,56" or "150,00" or "150.00" -> number
 */
export function parseCurrencyAmount(rawStr: string): number {
  if (!rawStr) return 0;
  const clean = rawStr.trim().replace(/[€\sEUR]/gi, '');
  if (clean.includes(',') && clean.includes('.')) {
    // 1.234,56
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  } else if (clean.includes(',')) {
    // 1234,56
    return parseFloat(clean.replace(',', '.'));
  } else {
    // 1234.56
    return parseFloat(clean);
  }
}

/**
 * Checks whether text or file has keywords indicating possible installments
 */
export function hasInstallmentIndicators(text: string, fileName = ''): boolean {
  const combined = `${fileName} ${text}`.toLowerCase();

  // Check explicit installment/schedule keywords
  if (
    combined.includes('rateizz') ||
    combined.includes('scadenziario') ||
    combined.includes('scadenzario') ||
    combined.includes('prospetto rate') ||
    combined.includes('dettaglio rate') ||
    combined.includes('piano rate') ||
    combined.includes('piano di rientro') ||
    combined.includes('piano di rateizzazione') ||
    combined.includes('frazionato in') ||
    combined.includes('pagamento rateale') ||
    combined.includes('bollettini') ||
    combined.includes('unica soluzione oppure') ||
    combined.includes('oppure in') ||
    /\b(?:1[ª^°a]|2[ª^°a]|3[ª^°a]|4[ª^°a])\s*rata\b/i.test(combined) ||
    /\brata\s*(?:n[r°\.]?|numero)?\s*[1-9]\b/i.test(combined) ||
    /\brate\s*(?:di|da)\s*€?\s*\d+/i.test(combined) ||
    /\bbollettino\s*(?:n[r°\.]?|numero)?\s*[1-9]\b/i.test(combined) ||
    /\bavviso\s*(?:n[r°\.]?|numero)?\s*[1-9]\s*di\s*[1-9]\b/i.test(combined)
  ) {
    return true;
  }

  // Check if "scadenza" or "scadenze" or "metodo di pagamento" appears with 2+ dates
  const hasPaymentOrDeadlineWord =
    /\b(?:scadenz[ae]|scadenziario|scadenzario|metod[oi]\s*di\s*pagamento|modalit[àa]\s*di\s*pagamento|condizion[ei]\s*di\s*pagamento|dati\s*di\s*pagamento|dettaglio\s*scadenze)\b/i.test(
      combined
    );

  if (hasPaymentOrDeadlineWord) {
    const dates = combined.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g) || [];
    if (dates.length >= 2) return true;
  }

  // Check if the last lines of the text (footer/piè di pagina) contain multiple dates
  const textLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const footerText = textLines.slice(-12).join(' ');
  const footerDates = footerText.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g) || [];
  if (footerDates.length >= 2) {
    return true;
  }

  return false;
}

interface RawDetectedInstallment {
  installmentNumber: number;
  totalInstallments?: number;
  dueDate: string;
  amount: number;
  paymentMethod?: string;
  iban?: string;
  notes?: string;
  isUnicaSoluzione?: boolean;
}

/**
 * Main engine: Extracts installment plans from PDF text with multiple fallback heuristics
 */
export function detectInstallmentsFromText(
  text: string,
  invoiceTotalAmount?: number,
  defaultDueDate?: string
): {
  isInstallmentPlan: boolean;
  installments: InvoiceInstallment[];
  confidence: 'high' | 'medium' | 'single';
} {
  if (!text || text.trim().length === 0) {
    return {
      isInstallmentPlan: false,
      installments: [createSingleInstallment(1, defaultDueDate || '', invoiceTotalAmount || 0)],
      confidence: 'single',
    };
  }

  const rawList: RawDetectedInstallment[] = [];
  const allTrimmedLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // -------------------------------------------------------------------------
  // Strategy 0: Bottom / Last Lines Extraction (Fondo fattura & Ultima riga)
  // In many Italian invoices (Zucchetti, Danea, TeamSystem, Passepartout, etc.)
  // the installment schedule is printed on the very last line or in the footer:
  // e.g. "Scadenze: 30/04/2025 € 610,00 31/05/2025 € 610,00"
  // or "31/03/2025 500,00 30/04/2025 500,00 31/05/2025 500,00"
  // -------------------------------------------------------------------------
  const footerLines = allTrimmedLines.slice(-15);

  // Check 0A: Scan lines in footer from bottom to top for multi-pair installments
  for (let li = footerLines.length - 1; li >= 0; li--) {
    const line = footerLines[li];
    if (/\b(?:data\s*fattura|data\s*emissione|data\s*doc|del\s*documento)\b/i.test(line) && !/scadenz/i.test(line)) {
      continue;
    }

    const multiPairRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[^\d\n\r€]{0,40}?€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/g;
    let pMatch: RegExpExecArray | null;
    const linePairs: { date: string; amount: number }[] = [];

    while ((pMatch = multiPairRegex.exec(line)) !== null) {
      const normD = normalizeDateString(pMatch[1]);
      const parsedA = parseCurrencyAmount(pMatch[2]);
      if (normD && parsedA > 0) {
        linePairs.push({ date: normD, amount: parsedA });
      }
    }

    // If 2 or more installments were found in a single footer line
    if (linePairs.length >= 2) {
      linePairs.forEach((p, pIdx) => {
        rawList.push({
          installmentNumber: pIdx + 1,
          totalInstallments: linePairs.length,
          dueDate: p.date,
          amount: p.amount,
          notes: `Rata ${pIdx + 1} di ${linePairs.length} (fondo fattura)`,
        });
      });
      break;
    }
  }

  // Check 0B: Parallel rows in footer (row i has dates, row i+1 has amounts)
  for (let li = 0; li < footerLines.length - 1; li++) {
    const l1 = footerLines[li];
    const l2 = footerLines[li + 1];
    const dates = l1.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g);
    const amounts = l2.match(/\b(?:[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/g);

    if (dates && amounts && dates.length >= 2 && dates.length === amounts.length) {
      for (let k = 0; k < dates.length; k++) {
        const normD = normalizeDateString(dates[k]);
        const parsedA = parseCurrencyAmount(amounts[k]);
        if (normD && parsedA > 0) {
          rawList.push({
            installmentNumber: k + 1,
            totalInstallments: dates.length,
            dueDate: normD,
            amount: parsedA,
            notes: `Rata ${k + 1} di ${dates.length} (tabella piè di pagina)`,
          });
        }
      }
      break;
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 1: Section-Based Extraction
  // Look for sections introduced by:
  // "Scadenza", "Scadenze", "Metodo di pagamento", "Modalità di pagamento",
  // "Condizioni di pagamento", "Dati di pagamento", "Dettaglio scadenze", etc.
  // -------------------------------------------------------------------------
  const sectionHeaderRegex = /(?:(?:metod[oi]|modalit[àa]|condizion[ei]|termin[ei]|dati|dettagli[oi]|informazion[ei]|forma|tipo)\s*(?:di\s*|sul\s*|sui\s*|per\s*il\s*)?pagament[oi]|scadenz[ae]|scadenziario|scadenzario|date\s*di\s*scadenza|scadenze\s*di\s*pagamento|scadenza\s*pagamento|piano\s*(?:di\s*)?(?:rateizzazione|rientro|pagamento|rate)|prospetto\s*rate|dettaglio\s*(?:delle\s*)?rate|dettaglio\s*(?:delle\s*)?scadenze|rate\s*da\s*pagare|elenco\s*scadenze)/gi;

  let secMatch: RegExpExecArray | null;
  while ((secMatch = sectionHeaderRegex.exec(text)) !== null) {
    const startIndex = secMatch.index;
    const windowText = text.substring(startIndex, Math.min(startIndex + 1500, text.length));

    // Detect payment method within this section window
    let secMethod: string | undefined = undefined;
    if (/bonifico/i.test(windowText)) secMethod = 'Bonifico bancario';
    else if (/sdd|addebito\s*diretto|sepa|rid/i.test(windowText)) secMethod = 'Addebito SEPA (SDD)';
    else if (/rimessa\s*diretta/i.test(windowText)) secMethod = 'Rimessa diretta';
    else if (/pagopa|iuv/i.test(windowText)) secMethod = 'PagoPA';
    else if (/bollettino|c\/c\s*postale/i.test(windowText)) secMethod = 'Bollettino postale';
    else if (/ri\.?ba\.?|ricevuta\s*bancaria/i.test(windowText)) secMethod = 'Ri.Ba.';

    // Detect IBAN within section
    const secIbanMatch = windowText.match(/\b(IT[0-9]{2}[A-Z][0-9]{10}[0-9A-Z]{12})\b/i);
    const secIban = secIbanMatch ? secIbanMatch[1].toUpperCase() : undefined;

    // Scan lines in this section window
    const secLines = windowText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    for (let li = 0; li < secLines.length; li++) {
      const line = secLines[li];

      // Skip non-installment lines such as invoice date or customer codes
      if (/\b(?:data\s*fattura|data\s*emissione|data\s*doc|del\s*documento)\b/i.test(line) && !/scadenz/i.test(line)) {
        continue;
      }

      const isUnica = /unica\s*soluzione/i.test(line);

      // Case A1: Check if line has multiple Date-Amount pairs (e.g. "30/04/2025 € 610,00  31/05/2025 € 610,00")
      const multiInLineRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[^\d\n\r€]{0,40}?€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/g;
      let multiM: RegExpExecArray | null;
      const foundInLine: { date: string; amount: number }[] = [];
      while ((multiM = multiInLineRegex.exec(line)) !== null) {
        const d = normalizeDateString(multiM[1]);
        const a = parseCurrencyAmount(multiM[2]);
        if (d && a > 0) foundInLine.push({ date: d, amount: a });
      }

      if (foundInLine.length >= 2) {
        foundInLine.forEach((item, itemIdx) => {
          rawList.push({
            installmentNumber: isUnica ? 999 : itemIdx + 1,
            dueDate: item.date,
            amount: item.amount,
            paymentMethod: secMethod,
            iban: secIban,
            notes: isUnica ? 'Pagamento in Unica Soluzione' : `Scadenza del ${item.date}`,
            isUnicaSoluzione: isUnica,
          });
        });
        continue;
      }

      // Case A2: Single line with both Date and Amount
      const dateMatch =
        line.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/) ||
        line.match(/\b(\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\s+\d{2,4})\b/i);

      const amtMatch =
        line.match(/(?:importo|rata|euro|€|da versare|saldo|pari a|scadenza)?[^\d\n\r€]*[:=]?\s*€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/) ||
        line.match(/\b([0-9]+,[0-9]{2})\b/) ||
        line.match(/€\s*([0-9]+(?:\.[0-9]{2})?)\b/);

      if (dateMatch && amtMatch) {
        const normDate = normalizeDateString(dateMatch[1]);
        const parsedAmt = parseCurrencyAmount(amtMatch[1]);

        if (normDate && parsedAmt > 0) {
          // Check for optional ordinal or installment number on the line
          const numMatch = line.match(/\b(?:rata\s*(?:n[r°\.]?|numero)?\s*|scadenza\s*(?:n[r°\.]?|numero)?\s*|^)([1-9]|0[1-9])\b/i);
          const instNum = numMatch ? parseInt(numMatch[1], 10) : rawList.length + 1;

          rawList.push({
            installmentNumber: isUnica ? 999 : instNum,
            dueDate: normDate,
            amount: parsedAmt,
            paymentMethod: secMethod,
            iban: secIban,
            notes: isUnica ? 'Pagamento in Unica Soluzione' : `Scadenza del ${normDate}`,
            isUnicaSoluzione: isUnica,
          });
          continue;
        }
      }

      // Case B: Alternating lines (Line li has Date, Line li+1 has Amount)
      if (li < secLines.length - 1) {
        const nextLine = secLines[li + 1];
        const dateOnlyMatch = line.match(/^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})$/);
        const amtOnlyMatch = nextLine.match(/^€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s*€?$/);

        if (dateOnlyMatch && amtOnlyMatch) {
          const normDate = normalizeDateString(dateOnlyMatch[1]);
          const parsedAmt = parseCurrencyAmount(amtOnlyMatch[1]);
          if (normDate && parsedAmt > 0) {
            rawList.push({
              installmentNumber: rawList.length + 1,
              dueDate: normDate,
              amount: parsedAmt,
              paymentMethod: secMethod,
              iban: secIban,
              notes: `Scadenza del ${normDate}`,
              isUnicaSoluzione: false,
            });
            li++; // skip next line
            continue;
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 2: Repeating "Scadenza:" or "Data Scadenza" Lines Across Document
  // e.g.
  // Scadenza: 15/04/2025 Importo: € 150,00
  // Scadenza: 15/05/2025 Importo: € 150,00
  // -------------------------------------------------------------------------
  const repeatingScadenzaRegex = /(?:scadenza|scad\.?|data\s*scadenza)\s*(?:n[r°\.]?|numero)?\s*([1-9]|0[1-9])?[^\d\n\r]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[^\d\n\r€]*[:=]?\s*€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/gi;
  let repMatch: RegExpExecArray | null;

  while ((repMatch = repeatingScadenzaRegex.exec(text)) !== null) {
    const rNum = repMatch[1] ? parseInt(repMatch[1], 10) : rawList.length + 1;
    const rDate = normalizeDateString(repMatch[2]);
    const rAmt = parseCurrencyAmount(repMatch[3]);

    if (rDate && rAmt > 0) {
      rawList.push({
        installmentNumber: rNum,
        dueDate: rDate,
        amount: rAmt,
        notes: `Scadenza ${rNum}`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 3: Tabular Installment Schedules
  // e.g.
  // 1   15/04/2025   € 150,00
  // 2   15/05/2025   € 150,00
  // or
  // 15/04/2025   150,00
  // 15/05/2025   150,00
  // -------------------------------------------------------------------------
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip document date lines
    if (/\b(?:data\s*fattura|data\s*emissione|data\s*doc|del\s*documento)\b/i.test(line) && !/scadenz/i.test(line)) {
      continue;
    }

    // Format: [Rata] [Num] [Date] [Amount]
    const tableRowPattern = /^(?:rata\s*(?:n[r°\.]?|numero)?\s*)?([1-9]|0[1-9])\b[^\d\n\r]*\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b[^\d\n\r€]*€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/i;
    const match = line.match(tableRowPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      const normalizedDate = normalizeDateString(match[2]);
      const amt = parseCurrencyAmount(match[3]);

      if (normalizedDate && amt > 0 && num <= 36) {
        rawList.push({
          installmentNumber: num,
          dueDate: normalizedDate,
          amount: amt,
          notes: `Rata ${num} da tabella scadenze`,
        });
      }
      continue;
    }

    // Format: [Num] [Amount] [Date]
    // e.g. "1 € 150,00 15/04/2025"
    const tableRowReverse = /^(?:rata\s*(?:n[r°\.]?|numero)?\s*)?([1-9]|0[1-9])\b[^\d\n\r€]*€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b[^\d\n\r]*\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/i;
    const matchRev = line.match(tableRowReverse);
    if (matchRev) {
      const num = parseInt(matchRev[1], 10);
      const amt = parseCurrencyAmount(matchRev[2]);
      const normalizedDate = normalizeDateString(matchRev[3]);

      if (normalizedDate && amt > 0 && num <= 36) {
        rawList.push({
          installmentNumber: num,
          dueDate: normalizedDate,
          amount: amt,
          notes: `Rata ${num} da tabella scadenze`,
        });
      }
      continue;
    }

    // Format: [Date] [Amount] (standalone date row without numbers, e.g. "15/04/2025  150,00")
    const dateAmtOnlyPattern = /^\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+[^\d\n\r€]*€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s*$/i;
    const matchDateAmt = line.match(dateAmtOnlyPattern);
    if (matchDateAmt) {
      const normalizedDate = normalizeDateString(matchDateAmt[1]);
      const amt = parseCurrencyAmount(matchDateAmt[2]);
      if (normalizedDate && amt > 0) {
        rawList.push({
          installmentNumber: rawList.length + 1,
          dueDate: normalizedDate,
          amount: amt,
          notes: `Scadenza ${normalizedDate}`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 4: Multi-line Installment Blocks & Cards
  // Often in bills, text flows across lines:
  // "1ª Rata" or "Rata n. 1 di 3" ...
  // followed by "Scadenza: 15/04/2025" ...
  // and "Importo: € 150,00"
  // -------------------------------------------------------------------------
  const blockRegex = /(?:([1-9]|0[1-9])\s*[ª^°a]?\s*rata|rata\s*(?:n[r°\.]?|numero)?\s*([1-9]|0[1-9])(?:\s*di\s*([1-9]|0[1-9]))?|rata\s*unica|unica\s*soluzione|(prima|seconda|terza|quarta|quinta|sesta)\s+rata)/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(text)) !== null) {
    const matchedText = blockMatch[0].toLowerCase();
    const isUnica = matchedText.includes('unica');

    let num = 1;
    let totalFromBlock: number | undefined = undefined;

    if (blockMatch[1]) {
      num = parseInt(blockMatch[1], 10);
    } else if (blockMatch[2]) {
      num = parseInt(blockMatch[2], 10);
      if (blockMatch[3]) {
        totalFromBlock = parseInt(blockMatch[3], 10);
      }
    } else if (blockMatch[4]) {
      num = ORDINAL_NUMBERS_MAP[blockMatch[4].toLowerCase()] || 1;
    }

    const startIndex = blockMatch.index;
    // Look ahead 400 characters for date and amount associated with this installment
    const windowText = text.substring(startIndex, Math.min(startIndex + 450, text.length));

    // Extract Date in window
    let detectedDate: string | null = null;
    const dateMatch = windowText.match(/(?:scadenza|scad\.?|entro il|pagamento entro|addebito entro|data)[^\d\n\r]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ||
      windowText.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);

    if (dateMatch) {
      detectedDate = normalizeDateString(dateMatch[1]);
    } else {
      // Month in words
      const textDateMatch = windowText.match(/(?:scadenza|entro il)[^\d\n\r]*(\d{1,2})\s+([a-zA-Z]{4,10})\s+(\d{4})/i);
      if (textDateMatch) {
        detectedDate = normalizeDateString(`${textDateMatch[1]} ${textDateMatch[2]} ${textDateMatch[3]}`);
      }
    }

    // Extract Amount in window
    let detectedAmount = 0;
    const amtMatch = windowText.match(/(?:importo|rata|euro|€|da versare|saldo|pari a)[^\d\n\r€]*[:=]?\s*€?\s*([\d\.]+,\d{2})/i) ||
      windowText.match(/\b€\s*([\d\.]+,\d{2})\b/i) ||
      windowText.match(/\b([\d\.]+,\d{2})\s*€/i);

    if (amtMatch) {
      detectedAmount = parseCurrencyAmount(amtMatch[1]);
    }

    // Extract IUV or Bollettino code if present
    const iuvMatch = windowText.match(/(?:iuv|codice\s*avviso|avviso\s*n[r°\.]?)[^\d\n\r]*[:=]?\s*(\d{15,18})/i);
    const iuvCode = iuvMatch ? iuvMatch[1] : undefined;

    if (detectedDate && detectedAmount > 0) {
      rawList.push({
        installmentNumber: isUnica ? 999 : num,
        totalInstallments: totalFromBlock,
        dueDate: detectedDate,
        amount: detectedAmount,
        notes: isUnica
          ? 'Pagamento in Unica Soluzione'
          : `Rata ${num}${totalFromBlock ? ' di ' + totalFromBlock : ''}${iuvCode ? ' (IUV ' + iuvCode + ')' : ''}`,
        isUnicaSoluzione: isUnica,
        paymentMethod: iuvCode ? 'PagoPA' : undefined,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 3: PagoPA Avvisi Slips (Bollettini PagoPA)
  // Look for distinct "Avviso di pagamento" or "Codice Avviso" blocks
  // -------------------------------------------------------------------------
  const pagopaRegex = /(?:avviso\s*di\s*pagamento|bollettino\s*pagopa|codice\s*avviso)[^\d\n\r]*(\d{15,18})[\s\S]{1,300}?(?:scadenza|entro il)[^\d\n\r]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[\s\S]{1,200}?€?\s*([\d\.]+,\d{2})/gi;
  let pagoMatch: RegExpExecArray | null;

  while ((pagoMatch = pagopaRegex.exec(text)) !== null) {
    const iuv = pagoMatch[1];
    const dDate = normalizeDateString(pagoMatch[2]);
    const dAmt = parseCurrencyAmount(pagoMatch[3]);

    if (dDate && dAmt > 0) {
      // Check if already captured
      const exists = rawList.some((r) => r.dueDate === dDate && Math.abs(r.amount - dAmt) < 0.05);
      if (!exists) {
        rawList.push({
          installmentNumber: rawList.length + 1,
          dueDate: dDate,
          amount: dAmt,
          paymentMethod: 'PagoPA',
          notes: `Avviso PagoPA (IUV ${iuv})`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 4: Multiple Postal Slips (Bollettini Postali)
  // e.g. "CONTO CORRENTE POSTALE N. ..." with "Rata 1" or "Rata 2"
  // -------------------------------------------------------------------------
  const slipRegex = /(?:bollettino\s*(?:postale|n[r°\.]?|numero)?\s*([1-9]))[^\d\n\r€]*€?\s*([\d\.]+,\d{2})[\s\S]{1,200}?(?:scadenza|entro il)[^\d\n\r]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi;
  let slipMatch: RegExpExecArray | null;

  while ((slipMatch = slipRegex.exec(text)) !== null) {
    const slipNum = parseInt(slipMatch[1], 10);
    const slipAmt = parseCurrencyAmount(slipMatch[2]);
    const slipDate = normalizeDateString(slipMatch[3]);

    if (slipDate && slipAmt > 0) {
      const exists = rawList.some((r) => r.dueDate === slipDate && Math.abs(r.amount - slipAmt) < 0.05);
      if (!exists) {
        rawList.push({
          installmentNumber: slipNum,
          dueDate: slipDate,
          amount: slipAmt,
          paymentMethod: 'Bollettino postale',
          notes: `Bollettino postale n. ${slipNum}`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Deduplication, Sorting, and Reconciliation
  // -------------------------------------------------------------------------
  if (rawList.length === 0) {
    return {
      isInstallmentPlan: false,
      installments: [createSingleInstallment(1, defaultDueDate || '', invoiceTotalAmount || 0)],
      confidence: 'single',
    };
  }

  // Separate non-unica installments from unica soluzione
  const nonUnica = rawList.filter((r) => !r.isUnicaSoluzione);
  const unicaList = rawList.filter((r) => r.isUnicaSoluzione);

  let candidateList = nonUnica.length >= 2 ? nonUnica : rawList;

  // Deduplicate by key: `${dueDate}-${amount.toFixed(2)}`
  const uniqueMap = new Map<string, RawDetectedInstallment>();
  candidateList.forEach((inst) => {
    const key = `${inst.dueDate}-${inst.amount.toFixed(2)}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, inst);
    } else {
      // Keep one with more info (notes/paymentMethod)
      const existing = uniqueMap.get(key)!;
      if (inst.notes && !existing.notes) uniqueMap.set(key, inst);
    }
  });

  let uniqueInstallments = Array.from(uniqueMap.values());

  // If we still have multiple installments and some were labeled "Unica soluzione", drop the "Unica soluzione"
  if (uniqueInstallments.length > 1) {
    uniqueInstallments = uniqueInstallments.filter((r) => !r.isUnicaSoluzione);
  }

  // Filter out any candidate installment whose amount equals the sum of the other installments
  // (e.g., if a total line like "Totale da pagare € 300,00" was matched alongside two installments of 150,00)
  if (uniqueInstallments.length > 2) {
    const totalCandidate = uniqueInstallments.find((candidate) => {
      const others = uniqueInstallments.filter((other) => other !== candidate);
      const othersSum = others.reduce((s, o) => s + o.amount, 0);
      return Math.abs(othersSum - candidate.amount) < 0.05;
    });
    if (totalCandidate) {
      uniqueInstallments = uniqueInstallments.filter((item) => item !== totalCandidate);
    }
  }

  // Sort chronologically by due date, or by installmentNumber
  uniqueInstallments.sort((a, b) => {
    const timeA = parseDateToMillis(a.dueDate);
    const timeB = parseDateToMillis(b.dueDate);
    if (timeA !== timeB) return timeA - timeB;
    return a.installmentNumber - b.installmentNumber;
  });

  // Re-number sequentially if multi-installment
  const isMulti = uniqueInstallments.length > 1;
  const totalCount = uniqueInstallments.length;

  const finalInstallments: InvoiceInstallment[] = uniqueInstallments.map((inst, idx) => {
    const num = isMulti ? idx + 1 : 1;
    return {
      id: `inst-${Math.random().toString(36).substring(2, 9)}`,
      installmentNumber: num,
      totalInstallments: totalCount,
      dueDate: inst.dueDate,
      amount: inst.amount,
      paymentMethod: inst.paymentMethod || 'Bonifico bancario',
      iban: inst.iban,
      isPaid: false,
      notes: isMulti ? `Rata ${num} di ${totalCount}${inst.notes ? ' - ' + inst.notes : ''}` : inst.notes || '',
    };
  });

  // Calculate sum and compare with invoice total amount if provided
  const sumAmounts = finalInstallments.reduce((sum, inst) => sum + inst.amount, 0);
  let confidence: 'high' | 'medium' | 'single' = 'medium';

  if (isMulti) {
    if (invoiceTotalAmount && Math.abs(sumAmounts - invoiceTotalAmount) < 0.1) {
      confidence = 'high';
    } else {
      confidence = 'medium';
    }
  } else {
    confidence = 'single';
  }

  return {
    isInstallmentPlan: isMulti,
    installments: finalInstallments,
    confidence,
  };
}

function createSingleInstallment(num: number, dueDate: string, amount: number): InvoiceInstallment {
  return {
    id: `inst-${Math.random().toString(36).substring(2, 9)}`,
    installmentNumber: num,
    totalInstallments: 1,
    dueDate: dueDate || '',
    amount: amount || 0,
    paymentMethod: 'Bonifico bancario',
    isPaid: false,
  };
}

function parseDateToMillis(dStr: string): number {
  if (!dStr || !dStr.includes('/')) return 0;
  const [d, m, y] = dStr.split('/').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}
