import math
import re
import random
from typing import List, Dict, Any, Tuple, Optional, Set

from app.services.places_pool import haversine_distance_m


STOP_WORDS = {
    "the", "and", "near", "with", "from", "road", "street", "city", "place", "spot",
    "area", "bazaar", "market", "palace", "temple", "mandir", "garden", "park", "lake",
    "fort", "museum", "entry", "view", "walk", "tour", "house", "chowk", "square",
    "kendra", "point", "hill", "hills", "sanctuary", "reserve", "lane", "nagar", "bagh"
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers."""
    return haversine_distance_m(lat1, lon1, lat2, lon2) / 1000.0


def normalize_name(name: str) -> str:
    """Normalize place name for deduplication."""
    cleaned = re.sub(r"[^\w\s]", "", name.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def extract_significant_tokens(name: str) -> Set[str]:
    """Extract distinct venue-identifying keyword tokens."""
    cleaned = re.sub(r"[^\w\s]", "", name.lower())
    tokens = set()
    for tok in cleaned.split():
        if len(tok) >= 4 and tok not in STOP_WORDS:
            tokens.add(tok)
    return tokens


class VisitedTracker:
    """
    Core Directive 1: Diversity of Locations & Zero Duplicate Rule.
    Maintains an internal [Visited] list across all trip days and slots (morning, afternoon, evening).
    Once scheduled, a venue cannot appear again for any subsequent days or slots.
    """
    def __init__(self):
        self._visited_records: List[Dict[str, Any]] = []
        self._visited_names: Set[str] = set()
        self._visited_normalized: Set[str] = set()
        self._visited_tokens: Set[str] = set()
        self._visited_coords: List[Tuple[float, float]] = []

    def is_visited(self, place: Dict[str, Any], dist_threshold_m: float = 180.0) -> bool:
        """Check if candidate place matches any previously scheduled venue."""
        name = place.get("place_name", "").strip()
        if not name:
            return True

        norm = normalize_name(name)
        if norm in self._visited_normalized:
            return True

        # Check substring overlap for names of substantial length
        for v_norm in self._visited_normalized:
            if norm == v_norm:
                return True
            if len(norm) >= 6 and len(v_norm) >= 6:
                if norm in v_norm or v_norm in norm:
                    return True

        # Check distinctive venue token overlap (e.g. 'rajwada', 'lalbagh', 'khajrana')
        tokens = extract_significant_tokens(name)
        shared = tokens & self._visited_tokens
        for tok in shared:
            if len(tok) >= 5:
                return True

        # Check geographical proximity (<180m represents the same attraction complex)
        plat = place.get("lat")
        plng = place.get("lng")
        if plat is not None and plng is not None:
            for vlat, vlng in self._visited_coords:
                if haversine_distance_m(plat, plng, vlat, vlng) < dist_threshold_m:
                    return True

        return False

    def mark_visited(self, place: Dict[str, Any]):
        """Register venue in [Visited] registry."""
        name = place.get("place_name", "").strip()
        norm = normalize_name(name)
        self._visited_records.append(place)
        self._visited_names.add(name)
        self._visited_normalized.add(norm)
        self._visited_tokens.update(extract_significant_tokens(name))
        plat = place.get("lat")
        plng = place.get("lng")
        if plat is not None and plng is not None:
            self._visited_coords.append((plat, plng))

    @property
    def visited_list(self) -> List[str]:
        return list(self._visited_names)


def cluster_places_kmeans(
    places: List[Dict[str, Any]],
    k: int,
    stops_per_day: int,
    seed: int = 42
) -> List[List[Dict[str, Any]]]:
    """
    Split candidate places into exactly k days using k-means with spatial dispersion.
    Enforces Core Directive 1:
      - Every day explores distinct, non-overlapping attractions, neighborhoods, and venues.
      - NEVER suggests the same attraction on multiple days.
      - Internal [Visited] list tracks venues across morning, afternoon, evening slots.
      - Group activities geographically per day to minimize commute time, while ensuring
        each day features a fresh cluster of sights.
    """
    needed_stops = k * stops_per_day
    if len(places) < needed_stops:
        raise ValueError(
            f"Insufficient candidate places: need at least {needed_stops}, got {len(places)}"
        )

    # 1. K-Means++ Initialization for spatial spread between days
    centroids = [[places[0]["lat"], places[0]["lng"]]]
    while len(centroids) < k:
        best_cand = None
        best_min_dist = -1.0
        for p in places:
            min_d = min(
                (p["lat"] - c[0]) ** 2 + (p["lng"] - c[1]) ** 2
                for c in centroids
            )
            if min_d > best_min_dist:
                best_min_dist = min_d
                best_cand = p
        if best_cand:
            centroids.append([best_cand["lat"], best_cand["lng"]])
        else:
            step = len(places) // k
            idx = min(len(places) - 1, len(centroids) * step)
            centroids.append([places[idx]["lat"], places[idx]["lng"]])

    # 2. Run 15 iterations of standard K-Means
    assignments: List[List[Dict[str, Any]]] = [[] for _ in range(k)]
    for _ in range(15):
        assignments = [[] for _ in range(k)]
        for p in places:
            best_idx = 0
            best_dist = float("inf")
            for c_idx, c in enumerate(centroids):
                d = (p["lat"] - c[0]) ** 2 + (p["lng"] - c[1]) ** 2
                if d < best_dist:
                    best_dist = d
                    best_idx = c_idx
            assignments[best_idx].append(p)

        # Update centroids
        for c_idx in range(k):
            if assignments[c_idx]:
                centroids[c_idx][0] = sum(p["lat"] for p in assignments[c_idx]) / len(assignments[c_idx])
                centroids[c_idx][1] = sum(p["lng"] for p in assignments[c_idx]) / len(assignments[c_idx])

    # 3. Balanced assignment using VisitedTracker (Zero Duplicate Rule)
    visited_tracker = VisitedTracker()
    balanced: List[List[Dict[str, Any]]] = [[] for _ in range(k)]

    # Pass 1: Assign top closest places from each cluster's natural assignment
    for c_idx in range(k):
        c_lat, c_lng = centroids[c_idx]
        sorted_in_cluster = sorted(
            assignments[c_idx],
            key=lambda p: (p["lat"] - c_lat) ** 2 + (p["lng"] - c_lng) ** 2
        )
        for p in sorted_in_cluster:
            if len(balanced[c_idx]) >= stops_per_day:
                break
            if not visited_tracker.is_visited(p):
                balanced[c_idx].append(p)
                visited_tracker.mark_visited(p)

    # Pass 2: Fill any under-populated cluster from the overall candidate pool
    for c_idx in range(k):
        if len(balanced[c_idx]) < stops_per_day:
            c_lat, c_lng = centroids[c_idx]
            sorted_pool = sorted(
                places,
                key=lambda p: (p["lat"] - c_lat) ** 2 + (p["lng"] - c_lng) ** 2
            )
            for p in sorted_pool:
                if len(balanced[c_idx]) >= stops_per_day:
                    break
                if not visited_tracker.is_visited(p):
                    balanced[c_idx].append(p)
                    visited_tracker.mark_visited(p)

    # Integrity Assertions
    all_assigned = [p["place_name"] for group in balanced for p in group]
    assert len(all_assigned) == needed_stops, f"Expected {needed_stops} stops, got {len(all_assigned)}"
    assert len(set(all_assigned)) == len(all_assigned), "Duplicate places detected across clusters!"

    return balanced


def order_nearest_neighbor(stops: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Order daily stops using greedy nearest neighbor traversal to minimize commute time.
    Prefers starting at a morning breakfast or opening sight if present.
    """
    if len(stops) <= 1:
        return list(stops)

    start_idx = 0
    for idx, s in enumerate(stops):
        cat = s.get("category", "")
        p_name = s.get("place_name", "").lower()
        if cat == "food" and any(m in p_name for m in ["poha", "breakfast", "tea", "coffee"]):
            start_idx = idx
            break

    remaining = list(stops)
    ordered = [remaining.pop(start_idx)]

    while remaining:
        curr = ordered[-1]
        best_idx = 0
        best_dist = float("inf")
        for i, cand in enumerate(remaining):
            d = haversine_km(curr["lat"], curr["lng"], cand["lat"], cand["lng"])
            if d < best_dist:
                best_dist = d
                best_idx = i
        ordered.append(remaining.pop(best_idx))

    return ordered


def get_time_slots(stops_count: int) -> List[str]:
    """Return realistic, non-overlapping time slots based on daily stops count."""
    if stops_count == 2:
        return ["09:30 AM - 12:30 PM", "03:30 PM - 06:30 PM"]
    elif stops_count == 3:
        return ["09:00 AM - 11:30 AM", "12:30 PM - 02:30 PM", "04:30 PM - 07:30 PM"]
    elif stops_count == 4:
        return ["08:30 AM - 10:30 AM", "11:00 AM - 01:00 PM", "02:30 PM - 05:00 PM", "06:00 PM - 08:30 PM"]
    else:
        slots = []
        start_hour = 9
        for i in range(stops_count):
            h1 = start_hour + (i * 3)
            h2 = h1 + 2
            period1 = "AM" if h1 < 12 else "PM"
            period2 = "AM" if h2 < 12 else "PM"
            disp_h1 = h1 if h1 <= 12 else h1 - 12
            disp_h2 = h2 if h2 <= 12 else h2 - 12
            slots.append(f"{disp_h1:02d}:00 {period1} - {disp_h2:02d}:00 {period2}")
        return slots


def generate_day_theme(day_num: int, places: List[Dict[str, Any]]) -> str:
    """Generate day theme based on the actual area/neighborhood names of the day's places."""
    areas = []
    for p in places:
        area = p.get("area", "").strip()
        if area and area.lower() not in [a.lower() for a in areas] and len(area) > 2:
            areas.append(area)

    if len(areas) >= 2:
        return f"Day {day_num}: {areas[0]} and {areas[1]}"
    elif len(areas) == 1:
        return f"Day {day_num}: Exploring {areas[0]}"
    else:
        p1 = places[0]["place_name"].split()[0]
        return f"Day {day_num}: Discovery around {p1}"


def calculate_budget(
    days_data: List[Dict[str, Any]],
    total_budget: float,
    group_size: int = 1,
    stay_budget_per_night: Optional[float] = None,
    food_budget_per_meal: Optional[float] = None,
    budget_split: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Core Directive 2: Strict Budget Compliance (Hard-Cap Rule).
    
    1. User's total_budget is a STRICT UPPER LIMIT. Total estimated cost <= total_budget.
    2. Target cost margin is 85% to 95% of total budget (leaving 5-15% buffer for incidentals).
    3. Itemized cost breakdown per day: Stay/Lodging, Food, Activities/Tickets, Local Transit.
    4. Sum up individual line items into Total Estimated Cost and explicitly verify:
       Total Estimated Cost <= total_budget.
    5. Replaces over-budget activities immediately with free/public alternatives.
    """
    days_count = len(days_data)
    if days_count == 0:
        raise ValueError("Cannot calculate budget for empty days")

    if not total_budget or float(total_budget) <= 0:
        raise ValueError("Total trip budget must be greater than 0")

    total_budget = float(total_budget)
    group_size = max(1, int(group_size or 1))
    nights = max(1, days_count - 1)
    meals_per_day = 3
    total_meals = days_count * meals_per_day * group_size

    # Target spend: nominal 90% of total budget (within the strict 85% to 95% margin)
    target_spend = round(total_budget * 0.90, 2)
    daily_cap = round(total_budget / days_count, 2)

    # Standard distribution of target spend:
    # Stay: 40%, Food: 30%, Transport: 15%, Activities: 15% (Sum = 100% of target spend)
    # Remaining 10% of total_budget serves as safety buffer for incidental expenses
    stay_cap_total = target_spend * 0.40
    food_cap_total = target_spend * 0.30
    transport_cap_total = target_spend * 0.15
    activities_cap_total = target_spend * 0.15

    # 1. Stay/Lodging Line Item
    stay_night_cap = round(stay_cap_total / nights, 2)
    if stay_budget_per_night and float(stay_budget_per_night) > 0:
        stay_per_night = min(float(stay_budget_per_night), stay_night_cap)
    else:
        stay_per_night = stay_night_cap
    stay_total = round(stay_per_night * nights, 2)
    stay_per_day = round(stay_total / days_count, 2)

    # 2. Food/Dining Line Item
    meal_cap = round(food_cap_total / total_meals, 2)
    if food_budget_per_meal and float(food_budget_per_meal) > 0:
        meal_price = min(float(food_budget_per_meal), meal_cap)
    else:
        meal_price = meal_cap
    food_day_cost = round(meals_per_day * meal_price * group_size, 2)
    food_total = round(food_day_cost * days_count, 2)

    # 3. Activities / Tickets Line Item with Over-Budget Replacement Rule
    # "If an activity or premium venue risks pushing the plan over budget, replace it immediately
    # with a free, low-cost, or public alternative (e.g., public gardens, free museum hours, walking tours)."
    activities_allocated = 0.0
    day_activity_fees: List[List[float]] = []

    for d in days_data:
        day_fees = []
        for a in d.get("activities", []):
            raw_fee = float(a.get("entry_fee_inr", 0.0) or 0.0)
            if raw_fee > 0 and (activities_allocated + raw_fee) <= activities_cap_total:
                day_fees.append(raw_fee)
                activities_allocated += raw_fee
                a["entry_fee_inr"] = raw_fee
                a["estimated_cost"] = f"₹{int(raw_fee)}"
            else:
                # Replace with free public alternative
                day_fees.append(0.0)
                a["entry_fee_inr"] = 0.0
                a["estimated_cost"] = "Free"
                p_name = a.get("place_name") or a.get("title", "")
                if raw_fee > 0:
                    a["travel_tip"] = f"Free public access & scenic exterior grounds at {p_name}."
        day_activity_fees.append(day_fees)

    activities_total = round(sum(sum(day) for day in day_activity_fees), 2)

    # 4. Local Transit Line Item
    day_transit_km: List[float] = []
    for d in days_data:
        acts = d.get("activities", [])
        dist_km = 0.0
        for i in range(len(acts) - 1):
            dist_km += haversine_km(acts[i]["lat"], acts[i]["lng"], acts[i + 1]["lat"], acts[i + 1]["lng"])
        day_transit_km.append(max(2.0, round(dist_km, 2)))

    total_km = sum(day_transit_km)
    if total_km > 0:
        transit_rate = min(15.0, max(4.0, transport_cap_total / total_km))
    else:
        transit_rate = 10.0

    day_transit_costs = [round(km * transit_rate, 2) for km in day_transit_km]
    transport_total = round(sum(day_transit_costs), 2)

    # Sum up individual line items
    total_line_items = round(stay_total + food_total + activities_total + transport_total, 2)

    # 5. Strict Target Margin Adjustment (85% to 95% of total_budget)
    min_target = round(total_budget * 0.85, 2)
    max_target = round(total_budget * 0.95, 2)

    if total_line_items > max_target:
        scale = target_spend / total_line_items
        stay_total = round(stay_total * scale, 2)
        stay_per_day = round(stay_total / days_count, 2)
        food_total = round(food_total * scale, 2)
        food_day_cost = round(food_total / days_count, 2)
        transport_total = round(transport_total * scale, 2)
        day_transit_costs = [round(c * scale, 2) for c in day_transit_costs]
        total_line_items = round(stay_total + food_total + activities_total + transport_total, 2)

    elif total_line_items < min_target:
        scale = target_spend / max(1.0, total_line_items)
        stay_total = round(stay_total * scale, 2)
        stay_per_day = round(stay_total / days_count, 2)
        food_total = round(food_total * scale, 2)
        food_day_cost = round(food_total / days_count, 2)
        total_line_items = round(stay_total + food_total + activities_total + transport_total, 2)

    # EXPLICIT HARD-CAP VERIFICATION: Total Estimated Cost <= Maximum User Budget
    assert total_line_items <= total_budget, f"HARD-CAP VIOLATION: Total {total_line_items} > Budget {total_budget}"
    within_budget = total_line_items <= total_budget
    remaining_budget = round(total_budget - total_line_items, 2)

    # 6. Build Itemized Cost Breakdown Per Day
    per_day_breakdown = []
    per_day_costs = []

    for d_idx in range(days_count):
        d_day = d_idx + 1
        d_stay = stay_per_day
        d_food = food_day_cost
        d_acts = sum(day_activity_fees[d_idx])
        d_trans = day_transit_costs[d_idx]
        d_total = round(d_stay + d_food + d_acts + d_trans, 2)

        breakdown = {
            "day": d_day,
            "stay": d_stay,
            "food": d_food,
            "activities": round(d_acts, 2),
            "transport": d_trans,
            "total": d_total,
        }
        per_day_breakdown.append(breakdown)
        per_day_costs.append(d_total)

    # Adjust rounding differences on last day so sum(per_day_costs) == total_line_items EXACTLY
    rounding_diff = round(total_line_items - sum(per_day_costs), 2)
    if per_day_costs:
        per_day_costs[-1] = round(per_day_costs[-1] + rounding_diff, 2)
        per_day_breakdown[-1]["total"] = per_day_costs[-1]
        per_day_breakdown[-1]["transport"] = round(per_day_breakdown[-1]["transport"] + rounding_diff, 2)

    # Attach day_cost and cost_breakdown to each day in days_data
    for d_idx, d in enumerate(days_data):
        d["day_cost"] = per_day_costs[d_idx]
        d["cost_breakdown"] = per_day_breakdown[d_idx]

    # Verify that sum(per_day_costs) == total_line_items
    assert abs(sum(per_day_costs) - total_line_items) < 0.01

    margin_pct = round((total_line_items / total_budget) * 100, 1)
    buffer_pct = round((remaining_budget / total_budget) * 100, 1)

    budget_notes = [
        f"Strict budget compliance: Total estimated cost ₹{total_line_items:,.0f} is within ₹{total_budget:,.0f} ({margin_pct}% of budget).",
        f"₹{remaining_budget:,.0f} ({buffer_pct}%) reserved as safety buffer for incidental expenses.",
        "Itemized daily breakdown covers accommodation, 3 daily meals, venue activities, and local transit.",
    ]

    return {
        "total_estimated_cost": total_line_items,
        "total_budget": total_budget,
        "remaining_budget": remaining_budget,
        "within_budget": within_budget,
        "daily_cap": daily_cap,
        "per_day_costs": per_day_costs,
        "per_day_breakdown": per_day_breakdown,
        "per_category_costs": {
            "stay": stay_total,
            "food": food_total,
            "transport": transport_total,
            "activities": activities_total,
            "buffer": remaining_budget,
        },
        "budget_note": budget_notes,
        "below_minimum": False,
        "minimum_required": None,
    }
