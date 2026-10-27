import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, ArrowLeft } from 'lucide-react';

export const NotFound = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-6">
        <Compass className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
        {t('notFound.title')}
      </h1>
      <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
        {t('notFound.subtitle')}
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 shadow-md shadow-brand-600/25 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('notFound.returnHome')}
      </Link>
    </div>
  );
};
