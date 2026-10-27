import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Clock,
  DollarSign,
  HeartHandshake,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Landing = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: <Sparkles className="w-6 h-6 text-brand-600 dark:text-brand-400" />,
      title: t('landing.feat1Title'),
      description: t('landing.feat1Desc'),
    },
    {
      icon: <Clock className="w-6 h-6 text-brand-600 dark:text-brand-400" />,
      title: t('landing.feat2Title'),
      description: t('landing.feat2Desc'),
    },
    {
      icon: <HeartHandshake className="w-6 h-6 text-brand-600 dark:text-brand-400" />,
      title: t('landing.feat3Title'),
      description: t('landing.feat3Desc'),
    },
    {
      icon: <DollarSign className="w-6 h-6 text-brand-600 dark:text-brand-400" />,
      title: t('landing.feat4Title'),
      description: t('landing.feat4Desc'),
    },
  ];

  return (
    <div className="overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Hero Section */}
      <section className="relative pt-20 pb-24 md:pt-28 md:pb-36 bg-gradient-to-b from-brand-50/60 via-white to-slate-50 dark:from-slate-900/60 dark:via-slate-950 dark:to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-100/80 dark:bg-brand-950/80 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-200 text-xs md:text-sm font-semibold mb-6 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              {t('landing.badge')}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.15]"
            >
              {t('landing.heroTitle1')}{' '}
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 dark:from-brand-400 dark:via-brand-300 dark:to-indigo-400 bg-clip-text text-transparent">
                {t('landing.heroTitle2')}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-normal"
            >
              {t('landing.heroSubtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                to={isAuthenticated ? '/trips/new' : '/register'}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-base shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 group transition-all transform hover:-translate-y-0.5"
              >
                {t('landing.planFree')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-base border border-slate-200 dark:border-slate-800 shadow-sm transition-all"
              >
                {isAuthenticated ? t('landing.viewDashboard') : t('landing.signIn')}
              </Link>
            </motion.div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> {t('landing.perk1')}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> {t('landing.perk2')}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> {t('landing.perk3')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 bg-white dark:bg-slate-900 border-y border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest font-bold text-brand-600 dark:text-brand-400 mb-2">
              {t('landing.featHeader')}
            </h2>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('landing.featSub')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-white dark:hover:bg-slate-800 hover:border-brand-200 dark:hover:border-brand-800 hover:shadow-xl transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-6 shadow-sm group-hover:bg-brand-50 dark:group-hover:bg-brand-950/60 group-hover:border-brand-200 transition-colors">
                  {feat.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feat.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{feat.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Mock Preview / CTA */}
      <section className="py-20 bg-gradient-to-tr from-brand-900 via-brand-800 to-indigo-950 dark:from-slate-950 dark:via-brand-950 dark:to-slate-900 text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            {t('landing.readyTitle')}
          </h2>
          <p className="mt-4 text-brand-200 dark:text-slate-300 text-lg max-w-2xl mx-auto">
            {t('landing.readySubtitle')}
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              to={isAuthenticated ? '/trips/new' : '/register'}
              className="px-8 py-4 rounded-2xl bg-white dark:bg-slate-900 text-brand-900 dark:text-white font-bold text-base hover:bg-brand-50 dark:hover:bg-slate-800 shadow-xl shadow-black/20 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              {t('landing.readyBtn')}
              <ArrowRight className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
