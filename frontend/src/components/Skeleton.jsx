import React from 'react';

export const CardSkeleton = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm animate-pulse flex flex-col justify-between h-64">
    <div>
      <div className="flex justify-between items-start mb-4">
        <div className="h-6 w-3/5 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
        <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
      </div>
      <div className="h-4 w-2/5 bg-slate-200 dark:bg-slate-800 rounded mb-4"></div>
      <div className="flex gap-2 mb-4">
        <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
        <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
        <div className="h-5 w-14 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
      </div>
    </div>
    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
      <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
    </div>
  </div>
);

export const TimelineSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex gap-4 items-start">
        <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0"></div>
        <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-5 w-1/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
          </div>
          <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="flex gap-4 pt-2">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const PageLoading = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
    <div className="w-12 h-12 border-4 border-brand-200 dark:border-brand-900 border-t-brand-600 rounded-full animate-spin"></div>
    <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">Loading experience...</p>
  </div>
);
