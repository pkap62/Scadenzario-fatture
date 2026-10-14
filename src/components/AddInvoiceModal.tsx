import React, { useState } from 'react';
import { X, Plus, Calendar, Building2, Split, Check } from 'lucide-react';
import { InvoiceRecord, InvoiceInstallment } from '../types';

interface AddInvoiceModalProps {
  onAdd: (invoice: InvoiceRecord) => void;
  onClose: () => void;
}

export const AddInvoiceModal: React.FC<AddInvoiceModalProps> = ({ onAdd, onClose }) => {
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });
  const [dueDate, setDueDate] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return `${String(nextMonth.getDate()).padStart(2, '0')}/${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`;
  });
  const [service, setService] = useState('Energia Elettrica');
  const [amount, setAmount] = useState<number>(0);
  const [isIncoming, setIsIncoming] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Bonifico bancario');
  const [iban, setIban] = useState('');
  const [period, setPeriod] = useState('');
  const [splitCount, setSplitCount] = useState<number>(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    // Helper to add months to DD/MM/YYYY
    const addMonths = (dateStr: string, monthsToAdd: number): string => {
      let [d, m, y] = (dateStr || dueDate).split('/').map(Number);
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

    const count = Math.max(1, splitCount);
    const baseAmt = Math.floor((amount / count) * 100) / 100;
    const remainder = Number((amount - baseAmt * count).toFixed(2));

    const installments: InvoiceInstallment[] = [];
    for (let i = 0; i < count; i++) {
      const amt = i === 0 ? Number((baseAmt + remainder).toFixed(2)) : baseAmt;
      installments.push({
        id: `inst-manual-${Math.random().toString(36).substring(2, 9)}`,
        installmentNumber: i + 1,
        totalInstallments: count,
        dueDate: addMonths(dueDate, i),
        amount: amt,
        paymentMethod,
        iban,
        isPaid: false,
        notes: count > 1 ? `Rata ${i + 1} di ${count}` : 'Rata unica',
      });
    }

    const newRecord: InvoiceRecord = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      invoiceNumber: invoiceNumber || `DOC-${Date.now().toString().slice(-4)}`,
      invoiceDate,
      dueDate: installments[0]?.dueDate || dueDate,
      supplier: supplier || 'Fornitore Generico',
      service,
      amount,
      isIncoming,
      paymentMethod,
      iban,
      period,
      isInstallmentPlan: count > 1,
      installments,
      fileName: 'Inserimento Manuale',
    };

    onAdd(newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            Nuova Fattura / Scadenza
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fornitore *
              </label>
              <input
                type="text"
                required
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="es. Energentium S.r.l."
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Numero Fattura
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="es. 2025/00123"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Importo Totale (€) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full text-xs font-mono font-bold px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data Prima Scadenza (DD/MM/YYYY) *
              </label>
              <input
                type="text"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Installments split selection */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Split className="w-3.5 h-3.5 text-indigo-600" />
                Suddivisione in Rate
              </label>
              <span className="text-[11px] text-indigo-700 font-medium">
                {splitCount === 1 ? 'Saldo unico' : `${splitCount} rate mensili`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSplitCount(num)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    splitCount === num
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {num === 1 ? '1 Rata' : `${num} Rate`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Servizio / Utenza
              </label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="Energia Elettrica">Energia Elettrica</option>
                <option value="Gas Naturale">Gas Naturale</option>
                <option value="Servizio Idrico Integrato">Acqua / Idrico</option>
                <option value="Telecomunicazioni / Fibra">Telefono / Internet</option>
                <option value="Spese Generali">Spese Generali</option>
                <option value="Manutenzione">Manutenzione</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Modalità Pagamento
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="es. Bonifico bancario"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              IBAN per il pagamento (opzionale)
            </label>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="IT..."
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Aggiungi allo Scadenzario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
