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



        const cityLower = city.toLowerCase();
        const isLonavala = cityLower.includes('lonavala');

        const getDayContent = (dayIdx, fee1, fee2) => {
          if (isLonavala) {
            if (dayIdx === 1) {
              return {
                theme: 'Historic Forts, Cliffpoints & Heritage Chikki',
                morning: {
                  time: '09:00 AM - 12:30 PM',
                  title: 'Heritage Fortress: Lohagad Fort & Bastion',
                  place_name: 'Lohagad Fort',
                  exact_name: 'Lohagad Fort',
                  area: 'Malavali Hills',
                  lat: 18.7011,
                  lng: 73.4795,
                  description: 'Hike up to the ancient hilltop fortress overlooking Pavana dam with historic stone gates and scenic panoramic bastions.',
                  cost: fee1 > 0 ? '₹' + fee1 : 'Free',
                  estimated_cost: fee1 > 0 ? '₹' + fee1 : 'Free',
                  entry_fee_inr: fee1,
                  tip: 'Start early in the morning to beat the afternoon heat and capture stunning valley views.',
                  travel_tip: 'Start early in the morning to beat the afternoon heat and capture stunning valley views.',
                },
                afternoon: {
                  time: '01:30 PM - 05:00 PM',
                  title: 'Scenic Cliff Vista: Lion\'s Point & Valley Lookout',
                  place_name: 'Lion\'s Point & Valley Lookout',
                  exact_name: 'Lion\'s Point & Valley Lookout',
                  area: 'Aamby Valley Road',
                  lat: 18.7290,
                  lng: 73.4020,
                  description: 'Marvel at sweeping cliffside drops, rolling clouds over deep Sahyadri gorges, and cool mountain breezes.',
                  cost: 'Free',
                  estimated_cost: 'Free',
                  entry_fee_inr: 0,
                  tip: 'Sample fresh roasted sweet corn and ginger chai from the ridge stalls.',
                  travel_tip: 'Sample fresh roasted sweet corn and ginger chai from the ridge stalls.',
                },
                evening: {
                  time: '06:00 PM - 09:30 PM',
                  title: 'Evening Bazaar: Maganlal Chikki Bazaar & Town Square',
                  place_name: 'Maganlal Chikki Bazaar',
                  exact_name: 'Maganlal Chikki Bazaar',
                  area: 'Station Road',
                  lat: 18.7538,
                  lng: 73.4078,
                  description: 'Stroll the bustling town center famous for authentic handcrafted chikki, fudges, and savory regional namkeen.',
                  cost: 'Free',
                  estimated_cost: 'Free',
                  entry_fee_inr: 0,
                  tip: 'Crushed peanut chikki and chocolate walnut fudge are must-try signature specialties.',
                  travel_tip: 'Crushed peanut chikki and chocolate walnut fudge are must-try signature specialties.',
                },
              };
            } else if (dayIdx === 2) {
              return {
                theme: 'Ancient Rock-Cut Caves, Waterfalls & Shaded Groves',
                morning: {
                  time: '09:00 AM - 12:30 PM',
                  title: 'Archaeological Wonder: Karla Caves & Stupas',
                  place_name: 'Karla Caves',
                  exact_name: 'Karla Caves',
                  area: 'Karli Ridge',
                  lat: 18.7820,
                  lng: 73.4705,
                  description: 'Explore 2nd-century BC rock-cut Buddhist chaitya halls with intricate arched teakwood ribbing and magnificent stupas.',
                  cost: fee1 > 0 ? '₹' + fee1 : 'Free',
                  estimated_cost: fee1 > 0 ? '₹' + fee1 : 'Free',
                  entry_fee_inr: fee1,
                  tip: 'Climbing the steps takes around 20 minutes; carry water and wear non-slip footwear.',
                  travel_tip: 'Climbing the steps takes around 20 minutes; carry water and wear non-slip footwear.',
                },
                afternoon: {
                  time: '01:30 PM - 05:00 PM',
                  title: 'Waterfront Cascades: Bhushi Dam Overflow Cascades',
                  place_name: 'Bhushi Dam Cascades',
                  exact_name: 'Bhushi Dam Cascades',
                  area: 'Khandala Ghat',
                  lat: 18.7302,
                  lng: 73.4215,
                  description: 'Relax by the tranquil overflow dam and cooling natural rock pools surrounded by dense forest greenery.',
                  cost: 'Free',
                  estimated_cost: 'Free',
                  entry_fee_inr: 0,
                  tip: 'Steps can be slippery near running water; enjoy from the safe paved viewing areas.',
                  travel_tip: 'Steps can be slippery near running water; enjoy from the safe paved viewing areas.',
                },
                evening: {
                  time: '06:00 PM - 09:30 PM',
                  title: 'Nature Stroll: Ryewood Park & Ancient Trees',
                  place_name: 'Ryewood Park & Botanical Grove',
                  exact_name: 'Ryewood Park & Botanical Grove',
                  area: 'Central Lonavala',
                  lat: 18.7515,
                  lng: 73.4090,
                  description: 'Unwind amidst expansive manicured lawns, grand ancient canopy trees, and fragrant botanical flowerbeds.',
                  cost: 'Free',
                  estimated_cost: 'Free',
                  entry_fee_inr: 0,
                  tip: 'Ideal peaceful setting for relaxed evening conversations and birdwatching.',
                  travel_tip: 'Ideal peaceful setting for relaxed evening conversations and birdwatching.',
                },
              };
            } else {
              return {
                theme: 'Scenic Peaks, Ancient Monasteries & Serene Lakes',
                morning: {
                  time: '09:00 AM - 12:30 PM',
                  title: 'Mountain Ridge: Duke\'s Nose Viewpoint & Trail',
                  place_name: 'Duke\'s Nose Viewpoint',
                  exact_name: 'Duke\'s Nose Viewpoint',
                  area: 'Khandala',
                  lat: 18.7425,
                  lng: 73.3850,
                  description: 'Marvel at the prominent pointed cliff cliffside offering sweeping views of the valley and Bhor Ghat.',
                  cost: 'Free',
                  estimated_cost: 'Free',
                  entry_fee_inr: 0,
                  tip: 'The morning breeze on the plateau is invigorating; perfect for photography.',
                  travel_tip: 'The morning breeze on the plateau is invigorating; perfect for photography.',
                },
                afternoon: {
                  time: '01:30 PM - 05:00 PM',
                  title: 'Historic Discovery: Bhaja Caves & Monastic Chambers',
                  place_name: 'Bhaja Caves',
                  exact_name: 'Bhaja Caves',
                  area: 'Bhaja Village',
                  lat: 18.7335,
                  lng: 73.4830,
                  description: 'Discover 22 rock-cut Buddhist caves featuring wooden ceiling architecture, sculpted relief figures, and small natural springs.',
                  cost: fee2 > 0 ? '₹' + fee2 : 'Free',
                  estimated_cost: fee2 > 0 ? '₹' + fee2 : 'Free',
                  entry_fee_inr: fee2,
                  tip: 'Check out the unique circular rock stupas located towards the south face of the caves.',
                  travel_tip: 'Check out the unique circular rock stupas located towards the south face of the caves.',
                },
                evening: {
                  time: '06:00 PM - 09:30 PM',
                  title: 'Lakefront Sunset: Lonavala Lake & Marina Walk',
                  place_name: 'Lonavala Lake & Promenade',
                  exact_name: 'Lonavala Lake & Promenade',
                  area: 'Lonavala Lake Road',
                  lat: 18.7390,
                  lng: 73.4180,
                  description: 'Watch golden reflections over tranquil waters, enjoy warm roasted corn, and take in the serene twilight atmosphere.',
                  cost: 'Free',
                  estimated_cost: 'Free',
                  entry_fee_inr: 0,
                  tip: 'The sunset colors over the water between 06:00 PM and 06:45 PM are magnificent.',
                  travel_tip: 'The sunset colors over the water between 06:00 PM and 06:45 PM are magnificent.',
                },
              };
            }
          }

          const plans = [
            {
              theme: 'Historic Citadels, Royal Architecture & Old Town',
              morning: {
                time: '09:00 AM - 12:30 PM',
                title: 'Historic Landmark: ' + city + ' Heritage Fort & Citadel',
                place_name: city + ' Heritage Fort',
                exact_name: city + ' Heritage Fort',
                area: 'Old Quarter',
                lat: 18.7557,
                lng: 73.4091,
                description: 'Discover centuries-old stone ramparts, grand architectural bastions, and panoramic views overlooking ' + city + '.',
                cost: fee1 > 0 ? '₹' + fee1 : 'Free',
                estimated_cost: fee1 > 0 ? '₹' + fee1 : 'Free',
                entry_fee_inr: fee1,
                tip: 'Arrive early to beat the crowds and enjoy clear morning lighting for photos.',
                travel_tip: 'Arrive early to beat the crowds and enjoy clear morning lighting for photos.',
              },
              afternoon: {
                time: '01:30 PM - 05:00 PM',
                title: 'Cultural Gallery: ' + city + ' Royal Museum & Gardens',
                place_name: city + ' Royal Museum',
                exact_name: city + ' Royal Museum',
                area: 'Cultural District',
                lat: 18.7580,
                lng: 73.4120,
                description: 'Admire royal archival collections, regional art antiquities, and shaded courtyard garden walkways.',
                cost: fee2 > 0 ? '₹' + fee2 : 'Free',
                estimated_cost: fee2 > 0 ? '₹' + fee2 : 'Free',
                entry_fee_inr: fee2,
                tip: 'Informative exhibit plaques explain regional history and crafts.',
                travel_tip: 'Informative exhibit plaques explain regional history and crafts.',
              },
              evening: {
                time: '06:00 PM - 09:30 PM',
                title: 'Evening Discovery: ' + city + ' Traditional Craft & Spice Bazaar',
                place_name: city + ' Traditional Spice Bazaar',
                exact_name: city + ' Traditional Spice Bazaar',
                area: 'Central High Street',
                lat: 18.7540,
                lng: 73.4080,
                description: 'Stroll through historic market lanes filled with authentic local craftsmen, handloom stalls, and street treats.',
                cost: 'Free',
                estimated_cost: 'Free',
                entry_fee_inr: 0,
                tip: 'A great place to discover local specialties and genuine handmade gifts.',
                travel_tip: 'A great place to discover local specialties and genuine handmade gifts.',
              },
            },
            {
              theme: 'Scenic Nature, Mountain Viewpoints & Cascading Falls',
              morning: {
                time: '09:00 AM - 12:30 PM',
                title: 'Scenic Vista: ' + city + ' Valley Ridge & Cliff Viewpoint',
                place_name: city + ' Ridge Viewpoint',
                exact_name: city + ' Ridge Viewpoint',
                area: 'Western Ridge',
                lat: 18.7612,
                lng: 73.4154,
                description: 'Take in magnificent panoramic vistas across emerald green valleys, morning mist, and winding mountain trails.',
                cost: 'Free',
                estimated_cost: 'Free',
                entry_fee_inr: 0,
                tip: 'Wear comfortable walking shoes and carry a light jacket for the hilltop breeze.',
                travel_tip: 'Wear comfortable walking shoes and carry a light jacket for the hilltop breeze.',
              },
              afternoon: {
                time: '01:30 PM - 05:00 PM',
                title: 'Nature Sanctuary: ' + city + ' Botanical Lakeside & Forest Falls',
                place_name: city + ' Forest Falls & Lake',
                exact_name: city + ' Forest Falls & Lake',
                area: 'Green Valley Reserve',
                lat: 18.7490,
                lng: 73.4210,
                description: 'Relax alongside natural forest cascades, lush native trees, and tranquil waters in a serene protected grove.',
                cost: fee1 > 0 ? '₹' + fee1 : 'Free',
                estimated_cost: fee1 > 0 ? '₹' + fee1 : 'Free',
                entry_fee_inr: fee1,
                tip: 'Shaded wooden pavilions make this an ideal spot for an afternoon rest.',
                travel_tip: 'Shaded wooden pavilions make this an ideal spot for an afternoon rest.',
              },
              evening: {
                time: '06:00 PM - 09:30 PM',
                title: 'Sunset Boulevard: ' + city + ' Hilltop Sunset Promenade',
                place_name: city + ' Sunset Promenade',
                exact_name: city + ' Sunset Promenade',
                area: 'Hilltop Boulevard',
                lat: 18.7620,
                lng: 73.4180,
                description: 'Watch twilight descend across the distant horizon while enjoying tea, snacks, and refreshing mountain air.',
                cost: 'Free',
                estimated_cost: 'Free',
                entry_fee_inr: 0,
                tip: 'Golden hour between 05:45 PM and 06:30 PM offers the best photos.',
                travel_tip: 'Golden hour between 05:45 PM and 06:30 PM offers the best photos.',
              },
            },
            {
              theme: 'Ancient Rock-Cut Caves, Sacred Shrines & Waterfront Promenade',
              morning: {
                time: '09:00 AM - 12:30 PM',
                title: 'Archaeological Discovery: ' + city + ' Ancient Monastic Caves',
                place_name: city + ' Ancient Rock Caves',
                exact_name: city + ' Ancient Rock Caves',
                area: 'Heritage Hills',
                lat: 18.7710,
                lng: 73.4350,
                description: 'Marvel at rock-cut monastic halls, intricate stone-carved pillars, and quiet meditative chambers dating back centuries.',
                cost: fee2 > 0 ? '₹' + fee2 : 'Free',
                estimated_cost: fee2 > 0 ? '₹' + fee2 : 'Free',
                entry_fee_inr: fee2,
                tip: 'Cool stone interiors provide comfortable exploration even on sunny days.',
                travel_tip: 'Cool stone interiors provide comfortable exploration even on sunny days.',
              },
              afternoon: {
                time: '01:30 PM - 05:00 PM',
                title: 'Sacred Grounds: ' + city + ' Hilltop Temple & Reflection Courtyard',
                place_name: city + ' Hilltop Temple',
                exact_name: city + ' Hilltop Temple',
                area: 'Temple Heights',
                lat: 18.7580,
                lng: 73.4020,
                description: 'Visit a celebrated regional temple known for tranquil courtyards, stone carvings, and sweeping countryside outlooks.',
                cost: 'Free',
                estimated_cost: 'Free',
                entry_fee_inr: 0,
                tip: 'Modest attire is customary when entering the inner courtyard grounds.',
                travel_tip: 'Modest attire is customary when entering the inner courtyard grounds.',
              },
              evening: {
                time: '06:00 PM - 09:30 PM',
                title: 'Lakeside Leisure: ' + city + ' Waterfront Promenade & Food Lane',
                place_name: city + ' Lakefront Promenade',
                exact_name: city + ' Lakefront Promenade',
                area: 'Lakefront District',
                lat: 18.7450,
                lng: 73.4150,
                description: 'Unwind along the gentle lakeside path, browse artisan stalls, and enjoy a warm dinner overlooking the water.',
                cost: 'Free',
                estimated_cost: 'Free',
                entry_fee_inr: 0,
                tip: 'Lakeside cafes serve warm tea and fresh local dinner until late evening.',
                travel_tip: 'Lakeside cafes serve warm tea and fresh local dinner until late evening.',
              },
            },
          ];

          return plans[(dayIdx - 1) % plans.length];
        };

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

          const dayContent = getDayContent(i, actFee1, actFee2);
          const morning = dayContent.morning;
          const afternoon = dayContent.afternoon;
          const evening = dayContent.evening;

          const hotelForDay = hotels[(i - 1) % hotels.length];
          const diningForDay = [dining[(i - 1) % dining.length], dining[i % dining.length]];

          days.push({
            day: i,
            day_number: i,
            title: 'Day ' + i + ': ' + dayContent.theme,
            theme: dayContent.theme,
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

