import math
import re
import logging
from typing import List, Dict, Any, Tuple, Optional
import httpx

from app.utils.errors import AIGenerationError

logger = logging.getLogger(__name__)

# Fallback coordinates for common destinations when Nominatim is unavailable or sandboxed
DESTINATION_COORDINATES = {
    "delhi": (28.6139, 77.2090),
    "new delhi": (28.6139, 77.2090),
    "mumbai": (18.9220, 72.8347),
    "jaipur": (26.9124, 75.7873),
    "agra": (27.1767, 78.0081),
    "goa": (15.2993, 74.1240),
    "bengaluru": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),
    "varanasi": (25.3176, 82.9739),
    "udaipur": (24.5854, 73.7125),
    "kolkata": (22.5726, 88.3639),
    "chennai": (13.0827, 80.2707),
    "hyderabad": (17.3850, 78.4867),
    "kochi": (9.9312, 76.2673),
    "manali": (32.2432, 77.1892),
    "shimla": (31.1048, 77.1734),
    "indore": (22.7196, 75.8577),
    "pune": (18.5204, 73.8567),
    "ahmedabad": (23.0225, 72.5714),
    "amritsar": (31.6340, 74.8723),
    "rishikesh": (30.0869, 78.2676),
    "paris": (48.8566, 2.3522),
    "london": (51.5074, -0.1278),
    "tokyo": (35.6762, 139.6503),
    "dubai": (25.2048, 55.2708),
    "rome": (41.9028, 12.4964),
}


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two coordinates."""
    r = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def normalize_name(name: str) -> str:
    """Normalize place name for deduplication."""
    cleaned = re.sub(r"[^\w\s]", "", name.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def geocode_destination(destination: str) -> Tuple[str, float, float]:
    """Geocode destination city name via Nominatim with fallback to known coordinates."""
    dest_clean = destination.strip()
    title_dest = dest_clean.title()

    # Try Nominatim search with short timeout
    try:
        url = f"https://nominatim.openstreetmap.org/search?q={dest_clean}&format=json&limit=1"
        headers = {"User-Agent": "VoyageAITravelPlanner/1.0"}
        with httpx.Client(timeout=4.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    item = data[0]
                    name = item.get("name") or title_dest
                    return name.title(), float(item["lat"]), float(item["lon"])
    except Exception as e:
        logger.warning("Nominatim geocoding failed for %s: %s", dest_clean, e)

    # Check local coordinate dictionary
    dest_lower = dest_clean.lower()
    for city, coords in DESTINATION_COORDINATES.items():
        if city in dest_lower or dest_lower in city:
            return city.title(), coords[0], coords[1]

    # Default coordinates (center of India) if not found
    return title_dest, 22.7196, 75.8577


def fetch_overpass_places(lat: float, lon: float, radius_m: int) -> List[Dict[str, Any]]:
    """Query Overpass API for tourism, historic, leisure, and places of worship."""
    query = f"""[out:json][timeout:8];
(
  node["tourism"="attraction"](around:{radius_m},{lat},{lon});
  node["tourism"="museum"](around:{radius_m},{lat},{lon});
  node["tourism"="viewpoint"](around:{radius_m},{lat},{lon});
  node["tourism"="gallery"](around:{radius_m},{lat},{lon});
  node["historic"](around:{radius_m},{lat},{lon});
  node["leisure"="park"](around:{radius_m},{lat},{lon});
  node["amenity"="marketplace"](around:{radius_m},{lat},{lon});
  node["amenity"="place_of_worship"](around:{radius_m},{lat},{lon});
);
out 60;
"""
    headers = {"User-Agent": "VoyageAITravelPlanner/1.0"}
    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]

    for endpoint in endpoints:
        try:
            with httpx.Client(timeout=6.0) as client:
                resp = client.post(endpoint, data={"data": query}, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    elements = data.get("elements", [])
                    results = []
                    for el in elements:
                        tags = el.get("tags", {})
                        name = tags.get("name") or tags.get("name:en")
                        if not name:
                            continue
                        plat = el.get("lat") or el.get("center", {}).get("lat")
                        plon = el.get("lon") or el.get("center", {}).get("lon")
                        if not plat or not plon:
                            continue

                        # Determine category and title prefix
                        cat = "sightseeing"
                        cat_title = "Historic Sight"
                        if "museum" in tags.get("tourism", ""):
                            cat = "sightseeing"
                            cat_title = "Museum Visit"
                        elif "viewpoint" in tags.get("tourism", ""):
                            cat = "sightseeing"
                            cat_title = "Scenic View"
                        elif "park" in tags.get("leisure", ""):
                            cat = "sightseeing"
                            cat_title = "Garden Stroll"
                        elif "place_of_worship" in tags.get("amenity", ""):
                            cat = "sightseeing"
                            cat_title = "Spiritual Visit"
                        elif "marketplace" in tags.get("amenity", ""):
                            cat = "shopping"
                            cat_title = "Market Discovery"

                        area = tags.get("addr:suburb") or tags.get("addr:district") or tags.get("addr:city") or "Central"

                        results.append({
                            "place_name": name.strip(),
                            "area": area.strip(),
                            "lat": round(float(plat), 4),
                            "lng": round(float(plon), 4),
                            "category": cat,
                            "category_title": cat_title,
                        })
                    if results:
                        return results
        except Exception as e:
            logger.debug("Overpass endpoint %s failed: %s", endpoint, e)

    return []


async def get_places_pool(
    destination: str,
    days: int,
    pace: str = "moderate",
    language: str = "en"
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Build candidate pool for destination:
    - Geocode destination with Nominatim
    - Extract places from existing popular-places logic and cache
    - Query Overpass (expanding 10km -> 25km -> 50km)
    - De-duplicate by normalized name and coordinates (<100m)
    - Ensure size: days * stops_per_day + 30%
    """
    stops_per_day = 2 if pace == "relaxed" else (3 if pace == "moderate" else 4)
    target_count = math.ceil(days * stops_per_day * 1.3)

    city_title, base_lat, base_lng = geocode_destination(destination)

    raw_candidates: List[Dict[str, Any]] = []

    # 1. Fetch from existing popular places service / cache
    try:
        from app.services.ai import get_ai_service
        ai_service = get_ai_service()
        popular_data = await ai_service.get_popular_destinations(city_title, language)

        for item in popular_data.get("top_attractions", []):
            if isinstance(item, dict) and item.get("name"):
                raw_candidates.append({
                    "place_name": item["name"],
                    "area": item.get("area") or city_title,
                    "lat": float(item.get("lat") or (base_lat + 0.005)),
                    "lng": float(item.get("lng") or (base_lng + 0.005)),
                    "category": "sightseeing",
                    "category_title": "City Attraction",
                })

        for item in popular_data.get("must_try_foods", []):
            if isinstance(item, dict) and item.get("name"):
                p_name = item.get("exact_dish") or item["name"]
                if item.get("name") and item.get("exact_dish"):
                    p_name = f"{item['name']} ({item['exact_dish']})"
                raw_candidates.append({
                    "place_name": p_name,
                    "area": item.get("area") or city_title,
                    "lat": float(item.get("lat") or (base_lat - 0.004)),
                    "lng": float(item.get("lng") or (base_lng + 0.003)),
                    "category": "food",
                    "category_title": "Culinary Highlight",
                })

        for item in popular_data.get("shopping_specialties", []):
            if isinstance(item, dict) and item.get("name"):
                raw_candidates.append({
                    "place_name": item["name"],
                    "area": item.get("area") or city_title,
                    "lat": float(item.get("lat") or (base_lat + 0.003)),
                    "lng": float(item.get("lng") or (base_lng - 0.004)),
                    "category": "shopping",
                    "category_title": "Local Market",
                })

        for item in popular_data.get("hidden_gems", []):
            if isinstance(item, dict) and item.get("name"):
                raw_candidates.append({
                    "place_name": item["name"],
                    "area": item.get("area") or city_title,
                    "lat": float(item.get("lat") or (base_lat - 0.006)),
                    "lng": float(item.get("lng") or (base_lng - 0.006)),
                    "category": "sightseeing",
                    "category_title": "Hidden Gem",
                })
    except Exception as e:
        logger.warning("Popular destinations extraction failed: %s", e)

    # 2. Overpass query with expanding radii: 10km, 25km, 50km
    for radius in [10000, 25000, 50000]:
        if len(raw_candidates) >= target_count:
            break
        overpass_results = fetch_overpass_places(base_lat, base_lng, radius)
        raw_candidates.extend(overpass_results)

    # 3. De-duplicate by normalized name and coordinates (<100m)
    deduped: List[Dict[str, Any]] = []
    seen_names = set()

    for candidate in raw_candidates:
        name = candidate.get("place_name", "").strip()
        if not name or len(name) < 2:
            continue
        norm = normalize_name(name)
        if norm in seen_names:
            continue

        c_lat = candidate.get("lat")
        c_lng = candidate.get("lng")
        if c_lat is None or c_lng is None:
            continue

        # Coordinate proximity check (<100m)
        is_duplicate_coord = False
        for existing in deduped:
            dist = haversine_distance_m(c_lat, c_lng, existing["lat"], existing["lng"])
            if dist < 100.0 and (norm in normalize_name(existing["place_name"]) or normalize_name(existing["place_name"]) in norm):
                is_duplicate_coord = True
                break

        if is_duplicate_coord:
            continue

        seen_names.add(norm)
        deduped.append(candidate)

    # 4. Ensure we have at least days * stops_per_day places
    min_required = days * stops_per_day
    if len(deduped) < min_required:
        raise AIGenerationError(
            f"Could not discover enough verified places for {city_title} to build a {days}-day itinerary. "
            f"Found {len(deduped)} places, minimum required is {min_required}."
        )

    return city_title, deduped
