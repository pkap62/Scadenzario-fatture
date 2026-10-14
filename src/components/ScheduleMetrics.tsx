import React from 'react';
import { Calendar, AlertTriangle, Layers, CheckCircle2, Clock } from 'lucide-react';
import { InvoiceRecord } from '../types';

interface ScheduleMetricsProps {
  invoices: InvoiceRecord[];
}

export const ScheduleMetrics: React.FC<ScheduleMetricsProps> = ({ invoices }) => {
  // Helper to parse DD/MM/YYYY to timestamp
  const parseDate = (d: string) => {
    if (!d || !d.includes('/')) return 0;
    const [day, month, year] = d.split('/').map(Number);
    return new Date(year, (month || 1) - 1, day || 1).getTime();
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysFromNow = todayStart + 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysFromNow = todayStart + 30 * 24 * 60 * 60 * 1000;

  // Aggregate all installments
  let totalInstallmentsCount = 0;
  let installmentPlanInvoicesCount = 0;
  let totalAmountDue = 0;
  let totalAmountPaid = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let upcomingSevenDaysCount = 0;
  let upcomingSevenDaysAmount = 0;
  let totalCreditsAmount = 0;

  invoices.forEach((inv) => {
    const isCredit = inv.isIncoming;
    const instList = inv.installments && inv.installments.length > 0
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

    if (instList.length > 1 || inv.isInstallmentPlan) {
      installmentPlanInvoicesCount++;
    }

    instList.forEach((inst) => {
      totalInstallmentsCount++;
      const amt = Number(inst.amount) || 0;
      const dueTime = parseDate(inst.dueDate || inv.dueDate);

      if (isCredit) {
        totalCreditsAmount += amt;
      } else {
        if (inst.isPaid) {
          totalAmountPaid += amt;
        } else {
          totalAmountDue += amt;

          if (dueTime > 0 && dueTime < todayStart) {
            overdueCount++;
            overdueAmount += amt;
          } else if (dueTime >= todayStart && dueTime <= sevenDaysFromNow) {
            upcomingSevenDaysCount++;
            upcomingSevenDaysAmount += amt;
          }
        }
      }
    });
  });

  const grandTotal = totalAmountDue + totalAmountPaid;
  const percentPaid = grandTotal > 0 ? Math.round((totalAmountPaid / grandTotal) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      {/* 1. Totale da Pagare */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Scadenze da Pagare
          </span>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
            € {totalAmountDue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <span>{totalInstallmentsCount} rate totali</span>
          {totalCreditsAmount > 0 && (
            <span className="text-emerald-700 font-medium">
              (- € {totalCreditsAmount.toFixed(2)} note credito)
            </span>
          )}
        </div>
      </div>

      {/* 2. Scadute o Imminenti */}
      <div className={`bg-white border rounded-xl p-4 shadow-2xs ${overdueCount > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/90'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Scadenze Critiche
          </span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${overdueCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold font-mono tracking-tight ${overdueCount > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
            {overdueCount} scadute
          </span>
          {overdueCount > 0 && (
            <span className="text-xs font-mono text-amber-700 font-semibold">
              (€ {overdueAmount.toFixed(2)})
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{upcomingSevenDaysCount} in scadenza entro 7 gg (€ {upcomingSevenDaysAmount.toFixed(2)})</span>
        </p>
      </div>

      {/* 3. Fatture con Piano Rate */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Piani a Rate
          </span>
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
            {installmentPlanInvoicesCount}
          </span>
          <span className="text-xs text-slate-500 font-medium">fatture rateizzate</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {invoices.length - installmentPlanInvoicesCount} pagamenti a saldo unico
        </p>
      </div>

      {/* 4. Stato Pagamenti */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Stato Pagamenti
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-sm font-semibold text-slate-900">
            € {totalAmountPaid.toFixed(2)} saldati
          </span>
          <span className="text-xs font-bold text-emerald-700 font-mono">
            {percentPaid}%
          </span>
        </div>
        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, percentPaid)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
