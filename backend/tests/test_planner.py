import os
import sys
import unittest

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.planner import (
    cluster_places_kmeans,
    order_nearest_neighbor,
    get_time_slots,
    generate_day_theme,
    calculate_budget,
)

FAKE_INDORE_PLACES = [
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
]


def fake_ai_annotate(places):
    """Generate unique descriptions, tips, and fees per place."""
    annotations = {}
    for idx, p in enumerate(places):
        name = p["place_name"]
        area = p.get("area", "Indore")
        cat = p.get("category", "sightseeing")
        annotations[name.lower()] = {
            "description": f"Unique exploration of {name} offering distinctive {cat} insights situated in {area} (id-{idx}).",
            "travel_tip": f"Recommended insider tip {idx + 1} for visiting {name} in {area}.",
            "entry_fee_inr": (idx % 4) * 20.0,  # 0, 20, 40, 60
        }
    return annotations


class TestPlanner(unittest.TestCase):
    def run_pipeline_for_scenario(self, days: int, pace: str, total_budget: float):
        stops_per_day = 2 if pace == "relaxed" else (3 if pace == "moderate" else 4)

        # 1. Cluster places
        clustered = cluster_places_kmeans(FAKE_INDORE_PLACES, days, stops_per_day, seed=42)

        # Verify cluster count and sizes
        self.assertEqual(len(clustered), days)
        for d in clustered:
            self.assertEqual(len(d), stops_per_day)

        all_stops = [p for group in clustered for p in group]
        place_names = [p["place_name"] for p in all_stops]

        # Assert no place appears twice across the days
        self.assertEqual(len(place_names), len(set(place_names)), "Duplicate places found across trip days!")

        # 2. Annotate with fake AI
        annotations = fake_ai_annotate(all_stops)

        # 3. Build days data
        days_data = []
        all_titles = []
        all_descriptions = []

        for d_idx, day_stops in enumerate(clustered):
            day_num = d_idx + 1
            ordered_stops = order_nearest_neighbor(day_stops)
            slots = get_time_slots(len(ordered_stops))
            theme = generate_day_theme(day_num, ordered_stops)

            # Assert theme does not contain "Best of"
            self.assertNotIn("Best of", theme, f"Day theme contains 'Best of': {theme}")

            activities = []
            for s_idx, stop in enumerate(ordered_stops):
                p_name = stop["place_name"]
                c_title = stop.get("category_title", "Highlight")
                title = f"{c_title}: {p_name}"

                # Assert title does not contain "(Day"
                self.assertNotIn("(Day", title, f"Title contains '(Day': {title}")

                ann = annotations.get(p_name.lower(), {})
                desc = ann.get("description", f"Description of {p_name}")
                fee = float(ann.get("entry_fee_inr", 0.0))

                all_titles.append(title)
                all_descriptions.append(desc)

                activities.append({
                    "time": slots[s_idx] if s_idx < len(slots) else "Flexible",
                    "title": title,
                    "place_name": p_name,
                    "area": stop.get("area"),
                    "lat": stop.get("lat"),
                    "lng": stop.get("lng"),
                    "category": stop.get("category"),
                    "description": desc,
                    "entry_fee_inr": fee,
                    "estimated_cost": f"₹{int(fee)}" if fee > 0 else "Free",
                    "travel_tip": ann.get("travel_tip", "Tip"),
                })

            days_data.append({
                "day": day_num,
                "theme": theme,
                "activities": activities,
            })

        # Assert no two titles or descriptions are identical
        self.assertEqual(len(all_titles), len(set(all_titles)), "Duplicate activity titles found!")
        self.assertEqual(len(all_descriptions), len(set(all_descriptions)), "Duplicate descriptions found!")

        # 4. Calculate budget
        b_summary = calculate_budget(
            days_data=days_data,
            total_budget=total_budget,
            group_size=1,
        )

        total_est = b_summary["total_estimated_cost"]
        within_budget = b_summary["within_budget"]
        below_min = b_summary["below_minimum"]
        daily_cap = b_summary["daily_cap"]
        per_day_costs = b_summary["per_day_costs"]

        # Assert total_estimated_cost <= total_budget unless below_minimum is True
        if not below_min:
            self.assertLessEqual(total_est, total_budget)
            self.assertTrue(within_budget)
        else:
            self.assertFalse(within_budget)

        # Assert daily_cap == total_budget / days
        expected_daily_cap = round(total_budget / days, 2)
        self.assertEqual(daily_cap, expected_daily_cap)

        # Assert sum(per_day_costs) == total_estimated_cost
        self.assertAlmostEqual(sum(per_day_costs), total_est, places=2)

        return b_summary

    def test_2_days_relaxed(self):
        # 2 days relaxed with budget 10,000
        summary = self.run_pipeline_for_scenario(days=2, pace="relaxed", total_budget=10000.0)
        self.assertFalse(summary["below_minimum"])

    def test_3_days_moderate_budget_3000(self):
        # 3 days moderate with tight budget 3,000
        summary = self.run_pipeline_for_scenario(days=3, pace="moderate", total_budget=3000.0)
        # Even with tight budget, engine applies ladder and verifies condition
        if summary["below_minimum"]:
            self.assertGreater(summary["minimum_required"], 0)

    def test_5_days_moderate(self):
        # 5 days moderate with budget 20,000
        summary = self.run_pipeline_for_scenario(days=5, pace="moderate", total_budget=20000.0)
        self.assertFalse(summary["below_minimum"])

    def test_7_days_fast(self):
        # 7 days fast with budget 35,000
        summary = self.run_pipeline_for_scenario(days=7, pace="fast", total_budget=35000.0)
        self.assertFalse(summary["below_minimum"])

    def test_placeholder_strings_absent_from_source(self):
        forbidden_strings = [
            "Curated chill experience",
            "Iconic Bistro",
            "Old Town Heritage Walk",
            "Historic Center",
            "Best of",
            "(Day ",
            "Traditional Dining at",
            "Book ahead or arrive 15 minutes",
        ]

        workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

        found_violations = []
        for root, dirs, files in os.walk(workspace_root):
            # Skip virtual environments, node_modules, git, build artifacts, test file itself, logs
            if any(skip in root for skip in ["venv", "node_modules", ".git", "dist", "brain", ".gemini", "tests"]):
                continue
            for f in files:
                if f.endswith((".py", ".js", ".jsx", ".json", ".html")):
                    file_path = os.path.join(root, f)
                    try:
                        with open(file_path, "r", encoding="utf-8") as handle:
                            content = handle.read()
                            for forb in forbidden_strings:
                                if forb in content:
                                    found_violations.append(f"{file_path}: contains '{forb}'")
                    except Exception:
                        pass

        self.assertEqual(len(found_violations), 0, f"Found placeholder strings in source:\n" + "\n".join(found_violations))


if __name__ == "__main__":
    unittest.main()
