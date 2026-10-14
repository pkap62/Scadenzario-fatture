import React, { useState } from 'react';
import { AlertTriangle, Edit2, Split, Info, CheckCircle2, ChevronRight, X } from 'lucide-react';

interface VerificationNoticeProps {
  onDismiss?: () => void;
}

export const VerificationNotice: React.FC<VerificationNoticeProps> = ({ onDismiss }) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const handleClose = () => {
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  };

  return (
    <div
      id="verification-notice-card"
      className="bg-amber-50 border-2 border-amber-300/90 rounded-xl p-4 text-amber-950 shadow-xs transition-all relative"
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          {/* Icon Badge */}
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-amber-950 tracking-tight flex items-center gap-1.5">
                Verifica dei Dati Estratti
              </h4>
              <span className="text-[11px] font-semibold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                Avviso Importante
              </span>
            </div>

            {/* Core Message requested by user */}
            <p className="text-xs sm:text-sm font-medium text-amber-900 leading-relaxed">
              <strong className="font-bold text-amber-950">
                Controllare l&apos;esattezza degli importi riportati.
              </strong>{' '}
              In caso di errore o discrepanza, correggere cliccando nella colonna{' '}
              <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-200/90 text-amber-950 rounded font-bold text-xs tracking-wider border border-amber-300 uppercase">
                AZIONI
              </span>{' '}
              della tabella sottostante.
            </p>

            {/* Action Guide Pills */}
            <div className="pt-1.5 flex flex-wrap items-center gap-2 text-xs text-amber-900">
              <span className="text-[11px] text-amber-800 font-semibold">Cosa puoi correggere:</span>
              <div className="inline-flex items-center gap-1 bg-white/80 border border-amber-200 px-2.5 py-1 rounded-lg text-slate-800 text-[11px] font-medium shadow-2xs">
                <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  <strong>Modifica (matita):</strong> correggi importo totale, data scadenza o fornitore
                </span>
              </div>
              <div className="inline-flex items-center gap-1 bg-white/80 border border-amber-200 px-2.5 py-1 rounded-lg text-slate-800 text-[11px] font-medium shadow-2xs">
                <Split className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  <strong>Rate (frecce):</strong> aggiungi o ricalcola le singole rate e scadenze
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Close / Dismiss button */}
        <button
          type="button"
          onClick={handleClose}
          className="text-amber-700 hover:text-amber-900 hover:bg-amber-200/60 p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          title="Chiudi avviso"
          aria-label="Chiudi avviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
