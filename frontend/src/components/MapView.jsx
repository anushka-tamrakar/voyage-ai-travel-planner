import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation,
  Compass,
  Car,
  Footprints,
  MapPin,
  ExternalLink,
  Bus,
  Utensils,
  Hotel,
  AlertCircle,
  LocateFixed,
  Radio,
  Clock,
  Layers,
  Search,
} from 'lucide-react';

// Distance calculation utility
export function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
}

// Custom Leaflet DivIcons to avoid image loading issues
const createNumberedIcon = (num, isHighlighted = false) => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div style="
      background-color: ${isHighlighted ? '#f59e0b' : '#2563eb'};
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
      transition: all 0.2s ease;
      ${isHighlighted ? 'transform: scale(1.2);' : ''}
    ">${num}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const createLiveLocationIcon = () => {
  return L.divIcon({
    className: 'custom-live-marker',
    html: `<div style="position: relative; width: 24px; height: 24px;">
      <div style="
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: rgba(59, 130, 246, 0.4);
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: #2563eb;
        border: 3px solid white;
        box-shadow: 0 0 10px rgba(37,99,235,0.8);
      "></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const createDestinationIcon = () => {
  return L.divIcon({
    className: 'custom-destination-marker',
    html: `<div style="
      background-color: #ef4444;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 8px rgba(239,68,68,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 14px;
    ">📍</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const createNearbyIcon = (category) => {
  const bg = category === 'food' ? '#10b981' : category === 'stay' ? '#8b5cf6' : '#0284c7';
  const label = category === 'food' ? '🍴' : category === 'stay' ? '🏨' : '🚌';
  return L.divIcon({
    className: 'custom-nearby-marker',
    html: `<div style="
      background-color: ${bg};
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

// Map controller component for centering and zooming
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || 14);
    }
  }, [center, zoom, map]);
  return null;
}

export const MapView = ({
  stops = [],
  destinationName = '',
  selectedStopIndex = null,
  onSelectStop = null,
  showOriginCheckbox = false,
  onOriginChange = null,
  initialOriginChecked = false,
}) => {
  const { t } = useTranslation();
  const [liveLocation, setLiveLocation] = useState(null);
  const [liveAddress, setLiveAddress] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [originChecked, setOriginChecked] = useState(initialOriginChecked);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [routeMode, setRouteMode] = useState('driving'); // 'driving' or 'walking'
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeDistance, setRouteDistance] = useState('');
  const [routeDuration, setRouteDuration] = useState('');
  const [routeFromMyLoc, setRouteFromMyLoc] = useState(false);
  const [activeNearbyCategory, setActiveNearbyCategory] = useState(null); // 'transport', 'food', 'stay'
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [geocodedStops, setGeocodedStops] = useState(stops);

  const watchIdRef = useRef(null);
  const nearbyCacheRef = useRef({});

  // Detect dark mode from documentElement
  const isDarkMode = document.documentElement.classList.contains('dark');

  // Geocode destination with Nominatim
  useEffect(() => {
    if (!destinationName) return;
    let isCancelled = false;
    const geocodeDest = async () => {
      try {
        const query = encodeURIComponent(destinationName);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`);
        const data = await res.json();
        if (!isCancelled && data && data.length > 0) {
          const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          setDestinationCoords(coords);
          if (stops.length === 0) {
            setMapCenter(coords);
          }
        }
      } catch (e) {
        console.warn('Destination geocoding failed:', e);
      }
    };
    geocodeDest();
    return () => {
      isCancelled = true;
    };
  }, [destinationName, stops.length]);

  // Fallback geocoding if lat/lng are missing for some stops
  useEffect(() => {
    let isMounted = true;
    const geocodeMissingStops = async () => {
      const updated = await Promise.all(
        stops.map(async (stop) => {
          if (stop.lat && stop.lng) return stop;
          try {
            const query = encodeURIComponent(`${stop.place_name || stop.title}, ${stop.area || destinationName}`);
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`);
            const data = await res.json();
            if (data && data.length > 0 && isMounted) {
              return {
                ...stop,
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
              };
            }
          } catch (e) {
            console.warn('Geocoding fallback failed for stop:', stop.title, e);
          }
          return stop;
        })
      );
      if (isMounted) {
        setGeocodedStops(updated);
      }
    };

    geocodeMissingStops();
    return () => {
      isMounted = false;
    };
  }, [stops, destinationName]);

  // Determine initial center
  useEffect(() => {
    const validStop = geocodedStops.find((s) => s.lat && s.lng);
    if (validStop) {
      setMapCenter([validStop.lat, validStop.lng]);
    } else if (destinationCoords) {
      setMapCenter(destinationCoords);
    } else {
      setMapCenter([26.9124, 75.7873]); // Default Jaipur coordinates
    }
  }, [geocodedStops, destinationCoords]);

  // Reverse geocode live location with Nominatim
  const reverseGeocodeLiveLocation = async (lat, lon) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (data && data.address) {
        const area = data.address.suburb || data.address.neighbourhood || data.address.residential || data.address.road || '';
        const city = data.address.city || data.address.town || data.address.village || data.address.state_district || '';
        const state = data.address.state || '';
        const formatted = [area, city, state].filter(Boolean).join(', ');
        const detectedCity = city || area || '';
        setLiveAddress(formatted);
        setOriginCity(detectedCity);
        if (originChecked && onOriginChange) {
          onOriginChange(true, detectedCity);
        }
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }
  };

  // Handle live location tracking
  const toggleLiveLocation = () => {
    if (trackingActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setTrackingActive(false);
      setRouteFromMyLoc(false);
    } else {
      if (!navigator.geolocation) {
        setLocationError(t('map.unsupported') || 'Geolocation is not supported by your browser.');
        return;
      }
      setLocationError('');
      setTrackingActive(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setLiveLocation(coords);
          setMapCenter(coords);
          reverseGeocodeLiveLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          setLocationError(t('map.permissionDenied') || 'Location permission denied. Please allow access.');
          setTrackingActive(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    }
  };

  const handleOriginCheckboxToggle = (e) => {
    const checked = e.target.checked;
    setOriginChecked(checked);
    if (onOriginChange) {
      onOriginChange(checked, originCity || liveAddress || '');
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Calculate route with OSRM
  useEffect(() => {
    let cancel = false;
    const fetchOSRMRoute = async () => {
      const validStops = geocodedStops.filter((s) => s.lat && s.lng);
      let waypoints = [];

      if (routeFromMyLoc && liveLocation) {
        waypoints.push(liveLocation);
        if (selectedStopIndex !== null && validStops[selectedStopIndex]) {
          waypoints.push([validStops[selectedStopIndex].lat, validStops[selectedStopIndex].lng]);
        } else if (validStops.length > 0) {
          waypoints.push([validStops[0].lat, validStops[0].lng]);
        }
      } else {
        waypoints = validStops.map((s) => [s.lat, s.lng]);
      }

      if (waypoints.length < 2) {
        setRouteCoordinates([]);
        setRouteDistance('');
        setRouteDuration('');
        return;
      }

      try {
        const coordString = waypoints.map((pt) => `${pt[1]},${pt[0]}`).join(';');
        const modeStr = routeMode === 'walking' ? 'foot' : 'driving';
        const url = `https://router.project-osrm.org/route/v1/${modeStr}/${coordString}?overview=full&geometries=geojson`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('OSRM routing request failed');
        const data = await res.json();

        if (!cancel && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          // OSRM returns coordinates as [lon, lat], Leaflet polyline expects [lat, lon]
          const latLngs = route.geometry.coordinates.map((c) => [c[1], c[0]]);
          setRouteCoordinates(latLngs);

          const distKm = (route.distance / 1000).toFixed(1);
          setRouteDistance(`${distKm} km`);

          const durMin = Math.round(route.duration / 60);
          setRouteDuration(durMin > 60 ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : `${durMin} min`);
        }
      } catch (e) {
        console.warn('OSRM routing fallback to direct line:', e);
        if (!cancel) {
          setRouteCoordinates(waypoints);
          setRouteDistance('');
          setRouteDuration('');
        }
      }
    };

    fetchOSRMRoute();
    return () => {
      cancel = true;
    };
  }, [geocodedStops, routeMode, routeFromMyLoc, liveLocation, selectedStopIndex]);

  // Fetch Nearby Places using Overpass API
  const handleQueryNearby = async (category) => {
    if (activeNearbyCategory === category) {
      setActiveNearbyCategory(null);
      setNearbyPlaces([]);
      return;
    }

    setActiveNearbyCategory(category);
    setLoadingNearby(true);

    const basePoint = liveLocation || (geocodedStops[0]?.lat && [geocodedStops[0].lat, geocodedStops[0].lng]) || [26.9124, 75.7873];
    const cacheKey = `${category}_${basePoint[0].toFixed(2)}_${basePoint[1].toFixed(2)}`;

    if (nearbyCacheRef.current[cacheKey]) {
      setNearbyPlaces(nearbyCacheRef.current[cacheKey]);
      setLoadingNearby(false);
      return;
    }

    let queryTag = '';
    if (category === 'transport') {
      queryTag = `(node["amenity"="bus_station"](around:3000,${basePoint[0]},${basePoint[1]});node["railway"="station"](around:3000,${basePoint[0]},${basePoint[1]});node["amenity"="taxi"](around:3000,${basePoint[0]},${basePoint[1]});node["amenity"="car_rental"](around:3000,${basePoint[0]},${basePoint[1]});node["aeroway"="aerodrome"](around:3000,${basePoint[0]},${basePoint[1]}););`;
    } else if (category === 'food') {
      queryTag = `(node["amenity"="restaurant"](around:3000,${basePoint[0]},${basePoint[1]});node["amenity"="cafe"](around:3000,${basePoint[0]},${basePoint[1]});node["amenity"="fast_food"](around:3000,${basePoint[0]},${basePoint[1]}););`;
    } else if (category === 'stay') {
      queryTag = `(node["tourism"="hotel"](around:3000,${basePoint[0]},${basePoint[1]});node["tourism"="hostel"](around:3000,${basePoint[0]},${basePoint[1]});node["tourism"="guest_house"](around:3000,${basePoint[0]},${basePoint[1]}););`;
    }

    const fullOverpassQuery = `[out:json][timeout:15];${queryTag}out 20;`;

    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(fullOverpassQuery)}`,
      });

      if (!res.ok) throw new Error('Overpass query failed');
      const data = await res.json();
      const elements = (data.elements || [])
        .map((el) => {
          const name = el.tags?.name || el.tags?.['name:en'] || el.tags?.operator || `${category.toUpperCase()} Spot`;
          const dist = getDistanceKm(basePoint[0], basePoint[1], el.lat, el.lon);
          return {
            id: el.id,
            name,
            lat: el.lat,
            lng: el.lon,
            distance: dist,
            category,
          };
        })
        .slice(0, 20);

      nearbyCacheRef.current[cacheKey] = elements;
      setNearbyPlaces(elements);
    } catch (e) {
      console.warn('Overpass API error or rate-limited:', e);
      setNearbyPlaces([]);
    } finally {
      setLoadingNearby(false);
    }
  };

  const tileLayerUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="space-y-4">
      {/* Map Control Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Live Location Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleLiveLocation}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                trackingActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <LocateFixed className="w-4 h-4" />
              {trackingActive ? t('map.stopTracking') : (t('map.liveLocation') || 'Use my current location')}
            </button>

            {trackingActive && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                <Radio className="w-3.5 h-3.5 animate-spin" />
                {t('map.trackingActive') || 'Tracking live'}
              </span>
            )}

            {/* Quick Google Maps Actions */}
            {liveLocation && (destinationCoords || (geocodedStops[0]?.lat && geocodedStops[0]?.lng)) && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${liveLocation[0]},${liveLocation[1]}&destination=${(destinationCoords || [geocodedStops[0].lat, geocodedStops[0].lng])[0]},${(destinationCoords || [geocodedStops[0].lat, geocodedStops[0].lng])[1]}&travelmode=${routeMode === 'walking' ? 'walking' : 'driving'}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
              >
                <Navigation className="w-3.5 h-3.5" />
                Navigate in Google Maps
              </a>
            )}

            {destinationName && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationName)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open destination in Google Maps
              </a>
            )}
          </div>

          {/* Route Mode & Distance Info */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                onClick={() => setRouteMode('driving')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  routeMode === 'driving'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                {t('map.driving')}
              </button>
              <button
                onClick={() => setRouteMode('walking')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  routeMode === 'walking'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                {t('map.walking')}
              </button>
            </div>

            {trackingActive && (
              <button
                onClick={() => setRouteFromMyLoc(!routeFromMyLoc)}
                className={`text-xs px-2.5 py-1.5 rounded-xl font-semibold border transition-colors ${
                  routeFromMyLoc
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {t('map.routeFromMe') || 'Route from my location'}
              </button>
            )}

            {routeDistance && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200">
                <Navigation className="w-3 h-3 text-brand-600" />
                <span>{routeDistance}</span>
                {routeDuration && (
                  <>
                    <span className="text-slate-400">&bull;</span>
                    <Clock className="w-3 h-3 text-brand-600" />
                    <span>{routeDuration}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live Address & Optional Origin Checkbox */}
        {(liveAddress || showOriginCheckbox) && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            {liveAddress && (
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                <span className="font-semibold text-slate-500 dark:text-slate-400">You are here:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{liveAddress}</span>
              </div>
            )}
            {showOriginCheckbox && (
              <label className="inline-flex items-center gap-2 cursor-pointer select-none ml-auto text-slate-700 dark:text-slate-300 font-semibold">
                <input
                  type="checkbox"
                  checked={originChecked}
                  onChange={handleOriginCheckboxToggle}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>Use my location as trip starting point</span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Permission error message */}
      {locationError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{locationError}</span>
        </div>
      )}

      {/* Category Chips for Nearby Search */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          {t('map.nearbyTitle')}:
        </span>

        <button
          onClick={() => handleQueryNearby('transport')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeNearbyCategory === 'transport'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Bus className="w-3.5 h-3.5" />
          {t('map.transport')}
        </button>

        <button
          onClick={() => handleQueryNearby('food')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeNearbyCategory === 'food'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          {t('map.food')}
        </button>

        <button
          onClick={() => handleQueryNearby('stay')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeNearbyCategory === 'stay'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Hotel className="w-3.5 h-3.5" />
          {t('map.stay')}
        </button>
      </div>

      {/* Main Map Container */}
      <div className="relative w-full h-[520px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
        {mapCenter && (
          <MapContainer
            center={mapCenter}
            zoom={13}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
          >
            <ChangeView center={mapCenter} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={tileLayerUrl}
            />

            {/* Itinerary Stops Markers */}
            {geocodedStops.map((stop, idx) => {
              if (!stop.lat || !stop.lng) return null;
              const isSelected = selectedStopIndex === idx;
              return (
                <Marker
                  key={`stop-${idx}`}
                  position={[stop.lat, stop.lng]}
                  icon={createNumberedIcon(idx + 1, isSelected)}
                  eventHandlers={{
                    click: () => onSelectStop && onSelectStop(idx),
                  }}
                >
                  <Popup>
                    <div className="p-1 max-w-xs text-slate-900">
                      <div className="font-extrabold text-sm mb-0.5">
                        {stop.place_name || stop.title}
                      </div>
                      <div className="text-xs text-slate-500 mb-2">
                        {stop.area || stop.location}
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-2 mb-2">
                        {stop.description}
                      </p>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                        <span className="font-semibold text-brand-600">
                          {stop.estimated_cost}
                        </span>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand-600 text-white font-bold hover:bg-brand-700"
                        >
                          <Navigation className="w-3 h-3" />
                          {t('itinerary.navigate')}
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Live Location Pulsing Marker */}
            {liveLocation && (
              <Marker position={liveLocation} icon={createLiveLocationIcon()}>
                <Popup>
                  <div className="text-xs font-bold text-slate-900 p-1">
                    {t('map.yourLocation')}
                    {liveAddress && <div className="text-[11px] text-slate-600 font-normal mt-1">{liveAddress}</div>}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Destination Red Pin Marker */}
            {destinationCoords && (
              <Marker position={destinationCoords} icon={createDestinationIcon()}>
                <Popup>
                  <div className="p-1 max-w-xs text-slate-900">
                    <div className="font-extrabold text-sm mb-0.5 text-rose-600 flex items-center gap-1">
                      <span>📍</span> {destinationName || 'Destination'}
                    </div>
                    <div className="text-[11px] text-slate-500 mb-2">
                      Trip Destination
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationName)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open destination in Google Maps
                    </a>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Nearby Found Places Markers */}
            {nearbyPlaces.map((place) => (
              <Marker
                key={`nearby-${place.id}`}
                position={[place.lat, place.lng]}
                icon={createNearbyIcon(place.category)}
              >
                <Popup>
                  <div className="p-1 max-w-xs text-slate-900">
                    <div className="font-bold text-xs mb-1">{place.name}</div>
                    <div className="text-[11px] text-slate-500 mb-2">
                      {place.distance && `${place.distance} away`}
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-brand-600 text-white font-bold text-[11px] hover:bg-brand-700"
                    >
                      <Navigation className="w-3 h-3" />
                      {t('itinerary.navigate')}
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Route Polyline from OSRM */}
            {routeCoordinates.length > 0 && (
              <Polyline
                positions={routeCoordinates}
                color={routeMode === 'walking' ? '#10b981' : '#2563eb'}
                weight={5}
                opacity={0.8}
                dashArray={routeMode === 'walking' ? '8, 8' : undefined}
              />
            )}
          </MapContainer>
        )}
      </div>

      {/* Nearby Results List & Quick Navigation */}
      {activeNearbyCategory && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 capitalize flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-600" />
              {activeNearbyCategory} &mdash;{' '}
              {loadingNearby
                ? t('map.loadingNearby')
                : `${nearbyPlaces.length} ${t('map.resultsFound')}`}
            </h4>
            <button
              onClick={() => {
                setActiveNearbyCategory(null);
                setNearbyPlaces([]);
              }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
            >
              Close
            </button>
          </div>

          {loadingNearby ? (
            <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
              {t('map.loadingNearby')}
            </div>
          ) : nearbyPlaces.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              {t('map.noNearby')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
              {nearbyPlaces.map((place) => (
                <div
                  key={place.id}
                  onClick={() => setMapCenter([place.lat, place.lng])}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {place.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {place.distance || 'Nearby'}
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold">
                      {t('map.clickToFocus')}
                    </span>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400"
                      title={t('itinerary.navigate')}
                    >
                      <Navigation className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
