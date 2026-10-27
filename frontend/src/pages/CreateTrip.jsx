import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Sparkles,
  Users,
  DollarSign,
  Heart,
  ArrowRight,
  ArrowLeft,
  Flame,
  Coffee,
  Palette,
  Utensils,
  Compass,
  LocateFixed,
  Radio,
  ExternalLink,
  Navigation,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Hotel,
} from 'lucide-react';
import { tripsAPI, destinationsAPI } from '../services/api';
import { Toast } from '../components/Toast';
import { convertToINR, convertINR, formatCurrency, getExchangeRates, SUPPORTED_CURRENCIES } from '../utils/currency';
import { READY_MADE_PLANS } from '../data/templates';

const TRAVEL_STYLES = ['Solo Explorer', 'Couple', 'Family Friendly', 'Budget Backpacking', 'Luxury & Comfort', 'Relaxed Leisure'];

const AVAILABLE_INTERESTS = [
  'History & Landmarks',
  'Food & Wine',
  'Nature & Hiking',
  'Art & Museums',
  'Nightlife & Bars',
  'Local Markets & Shopping',
  'Architecture & Design',
  'Hidden Gems & Off-Path',
  'Beaches & Coastal',
  'Photography Spots',
];

const VIBES = [
  { id: 'chill', label: 'Chill & Relaxed', icon: Coffee, desc: 'Scenic cafes, tranquil parks, zero rush' },
  { id: 'adventurous', label: 'Adventurous', icon: Flame, desc: 'Thrilling viewpoints, open-air discoveries' },
  { id: 'cultural', label: 'Cultural Deep Dive', icon: Palette, desc: 'Historic quarters, artisan workshops, heritage' },
  { id: 'foodie', label: 'Foodie Immersion', icon: Utensils, desc: 'Iconic street food, regional specialties, bistros' },
  { id: 'romantic', label: 'Romantic & Scenic', icon: Heart, desc: 'Sunset vistas, intimate dinners, cozy walks' },
];

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Jain Pure Veg', 'Halal', 'Kosher', 'Gluten-Free', 'Dairy-Free', 'Nut Allergy', 'Pescatarian'];

export const CreateTrip = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedCurrency, setSelectedCurrency] = useState(
    () => localStorage.getItem('voyage_currency') || 'INR'
  );
  const [exchangeRates, setExchangeRates] = useState({});

  useEffect(() => {
    const handleCurrencySync = (e) => {
      if (e.detail) setSelectedCurrency(e.detail);
    };
    window.addEventListener('voyage_currency_change', handleCurrencySync);
    getExchangeRates().then(setExchangeRates);
    return () => window.removeEventListener('voyage_currency_change', handleCurrencySync);
  }, []);

  const currencyMeta =
    SUPPORTED_CURRENCIES.find((c) => c.code === selectedCurrency) || SUPPORTED_CURRENCIES[0];

  // If user arrived with a template from Dashboard, pre-fill and jump straight to step 1
  const prefilled = location.state?.prefilledPlan;

  const [step, setStep] = useState(prefilled ? 1 : 0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    destination: prefilled?.destination || (prefilled?.suggestedDestinations ? prefilled.suggestedDestinations[0] : ''),
    origin: '',
    start_date: '',
    end_date: '',
    travel_style: prefilled?.travelStyle || 'Solo Explorer',
    interests: prefilled?.interests || ['History & Landmarks', 'Food & Wine'],
    group_size: 1,
    total_budget: prefilled?.totalBudgetINR ? String(prefilled.totalBudgetINR) : (selectedCurrency === 'INR' ? '25000' : '300'),
    pace: prefilled?.pace || 'moderate',
    dietary_restrictions: prefilled?.diet ? [prefilled.diet] : [],
    mobility_concerns: '',
    vibe: prefilled?.vibe || 'chill',
    stay_budget_per_night: prefilled?.stayBudgetPerNight || 2500,
    food_budget_per_meal: prefilled?.foodBudgetPerMeal || 400,
    stay_type: prefilled?.stayType || 'hotel',
    diet: prefilled?.diet || 'any',
  });

  // Budget Split State (default Stay 40%, Food 25%, Transport 15%, Activities 15%, Buffer 5%)
  const [budgetSplit, setBudgetSplit] = useState({
    stay: 40,
    food: 25,
    transport: 15,
    activities: 15,
    buffer: 5,
  });

  // Live Location & Reverse Geocoding State
  const [liveLocation, setLiveLocation] = useState(null);
  const [liveAddress, setLiveAddress] = useState('');
  const [locationTracking, setLocationTracking] = useState(false);
  const [locationMsg, setLocationMsg] = useState('');
  const [useLocationAsOrigin, setUseLocationAsOrigin] = useState(false);

  // Popular in City state
  const [popularData, setPopularData] = useState(null);
  const [popularCategory, setPopularCategory] = useState('attractions');
  const [loadingPopular, setLoadingPopular] = useState(false);

  // Number of trip days
  const numDays = useMemo(() => {
    if (!formData.start_date || !formData.end_date) return prefilled?.durationDays || 3;
    try {
      const d1 = new Date(formData.start_date);
      const d2 = new Date(formData.end_date);
      const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
      return diff >= 1 ? diff : 3;
    } catch {
      return 3;
    }
  }, [formData.start_date, formData.end_date, prefilled]);

  // Real daily cap calculation
  const calculatedDailyCap = useMemo(() => {
    const total = parseFloat(formData.total_budget) || 0;
    if (total <= 0 || numDays <= 0) return 0;
    return Math.round(total / numDays);
  }, [formData.total_budget, numDays]);

  // Sync comfort sliders when budget split or total budget changes
  useEffect(() => {
    const total = parseFloat(formData.total_budget) || 25000;
    const stayPart = (total * (budgetSplit.stay / 100)) / Math.max(1, numDays);
    const mealsPerDay = 3;
    const foodPart = (total * (budgetSplit.food / 100)) / (Math.max(1, numDays) * mealsPerDay * Math.max(1, formData.group_size));

    setFormData((prev) => ({
      ...prev,
      stay_budget_per_night: Math.max(500, Math.round(stayPart)),
      food_budget_per_meal: Math.max(100, Math.round(foodPart)),
    }));
  }, [formData.total_budget, budgetSplit.stay, budgetSplit.food, numDays, formData.group_size]);

  // Live Location watchPosition with Nominatim reverse geocode
  const toggleLocation = () => {
    if (locationTracking) {
      setLocationTracking(false);
      setLocationMsg('');
    } else {
      if (!navigator.geolocation) {
        setLocationMsg(t('map.unsupported') || 'Geolocation is not supported by your browser.');
        return;
      }
      setLocationMsg('');
      setLocationTracking(true);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setLiveLocation([lat, lon]);
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await res.json();
            if (data && data.address) {
              const area = data.address.suburb || data.address.neighbourhood || data.address.road || '';
              const city = data.address.city || data.address.town || data.address.village || data.address.state_district || '';
              const state = data.address.state || '';
              const formatted = [area, city, state].filter(Boolean).join(', ');
              setLiveAddress(formatted);
              if (useLocationAsOrigin) {
                setFormData((prev) => ({ ...prev, origin: city || formatted }));
              }
            }
          } catch (e) {
            console.warn('Reverse geocode error:', e);
          }
        },
        (err) => {
          setLocationMsg(t('map.permissionDenied') || 'Location permission denied. Please allow location access.');
          setLocationTracking(false);
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }
  };

  const handleOriginCheckbox = (e) => {
    const checked = e.target.checked;
    setUseLocationAsOrigin(checked);
    if (checked && liveAddress) {
      setFormData((prev) => ({ ...prev, origin: liveAddress }));
    } else if (!checked) {
      setFormData((prev) => ({ ...prev, origin: '' }));
    }
  };

  // Fetch Popular in destination city
  useEffect(() => {
    const dest = formData.destination.trim();
    if (dest.length < 2) {
      setPopularData(null);
      return;
    }
    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoadingPopular(true);
        const data = await destinationsAPI.getPopular(dest, i18n.language || 'en');
        if (!isCancelled) setPopularData(data);
      } catch (err) {
        console.warn('Failed to load popular in city:', err);
      } finally {
        if (!isCancelled) setLoadingPopular(false);
      }
    }, 600);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [formData.destination, i18n.language]);

  const toggleInterest = (item) => {
    setFormData((prev) => {
      const exists = prev.interests.includes(item);
      const updated = exists ? prev.interests.filter((i) => i !== item) : [...prev.interests, item];
      return { ...prev, interests: updated };
    });
  };

  const toggleDietary = (item) => {
    setFormData((prev) => {
      const exists = prev.dietary_restrictions.includes(item);
      const updated = exists
        ? prev.dietary_restrictions.filter((i) => i !== item)
        : [...prev.dietary_restrictions, item];
      return { ...prev, dietary_restrictions: updated };
    });
  };

  const handleSplitChange = (category, value) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    setBudgetSplit((prev) => ({ ...prev, [category]: num }));
  };

  const totalSplitPercent = Object.values(budgetSplit).reduce((a, b) => a + b, 0);

  const applyTemplate = (plan) => {
    setFormData((prev) => ({
      ...prev,
      destination: plan.suggestedDestinations ? plan.suggestedDestinations[0] : prev.destination,
      travel_style: plan.travelStyle || prev.travel_style,
      interests: plan.interests || prev.interests,
      pace: plan.pace || prev.pace,
      vibe: plan.vibe || prev.vibe,
      total_budget: String(plan.totalBudgetINR || 25000),
      stay_budget_per_night: plan.stayBudgetPerNight || 2500,
      food_budget_per_meal: plan.foodBudgetPerMeal || 400,
      stay_type: plan.stayType || 'hotel',
      diet: plan.diet || 'any',
    }));
    setStep(1);
  };

  const validateStep = () => {
    setError('');
    if (step === 1) {
      if (!formData.destination.trim()) {
        setError(t('createTrip.errDest') || 'Please enter a travel destination');
        return false;
      }
      if (!formData.start_date || !formData.end_date) {
        setError(t('createTrip.errDates') || 'Please select start and end dates');
        return false;
      }
      if (new Date(formData.start_date) > new Date(formData.end_date)) {
        setError(t('createTrip.errDateOrder') || 'End date cannot be before start date');
        return false;
      }
    }
    if (step === 2) {
      if (formData.interests.length === 0) {
        setError(t('createTrip.errInterests') || 'Please select at least one interest');
        return false;
      }
    }
    if (step === 3) {
      if (!formData.total_budget || Number(formData.total_budget) <= 0) {
        setError('Please enter a valid total trip budget');
        return false;
      }
      if (totalSplitPercent !== 100) {
        setError(`Budget split must total 100% (currently ${totalSplitPercent}%)`);
        return false;
      }
      if (formData.group_size < 1) {
        setError(t('createTrip.errGroup') || 'Group size must be at least 1');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    try {
      setLoading(true);
      setLoadingMessage(t('createTrip.craftingStep1') || 'Personalizing your itinerary with AI...');

      // Convert user total budget to INR if entered in other currency
      const totalBudgetINR = convertToINR(formData.total_budget, selectedCurrency, exchangeRates);
      const computedDailyCapINR = Math.max(1, Math.round(totalBudgetINR / Math.max(1, numDays)));

      const payload = {
        ...formData,
        group_size: Number(formData.group_size),
        total_budget: totalBudgetINR,
        budget_per_day: `₹${computedDailyCapINR}`,
        stay_budget_per_night: Number(formData.stay_budget_per_night),
        food_budget_per_meal: Number(formData.food_budget_per_meal),
        stay_type: formData.stay_type,
        diet: formData.diet,
        origin: formData.origin || null,
        currency: selectedCurrency,
        language: i18n.language || 'en',
      };

      const createdTrip = await tripsAPI.createTrip(payload);

      setLoadingMessage(t('createTrip.craftingStep2') || 'Optimizing routes and venue coordinates...');
      await tripsAPI.generateItinerary(createdTrip.id);

      navigate(`/trips/${createdTrip.id}`);
    } catch (err) {
      setError(err.message || 'Failed to generate itinerary. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-[85vh]">
      <Toast message={error} type="error" onClose={() => setError('')} />

      {/* Progress header (hidden on step 0) */}
      {step > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              {t('createTrip.step')} {step} {t('createTrip.of')} 5
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {step === 1 && 'Destination & Starting Point'}
              {step === 2 && 'Travel Style & Interests'}
              {step === 3 && 'Total Budget & Allocation'}
              {step === 4 && 'Comfort Budget (Stay & Food)'}
              {step === 5 && 'Vibe, Dietary & Final Review'}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-brand-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-6 sm:p-10 relative transition-colors">
        {loading && (
          <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-3xl z-20 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-4 animate-bounce">
              <Sparkles className="w-8 h-8 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {t('createTrip.craftingTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md">{loadingMessage}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 0: Predefined Trip Plans */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                    Choose a Ready-Made Plan
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Pick a popular curated package or start completely from scratch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl border border-brand-600 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-xs font-bold transition-all shadow-sm shrink-0"
                >
                  Start From Scratch &rarr;
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {READY_MADE_PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 bg-slate-50/50 dark:bg-slate-800/30 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-md">
                          {plan.durationDays} Days
                        </span>
                        <span className="text-xs capitalize font-semibold text-slate-500 dark:text-slate-400">
                          {plan.vibe}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                        {plan.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {plan.suggestedDestinations.join(', ')}
                      </p>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
                        Est: <span className="font-bold text-blue-600 dark:text-blue-400">₹{plan.totalBudgetINR.toLocaleString()}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyTemplate(plan)}
                      className="w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      Use this plan &rarr;
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 1: Destination & Live Location */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {t('createTrip.step1Title')}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Tell us where you are heading and your travel window.
                </p>
              </div>

              {/* Destination Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  {t('createTrip.destination')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <MapPin className="w-5 h-5 text-brand-500" />
                  </div>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    placeholder={t('createTrip.destPlaceholder') || 'e.g. Jaipur, Goa, Manali, Paris'}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 dark:bg-slate-800 text-base"
                  />
                </div>
              </div>

              {/* Live Location Helper & Origin Checkbox */}
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={toggleLocation}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      locationTracking
                        ? 'bg-blue-600 text-white animate-pulse'
                        : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 shadow-sm'
                    }`}
                  >
                    <LocateFixed className="w-4 h-4" />
                    {locationTracking ? 'Tracking Live Location' : 'Use My Current Location'}
                  </button>

                  {liveAddress && (
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate max-w-sm">
                      📍 {liveAddress}
                    </span>
                  )}
                </div>

                {locationMsg && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {locationMsg}
                  </div>
                )}

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer pt-1 border-t border-blue-100 dark:border-blue-900/60">
                  <input
                    type="checkbox"
                    checked={useLocationAsOrigin}
                    onChange={handleOriginCheckbox}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Use my location as trip starting point (Origin)</span>
                </label>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    {t('createTrip.startDate')}
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 dark:bg-slate-800 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    {t('createTrip.endDate')}
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              {/* Popular in City Preview (Requirement 6) */}
              {formData.destination.trim().length >= 2 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Popular Highlights in {formData.destination}
                    </h3>
                    {loadingPopular && (
                      <span className="text-xs text-slate-400 animate-pulse">Loading highlights...</span>
                    )}
                  </div>

                  {popularData && (
                    <div className="space-y-3">
                      {/* Chips */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {['attractions', 'foods', 'shopping', 'hidden_gems'].map((cat) => (
                          <button
                            type="button"
                            key={cat}
                            onClick={() => setPopularCategory(cat)}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize shrink-0 transition-all ${
                              popularCategory === cat
                                ? 'bg-brand-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {cat.replace('_', ' ')}
                          </button>
                        ))}
                      </div>

                      {/* Highlight Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                        {(popularCategory === 'attractions'
                          ? popularData.top_attractions
                          : popularCategory === 'foods'
                          ? popularData.must_try_foods
                          : popularCategory === 'shopping'
                          ? popularData.shopping_specialties
                          : popularData.hidden_gems
                        )?.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs"
                          >
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.area} &bull; {item.price_range || item.best_time || 'Iconic'}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2: Style & Interests */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {t('createTrip.step2Title')}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  How do you like to explore?
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  {t('createTrip.travelStyle')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TRAVEL_STYLES.map((style) => (
                    <button
                      type="button"
                      key={style}
                      onClick={() => setFormData({ ...formData, travel_style: style })}
                      className={`p-3 rounded-2xl border text-sm font-semibold transition-all text-left ${
                        formData.travel_style === style
                          ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  {t('createTrip.interests')}
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {AVAILABLE_INTERESTS.map((interest) => {
                    const selected = formData.interests.includes(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          selected
                            ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Total Trip Budget & Budget Split (Requirement 2) */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Total Trip Budget & Allocation
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Specify your total spending limit and customize how funds are split.
                </p>
              </div>

              {/* Total budget input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    Total Trip Budget ({currencyMeta.code} {currencyMeta.symbol})
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                      {currencyMeta.symbol}
                    </div>
                    <input
                      type="number"
                      min="100"
                      value={formData.total_budget}
                      onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                      placeholder="25000"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 dark:bg-slate-800 text-sm font-bold"
                    />
                  </div>
                </div>

                {/* Real Daily Cap Display */}
                <div className="p-4 rounded-2xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900 flex flex-col justify-center">
                  <div className="text-xs text-brand-700 dark:text-brand-300 font-semibold">
                    Calculated Daily Cap ({numDays} days):
                  </div>
                  <div className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 mt-1">
                    {currencyMeta.symbol} {calculatedDailyCap.toLocaleString()} <span className="text-xs font-normal text-slate-500">/ day</span>
                  </div>
                </div>
              </div>

              {/* Budget Split Sliders (Stay 40%, Food 25%, Transport 15%, Activities 15%, Buffer 5%) */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-brand-600" />
                    Budget Split (Total: {totalSplitPercent}%)
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      totalSplitPercent === 100
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {totalSplitPercent === 100 ? 'Balanced (100%)' : `Must equal 100% (diff: ${100 - totalSplitPercent}%)`}
                  </span>
                </div>

                {/* 5 Sliders */}
                {[
                  { key: 'stay', label: '🏨 Stay & Accommodation', val: budgetSplit.stay },
                  { key: 'food', label: '🍽️ Food & Dining', val: budgetSplit.food },
                  { key: 'transport', label: '🚖 Local Transit & Cabs', val: budgetSplit.transport },
                  { key: 'activities', label: '🎟️ Sights & Experiences', val: budgetSplit.activities },
                  { key: 'buffer', label: '🛡️ Safety Buffer & Misc', val: budgetSplit.buffer },
                ].map((item) => {
                  const shareAmount = Math.round(((parseFloat(formData.total_budget) || 0) * item.val) / 100);
                  return (
                    <div key={item.key} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span>{item.label}</span>
                        <span>
                          {currencyMeta.symbol} {shareAmount.toLocaleString()} ({item.val}%)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="80"
                        value={item.val}
                        onChange={(e) => handleSplitChange(item.key, e.target.value)}
                        className="w-full accent-brand-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Group Size and Pace */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    {t('createTrip.groupSize')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.group_size}
                    onChange={(e) => setFormData({ ...formData, group_size: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    {t('createTrip.dailyPace')}
                  </label>
                  <select
                    value={formData.pace}
                    onChange={(e) => setFormData({ ...formData, pace: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800 text-sm font-semibold"
                  >
                    <option value="relaxed">Relaxed (1-2 stops/day)</option>
                    <option value="moderate">Moderate (2-3 stops/day)</option>
                    <option value="fast">Fast-Paced (3-4 stops/day)</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Comfort Budget for Stay & Food (Requirement 4) */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Your Comfort Budget
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  We only recommend hotels and dining strictly inside your selected comfort boundaries.
                </p>
              </div>

              {/* Stay Preferences */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Hotel className="w-4 h-4 text-purple-600" />
                    Stay Comfort (Per Night)
                  </h3>
                  <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg">
                    ₹{Number(formData.stay_budget_per_night).toLocaleString()}/night
                  </span>
                </div>

                {/* Stay Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Under ₹1,000', val: 900 },
                    { label: '₹1,000 - 2,500', val: 2200 },
                    { label: '₹2,500 - 5,000', val: 4000 },
                    { label: '₹5,000+', val: 7500 },
                  ].map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => setFormData({ ...formData, stay_budget_per_night: preset.val })}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                        formData.stay_budget_per_night === preset.val
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="500"
                  max="20000"
                  step="250"
                  value={formData.stay_budget_per_night}
                  onChange={(e) => setFormData({ ...formData, stay_budget_per_night: Number(e.target.value) })}
                  className="w-full accent-purple-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />

                {/* Stay Type Choice */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    Preferred Accommodation Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['hostel', 'guest house', 'hotel', 'resort'].map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setFormData({ ...formData, stay_type: type })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition-all ${
                          formData.stay_type === type
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Food Preferences */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-emerald-600" />
                    Food Comfort (Per Person Per Meal)
                  </h3>
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg">
                    ₹{Number(formData.food_budget_per_meal).toLocaleString()}/meal
                  </span>
                </div>

                {/* Food Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Under ₹150', val: 120 },
                    { label: '₹150 - 400', val: 300 },
                    { label: '₹400 - 800', val: 650 },
                    { label: '₹800+', val: 1200 },
                  ].map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => setFormData({ ...formData, food_budget_per_meal: preset.val })}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                        formData.food_budget_per_meal === preset.val
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="80"
                  max="3000"
                  step="50"
                  value={formData.food_budget_per_meal}
                  onChange={(e) => setFormData({ ...formData, food_budget_per_meal: Number(e.target.value) })}
                  className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />

                {/* Diet Choice */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    Dietary Choice
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {['veg', 'non-veg', 'Jain', 'vegan', 'any'].map((dietOption) => (
                      <button
                        type="button"
                        key={dietOption}
                        onClick={() => setFormData({ ...formData, diet: dietOption })}
                        className={`py-2 px-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                          formData.diet === dietOption
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {dietOption}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: Vibe, Dietary Restrictions & Review */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Trip Vibe & Final Review
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Choose the atmospheric tone for your journey.
                </p>
              </div>

              {/* Vibe Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  {t('createTrip.tripVibe')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {VIBES.map((v) => {
                    const IconComp = v.icon;
                    const selected = formData.vibe === v.id;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => setFormData({ ...formData, vibe: v.id })}
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                          selected
                            ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            selected ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{v.label}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{v.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dietary Specifics */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Specific Dietary Allergies / Restrictions
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map((item) => {
                    const selected = formData.dietary_restrictions.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => toggleDietary(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          selected
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobility */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Mobility Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formData.mobility_concerns}
                  onChange={(e) => setFormData({ ...formData, mobility_concerns: e.target.value })}
                  placeholder="e.g. avoid steep stairs, wheelchair friendly, travelling with elder"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 dark:bg-slate-800"
                />
              </div>

              {/* Review Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <span className="font-bold text-slate-900 dark:text-white block mb-1">
                  Ready to Plan:
                </span>
                <div>
                  <strong>Destination:</strong> {formData.destination} {formData.origin ? `(Origin: ${formData.origin})` : ''} &bull; {formData.start_date} to {formData.end_date} ({numDays} days)
                </div>
                <div>
                  <strong>Total Budget:</strong> {currencyMeta.symbol} {Number(formData.total_budget).toLocaleString()} (Cap: {currencyMeta.symbol} {calculatedDailyCap}/day)
                </div>
                <div>
                  <strong>Comfort:</strong> {formData.stay_type} (≤₹{formData.stay_budget_per_night}/night) &bull; {formData.diet} dining (≤₹{formData.food_budget_per_meal}/meal)
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          {step > 0 ? (
            <button
              type="button"
              onClick={prevStep}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('createTrip.back')}
            </button>
          ) : (
            <div></div>
          )}

          {step === 0 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md shadow-brand-600/20 transition-all"
            >
              Start From Scratch
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : step < 5 ? (
            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md shadow-brand-600/20 transition-all"
            >
              {t('createTrip.continue')}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {t('createTrip.generate')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
