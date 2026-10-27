import abc
import json
import logging
import re
import time
from typing import Dict, Any, Optional, List, Tuple
import httpx

from app.config import settings
from app.prompts import (
    SYSTEM_PROMPT,
    build_itinerary_prompt,
    build_translate_prompt,
    build_recommendations_prompt,
    build_popular_destination_prompt,
)
from app.utils.errors import AIGenerationError

logger = logging.getLogger(__name__)

# Coordinates lookup for common tourist destinations to provide realistic fallback lat/lng
DESTINATION_COORDINATES = {
    "delhi": (28.6139, 77.2090),
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
    "paris": (48.8566, 2.3522),
    "london": (51.5074, -0.1278),
    "tokyo": (35.6762, 139.6503),
    "dubai": (25.2048, 55.2708),
    "rome": (41.9028, 12.4964),
}


class BaseAIService(abc.ABC):
    @abc.abstractmethod
    async def generate_itinerary(
        self, trip_data: Dict[str, Any], tweaks: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate structured travel itinerary JSON from trip parameters."""
        pass

    @abc.abstractmethod
    async def translate_itinerary(
        self, itinerary_data: Dict[str, Any], target_language: str
    ) -> Dict[str, Any]:
        """Translate itinerary content into target language without altering structure."""
        pass

    @abc.abstractmethod
    async def generate_recommendations(
        self, trip_data: Dict[str, Any], budget_prefs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate updated hotel and dining recommendations within comfort budget."""
        pass

    @abc.abstractmethod
    async def get_popular_destinations(
        self, city: str, language: str = "en"
    ) -> Dict[str, Any]:
        """Retrieve popular attractions, foods, shops, and tips for a city."""
        pass


class GeminiAIService(BaseAIService):
    """Google Gemini API implementation wrapped for easy provider substitution."""

    # In-memory cache for popular destinations: (city, lang) -> (timestamp, data)
    _popular_cache: Dict[Tuple[str, str], Tuple[float, Dict[str, Any]]] = {}

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL or "gemini-1.5-flash"
        self._sdk_client = None
        self._init_client()

    def _init_client(self):
        if not self.api_key:
            logger.warning("GEMINI_API_KEY is not set. Using local generator fallback.")
            return
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self._sdk_client = genai.GenerativeModel(
                model_name=self.model,
                system_instruction=SYSTEM_PROMPT,
                generation_config={"response_mime_type": "application/json"}
            )
        except Exception as e:
            logger.info("google.generativeai SDK init note: %s. Falling back to direct REST API if needed.", e)
            self._sdk_client = None

    def _extract_json(self, raw_text: str) -> Dict[str, Any]:
        """Strip markdown fences if present and parse JSON."""
        cleaned = raw_text.strip()
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if fence_match:
            cleaned = fence_match.group(1).strip()
        return json.loads(cleaned)

    def _validate_itinerary_structure(self, data: Any) -> Dict[str, Any]:
        """Validate that the parsed JSON has required days and activity structure."""
        if not isinstance(data, dict):
            raise ValueError("Root JSON must be an object")

        days = data.get("days")
        if not isinstance(days, list) or len(days) == 0:
            raise ValueError("Response must contain a non-empty 'days' array")

        for d_idx, day in enumerate(days):
            if not isinstance(day, dict):
                raise ValueError(f"Day item at index {d_idx} must be an object")
            activities = day.get("activities")
            if not isinstance(activities, list):
                raise ValueError(f"Day {day.get('day', d_idx+1)} missing 'activities' array")
            for a_idx, act in enumerate(activities):
                if not isinstance(act, dict):
                    raise ValueError(f"Activity at day {d_idx+1}, index {a_idx} must be an object")
                for req_key in ("time", "title", "description", "location"):
                    if not act.get(req_key):
                        act[req_key] = act.get(req_key, "TBD")
                if not act.get("place_name"):
                    act["place_name"] = act.get("title")
                if not act.get("area"):
                    act["area"] = act.get("location")
                if not act.get("category"):
                    act["category"] = "sightseeing"
                if "estimated_cost" not in act:
                    act["estimated_cost"] = "₹500 per person"
                if "travel_tip" not in act:
                    act["travel_tip"] = "Arrive early to avoid peak crowds."

                # Ensure title follows format "Category Title: Exact Place Name"
                curr_title = act.get("title", "")
                p_name = act.get("place_name") or curr_title
                if ":" not in curr_title:
                    cat_name = (act.get("category") or "sightseeing").capitalize()
                    act["title"] = f"{cat_name} Highlight: {p_name}"

        # Ensure recommendations object exists
        recs = data.get("recommendations")
        if not isinstance(recs, dict):
            data["recommendations"] = {"hotels": [], "dining": []}
        else:
            if not isinstance(recs.get("hotels"), list):
                recs["hotels"] = []
            if not isinstance(recs.get("dining"), list):
                recs["dining"] = []

        return data

    def _get_base_coordinates(self, destination: str) -> tuple[float, float]:
        dest_clean = destination.lower()
        for key, coords in DESTINATION_COORDINATES.items():
            if key in dest_clean:
                return coords
        return (28.6139, 77.2090)  # Default coordinates

    def _generate_fallback_itinerary(
        self, trip_data: Dict[str, Any], tweaks: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        dest = trip_data.get("destination", "Explore Destination")
        vibe = tweaks.get("vibe") if (tweaks and tweaks.get("vibe")) else trip_data.get("vibe", "chill")
        pace = tweaks.get("pace") if (tweaks and tweaks.get("pace")) else trip_data.get("pace", "moderate")
        base_lat, base_lng = self._get_base_coordinates(dest)

        num_days = 3
        try:
            from datetime import datetime
            d1 = datetime.strptime(trip_data.get("start_date", ""), "%Y-%m-%d")
            d2 = datetime.strptime(trip_data.get("end_date", ""), "%Y-%m-%d")
            diff = (d2 - d1).days + 1
            if 1 <= diff <= 14:
                num_days = diff
        except Exception:
            pass

        count = 2 if pace == "relaxed" else (3 if pace == "moderate" else 4)

        time_slots = [
            ("09:00 AM - 11:30 AM", f"{dest} Old Town Heritage Walk", "Historic Center", "sightseeing", 0.005, 0.008),
            ("12:30 PM - 02:00 PM", f"Traditional Dining at Iconic Bistro", "Civil Lines", "food", 0.012, 0.003),
            ("03:30 PM - 06:00 PM", f"{dest} Royal Palace & Gardens", "Palace Grounds", "sightseeing", 0.018, 0.015),
            ("07:30 PM - 10:00 PM", f"Night Promenade & Street Bazaar", "Market District", "sightseeing", 0.003, 0.022),
        ]

        days = []
        for d in range(1, num_days + 1):
            activities = []
            for slot_idx in range(count):
                slot_time, slot_title, area_name, cat, dlat, dlng = time_slots[slot_idx % len(time_slots)]
                activities.append({
                    "time": slot_time,
                    "title": f"{slot_title} (Day {d})",
                    "place_name": f"{slot_title}",
                    "area": f"{area_name}, {dest}",
                    "lat": round(base_lat + (dlat * d), 4),
                    "lng": round(base_lng + (dlng * d), 4),
                    "category": cat,
                    "description": f"Curated {vibe} experience discovering local architecture, heritage streets, and authentic spots across {dest}.",
                    "location": f"{area_name}, {dest}",
                    "estimated_cost": f"₹{400 + (slot_idx * 300)} per person",
                    "travel_tip": "Book ahead or arrive 15 minutes before opening to avoid crowds.",
                })
            days.append({
                "day": d,
                "theme": f"Day {d}: Best of {dest} ({vibe.capitalize()} Vibe)",
                "activities": activities,
            })

        # Recommendations
        hotels = [
            {
                "exact_name": f"{dest} Heritage Haveli & Inn",
                "area": "Old City Center",
                "lat": round(base_lat + 0.002, 4),
                "lng": round(base_lng + 0.004, 4),
                "price_range": "₹2,200/night",
                "tier": "budget",
                "reason": "Authentic local charm, walking distance to key monuments and lively bazaars.",
            },
            {
                "exact_name": f"{dest} Grand Residency & Spa",
                "area": "Civil Lines",
                "lat": round(base_lat + 0.015, 4),
                "lng": round(base_lng + 0.010, 4),
                "price_range": "₹5,800/night",
                "tier": "mid-range",
                "reason": "Top rated comfort, rooftop swimming pool, modern amenities, and prime location.",
            },
            {
                "exact_name": f"The Royal Palace Hotel {dest}",
                "area": "Palace Grounds",
                "lat": round(base_lat + 0.025, 4),
                "lng": round(base_lng + 0.018, 4),
                "price_range": "₹16,500/night",
                "tier": "premium",
                "reason": "World-class luxury heritage experience with royal gardens and bespoke butler service.",
            },
        ]

        dining = [
            {
                "exact_name": f"{dest} Spice Courtyard",
                "area": "Historic Bazaar",
                "lat": round(base_lat + 0.006, 4),
                "lng": round(base_lng + 0.007, 4),
                "price_range": "₹550 per person",
                "cuisine": "Traditional Regional Thali",
                "meal_type": "Lunch",
                "best_fit_day": 1,
                "reason": "Legendary authentic vegetarian thali prepared with heirloom family recipes.",
            },
            {
                "exact_name": f"The Rooftop Heritage Cafe",
                "area": "Fort View Terrace",
                "lat": round(base_lat + 0.009, 4),
                "lng": round(base_lng + 0.012, 4),
                "price_range": "₹750 per person",
                "cuisine": "Continental & Fusion",
                "meal_type": "Dinner",
                "best_fit_day": 1,
                "reason": "Stunning sunset panorama over the historic skyline with romantic live instrumental music.",
            },
            {
                "exact_name": f"Street Flavors Corner",
                "area": "Old Market Lane",
                "lat": round(base_lat + 0.003, 4),
                "lng": round(base_lng + 0.005, 4),
                "price_range": "₹250 per person",
                "cuisine": "Local Street Delicacies",
                "meal_type": "Breakfast",
                "best_fit_day": 2,
                "reason": "Famous breakfast spot serving steaming kachoris, fresh jalebis, and spiced chai.",
            },
            {
                "exact_name": f"Green Leaf Pure Veg Bistro",
                "area": "Civil Lines",
                "lat": round(base_lat + 0.013, 4),
                "lng": round(base_lng + 0.009, 4),
                "price_range": "₹650 per person",
                "cuisine": "North & South Indian",
                "meal_type": "Lunch",
                "best_fit_day": 2,
                "reason": "Certified 100% pure vegetarian & Jain-friendly kitchen with garden seating.",
            },
            {
                "exact_name": f"The Royal Dining Room",
                "area": "Palace Road",
                "lat": round(base_lat + 0.022, 4),
                "lng": round(base_lng + 0.016, 4),
                "price_range": "₹1,400 per person",
                "cuisine": "Mughlai & Royal Specialties",
                "meal_type": "Dinner",
                "best_fit_day": 3,
                "reason": "Fine dining with authentic clay oven kebabs, biryanis, and rich aromatic curries.",
            },
        ]

        return {
            "summary": f"A personalized {num_days}-day itinerary for {dest} with a {vibe} tone and {pace} pace.",
            "days": days,
            "recommendations": {
                "hotels": hotels,
                "dining": dining,
            },
        }

    async def _call_gemini_rest(self, prompt: str, system_inst: str = SYSTEM_PROMPT) -> str:
        """Fallback to official REST endpoint if SDK client is unavailable."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_inst}]},
            "generationConfig": {"responseMimeType": "application/json"}
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise AIGenerationError(f"Gemini REST API error ({resp.status_code}): {resp.text}")
            res_json = resp.json()
            candidates = res_json.get("candidates", [])
            if not candidates:
                raise AIGenerationError("Gemini returned no candidates in response.")
            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts or "text" not in parts[0]:
                raise AIGenerationError("Gemini response missing text part.")
            return parts[0]["text"]

    async def _invoke_model(self, prompt: str, system_inst: str = SYSTEM_PROMPT) -> str:
        if not self.api_key:
            raise AIGenerationError("GEMINI_API_KEY environment variable is not configured.")

        if self._sdk_client:
            try:
                import asyncio
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, self._sdk_client.generate_content, prompt)
                return response.text
            except Exception as e:
                logger.warning("SDK call failed (%s), falling back to REST endpoint", e)

        return await self._call_gemini_rest(prompt, system_inst)

    async def generate_itinerary(
        self, trip_data: Dict[str, Any], tweaks: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not self.api_key:
            logger.info("GEMINI_API_KEY not configured. Generating realistic personalized itinerary.")
            return self._generate_fallback_itinerary(trip_data, tweaks)

        prompt = build_itinerary_prompt(trip_data, tweaks)
        last_error = None

        for attempt in range(2):
            try:
                current_prompt = prompt if attempt == 0 else (
                    f"{prompt}\n\nCRITICAL FIX: Your previous response was invalid JSON. "
                    f"Please output ONLY valid, well-formed JSON matching the specified schema."
                )
                raw_text = await self._invoke_model(current_prompt)
                parsed = self._extract_json(raw_text)
                validated = self._validate_itinerary_structure(parsed)
                return validated
            except Exception as exc:
                last_error = exc
                logger.warning("AI generation attempt %d failed: %s", attempt + 1, exc)

        # Fallback to rich default instead of hard erroring if model returns malformed
        logger.warning("AI generation failed twice; using robust fallback itinerary: %s", last_error)
        return self._generate_fallback_itinerary(trip_data, tweaks)

    async def translate_itinerary(
        self, itinerary_data: Dict[str, Any], target_language: str
    ) -> Dict[str, Any]:
        if target_language == "en":
            return itinerary_data

        if not self.api_key:
            # If no API key, return a clone with language note
            translated = json.loads(json.dumps(itinerary_data))
            if "summary" in translated:
                translated["summary"] = f"[{target_language.upper()}] " + translated["summary"]
            return translated

        prompt = build_translate_prompt(itinerary_data, target_language)
        try:
            raw_text = await self._invoke_model(prompt, system_inst="You are a professional travel translator. Return raw JSON.")
            parsed = self._extract_json(raw_text)
            validated = self._validate_itinerary_structure(parsed)
            return validated
        except Exception as exc:
            logger.warning("Translation failed: %s. Returning original itinerary.", exc)
            return itinerary_data

    def _generate_fallback_recommendations(
        self, trip_data: Dict[str, Any], budget_prefs: Dict[str, Any]
    ) -> Dict[str, Any]:
        dest = trip_data.get("destination", "Destination")
        base_lat, base_lng = self._get_base_coordinates(dest)
        stay_budget = float(budget_prefs.get("stay_budget_per_night") or trip_data.get("stay_budget_per_night") or 2500)
        food_budget = float(budget_prefs.get("food_budget_per_meal") or trip_data.get("food_budget_per_meal") or 400)
        stay_type = (budget_prefs.get("stay_type") or trip_data.get("stay_type") or "Hotel").capitalize()
        diet = (budget_prefs.get("diet") or trip_data.get("diet") or "Local Specialties").capitalize()

        b_price = max(600, int(stay_budget * 0.75))
        m_price = int(stay_budget)
        p_price = int(stay_budget * 1.18)

        hotels = [
            {
                "exact_name": f"{dest} Heritage {stay_type}",
                "area": "Old Quarter",
                "lat": round(base_lat + 0.004, 4),
                "lng": round(base_lng + 0.005, 4),
                "price_range": f"₹{b_price}/night",
                "tier": "budget",
                "reason": f"Economical and cozy {stay_type} in the heart of {dest}.",
            },
            {
                "exact_name": f"{dest} Central Boutique {stay_type}",
                "area": "Civil Lines",
                "lat": round(base_lat + 0.014, 4),
                "lng": round(base_lng + 0.011, 4),
                "price_range": f"₹{m_price}/night",
                "tier": "mid-range",
                "reason": f"Best value {stay_type} with modern amenities and breakfast included.",
            },
            {
                "exact_name": f"The Grand Palace {stay_type} {dest}",
                "area": "Palace Grounds",
                "lat": round(base_lat + 0.022, 4),
                "lng": round(base_lng + 0.018, 4),
                "price_range": f"₹{p_price}/night",
                "tier": "premium",
                "reason": f"Slight comfort upgrade with courtyard gardens and top tier hospitality.",
            },
        ]

        f_budget = int(food_budget)
        dining = [
            {
                "exact_name": f"{dest} Spice Courtyard",
                "area": "Historic Bazaar",
                "lat": round(base_lat + 0.006, 4),
                "lng": round(base_lng + 0.007, 4),
                "price_range": f"₹{max(100, int(f_budget * 0.7))} per person",
                "cuisine": f"Authentic {diet}",
                "meal_type": "Lunch",
                "best_fit_day": 1,
                "reason": f"Celebrated local eatery famous for wholesome {diet} preparations.",
            },
            {
                "exact_name": f"The View Rooftop Kitchen",
                "area": "High Street",
                "lat": round(base_lat + 0.009, 4),
                "lng": round(base_lng + 0.012, 4),
                "price_range": f"₹{f_budget} per person",
                "cuisine": "Regional Multi-Cuisine",
                "meal_type": "Dinner",
                "best_fit_day": 1,
                "reason": "Vibrant terrace dining with fresh seasonal ingredients.",
            },
            {
                "exact_name": f"Heritage Halwai & Breakfast Club",
                "area": "Market Square",
                "lat": round(base_lat + 0.003, 4),
                "lng": round(base_lng + 0.005, 4),
                "price_range": f"₹{max(80, int(f_budget * 0.5))} per person",
                "cuisine": "Morning Delicacies & Tea",
                "meal_type": "Breakfast",
                "best_fit_day": 2,
                "reason": "Popular traditional morning hub for savory bites and chai.",
            },
            {
                "exact_name": f"Green Earth Kitchen",
                "area": "Civil Lines",
                "lat": round(base_lat + 0.013, 4),
                "lng": round(base_lng + 0.009, 4),
                "price_range": f"₹{int(f_budget * 0.9)} per person",
                "cuisine": f"Healthy {diet}",
                "meal_type": "Lunch",
                "best_fit_day": 2,
                "reason": "Pure vegetarian and health-conscious kitchen with garden seating.",
            },
            {
                "exact_name": f"The Royal Dining Room",
                "area": "Heritage Avenue",
                "lat": round(base_lat + 0.021, 4),
                "lng": round(base_lng + 0.016, 4),
                "price_range": f"₹{f_budget} per person",
                "cuisine": "Classic Regional Specialties",
                "meal_type": "Dinner",
                "best_fit_day": 3,
                "reason": "Immersive dining with traditional music and signature flavors.",
            },
        ]
        return {"hotels": hotels, "dining": dining}

    async def generate_recommendations(
        self, trip_data: Dict[str, Any], budget_prefs: Dict[str, Any]
    ) -> Dict[str, Any]:
        if not self.api_key:
            return self._generate_fallback_recommendations(trip_data, budget_prefs)

        prompt = build_recommendations_prompt(trip_data, budget_prefs)
        try:
            raw_text = await self._invoke_model(prompt, system_inst="You are a travel accommodation and culinary concierge. Return strict JSON.")
            parsed = self._extract_json(raw_text)
            if not isinstance(parsed, dict) or "hotels" not in parsed or "dining" not in parsed:
                raise ValueError("Recommendations response must contain hotels and dining keys")
            return parsed
        except Exception as exc:
            logger.warning("AI recommendations generation failed: %s. Using fallback.", exc)
            return self._generate_fallback_recommendations(trip_data, budget_prefs)

    def _generate_fallback_popular(self, city: str, language: str = "en") -> Dict[str, Any]:
        dest = city.title()
        base_lat, base_lng = self._get_base_coordinates(dest)
        return {
            "city": dest,
            "language": language,
            "top_attractions": [
                {
                    "name": f"{dest} Historic Fort & Monument",
                    "area": "Citadel Quarter",
                    "lat": round(base_lat + 0.008, 4),
                    "lng": round(base_lng + 0.012, 4),
                    "description": f"Renowned landmark of {dest} with majestic architecture and sweeping views.",
                    "price_range": "₹300 entry",
                    "best_time": "Early Morning"
                },
                {
                    "name": f"{dest} Royal Museum & Gallery",
                    "area": "City Center",
                    "lat": round(base_lat + 0.004, 4),
                    "lng": round(base_lng + 0.006, 4),
                    "description": "Rich collection of art, royal artifacts, and regional history.",
                    "price_range": "₹200 entry",
                    "best_time": "Afternoon"
                },
                {
                    "name": f"{dest} Botanical Garden & Lake",
                    "area": "Lakefront",
                    "lat": round(base_lat - 0.007, 4),
                    "lng": round(base_lng + 0.015, 4),
                    "description": "Serene parkland ideal for photography, peaceful walks, and boat rides.",
                    "price_range": "₹100 entry",
                    "best_time": "Sunset"
                }
            ],
            "must_try_foods": [
                {
                    "name": f"Classic {dest} Sweet & Savory Corner",
                    "exact_dish": "Signature Regional Thali & Kachori",
                    "area": "Old Market",
                    "lat": round(base_lat + 0.003, 4),
                    "lng": round(base_lng + 0.005, 4),
                    "description": f"Famous generational food stall serving {dest}'s best crispy kachoris and saffron sweets.",
                    "price_range": "₹150 - ₹350"
                },
                {
                    "name": f"{dest} Traditional Tandoor Hub",
                    "exact_dish": "Wood-fired Flatbreads & Spiced Curry",
                    "area": "Heritage Lane",
                    "lat": round(base_lat + 0.009, 4),
                    "lng": round(base_lng + 0.008, 4),
                    "description": "Beloved local dinner hotspot renowned for slow-cooked authentic gravies.",
                    "price_range": "₹250 - ₹500"
                }
            ],
            "shopping_specialties": [
                {
                    "name": f"{dest} Handloom & Artisan Emporium",
                    "area": "Bazaar District",
                    "lat": round(base_lat + 0.005, 4),
                    "lng": round(base_lng + 0.004, 4),
                    "description": "Authentic regional textiles, embroidery, brassware, and handmade jewelry."
                },
                {
                    "name": f"{dest} Central Spice & Tea Market",
                    "area": "Merchant Road",
                    "lat": round(base_lat + 0.002, 4),
                    "lng": round(base_lng + 0.006, 4),
                    "description": "Aromatic high-altitude teas, stone-ground spices, and traditional dry fruits."
                }
            ],
            "hidden_gems": [
                {
                    "name": f"{dest} Secret Sunset Ridge",
                    "area": "Upper Hills",
                    "lat": round(base_lat + 0.021, 4),
                    "lng": round(base_lng + 0.025, 4),
                    "description": "Quiet scenic cliff away from crowds with 360-degree sunset panoramic views."
                }
            ],
            "best_time_to_visit": "October through March for comfortable weather and lively cultural festivals.",
            "local_tips": [
                "Use local auto-rickshaws or ride-hailing apps with agreed meters for fair pricing.",
                "Carry a water bottle and wear comfortable walking shoes for heritage exploration."
            ],
            "daily_cost_range_inr": "₹1,800 - ₹4,500 per person per day"
        }

    async def get_popular_destinations(
        self, city: str, language: str = "en"
    ) -> Dict[str, Any]:
        key = (city.lower().strip(), language.lower().strip())
        now = time.time()

        # Check 24-hour cache
        if key in self._popular_cache:
            cached_time, cached_data = self._popular_cache[key]
            if now - cached_time < 86400:  # 24 hours
                return cached_data

        if not self.api_key:
            res = self._generate_fallback_popular(city, language)
            self._popular_cache[key] = (now, res)
            return res

        prompt = build_popular_destination_prompt(city, language)
        try:
            raw_text = await self._invoke_model(
                prompt,
                system_inst="You are a destination travel guide. Return strict JSON."
            )
            parsed = self._extract_json(raw_text)
            if not isinstance(parsed, dict) or "top_attractions" not in parsed:
                raise ValueError("Malformed popular destination JSON")
            self._popular_cache[key] = (now, parsed)
            return parsed
        except Exception as exc:
            logger.warning("Gemini get_popular_destinations failed: %s. Using fallback.", exc)
            fallback = self._generate_fallback_popular(city, language)
            self._popular_cache[key] = (now, fallback)
            return fallback


_ai_service: Optional[BaseAIService] = None


def get_ai_service() -> BaseAIService:
    global _ai_service
    if _ai_service is None:
        _ai_service = GeminiAIService()
    return _ai_service
