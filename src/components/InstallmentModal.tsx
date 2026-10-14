import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar, Split, AlertCircle, Check, CreditCard } from 'lucide-react';
import { InvoiceRecord, InvoiceInstallment } from '../types';
import { formatItalianDecimal } from '../utils/csv';

interface InstallmentModalProps {
  invoice: InvoiceRecord;
  onSave: (updatedInvoice: InvoiceRecord) => void;
  onClose: () => void;
}

export const InstallmentModal: React.FC<InstallmentModalProps> = ({
  invoice,
  onSave,
  onClose,
}) => {
  const [installments, setInstallments] = useState<InvoiceInstallment[]>(() => {
    if (invoice.installments && invoice.installments.length > 0) {
      return JSON.parse(JSON.stringify(invoice.installments));
    }
    return [
      {
        id: `inst-${Math.random().toString(36).substring(2, 9)}`,
        installmentNumber: 1,
        totalInstallments: 1,
        dueDate: invoice.dueDate,
        amount: invoice.amount,
        paymentMethod: invoice.paymentMethod || 'Bonifico bancario',
        iban: invoice.iban,
        isPaid: false,
      },
    ];
  });

  const [splitCount, setSplitCount] = useState<number>(3);
  const [customMethod, setCustomMethod] = useState(invoice.paymentMethod || 'Bonifico bancario');

  // Sum of installments
  const sumAmounts = installments.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);
  const diff = Number((invoice.amount - sumAmounts).toFixed(2));
  const isBalanced = Math.abs(diff) < 0.01;

  // Split into N installments
  const handleAutoSplit = (numSplits: number) => {
    if (numSplits < 1) return;

    // Helper to add months to DD/MM/YYYY
    const addMonths = (dateStr: string, monthsToAdd: number): string => {
      let [d, m, y] = (dateStr || invoice.dueDate || '15/01/2025').split('/').map(Number);
      if (!d || !m || !y) {
        const now = new Date();
        d = now.getDate();
        m = now.getMonth() + 1;
        y = now.getFullYear();
      }

      let newMonth = m + monthsToAdd;
      let newYear = y;
      while (newMonth > 12) {
        newMonth -= 12;
        newYear += 1;
      }

      const daysInMonth = new Date(newYear, newMonth, 0).getDate();
      const newDay = Math.min(d, daysInMonth);

      return `${String(newDay).padStart(2, '0')}/${String(newMonth).padStart(2, '0')}/${newYear}`;
    };

    const baseAmount = Math.floor((invoice.amount / numSplits) * 100) / 100;
    const remainder = Number((invoice.amount - baseAmount * numSplits).toFixed(2));

    const newInst: InvoiceInstallment[] = [];
    for (let i = 0; i < numSplits; i++) {
      // Add remainder to the first installment
      const amt = i === 0 ? Number((baseAmount + remainder).toFixed(2)) : baseAmount;
      newInst.push({
        id: `inst-${Math.random().toString(36).substring(2, 9)}-${i}`,
        installmentNumber: i + 1,
        totalInstallments: numSplits,
        dueDate: addMonths(invoice.dueDate || invoice.invoiceDate, i),
        amount: amt,
        paymentMethod: customMethod,
        iban: invoice.iban,
        isPaid: false,
        notes: numSplits > 1 ? `Rata ${i + 1} di ${numSplits}` : 'Rata unica',
      });
    }

    setInstallments(newInst);
  };

  // Add new blank installment
  const handleAddInstallment = () => {
    const nextNum = installments.length + 1;
    const lastDate = installments[installments.length - 1]?.dueDate || invoice.dueDate;

    // Calculate remaining amount needed
    const needed = Math.max(0, diff);

    setInstallments([
      ...installments,
      {
        id: `inst-${Math.random().toString(36).substring(2, 9)}`,
        installmentNumber: nextNum,
        totalInstallments: nextNum,
        dueDate: lastDate,
        amount: needed,
        paymentMethod: customMethod,
        iban: invoice.iban,
        isPaid: false,
      },
    ]);
  };

  // Remove an installment
  const handleRemoveInstallment = (index: number) => {
    if (installments.length <= 1) return;
    const updated = installments.filter((_, i) => i !== index);
    // Re-index
    const reindexed = updated.map((inst, i) => ({
      ...inst,
      installmentNumber: i + 1,
      totalInstallments: updated.length,
    }));
    setInstallments(reindexed);
  };

  // Auto balance difference to last installment
  const handleBalanceRemainder = () => {
    if (installments.length === 0) return;
    const lastIndex = installments.length - 1;
    const currentLastAmt = Number(installments[lastIndex].amount) || 0;
    const updatedLastAmt = Math.max(0, Number((currentLastAmt + diff).toFixed(2)));

    const updated = [...installments];
    updated[lastIndex] = {
      ...updated[lastIndex],
      amount: updatedLastAmt,
    };
    setInstallments(updated);
  };

  const handleSave = () => {
    // Re-number and normalize
    const finalInst = installments.map((inst, i) => ({
      ...inst,
      installmentNumber: i + 1,
      totalInstallments: installments.length,
    }));

    // Earliest due date
    const primaryDue = finalInst[0]?.dueDate || invoice.dueDate;

    onSave({
      ...invoice,
      dueDate: primaryDue,
      isInstallmentPlan: finalInst.length > 1,
      installments: finalInst,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Split className="w-5 h-5 text-indigo-600" />
              Gestione Scadenzario e Rate
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Fattura nr. <span className="font-semibold text-slate-800">{invoice.invoiceNumber}</span> ({invoice.supplier}) - Totale:{' '}
              <span className="font-mono font-bold text-indigo-700">€ {formatItalianDecimal(invoice.amount)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Auto-split actions */}
        <div className="my-4 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Suddivisione Rapida in Rate Mensili
            </span>
            <span className="text-xs text-slate-500">Imposta scadenze a intervalli mensili</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 6].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => handleAutoSplit(count)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  installments.length === count
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'
                }`}
              >
                {count === 1 ? 'Rata Unica' : `${count} Rate`}
              </button>
            ))}
          </div>
        </div>

        {/* Installment Rows */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1 py-1">
          {installments.map((inst, index) => (
            <div
              key={inst.id}
              className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center gap-3"
            >
              {/* Badge Rata */}
              <div className="w-20 flex-shrink-0">
                <span className="inline-block px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-semibold text-xs text-center w-full">
                  Rata {index + 1} di {installments.length}
                </span>
              </div>

              {/* Data Scadenza */}
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                  Scadenza (DD/MM/YYYY)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inst.dueDate}
                    onChange={(e) => {
                      const updated = [...installments];
                      updated[index].dueDate = e.target.value;
                      setInstallments(updated);
                    }}
                    placeholder="DD/MM/YYYY"
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Importo Rata */}
              <div className="w-full sm:w-32">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                  Importo (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={inst.amount}
                  onChange={(e) => {
                    const updated = [...installments];
                    updated[index].amount = parseFloat(e.target.value) || 0;
                    setInstallments(updated);
                  }}
                  className="w-full text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                />
              </div>

              {/* Modalità Pagamento */}
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                  Metodo di Pagamento
                </label>
                <input
                  type="text"
                  value={inst.paymentMethod || ''}
                  onChange={(e) => {
                    const updated = [...installments];
                    updated[index].paymentMethod = e.target.value;
                    setInstallments(updated);
                  }}
                  placeholder="es. Bonifico, RiBa"
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Saldata checkbox & Delete */}
              <div className="flex items-center gap-2 pt-2 sm:pt-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(inst.isPaid)}
                    onChange={(e) => {
                      const updated = [...installments];
                      updated[index].isPaid = e.target.checked;
                      setInstallments(updated);
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className={inst.isPaid ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                    Saldata
                  </span>
                </label>

                {installments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveInstallment(index)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                    title="Rimuovi questa rata"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Installment Button */}
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAddInstallment}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            Aggiungi Rata Personalizzata
          </button>

          {/* Sum / Balance Warning */}
          <div className="text-xs flex items-center gap-2">
            <span>
              Somma rate: <strong className="font-mono">€ {sumAmounts.toFixed(2)}</strong> di{' '}
              <strong className="font-mono">€ {invoice.amount.toFixed(2)}</strong>
            </span>
            {!isBalanced && (
              <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Diff: € {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                <button
                  type="button"
                  onClick={handleBalanceRemainder}
                  className="underline hover:text-amber-900 ml-1 cursor-pointer font-bold"
                  title="Bilancia la differenza sull'ultima rata"
                >
                  Bilancia
                </button>
              </span>
            )}
            {isBalanced && (
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Pareggiato
              </span>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Conferma Scadenzario
          </button>
        </div>
      </div>
    </div>
  );
};
