import axios from 'axios';

let API_BASE_URL = 'https://travel-planner-backend-vuq8.onrender.com';

// Safely check for Vite environment variables without crashing in Node.js
const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};  

if (viteEnv.VITE_API_URL) {
  API_BASE_URL = viteEnv.VITE_API_URL;
} else if (viteEnv.VITE_API_BASE_URL) {
  API_BASE_URL = viteEnv.VITE_API_BASE_URL;
} else if (typeof window !== 'undefined' && window.location.origin.includes('localhost')) {
  API_BASE_URL = 'http://localhost:8000';
}

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
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  register: async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const tripsAPI = {
  createTrip: async (tripData) => {
    const response = await api.post('/trips', tripData);
    return response.data;
  },
  listTrips: async () => {
    const response = await api.get('/trips');
    return response.data;
  },
  getTrip: async (id) => {
    const response = await api.get(`/trips/${id}`);
    return response.data;
  },
  updateTrip: async (id, tripData) => {
    const response = await api.put(`/trips/${id}`, tripData);
    return response.data;
  },
  deleteTrip: async (id) => {
    const response = await api.delete(`/trips/${id}`);
    return response.data;
  },
  generateItinerary: async (id) => {
    const response = await api.post(`/trips/${id}/generate`);
    return response.data;
  },
  regenerateItinerary: async (id, tweaks) => {
    const response = await api.post(`/trips/${id}/regenerate`, tweaks);
    return response.data;
  },
  translateItinerary: async (id, language) => {
    const response = await api.post(`/trips/${id}/translate`, { language });
    return response.data;
  },
  updateRecommendations: async (id, budgetPrefs) => {
    const response = await api.post(`/trips/${id}/recommendations`, budgetPrefs);
    return response.data;
  },
  exportItinerary: async (id, format = 'json') => {
    if (format === 'html' || format === 'print') {
      const response = await api.get(`/trips/${id}/export?format=${format}`, {
        responseType: 'text',
      });
      return response.data;
    }
    const response = await api.get(`/trips/${id}/export?format=json`);
    return response.data;
  },
  getHistory: async (id) => {
    const response = await api.get(`/trips/${id}/history`);
    return response.data;
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
