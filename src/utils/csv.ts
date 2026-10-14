import { InvoiceRecord } from '../types';

export type DescriptionFormat = 'standard' | 'detailed' | 'compact';

export function formatInvoiceDescription(inv: InvoiceRecord, format: DescriptionFormat = 'standard'): string {
  switch (format) {
    case 'detailed':
      return `Fattura ${inv.supplier || 'Fornitore'} n. ${inv.invoiceNumber} del ${inv.invoiceDate || inv.dueDate} - ${inv.service || 'Servizio'}${inv.period ? ' (Periodo: ' + inv.period + ')' : ''}${inv.podOrPdr ? ' - POD/PDR: ' + inv.podOrPdr : ''}${inv.pde ? ' - PDE: ' + inv.pde : ''}`;
    case 'compact':
      return `${inv.supplier || 'Fornitore'} - ${inv.service || 'Spesa'} - Fatt. ${inv.invoiceNumber}`;
    case 'standard':
    default:
      return `Fattura ${inv.supplier || 'Fornitore'} nr. ${inv.invoiceNumber} del ${inv.invoiceDate || inv.dueDate} - ${inv.service || 'Fornitura'}${inv.period ? ' (Periodo ' + inv.period + ')' : ''}`;
  }
}

export function formatItalianDecimal(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

// Helper to parse DD/MM/YYYY for reliable chronological sorting
function parseDateForSort(d: string): number {
  if (!d || !d.includes('/')) return 0;
  const [day, month, year] = d.split('/').map(Number);
  return new Date(year, (month || 1) - 1, day || 1).getTime();
}

export function generateScheduleCsvString(invoices: InvoiceRecord[]): string {
  const header = `"SCADENZA";"FORNITORE";"NUMERO_FATTURA";"DATA_FATTURA";"RATA";"IMPORTO_RATA_EUR";"TOTALE_FATTURA_EUR";"MODALITA_PAGAMENTO";"IBAN";"STATO";"SERVIZIO";"NOTE"`;

  interface FlatScheduleRow {
    dueDate: string;
    supplier: string;
    invoiceNumber: string;
    invoiceDate: string;
    rataLabel: string;
    installmentAmount: number;
    totalInvoiceAmount: number;
    paymentMethod: string;
    iban: string;
    stato: string;
    service: string;
    notes: string;
  }

  const items: FlatScheduleRow[] = [];

  for (const inv of invoices) {
    const installments = (inv.installments && inv.installments.length > 0)
      ? inv.installments
      : [
          {
            id: '1',
            installmentNumber: 1,
            totalInstallments: 1,
            dueDate: inv.dueDate,
            amount: inv.amount,
            paymentMethod: inv.paymentMethod || 'Bonifico bancario',
            iban: inv.iban,
            isPaid: false,
          },
        ];

    installments.forEach((inst) => {
      const rataLabel = inst.totalInstallments > 1
        ? `Rata ${inst.installmentNumber} di ${inst.totalInstallments}`
        : 'Rata Unica';
      const stato = inst.isPaid ? 'Pagata' : 'Da pagare';

      items.push({
        dueDate: inst.dueDate || inv.dueDate,
        supplier: inv.supplier || 'Fornitore',
        invoiceNumber: inv.invoiceNumber || '',
        invoiceDate: inv.invoiceDate || '',
        rataLabel,
        installmentAmount: inst.amount,
        totalInvoiceAmount: inv.amount,
        paymentMethod: inst.paymentMethod || inv.paymentMethod || 'Bonifico',
        iban: inst.iban || inv.iban || '',
        stato,
        service: inv.service || '',
        notes: inst.notes || (inv.period ? 'Periodo ' + inv.period : ''),
      });
    });
  }

  // Sort chronologically
  items.sort((a, b) => parseDateForSort(a.dueDate) - parseDateForSort(b.dueDate));

  const rows = items.map((item) =>
    [
      `"${item.dueDate}"`,
      `"${item.supplier.replace(/"/g, '""')}"`,
      `"${item.invoiceNumber.replace(/"/g, '""')}"`,
      `"${item.invoiceDate}"`,
      `"${item.rataLabel}"`,
      `"${formatItalianDecimal(item.installmentAmount)}"`,
      `"${formatItalianDecimal(item.totalInvoiceAmount)}"`,
      `"${item.paymentMethod.replace(/"/g, '""')}"`,
      `"${item.iban.replace(/"/g, '""')}"`,
      `"${item.stato}"`,
      `"${item.service.replace(/"/g, '""')}"`,
      `"${item.notes.replace(/"/g, '""')}"`,
    ].join(';')
  );

  return [header, ...rows].join('\r\n');
}

export function generateAccountingScheduleCsvString(
  invoices: InvoiceRecord[],
  descriptionFormat: DescriptionFormat = 'standard'
): string {
  const header = `"DATA";"DESCRIZIONE";"USCITE";"ENTRATE"`;

  interface FlatAccountingRow {
    dueDate: string;
    description: string;
    isIncoming: boolean;
    amount: number;
  }

  const items: FlatAccountingRow[] = [];

  for (const inv of invoices) {
    const installments = (inv.installments && inv.installments.length > 0)
      ? inv.installments
      : [
          {
            id: '1',
            installmentNumber: 1,
            totalInstallments: 1,
            dueDate: inv.dueDate,
            amount: inv.amount,
            paymentMethod: inv.paymentMethod || 'Bonifico bancario',
            iban: inv.iban,
            isPaid: false,
          },
        ];

    installments.forEach((inst) => {
      const baseDesc = formatInvoiceDescription(inv, descriptionFormat);
      const installmentSuffix = inst.totalInstallments > 1
        ? ` [Rata ${inst.installmentNumber}/${inst.totalInstallments}]`
        : '';
      const methodSuffix = inst.paymentMethod ? ` (${inst.paymentMethod})` : '';

      items.push({
        dueDate: inst.dueDate || inv.dueDate,
        description: baseDesc + installmentSuffix + methodSuffix,
        isIncoming: Boolean(inv.isIncoming),
        amount: inst.amount,
      });
    });
  }

  // Sort chronologically
  items.sort((a, b) => parseDateForSort(a.dueDate) - parseDateForSort(b.dueDate));

  const rows = items.map((item) => {
    const dataField = `"${item.dueDate}"`;
    const descField = `"${item.description.replace(/"/g, '""')}"`;
    const usciteField = item.isIncoming ? `""` : `"${formatItalianDecimal(item.amount)}"`;
    const entrateField = item.isIncoming ? `"${formatItalianDecimal(item.amount)}"` : `""`;
    return `${dataField};${descField};${usciteField};${entrateField}`;
  });

  return [header, ...rows].join('\r\n');
}

export function generateCsvString(
  invoices: InvoiceRecord[],
  descriptionFormat: DescriptionFormat = 'standard'
): string {
  const header = `"DATA";"DESCRIZIONE";"USCITE";"ENTRATE"`;

  const rows = invoices.map((inv) => {
    const dataField = `"${inv.dueDate}"`;
    const descField = `"${formatInvoiceDescription(inv, descriptionFormat).replace(/"/g, '""')}"`;
    const usciteField = inv.isIncoming ? `""` : `"${formatItalianDecimal(inv.amount)}"`;
    const entrateField = inv.isIncoming ? `"${formatItalianDecimal(inv.amount)}"` : `""`;
    return `${dataField};${descField};${usciteField};${entrateField}`;
  });

  return [header, ...rows].join('\r\n');
}

export function downloadCsvFile(
  csvContent: string,
  filename: string = 'fatture.csv'
): void {
  // UTF-8 BOM so Excel opens Italian accents and decimal characters properly
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
