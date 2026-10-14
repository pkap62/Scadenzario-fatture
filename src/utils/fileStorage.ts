import { InvoiceRecord } from '../types';

export interface BackupFileStructure {
  app: string;
  version: string;
  exportedAt: string;
  exportDateFormatted: string;
  summary: {
    totalInvoices: number;
    totalInstallments: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
  };
  invoices: InvoiceRecord[];
}

const LOCAL_STORAGE_KEY = 'scadenzario_invoices_data_v2';
const LEGACY_STORAGE_KEY = 'scadenziario_invoices_data_v2';

/**
 * Calcola statistiche riassuntive da una lista di fatture
 */
export function calculateBackupSummary(invoices: InvoiceRecord[]) {
  let totalAmount = 0;
  let paidAmount = 0;
  let pendingAmount = 0;
  let totalInstallments = 0;

  for (const inv of invoices) {
    totalAmount += inv.amount || 0;
    const installments = inv.installments && inv.installments.length > 0
      ? inv.installments
      : [
          {
            id: '1',
            installmentNumber: 1,
            totalInstallments: 1,
            dueDate: inv.dueDate,
            amount: inv.amount,
            isPaid: false,
          },
        ];

    for (const inst of installments) {
      totalInstallments++;
      const instAmount = inst.amount || 0;
      if (inst.isPaid) {
        paidAmount += instAmount;
      } else {
        pendingAmount += instAmount;
      }
    }
  }

  return {
    totalInvoices: invoices.length,
    totalInstallments,
    totalAmount: Number(totalAmount.toFixed(2)),
    paidAmount: Number(paidAmount.toFixed(2)),
    pendingAmount: Number(pendingAmount.toFixed(2)),
  };
}

/**
 * Salva l'intero archivio fatture in un file JSON scaricabile sul computer
 */
export function exportInvoicesToFile(invoices: InvoiceRecord[], customPrefix = 'scadenzario_backup'): { success: boolean; filename: string } {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `${customPrefix}_${dateStr}_${timeStr}.json`;

    const summary = calculateBackupSummary(invoices);

    const backupPayload: BackupFileStructure = {
      app: 'Scadenzario Fatture & Rate',
      version: '2.0',
      exportedAt: now.toISOString(),
      exportDateFormatted: now.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      summary,
      invoices,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filename };
  } catch (err) {
    console.error('Errore durante il salvataggio su file:', err);
    return { success: false, filename: '' };
  }
}

/**
 * Legge ed analizza un file di backup JSON caricato dall'utente dal proprio PC
 */
export async function parseBackupFile(file: File): Promise<{
  success: boolean;
  backup?: BackupFileStructure;
  error?: string;
}> {
  return new Promise((resolve) => {
    if (!file) {
      return resolve({ success: false, error: 'Nessun file selezionato' });
    }

    // Verifica estensione
    if (!file.name.toLowerCase().endsWith('.json')) {
      return resolve({
        success: false,
        error: 'Il file deve avere estensione .json (file di salvataggio dello scadenzario)',
      });
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content || !content.trim()) {
          return resolve({ success: false, error: 'Il file selezionato è vuoto.' });
        }

        const parsed = JSON.parse(content);

        let rawInvoices: any[] = [];
        let exportDateFormatted = new Date().toLocaleString('it-IT');
        let version = '2.0';

        if (Array.isArray(parsed)) {
          // File contenente direttamente l'array di fatture
          rawInvoices = parsed;
        } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.invoices)) {
          // File di backup strutturato
          rawInvoices = parsed.invoices;
          if (parsed.exportDateFormatted) exportDateFormatted = parsed.exportDateFormatted;
          if (parsed.version) version = parsed.version;
        } else {
          return resolve({
            success: false,
            error: 'Il formato del file non è valido. Assicurati di caricare un file generato con la funzione "Salva su File".',
          });
        }

        // Valida e sanitizza ciascun elemento
        const validInvoices: InvoiceRecord[] = rawInvoices.map((item: any, idx: number) => {
          const invId = item.id ? String(item.id) : `restored-${idx + 1}-${Date.now()}`;
          const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount || 0);

          let installments = Array.isArray(item.installments) ? item.installments : [];
          if (installments.length === 0) {
            installments = [
              {
                id: `${invId}-inst-1`,
                installmentNumber: 1,
                totalInstallments: 1,
                dueDate: item.dueDate || '01/01/2026',
                amount: amount,
                paymentMethod: item.paymentMethod || 'Bonifico bancario',
                iban: item.iban,
                isPaid: Boolean(item.isPaid),
              },
            ];
          }

          return {
            id: invId,
            invoiceNumber: item.invoiceNumber || `DOC-${idx + 1}`,
            dueDate: item.dueDate || '01/01/2026',
            amount,
            supplier: item.supplier || 'Fornitore non specificato',
            service: item.service || 'Generale',
            invoiceDate: item.invoiceDate,
            customerCode: item.customerCode,
            podOrPdr: item.podOrPdr,
            pde: item.pde,
            consumption: item.consumption,
            isIncoming: Boolean(item.isIncoming),
            period: item.period,
            paymentMethod: item.paymentMethod || 'Bonifico bancario',
            iban: item.iban,
            isInstallmentPlan: Boolean(item.isInstallmentPlan || installments.length > 1),
            installments,
            notes: item.notes,
            fileName: item.fileName,
          };
        });

        const summary = calculateBackupSummary(validInvoices);

        const structuredBackup: BackupFileStructure = {
          app: 'Scadenzario Fatture & Rate',
          version,
          exportedAt: new Date().toISOString(),
          exportDateFormatted,
          summary,
          invoices: validInvoices,
        };

        return resolve({ success: true, backup: structuredBackup });
      } catch (err: any) {
        return resolve({
          success: false,
          error: `Errore durante la lettura del file JSON: ${err?.message || 'sintassi non valida'}`,
        });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, error: 'Impossibile leggere il file dal disco.' });
    };

    reader.readAsText(file);
  });
}

/**
 * Salva la lista corrente di fatture nel LocalStorage del browser (salvataggio automatico)
 */
export function saveToLocalStorage(invoices: InvoiceRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(invoices));
  } catch (err) {
    console.warn('Impossibile salvare nel LocalStorage:', err);
  }
}

/**
 * Carica la lista salvata nel LocalStorage del browser
 */
export function loadFromLocalStorage(): InvoiceRecord[] | null {
  try {
    let saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) {
      saved = localStorage.getItem(LEGACY_STORAGE_KEY);
    }
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Errore lettura LocalStorage:', err);
  }
  return null;
}

/**
 * Rimuove i dati dal LocalStorage
 */
export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    console.warn('Errore pulizia LocalStorage:', err);
  }
}
