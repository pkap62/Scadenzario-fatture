import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  Split,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CreditCard,
  Plus,
} from 'lucide-react';
import { InvoiceRecord, InvoiceInstallment } from '../types';
import { formatItalianDecimal } from '../utils/csv';

interface InvoicePlanViewProps {
  invoices: InvoiceRecord[];
  onTogglePaid: (invoiceId: string, installmentId: string, currentPaid: boolean) => void;
  onEditInstallments: (invoice: InvoiceRecord) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onEditInvoice?: (invoice: InvoiceRecord) => void;
}

export const InvoicePlanView: React.FC<InvoicePlanViewProps> = ({
  invoices,
  onTogglePaid,
  onEditInstallments,
  onDeleteInvoice,
  onEditInvoice,
}) => {
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedInvoiceId((prev) => (prev === id ? null : id));
  };

  const parseDate = (d: string) => {
    if (!d || !d.includes('/')) return 0;
    const [day, month, year] = d.split('/').map(Number);
    return new Date(year, (month || 1) - 1, day || 1).getTime();
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return (
    <div className="space-y-3.5">
      {invoices.map((inv) => {
        const isExpanded = expandedInvoiceId === inv.id;
        const installments = inv.installments && inv.installments.length > 0
          ? inv.installments
          : [
              {
                id: 'inst-1',
                installmentNumber: 1,
                totalInstallments: 1,
                dueDate: inv.dueDate,
                amount: inv.amount,
                paymentMethod: inv.paymentMethod || 'Bonifico bancario',
                iban: inv.iban,
                isPaid: false,
              },
            ];

        const isSplit = installments.length > 1;
        const paidCount = installments.filter((i) => i.isPaid).length;
        const paidAmount = installments
          .filter((i) => i.isPaid)
          .reduce((s, i) => s + (Number(i.amount) || 0), 0);
        const allPaid = installments.length > 0 && paidCount === installments.length;
        const percentPaid = inv.amount > 0 ? Math.round((paidAmount / inv.amount) * 100) : 0;

        // Upcoming due date among unpaid installments
        const unpaidInstallments = installments.filter((i) => !i.isPaid);
        const nextDueDate = unpaidInstallments.length > 0
          ? unpaidInstallments.sort((a, b) => parseDate(a.dueDate) - parseDate(b.dueDate))[0].dueDate
          : inv.dueDate;

        return (
          <div
            key={inv.id}
            className={`bg-white border rounded-xl shadow-2xs transition-all overflow-hidden ${
              allPaid
                ? 'border-slate-200/80 bg-slate-50/40'
                : isSplit
                ? 'border-indigo-200/80 hover:border-indigo-300'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {/* Header Row */}
            <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    inv.isIncoming
                      ? 'bg-emerald-100 text-emerald-700'
                      : isSplit
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isSplit ? <Split className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{inv.supplier}</h4>
                    <span className="text-xs font-mono font-medium text-slate-500">
                      Nr. {inv.invoiceNumber}
                    </span>
                    {inv.invoiceDate && (
                      <span className="text-xs text-slate-400">del {inv.invoiceDate}</span>
                    )}
                    {isSplit && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Split className="w-3 h-3" />
                        {installments.length} Rate
                      </span>
                    )}
                    {inv.isIncoming && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        Nota di Credito
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                    <span>Servizio: <strong>{inv.service}</strong></span>
                    {inv.period && <span>• Periodo: {inv.period}</span>}
                    {inv.paymentMethod && <span>• Metodo: {inv.paymentMethod}</span>}
                  </div>
                </div>
              </div>

              {/* Amount & Quick Status */}
              <div className="flex items-center justify-between lg:justify-end gap-4 flex-shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                <div className="text-left lg:text-right">
                  <div className="text-xs text-slate-500">Totale Documento</div>
                  <div className="text-lg font-bold font-mono text-slate-900">
                    € {formatItalianDecimal(inv.amount)}
                  </div>
                  {isSplit && (
                    <div className="text-[11px] font-medium text-indigo-700">
                      Prossima rata: {nextDueDate}
                    </div>
                  )}
                </div>

                {/* Progress / Status */}
                <div className="flex flex-col items-end gap-1.5 w-32">
                  <div className="flex items-center justify-between w-full text-xs">
                    <span className="text-slate-500 text-[11px]">Saldato</span>
                    <span className={`font-mono font-bold ${allPaid ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {percentPaid}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        allPaid ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, percentPaid)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {paidCount} su {installments.length} rate pagate
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5">
                  {onEditInvoice && (
                    <button
                      type="button"
                      onClick={() => onEditInvoice(inv)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Modifica importo o dati documento"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="hidden sm:inline">Modifica</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onEditInstallments(inv)}
                    className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Modifica piano rate"
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Piano Rate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpand(inv.id)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title={isExpanded ? 'Comprimi rate' : 'Visualizza rate'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteInvoice(inv.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Elimina documento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Expandable Installment Timeline/Cards */}
            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Dettaglio Piano Scadenze ({installments.length} {installments.length === 1 ? 'scadenza' : 'rate'})
                  </h5>
                  <button
                    type="button"
                    onClick={() => onEditInstallments(inv)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi o Ricalcola Rate
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {installments.map((inst, idx) => {
                    const dueTime = parseDate(inst.dueDate);
                    const isOverdue = dueTime > 0 && dueTime < todayStart && !inst.isPaid;

                    return (
                      <div
                        key={inst.id}
                        className={`p-3 rounded-xl border transition-all ${
                          inst.isPaid
                            ? 'bg-emerald-50/30 border-emerald-200'
                            : isOverdue
                            ? 'bg-rose-50/30 border-rose-200'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {installments.length > 1 ? `Rata ${idx + 1} di ${installments.length}` : 'Rata Unica'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onTogglePaid(inv.id, inst.id, Boolean(inst.isPaid))}
                            className={`text-xs px-2 py-0.5 rounded font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                              inst.isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            {inst.isPaid ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Saldato
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-slate-400" />
                                Da Pagare
                              </>
                            )}
                          </button>
                        </div>

                        <div className="text-base font-bold font-mono text-slate-900 mb-1">
                          € {formatItalianDecimal(inst.amount)}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Scadenza:</span>
                          <span className="font-mono font-semibold text-slate-800">{inst.dueDate}</span>
                        </div>

                        {inst.paymentMethod && (
                          <div className="text-[11px] text-slate-500 truncate mt-1">
                            {inst.paymentMethod}
                          </div>
                        )}

                        {inst.notes && (
                          <div className="text-[10px] text-slate-400 italic mt-0.5 truncate">
                            {inst.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
