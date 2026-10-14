import React, { useState, useRef } from 'react';
import {
  Save,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  HardDrive,
  Calendar,
  CreditCard,
  Building2,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { InvoiceRecord } from '../types';
import {
  BackupFileStructure,
  calculateBackupSummary,
  exportInvoicesToFile,
  parseBackupFile,
} from '../utils/fileStorage';

interface BackupModalProps {
  invoices: InvoiceRecord[];
  onRestore: (restoredInvoices: InvoiceRecord[], mode: 'replace' | 'merge') => void;
  onClose: () => void;
  defaultTab?: 'save' | 'load';
}

export const BackupModal: React.FC<BackupModalProps> = ({
  invoices,
  onRestore,
  onClose,
  defaultTab = 'save',
}) => {
  const [activeTab, setActiveTab] = useState<'save' | 'load'>(defaultTab);
  const [filePrefix, setFilePrefix] = useState('scadenzario_fatture');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Restore state
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewBackup, setPreviewBackup] = useState<{
    file: File;
    data: BackupFileStructure;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentSummary = calculateBackupSummary(invoices);

  const handleDownload = () => {
    if (invoices.length === 0) return;
    const res = exportInvoicesToFile(invoices, filePrefix || 'scadenzario_fatture');
    if (res.success) {
      setDownloadSuccess(res.filename);
      setTimeout(() => setDownloadSuccess(null), 5000);
    }
  };

  const handleSelectFile = async (file: File) => {
    setErrorMsg(null);
    setIsReadingFile(true);
    try {
      const result = await parseBackupFile(file);
      if (result.success && result.backup) {
        setPreviewBackup({
          file,
          data: result.backup,
        });
      } else {
        setErrorMsg(result.error || 'Impossibile leggere il file di salvataggio.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Errore imprevisto durante la lettura del file.');
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleApplyRestore = (mode: 'replace' | 'merge') => {
    if (!previewBackup) return;
    onRestore(previewBackup.data.invoices, mode);
    onClose();
  };

  return (
    <div
      id="backup-restore-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Salvataggio & Ripristino Archivio
              </h3>
              <p className="text-xs text-slate-500">
                Salva i tuoi dati su file nel computer o ricarica un archivio precedente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            aria-label="Chiudi finestra"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-2 bg-slate-100 border-b border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('save')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'save'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Salva su Computer (Backup)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('load')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'load'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Ricarica da Computer (Ripristino)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: SALVA SU FILE */}
          {activeTab === 'save' && (
            <div className="space-y-4">
              {/* Summary of what will be saved */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Dati che verranno inclusi nel file
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-xs text-slate-500 block">Fatture</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {currentSummary.totalInvoices}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-xs text-slate-500 block">Rate Totali</span>
                    <span className="text-base font-bold text-indigo-700 font-mono">
                      {currentSummary.totalInstallments}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-xs text-slate-500 block">Totale Importo</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {currentSummary.totalAmount.toFixed(2).replace('.', ',')} €
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">Cosa contiene il salvataggio:</strong>
                    <p className="mt-0.5 text-slate-600">
                      Tutti i dettagli estratti (fornitori, numeri fattura, date, scadenze, importi,
                      singole rate, stati &quot;saldato&quot;, IBAN e note contabili) vengono memorizzati
                      in un file <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300">.json</code> standard che potrai conservare sul tuo computer o riaprire in qualsiasi momento.
                    </p>
                  </div>
                </div>
              </div>

              {/* File name prefix input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Prefisso nome file
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={filePrefix}
                    onChange={(e) => setFilePrefix(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    placeholder="scadenzario_fatture"
                    className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-400 font-mono">_data_ora.json</span>
                </div>
              </div>

              {/* Download Success Notice */}
              {downloadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <strong>File scaricato con successo!</strong>
                    <span className="block text-[11px] font-mono text-emerald-700">{downloadSuccess}</span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={invoices.length === 0}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
                  invoices.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Scarica File di Salvataggio sul Tuo Computer (.json)</span>
              </button>

              {invoices.length === 0 && (
                <p className="text-[11px] text-center text-slate-400">
                  Non ci sono ancora fatture nello scadenzario da salvare. Inserisci una fattura o carica i dati demo per provare.
                </p>
              )}
            </div>
          )}

          {/* TAB 2: RICARICA DA FILE */}
          {activeTab === 'load' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSelectFile(file);
                }}
              />

              {/* Drag & Drop Area */}
              {!previewBackup && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleSelectFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <FileJson className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Trascina qui il file di salvataggio .json
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      oppure clicca per selezionarlo dal tuo computer
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 mt-1">
                    Seleziona file dal disco
                  </span>
                </div>
              )}

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Errore di caricamento:</strong> {errorMsg}
                  </div>
                </div>
              )}

              {/* Backup Preview Card */}
              {previewBackup && (
                <div className="bg-slate-50 border border-indigo-200 rounded-xl p-4 space-y-3.5 animate-fadeIn">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 font-mono">
                          {previewBackup.file.name}
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          Salvataggio del {previewBackup.data.exportDateFormatted}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewBackup(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
                    >
                      Cambia file
                    </button>
                  </div>

                  {/* Summary pills */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Fatture</span>
                      <strong className="text-sm font-bold text-slate-900 font-mono">
                        {previewBackup.data.summary.totalInvoices}
                      </strong>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Rate Totali</span>
                      <strong className="text-sm font-bold text-indigo-700 font-mono">
                        {previewBackup.data.summary.totalInstallments}
                      </strong>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Importo</span>
                      <strong className="text-sm font-bold text-slate-900 font-mono">
                        {previewBackup.data.summary.totalAmount.toFixed(2).replace('.', ',')} €
                      </strong>
                    </div>
                  </div>

                  {/* Fornitori inclusi */}
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 max-h-24 overflow-y-auto">
                    <span className="font-semibold text-slate-700 block mb-1">
                      Fatture presenti nel file:
                    </span>
                    <ul className="space-y-0.5">
                      {previewBackup.data.invoices.slice(0, 5).map((inv, idx) => (
                        <li key={inv.id || idx} className="truncate">
                          • <strong>{inv.supplier}</strong> (Fatt. {inv.invoiceNumber}) - {inv.dueDate}: {inv.amount.toFixed(2).replace('.', ',')} € ({inv.installments?.length || 1} rate)
                        </li>
                      ))}
                      {previewBackup.data.invoices.length > 5 && (
                        <li className="text-slate-400 italic">
                          ...ed altre {previewBackup.data.invoices.length - 5} fatture
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Restore Buttons */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-2">
                    <span className="text-xs font-bold text-slate-800 block">
                      Come desideri ricaricare questi dati?
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyRestore('replace')}
                        className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Sostituisci Dati Attuali</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyRestore('merge')}
                        className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Unisci ai Dati Esistenti</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 text-center">
                      &quot;Sostituisci&quot; reimposta l&apos;elenco con il file, mentre &quot;Unisci&quot; aggiunge le fatture a quelle già aperte.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>I tuoi file rimangono sul tuo computer in formato aperto .json</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
