import React from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, Shield, Sparkles } from 'lucide-react';

export const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 py-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
              <Compass className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
              Voyage<span className="text-brand-600 dark:text-brand-400">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-500" />
              <span>{t('footer.poweredBy')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>{t('footer.encrypted')}</span>
            </div>
          </div>

          <p className="text-sm text-slate-400 dark:text-slate-500 text-center md:text-right">
            &copy; {new Date().getFullYear()} {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
};
