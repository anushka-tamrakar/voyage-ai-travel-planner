import React, { useState, useRef, useEffect } from 'react';
import { DollarSign, Check } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '../utils/currency';

export const CurrencySelector = ({ value, onChange }) => {
  const [internalCurrency, setInternalCurrency] = useState(() => {
    return localStorage.getItem('voyage_currency') || 'INR';
  });
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeCurrency = value || internalCurrency;
  const currentMeta =
    SUPPORTED_CURRENCIES.find((c) => c.code === activeCurrency) || SUPPORTED_CURRENCIES[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code) => {
    localStorage.setItem('voyage_currency', code);
    setInternalCurrency(code);
    if (onChange) onChange(code);
    setOpen(false);
    // Dispatch window event so all currency selectors stay synchronized
    window.dispatchEvent(new CustomEvent('voyage_currency_change', { detail: code }));
  };

  useEffect(() => {
    const handleSync = (e) => {
      if (e.detail && e.detail !== internalCurrency) {
        setInternalCurrency(e.detail);
      }
    };
    window.addEventListener('voyage_currency_change', handleSync);
    return () => window.removeEventListener('voyage_currency_change', handleSync);
  }, [internalCurrency]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
        title="Select Currency"
      >
        <span className="font-bold text-brand-600 dark:text-brand-400">{currentMeta.symbol}</span>
        <span>{currentMeta.code}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Select Currency
          </div>
          {SUPPORTED_CURRENCIES.map((curr) => {
            const isSelected = curr.code === currentMeta.code;
            return (
              <button
                key={curr.code}
                onClick={() => handleSelect(curr.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors ${
                  isSelected
                    ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>
                  <strong className="mr-1">{curr.symbol}</strong> {curr.code}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
