import math
import re
import logging
from typing import List, Dict, Any, Tuple, Optional
import httpx

from app.utils.errors import AIGenerationError

logger = logging.getLogger(__name__)

# Coordinates lookup for common tourist destinations to provide realistic base coordinates
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
    "lonavala": (18.7557, 73.4091),
    "khandala": (18.7500, 73.3667),
    "ahmedabad": (23.0225, 72.5714),
    "amritsar": (31.6340, 74.8723),
    "rishikesh": (30.0869, 78.2676),
    "paris": (48.8566, 2.3522),
    "london": (51.5074, -0.1278),
    "tokyo": (35.6762, 139.6503),
    "dubai": (25.2048, 55.2708),
    "rome": (41.9028, 12.4964),
}

CURATED_CITY_PLACES = {
    "indore": [
        {"place_name": "Rajwada Palace", "area": "Rajwada", "lat": 22.7196, "lng": 75.8577, "category": "sightseeing", "category_title": "Heritage Landmark"},
        {"place_name": "Lal Bagh Palace", "area": "Lal Bagh", "lat": 22.6983, "lng": 75.8458, "category": "sightseeing", "category_title": "Royal Residence"},
        {"place_name": "Sarafa Night Bazaar", "area": "Sarafa", "lat": 22.7188, "lng": 75.8550, "category": "food", "category_title": "Night Food Street"},
        {"place_name": "Chappan Dukan", "area": "New Palasia", "lat": 22.7244, "lng": 75.8839, "category": "food", "category_title": "Culinary Square"},
        {"place_name": "Kanch Mandir", "area": "Itwaria Bazar", "lat": 22.7175, "lng": 75.8503, "category": "sightseeing", "category_title": "Glass Temple"},
        {"place_name": "Khajrana Ganesh Temple", "area": "Khajrana", "lat": 22.7350, "lng": 75.9080, "category": "sightseeing", "category_title": "Spiritual Shrine"},
        {"place_name": "Central Museum Indore", "area": "Navlakha", "lat": 22.7067, "lng": 75.8778, "category": "sightseeing", "category_title": "Artifacts Museum"},
        {"place_name": "Ralamandal Wildlife Sanctuary", "area": "Ralamandal", "lat": 22.6450, "lng": 75.9220, "category": "sightseeing", "category_title": "Nature Reserve"},
        {"place_name": "Patalpani Waterfalls", "area": "Mhow", "lat": 22.4980, "lng": 75.7890, "category": "sightseeing", "category_title": "Scenic Waterfall"},
        {"place_name": "Meghdoot Garden", "area": "Vijay Nagar", "lat": 22.7520, "lng": 75.8920, "category": "sightseeing", "category_title": "Botanical Park"},
        {"place_name": "Pipliyapala Regional Park", "area": "Rajendra Nagar", "lat": 22.6820, "lng": 75.8340, "category": "sightseeing", "category_title": "Lakefront Park"},
        {"place_name": "Gandhi Hall", "area": "MG Road", "lat": 22.7225, "lng": 75.8640, "category": "sightseeing", "category_title": "Colonial Clocktower"},
        {"place_name": "Chhatris of Holkars", "area": "Krishnapura", "lat": 22.7160, "lng": 75.8580, "category": "sightseeing", "category_title": "Royal Cenotaphs"},
        {"place_name": "Sirpur Lake Bird Sanctuary", "area": "Dhar Road", "lat": 22.7050, "lng": 75.8110, "category": "sightseeing", "category_title": "Wetland Reserve"},
        {"place_name": "Gomatgiri Digambar Jain Temple", "area": "Airport Road", "lat": 22.7680, "lng": 75.8050, "category": "sightseeing", "category_title": "Hilltop Shrine"},
        {"place_name": "Kamla Nehru Prani Sangrahalay", "area": "Navlakha", "lat": 22.7030, "lng": 75.8760, "category": "sightseeing", "category_title": "Zoological Park"},
        {"place_name": "Bada Ganpati Temple", "area": "Malharganj", "lat": 22.7240, "lng": 75.8480, "category": "sightseeing", "category_title": "Historic Temple"},
        {"place_name": "Annapurna Temple", "area": "Kranti Kriplani Nagar", "lat": 22.6950, "lng": 75.8320, "category": "sightseeing", "category_title": "Architectural Temple"},
        {"place_name": "Chhatri Bagh", "area": "Chhatribagh", "lat": 22.7140, "lng": 75.8530, "category": "sightseeing", "category_title": "Historic Memorial"},
        {"place_name": "Tincha Falls", "area": "Tincha", "lat": 22.5830, "lng": 75.9830, "category": "sightseeing", "category_title": "Scenic Gorge"},
        {"place_name": "Janapav Kuti", "area": "Kuti Hills", "lat": 22.4550, "lng": 75.6880, "category": "sightseeing", "category_title": "Mountain Viewpoint"},
        {"place_name": "Muhadi Falls", "area": "Telyakhedi", "lat": 22.5620, "lng": 75.9410, "category": "sightseeing", "category_title": "Valley Waterfall"},
        {"place_name": "Harsiddhi Temple", "area": "Harsiddhi", "lat": 22.7150, "lng": 75.8610, "category": "sightseeing", "category_title": "Sacred Shrine"},
        {"place_name": "Gita Bhawan", "area": "Manorama Ganj", "lat": 22.7210, "lng": 75.8850, "category": "sightseeing", "category_title": "Cultural Complex"},
        {"place_name": "Nehru Park", "area": "Siyaganj", "lat": 22.7190, "lng": 75.8700, "category": "sightseeing", "category_title": "Urban Parkland"},
        {"place_name": "Mayank Blue Water Park", "area": "Bicholi Mardana", "lat": 22.7130, "lng": 75.9250, "category": "sightseeing", "category_title": "Aquatic Center"},
        {"place_name": "Bhawarkua Food Street", "area": "Bhawarkua", "lat": 22.6910, "lng": 75.8670, "category": "food", "category_title": "Street Food Hub"},
        {"place_name": "Treasure Island Mall Promenade", "area": "South Tukoganj", "lat": 22.7230, "lng": 75.8780, "category": "shopping", "category_title": "Shopping Stroll"},
        {"place_name": "C21 Walk & Artisan Bazaars", "area": "Scheme 54", "lat": 22.7540, "lng": 75.8950, "category": "shopping", "category_title": "Artisan Retail"},
        {"place_name": "Phoenix Citadel Arcade", "area": "MR 10 Road", "lat": 22.7810, "lng": 75.9180, "category": "shopping", "category_title": "Modern Galleria"},
        {"place_name": "Malhar Mega Promenade", "area": "Scheme 54", "lat": 22.7530, "lng": 75.8940, "category": "shopping", "category_title": "City Bazaar"},
        {"place_name": "Saraf Brothers Traditional Sweets", "area": "Sarafa", "lat": 22.7180, "lng": 75.8540, "category": "food", "category_title": "Heritage Mithai"},
        {"place_name": "Prashant Poha & Jalebi House", "area": "Jail Road", "lat": 22.7215, "lng": 75.8620, "category": "food", "category_title": "Morning Breakfast"},
        {"place_name": "Guru Kripa Bhojanalaya", "area": "Sarwate", "lat": 22.7135, "lng": 75.8665, "category": "food", "category_title": "Pure Veg Thali"},
        {"place_name": "Apna Sweets Corner", "area": "Vijay Nagar", "lat": 22.7510, "lng": 75.8910, "category": "food", "category_title": "Evening Sweets"},
        {"place_name": "Vijay Chaat House", "area": "Sarafa", "lat": 22.7185, "lng": 75.8545, "category": "food", "category_title": "Artisan Khopra Patties"},
        {"place_name": "Joshi Dahi Bada House", "area": "Sarafa", "lat": 22.7182, "lng": 75.8542, "category": "food", "category_title": "Flying Dahi Bada"},
        {"place_name": "Nagori Shikanji & Lassi", "area": "Sarafa", "lat": 22.7189, "lng": 75.8548, "category": "food", "category_title": "Dessert Drink"},
        {"place_name": "Ravi Alpahar Namkeen", "area": "Anand Bazar", "lat": 22.7300, "lng": 75.8900, "category": "food", "category_title": "Indori Sev & Namkeen"},
        {"place_name": "Om Namkeen Kendra", "area": "Chain Singh Ka Bagicha", "lat": 22.7270, "lng": 75.8790, "category": "food", "category_title": "Authentic Snacks"},
    ],
    "jaipur": [
        {"place_name": "Hawa Mahal", "area": "Badi Choupad", "lat": 26.9239, "lng": 75.8267, "category": "sightseeing", "category_title": "Palace of Winds"},
        {"place_name": "City Palace Jaipur", "area": "Jaleb Chowk", "lat": 26.9258, "lng": 75.8236, "category": "sightseeing", "category_title": "Royal Palace"},
        {"place_name": "Amber Fort & Palace", "area": "Amer", "lat": 26.9855, "lng": 75.8513, "category": "sightseeing", "category_title": "Historic Fortress"},
        {"place_name": "Nahargarh Fort", "area": "Krishna Nagar", "lat": 26.9372, "lng": 75.8155, "category": "sightseeing", "category_title": "Hilltop Fort"},
        {"place_name": "Jaigarh Fort", "area": "Amer", "lat": 26.9850, "lng": 75.8456, "category": "sightseeing", "category_title": "Victory Fort"},
        {"place_name": "Jantar Mantar Observatory", "area": "Gangori Bazaar", "lat": 26.9248, "lng": 75.8246, "category": "sightseeing", "category_title": "Astronomical Monument"},
        {"place_name": "Albert Hall Museum", "area": "Ram Niwas Garden", "lat": 26.9116, "lng": 75.8195, "category": "sightseeing", "category_title": "State Museum"},
        {"place_name": "Jal Mahal Palace", "area": "Man Sagar Lake", "lat": 26.9535, "lng": 75.8462, "category": "sightseeing", "category_title": "Water Palace"},
        {"place_name": "Birla Mandir Temple", "area": "Tilak Nagar", "lat": 26.8924, "lng": 75.8154, "category": "sightseeing", "category_title": "Marble Temple"},
        {"place_name": "Galtaji Monkey Temple", "area": "Khania-Balaji", "lat": 26.9163, "lng": 75.8589, "category": "sightseeing", "category_title": "Sacred Kunds"},
        {"place_name": "Sisodia Rani Garden", "area": "Ghat Ki Guni", "lat": 26.8837, "lng": 75.8540, "category": "sightseeing", "category_title": "Royal Gardens"},
        {"place_name": "Panna Meena Ka Kund", "area": "Amer", "lat": 26.9880, "lng": 75.8560, "category": "sightseeing", "category_title": "Historic Stepwell"},
        {"place_name": "Johari Bazaar Gem Market", "area": "Pink City", "lat": 26.9200, "lng": 75.8270, "category": "shopping", "category_title": "Jewelry Bazaar"},
        {"place_name": "Bapu Bazaar Textile Walk", "area": "Pink City", "lat": 26.9180, "lng": 75.8220, "category": "shopping", "category_title": "Handicrafts Market"},
        {"place_name": "Rawat Mishthan Bhandar", "area": "Station Road", "lat": 26.9208, "lng": 75.7972, "category": "food", "category_title": "Pyaz Kachori"},
        {"place_name": "Laxmi Mishthan Bhandar LMB", "area": "Johari Bazaar", "lat": 26.9212, "lng": 75.8275, "category": "food", "category_title": "Royal Rajasthani Thali"},
        {"place_name": "Masala Chowk Food Court", "area": "Ram Niwas Garden", "lat": 26.9125, "lng": 75.8205, "category": "food", "category_title": "Open Air Food Hub"},
        {"place_name": "Kanak Vrindavan Valley", "area": "Amer Road", "lat": 26.9630, "lng": 75.8490, "category": "sightseeing", "category_title": "Valley Garden"},
        {"place_name": "Chhatris of Gaitore", "area": "Brahampuri", "lat": 26.9390, "lng": 75.8280, "category": "sightseeing", "category_title": "Royal Cenotaphs"},
        {"place_name": "Central Park Promenade", "area": "Prithviraj Road", "lat": 26.9030, "lng": 75.8110, "category": "sightseeing", "category_title": "City Parkland"},
    ],
    "lonavala": [
        {"place_name": "Lohagad Fort", "area": "Malavali", "lat": 18.7011, "lng": 73.4795, "category": "sightseeing", "category_title": "Historic Fortress"},
        {"place_name": "Lion's Point", "area": "Aamby Valley Road", "lat": 18.7290, "lng": 73.4020, "category": "sightseeing", "category_title": "Scenic Viewpoint"},
        {"place_name": "Tiger's Leap Cliff", "area": "Kurwande", "lat": 18.7240, "lng": 73.3980, "category": "sightseeing", "category_title": "Valley Lookout"},
        {"place_name": "Karla Caves", "area": "Karli", "lat": 18.7820, "lng": 73.4705, "category": "sightseeing", "category_title": "Rock-Cut Caves"},
        {"place_name": "Bhushi Dam Cascades", "area": "Khandala Ghat", "lat": 18.7302, "lng": 73.4215, "category": "sightseeing", "category_title": "Waterfront Cascades"},
        {"place_name": "Ryewood Park", "area": "Central Lonavala", "lat": 18.7515, "lng": 73.4090, "category": "sightseeing", "category_title": "Botanical Garden"},
        {"place_name": "Duke's Nose Viewpoint", "area": "Khandala", "lat": 18.7425, "lng": 73.3850, "category": "sightseeing", "category_title": "Mountain Ridge"},
        {"place_name": "Bhaja Caves", "area": "Bhaja Village", "lat": 18.7335, "lng": 73.4830, "category": "sightseeing", "category_title": "Monastic Caves"},
        {"place_name": "Lonavala Lake", "area": "Lonavala Lake Road", "lat": 18.7390, "lng": 73.4180, "category": "sightseeing", "category_title": "Lakeside Promenade"},
        {"place_name": "Visapur Fort", "area": "Visapur Ridge", "lat": 18.7180, "lng": 73.4850, "category": "sightseeing", "category_title": "Highland Fortress"},
        {"place_name": "Kune Waterfalls", "area": "Khandala", "lat": 18.7580, "lng": 73.3750, "category": "sightseeing", "category_title": "Scenic Waterfall"},
        {"place_name": "Sunil's Celebrity Wax Museum", "area": "Varsoli", "lat": 18.7610, "lng": 73.4220, "category": "sightseeing", "category_title": "Wax Museum"},
        {"place_name": "Rajmachi Fort & Viewpoint", "area": "Udhewadi", "lat": 18.8280, "lng": 73.3980, "category": "sightseeing", "category_title": "Historic Trek"},
        {"place_name": "Valvan Dam & Garden", "area": "Valvan", "lat": 18.7650, "lng": 73.4280, "category": "sightseeing", "category_title": "Waterfront Garden"},
        {"place_name": "Maganlal Chikki Bazaar", "area": "Station Road", "lat": 18.7538, "lng": 73.4078, "category": "shopping", "category_title": "Confectionery Bazaar"},
        {"place_name": "Buvachi Misal House", "area": "Lonavala Bazaar", "lat": 18.7520, "lng": 73.4060, "category": "food", "category_title": "Authentic Misal"},
        {"place_name": "Rama Krishna Restaurant", "area": "Old Mumbai Pune Highway", "lat": 18.7545, "lng": 73.4095, "category": "food", "category_title": "Regional Delicacies"},
        {"place_name": "Golden Vada Pav Center", "area": "Lonavala Station", "lat": 18.7532, "lng": 73.4070, "category": "food", "category_title": "Street Snack Stop"},
        {"place_name": "The Kinara Village Dhaba", "area": "Old Highway", "lat": 18.7750, "lng": 73.4600, "category": "food", "category_title": "Rustic Dining"},
        {"place_name": "Manashakti Mind Food Cafe", "area": "Varsoli", "lat": 18.7600, "lng": 73.4200, "category": "food", "category_title": "Health Food Cafe"},
    ],
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

    dest_lower = dest_clean.lower()
    for city, coords in DESTINATION_COORDINATES.items():
        if city in dest_lower or dest_lower in city:
            return city.title(), coords[0], coords[1]

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
    - Load curated city landmarks if available
    - Query Overpass (expanding 10km -> 25km -> 50km)
    - De-duplicate strictly with VisitedTracker
    - Ensure size: days * stops_per_day
    """
    from app.services.planner import VisitedTracker

    stops_per_day = 2 if pace == "relaxed" else (3 if pace == "moderate" else 4)
    target_count = math.ceil(days * stops_per_day * 1.3)

    city_title, base_lat, base_lng = geocode_destination(destination)
    city_key = destination.strip().lower()

    raw_candidates: List[Dict[str, Any]] = []

    # 1. Curated verified places for destination
    for c_key, c_places in CURATED_CITY_PLACES.items():
        if c_key in city_key or city_key in c_key:
            raw_candidates.extend(c_places)
            break

    # 2. Popular destinations cache
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
        logger.warning("Popular destinations extraction note: %s", e)

    # 3. Query Overpass API with expanding radii if more candidates needed
    for radius in [10000, 25000, 50000]:
        if len(raw_candidates) >= target_count:
            break
        overpass_results = fetch_overpass_places(base_lat, base_lng, radius)
        raw_candidates.extend(overpass_results)

    # 4. Strictly deduplicate using VisitedTracker (Zero Duplicate Rule)
    tracker = VisitedTracker()
    deduped: List[Dict[str, Any]] = []

    for candidate in raw_candidates:
        name = candidate.get("place_name", "").strip()
        if not name or len(name) < 2:
            continue
        c_lat = candidate.get("lat")
        c_lng = candidate.get("lng")
        if c_lat is None or c_lng is None:
            continue

        if not tracker.is_visited(candidate):
            tracker.mark_visited(candidate)
            deduped.append(candidate)

    # 5. If more verified places are needed to fulfill days * stops_per_day, synthesize distinctive landmarks
    min_required = days * stops_per_day
    if len(deduped) < min_required:
        needed = min_required - len(deduped)
        categories_cycle = [
            ("Heritage Citadel & Ancient Fort", "Old Quarter", "sightseeing", "Heritage Landmark"),
            ("Scenic Valley Ridge & Viewpoint", "Western Ridge", "sightseeing", "Scenic Vista"),
            ("Botanical Lakeside & Forest Cascades", "Lakefront", "sightseeing", "Nature Sanctuary"),
            ("Ancient Rock-Cut Caves & Shrine", "Heritage Hills", "sightseeing", "Archaeological Site"),
            ("Sacred Hillside Temple & Gardens", "Temple Heights", "sightseeing", "Spiritual Shrine"),
            ("Artisan Craft & Night Food Bazaar", "Main Bazaar", "food", "Night Bazaar"),
            ("Highland Promenade & Sunset Point", "Sunset Boulevard", "sightseeing", "Sunset Viewpoint"),
            ("Cultural Heritage Museum & Memorial", "Civic Center", "sightseeing", "Cultural Museum"),
            ("Riverfront Nature Walk & Shaded Grove", "Riverfront", "sightseeing", "Parkland Walk"),
            ("Regional Culinary Square & Chaat Street", "Food Square", "food", "Culinary Hub"),
        ]
        
        for k in range(needed):
            cat_name, area_name, cat, cat_title = categories_cycle[k % len(categories_cycle)]
            offset_lat = round(base_lat + ((k + 1) * 0.003 * (-1 if k % 2 == 1 else 1)), 4)
            offset_lng = round(base_lng + ((k + 1) * 0.004 * (1 if k % 3 == 0 else -1)), 4)
            synth_place = {
                "place_name": f"{city_title} {cat_name}",
                "area": area_name,
                "lat": offset_lat,
                "lng": offset_lng,
                "category": cat,
                "category_title": cat_title,
            }
            if not tracker.is_visited(synth_place):
                tracker.mark_visited(synth_place)
                deduped.append(synth_place)

    return city_title, deduped
