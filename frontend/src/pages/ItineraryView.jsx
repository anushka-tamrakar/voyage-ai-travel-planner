import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Calendar,
  Clock,
  Share2,
  Printer,
  Download,
  RotateCw,
  Sparkles,
  ArrowLeft,
  Sliders,
  Lightbulb,
  Navigation,
  Hotel,
  Utensils,
  Map as MapIcon,
  PieChart,
  CalendarDays,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Plus,
  Check,
  Search,
} from 'lucide-react';
import { tripsAPI, destinationsAPI } from '../services/api';
import { TimelineSkeleton } from '../components/Skeleton';
import { Toast } from '../components/Toast';
import { MapView } from '../components/MapView';
import { CurrencySelector } from '../components/CurrencySelector';
import {
  formatCurrency,
  parseCostToINR,
  getExchangeRates,
  convertINR,
} from '../utils/currency';

export const ItineraryView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [trip, setTrip] = useState(null);
  const [activeTab, setActiveTab] = useState('itinerary'); // 'itinerary', 'map', 'stay', 'eat', 'budget'
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Selected stop index to highlight on the map
  const [selectedMapStopIndex, setSelectedMapStopIndex] = useState(null);

  // Currency & Exchange Rates
  const [currentCurrency, setCurrentCurrency] = useState(
    () => localStorage.getItem('voyage_currency') || 'INR'
  );
  const [exchangeRates, setExchangeRates] = useState({});

  // Translation cache per language
  const [translationCache, setTranslationCache] = useState({});
  const [translating, setTranslating] = useState(false);

  // Tweak / Regenerate modal state
  const [showTweakModal, setShowTweakModal] = useState(false);
  const [tweakPace, setTweakPace] = useState('moderate');
  const [tweakVibe, setTweakVibe] = useState('chill');
  const [tweakNotes, setTweakNotes] = useState('');

  // Comfort Budget Modal & Update Recommendations state (Requirement 4)
  const [showComfortModal, setShowComfortModal] = useState(false);
  const [updatingRecommendations, setUpdatingRecommendations] = useState(false);
  const [comfortStayBudget, setComfortStayBudget] = useState(2500);
  const [comfortFoodBudget, setComfortFoodBudget] = useState(400);
  const [comfortStayType, setComfortStayType] = useState('hotel');
  const [comfortDiet, setComfortDiet] = useState('any');

  // Popular in City state (Requirement 6)
  const [popularData, setPopularData] = useState(null);
  const [popularCategory, setPopularCategory] = useState('attractions');
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [overBudgetWarning, setOverBudgetWarning] = useState(null);

  useEffect(() => {
    const handleCurrencySync = (e) => {
      if (e.detail) setCurrentCurrency(e.detail);
    };
    window.addEventListener('voyage_currency_change', handleCurrencySync);
    getExchangeRates().then(setExchangeRates);
    return () => window.removeEventListener('voyage_currency_change', handleCurrencySync);
  }, []);

  const loadTrip = async () => {
    try {
      setLoading(true);
      const data = await tripsAPI.getTrip(id);
      setTrip(data);
      if (data.pace) setTweakPace(data.pace);
      if (data.vibe) setTweakVibe(data.vibe);
      if (data.stay_budget_per_night) setComfortStayBudget(data.stay_budget_per_night);
      if (data.food_budget_per_meal) setComfortFoodBudget(data.food_budget_per_meal);
      if (data.stay_type) setComfortStayType(data.stay_type);
      if (data.diet) setComfortDiet(data.diet);
      if (data.itinerary) {
        setTranslationCache((prev) => ({ ...prev, en: data.itinerary }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrip();
  }, [id]);

  // Load Popular in this city for recommendations / exploration (Requirement 6)
  useEffect(() => {
    if (!trip?.destination) return;
    let isCancelled = false;
    const fetchPopular = async () => {
      try {
        setLoadingPopular(true);
        const data = await destinationsAPI.getPopular(trip.destination, i18n.language || 'en');
        if (!isCancelled) setPopularData(data);
      } catch (e) {
        console.warn('Failed to load popular in city:', e);
      } finally {
        if (!isCancelled) setLoadingPopular(false);
      }
    };
    fetchPopular();
    return () => {
      isCancelled = true;
    };
  }, [trip?.destination, i18n.language]);

  // Handle dynamic multi-language translation on language change
  useEffect(() => {
    const activeLang = i18n.language || 'en';
    if (!trip || !trip.itinerary) return;

    if (activeLang === 'en') {
      if (translationCache['en']) {
        setTrip((prev) => ({ ...prev, itinerary: translationCache['en'] }));
      }
      return;
    }

    if (translationCache[activeLang]) {
      setTrip((prev) => ({ ...prev, itinerary: translationCache[activeLang] }));
      return;
    }

    let isMounted = true;
    const fetchTranslation = async () => {
      try {
        setTranslating(true);
        const translated = await tripsAPI.translateItinerary(id, activeLang);
        if (isMounted && translated) {
          setTranslationCache((prev) => ({ ...prev, [activeLang]: translated }));
          setTrip((prev) => ({ ...prev, itinerary: translated }));
        }
      } catch (err) {
        console.warn('Auto-translation failed:', err);
      } finally {
        if (isMounted) setTranslating(false);
      }
    };

    fetchTranslation();
    return () => {
      isMounted = false;
    };
  }, [i18n.language, id, trip?.id]);

  const handleGenerate = async () => {
    try {
      setRegenerating(true);
      const itinerary = await tripsAPI.generateItinerary(id);
      setTrip((prev) => ({ ...prev, itinerary }));
      setTranslationCache((prev) => ({ ...prev, [i18n.language || 'en']: itinerary }));
      setSuccessToast(t('itinerary.generatedToast') || 'Itinerary generated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to generate itinerary');
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegenerate = async (e) => {
    e.preventDefault();
    try {
      setRegenerating(true);
      setShowTweakModal(false);
      const updated = await tripsAPI.regenerateItinerary(id, {
        pace: tweakPace,
        vibe: tweakVibe,
        notes: tweakNotes,
        language: i18n.language || 'en',
      });
      setTrip((prev) => ({
        ...prev,
        pace: tweakPace,
        vibe: tweakVibe,
        itinerary: updated,
      }));
      setTranslationCache((prev) => ({ ...prev, [i18n.language || 'en']: updated }));
      setSuccessToast(t('itinerary.regeneratedToast') || 'Itinerary refreshed successfully!');
    } catch (err) {
      setError(err.message || 'Failed to refresh itinerary');
    } finally {
      setRegenerating(false);
    }
  };

  // Update only recommendations without regenerating itinerary (Requirement 4)
  const handleUpdateRecommendations = async (e) => {
    e.preventDefault();
    try {
      setUpdatingRecommendations(true);
      const updatedItin = await tripsAPI.updateRecommendations(id, {
        stay_budget_per_night: Number(comfortStayBudget),
        food_budget_per_meal: Number(comfortFoodBudget),
        stay_type: comfortStayType,
        diet: comfortDiet,
        language: i18n.language || 'en',
      });
      setTrip((prev) => ({
        ...prev,
        stay_budget_per_night: Number(comfortStayBudget),
        food_budget_per_meal: Number(comfortFoodBudget),
        stay_type: comfortStayType,
        diet: comfortDiet,
        itinerary: updatedItin,
      }));
      setShowComfortModal(false);
      setSuccessToast('Updated stay & dining recommendations successfully!');
    } catch (err) {
      setError(err.message || 'Failed to update recommendations');
    } finally {
      setUpdatingRecommendations(false);
    }
  };

  // Execute adding stop and recompute totals
  const executeAddStop = (item) => {
    if (!currentDay) return;
    const fee = parseCostToINR(item.price_range || '0');
    const newActivity = {
      time: 'Flexible Slot',
      title: `Exploration: ${item.name}`,
      place_name: item.name,
      area: item.area,
      lat: item.lat || null,
      lng: item.lng || null,
      category: popularCategory === 'foods' ? 'food' : 'sightseeing',
      description: item.description,
      location: `${item.area}, ${trip.destination}`,
      estimated_cost: fee > 0 ? `₹${fee}` : 'Free',
      travel_tip: `Renowned highlight in ${trip.destination}. Perfect addition to Day ${activeDayIndex + 1}.`,
    };

    setTrip((prev) => {
      const updatedDays = [...prev.itinerary.days];
      updatedDays[activeDayIndex] = {
        ...updatedDays[activeDayIndex],
        activities: [...(updatedDays[activeDayIndex].activities || []), newActivity],
      };

      const oldB = prev.itinerary?.budget_summary || {};
      const newTotal = (oldB.total_estimated_cost || 0) + fee;
      const targetB = oldB.total_budget || 0;
      const newBudgetSummary = {
        ...oldB,
        total_estimated_cost: newTotal,
        remaining_budget: targetB - newTotal,
        within_budget: newTotal <= targetB,
        below_minimum: newTotal > targetB,
      };

      return {
        ...prev,
        itinerary: {
          ...prev.itinerary,
          days: updatedDays,
          budget_summary: newBudgetSummary,
        },
      };
    });

    setSuccessToast(`Added "${item.name}" to Day ${activeDayIndex + 1}!`);
  };

  // Add popular item directly into current day activities with budget check
  const handleAddPopularStop = (item) => {
    if (!currentDay) return;
    const fee = parseCostToINR(item.price_range || '0');
    const currentTotal = budgetSummary?.tripTotalINR || 0;
    const targetBudget = budgetSummary?.targetBudgetTripINR || 0;
    const newTotal = currentTotal + fee;

    if (newTotal > targetBudget && targetBudget > 0) {
      setOverBudgetWarning({ item, newTotal, targetBudget });
    } else {
      executeAddStop(item);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${trip.destination} Travel Plan`,
          text: `Check out my travel itinerary for ${trip.destination}!`,
          url,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyToClipboard(url);
        }
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccessToast(t('itinerary.shareCopied') || 'Link copied to clipboard!');
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trip, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${trip.destination.replace(/\s+/g, '_')}_itinerary.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const days = trip?.itinerary?.days || [];
  const currentDay = days[activeDayIndex] || (days.length > 0 ? days[0] : null);
  const recommendations = trip?.itinerary?.recommendations || { hotels: [], dining: [] };

  // Step 5: Show only the backend's numbers. Category percentages against total_budget.
  const backendBudget = trip?.itinerary?.budget_summary;
  const budgetSummary = useMemo(() => {
    if (!days || days.length === 0) return null;
    const numDays = Math.max(1, days.length);

    if (backendBudget) {
      const targetBudgetTripINR = Number(backendBudget.total_budget) || 0;
      const tripTotalINR = Number(backendBudget.total_estimated_cost) || 0;
      const remainingBudgetINR = Number(backendBudget.remaining_budget); // Can be negative
      const withinBudget = Boolean(backendBudget.within_budget);
      const dailyCapINR = Number(backendBudget.daily_cap) || Math.round(targetBudgetTripINR / numDays);
      const varianceINR = Math.abs(tripTotalINR - targetBudgetTripINR);
      const catCosts = backendBudget.per_category_costs || {};

      return {
        targetBudgetTripINR,
        tripTotalINR,
        remainingBudgetINR,
        withinBudget,
        dailyCapINR,
        varianceINR,
        isUnderBudget: withinBudget,
        perDayCosts: backendBudget.per_day_costs || Array(numDays).fill(dailyCapINR),
        perDayBreakdown: backendBudget.per_day_breakdown || null,
        perCategoryCosts: catCosts,
        budgetNote: backendBudget.budget_note || [],
        belowMinimum: Boolean(backendBudget.below_minimum),
        minimumRequired: backendBudget.minimum_required,
        stayTotalINR: Number(catCosts.stay || 0),
        foodTotalINR: Number(catCosts.food || 0),
        activitiesTotalINR: Number(catCosts.activities || 0),
        transportTotalINR: Number(catCosts.transport || 0),
        bufferTotalINR: Number(catCosts.buffer || 0),
      };
    }

    // Fallback for older trips without backend budget_summary
    const targetBudgetTripINR = trip?.total_budget
      ? Number(trip.total_budget)
      : (parseCostToINR(trip?.budget_per_day) || 3000) * numDays * (trip?.group_size || 1);
    const realDailyCapINR = Math.max(100, Math.round(targetBudgetTripINR / numDays));

    let activitiesTotalINR = 0;
    days.forEach((d) => {
      d.activities?.forEach((a) => {
        activitiesTotalINR += parseCostToINR(a.estimated_cost);
      });
    });

    const hotelCostPerNight = trip?.stay_budget_per_night || 2500;
    const stayTotalINR = hotelCostPerNight * Math.max(numDays - 1, 1);
    const foodPerMeal = trip?.food_budget_per_meal || 400;
    const foodTotalINR = foodPerMeal * 3 * numDays * (trip?.group_size || 1);
    const transportTotalINR = Math.round(400 * numDays * (trip?.group_size || 1));
    const bufferTotalINR = Math.round((activitiesTotalINR + stayTotalINR + foodTotalINR + transportTotalINR) * 0.05);
    const tripTotalINR = activitiesTotalINR + stayTotalINR + foodTotalINR + transportTotalINR + bufferTotalINR;
    const remainingBudgetINR = targetBudgetTripINR - tripTotalINR;

    return {
      targetBudgetTripINR,
      tripTotalINR,
      remainingBudgetINR,
      withinBudget: tripTotalINR <= targetBudgetTripINR,
      dailyCapINR: realDailyCapINR,
      varianceINR: Math.abs(tripTotalINR - targetBudgetTripINR),
      isUnderBudget: tripTotalINR <= targetBudgetTripINR,
      perDayCosts: Array(numDays).fill(realDailyCapINR),
      perDayBreakdown: null,
      perCategoryCosts: {
        stay: stayTotalINR,
        food: foodTotalINR,
        activities: activitiesTotalINR,
        transport: transportTotalINR,
        buffer: bufferTotalINR,
      },
      budgetNote: [],
      belowMinimum: false,
      minimumRequired: null,
      stayTotalINR,
      foodTotalINR,
      activitiesTotalINR,
      transportTotalINR,
      bufferTotalINR,
    };
  }, [backendBudget, days, trip]);

  // All activities across current day for MapView
  const currentDayStops = useMemo(() => {
    return (currentDay?.activities || []).map((a, idx) => ({
      ...a,
      index: idx,
    }));
  }, [currentDay]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <TimelineSkeleton />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Trip not found</h2>
        <Link to="/dashboard" className="mt-4 inline-block text-brand-600 dark:text-brand-400 font-semibold text-sm">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const hasComfortBudget = Boolean(trip.stay_budget_per_night || trip.food_budget_per_meal);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[85vh]">
      <Toast message={error} type="error" onClose={() => setError('')} />
      <Toast message={successToast} type="success" onClose={() => setSuccessToast('')} />

      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200/80 dark:border-slate-800 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {trip.destination}
              </h1>
              {trip.origin && (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  from {trip.origin}
                </span>
              )}
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 capitalize border border-brand-200 dark:border-brand-800">
                {trip.vibe || 'chill'} vibe
              </span>
              {translating && (
                <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold animate-pulse flex items-center gap-1">
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  Translating...
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {trip.start_date} to {trip.end_date} &bull; {trip.pace} pace &bull;{' '}
                Total Budget: {formatCurrency(budgetSummary?.targetBudgetTripINR || 25000, currentCurrency, exchangeRates)} (Cap: {formatCurrency(budgetSummary?.realDailyCapINR || 3000, currentCurrency, exchangeRates)}/day)
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls & Currency Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <CurrencySelector value={currentCurrency} onChange={setCurrentCurrency} />

          <button
            onClick={() => setShowTweakModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            {t('itinerary.tweakBtn') || 'Tweak'}
          </button>

          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            {t('itinerary.jsonBtn') || 'JSON'}
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            {t('itinerary.printBtn') || 'Print'}
          </button>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            {t('itinerary.shareBtn') || 'Share'}
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-slate-200 dark:border-slate-800 no-print">
        <button
          onClick={() => setActiveTab('itinerary')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'itinerary'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          {t('itinerary.tabs.itinerary') || 'Timeline'}
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'map'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          {t('itinerary.tabs.map') || 'Live Map'}
        </button>

        <button
          onClick={() => setActiveTab('stay')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'stay'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Hotel className="w-4 h-4" />
          {t('itinerary.tabs.stay') || 'Where to Stay'}
        </button>

        <button
          onClick={() => setActiveTab('eat')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'eat'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Utensils className="w-4 h-4" />
          {t('itinerary.tabs.eat') || 'Where to Eat'}
        </button>

        <button
          onClick={() => setActiveTab('budget')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'budget'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <PieChart className="w-4 h-4" />
          {t('itinerary.tabs.budget') || 'Budget Breakdown'}
        </button>
      </div>

      {/* If Generation Error or No Itinerary Exists */}
      {!trip.itinerary || days.length === 0 ? (
        error ? (
          <div className="bg-rose-50 dark:bg-rose-950/40 rounded-3xl border border-rose-200 dark:border-rose-900 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-rose-900 dark:text-rose-100">
              Generation Failed
            </h2>
            <p className="text-sm text-rose-700 dark:text-rose-300 mt-2 mb-6 break-words">
              {error}
            </p>
            <button
              onClick={() => {
                setError('');
                handleGenerate();
              }}
              disabled={regenerating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 text-white font-semibold text-sm shadow-lg shadow-rose-600/30 hover:bg-rose-700 disabled:opacity-50"
            >
              {regenerating ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RotateCw className="w-4 h-4" />
                  Try again
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {t('itinerary.notGeneratedTitle') || 'No Itinerary Generated Yet'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
              Click below to generate your personalized AI itinerary.
            </p>
            <button
              onClick={handleGenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-600 text-white font-semibold text-sm shadow-lg shadow-brand-600/30 hover:bg-brand-700 disabled:opacity-50"
            >
              {regenerating ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Now
                </>
              )}
            </button>
          </div>
        )
      ) : (
        <div>
          {/* TAB 1: TIMELINE */}
          {activeTab === 'itinerary' && (
            <div>
              {/* Summary card */}
              {trip.itinerary.summary && (
                <div className="bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 rounded-2xl p-4 sm:p-5 mb-8 flex items-start gap-3.5 shadow-sm">
                  <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-bold text-brand-800 dark:text-brand-300 tracking-wider">
                      Trip Overview
                    </span>
                    <p className="text-sm text-brand-950 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                      {trip.itinerary.summary}
                    </p>
                  </div>
                </div>
              )}

              {/* Day selection tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-print scrollbar-none">
                {days.map((day, idx) => {
                  const isActive = idx === activeDayIndex;
                  const dayCost = day.day_cost || budgetSummary?.perDayCosts?.[idx] || 0;
                  return (
                    <button
                      key={`day-tab-${day.id || day.day || idx}`}
                      onClick={() => setActiveDayIndex(idx)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex flex-col items-start gap-0.5 ${
                        isActive
                          ? 'bg-slate-900 dark:bg-brand-600 text-white shadow-md'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Day {day.day || idx + 1}</span>
                        {day.theme && (
                          <span className="text-[11px] font-normal truncate max-w-[130px] opacity-80">
                            &bull; {day.theme}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-medium opacity-75">
                        {formatCurrency(dayCost, currentCurrency, exchangeRates)} / {formatCurrency(budgetSummary?.dailyCapINR, currentCurrency, exchangeRates)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Current day activities */}
              {currentDay && (
                <div key={`day-content-${currentDay.id || currentDay.day || activeDayIndex}`} className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-2">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center flex-wrap gap-2">
                        <span>Day {currentDay.day}</span>
                        {currentDay.theme && (
                          <span className="text-brand-600 dark:text-brand-400 font-semibold text-base">
                            &mdash; {currentDay.theme}
                          </span>
                        )}
                      </h2>
                      {currentDay.date && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{currentDay.date}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                        Day Cost: <strong>{formatCurrency(currentDay.day_cost || budgetSummary?.perDayCosts?.[activeDayIndex] || 0, currentCurrency, exchangeRates)}</strong>
                      </span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {currentDay.activities?.length || 0} activities
                      </span>
                    </div>
                  </div>

                  {/* Itemized Cost Breakdown Per Day Pill Bar */}
                  {(currentDay.cost_breakdown || budgetSummary?.perDayBreakdown?.[activeDayIndex]) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">
                        Daily Itemized Cost:
                      </span>
                      {(() => {
                        const cb = currentDay.cost_breakdown || budgetSummary?.perDayBreakdown?.[activeDayIndex] || {};
                        return (
                          <>
                            <span className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold text-xs border border-purple-200/60 dark:border-purple-800/60">
                              🏨 Stay: {formatCurrency(cb.stay || 0, currentCurrency, exchangeRates)}
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-200/60 dark:border-emerald-800/60">
                              🍽️ Food: {formatCurrency(cb.food || 0, currentCurrency, exchangeRates)}
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold text-xs border border-blue-200/60 dark:border-blue-800/60">
                              🎟️ Sights: {formatCurrency(cb.activities || 0, currentCurrency, exchangeRates)}
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-semibold text-xs border border-amber-200/60 dark:border-amber-800/60">
                              🚖 Transit: {formatCurrency(cb.transport || 0, currentCurrency, exchangeRates)}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Activities list with EXACT place names and area (Requirement 3) */}
                  <div className="relative pl-6 sm:pl-8 border-l-2 border-brand-200 dark:border-brand-800 space-y-6 ml-3 sm:ml-4">
                    {currentDay.activities?.map((activity, actIdx) => {
                      const costINR = parseCostToINR(activity.estimated_cost);
                      const displayCost = formatCurrency(costINR, currentCurrency, exchangeRates);
                      const exactName = activity.place_name || activity.title;
                      const areaName = activity.area || activity.location;

                      return (
                        <motion.div
                          key={actIdx}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: actIdx * 0.05 }}
                          className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                        >
                          {/* Marker badge */}
                          <div className="absolute -left-[31px] sm:-left-[39px] top-6 w-5 h-5 rounded-full bg-brand-600 text-white font-extrabold text-[11px] flex items-center justify-center border-4 border-white dark:border-slate-950 shadow-sm">
                            {actIdx + 1}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-xs font-bold">
                                  <Clock className="w-3.5 h-3.5" />
                                  {activity.time}
                                </span>
                                {/* TITLE FORMAT: Category Title: Exact Place Name */}
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                                  {activity.title}
                                </h3>
                              </div>
                              {/* AREA / LOCALITY */}
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>{areaName}</span>
                              </div>
                            </div>

                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 self-start sm:self-auto">
                              {displayCost}
                            </span>
                          </div>

                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed my-3 font-normal">
                            {activity.description}
                          </p>

                          {/* Quick Action Navigation Buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setActiveTab('map');
                                  setSelectedMapStopIndex(actIdx);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950 text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 font-semibold transition-colors"
                              >
                                <MapIcon className="w-3.5 h-3.5" />
                                {t('itinerary.showOnMap') || 'Show on map'}
                              </button>

                              {activity.lat && activity.lng && (
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${activity.lat},${activity.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 text-brand-700 dark:text-brand-300 font-semibold transition-colors"
                                >
                                  <Navigation className="w-3.5 h-3.5" />
                                  {t('itinerary.navigate') || 'Navigate'}
                                </a>
                              )}
                            </div>
                          </div>

                          {activity.travel_tip && (
                            <div className="mt-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-3 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                              <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div>
                                <strong>Insider Tip:</strong> {activity.travel_tip}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* POPULAR IN THIS CITY SECTION (Requirement 6) */}
              {popularData && (
                <div className="mt-14 pt-8 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        Popular in {trip.destination}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Authentic local landmarks, renowned eateries & hidden spots. Click to add directly to today's schedule!
                      </p>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                      {['attractions', 'foods', 'shopping', 'hidden_gems'].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setPopularCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize shrink-0 transition-all ${
                            popularCategory === cat
                              ? 'bg-brand-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {cat.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                              {item.name}
                            </h4>
                            {item.price_range && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                                {item.price_range}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>{item.area}</span>
                            {item.exact_dish && <span className="font-semibold text-emerald-600">&bull; {item.exact_dish}</span>}
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-4 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <button
                            onClick={() => handleAddPopularStop(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 text-brand-700 dark:text-brand-300 font-bold text-[11px] transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            Add to Day {activeDayIndex + 1}
                          </button>

                          <div className="flex items-center gap-1.5 ml-auto">
                            {item.lat && item.lng && (
                              <button
                                onClick={() => setActiveTab('map')}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Show on map"
                              >
                                <MapIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {item.lat && item.lng && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Navigate"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE MAP & NEARBY */}
          {activeTab === 'map' && (
            <div>
              <MapView
                stops={currentDayStops}
                destinationName={trip.destination}
                selectedStopIndex={selectedMapStopIndex}
                onSelectStop={(idx) => setSelectedMapStopIndex(idx)}
              />
            </div>
          )}

          {/* TAB 3: WHERE TO STAY (HOTELS) */}
          {activeTab === 'stay' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    Where to Stay in {trip.destination}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Curated options matching your comfort budget (≤ ₹{trip.stay_budget_per_night || 2500}/night).
                  </p>
                </div>

                <button
                  onClick={() => setShowComfortModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition shadow-sm"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Change Budget
                </button>
              </div>

              {!hasComfortBudget ? (
                /* Comfort Budget Prompt Card */
                <div className="p-8 rounded-3xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-slate-900 border border-purple-200 dark:border-purple-800 text-center max-w-lg mx-auto shadow-sm space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <Hotel className="w-7 h-7" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                    Tell us your comfort budget first
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Set your nightly room rate and preferred lodging type so we can suggest verified accommodations within your limit.
                  </p>
                  <button
                    onClick={() => setShowComfortModal(true)}
                    className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-md shadow-purple-600/30 hover:bg-purple-700 transition"
                  >
                    Set Comfort Budget &rarr;
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(recommendations.hotels || []).map((hotel, hIdx) => {
                    const costINR = parseCostToINR(hotel.price_range);
                    const displayCost = formatCurrency(costINR, currentCurrency, exchangeRates);
                    const tierColors = {
                      budget: 'from-emerald-500 to-teal-600',
                      'mid-range': 'from-blue-600 to-indigo-600',
                      premium: 'from-amber-500 to-rose-600',
                    };

                    return (
                      <div
                        key={hIdx}
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Gradient banner */}
                          <div
                            className={`h-24 bg-gradient-to-r ${tierColors[hotel.tier] || tierColors['mid-range']} p-4 text-white flex justify-between items-start`}
                          >
                            <span className="text-xs uppercase font-extrabold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm tracking-wider">
                              {hotel.tier}
                            </span>
                            <Hotel className="w-6 h-6 opacity-80" />
                          </div>

                          <div className="p-6">
                            <h4 className="font-extrabold text-lg text-slate-900 dark:text-white mb-1">
                              {hotel.exact_name}
                            </h4>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-3">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span>{hotel.area}</span>
                            </div>

                            <div className="text-base font-extrabold text-brand-600 dark:text-brand-400 mb-3">
                              {displayCost}{' '}
                              <span className="text-xs text-slate-500 font-normal">
                                / night
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                              {hotel.reason}
                            </p>
                          </div>
                        </div>

                        <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          {hotel.lat && hotel.lng && (
                            <button
                              onClick={() => setActiveTab('map')}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-brand-600"
                            >
                              <MapIcon className="w-3.5 h-3.5" />
                              Show on map
                            </button>
                          )}

                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${hotel.lat || ''},${hotel.lng || ''}&destination_place_id=${encodeURIComponent(hotel.exact_name)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition-colors"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            Navigate
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WHERE TO EAT (DINING) */}
          {activeTab === 'eat' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    Where to Eat in {trip.destination}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Authentic dining choices respecting your {trip.diet || 'local'} diet and meal budget (≤ ₹{trip.food_budget_per_meal || 400}/meal).
                  </p>
                </div>

                <button
                  onClick={() => setShowComfortModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition shadow-sm"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Change Budget
                </button>
              </div>

              {!hasComfortBudget ? (
                /* Comfort Budget Prompt Card */
                <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-slate-900 border border-emerald-200 dark:border-emerald-800 text-center max-w-lg mx-auto shadow-sm space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <Utensils className="w-7 h-7" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                    Tell us your dining budget first
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Choose your meal spend and diet preference (Veg, Non-veg, Jain, Vegan, etc.) so we can find compliant places.
                  </p>
                  <button
                    onClick={() => setShowComfortModal(true)}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/30 hover:bg-emerald-700 transition"
                  >
                    Set Dining Budget &rarr;
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(recommendations.dining || []).map((restaurant, rIdx) => {
                    const costINR = parseCostToINR(restaurant.price_range);
                    const displayCost = formatCurrency(costINR, currentCurrency, exchangeRates);

                    return (
                      <div
                        key={rIdx}
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Header banner */}
                          <div className="h-20 bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white flex justify-between items-start">
                            <span className="text-xs uppercase font-extrabold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                              {restaurant.meal_type || 'Dining'}
                            </span>
                            <Utensils className="w-5 h-5 opacity-80" />
                          </div>

                          <div className="p-6">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                                {restaurant.exact_name}
                              </h4>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span>{restaurant.area}</span>
                            </div>

                            <div className="flex flex-wrap gap-2 my-2.5">
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {restaurant.cuisine}
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                Best on Day {restaurant.best_fit_day || 1}
                              </span>
                            </div>

                            <div className="text-sm font-extrabold text-brand-600 dark:text-brand-400 mb-2">
                              {displayCost}{' '}
                              <span className="text-xs text-slate-500 font-normal">
                                / person
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                              {restaurant.reason}
                            </p>
                          </div>
                        </div>

                        <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          <button
                            onClick={() => setActiveTab('map')}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-brand-600"
                          >
                            <MapIcon className="w-3.5 h-3.5" />
                            Show on map
                          </button>

                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat || ''},${restaurant.lng || ''}&destination_place_id=${encodeURIComponent(restaurant.exact_name)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition-colors"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            Navigate
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: BUDGET BREAKDOWN & COST ESTIMATE (Requirement 2) */}
          {activeTab === 'budget' && budgetSummary && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Trip Budget & Expense Breakdown
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Keep track of estimated costs and category distribution.
                </p>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Total Trip Budget
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {formatCurrency(budgetSummary.targetBudgetTripINR, currentCurrency, exchangeRates)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Daily Cap:{' '}
                    <strong className="text-brand-600 dark:text-brand-400">
                      {formatCurrency(budgetSummary.realDailyCapINR, currentCurrency, exchangeRates)} / day
                    </strong>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Estimated Total Cost
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {formatCurrency(budgetSummary.tripTotalINR, currentCurrency, exchangeRates)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Remaining:{' '}
                    <strong className={budgetSummary.remainingBudgetINR < 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-800 dark:text-slate-200'}>
                      {budgetSummary.remainingBudgetINR < 0 ? '-' : ''}
                      {formatCurrency(Math.abs(budgetSummary.remainingBudgetINR), currentCurrency, exchangeRates)}
                    </strong>
                  </div>
                </div>

                <div
                  className={`p-6 rounded-3xl border shadow-sm ${
                    budgetSummary.isUnderBudget
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {budgetSummary.isUnderBudget ? 'Within Target Budget' : 'Over Target Budget'}
                  </span>
                  <div
                    className={`text-2xl font-extrabold mt-1 flex items-center gap-1.5 ${
                      budgetSummary.isUnderBudget
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {budgetSummary.isUnderBudget ? (
                      <TrendingDown className="w-6 h-6" />
                    ) : (
                      <TrendingUp className="w-6 h-6" />
                    )}
                    {formatCurrency(budgetSummary.varianceINR, currentCurrency, exchangeRates)}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                    {budgetSummary.budgetNote && budgetSummary.budgetNote.length > 0 ? (
                      <div className="space-y-1">
                        {budgetSummary.budgetNote.map((note, nIdx) => (
                          <div key={nIdx}>&bull; {note}</div>
                        ))}
                      </div>
                    ) : budgetSummary.belowMinimum ? (
                      <div>
                        Minimum budget required for {days.length} days is{' '}
                        <strong>{formatCurrency(budgetSummary.minimumRequired, currentCurrency, exchangeRates)}</strong>.
                      </div>
                    ) : budgetSummary.isUnderBudget ? (
                      <div>All activities, accommodation, food, and transit fit within your {formatCurrency(budgetSummary.targetBudgetTripINR, currentCurrency, exchangeRates)} total budget.</div>
                    ) : (
                      <div>Estimated costs exceed your target budget.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Breakdown CSS Bars (Calculated against total_budget) */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  Category Spending Allocation (% of Total Budget)
                </h4>

                {[
                  {
                    label: '🏨 Accommodation & Stays',
                    amount: budgetSummary.stayTotalINR,
                    color: 'bg-purple-600',
                  },
                  {
                    label: '🍽️ Dining & Culinary',
                    amount: budgetSummary.foodTotalINR,
                    color: 'bg-emerald-600',
                  },
                  {
                    label: '🎟️ Sights & Experiences',
                    amount: budgetSummary.activitiesTotalINR,
                    color: 'bg-blue-600',
                  },
                  {
                    label: '🚖 Local Transit & Cabs',
                    amount: budgetSummary.transportTotalINR,
                    color: 'bg-amber-500',
                  },
                  {
                    label: '🛡️ Safety Buffer',
                    amount: budgetSummary.bufferTotalINR,
                    color: 'bg-indigo-500',
                  },
                ].map((cat, idx) => {
                  const pct = Math.max(
                    Math.round((cat.amount / Math.max(1, budgetSummary.targetBudgetTripINR)) * 100),
                    1
                  );
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span>{cat.label}</span>
                        <span>
                          {formatCurrency(cat.amount, currentCurrency, exchangeRates)} ({pct}% of budget)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cat.color} transition-all duration-500`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Itemized Cost Breakdown Per Day Table */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📅 Itemized Daily Cost Breakdown</span>
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 rounded-l-xl">Day</th>
                        <th className="py-2.5 px-3">🏨 Stay / Lodging</th>
                        <th className="py-2.5 px-3">🍽️ Dining & Food</th>
                        <th className="py-2.5 px-3">🎟️ Sights & Tickets</th>
                        <th className="py-2.5 px-3">🚖 Local Transit</th>
                        <th className="py-2.5 px-3 text-right rounded-r-xl">Total Day Spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {days.map((d, dIdx) => {
                        const b = d.cost_breakdown || budgetSummary?.perDayBreakdown?.[dIdx] || {
                          stay: Math.round(budgetSummary.stayTotalINR / days.length),
                          food: Math.round(budgetSummary.foodTotalINR / days.length),
                          activities: Math.round(budgetSummary.activitiesTotalINR / days.length),
                          transport: Math.round(budgetSummary.transportTotalINR / days.length),
                          total: d.day_cost || budgetSummary?.perDayCosts?.[dIdx] || 0,
                        };
                        return (
                          <tr key={dIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">Day {d.day || dIdx + 1}</td>
                            <td className="py-3 px-3 text-purple-600 dark:text-purple-400 font-medium">{formatCurrency(b.stay, currentCurrency, exchangeRates)}</td>
                            <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(b.food, currentCurrency, exchangeRates)}</td>
                            <td className="py-3 px-3 text-blue-600 dark:text-blue-400 font-medium">{formatCurrency(b.activities, currentCurrency, exchangeRates)}</td>
                            <td className="py-3 px-3 text-amber-600 dark:text-amber-400 font-medium">{formatCurrency(b.transport, currentCurrency, exchangeRates)}</td>
                            <td className="py-3 px-3 text-right font-extrabold text-slate-900 dark:text-white">{formatCurrency(b.total, currentCurrency, exchangeRates)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comfort Budget Modal (Requirement 4) */}
      {showComfortModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-600" />
                Change Comfort Budget
              </h3>
              <button
                onClick={() => setShowComfortModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRecommendations} className="space-y-5">
              {/* Stay budget per night */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <span>Stay Budget Per Night</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    ₹{Number(comfortStayBudget).toLocaleString()}/night
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[900, 2200, 4000, 7500].map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setComfortStayBudget(val)}
                      className={`py-1.5 px-1 text-[11px] font-bold rounded-lg border ${
                        comfortStayBudget === val
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {val >= 5000 ? '₹5k+' : `₹${val}`}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="500"
                  max="20000"
                  step="250"
                  value={comfortStayBudget}
                  onChange={(e) => setComfortStayBudget(Number(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
              </div>

              {/* Stay Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  Preferred Lodging Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['hostel', 'guest house', 'hotel', 'resort'].map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setComfortStayType(type)}
                      className={`py-1.5 rounded-lg text-xs font-bold capitalize border ${
                        comfortStayType === type
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Food budget per meal */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <span>Food Budget Per Meal (Per Person)</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{Number(comfortFoodBudget).toLocaleString()}/meal
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[120, 300, 650, 1200].map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setComfortFoodBudget(val)}
                      className={`py-1.5 px-1 text-[11px] font-bold rounded-lg border ${
                        comfortFoodBudget === val
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {val >= 1000 ? '₹800+' : `₹${val}`}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="80"
                  max="3000"
                  step="50"
                  value={comfortFoodBudget}
                  onChange={(e) => setComfortFoodBudget(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
              </div>

              {/* Diet */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  Diet Preference
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {['veg', 'non-veg', 'Jain', 'vegan', 'any'].map((d) => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setComfortDiet(d)}
                      className={`py-1.5 rounded-lg text-xs font-bold capitalize border ${
                        comfortDiet === d
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowComfortModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRecommendations}
                  className="px-5 py-2.5 text-xs font-bold bg-brand-600 text-white rounded-xl hover:bg-brand-700 shadow-md shadow-brand-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {updatingRecommendations ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Update Recommendations
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Tweak & Regenerate Modal */}
      {showTweakModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {t('itinerary.tweakModal.title') || 'Tweak & Regenerate'}
              </h3>
              <button
                onClick={() => setShowTweakModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegenerate} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  {t('itinerary.tweakModal.adjustPace') || 'Pace'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['relaxed', 'moderate', 'fast'].map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setTweakPace(p)}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border capitalize ${
                        tweakPace === p
                          ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  {t('itinerary.tweakModal.adjustVibe') || 'Vibe'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {['chill', 'adventurous', 'cultural', 'foodie', 'romantic'].map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setTweakVibe(v)}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border capitalize ${
                        tweakVibe === v
                          ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('itinerary.tweakModal.notes') || 'Special Instructions / Notes'}
                </label>
                <textarea
                  rows="3"
                  value={tweakNotes}
                  onChange={(e) => setTweakNotes(e.target.value)}
                  placeholder="e.g. Include an early morning heritage walk on day 2"
                  className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50 dark:bg-slate-800"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTweakModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regenerating}
                  className="px-5 py-2.5 text-xs font-bold bg-brand-600 text-white rounded-xl hover:bg-brand-700 shadow-md shadow-brand-600/20 disabled:opacity-50"
                >
                  {regenerating ? 'Regenerating...' : 'Apply & Regenerate'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Over-budget Warning Confirmation Modal */}
      {overBudgetWarning && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-rose-200 dark:border-rose-900 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Budget Warning
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Adding <strong>"{overBudgetWarning.item.name}"</strong> will bring the total trip cost to{' '}
              <strong className="text-rose-600">{formatCurrency(overBudgetWarning.newTotal, currentCurrency, exchangeRates)}</strong>, exceeding your budget of{' '}
              <strong>{formatCurrency(overBudgetWarning.targetBudget, currentCurrency, exchangeRates)}</strong>.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setOverBudgetWarning(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const itm = overBudgetWarning.item;
                  setOverBudgetWarning(null);
                  executeAddStop(itm);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30"
              >
                Confirm & Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
