import json
from datetime import datetime
from typing import Dict, Any, Optional

SYSTEM_PROMPT = """You are a world-class senior travel concierge and itinerary planner.
Your mission is to construct detailed, geographically optimized, realistic travel itineraries customized strictly according to the traveler's preferences.

CRITICAL RULES:
1. TITLE AND EXACT SEARCHABLE PLACE NAMES:
   - Every itinerary item title MUST strictly follow the format "Category Title: Exact Place Name" (e.g. "Morning Exploration: Charminar", "Midday Flavors: Laxmi Misthan Bhandar", "Evening Promenade: Marine Drive", "Heritage Stay: Taj Rambagh Palace").
   - Never use generic text like "a local cafe" or "famous temple". Always use the REAL, exact, searchable name of the venue or landmark.
   - Include the specific area/locality and accurate latitude/longitude coordinates (lat, lng) for every stop and recommendation.
2. GEOGRAPHIC PROXIMITY & TIME OPTIMIZATION: Order activities within each day by geographic proximity to minimize transit time. Cluster morning, afternoon, and evening stops within the same district or along a logical route.
3. TOTAL BUDGET & CURRENCY IN INR:
   - State all estimated costs and price ranges in Indian Rupees (₹), e.g. "₹500 per person", "₹2,500/night".
   - The sum of all activity, dining, and stay estimates across the trip must stay strictly within the traveler's total trip budget.
4. RECOMMENDATIONS (HOTELS & DINING):
   - Provide 3 hotel options (cheapest fit, best value, slight stretch up to +20%). Each has exact_name, area, lat, lng, price_range, tier, and a one-line reason. Prices must be within user comfort range.
   - Provide 5 dining recommendations across the trip with diverse cuisines, specifying meal_type (Breakfast/Lunch/Dinner) and best_fit_day (1, 2, ...).
   - STRICTLY respect all dietary restrictions (e.g., pure vegetarian, Jain, vegan, halal, gluten-free) in dining recommendations.
5. MULTI-LANGUAGE SCRIPT: When a target language other than English is requested, write all descriptions, tips, titles, themes, and reasons in that language. Keep all JSON keys in English. Keep place names identifiable in their original name plus a transliteration in the selected script when helpful.
6. STRICT JSON ONLY: Return strictly raw, valid JSON only. No markdown fences (no ```json), no conversation, no disclaimers.

JSON SCHEMA TO FOLLOW:
{
  "summary": "Inspiring overview of the trip experience",
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "theme": "Day Theme",
      "activities": [
        {
          "time": "09:00 AM - 11:30 AM",
          "title": "Category Title: Exact Place Name",
          "place_name": "Exact Searchable Venue/Landmark Name",
          "area": "Neighborhood or Locality",
          "lat": 26.9239,
          "lng": 75.8267,
          "category": "sightseeing",
          "description": "Vivid 2-3 sentence description tailored to vibe",
          "location": "Exact venue address or neighborhood",
          "estimated_cost": "₹500 per person",
          "travel_tip": "Insider advice for booking, timing, or viewpoints"
        }
      ]
    }
  ],
  "recommendations": {
    "hotels": [
      {
        "exact_name": "Exact Hotel Name",
        "area": "Neighborhood",
        "lat": 26.9124,
        "lng": 75.7873,
        "price_range": "₹2,500/night",
        "tier": "budget",
        "reason": "Why this matches budget and vibe"
      },
      {
        "exact_name": "Exact Hotel Name",
        "area": "Neighborhood",
        "lat": 26.9150,
        "lng": 75.7900,
        "price_range": "₹5,500/night",
        "tier": "mid-range",
        "reason": "Central location with comfortable amenities"
      },
      {
        "exact_name": "Exact Hotel Name",
        "area": "Neighborhood",
        "lat": 26.9200,
        "lng": 75.8100,
        "price_range": "₹14,000/night",
        "tier": "premium",
        "reason": "Heritage luxury experience"
      }
    ],
    "dining": [
      {
        "exact_name": "Exact Restaurant Name",
        "area": "Neighborhood",
        "lat": 26.9210,
        "lng": 75.8200,
        "price_range": "₹600 per person",
        "cuisine": "Rajasthani Traditional",
        "meal_type": "Lunch",
        "best_fit_day": 1,
        "reason": "Known for authentic dal baati churma, 100% vegetarian"
      }
    ]
  }
}
"""

PACE_DESCRIPTIONS = {
    "relaxed": "1-2 activities per day with generous rest, leisurely meals, and unhurried exploring.",
    "moderate": "2-3 activities per day with a balanced mix of iconic highlights and comfortable downtime.",
    "fast": "3-4 activities per day, maximizing time with a dynamic schedule constantly exploring top sights and hidden gems."
}

VIBE_INSTRUCTIONS = {
    "adventurous": "Adopt an energetic, thrilling tone. Prioritize open-air discoveries, scenic viewpoints, dynamic neighborhoods, and off-the-beaten-path gems.",
    "romantic": "Adopt an intimate, poetic tone. Prioritize panoramic vistas, enchanting strolls, atmospheric dinners, and scenic sunset spots.",
    "cultural": "Adopt an enriching, insightful tone. Prioritize historical landmarks, authentic heritage quarters, art institutions, architecture, and artisanal workshops.",
    "foodie": "Adopt an appetizing, culinary-focused tone. Prioritize bustling food markets, famous regional specialties, artisanal bakeries, and renowned dining spots.",
    "chill": "Adopt a laid-back, serene tone. Prioritize tranquil parks, leafy cafes, picturesque promenades, relaxed sightseeing, and zero-stress transit."
}

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi (हिंदी)",
    "gu": "Gujarati (ગુજરાતી)",
    "mr": "Marathi (मराठी)",
    "bn": "Bengali (বাংলা)",
    "ta": "Tamil (தமிழ்)",
    "te": "Telugu (తెలుగు)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "pa": "Punjabi (ਪੰਜਾਬੀ)",
}


def build_itinerary_prompt(trip_data: Dict[str, Any], tweaks: Optional[Dict[str, Any]] = None) -> str:
    """Builds a comprehensive prompt for Gemini AI based on user preferences and optional tweaks."""
    dest = trip_data.get("destination", "Unknown")
    start = trip_data.get("start_date", "")
    end = trip_data.get("end_date", "")
    style = tweaks.get("travel_style") if (tweaks and tweaks.get("travel_style")) else trip_data.get("travel_style", "Standard")
    pace = tweaks.get("pace") if (tweaks and tweaks.get("pace")) else trip_data.get("pace", "moderate")
    vibe = tweaks.get("vibe") if (tweaks and tweaks.get("vibe")) else trip_data.get("vibe", "chill")
    lang_code = tweaks.get("language") if (tweaks and tweaks.get("language")) else trip_data.get("language", "en")
    lang_name = LANGUAGE_NAMES.get(lang_code, lang_code)
    interests = trip_data.get("interests", [])
    group_size = trip_data.get("group_size", 1)
    dietary = trip_data.get("dietary_restrictions", [])
    mobility = trip_data.get("mobility_concerns")
    additional_notes = tweaks.get("notes") if tweaks else None
    origin = trip_data.get("origin")

    # Calculate number of days
    num_days = 3
    try:
        d1 = datetime.strptime(start, "%Y-%m-%d")
        d2 = datetime.strptime(end, "%Y-%m-%d")
        diff = (d2 - d1).days + 1
        if 1 <= diff <= 30:
            num_days = diff
    except Exception:
        pass

    total_budget = trip_data.get("total_budget")
    legacy_daily_budget = trip_data.get("budget_per_day", "₹3,000")
    if total_budget:
        daily_cap = max(1, round(float(total_budget) / num_days))
        budget_line = f"Total Trip Budget: ₹{int(total_budget)} INR. Daily Cap: ₹{int(daily_cap)} INR/day. Total estimated cost across all days must not exceed ₹{int(total_budget)}."
    else:
        budget_line = f"Target Daily Budget: {legacy_daily_budget} per person per day (currency: INR ₹)."

    stay_budget = trip_data.get("stay_budget_per_night")
    food_budget = trip_data.get("food_budget_per_meal")
    stay_type = trip_data.get("stay_type")
    diet = trip_data.get("diet")

    pace_desc = PACE_DESCRIPTIONS.get(pace, PACE_DESCRIPTIONS["moderate"])
    vibe_desc = VIBE_INSTRUCTIONS.get(vibe, f"Emphasize a {vibe} feel and select activities matching this spirit.")

    prompt_lines = [
        f"Generate a complete {num_days}-day itinerary for {dest}.",
        f"Trip Dates: {start} to {end} ({num_days} full days).",
        f"Party Size: {group_size} person(s).",
        f"Travel Style: {style}.",
        f"Key Interests: {', '.join(interests) if interests else 'Sightseeing, local heritage, food'}.",
        budget_line,
        f"Daily Pace: {pace.upper()} -> {pace_desc}",
        f"Vibe Tone: {vibe.upper()} -> {vibe_desc}",
        f"Output Language: {lang_name} ({lang_code}). Write descriptions, tips, and titles in {lang_name}, while keeping all JSON keys in English and preserving exact searchable venue names with transliteration.",
    ]

    if origin:
        prompt_lines.append(f"Trip Origin / Starting City: {origin}.")

    if stay_budget or stay_type:
        st = stay_type or "hotel"
        sb = f"₹{stay_budget}/night" if stay_budget else "budget-conscious"
        prompt_lines.append(f"Comfort Stay Preference: {st} within {sb}. Hotel options must be strictly within this tier/price.")

    if food_budget or diet:
        dt = diet or "any"
        fb = f"₹{food_budget}/meal" if food_budget else "reasonable"
        prompt_lines.append(f"Dining Preference: {dt} food within {fb} per meal per person.")

    if dietary:
        prompt_lines.append(f"STRICT Dietary Restrictions: {', '.join(dietary)}. You MUST recommend dining options strictly compliant with these restrictions.")

    if mobility:
        prompt_lines.append(f"Mobility Considerations: {mobility}. Ensure all selected locations are accessible, minimizing steep steps or exhaustive walking.")

    if additional_notes:
        prompt_lines.append(f"Specific Traveler Tweaks/Notes: {additional_notes}")

    prompt_lines.append(
        "\nIMPORTANT REQUIREMENTS:\n"
        f"- You must generate exactly {num_days} days (day 1 through day {num_days}).\n"
        "- Every itinerary item title MUST strictly follow 'Category Title: Exact Place Name' (e.g. 'Morning Exploration: Charminar', 'Evening Heritage: Chowmahalla Palace').\n"
        "- Every activity and recommendation MUST have an exact real place_name, area, and accurate lat/lng coordinates.\n"
        "- Order activities each day by geographic proximity to minimize travel time.\n"
        "- Include the 'recommendations' object with exactly 3 hotels (budget, mid-range, premium) and 5 dining spots.\n"
        "- Strictly output raw valid JSON matching the schema, with NO markdown code blocks or surrounding text."
    )

    return "\n".join(prompt_lines)


def build_recommendations_prompt(trip_data: Dict[str, Any], budget_prefs: Dict[str, Any]) -> str:
    """Prompt for generating only comfort-matched hotel and dining recommendations."""
    dest = trip_data.get("destination", "Destination")
    stay_budget = budget_prefs.get("stay_budget_per_night") or trip_data.get("stay_budget_per_night") or 2500
    food_budget = budget_prefs.get("food_budget_per_meal") or trip_data.get("food_budget_per_meal") or 400
    stay_type = budget_prefs.get("stay_type") or trip_data.get("stay_type") or "hotel"
    diet = budget_prefs.get("diet") or trip_data.get("diet") or "any"
    lang_code = budget_prefs.get("language") or trip_data.get("language") or "en"
    lang_name = LANGUAGE_NAMES.get(lang_code, lang_code)
    dietary_res = trip_data.get("dietary_restrictions", [])

    return (
        f"You are an expert travel accommodation and culinary concierge.\n"
        f"Generate customized hotel and dining recommendations for a trip to {dest} in {lang_name} ({lang_code}).\n\n"
        f"TRAVELER COMFORT BUDGET & PREFERENCES:\n"
        f"- Destination: {dest}\n"
        f"- Preferred Stay Type: {stay_type}\n"
        f"- Stay Budget per Night: ₹{stay_budget} INR\n"
        f"- Food Budget per Person per Meal: ₹{food_budget} INR\n"
        f"- Dietary Preference: {diet}. Specific dietary restrictions: {', '.join(dietary_res) if dietary_res else 'None'}.\n\n"
        "CRITICAL RULES:\n"
        f"1. Provide exactly 3 hotel options matching {stay_type}:\n"
        f"   - budget tier: cheapest fit strictly at or below ₹{stay_budget}/night\n"
        f"   - mid-range tier: best value close to ₹{stay_budget}/night\n"
        f"   - premium tier: slight stretch up to +20% (max ₹{round(float(stay_budget) * 1.2)}/night)\n"
        f"   Never suggest places above +20% of the user's budget. If the budget is low for the destination, recommend the cheapest real options with a helpful note.\n"
        f"2. Provide exactly 5 dining recommendations with varied cuisines, each priced at or below ₹{food_budget} per person per meal. Strictly respect {diet} and dietary restrictions.\n"
        f"3. Every hotel and dining spot must have exact real name, area, lat, and lng coordinates.\n"
        f"4. Titles must follow 'Category Title: Exact Place Name'.\n"
        "5. Output STRICT raw JSON only:\n"
        "{\n"
        '  "hotels": [\n'
        '    {"exact_name": "Hotel Name", "area": "Locality", "lat": 0.0, "lng": 0.0, "price_range": "₹2,500/night", "tier": "budget", "reason": "Why it fits"}\n'
        '  ],\n'
        '  "dining": [\n'
        '    {"exact_name": "Restaurant Name", "area": "Locality", "lat": 0.0, "lng": 0.0, "price_range": "₹400 per person", "cuisine": "Cuisine", "meal_type": "Dinner", "best_fit_day": 1, "reason": "Why it fits"}\n'
        '  ]\n'
        "}"
    )


def build_popular_destination_prompt(city: str, language: str = "en") -> str:
    """Prompt for popular attractions, foods, shops, and tips in a city."""
    lang_name = LANGUAGE_NAMES.get(language, language)
    return (
        f"You are an elite local travel guide and city expert.\n"
        f"Provide comprehensive, authentic recommendations for {city} in {lang_name} ({language}).\n\n"
        "CRITICAL REQUIREMENTS:\n"
        "1. Every item MUST have the real searchable name, locality/area, and accurate lat/lng coordinates.\n"
        "2. For must-try foods, specify the exact signature dish AND the exact renowned local eatery/place to try it!\n"
        "3. Include top attractions, must-try foods, shopping specialties, hidden gems, best time to visit, practical local tips, and typical daily cost range in INR.\n"
        "4. Return STRICT raw JSON only (no markdown, no conversation):\n"
        "{\n"
        f'  "city": "{city}",\n'
        f'  "language": "{language}",\n'
        '  "top_attractions": [\n'
        '    {"name": "Attraction Name", "area": "Locality", "lat": 0.0, "lng": 0.0, "description": "Why it is unmissable", "price_range": "₹300 entry", "best_time": "Morning"}\n'
        '  ],\n'
        '  "must_try_foods": [\n'
        '    {"name": "Eatery Name", "exact_dish": "Signature Dish", "area": "Locality", "lat": 0.0, "lng": 0.0, "description": "Famous for authentic taste", "price_range": "₹200 per portion"}\n'
        '  ],\n'
        '  "shopping_specialties": [\n'
        '    {"name": "Market / Artisan Place", "area": "Locality", "lat": 0.0, "lng": 0.0, "description": "Authentic local items to buy"}\n'
        '  ],\n'
        '  "hidden_gems": [\n'
        '    {"name": "Off-beat Place", "area": "Locality", "lat": 0.0, "lng": 0.0, "description": "Tranquil lesser-known spot"}\n'
        '  ],\n'
        '  "best_time_to_visit": "October to March",\n'
        '  "local_tips": ["Local tip 1", "Local tip 2"],\n'
        '  "daily_cost_range_inr": "₹1,500 - ₹4,000 per day"\n'
        "}"
    )


def build_translate_prompt(itinerary_data: Dict[str, Any], target_language: str) -> str:
    """Prompt for translating an existing itinerary into target_language without altering structure."""
    lang_name = LANGUAGE_NAMES.get(target_language, target_language)
    return (
        f"You are an expert travel translator. Translate the user-facing text fields of the following travel itinerary into {lang_name} ({target_language}).\n\n"
        "RULES:\n"
        f"1. Translate text in 'summary', 'theme', 'title', 'description', 'travel_tip', and 'reason' into {lang_name}.\n"
        "2. Keep exact place names recognizable (original name + transliteration in the target script if helpful).\n"
        "3. DO NOT CHANGE JSON structure, keys, day numbers, dates, times, estimated_cost, price_range, lat, lng, area, tier, meal_type, or categories.\n"
        "4. Return STRICT raw JSON only, with no markdown fences, no formatting tags, and no conversational text.\n\n"
        f"ITINERARY JSON TO TRANSLATE:\n{json.dumps(itinerary_data, ensure_ascii=False)}"
    )
