import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import {
  parseFatturaPaXml,
  extractXmlFromP7mBuffer,
} from './src/utils/xmlInvoiceParser';
import {
  detectInstallmentsFromText,
  hasInstallmentIndicators,
  normalizeDateString,
  parseCurrencyAmount,
} from './src/utils/pdfInstallmentDetector';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
let geminiCooldownUntil = 0;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI();
  }
  return aiClient;
}

// Italian months dictionary
const ITALIAN_MONTHS: Record<string, string> = {
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
};

// High-precision local parser for Italian invoices and utility bills
function extractFromTextOrXml(text: string, fileName: string) {
  // If text contains XML / FatturaPA tags, use dedicated high-precision XML parser
  if (
    text.includes('FatturaElettronica') ||
    text.includes('CedentePrestatore') ||
    text.includes('DatiGeneraliDocumento') ||
    /<\?xml\b/i.test(text) ||
    fileName.toLowerCase().endsWith('.xml')
  ) {
    const xmlRes = parseFatturaPaXml(text, fileName);
    if (xmlRes.success && xmlRes.data && (xmlRes.data.amount > 0 || xmlRes.data.invoiceNumber)) {
      return {
        hasGenuineDueDate: xmlRes.data.hasGenuineDueDate,
        data: xmlRes.data,
      };
    }
  }

  let invoiceNumber = '';
  let invoiceDate = '';
  let dueDate = '';
  let amount = 0;
  let supplier = '';
  let service = 'Fornitura Generica';
  let period = '';
  let podOrPdr = '';
  let isIncoming = false;
  let hasGenuineDueDate = false;

  // 1. Check FatturaPA XML tags if present (namespace-tolerant fallback)
  const numMatchXml = text.match(/<([a-zA-Z0-9_-]+:)?Numero(?:\s+[^>]*)?>([\s\S]*?)<\/\1?Numero>/i);
  if (numMatchXml) invoiceNumber = numMatchXml[2].trim();

  const dateMatchXml = text.match(/<([a-zA-Z0-9_-]+:)?Data(?:\s+[^>]*)?>(\d{4})-(\d{2})-(\d{2})<\/\1?Data>/i);
  if (dateMatchXml) {
    invoiceDate = `${dateMatchXml[3]}/${dateMatchXml[2]}/${dateMatchXml[1]}`;
  }

  const dueMatchXml =
    text.match(/<([a-zA-Z0-9_-]+:)?DataScadenzaPagamento(?:\s+[^>]*)?>(\d{4})-(\d{2})-(\d{2})<\/\1?DataScadenzaPagamento>/i) ||
    text.match(/<([a-zA-Z0-9_-]+:)?DataScadenza(?:\s+[^>]*)?>(\d{4})-(\d{2})-(\d{2})<\/\1?DataScadenza>/i);
  if (dueMatchXml) {
    dueDate = `${dueMatchXml[3]}/${dueMatchXml[2]}/${dueMatchXml[1]}`;
    hasGenuineDueDate = true;
  }

  const amountMatchXml =
    text.match(/<([a-zA-Z0-9_-]+:)?ImportoTotaleDocumento(?:\s+[^>]*)?>([-+]?[\d.,]+)<\/\1?ImportoTotaleDocumento>/i) ||
    text.match(/<([a-zA-Z0-9_-]+:)?ImportoPagamento(?:\s+[^>]*)?>([-+]?[\d.,]+)<\/\1?ImportoPagamento>/i);
  if (amountMatchXml) {
    amount = Math.abs(parseFloat(amountMatchXml[2].replace(',', '.')));
  }

  const supplierMatchXml =
    text.match(/<([a-zA-Z0-9_-]+:)?Denominazione(?:\s+[^>]*)?>([\s\S]*?)<\/\1?Denominazione>/i) ||
    text.match(/<([a-zA-Z0-9_-]+:)?Nome(?:\s+[^>]*)?>([\s\S]*?)<\/\1?Nome>/i);
  if (supplierMatchXml) supplier = supplierMatchXml[2].trim();

  // 2. Plain Text / PDF Extraction Patterns
  // Detect Supplier
  if (!supplier) {
    if (/energentium/i.test(text) || /energentium/i.test(fileName)) supplier = 'Energentium';
    else if (/enel\s*energia/i.test(text)) supplier = 'Enel Energia';
    else if (/servizio\s*elettrico\s*nazionale/i.test(text)) supplier = 'Servizio Elettrico Nazionale';
    else if (/plenitude/i.test(text) || /eni\s*plenitude/i.test(text)) supplier = 'Eni Plenitude';
    else if (/a2a\s*energia/i.test(text) || /\ba2a\b/i.test(text)) supplier = 'A2A Energia';
    else if (/hera\s*comm/i.test(text) || /\bhera\b/i.test(text)) supplier = 'Hera Comm';
    else if (/iren\s*mercato/i.test(text) || /\biren\b/i.test(text)) supplier = 'Iren Mercato';
    else if (/edison\s*energia/i.test(text) || /\bedison\b/i.test(text)) supplier = 'Edison Energia';
    else if (/acea\s*energia/i.test(text) || /\bacea\b/i.test(text)) supplier = 'Acea Energia';
    else if (/sorgenia/i.test(text)) supplier = 'Sorgenia';
    else if (/illumia/i.test(text)) supplier = 'Illumia';
    else if (/publiacqua/i.test(text)) supplier = 'Publiacqua';
    else if (/alia\s*servizi/i.test(text) || /\balia\b/i.test(text)) supplier = 'Alia Servizi Ambientali';
    else if (/tim\s*s\.p\.a|telecom\s*italia/i.test(text)) supplier = 'TIM';
    else if (/vodafone/i.test(text)) supplier = 'Vodafone';
    else if (/wind\s*tre/i.test(text)) supplier = 'Wind Tre';
    else if (/fastweb/i.test(text)) supplier = 'Fastweb';
    else {
      // Try company match from first lines
      const compMatch = text.match(/\b([A-Z0-9\s.,&-]{3,35})\s+(?:S\.p\.A\.|SpA|S\.r\.l\.|Srl)\b/i);
      if (compMatch) supplier = compMatch[1].trim();
    }
  }

  // Detect Service
  if (/luce|energia\s*elettrica|\bkwh\b|potenza\s*impegnata|\bpod\b/i.test(text)) {
    service = 'Energia Elettrica';
  } else if (/gas|metano|\bsmc\b|\bpdr\b/i.test(text)) {
    service = 'Gas Naturale';
  } else if (/telefonia|fibra|adsl|linea\s*fissa|internet/i.test(text)) {
    service = 'Telefonia / Fibra';
  } else if (/idrico|acquedotto|fognatura|depurazione/i.test(text)) {
    service = 'Servizio Idrico';
  } else if (/tari|rifiuti|igiene\s*ambientale/i.test(text)) {
    service = 'TARI / Rifiuti';
  }

  // Invoice Number
  if (!invoiceNumber) {
    const numRegex = /(?:fattura|documento|avviso|doc\.?)\s*(?:n[r°\.]?|numero|num\.?)\s*[:\.]?\s*([A-Za-z0-9\/\-_]{2,20})/i;
    const numRegex2 = /\b(?:n[r°\.]|numero)\s*[:\.]?\s*([A-Za-z0-9\/\-_]{3,20})/i;
    const m = text.match(numRegex) || text.match(numRegex2);
    if (m) {
      invoiceNumber = m[1].trim();
    } else {
      // Check fileName
      const fileNum = fileName.match(/(?:fattura|bolletta|inv)[^\d]*([0-9A-Za-z\-_]+)/i);
      if (fileNum) invoiceNumber = fileNum[1];
    }
  }

  // Invoice Date (emissione)
  if (!invoiceDate) {
    const dateRegex = /(?:del|data|emissione)[^\d\n\r]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i;
    const dm = text.match(dateRegex);
    if (dm) {
      invoiceDate = `${dm[1].padStart(2, '0')}/${dm[2].padStart(2, '0')}/${dm[3]}`;
    }
  }

  // Due Date (Scadenza)
  if (!dueDate) {
    // 1. "scadenza ... DD/MM/YYYY"
    const scadRegex1 = /(?:scadenza|scad\.?|da pagare entro|entro il|pagamento entro|addebito entro|data scadenza|scadenza pagamento)[^\d\n\r]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i;
    const sm1 = text.match(scadRegex1);
    if (sm1) {
      dueDate = `${sm1[1].padStart(2, '0')}/${sm1[2].padStart(2, '0')}/${sm1[3]}`;
      hasGenuineDueDate = true;
    } else {
      // 2. Month written in letters: "scadenza ... 19 agosto 2025"
      const scadMonthRegex = /(?:scadenza|scad\.?|entro il|pagamento entro)[^\d\n\r]*(\d{1,2})\s+([a-zA-Z]{4,10})\s+(\d{4})/i;
      const sm2 = text.match(scadMonthRegex);
      if (sm2 && ITALIAN_MONTHS[sm2[2].toLowerCase()]) {
        dueDate = `${sm2[1].padStart(2, '0')}/${ITALIAN_MONTHS[sm2[2].toLowerCase()]}/${sm2[3]}`;
        hasGenuineDueDate = true;
      }
    }
  }

  // Total Amount (Totale da pagare / Netto a pagare / Totale documento)
  if (!amount) {
    // Priority 1: Top priority terms explicitly mentioned by user:
    // "Netto a pagare" (or "Netto da pagare", "Importo netto a pagare") and "Totale documento"
    const priorityKeywords = [
      /(?:netto\s*(?:a|da)\s*pagare|importo\s*netto\s*(?:a|da)\s*pagare)[^\d\n\r€]{0,50}?[:=]?\s*€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/i,
      /(?:totale\s*documento)[^\d\n\r€]{0,50}?[:=]?\s*€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/i,
      /(?:totale\s*(?:da|a)\s*pagare|totale\s*fattura|totale\s*bolletta|importo\s*da\s*pagare|totale\s*dovuto|saldo\s*(?:da\s*)?pagare|totale\s*a\s*vostro\s*debito|totale\s*spesa|totale\s*complessivo)[^\d\n\r€]{0,50}?[:=]?\s*€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/i,
      /(?:importo\s*addebitato|importo\s*bonifico|totale\s*da\s*versare)[^\d\n\r€]{0,50}?[:=]?\s*€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/i,
      /(?:totale\s*euro|totale\s*€)\s*[:=]?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/i,
    ];

    for (const regex of priorityKeywords) {
      const match = text.match(regex);
      if (match) {
        amount = parseCurrencyAmount(match[1]);
        break;
      }
    }

    // Priority 2: Multi-line check (e.g. "NETTO A PAGARE" or "TOTALE DOCUMENTO" on one line, and amount on next line)
    if (!amount) {
      const textLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < textLines.length; i++) {
        const line = textLines[i];
        if (/(?:netto\s*(?:a|da)\s*pagare|totale\s*documento|totale\s*(?:da|a)\s*pagare|totale\s*fattura)/i.test(line)) {
          // Check if number is on the next line
          if (i < textLines.length - 1) {
            const nextLine = textLines[i + 1];
            const numMatch = nextLine.match(/€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/);
            if (numMatch) {
              amount = parseCurrencyAmount(numMatch[1]);
              break;
            }
          }
        }
      }
    }

    // Priority 3: Generic total followed by euro amount
    if (!amount) {
      const genericTotal = /\btotale\b[^\d\n\r€]{0,50}?[:=]?\s*€?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\b/i;
      const match = text.match(genericTotal);
      if (match) {
        amount = parseCurrencyAmount(match[1]);
      }
    }
  }

  // Check if credit note (nota di credito / a vostro credito)
  if (/nota\s*di\s*credito|a\s*(?:vostro\s*)?credito|a\s*rimborso/i.test(text)) {
    isIncoming = true;
  }

  // Period
  const periodRegex = /(?:periodo|competenza)[^\d\n\r]*[:=]?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}\s*(?:al|[-–/]|fino al)\s*[0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i;
  const pm = text.match(periodRegex);
  if (pm) {
    period = pm[1].trim();
  }

  // POD (Luce) or PDR (Gas)
  const podMatch = text.match(/\b(IT[0-9]{3}E[0-9A-Z]{8,10})\b/i) || text.match(/\b(IT[0-9A-Z]{12,14})\b/i);
  const pdrMatch = text.match(/\b(00[0-9]{12})\b/) || text.match(/pdr[^\d\n\r]*[:=]?\s*([0-9]{14})/i);
  if (podMatch) podOrPdr = podMatch[1].toUpperCase();
  else if (pdrMatch) podOrPdr = pdrMatch[1];

  // Customer code
  const clientMatch = text.match(/(?:codice\s*cliente|cliente)[^\d\n\r]*[:=]?\s*([A-Za-z0-9\-_]{5,15})/i);
  const customerCode = clientMatch ? clientMatch[1] : '';

  // 3. High-Precision Installments Detection in Text (e.g. utility bills with multiple installments / rate / PagoPA)
  const detectedPlan = detectInstallmentsFromText(text, amount, dueDate || invoiceDate);
  let isInstallmentPlan = detectedPlan.isInstallmentPlan;
  let finalInstallments = detectedPlan.installments;

  if (isInstallmentPlan && finalInstallments.length > 1) {
    // Set primary dueDate to the earliest installment
    if (finalInstallments[0].dueDate) {
      dueDate = finalInstallments[0].dueDate;
      hasGenuineDueDate = true;
    }
    // If total invoice amount was missing or 0, calculate sum of installments
    if (!amount || amount === 0) {
      amount = finalInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    }
  } else {
    // If only 1 single installment, ensure it reflects the found amount and dueDate
    finalInstallments = [
      {
        id: `inst-${Math.random().toString(36).substring(2, 9)}`,
        installmentNumber: 1,
        totalInstallments: 1,
        dueDate: dueDate || invoiceDate,
        amount: amount || 0,
        paymentMethod: 'Bonifico / Domiciliazione',
        isPaid: false,
      },
    ];
  }

  // Fallback defaults
  if (!dueDate) {
    if (invoiceDate) {
      dueDate = invoiceDate;
    } else {
      const today = new Date();
      dueDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    }
  }

  const finalInvoiceNum = invoiceNumber || fileName.replace(/\.[^/.]+$/, '');
  const finalSupplier = supplier || 'Fornitore';
  const desc = `Fattura ${finalSupplier} nr. ${finalInvoiceNum}${invoiceDate ? ' del ' + invoiceDate : ''} - ${service}${period ? ' (Periodo ' + period + ')' : ''}`;

  return {
    hasGenuineDueDate,
    data: {
      dueDate,
      invoiceNumber: finalInvoiceNum,
      invoiceDate: invoiceDate || dueDate,
      supplier: finalSupplier,
      service,
      period: period || 'N/D',
      amount: amount || 0,
      isIncoming,
      description: desc,
      customerCode,
      pde: '',
      podOrPdr,
      consumption: '',
      paymentMethod: 'Bonifico / Domiciliazione',
      iban: '',
      isInstallmentPlan,
      installments: finalInstallments,
    },
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // API: Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // API: Analyze invoice file
  app.post('/api/analyze-invoice', async (req, res) => {
    const { fileName, mimeType, base64Data, textContent } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'fileName mancante' });
    }

    let extractedText = textContent || '';

    // Step 1: Handle .p7m (signed FatturaPA) or binary base64
    const isP7m =
      fileName.toLowerCase().endsWith('.p7m') ||
      fileName.toLowerCase().includes('.p7m') ||
      Boolean(mimeType && (mimeType.includes('pkcs7') || mimeType.includes('p7m')));

    if (base64Data && isP7m) {
      try {
        const rawBuffer = Buffer.from(base64Data, 'base64');
        const xmlFromP7m = extractXmlFromP7mBuffer(rawBuffer);
        if (xmlFromP7m) {
          extractedText = xmlFromP7m;
        }
      } catch (p7mErr) {
        // continue
      }
    }

    // Also decode base64 for .xml file if textContent was empty
    if (!extractedText && base64Data && fileName.toLowerCase().endsWith('.xml')) {
      try {
        const rawBuffer = Buffer.from(base64Data, 'base64');
        extractedText = rawBuffer.toString('utf-8');
      } catch (e) {}
    }

    // Step 1b: Dedicated High-Precision XML / FatturaPA extraction
    const looksLikeXml =
      extractedText.includes('FatturaElettronica') ||
      extractedText.includes('CedentePrestatore') ||
      extractedText.includes('DatiGeneraliDocumento') ||
      /<\?xml\b/i.test(extractedText) ||
      fileName.toLowerCase().endsWith('.xml') ||
      isP7m;

    if (looksLikeXml && extractedText) {
      const xmlResult = parseFatturaPaXml(extractedText, fileName);
      if (xmlResult.success && xmlResult.data && xmlResult.data.amount > 0) {
        const allItems = (xmlResult.allInvoices || [xmlResult.data]).map((inv) => ({
          id: 'uploaded-' + Math.random().toString(36).substring(2, 9),
          fileName,
          ...inv,
        }));

        return res.json({
          success: true,
          source: 'fatturapa-xml-parser',
          data: allItems[0],
          items: allItems,
        });
      }
    }

    // Step 2: If it's a PDF and text was not provided, extract text using PDFParse
    const isPdf = fileName.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';
    if (!extractedText && base64Data && isPdf) {
      try {
        const buffer = Buffer.from(base64Data, 'base64');
        const parser = new PDFParse({ data: buffer });
        const pdfTextResult = await parser.getText();
        extractedText = pdfTextResult?.text || '';
        await parser.destroy();
      } catch (pdfErr) {
        // Continue to Gemini or fallback
      }
    }

    // Step 3: Run local high-precision parser
    const localResult = extractFromTextOrXml(extractedText || fileName, fileName);
    const hasClues = hasInstallmentIndicators(extractedText || '', fileName);
    const hasMultipleLocalInstallments =
      Boolean(localResult.data.isInstallmentPlan) &&
      Array.isArray(localResult.data.installments) &&
      localResult.data.installments.length > 1;

    // If local extraction found multiple genuine installments with high accuracy,
    // we already have the full installment schedule directly from document text!
    if (hasMultipleLocalInstallments) {
      if (!localResult.data.amount || localResult.data.amount <= 0) {
        const sumOfInst = localResult.data.installments!.reduce((sum, inst) => sum + (inst.amount || 0), 0);
        if (sumOfInst > 0) {
          localResult.data.amount = Number(sumOfInst.toFixed(2));
        }
      }

      if (localResult.data.amount > 0) {
        return res.json({
          success: true,
          source: 'document-extractor',
          data: {
            id: 'uploaded-' + Math.random().toString(36).substring(2, 9),
            fileName,
            ...localResult.data,
          },
        });
      }
    }

    // For non-PDF documents (or simple single invoices without installment hints)
    // if local extraction found both genuine due date and amount, return immediately
    if (!isPdf && !hasClues && localResult.hasGenuineDueDate && localResult.data.amount > 0) {
      return res.json({
        success: true,
        source: 'document-extractor',
        data: {
          id: 'uploaded-' + Math.random().toString(36).substring(2, 9),
          fileName,
          ...localResult.data,
        },
      });
    }

    // Step 4: Use Gemini AI for deep PDF inspection (especially for visual bollettini, PagoPA slips, or complex schedules)
    const ai = getAiClient();
    const canUseGemini = ai && Date.now() > geminiCooldownUntil && (base64Data || extractedText);

    if (canUseGemini) {
      try {
        let contentParts: any[] = [];

        if (base64Data) {
          let normalizedMime = mimeType || 'application/pdf';
          if (isPdf) normalizedMime = 'application/pdf';
          else if (fileName.toLowerCase().endsWith('.png')) normalizedMime = 'image/png';
          else if (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) normalizedMime = 'image/jpeg';
          else if (fileName.toLowerCase().endsWith('.webp')) normalizedMime = 'image/webp';

          contentParts.push({
            inlineData: {
              mimeType: normalizedMime,
              data: base64Data,
            },
          });
        }

        const promptText = `Sei un esperto contabile italiano. Analizza con estrema precisione questo documento contabile / fattura (${fileName}) con particolare attenzione allo SCADENZIARIO e alle RATE DI PAGAMENTO:
1. SOMMA TOTALE DA PAGARE (amount):
   - Nei file PDF la somma da pagare si trova tipicamente sotto la voce "NETTO A PAGARE", "NETTO DA PAGARE", "IMPORTO NETTO DA PAGARE" oppure "TOTALE DOCUMENTO", "TOTALE DA PAGARE", "TOTALE FATTURA".
   - Estrai questo importo esatto nel campo 'amount' (numero positivo).
2. RILEVAMENTO RATE E SCADENZE:
   - Le singole scadenze sono spessissimo riportate NELL'ULTIMA RIGA della fattura o nelle ultime righe in calce al documento (ad es. "Scadenze: 30/04/2025 € 500,00 31/05/2025 € 500,00", o più date e importi affiancati in fondo alla pagina).
   - Possono inoltre trovarsi sotto le voci "SCADENZA", "SCADENZE", "METODO DI PAGAMENTO", "MODALITÀ DI PAGAMENTO", "CONDIZIONI DI PAGAMENTO", "DATI DI PAGAMENTO", "DETTAGLIO SCADENZE", "PIANO DI PAGAMENTO", o in tabelle con bollettini PagoPA / postali.
3. SE SONO RIPORTATE 2 O PIÙ SCADENZE CON RELATIVO IMPORTO (anche tutte affiancate sull'ultima riga):
   - DEVI SEMPRE impostare isInstallmentPlan = true.
   - In "installments", elenca CIASCUNA data di scadenza e importo come singola rata con:
     * installmentNumber: 1, 2, ...
     * totalInstallments: numero totale di rate (es. 2, 3...)
     * dueDate: data di scadenza della rata in formato DD/MM/YYYY
     * amount: importo esatto della singola rata in euro (numero decimale)
     * paymentMethod: metodo di pagamento (es. "PagoPA", "Bollettino postale", "Bonifico bancario", "Addebito SEPA (SDD)", "Rimessa diretta")
     * notes: note (es. "Rata 1 di 2 - Scadenza 15/04/2025")
   - Imposta "dueDate" principale sulla data di scadenza della PRIMA rata.
4. Se la fattura prevede sia l'opzione in Unica Soluzione sia la suddivisione in RATE (es. bolletta con rata 1 e rata 2 oppure rata unica), estrai SEMPRE le singole rate nello scadenziario escludendo la riga dell'unica soluzione.
5. Se la fattura ha un UNICO pagamento non rateizzato:
   - Imposta isInstallmentPlan = false.
   - In "installments", metti un solo elemento con l'importo totale e la data di scadenza.
6. Estrai con precisione tutti i dati del documento:
   - dueDate: Data scadenza principale o prima rata (DD/MM/YYYY)
   - invoiceNumber: Numero fattura/documento
   - invoiceDate: Data di emissione (DD/MM/YYYY)
   - supplier: Nome fornitore (es. Enel, A2A, Hera, Energentium, Publiacqua, Acea, Iren, TIM...)
   - service: Tipo di fornitura (es. Energia Elettrica, Gas Naturale, Servizio Idrico, Telefonia, TARI / Rifiuti)
   - period: Periodo di riferimento (es. 01/05/2025 - 30/06/2025)
   - amount: Importo totale documento da pagare in euro (da Netto a pagare / Totale documento)
   - isIncoming: true SOLO se nota di credito o rimborso a favore del cliente, altrimenti false
   - description: "Fattura [Fornitore] nr. [Numero] del [DataEmissione] - [Servizio]"
   - customerCode, podOrPdr, consumption, iban se presenti.`;

        contentParts.push({ text: promptText });
        if (extractedText) {
          contentParts.push({ text: `Testo estratto dal documento:\n${extractedText.slice(0, 20000)}` });
        }

        const aiCall = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: contentParts,
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                dueDate: { type: Type.STRING },
                invoiceNumber: { type: Type.STRING },
                invoiceDate: { type: Type.STRING },
                supplier: { type: Type.STRING },
                service: { type: Type.STRING },
                period: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                isIncoming: { type: Type.BOOLEAN },
                description: { type: Type.STRING },
                customerCode: { type: Type.STRING },
                podOrPdr: { type: Type.STRING },
                consumption: { type: Type.STRING },
                paymentMethod: { type: Type.STRING },
                iban: { type: Type.STRING },
                isInstallmentPlan: { type: Type.BOOLEAN },
                installments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      installmentNumber: { type: Type.INTEGER },
                      totalInstallments: { type: Type.INTEGER },
                      dueDate: { type: Type.STRING },
                      amount: { type: Type.NUMBER },
                      paymentMethod: { type: Type.STRING },
                      notes: { type: Type.STRING },
                    },
                    required: ['installmentNumber', 'dueDate', 'amount'],
                  },
                },
              },
              required: ['dueDate', 'amount', 'description'],
            },
          },
        });

        // 20 second timeout for comprehensive multi-page PDF processing
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI timeout')), 20000)
        );

        const response = await Promise.race([aiCall, timeoutPromise]);
        const responseText = response.text?.trim() || '';

        if (responseText) {
          const parsed = JSON.parse(responseText);
          const finalAmt = typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : localResult.data.amount;
          const finalDue = normalizeDateString(parsed.dueDate) || parsed.dueDate || localResult.data.dueDate;

          let finalParsedInstallments = localResult.data.installments;
          if (Array.isArray(parsed.installments) && parsed.installments.length > 1) {
            const rawInsts = parsed.installments;
            finalParsedInstallments = rawInsts.map((inst: any, idx: number) => {
              const instDate = normalizeDateString(inst.dueDate) || inst.dueDate || finalDue;
              const instAmt = typeof inst.amount === 'number' && inst.amount > 0
                ? inst.amount
                : Number((finalAmt / rawInsts.length).toFixed(2));

              return {
                id: `inst-${Math.random().toString(36).substring(2, 9)}`,
                installmentNumber: inst.installmentNumber || idx + 1,
                totalInstallments: rawInsts.length,
                dueDate: instDate,
                amount: instAmt,
                paymentMethod: inst.paymentMethod || parsed.paymentMethod || 'Bonifico bancario',
                iban: inst.iban || parsed.iban,
                notes: inst.notes || `Rata ${inst.installmentNumber || idx + 1} di ${rawInsts.length}`,
                isPaid: false,
              };
            });
          } else if (hasMultipleLocalInstallments) {
            // Local high-precision text detector found genuine installments under Scadenza / Metodo di pagamento!
            finalParsedInstallments = localResult.data.installments;
          } else if (Array.isArray(parsed.installments) && parsed.installments.length === 1) {
            const single = parsed.installments[0];
            finalParsedInstallments = [
              {
                id: `inst-${Math.random().toString(36).substring(2, 9)}`,
                installmentNumber: 1,
                totalInstallments: 1,
                dueDate: normalizeDateString(single.dueDate) || single.dueDate || finalDue,
                amount: typeof single.amount === 'number' && single.amount > 0 ? single.amount : finalAmt,
                paymentMethod: single.paymentMethod || parsed.paymentMethod || 'Bonifico bancario',
                iban: parsed.iban,
                notes: single.notes || '',
                isPaid: false,
              },
            ];
          }

          const hasMultipleGeminiInstallments = finalParsedInstallments && finalParsedInstallments.length > 1;
          const earliestDue = hasMultipleGeminiInstallments && finalParsedInstallments[0].dueDate
            ? finalParsedInstallments[0].dueDate
            : finalDue;

          return res.json({
            success: true,
            source: 'gemini',
            data: {
              id: 'uploaded-' + Math.random().toString(36).substring(2, 9),
              fileName,
              ...localResult.data,
              ...parsed,
              dueDate: earliestDue,
              amount: finalAmt,
              installments: finalParsedInstallments,
              isInstallmentPlan: hasMultipleGeminiInstallments,
            },
          });
        }
      } catch (err: any) {
        // If quota was exceeded (429) or unavailable (503), initiate cooldown quietly
        const isQuotaOrDemand = err.message?.includes('429') || err.message?.includes('503') || err.message?.includes('quota');
        if (isQuotaOrDemand) {
          geminiCooldownUntil = Date.now() + 60000;
        }
        // Fall through to localResult without noisy console warnings
      }
    }

    // Step 4: Graceful return of local extracted data
    return res.json({
      success: true,
      source: 'document-extractor',
      data: {
        id: 'uploaded-' + Math.random().toString(36).substring(2, 9),
        fileName,
        ...localResult.data,
      },
    });
  });

  // Vite middleware in dev, static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
