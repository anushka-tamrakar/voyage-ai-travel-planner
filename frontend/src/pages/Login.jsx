import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Compass, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';

export const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('auth.errRequired'));
      return;
    }

    try {
      setSubmitting(true);
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 transition-colors">
      <Toast message={error} type="error" onClose={() => setError('')} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white mx-auto shadow-md shadow-brand-600/30 mb-4">
            <Compass className="w-7 h-7" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t('auth.welcomeBack')}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('auth.signInSubtitle')}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-colors">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                {t('auth.email')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t('auth.password')}
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-md shadow-brand-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.signingIn')}
                </>
              ) : (
                <>
                  {t('auth.signInBtn')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline transition-colors">
              {t('auth.signUpLink')}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
