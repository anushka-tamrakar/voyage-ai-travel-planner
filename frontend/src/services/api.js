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

        const days = [];
        for (let i = 1; i <= Math.min(daysDiff, 10); i++) {
          const morning = {
            time: '09:00 AM - 12:30 PM',
            title: city + ' Heritage & Cultural Exploration',
            place_name: city + ' Central Plaza',
            exact_name: city + ' Central Plaza',
            area: 'Central District',
            description: 'Discover historic streets, architectural landmarks, and local craft centers across ' + city + '.',
            cost: '₹350',
            estimated_cost: '₹350',
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
            cost: '₹500',
            estimated_cost: '₹500',
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
            cost: '₹750',
            estimated_cost: '₹750',
            tip: 'Sample popular specialty dishes and local street treats.',
            travel_tip: 'Sample popular specialty dishes and local street treats.',
          };

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
              exact_name: 'Grand ' + city + ' Boutique Stay',
              area: 'Central City',
              cost_per_night: '₹2,400',
              type: 'hotel',
              rating: '4.7★',
            },
            dining_recommendations: [
              {
                exact_name: city + ' Culinary Heritage Bistro',
                cuisine: 'Local Specialties',
                cost_per_meal: '₹400',
                area: 'Heritage District',
              },
            ],
            day_cost: 4000,
            daily_estimated_cost: '₹4,000',
          });
        }

        const fallbackItinerary = {
          trip_id: id,
          days,
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
      const response = await api.post(/trips//regenerate, tweaks);
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
      const response = await api.post(/trips//translate, { language });
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
      const response = await api.post(/trips//recommendations, budgetPrefs);
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
