/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  Zap,
  Flame,
  Search,
  ArrowUpDown,
  Filter,
  Eye,
  Info,
  Receipt,
  CheckCircle2,
  Trash2,
  RotateCcw,
  FileText,
  Edit2,
  X,
  Save,
  PlusCircle,
  Calendar,
  Layers,
  Split,
  Plus,
  Clock,
  ExternalLink,
  HardDrive,
  FolderOpen,
} from 'lucide-react';
import { INITIAL_INVOICES } from './data/invoices';
import { InvoiceRecord, InvoiceInstallment } from './types';
import {
  DescriptionFormat,
  generateCsvString,
  generateScheduleCsvString,
  generateAccountingScheduleCsvString,
  downloadCsvFile,
  formatItalianDecimal,
  formatInvoiceDescription,
} from './utils/csv';
import {
  exportInvoicesToFile,
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
} from './utils/fileStorage';
import { UploadSection } from './components/UploadSection';
import { ScheduleMetrics } from './components/ScheduleMetrics';
import { ScheduleListView } from './components/ScheduleListView';
import { InvoicePlanView } from './components/InvoicePlanView';
import { InstallmentModal } from './components/InstallmentModal';
import { AddInvoiceModal } from './components/AddInvoiceModal';
import { VerificationNotice } from './components/VerificationNotice';
import { BackupModal } from './components/BackupModal';

export default function App() {
  // Non caricare automaticamente i dati demo: inizializza con i dati salvati in locale, oppure vuoto
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => {
    const saved = loadFromLocalStorage();
    return saved && saved.length > 0 ? saved : [];
  });
  const [activeTab, setActiveTab] = useState<'schedule' | 'documents' | 'csv'>('schedule');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'multi_installment'>('all');
  const [descFormat, setDescFormat] = useState<DescriptionFormat>('standard');
  const [csvExportType, setCsvExportType] = useState<'schedule' | 'accounting'>('schedule');
  const [copiedCsv, setCopiedCsv] = useState(false);

  // Backup & Restore su file nel Computer
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupDefaultTab, setBackupDefaultTab] = useState<'save' | 'load'>('save');
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Salva automaticamente nel LocalStorage ad ogni modifica
  useEffect(() => {
    saveToLocalStorage(invoices);
  }, [invoices]);

  // Modals
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecord | null>(null);
  const [managingInstallmentsInvoice, setManagingInstallmentsInvoice] = useState<InvoiceRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);

  // Uploaded records count
  const uploadedCount = useMemo(() => {
    return invoices.filter((inv) => inv.fileName && !inv.id.startsWith('demo-')).length;
  }, [invoices]);

  // Dynamic distinct services
  const distinctServices = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.service) set.add(inv.service);
    });
    return Array.from(set);
  }, [invoices]);

  // Handle invoice additions from file upload
  const handleInvoicesAdded = (newInvoices: InvoiceRecord[]) => {
    setInvoices((prev) => {
      const existingMap = new Map(prev.map((i) => [i.id, i]));
      newInvoices.forEach((inv) => {
        existingMap.set(inv.id, inv);
      });
      return Array.from(existingMap.values());
    });
  };

  // Toggle paid status for an installment
  const handleTogglePaid = (invoiceId: string, installmentId: string, currentPaid: boolean) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;

        const updatedInstallments = (inv.installments || []).map((inst) => {
          if (inst.id === installmentId) {
            return { ...inst, isPaid: !currentPaid };
          }
          return inst;
        });

        return {
          ...inv,
          installments: updatedInstallments,
        };
      })
    );
  };

  // Update an invoice's installment plan
  const handleSaveInstallments = (updatedInvoice: InvoiceRecord) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updatedInvoice.id ? updatedInvoice : inv))
    );
    setManagingInstallmentsInvoice(null);
  };

  // Delete invoice
  const handleDeleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  // Clear all
  const handleResetEverything = () => {
    setInvoices([]);
    clearLocalStorage();
    setResetTrigger((prev) => prev + 1);
    setToastNotice('Scadenzario azzerato');
    setTimeout(() => setToastNotice(null), 3000);
  };

  // Load demo sample with multi-installment bills
  const handleLoadDemoData = () => {
    setInvoices(INITIAL_INVOICES);
    setToastNotice('Dati demo caricati nello scadenzario');
    setTimeout(() => setToastNotice(null), 3500);
  };

  // Quick save to computer file
  const handleQuickSaveToFile = () => {
    if (invoices.length === 0) {
      setBackupDefaultTab('save');
      setIsBackupModalOpen(true);
      return;
    }
    const res = exportInvoicesToFile(invoices);
    if (res.success) {
      setToastNotice(`File salvato sul tuo Computer: ${res.filename}`);
      setTimeout(() => setToastNotice(null), 4500);
    }
  };

  // Restore handler from computer file
  const handleRestoreInvoices = (restoredInvoices: InvoiceRecord[], mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      setInvoices(restoredInvoices);
    } else {
      setInvoices((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = restoredInvoices.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
    }
    setToastNotice(`Archivio ripristinato con successo (${restoredInvoices.length} fatture)!`);
    setTimeout(() => setToastNotice(null), 4500);
  };

  // Save general invoice edits
  const handleSaveInvoiceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== editingInvoice.id) return inv;

        const updated = { ...editingInvoice };
        // If single installment or not a split plan, keep the primary installment in sync
        if (!updated.isInstallmentPlan || !updated.installments || updated.installments.length <= 1) {
          const firstInst = updated.installments?.[0];
          updated.installments = [
            {
              id: firstInst?.id || 'inst-1',
              installmentNumber: 1,
              totalInstallments: 1,
              dueDate: updated.dueDate,
              amount: updated.amount,
              paymentMethod: updated.paymentMethod || firstInst?.paymentMethod || 'Bonifico bancario',
              iban: updated.iban || firstInst?.iban,
              isPaid: Boolean(firstInst?.isPaid),
            },
          ];
        }

        return updated;
      })
    );
    setEditingInvoice(null);
  };

  // Filtered invoices based on search and service
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (serviceFilter !== 'all' && inv.service !== serviceFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.dueDate.includes(q) ||
        inv.invoiceDate.includes(q) ||
        (inv.supplier && inv.supplier.toLowerCase().includes(q)) ||
        (inv.service && inv.service.toLowerCase().includes(q)) ||
        (inv.period && inv.period.toLowerCase().includes(q)) ||
        (inv.paymentMethod && inv.paymentMethod.toLowerCase().includes(q)) ||
        inv.amount.toString().includes(q)
      );
    });
  }, [invoices, serviceFilter, searchQuery]);

  // Generated CSV string
  const activeCsvContent = useMemo(() => {
    if (csvExportType === 'schedule') {
      return generateScheduleCsvString(invoices);
    }
    return generateAccountingScheduleCsvString(invoices, descFormat);
  }, [invoices, csvExportType, descFormat]);

  const handleDownloadScheduleCsv = () => {
    if (invoices.length === 0) return;
    const content = generateScheduleCsvString(invoices);
    downloadCsvFile(content, 'scadenzario_rate_fatture.csv');
  };

  const handleDownloadAccountingCsv = () => {
    if (invoices.length === 0) return;
    const content = generateAccountingScheduleCsvString(invoices, descFormat);
    downloadCsvFile(content, 'tracciato_contabile_scadenze.csv');
  };

  const handleCopyCsv = () => {
    navigator.clipboard.writeText(activeCsvContent);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
  };

  // Count total installments across filtered invoices
  const totalInstallmentsCount = useMemo(() => {
    return invoices.reduce((acc, inv) => {
      const count = inv.installments && inv.installments.length > 0 ? inv.installments.length : 1;
      return acc + count;
    }, 0);
  }, [invoices]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Scadenzario Fatture & Rate
                </h1>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                  {invoices.length} {invoices.length === 1 ? 'fattura' : 'fatture'} ({totalInstallmentsCount} rate)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Analisi fatture elettroniche XML e PDF, estrazione scadenzario pagamenti e piano rate
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            {/* Indicatore salvataggio locale */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 mr-1" title="I dati vengono preservati automaticamente anche se ricarichi la pagina">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Salvataggio Locale Attivo</span>
            </div>

            {/* Salva su File nel Computer */}
            <button
              type="button"
              onClick={handleQuickSaveToFile}
              disabled={invoices.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer ${
                invoices.length === 0
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-xs'
              }`}
              title="Salva un file di backup .json sul tuo Computer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Salva su File</span>
            </button>

            {/* Ricarica da File del Computer */}
            <button
              type="button"
              onClick={() => {
                setBackupDefaultTab('load');
                setIsBackupModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 shadow-2xs transition-all cursor-pointer"
              title="Ricarica dal Computer un file precedentemente salvato"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Carica da File</span>
            </button>

            {/* Pulsante Dati Demo */}
            <button
              type="button"
              onClick={handleLoadDemoData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              title="Carica le fatture di esempio con scadenzario a rate"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dati Demo</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuova Scadenza
            </button>

            {invoices.length > 0 && (
              <button
                type="button"
                onClick={() => setShowResetAllModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                title="Azzera tutto lo scadenzario"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                Azzera
              </button>
            )}

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleDownloadScheduleCsv}
              disabled={invoices.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all ${
                invoices.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Esporta CSV
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Toast Notifica Rapida */}
        {toastNotice && (
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn border border-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{toastNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastNotice(null)}
              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Upload Section */}
        <UploadSection
          onInvoicesAdded={handleInvoicesAdded}
          onRemoveInvoice={handleDeleteInvoice}
          onClearUploadedInvoices={handleResetEverything}
          onPromptResetAll={() => setShowResetAllModal(true)}
          resetTrigger={resetTrigger}
          existingCount={invoices.length}
          uploadedInvoicesCount={uploadedCount}
        />

        {/* Schedule KPI Metrics */}
        <ScheduleMetrics invoices={invoices} />

        {/* Quadro di Avviso Verifica Importi ed Azioni di Correzione */}
        {invoices.length > 0 && <VerificationNotice />}

        {/* View Switcher Tabs & Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Tabs */}
          <div className="flex items-center gap-1.5 border-b md:border-b-0 pb-2 md:pb-0 border-slate-200 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'schedule'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Scadenzario Rate (Cronologico)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'documents'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Per Documento & Piani Rate
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'csv'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Anteprima CSV
            </button>
          </div>

          {/* Search and Secondary Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-48">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca fornitore, n. fatt..."
                className="w-full text-xs pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 pointer-events-none" />
            </div>

            {distinctServices.length > 0 && (
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white"
              >
                <option value="all">Tutti i Servizi</option>
                {distinctServices.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Status Filter Chips (for Scadenzario Tab) */}
        {activeTab === 'schedule' && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500 font-medium">Filtra per stato:</span>
            {[
              { id: 'all', label: 'Tutte le Scadenze' },
              { id: 'pending', label: 'Da Saldare' },
              { id: 'paid', label: 'Saldate' },
              { id: 'overdue', label: 'Scadute' },
              { id: 'multi_installment', label: 'Solo Piani a Rate' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id as any)}
                className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                  statusFilter === chip.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab 1: Scadenzario Rate (Cronologico) */}
        {activeTab === 'schedule' && (
          <ScheduleListView
            invoices={filteredInvoices}
            onTogglePaid={handleTogglePaid}
            onEditInstallments={(inv) => setManagingInstallmentsInvoice(inv)}
            onDeleteInvoice={handleDeleteInvoice}
            onEditInvoice={(inv) => setEditingInvoice(inv)}
            onLoadDemo={handleLoadDemoData}
            onOpenFileRestore={() => {
              setBackupDefaultTab('load');
              setIsBackupModalOpen(true);
            }}
            onAddNew={() => setIsAddModalOpen(true)}
            statusFilter={statusFilter}
          />
        )}

        {/* Tab 2: Documenti & Piano Rate */}
        {activeTab === 'documents' && (
          <InvoicePlanView
            invoices={filteredInvoices}
            onTogglePaid={handleTogglePaid}
            onEditInstallments={(inv) => setManagingInstallmentsInvoice(inv)}
            onDeleteInvoice={handleDeleteInvoice}
            onEditInvoice={(inv) => setEditingInvoice(inv)}
          />
        )}

        {/* Tab 4: Anteprima CSV */}
        {activeTab === 'csv' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCsvExportType('schedule')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    csvExportType === 'schedule'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Tracciato Scadenzario Rate (Tutte le colonne)
                </button>
                <button
                  type="button"
                  onClick={() => setCsvExportType('accounting')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    csvExportType === 'accounting'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Tracciato Contabile (&quot;DATA&quot;;&quot;DESCRIZIONE&quot;;&quot;USCITE&quot;;&quot;ENTRATE&quot;)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCsv}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCsv ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCsv ? 'Copiato!' : 'Copia CSV negli Appunti'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (csvExportType === 'schedule') {
                      handleDownloadScheduleCsv();
                    } else {
                      handleDownloadAccountingCsv();
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Scarica File .CSV
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-950 text-slate-200">
              <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-96">
                {activeCsvContent}
              </pre>
            </div>
          </div>
        )}

        {/* Modal: Rateizza / Modifica Installments */}
        {managingInstallmentsInvoice && (
          <InstallmentModal
            invoice={managingInstallmentsInvoice}
            onSave={handleSaveInstallments}
            onClose={() => setManagingInstallmentsInvoice(null)}
          />
        )}

        {/* Modal: Aggiungi Manualmente */}
        {isAddModalOpen && (
          <AddInvoiceModal
            onAdd={(newInv) => {
              setInvoices((prev) => [newInv, ...prev]);
            }}
            onClose={() => setIsAddModalOpen(false)}
          />
        )}

        {/* Modal: Modifica Dati Generali Fattura */}
        {editingInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-indigo-600" />
                  Modifica Dati Fattura
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveInvoiceEdit} className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data Scadenza (DD/MM/YYYY)*
                    </label>
                    <input
                      type="text"
                      required
                      value={editingInvoice.dueDate}
                      onChange={(e) =>
                        setEditingInvoice({ ...editingInvoice, dueDate: e.target.value })
                      }
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Importo (€)*
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editingInvoice.amount}
                      onChange={(e) =>
                        setEditingInvoice({
                          ...editingInvoice,
                          amount: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Numero Fattura
                    </label>
                    <input
                      type="text"
                      value={editingInvoice.invoiceNumber}
                      onChange={(e) =>
                        setEditingInvoice({ ...editingInvoice, invoiceNumber: e.target.value })
                      }
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fornitore
                    </label>
                    <input
                      type="text"
                      value={editingInvoice.supplier}
                      onChange={(e) =>
                        setEditingInvoice({ ...editingInvoice, supplier: e.target.value })
                      }
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Servizio
                  </label>
                  <input
                    type="text"
                    value={editingInvoice.service}
                    onChange={(e) =>
                      setEditingInvoice({ ...editingInvoice, service: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingInvoice(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salva Modifiche
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Conferma Azzera Tutto */}
        {showResetAllModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Azzerare tutto?</h3>
                  <p className="text-xs text-slate-500">Ripulitura completa dello scadenzario</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mt-2">
                Confermi di voler azzerare lo scadenzario? Verranno rimosse <strong>tutte le {invoices.length} fatture</strong> e azzerata la lista dei file elaborati.
              </p>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetAllModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleResetEverything();
                    setShowResetAllModal(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Sì, azzera tutto
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Salvataggio e Ripristino su File (Computer) */}
        {isBackupModalOpen && (
          <BackupModal
            invoices={invoices}
            onRestore={handleRestoreInvoices}
            onClose={() => setIsBackupModalOpen(false)}
            defaultTab={backupDefaultTab}
          />
        )}

        {/* Technical Guide Footer */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Info className="w-4 h-4 text-indigo-600" />
            <span>Guida allo Scadenzario e Salvataggio Dati</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70">
              <span className="font-bold text-slate-800 block mb-1">1. Rilevazione Rate Automatica</span>
              <p className="text-slate-600">
                L&apos;estrattore analizza la sezione <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">DettaglioPagamento</code> dell&apos;XML e individua importo, scadenze e codici di ciascuna rata.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70">
              <span className="font-bold text-slate-800 block mb-1">2. Rateizzazione & Modifica</span>
              <p className="text-slate-600">
                Dalla colonna <strong>AZIONI</strong> puoi modificare direttamente ogni importo o scadenza, oppure frazionare qualsiasi bolletta in più rate con pareggio automatico dei centesimi.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70">
              <span className="font-bold text-slate-800 block mb-1">3. Salvataggio su File nel Computer</span>
              <p className="text-slate-600">
                Clicca su <strong className="text-indigo-700">&quot;Salva su File&quot;</strong> per scaricare sul tuo computer l&apos;intero archivio in formato standard <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">.json</code>. Potrai riaprirlo quando vuoi con <strong className="text-indigo-700">&quot;Carica da File&quot;</strong>.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
