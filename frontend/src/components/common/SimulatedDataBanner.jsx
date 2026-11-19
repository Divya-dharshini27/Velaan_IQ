import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function SimulatedDataBanner({ hasSimulated = true }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('velaan_simulated_banner_dismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('velaan_simulated_banner_dismissed', 'true');
  };

  if (dismissed || !hasSimulated) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-amber-950 px-4 py-2.5 text-xs sm:text-sm font-medium shadow-sm transition-all border-b border-amber-600/30">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="p-1 rounded-md bg-amber-400/50 text-amber-950 flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-950" />
          </span>
          <span className="text-white font-medium">
            <strong className="font-semibold text-amber-100">Notice:</strong> Demo data: values are simulated, not real market prices.
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="text-amber-200 hover:text-white p-1 rounded hover:bg-amber-800/40 transition"
          aria-label="Dismiss simulated data banner"
          title="Dismiss for this session"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default SimulatedDataBanner;
