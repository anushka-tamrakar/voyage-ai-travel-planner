import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({ message, type = 'error', onClose }) => {
  if (!message) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-100',
    error: 'border-rose-200 dark:border-rose-800 bg-rose-50/95 dark:bg-rose-950/90 text-rose-900 dark:text-rose-100',
    info: 'border-blue-200 dark:border-blue-800 bg-blue-50/95 dark:bg-blue-950/90 text-blue-900 dark:text-blue-100',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg backdrop-blur-md max-w-md ${borders[type] || borders.error}`}
      >
        {icons[type] || icons.error}
        <p className="text-sm font-medium flex-1">{message}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
