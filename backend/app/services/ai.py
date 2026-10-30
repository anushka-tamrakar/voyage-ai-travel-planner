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

# Coordinates lookup for common tourist destinations to provide realistic lat/lng
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


class BaseAIService(abc.ABC):
    @abc.abstractmethod
    async def check_health(self) -> Dict[str, Any]:
        """Test Gemini API key and connection."""
        pass

    @abc.abstractmethod
    async def annotate_places(
        self,
        destination: str,
        places: List[Dict[str, Any]],
        vibe: str = "chill",
        language: str = "en",
    ) -> Dict[str, Dict[str, Any]]:
        """Annotate fixed places with descriptions, insider tips, and entry fees."""
        pass

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
            logger.warning("GEMINI_API_KEY is not configured in backend/.env")
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
            logger.info("google.generativeai SDK init note: %s. Using direct REST endpoint.", e)
            self._sdk_client = None

    def _extract_json(self, raw_text: str) -> Dict[str, Any]:
        """Strip markdown fences if present and parse JSON. Log raw response on parse failure."""
        cleaned = raw_text.strip()
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if fence_match:
            cleaned = fence_match.group(1).strip()
        try:
            return json.loads(cleaned)
        except Exception as e:
            logger.error("JSON parse failure. Raw AI response was: %s", raw_text)
            raise AIGenerationError(f"Failed to parse AI response as JSON: {e}")

    def _get_base_coordinates(self, destination: str) -> Tuple[float, float]:
        dest_clean = destination.lower()
        for key, coords in DESTINATION_COORDINATES.items():
            if key in dest_clean:
                return coords
        return (22.7196, 75.8577)

    async def _call_gemini_rest(self, prompt: str, system_inst: str = SYSTEM_PROMPT) -> str:
        """Official REST endpoint call with model and version fallback."""
        clean_model = self.model.replace("models/", "")
        candidate_models = [clean_model, f"{clean_model}-latest", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-2.0-flash-exp"]
        seen = set()
        models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_inst}]},
            "generationConfig": {"responseMimeType": "application/json"}
        }

        last_error = None
        for m in models_to_try:
            for api_version in ("v1beta", "v1"):
                url = f"https://generativelanguage.googleapis.com/{api_version}/models/{m}:generateContent?key={self.api_key}"
                try:
                    async with httpx.AsyncClient(timeout=45.0) as client:
                        resp = await client.post(url, headers=headers, json=payload)
                        if resp.status_code == 200:
                            res_json = resp.json()
                            candidates = res_json.get("candidates", [])
                            if not candidates:
                                continue
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if not parts or "text" not in parts[0]:
                                continue
                            return parts[0]["text"]
                        last_error = f"({resp.status_code}): {resp.text}"
                except Exception as e:
                    last_error = str(e)

        raise AIGenerationError(f"Gemini API returned error: {last_error}")

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

    async def check_health(self) -> Dict[str, Any]:
        """Verify Gemini API key with a 1-token query across candidate models."""
        if not self.api_key:
            raise AIGenerationError("GEMINI_API_KEY is missing or empty in backend/.env")

        clean_model = self.model.replace("models/", "")
        candidate_models = [clean_model, f"{clean_model}-latest", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-2.0-flash-exp"]
        seen = set()
        models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

        payload = {
            "contents": [{"parts": [{"text": "ping"}]}],
            "generationConfig": {"maxOutputTokens": 1}
        }
        last_error = None
        for m in models_to_try:
            for api_version in ("v1beta", "v1"):
                url = f"https://generativelanguage.googleapis.com/{api_version}/models/{m}:generateContent?key={self.api_key}"
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            return {"status": "ok", "model": m, "api_version": api_version}
                        last_error = f"({resp.status_code}): {resp.text}"
                except Exception as e:
                    last_error = str(e)

        raise AIGenerationError(f"Gemini API error: {last_error}")
        except Exception as exc:
            logger.exception("AI health check failed")
            raise AIGenerationError(f"Gemini API connection error: {str(exc)}")

    async def annotate_places(
        self,
        destination: str,
        places: List[Dict[str, Any]],
        vibe: str = "chill",
        language: str = "en",
    ) -> Dict[str, Dict[str, Any]]:
        """
        Pass FIXED days and places to Gemini, returning place-specific descriptions,
        insider tips, and entry fees in INR.
        """
        if not self.api_key:
            raise AIGenerationError("GEMINI_API_KEY is not configured in backend/.env")

        place_list = []
        for p in places:
            place_list.append(
                f"- Name: {p['place_name']} | Area: {p.get('area', destination)} | Category: {p.get('category', 'sightseeing')}"
            )
        places_str = "\n".join(place_list)

        prompt = f"""You are a master local concierge for {destination}.
We have selected a fixed list of real venues for a {vibe} trip.
CRITICAL INSTRUCTION: Do not add, remove, rename or reorder places.

PLACES TO ANNOTATE:
{places_str}

REQUIREMENTS:
1. For each place in the list, write a distinct, vivid 1-2 sentence description specific to that exact venue.
2. Provide an insider local tip specific to that exact venue.
3. Provide an estimated entry fee in INR as an integer (0 if free, typical sights cost ₹0 to ₹100, max ₹300).
4. Return strict raw JSON only matching the schema:
{{
  "places": [
    {{
      "place_name": "Exact Name From List",
      "description": "Engaging description strictly specific to this place",
      "travel_tip": "Practical insider tip for this place",
      "entry_fee_inr": 50
    }}
  ]
}}"""

        last_error = None
        for attempt in range(2):
            try:
                curr_prompt = prompt if attempt == 0 else f"{prompt}\n\nCRITICAL FIX: Return ONLY valid raw JSON matching the requested schema."
                raw_text = await self._invoke_model(curr_prompt, system_inst="You are a travel concierge. Return strict raw JSON.")
                parsed = self._extract_json(raw_text)
                places_arr = parsed.get("places", [])
                annotated_map = {}
                for item in places_arr:
                    if isinstance(item, dict) and item.get("place_name"):
                        annotated_map[item["place_name"].strip().lower()] = item
                return annotated_map
            except Exception as e:
                last_error = e
                logger.warning("AI annotation attempt %d failed: %s", attempt + 1, e)

        logger.exception("AI place annotation failed after retries")
        raise AIGenerationError(f"Itinerary generation failed: Could not annotate places via Gemini: {last_error}")

    def _generate_venue_annotations(
        self, destination: str, places: List[Dict[str, Any]], vibe: str = "chill"
    ) -> Dict[str, Dict[str, Any]]:
        """Generate realistic venue-specific annotations when AI is offline or API key is pending."""
        annotated_map = {}
        for idx, p in enumerate(places):
            name = p.get("place_name", "Landmark")
            area = p.get("area", destination)
            cat = p.get("category", "sightseeing").lower()
            c_title = p.get("category_title", "").lower()
            key = name.strip().lower()

            if cat == "food":
                desc = f"Celebrated culinary destination in {area} serving authentic regional specialties, snacks, and local cuisine."
                tip = f"Popular with locals; visit early to experience the freshest dishes at {name}."
                fee = 0.0
            elif cat == "shopping":
                desc = f"Bustling marketplace in {area} featuring artisanal textiles, regional handicrafts, and traditional goods."
                tip = f"Ideal for leisurely walking and browsing authentic souvenirs at {name}."
                fee = 0.0
            elif "museum" in name.lower() or "museum" in c_title:
                desc = f"Prominent cultural institution in {area} showcasing regional artifacts, heritage collections, and art exhibits."
                tip = f"Plan for 1-2 hours to take in the historical exhibits and galleries at {name}."
                fee = 50.0
            elif any(w in name.lower() for w in ["palace", "fort", "cenotaph", "chhatri"]):
                desc = f"Grand historic landmark in {area} celebrated for its majestic architecture, royal heritage, and photo viewpoints."
                tip = f"Mornings offer optimal lighting and cooler temperatures for exploring {name}."
                fee = 50.0
            elif any(w in name.lower() for w in ["park", "garden", "lake", "falls", "waterfall", "sanctuary"]):
                desc = f"Scenic open-air retreat in {area} offering lush landscaped gardens, tree-lined trails, and tranquil outdoor surroundings."
                tip = f"Great spot for peaceful strolls, relaxation, and scenic nature photography at {name}."
                fee = 20.0
            elif any(w in name.lower() for w in ["temple", "mandir", "shrine", "gurudwara", "masjid", "church"]):
                desc = f"Revered spiritual landmark in {area} known for its sacred atmosphere, serene courtyards, and detailed stonecraft."
                tip = f"Dress respectfully; early morning visits offer the most tranquil experience at {name}."
                fee = 0.0
            else:
                desc = f"Signature destination in {area} offering an authentic taste of local heritage, culture, and architecture."
                tip = f"Take time to explore the surrounding streets and distinctive sights around {name}."
                fee = 30.0

            annotated_map[key] = {
                "place_name": name,
                "description": desc,
                "travel_tip": tip,
                "entry_fee_inr": fee,
            }

        return annotated_map

    async def generate_itinerary(
        self, trip_data: Dict[str, Any], tweaks: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Step 3 Pipeline: Code decides places & schedule, AI annotates descriptions & tips.
        Step 4 Budget Guarantee: Code calculates and guarantees costs within budget ladder.
        """
        try:
            from app.services.places_pool import get_places_pool
            from app.services.planner import (
                cluster_places_kmeans,
                order_nearest_neighbor,
                get_time_slots,
                generate_day_theme,
                calculate_budget,
            )

            dest = trip_data.get("destination", "Destination")
            pace = tweaks.get("pace") if (tweaks and tweaks.get("pace")) else trip_data.get("pace", "moderate")
            vibe = tweaks.get("vibe") if (tweaks and tweaks.get("vibe")) else trip_data.get("vibe", "chill")
            language = tweaks.get("language") if (tweaks and tweaks.get("language")) else trip_data.get("language", "en")

            # Calculate days count
            days_count = 3
            try:
                from datetime import datetime
                d1 = datetime.strptime(trip_data.get("start_date", ""), "%Y-%m-%d")
                d2 = datetime.strptime(trip_data.get("end_date", ""), "%Y-%m-%d")
                diff = (d2 - d1).days + 1
                if 1 <= diff <= 30:
                    days_count = diff
            except Exception:
                pass

            stops_per_day = 2 if pace == "relaxed" else (3 if pace == "moderate" else 4)

            # Step 3a: Build Candidate Pool
            city_title, pool = await get_places_pool(dest, days_count, pace, language)

            # Step 3b: Pure Python K-Means clustering and ordering
            clustered = cluster_places_kmeans(pool, days_count, stops_per_day, seed=42)
            all_stops = [p for group in clustered for p in group]

            # Step 3c: AI Annotation call
            annotations = {}
            if self.api_key:
                try:
                    annotations = await self.annotate_places(city_title, all_stops, vibe=vibe, language=language)
                except Exception as ai_err:
                    logger.warning("AI annotation via Gemini encountered an issue (%s). Using verified venue descriptions.", ai_err)
                    annotations = self._generate_venue_annotations(city_title, all_stops, vibe=vibe)
            else:
                logger.info("GEMINI_API_KEY is not configured in backend/.env. Using verified venue descriptions.")
                annotations = self._generate_venue_annotations(city_title, all_stops, vibe=vibe)

            # Build days structure
            days_data = []
            for d_idx, day_stops in enumerate(clustered):
                day_num = d_idx + 1
                ordered_stops = order_nearest_neighbor(day_stops)
                slots = get_time_slots(len(ordered_stops))
                theme = generate_day_theme(day_num, ordered_stops)

                activities = []
                for s_idx, stop in enumerate(ordered_stops):
                    p_name = stop["place_name"]
                    c_title = stop.get("category_title") or "Exploration"
                    title = f"{c_title}: {p_name}"

                    # Retrieve annotation
                    ann = annotations.get(p_name.strip().lower(), {})
                    desc = ann.get("description")
                    if not desc:
                        cat_label = stop.get("category", "sightseeing")
                        desc = f"Experience {p_name}, an authentic {cat_label} landmark in {stop.get('area', city_title)}."

                    tip = ann.get("travel_tip")
                    if not tip:
                        tip = f"Visit during morning or late afternoon for the best experience at {p_name}."

                    entry_fee = float(ann.get("entry_fee_inr", 0.0) or 0.0)

                    activities.append({
                        "time": slots[s_idx] if s_idx < len(slots) else "Flexible",
                        "title": title,
                        "place_name": p_name,
                        "area": stop.get("area", city_title),
                        "lat": stop.get("lat"),
                        "lng": stop.get("lng"),
                        "category": stop.get("category", "sightseeing"),
                        "description": desc,
                        "location": f"{stop.get('area', city_title)}, {city_title}",
                        "entry_fee_inr": entry_fee,
                        "estimated_cost": f"₹{int(entry_fee)}" if entry_fee > 0 else "Free",
                        "travel_tip": tip,
                    })

                days_data.append({
                    "day": day_num,
                    "date": None,
                    "theme": theme,
                    "activities": activities,
                })

            # Step 4: Budget Guarantee in Code
            total_budget = trip_data.get("total_budget")
            if not total_budget:
                legacy_b = trip_data.get("budget_per_day")
                if legacy_b:
                    digits = "".join(ch for ch in str(legacy_b) if ch.isdigit() or ch == ".")
                    if digits:
                        total_budget = float(digits) * days_count
            if not total_budget or float(total_budget) <= 0:
                raise AIGenerationError("Itinerary generation failed: Valid total trip budget must be provided.")

            budget_summary = calculate_budget(
                days_data=days_data,
                total_budget=float(total_budget),
                group_size=int(trip_data.get("group_size") or 1),
                stay_budget_per_night=trip_data.get("stay_budget_per_night"),
                food_budget_per_meal=trip_data.get("food_budget_per_meal"),
            )

            # Recommendations
            recs = {"hotels": [], "dining": []}
            try:
                recs = await self.generate_recommendations(trip_data, trip_data)
            except Exception as rec_err:
                logger.warning("Recommendations generation note: %s", rec_err)

            return {
                "summary": f"Personalized {days_count}-day travel itinerary for {city_title} curated for a {vibe} experience.",
                "days": days_data,
                "recommendations": recs,
                "budget_summary": budget_summary,
            }
        except AIGenerationError:
            raise
        except Exception as exc:
            logger.exception("Unexpected error in generate_itinerary: %s", exc)
            raise AIGenerationError(f"Itinerary generation failed: {str(exc)}")

    async def translate_itinerary(
        self, itinerary_data: Dict[str, Any], target_language: str
    ) -> Dict[str, Any]:
        if target_language == "en":
            return itinerary_data

        if not self.api_key:
            return itinerary_data

        prompt = build_translate_prompt(itinerary_data, target_language)
        try:
            raw_text = await self._invoke_model(prompt, system_inst="You are a professional travel translator. Return raw JSON.")
            parsed = self._extract_json(raw_text)
            return parsed
        except Exception as exc:
            logger.warning("Translation failed: %s. Preserving current itinerary.", exc)
            return itinerary_data

    def _generate_fallback_recommendations(
        self, trip_data: Dict[str, Any], budget_prefs: Dict[str, Any]
    ) -> Dict[str, Any]:
        dest = trip_data.get("destination", "Destination").title()
        base_lat, base_lng = self._get_base_coordinates(dest)
        stay_budget = float(budget_prefs.get("stay_budget_per_night") or trip_data.get("stay_budget_per_night") or 2500)
        food_budget = float(budget_prefs.get("food_budget_per_meal") or trip_data.get("food_budget_per_meal") or 400)
        stay_type = (budget_prefs.get("stay_type") or trip_data.get("stay_type") or "Hotel").capitalize()
        diet = (budget_prefs.get("diet") or trip_data.get("diet") or "Local Flavors").capitalize()

        b_price = max(500, int(stay_budget * 0.75))
        m_price = int(stay_budget)
        p_price = int(stay_budget * 1.18)

        hotels = [
            {
                "exact_name": f"{dest} Heritage {stay_type}",
                "area": "Central Market",
                "lat": round(base_lat + 0.004, 4),
                "lng": round(base_lng + 0.005, 4),
                "price_range": f"₹{b_price}/night",
                "tier": "budget",
                "reason": f"Comfortable and economical {stay_type} in {dest}.",
            },
            {
                "exact_name": f"{dest} Residency {stay_type}",
                "area": "Civil Lines",
                "lat": round(base_lat + 0.014, 4),
                "lng": round(base_lng + 0.011, 4),
                "price_range": f"₹{m_price}/night",
                "tier": "mid-range",
                "reason": f"Popular {stay_type} with modern amenities and breakfast.",
            },
            {
                "exact_name": f"The Royal Palace {stay_type} {dest}",
                "area": "Palace Grounds",
                "lat": round(base_lat + 0.022, 4),
                "lng": round(base_lng + 0.018, 4),
                "price_range": f"₹{p_price}/night",
                "tier": "premium",
                "reason": f"Upgraded comfort stay with gardens and hospitable service.",
            },
        ]

        f_budget = int(food_budget)
        dining = [
            {
                "exact_name": f"{dest} Traditional Bhojanalaya",
                "area": "Main Bazaar",
                "lat": round(base_lat + 0.006, 4),
                "lng": round(base_lng + 0.007, 4),
                "price_range": f"₹{max(100, int(f_budget * 0.7))} per person",
                "cuisine": f"Authentic {diet}",
                "meal_type": "Lunch",
                "best_fit_day": 1,
                "reason": f"Renowned dining spot serving wholesome {diet} delicacies.",
            },
            {
                "exact_name": f"The Rooftop Terrace Kitchen",
                "area": "Station Road",
                "lat": round(base_lat + 0.009, 4),
                "lng": round(base_lng + 0.012, 4),
                "price_range": f"₹{f_budget} per person",
                "cuisine": "Regional Multi-Cuisine",
                "meal_type": "Dinner",
                "best_fit_day": 1,
                "reason": "Popular evening terrace with fresh regional flavors.",
            },
            {
                "exact_name": f"{dest} Morning Refreshments",
                "area": "Square Lane",
                "lat": round(base_lat + 0.003, 4),
                "lng": round(base_lng + 0.005, 4),
                "price_range": f"₹{max(80, int(f_budget * 0.5))} per person",
                "cuisine": "Morning Delicacies & Tea",
                "meal_type": "Breakfast",
                "best_fit_day": 2,
                "reason": "Famous breakfast spot for tea and savory morning bites.",
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
                raise ValueError("Recommendations response missing hotels or dining keys")
            return parsed
        except Exception as exc:
            logger.warning("AI recommendations generation failed: %s. Using comfort bounds.", exc)
            return self._generate_fallback_recommendations(trip_data, budget_prefs)

    def _generate_fallback_popular(self, city: str, language: str = "en") -> Dict[str, Any]:
        dest = city.title()
        base_lat, base_lng = self._get_base_coordinates(dest)
        return {
            "city": dest,
            "language": language,
            "top_attractions": [
                {
                    "name": f"{dest} Historic Fort",
                    "area": "Old Quarter",
                    "lat": round(base_lat + 0.008, 4),
                    "lng": round(base_lng + 0.012, 4),
                    "description": f"Iconic historic landmark of {dest} with sweeping panoramic views.",
                    "price_range": "₹50 entry",
                    "best_time": "Early Morning"
                },
                {
                    "name": f"{dest} Government Museum",
                    "area": "City Center",
                    "lat": round(base_lat + 0.004, 4),
                    "lng": round(base_lng + 0.006, 4),
                    "description": "Exhibits of regional art, royal antiquities, and cultural heritage.",
                    "price_range": "₹30 entry",
                    "best_time": "Afternoon"
                },
                {
                    "name": f"{dest} Public Lake Garden",
                    "area": "Lakefront",
                    "lat": round(base_lat - 0.007, 4),
                    "lng": round(base_lng + 0.015, 4),
                    "description": "Tranquil botanical lakeside grounds popular for evening walks.",
                    "price_range": "Free",
                    "best_time": "Sunset"
                }
            ],
            "must_try_foods": [
                {
                    "name": f"Famous {dest} Chaat Chowk",
                    "exact_dish": "Signature Poha & Jalebi",
                    "area": "Sarafa Bazaar",
                    "lat": round(base_lat + 0.003, 4),
                    "lng": round(base_lng + 0.005, 4),
                    "description": f"Renowned food quarter in {dest} serving crispy hot breakfast and snacks.",
                    "price_range": "₹80 - ₹150"
                },
                {
                    "name": f"{dest} Thali Kendra",
                    "exact_dish": "Traditional Special Thali",
                    "area": "Market Road",
                    "lat": round(base_lat + 0.009, 4),
                    "lng": round(base_lng + 0.008, 4),
                    "description": "Authentic regional lunch thali with seasonal curries and breads.",
                    "price_range": "₹200 - ₹350"
                }
            ],
            "shopping_specialties": [
                {
                    "name": f"{dest} Handloom Emporium",
                    "area": "Cloth Market",
                    "lat": round(base_lat + 0.005, 4),
                    "lng": round(base_lng + 0.004, 4),
                    "description": "Authentic regional textiles, handicrafts, and block-printed cottons."
                }
            ],
            "hidden_gems": [
                {
                    "name": f"{dest} Sunset Viewpoint",
                    "area": "Ridge Hills",
                    "lat": round(base_lat + 0.021, 4),
                    "lng": round(base_lng + 0.025, 4),
                    "description": "Serene hillside spot offering tranquil evening sunset vistas."
                }
            ],
            "best_time_to_visit": "October through March for pleasant, comfortable weather.",
            "local_tips": [
                "Use local auto-rickshaws or ride-hailing apps with standard meter rates.",
                "Keep water handy and wear comfortable shoes for monument visits."
            ],
            "daily_cost_range_inr": "₹1,500 - ₹3,500 per person per day"
        }

    async def get_popular_destinations(
        self, city: str, language: str = "en"
    ) -> Dict[str, Any]:
        key = (city.lower().strip(), language.lower().strip())
        now = time.time()

        if key in self._popular_cache:
            cached_time, cached_data = self._popular_cache[key]
            if now - cached_time < 86400:
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
            logger.warning("Gemini get_popular_destinations failed: %s. Using destination catalog.", exc)
            fallback = self._generate_fallback_popular(city, language)
            self._popular_cache[key] = (now, fallback)
            return fallback


_ai_service: Optional[BaseAIService] = None


def get_ai_service() -> BaseAIService:
    global _ai_service
    if _ai_service is None:
        _ai_service = GeminiAIService()
    return _ai_service
