



export interface InvoiceInstallment {
  id: string;
  installmentNumber: number; // e.g. 1, 2, 3
  totalInstallments: number; // e.g. 3
  dueDate: string; // DD/MM/YYYY
  amount: number; // in euro
  paymentMethod?: string; // e.g. "Bonifico bancario", "RiBa", "Bollettino", "SDD"
  iban?: string;
  isPaid?: boolean;
  notes?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  invoiceDate: string; // DD/MM/YYYY
  dueDate: string; // DD/MM/YYYY (primary/earliest upcoming deadline)
  supplier: string; // Energentium, Enel, etc.
  service: string;
  customerCode?: string;
  pde?: string;
  podOrPdr?: string;
  period?: string;
  amount: number; // in euro (totale documento)
  recipient?: string;
  consumption?: string;
  fileName?: string;
  isIncoming?: boolean;
  source?: string;
  paymentMethod?: string;
  iban?: string;
  isInstallmentPlan?: boolean; // true if subdivided in 2+ installments
  installments: InvoiceInstallment[];
}

export interface UploadTask {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: 'pending' | 'analyzing' | 'success' | 'error' | 'cancelled';
  progress: number;
  errorMessage?: string;
  result?: InvoiceRecord;
}

export interface CsvRow {
  data: string;
  descrizione: string;
  uscite: string;
  entrate: string;
}

// Flat item for chronological scadenzario list
export interface ScheduleItem {
  id: string;
  invoiceId: string;
  installmentId: string;
  installmentNumber: number;
  totalInstallments: number;
  isSinglePayment: boolean;
  dueDate: string; // DD/MM/YYYY
  amount: number;
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  service: string;
  totalInvoiceAmount: number;
  paymentMethod: string;
  iban?: string;
  isPaid: boolean;
  isIncoming: boolean;
  period?: string;
  customerCode?: string;
  fileName?: string;
}

