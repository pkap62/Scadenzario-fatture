import React, { useMemo } from 'react';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Building2,
  Split,
  Edit2,
  Trash2,
  FileText,
  Copy,
  Check,
  RotateCcw,
  FolderOpen,
  Plus,
} from 'lucide-react';
import { InvoiceRecord, InvoiceInstallment, ScheduleItem } from '../types';
import { formatItalianDecimal } from '../utils/csv';

interface ScheduleListViewProps {
  invoices: InvoiceRecord[];
  onTogglePaid: (invoiceId: string, installmentId: string, currentPaid: boolean) => void;
  onEditInstallments: (invoice: InvoiceRecord) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onEditInvoice?: (invoice: InvoiceRecord) => void;
  onLoadDemo?: () => void;
  onOpenFileRestore?: () => void;
  onAddNew?: () => void;
  statusFilter: 'all' | 'pending' | 'paid' | 'overdue' | 'multi_installment';
}

export const ScheduleListView: React.FC<ScheduleListViewProps> = ({
  invoices,
  onTogglePaid,
  onEditInstallments,
  onDeleteInvoice,
  onEditInvoice,
  onLoadDemo,
  onOpenFileRestore,
  onAddNew,
  statusFilter,
}) => {
  const [copiedIban, setCopiedIban] = React.useState<string | null>(null);

  // Helper to parse DD/MM/YYYY
  const parseDate = (d: string) => {
    if (!d || !d.includes('/')) return 0;
    const [day, month, year] = d.split('/').map(Number);
    return new Date(year, (month || 1) - 1, day || 1).getTime();
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Flatten all invoices into chronological installment schedule items
  const scheduleItems: ScheduleItem[] = useMemo(() => {
    const list: ScheduleItem[] = [];

    invoices.forEach((inv) => {
      const instList = inv.installments && inv.installments.length > 0
        ? inv.installments
        : [
            {
              id: 'inst-default-1',
              installmentNumber: 1,
              totalInstallments: 1,
              dueDate: inv.dueDate,
              amount: inv.amount,
              paymentMethod: inv.paymentMethod || 'Bonifico bancario',
              iban: inv.iban,
              isPaid: false,
            },
          ];

      instList.forEach((inst) => {
        list.push({
          id: `${inv.id}-${inst.id}`,
          invoiceId: inv.id,
          installmentId: inst.id,
          installmentNumber: inst.installmentNumber || 1,
          totalInstallments: inst.totalInstallments || instList.length,
          isSinglePayment: instList.length === 1 && !inv.isInstallmentPlan,
          dueDate: inst.dueDate || inv.dueDate,
          amount: Number(inst.amount) || 0,
          supplier: inv.supplier,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          service: inv.service,
          totalInvoiceAmount: inv.amount,
          paymentMethod: inst.paymentMethod || inv.paymentMethod || 'Bonifico bancario',
          iban: inst.iban || inv.iban,
          isPaid: Boolean(inst.isPaid),
          isIncoming: Boolean(inv.isIncoming),
          period: inv.period,
          customerCode: inv.customerCode,
          fileName: inv.fileName,
        });
      });
    });

    // Sort chronologically by due date
    return list.sort((a, b) => parseDate(a.dueDate) - parseDate(b.dueDate));
  }, [invoices]);

  // Filter based on selected statusFilter
  const filteredSchedule = useMemo(() => {
    return scheduleItems.filter((item) => {
      const dueTime = parseDate(item.dueDate);
      const isOverdue = dueTime > 0 && dueTime < todayStart && !item.isPaid;

      if (statusFilter === 'pending') return !item.isPaid;
      if (statusFilter === 'paid') return item.isPaid;
      if (statusFilter === 'overdue') return isOverdue;
      if (statusFilter === 'multi_installment') return item.totalInstallments > 1;
      return true;
    });
  }, [scheduleItems, statusFilter, todayStart]);

  // Date status calculation helper
  const getDateStatusBadge = (dueDateStr: string, isPaid: boolean) => {
    if (isPaid) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Saldato
        </span>
      );
    }

    const dueTime = parseDate(dueDateStr);
    if (!dueTime) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-slate-500 bg-slate-100">
          Scadenza N/D
        </span>
      );
    }

    const diffDays = Math.round((dueTime - todayStart) / oneDayMs);

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertTriangle className="w-3 h-3" />
          Scaduta da {absDays} {absDays === 1 ? 'giorno' : 'giorni'}
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
          <Clock className="w-3 h-3 text-amber-700" />
          In scadenza OGGI
        </span>
      );
    } else if (diffDays <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          Tra {diffDays} {diffDays === 1 ? 'giorno' : 'giorni'}
        </span>
      );
    } else if (diffDays <= 30) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
          Tra {diffDays} giorni
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
          Tra {Math.round(diffDays / 30)} mesi
        </span>
      );
    }
  };

  const handleCopyIban = (iban: string) => {
    navigator.clipboard.writeText(iban);
    setCopiedIban(iban);
    setTimeout(() => setCopiedIban(null), 2000);
  };

  if (filteredSchedule.length === 0) {
    const isTotallyEmpty = invoices.length === 0;

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 sm:p-12 text-center shadow-2xs">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs border border-indigo-100">
          <Calendar className="w-7 h-7" />
        </div>
        <h4 className="text-base font-bold text-slate-900 mb-1">
          {isTotallyEmpty ? 'Lo scadenzario è attualmente vuoto' : 'Nessuna scadenza trovata con i filtri attivi'}
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          {isTotallyEmpty
            ? 'Trascina in alto le fatture PDF o XML per estrarre le rate, oppure scegli un\'azione rapida per iniziare:'
            : 'Non ci sono rate corrispondenti ai criteri di ricerca impostati. Prova a modificare i filtri o la ricerca.'}
        </p>

        {isTotallyEmpty && (
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-lg mx-auto">
            {onLoadDemo && (
              <button
                type="button"
                onClick={onLoadDemo}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Carica Dati Demo con Rate</span>
              </button>
            )}

            {onOpenFileRestore && (
              <button
                type="button"
                onClick={onOpenFileRestore}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-indigo-600" />
                <span>Ricarica Archivio dal PC (.json)</span>
              </button>
            )}

            {onAddNew && (
              <button
                type="button"
                onClick={onAddNew}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Nuova Scadenza Manuale</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4">Scadenza</th>
              <th className="py-3 px-4">Rata / Piano</th>
              <th className="py-3 px-4 text-right">Importo da Pagare</th>
              <th className="py-3 px-4">Fornitore & Fattura</th>
              <th className="py-3 px-4">Servizio</th>
              <th className="py-3 px-4">Modalità & IBAN</th>
              <th className="py-3 px-4 text-center">Stato</th>
              <th className="py-3 px-4 text-center font-bold text-indigo-700 bg-indigo-50/60 border-l border-indigo-100 tracking-wider">
                AZIONI
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSchedule.map((item) => {
              const fullInvoice = invoices.find((inv) => inv.id === item.invoiceId);

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-50/75 transition-colors ${
                    item.isPaid ? 'bg-emerald-50/20 text-slate-500' : ''
                  }`}
                >
                  {/* 1. Scadenza */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-sm font-bold text-slate-900 tracking-tight">
                        {item.dueDate}
                      </span>
                      <div>{getDateStatusBadge(item.dueDate, item.isPaid)}</div>
                    </div>
                  </td>

                  {/* 2. Rata / Piano */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {item.totalInstallments > 1 ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          <Split className="w-3.5 h-3.5" />
                          Rata {item.installmentNumber} di {item.totalInstallments}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Tot. fattura: € {formatItalianDecimal(item.totalInvoiceAmount)}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Rata Unica
                      </span>
                    )}
                  </td>

                  {/* 3. Importo da Pagare */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <span
                      className={`text-base font-mono font-bold tracking-tight ${
                        item.isIncoming
                          ? 'text-emerald-700'
                          : item.isPaid
                          ? 'text-slate-400 line-through'
                          : 'text-slate-900'
                      }`}
                    >
                      {item.isIncoming ? '+' : ''}€ {formatItalianDecimal(item.amount)}
                    </span>
                    {item.isIncoming && (
                      <div className="text-[10px] text-emerald-700 font-semibold uppercase">
                        Nota di Credito
                      </div>
                    )}
                  </td>

                  {/* 4. Fornitore & Fattura */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 truncate max-w-[180px]">
                        {item.supplier}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Fatt. nr. {item.invoiceNumber}
                        {item.invoiceDate ? ` del ${item.invoiceDate}` : ''}
                      </span>
                      {item.fileName && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[180px]" title={item.fileName}>
                          {item.fileName}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 5. Servizio */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-slate-700 font-medium">{item.service}</span>
                    {item.period && (
                      <span className="block text-[10px] text-slate-400">{item.period}</span>
                    )}
                  </td>

                  {/* 6. Modalità & IBAN */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1 max-w-[200px]">
                      <span className="text-slate-800 font-medium truncate" title={item.paymentMethod}>
                        {item.paymentMethod}
                      </span>
                      {item.iban && (
                        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          <span className="truncate">{item.iban}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyIban(item.iban!)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title="Copia IBAN"
                          >
                            {copiedIban === item.iban ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 7. Stato (Toggle button) */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onTogglePaid(item.invoiceId, item.installmentId, item.isPaid)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                        item.isPaid
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-white hover:bg-amber-50 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {item.isPaid ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Saldato
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Da Pagare
                        </>
                      )}
                    </button>
                  </td>

                  {/* 8. Azioni */}
                  <td className="py-3 px-4 text-center whitespace-nowrap bg-indigo-50/20 border-l border-indigo-100/60">
                    <div className="flex items-center justify-center gap-1">
                      {fullInvoice && onEditInvoice && (
                        <button
                          type="button"
                          onClick={() => onEditInvoice(fullInvoice)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Modifica importo, scadenza o dettagli fattura"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {fullInvoice && (
                        <button
                          type="button"
                          onClick={() => onEditInstallments(fullInvoice)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Modifica o rateizza il piano di pagamento"
                        >
                          <Split className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteInvoice(item.invoiceId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Elimina documento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
