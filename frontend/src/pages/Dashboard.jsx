import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Compass,
  PlusCircle,
  Calendar,
  MapPin,
  Trash2,
  ArrowRight,
  Sparkles,
  DollarSign,
  Users,
} from 'lucide-react';
import { tripsAPI } from '../services/api';
import { CardSkeleton } from '../components/Skeleton';
import { Toast } from '../components/Toast';
import { formatCurrency, parseCostToINR, getExchangeRates, convertINR } from '../utils/currency';
import { READY_MADE_PLANS, POPULAR_DESTINATION_PACKAGES } from '../data/templates';

export const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [currentCurrency, setCurrentCurrency] = useState(
    () => localStorage.getItem('voyage_currency') || 'INR'
  );
  const [exchangeRates, setExchangeRates] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const handleCurrencySync = (e) => {
      if (e.detail) setCurrentCurrency(e.detail);
    };
    window.addEventListener('voyage_currency_change', handleCurrencySync);
    getExchangeRates().then(setExchangeRates);
    return () => window.removeEventListener('voyage_currency_change', handleCurrencySync);
  }, []);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const data = await tripsAPI.listTrips();
      setTrips(data);
    } catch (err) {
      setError(err.message || 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t('dashboard.deleteConfirm'))) {
      return;
    }
    try {
      setDeletingId(id);
      await tripsAPI.deleteTrip(id);
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete trip');
    } finally {
      setDeletingId(null);
    }
  };

  const getVibeBadgeColor = (vibe) => {
    const colors = {
      adventurous: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      romantic: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      cultural: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      foodie: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      chill: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    };
    return colors[vibe?.toLowerCase()] || 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  const formatTripDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-[85vh]">
      <Toast message={error} type="error" onClose={() => setError('')} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <Link
          to="/trips/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md shadow-brand-600/25 transition-all transform active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          {t('dashboard.planTrip')}
        </Link>
      </div>

      {/* Trips list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : trips.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 max-w-xl mx-auto shadow-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-4">
            <Compass className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('dashboard.noTrips')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
            {t('dashboard.noTripsSub')}
          </p>
          <Link
            to="/trips/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-600 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 hover:bg-brand-700 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            {t('dashboard.createFirst')}
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip, idx) => {
            const rawCostINR = parseCostToINR(trip.budget_per_day);
            const formattedBudget = formatCurrency(rawCostINR, currentCurrency, exchangeRates);

            return (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                onClick={() => navigate(`/trips/${trip.id}`)}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-black/40 hover:border-brand-200 dark:hover:border-brand-800 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                        <MapPin className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {trip.destination}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {formatTripDate(trip.start_date)} &rarr; {formatTripDate(trip.end_date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, trip.id)}
                      disabled={deletingId === trip.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                      title={t('dashboard.deleteTitle')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Badge tags */}
                  <div className="flex flex-wrap gap-1.5 my-4">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${getVibeBadgeColor(
                        trip.vibe
                      )}`}
                    >
                      {trip.vibe || 'chill'} {t('dashboard.vibeTag')}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                      {trip.pace} {t('dashboard.paceTag')}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {trip.travel_style}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3 mb-4">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" /> {t('dashboard.budget')}:
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {formattedBudget} {t('dashboard.perDay')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> {t('dashboard.groupSize')}:
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {trip.group_size}{' '}
                        {trip.group_size === 1 ? t('dashboard.traveler') : t('dashboard.travelers')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {trip.itinerary ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg">
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('dashboard.itineraryReady')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg">
                      {t('dashboard.notGenerated')}
                    </span>
                  )}

                  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    {t('dashboard.view')} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Ready-made Plans & Curated Destination Packages */}
      <div className="mt-16 pt-10 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Ready-made Plans & Curated Packages
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select any pre-designed itinerary outline and customize it instantly
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {READY_MADE_PLANS.slice(0, 4).map((plan) => {
            const convertedBudget = convertINR(plan.totalBudgetINR, currentCurrency, exchangeRates);
            const formatted = formatCurrency(convertedBudget, currentCurrency);
            return (
              <div
                key={plan.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      {plan.durationDays} Days
                    </span>
                    <span className="text-xs capitalize font-semibold text-slate-500 dark:text-slate-400">
                      {plan.vibe}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Ideas: {plan.suggestedDestinations.join(', ')}
                  </p>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4">
                    Est. Budget: <span className="font-bold text-blue-600 dark:text-blue-400">{formatted}</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/trips/new', { state: { prefilledPlan: plan } })}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  Use this plan <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* 8 Curated popular Indian destinations */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            Popular Indian Destination Packages
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {POPULAR_DESTINATION_PACKAGES.map((pkg) => {
              const convertedBudget = convertINR(pkg.approxBudgetINR, currentCurrency, exchangeRates);
              const formatted = formatCurrency(convertedBudget, currentCurrency);
              return (
                <div
                  key={pkg.city}
                  className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-blue-400 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {pkg.city}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                        {pkg.durationDays} Days
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">
                      {pkg.tagline}
                    </p>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      Best: {pkg.bestSeason}
                    </div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4">
                      Approx: <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatted}</span>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      navigate('/trips/new', {
                        state: {
                          prefilledPlan: {
                            destination: pkg.city,
                            durationDays: pkg.durationDays,
                            totalBudgetINR: pkg.approxBudgetINR,
                            travelStyle: pkg.travelStyle,
                            interests: pkg.interests,
                            vibe: pkg.vibe,
                            stayBudgetPerNight: pkg.stayBudgetPerNight,
                            foodBudgetPerMeal: pkg.foodBudgetPerMeal,
                            stayType: pkg.stayType,
                            diet: pkg.diet,
                          },
                        },
                      })
                    }
                    className="w-full py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    Use this plan <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
