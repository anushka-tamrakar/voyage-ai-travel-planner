import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('voyage_theme');
    if (saved) {
      return saved === 'dark';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('voyage_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('voyage_theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="p-2 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
    </button>
  );
};
