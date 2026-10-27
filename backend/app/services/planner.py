import math
import random
from typing import List, Dict, Any, Tuple, Optional

from app.services.places_pool import haversine_distance_m


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers."""
    return haversine_distance_m(lat1, lon1, lat2, lon2) / 1000.0


def cluster_places_kmeans(
    places: List[Dict[str, Any]],
    k: int,
    stops_per_day: int,
    seed: int = 42
) -> List[List[Dict[str, Any]]]:
    """
    Split candidate places into exactly k days using k-means with a fixed seed.
    Balancing: each cluster receives exactly stops_per_day places.
    Every place in the output is unique.
    """
    if len(places) < k * stops_per_day:
        raise ValueError(
            f"Insufficient candidate places: need at least {k * stops_per_day}, got {len(places)}"
        )

    rng = random.Random(seed)

    # Initialize k centroids using k-means++ style or spread sampling
    # Sort places by latitude and pick k evenly spaced initial centroids
    sorted_places = sorted(places, key=lambda p: (p["lat"], p["lng"]))
    step = len(sorted_places) // k
    centroids = [[sorted_places[i * step]["lat"], sorted_places[i * step]["lng"]] for i in range(k)]

    # Run up to 10 iterations of standard k-means
    assignments: List[List[Dict[str, Any]]] = [[] for _ in range(k)]
    for _ in range(10):
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

    # Balance clusters to exactly stops_per_day
    # Sort places in each cluster by distance to cluster centroid
    balanced: List[List[Dict[str, Any]]] = [[] for _ in range(k)]
    used_indices = set()

    # Step 1: Assign top closest places up to stops_per_day
    for c_idx in range(k):
        c_lat, c_lng = centroids[c_idx]
        sorted_in_cluster = sorted(
            assignments[c_idx],
            key=lambda p: (p["lat"] - c_lat) ** 2 + (p["lng"] - c_lng) ** 2
        )
        for p in sorted_in_cluster:
            p_id = (p["place_name"], p["lat"], p["lng"])
            if len(balanced[c_idx]) < stops_per_day and p_id not in used_indices:
                balanced[c_idx].append(p)
                used_indices.add(p_id)

    # Step 2: Fill under-populated clusters from remaining available pool places
    for c_idx in range(k):
        while len(balanced[c_idx]) < stops_per_day:
            c_lat, c_lng = centroids[c_idx]
            # Find best unused place closest to this centroid
            best_p = None
            best_d = float("inf")
            for p in places:
                p_id = (p["place_name"], p["lat"], p["lng"])
                if p_id not in used_indices:
                    d = (p["lat"] - c_lat) ** 2 + (p["lng"] - c_lng) ** 2
                    if d < best_d:
                        best_d = d
                        best_p = p
            if best_p is None:
                break
            p_id = (best_p["place_name"], best_p["lat"], best_p["lng"])
            balanced[c_idx].append(best_p)
            used_indices.add(p_id)

    # Assert uniqueness and exact counts
    all_assigned = [p["place_name"] for group in balanced for p in group]
    assert len(all_assigned) == k * stops_per_day, f"Expected {k * stops_per_day} stops, got {len(all_assigned)}"
    assert len(set(all_assigned)) == len(all_assigned), "Duplicate places found across clusters!"

    return balanced


def order_nearest_neighbor(stops: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Order stops using greedy nearest neighbor traversal."""
    if len(stops) <= 1:
        return list(stops)

    ordered = [stops[0]]
    remaining = stops[1:]

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
        return ["09:00 AM - 11:30 AM", "12:30 PM - 02:30 PM", "04:00 PM - 07:00 PM"]
    elif stops_count == 4:
        return ["08:30 AM - 10:30 AM", "11:00 AM - 01:00 PM", "02:30 PM - 05:00 PM", "06:00 PM - 08:30 PM"]
    else:
        # Generic progressive slots
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
        # Fallback to key place names
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
    Step 4 Budget Engine:
    Computes stay, food, transport, activities, and buffer.
    Applies the 5-step ladder if total > total_budget:
      (1) Clamp fees (max 50/item or free)
      (2) Drop highest-fee paid activity
      (3) Reduce food tier in 25% steps down to 100/meal
      (4) Reduce stay to cheapest tier (hostel/dormitory)
      (5) Switch transport to public/walking rates
    Guarantees sum(per_day_costs) == total_estimated_cost.
    """
    days_count = len(days_data)
    if days_count == 0:
        raise ValueError("Cannot calculate budget for empty days")

    if not total_budget or total_budget <= 0:
        raise ValueError("Total trip budget must be greater than 0")

    split = budget_split or {
        "stay": 40.0,
        "food": 25.0,
        "transport": 15.0,
        "activities": 15.0,
        "buffer": 5.0,
    }

    daily_cap = round(total_budget / days_count, 2)
    nights = max(1, days_count - 1)
    meals_per_day = 3

    # Default baseline costs
    stay_cap_per_night = (total_budget * (split.get("stay", 40.0) / 100.0)) / nights
    stay_per_night = round(stay_budget_per_night or stay_cap_per_night, 2)

    food_cap_per_meal = (total_budget * (split.get("food", 25.0) / 100.0)) / (days_count * meals_per_day * group_size)
    meal_price = round(food_budget_per_meal or food_cap_per_meal, 2)
    meal_price = max(100.0, meal_price)

    # Activity entry fees from places
    activity_fees: List[List[float]] = []
    for d in days_data:
        day_fees = []
        for a in d.get("activities", []):
            fee = a.get("entry_fee_inr", 0.0)
            day_fees.append(min(300.0, max(0.0, float(fee))))
        activity_fees.append(day_fees)

    # Transport distances
    transport_rate_per_km = 15.0  # Cab / Auto rate
    transport_min_fare = 50.0
    day_transit_km: List[float] = []
    for d in days_data:
        acts = d.get("activities", [])
        dist_km = 0.0
        for i in range(len(acts) - 1):
            dist_km += haversine_km(acts[i]["lat"], acts[i]["lng"], acts[i + 1]["lat"], acts[i + 1]["lng"])
        day_transit_km.append(max(2.0, round(dist_km, 2)))

    budget_notes: List[str] = []

    def compute_totals(
        s_price: float,
        m_price: float,
        act_f: List[List[float]],
        t_rate: float,
        t_min: float
    ) -> Tuple[float, float, float, float, float, float]:
        stay_tot = round(nights * s_price, 2)
        food_tot = round(days_count * meals_per_day * m_price * group_size, 2)
        act_tot = round(sum(sum(day) for day in act_f), 2)
        trans_tot = round(sum(max(t_min, km * t_rate) for km in day_transit_km), 2)
        buf_tot = round((total_budget * (split.get("buffer", 5.0) / 100.0)), 2)
        tot = round(stay_tot + food_tot + act_tot + trans_tot + buf_tot, 2)
        return tot, stay_tot, food_tot, trans_tot, act_tot, buf_tot

    total_cost, stay_total, food_total, trans_total, act_total, buf_total = compute_totals(
        stay_per_night, meal_price, activity_fees, transport_rate_per_km, transport_min_fare
    )

    # Ladder Step 1: Clamp fees if total > total_budget
    if total_cost > total_budget:
        activity_fees = [[min(50.0, f) for f in day] for day in activity_fees]
        budget_notes.append("Prioritized affordable entry fees and free heritage spots")
        total_cost, stay_total, food_total, trans_total, act_total, buf_total = compute_totals(
            stay_per_night, meal_price, activity_fees, transport_rate_per_km, transport_min_fare
        )

    # Ladder Step 2: Drop highest-fee paid activities down to ₹0 (free/community)
    if total_cost > total_budget:
        activity_fees = [[0.0 for _ in day] for day in activity_fees]
        budget_notes.append("Optimized schedule to focus exclusively on free public landmarks and walks")
        total_cost, stay_total, food_total, trans_total, act_total, buf_total = compute_totals(
            stay_per_night, meal_price, activity_fees, transport_rate_per_km, transport_min_fare
        )

    # Ladder Step 3: Reduce food tier in 25% steps down to ₹100 per meal
    while total_cost > total_budget and meal_price > 100.0:
        meal_price = max(100.0, round(meal_price * 0.75, 2))
        total_cost, stay_total, food_total, trans_total, act_total, buf_total = compute_totals(
            stay_per_night, meal_price, activity_fees, transport_rate_per_km, transport_min_fare
        )
        if "Adjusted dining to local street food, authentic dhabas, and budget thalis" not in budget_notes:
            budget_notes.append("Adjusted dining to local street food, authentic dhabas, and budget thalis")

    # Ladder Step 4: Reduce stay to cheapest tier (hostel / dormitory at ₹400-600/night)
    if total_cost > total_budget and stay_per_night > 500.0:
        stay_per_night = 500.0
        budget_notes.append("Selected budget traveler hostels and verified guesthouses")
        total_cost, stay_total, food_total, trans_total, act_total, buf_total = compute_totals(
            stay_per_night, meal_price, activity_fees, transport_rate_per_km, transport_min_fare
        )

    # Ladder Step 5: Switch transport to walking or public transport rates (₹5/km, min ₹20)
    if total_cost > total_budget and transport_rate_per_km > 5.0:
        transport_rate_per_km = 5.0
        transport_min_fare = 20.0
        budget_notes.append("Switched transit to walking routes and economical public metro/bus transit")
        total_cost, stay_total, food_total, trans_total, act_total, buf_total = compute_totals(
            stay_per_night, meal_price, activity_fees, transport_rate_per_km, transport_min_fare
        )

    within_budget = total_cost <= total_budget
    below_minimum = not within_budget
    minimum_required = total_cost if below_minimum else None

    if below_minimum:
        budget_notes.append(
            f"Trip total of ₹{total_cost:,.0f} requires a minimum budget of ₹{minimum_required:,.0f} for {days_count} days."
        )

    # Compute per-day costs guaranteeing exact sum equality
    stay_per_day = round(stay_total / days_count, 2)
    buf_per_day = round(buf_total / days_count, 2)
    food_day_cost = round(meals_per_day * meal_price * group_size, 2)

    per_day_costs: List[float] = []
    for d_idx in range(days_count):
        d_act_cost = sum(activity_fees[d_idx])
        d_trans_cost = max(transport_min_fare, day_transit_km[d_idx] * transport_rate_per_km)
        d_total = round(stay_per_day + food_day_cost + d_act_cost + d_trans_cost + buf_per_day, 2)
        per_day_costs.append(d_total)

    # Adjust rounding pennies on the last day to guarantee sum == total_cost exactly
    rounding_diff = round(total_cost - sum(per_day_costs), 2)
    if per_day_costs:
        per_day_costs[-1] = round(per_day_costs[-1] + rounding_diff, 2)

    # Update activities in days_data with adjusted fees and cost strings
    for d_idx, d in enumerate(days_data):
        d["day_cost"] = per_day_costs[d_idx]
        acts = d.get("activities", [])
        for a_idx, a in enumerate(acts):
            fee = activity_fees[d_idx][a_idx]
            a["entry_fee_inr"] = fee
            a["estimated_cost"] = f"₹{int(fee)}" if fee > 0 else "Free"

    remaining_budget = round(total_budget - total_cost, 2)

    return {
        "total_estimated_cost": total_cost,
        "total_budget": total_budget,
        "remaining_budget": remaining_budget,
        "within_budget": within_budget,
        "daily_cap": daily_cap,
        "per_day_costs": per_day_costs,
        "per_category_costs": {
            "stay": stay_total,
            "food": food_total,
            "transport": trans_total,
            "activities": act_total,
            "buffer": buf_total,
        },
        "budget_note": budget_notes,
        "below_minimum": below_minimum,
        "minimum_required": minimum_required,
    }
