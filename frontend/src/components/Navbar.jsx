import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, PlusCircle, LayoutDashboard, LogOut, User, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { CurrencySelector } from './CurrencySelector';

export const Navbar = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
              Voyage<span className="text-brand-600 dark:text-brand-400">AI</span>
            </span>
          </Link>

          {/* Desktop Navigation & Utilities */}
          <div className="hidden md:flex items-center gap-3 lg:gap-4">
            {/* Global Utility Controls */}
            <CurrencySelector />
            <LanguageSwitcher />
            <ThemeToggle />

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>

            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-2 text-sm font-semibold transition-colors px-3 py-2 rounded-xl ${
                    isActive('/dashboard')
                      ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  {t('nav.myTrips')}
                </Link>

                <Link
                  to="/trips/new"
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/25 transition-all transform active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  {t('nav.planTrip')}
                </Link>

                <div className="flex items-center gap-3 pl-2">
                  <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-700 dark:text-slate-200 text-xs font-medium">
                    <div className="w-6 h-6 rounded-full bg-brand-200 dark:bg-brand-900 text-brand-800 dark:text-brand-200 flex items-center justify-center font-bold">
                      {user?.name ? user.name[0].toUpperCase() : <User className="w-3.5 h-3.5" />}
                    </div>
                    <span className="max-w-[120px] truncate">{user?.name}</span>
                  </div>

                  <button
                    onClick={handleLogout}
                    title={t('nav.signOut')}
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/login"
                  className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {t('nav.logIn')}
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-xl shadow-md shadow-brand-600/20 transition-all"
                >
                  {t('nav.getStarted')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile buttons */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Settings</span>
            <div className="flex items-center gap-2">
              <CurrencySelector />
              <LanguageSwitcher />
            </div>
          </div>

          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-3 py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-xl mb-3">
                <div className="w-8 h-8 rounded-full bg-brand-200 dark:bg-brand-900 text-brand-800 dark:text-brand-200 flex items-center justify-center font-bold text-sm">
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</div>
                </div>
              </div>

              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <LayoutDashboard className="w-5 h-5 text-brand-600" />
                {t('nav.myTrips')}
              </Link>

              <Link
                to="/trips/new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-brand-700 dark:text-brand-300 font-semibold bg-brand-50 dark:bg-brand-950/60"
              >
                <PlusCircle className="w-5 h-5 text-brand-600" />
                {t('nav.planTrip')}
              </Link>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/50"
              >
                <LogOut className="w-5 h-5" />
                {t('nav.signOut')}
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                {t('nav.logIn')}
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 font-semibold text-white bg-brand-600 rounded-xl shadow-md shadow-brand-600/20"
              >
                {t('nav.getStarted')}
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};
