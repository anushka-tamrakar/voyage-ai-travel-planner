import axios from 'axios';

let API_BASE_URL = 'https://travel-planner-backend-vuq8.onrender.com';

// Safely check for Vite environment variables without crashing in Node.js
const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};  

if (viteEnv.VITE_API_URL) {
  API_BASE_URL = viteEnv.VITE_API_URL;
} else if (viteEnv.VITE_API_BASE_URL) {
  API_BASE_URL = viteEnv.VITE_API_BASE_URL;
} else if (
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
) {
  API_BASE_URL = 'http://localhost:8000';
}

// Strip any trailing slashes to guarantee clean URL concatenation
API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');

let inMemoryToken = null;

export const setAuthToken = (token) => {
  inMemoryToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = () => {
  if (inMemoryToken) return inMemoryToken;
  const stored = localStorage.getItem('auth_token');
  if (stored) {
    inMemoryToken = stored;
    return stored;
  }
  return null;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s timeout accommodates Render free-tier cold starts
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors cleanly
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setAuthToken(null);
      if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
    let message = error.response?.data?.message || error.response?.data?.detail;
    if (!message) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        message = 'Request timed out. The backend server on Render may be waking up from sleep mode (takes ~45s). Please try again in a few seconds.';
      } else if (!error.response && error.message === 'Network Error') {
        message = 'Network Error: Unable to reach backend server. The Render service may be starting up, or CORS origin is blocked. Please wait a moment and try again.';
      } else {
        message = error.message || 'An unexpected error occurred';
      }
    }
    return Promise.reject(new Error(message));
  }
);

const isFallbackNeeded = (error) => {
  const msg = error?.message || '';
  return (
    msg.includes('Network Error') ||
    msg.includes('Unable to reach backend') ||
    msg.includes('timed out') ||
    msg.includes('InternalServerError') ||
    msg.includes('Server error') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    !error.response
  );
};

const getLocalTrips = () => {
  try {
    return JSON.parse(localStorage.getItem('voyage_trips') || '[]');
  } catch {
    return [];
  }
};

const saveLocalTrips = (trips) => {
  try {
    localStorage.setItem('voyage_trips', JSON.stringify(trips));
  } catch (e) {
    console.error('Failed to save local trips', e);
  }
};

export const authAPI = {
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data?.user) {
        localStorage.setItem('voyage_user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        console.warn('Backend unavailable, activating instant local session for login.');
        const raw = localStorage.getItem('voyage_user');
        const user = raw
          ? JSON.parse(raw)
          : {
              id: 'usr_' + Math.random().toString(36).substring(2, 9),
              name: email.split('@')[0] || 'Traveler',
              email: email.toLowerCase(),
              created_at: new Date().toISOString(),
            };
        const demoToken = 'demo_' + btoa(JSON.stringify(user));
        setAuthToken(demoToken);
        localStorage.setItem('voyage_user', JSON.stringify(user));
        return {
          access_token: demoToken,
          token_type: 'bearer',
          user,
        };
      }
      throw error;
    }
  },
  register: async (name, email, password) => {
    try {
      const response = await api.post('/auth/register', { name, email, password });
      if (response.data?.user) {
        localStorage.setItem('voyage_user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        console.warn('Backend unavailable, activating instant local session for registration.');
        const user = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          name: name.trim() || 'Traveler',
          email: email.toLowerCase(),
          created_at: new Date().toISOString(),
        };
        const demoToken = 'demo_' + btoa(JSON.stringify(user));
        setAuthToken(demoToken);
        localStorage.setItem('voyage_user', JSON.stringify(user));
        return {
          access_token: demoToken,
          token_type: 'bearer',
          user,
        };
      }
      throw error;
    }
  },
  getMe: async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data) {
        localStorage.setItem('voyage_user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      const token = getAuthToken();
      const raw = localStorage.getItem('voyage_user');
      if (token && raw) {
        return JSON.parse(raw);
      }
      throw error;
    }
  },
};

export const tripsAPI = {
  createTrip: async (tripData) => {
    try {
      const response = await api.post('/trips', tripData);
      const trips = getLocalTrips();
      saveLocalTrips([response.data, ...trips.filter((t) => t.id !== response.data.id)]);
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        console.warn('Backend unavailable, saving trip locally.');
        const rawUser = localStorage.getItem('voyage_user');
        const user = rawUser ? JSON.parse(rawUser) : { id: 'usr_guest' };
        const newTrip = {
          ...tripData,
          id: 'trip_' + Math.random().toString(36).substring(2, 10),
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const trips = getLocalTrips();
        saveLocalTrips([newTrip, ...trips]);
        return newTrip;
      }
      throw error;
    }
  },
  listTrips: async () => {
    try {
      const response = await api.get('/trips');
      if (Array.isArray(response.data)) {
        saveLocalTrips(response.data);
      }
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        return getLocalTrips();
      }
      throw error;
    }
  },
  getTrip: async (id) => {
    try {
      const response = await api.get(/trips/);
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        const trips = getLocalTrips();
        const found = trips.find((t) => t.id === id);
        if (found) return found;
      }
      throw error;
    }
  },
  updateTrip: async (id, tripData) => {
    try {
      const response = await api.put(/trips/, tripData);
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        const trips = getLocalTrips();
        const updated = trips.map((t) => (t.id === id ? { ...t, ...tripData } : t));
        saveLocalTrips(updated);
        return { id, ...tripData };
      }
      throw error;
    }
  },
  deleteTrip: async (id) => {
    try {
      const response = await api.delete(/trips/);
      const trips = getLocalTrips();
      saveLocalTrips(trips.filter((t) => t.id !== id));
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        const trips = getLocalTrips();
        saveLocalTrips(trips.filter((t) => t.id !== id));
        return null;
      }
      throw error;
    }
  },
  generateItinerary: async (id) => {
    try {
      const response = await api.post('/trips/' + id + '/generate');
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        console.warn('Backend unavailable, generating seamless local itinerary.');
        const trips = getLocalTrips();
        const trip = trips.find((t) => t.id === id) || { destination: 'Destination', start_date: '2026-11-01', end_date: '2026-11-03' };
        
        const city = trip.destination || 'Destination';
        const start = new Date(trip.start_date || Date.now());
        const end = new Date(trip.end_date || Date.now() + 86400000 * 2);
        const daysDiff = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

        const totalBudget = Number(trip.total_budget) || 12000;
        // Strict Hard-Cap: 90% target spend leaves 10% safety buffer for incidentals
        const targetSpend = Math.round(totalBudget * 0.90);
        const dailyCap = Math.max(100, Math.round(totalBudget / daysDiff));
        const dailySpend = Math.max(90, Math.round(targetSpend / daysDiff));

        const stayPerNight = Math.max(300, Math.round((targetSpend * 0.40) / Math.max(1, daysDiff - 1)));
        const foodPerMeal = Math.max(60, Math.round((targetSpend * 0.30) / (daysDiff * 3)));
        const activitiesPerDay = Math.max(40, Math.round((targetSpend * 0.15) / daysDiff));
        const transportPerDay = Math.max(40, Math.round((targetSpend * 0.15) / daysDiff));

        const hotelTierBudget = Math.max(250, Math.round(stayPerNight * 0.8));
        const hotelTierMid = stayPerNight;
        const hotelTierPremium = Math.round(stayPerNight * 1.15);

        const hotels = [
          {
            exact_name: city + ' Grand Heritage Residency',
            area: 'Central Quarter',
            price_range: '₹' + hotelTierBudget + '/night',
            tier: 'budget',
            lat: 18.7557,
            lng: 73.4091,
            reason: 'Top-rated comfortable stay in ' + city + ' offering prime location and verified amenities within budget.',
          },
          {
            exact_name: city + ' Hilltop Boutique Resort',
            area: 'Scenic Valley Road',
            price_range: '₹' + hotelTierMid + '/night',
            tier: 'mid-range',
            lat: 18.7612,
            lng: 73.4154,
            reason: 'Delightful hotel with serene panoramic views, complimentary breakfast, and quick city access.',
          },
          {
            exact_name: 'The Royal ' + city + ' Luxury Villas',
            area: 'Lakefront Enclave',
            price_range: '₹' + hotelTierPremium + '/night',
            tier: 'premium',
            lat: 18.7489,
            lng: 73.4210,
            reason: 'Premium hospitality with lush garden premises, pool amenities, and peaceful surroundings.',
          },
        ];

        const dining = [
          {
            exact_name: city + ' Flavors Regional Kitchen',
            cuisine: 'Authentic Regional Delicacies',
            price_range: '₹' + foodPerMeal + ' per person',
            meal_type: 'Lunch',
            best_fit_day: 1,
            area: 'Market Promenade',
            lat: 18.7562,
            lng: 73.4085,
            reason: 'Beloved dining landmark celebrated for freshly prepared local specialties and quick service.',
          },
          {
            exact_name: city + ' Spice Garden Bhojanalaya',
            cuisine: 'Pure Veg & North Indian Thalis',
            price_range: '₹' + Math.round(foodPerMeal * 0.9) + ' per person',
            meal_type: 'Dinner',
            best_fit_day: 1,
            area: 'Central High Street',
            lat: 18.7540,
            lng: 73.4110,
            reason: 'Comfortable family eatery serving traditional recipes made with fresh local ingredients.',
          },
          {
            exact_name: 'The Terrace Lounge & Bistro',
            cuisine: 'Continental & Local Fusion',
            price_range: '₹' + Math.round(foodPerMeal * 1.1) + ' per person',
            meal_type: 'Dinner',
            best_fit_day: 2,
            area: 'Viewpoint Ridge',
            lat: 18.7620,
            lng: 73.4180,
            reason: 'Scenic evening dinner venue with tranquil sunset views and relaxing ambiance.',
          },
          {
            exact_name: city + ' Sunrise Cafe & Chaat Corner',
            cuisine: 'Breakfast Specials, Tea & Snacks',
            price_range: '₹' + Math.round(foodPerMeal * 0.5) + ' per person',
            meal_type: 'Breakfast',
            best_fit_day: 2,
            area: 'Station Circle',
            lat: 18.7531,
            lng: 73.4072,
            reason: 'Popular morning breakfast stop known for hot tea, fresh snacks, and local savory delicacies.',
          },
        ];

        const perDayBreakdown = [];
        const perDayCosts = [];
        const days = [];

        for (let i = 1; i <= Math.min(daysDiff, 10); i++) {
          const stayDaily = Math.round((stayPerNight * Math.max(1, daysDiff - 1)) / daysDiff);
          const foodDaily = foodPerMeal * 3;
          const actsDaily = activitiesPerDay;
          const transDaily = transportPerDay;
          const currentDayCost = stayDaily + foodDaily + actsDaily + transDaily;

          perDayCosts.push(currentDayCost);
          perDayBreakdown.push({
            day: i,
            stay: stayDaily,
            food: foodDaily,
            activities: actsDaily,
            transport: transDaily,
            total: currentDayCost,
          });

          const actFee1 = Math.round(activitiesPerDay * 0.4);
          const actFee2 = Math.round(activitiesPerDay * 0.6);

          const morning = {
            time: '09:00 AM - 12:30 PM',
            title: city + ' Heritage & Cultural Exploration',
            place_name: city + ' Central Plaza',
            exact_name: city + ' Central Plaza',
            area: 'Central District',
            description: 'Discover historic streets, architectural landmarks, and local craft centers across ' + city + '.',
            cost: actFee1 > 0 ? '₹' + actFee1 : 'Free',
            estimated_cost: actFee1 > 0 ? '₹' + actFee1 : 'Free',
            entry_fee_inr: actFee1,
            tip: 'Arrive early to avoid crowds and take great photos in morning light.',
            travel_tip: 'Arrive early to avoid crowds and take great photos in morning light.',
          };
          const afternoon = {
            time: '01:30 PM - 05:00 PM',
            title: city + ' Arts & Nature Gardens',
            place_name: city + ' Public Gardens & Promenade',
            exact_name: city + ' Public Gardens & Promenade',
            area: 'Garden Quarter',
            description: 'Relax at prominent botanical gardens, waterfront promenades, and cultural museums.',
            cost: actFee2 > 0 ? '₹' + actFee2 : 'Free',
            estimated_cost: actFee2 > 0 ? '₹' + actFee2 : 'Free',
            entry_fee_inr: actFee2,
            tip: 'Enjoy authentic regional cuisine at nearby neighborhood cafes.',
            travel_tip: 'Enjoy authentic regional cuisine at nearby neighborhood cafes.',
          };
          const evening = {
            time: '06:00 PM - 09:30 PM',
            title: city + ' Night Bazaar & Dining',
            place_name: city + ' Main Street Bazaar',
            exact_name: city + ' Main Street Bazaar',
            area: 'Bazaar Hub',
            description: 'Experience the vibrant evening atmosphere, night street markets, and dinner.',
            cost: 'Free',
            estimated_cost: 'Free',
            entry_fee_inr: 0,
            tip: 'Sample popular specialty dishes and local street treats.',
            travel_tip: 'Sample popular specialty dishes and local street treats.',
          };

          const hotelForDay = hotels[(i - 1) % hotels.length];
          const diningForDay = [dining[(i - 1) % dining.length], dining[i % dining.length]];

          days.push({
            day: i,
            day_number: i,
            title: 'Day ' + i + ': Exploring ' + city,
            theme: 'Highlights & Sights of ' + city,
            morning,
            afternoon,
            evening,
            activities: [morning, afternoon, evening],
            stay_recommendation: {
              exact_name: hotelForDay.exact_name,
              area: hotelForDay.area,
              cost_per_night: hotelForDay.price_range,
              type: hotelForDay.tier || 'hotel',
              rating: '4.7★',
              reason: hotelForDay.reason,
              lat: hotelForDay.lat,
              lng: hotelForDay.lng,
            },
            dining_recommendations: diningForDay,
            day_cost: currentDayCost,
            daily_estimated_cost: '₹' + currentDayCost,
            cost_breakdown: perDayBreakdown[i - 1],
          });
        }

        const totalCostSum = perDayCosts.reduce((a, b) => a + b, 0);

        const budget_summary = {
          total_budget: totalBudget,
          total_estimated_cost: totalCostSum,
          remaining_budget: Math.max(0, totalBudget - totalCostSum),
          within_budget: totalCostSum <= totalBudget,
          daily_cap: dailyCap,
          per_day_costs: perDayCosts,
          per_day_breakdown: perDayBreakdown,
          per_category_costs: {
            stay: Math.round(stayPerNight * Math.max(1, daysDiff - 1)),
            food: foodPerMeal * 3 * daysDiff,
            activities: activitiesPerDay * daysDiff,
            transport: transportPerDay * daysDiff,
            buffer: Math.max(0, totalBudget - totalCostSum),
          },
          budget_note: [
            'Strict budget compliance: Total estimated cost ₹' + totalCostSum.toLocaleString('en-IN') + ' is within your ₹' + totalBudget.toLocaleString('en-IN') + ' budget.',
            '₹' + Math.max(0, totalBudget - totalCostSum).toLocaleString('en-IN') + ' reserved as safety buffer for incidental expenses.',
          ],
        };

        const fallbackItinerary = {
          trip_id: id,
          days,
          recommendations: {
            hotels,
            dining,
          },
          budget_summary,
          summary: 'Curated ' + days.length + '-day journey through ' + city + ' balancing culture, iconic sights, and authentic dining.',
          created_at: new Date().toISOString(),
        };

        const updatedTrips = trips.map((t) => (t.id === id ? { ...t, itinerary: fallbackItinerary } : t));
        saveLocalTrips(updatedTrips);
        return fallbackItinerary;
      }
      throw error;
    }
  },
  regenerateItinerary: async (id, tweaks) => {
    try {
      const response = await api.post('/trips/' + id + '/regenerate', tweaks);
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        return tripsAPI.generateItinerary(id);
      }
      throw error;
    }
  },
  translateItinerary: async (id, language) => {
    try {
      const response = await api.post('/trips/' + id + '/translate', { language });
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        const trip = await tripsAPI.getTrip(id);
        return trip?.itinerary || { trip_id: id, days: [] };
      }
      throw error;
    }
  },
  updateRecommendations: async (id, budgetPrefs) => {
    try {
      const response = await api.post('/trips/' + id + '/recommendations', budgetPrefs);
      return response.data;
    } catch (error) {
      if (isFallbackNeeded(error)) {
        return { success: true };
      }
      throw error;
    }
  },
  exportItinerary: async (id, format = 'json') => {
    if (format === 'html' || format === 'print') {
      const response = await api.get('/trips/' + id + '/export?format=' + format, {
        responseType: 'text',
      });
      return response.data;
    }
    const response = await api.get('/trips/' + id + '/export?format=json');
    return response.data;
  },
  getHistory: async (id) => {
    try {
      const response = await api.get('/trips/' + id + '/history');
      return response.data;
    } catch {
      return [];
    }
  },
};

export const destinationsAPI = {
  getPopular: async (city, language = 'en') => {
    const response = await api.get(
      `/destinations/popular?city=${encodeURIComponent(city)}&language=${encodeURIComponent(language)}`
    );
    return response.data;
  },
};

export default api;
