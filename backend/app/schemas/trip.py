from typing import List, Optional, Literal, Union
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, model_validator


class ActivityItem(BaseModel):
    time: str = Field(..., description="Time slot or hour, e.g. '09:00 AM' or '09:00 - 11:30 AM'")
    title: str = Field(..., description="Name of attraction or activity in format 'Category Title: Exact Place Name'")
    description: str = Field(..., description="Detailed description of activity")
    location: str = Field(..., description="Specific place, neighborhood, or landmark")
    estimated_cost: str = Field(..., description="Estimated cost in INR e.g. '₹500' or 'Free'")
    travel_tip: str = Field(..., description="Insider travel tip or routing recommendation")
    place_name: Optional[str] = Field(None, description="Exact searchable place name")
    area: Optional[str] = Field(None, description="Locality or district")
    lat: Optional[float] = Field(None, description="Latitude coordinate")
    lng: Optional[float] = Field(None, description="Longitude coordinate")
    category: Optional[str] = Field(default="sightseeing", description="sightseeing | food | stay | transport")


class HotelRecommendation(BaseModel):
    exact_name: str
    area: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_range: str
    tier: Literal["budget", "mid-range", "premium"] = "mid-range"
    reason: str


class DiningRecommendation(BaseModel):
    exact_name: str
    area: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_range: str
    cuisine: str
    meal_type: str = "Dinner"
    best_fit_day: int = 1
    reason: str


class Recommendations(BaseModel):
    hotels: List[HotelRecommendation] = Field(default_factory=list)
    dining: List[DiningRecommendation] = Field(default_factory=list)


class DayItinerary(BaseModel):
    day: int = Field(..., description="Day number (1, 2, ...)")
    date: Optional[str] = Field(None, description="Calendar date for this day")
    theme: Optional[str] = Field(None, description="Theme or focus for the day")
    activities: List[ActivityItem] = Field(default_factory=list)


class ItineraryResponse(BaseModel):
    id: Optional[str] = None
    trip_id: str
    days: List[DayItinerary]
    recommendations: Optional[Recommendations] = None
    summary: Optional[str] = None
    created_at: Optional[str] = None


class CreateTripRequest(BaseModel):
    destination: str = Field(..., min_length=2, max_length=150)
    start_date: str = Field(..., description="YYYY-MM-DD")
    end_date: str = Field(..., description="YYYY-MM-DD")
    travel_style: str = Field(..., description="e.g. Budget, Luxury, Solo, Family, Backpacking")
    interests: List[str] = Field(..., min_length=1)
    group_size: int = Field(default=1, ge=1, le=50)
    pace: Literal["relaxed", "moderate", "fast"] = Field(default="moderate")
    budget_per_day: Optional[Union[float, int, str]] = Field(None, description="Budget per day per person (legacy or computed)")
    total_budget: Optional[float] = Field(None, description="Total trip budget in INR")
    origin: Optional[str] = Field(None, description="Trip origin / starting point")
    stay_budget_per_night: Optional[float] = Field(None, description="Comfort budget for stay per night")
    food_budget_per_meal: Optional[float] = Field(None, description="Comfort budget for food per meal per person")
    stay_type: Optional[str] = Field(None, description="hostel | guest house | hotel | resort")
    diet: Optional[str] = Field(None, description="veg | non-veg | Jain | vegan | any")
    dietary_restrictions: List[str] = Field(default_factory=list)
    mobility_concerns: Optional[str] = Field(None, max_length=300)
    vibe: Optional[str] = Field(default="chill", description="e.g. adventurous, romantic, cultural, foodie, chill")
    language: Optional[str] = Field(default="en", description="e.g. en, hi, gu, mr, bn, ta, te, kn, pa")
    currency: Optional[str] = Field(default="INR", description="Default INR")

    @model_validator(mode="after")
    def validate_budget(self):
        # Calculate days
        num_days = 3
        try:
            d1 = datetime.strptime(self.start_date, "%Y-%m-%d")
            d2 = datetime.strptime(self.end_date, "%Y-%m-%d")
            diff = (d2 - d1).days + 1
            if diff >= 1:
                num_days = diff
        except Exception:
            pass

        if self.total_budget is not None and not self.budget_per_day:
            daily_val = max(1, round(self.total_budget / num_days))
            self.budget_per_day = f"₹{daily_val}"
        elif self.budget_per_day:
            s = str(self.budget_per_day).strip()
            if not s.startswith("₹") and not s.startswith("$") and s.replace(".", "", 1).isdigit():
                self.budget_per_day = f"₹{s}"
            if self.total_budget is None:
                numeric_val = "".join(ch for ch in s if ch.isdigit() or ch == ".")
                if numeric_val:
                    try:
                        self.total_budget = float(numeric_val) * num_days
                    except Exception:
                        pass
        else:
            self.budget_per_day = "₹3000"
            if self.total_budget is None:
                self.total_budget = 3000.0 * num_days
        return self


class UpdateTripRequest(BaseModel):
    destination: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    travel_style: Optional[str] = None
    interests: Optional[List[str]] = None
    group_size: Optional[int] = Field(None, ge=1, le=50)
    pace: Optional[Literal["relaxed", "moderate", "fast"]] = None
    budget_per_day: Optional[Union[float, int, str]] = None
    total_budget: Optional[float] = None
    origin: Optional[str] = None
    stay_budget_per_night: Optional[float] = None
    food_budget_per_meal: Optional[float] = None
    stay_type: Optional[str] = None
    diet: Optional[str] = None
    dietary_restrictions: Optional[List[str]] = None
    mobility_concerns: Optional[str] = None
    vibe: Optional[str] = None
    language: Optional[str] = None
    currency: Optional[str] = None


class RegenerateTripRequest(BaseModel):
    pace: Optional[Literal["relaxed", "moderate", "fast"]] = None
    travel_style: Optional[str] = None
    vibe: Optional[str] = None
    language: Optional[str] = None
    notes: Optional[str] = None


class RecommendationsRequest(BaseModel):
    stay_budget_per_night: Optional[float] = None
    food_budget_per_meal: Optional[float] = None
    stay_type: Optional[str] = None
    diet: Optional[str] = None
    language: Optional[str] = "en"


class TranslateTripRequest(BaseModel):
    language: str = Field(..., min_length=2, max_length=10, description="Target language code: en, hi, gu, mr, bn, ta, te, kn, pa")


class PopularItem(BaseModel):
    name: str
    area: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price_range: Optional[str] = None
    best_time: Optional[str] = None
    exact_dish: Optional[str] = None


class PopularDestinationResponse(BaseModel):
    city: str
    language: str = "en"
    top_attractions: List[PopularItem] = Field(default_factory=list)
    must_try_foods: List[PopularItem] = Field(default_factory=list)
    shopping_specialties: List[PopularItem] = Field(default_factory=list)
    hidden_gems: List[PopularItem] = Field(default_factory=list)
    best_time_to_visit: Optional[str] = None
    local_tips: List[str] = Field(default_factory=list)
    daily_cost_range_inr: Optional[str] = None


class TripResponse(BaseModel):
    id: str
    user_id: str
    destination: str
    start_date: str
    end_date: str
    travel_style: str
    interests: List[str]
    group_size: int
    pace: str
    budget_per_day: str
    total_budget: Optional[float] = None
    origin: Optional[str] = None
    stay_budget_per_night: Optional[float] = None
    food_budget_per_meal: Optional[float] = None
    stay_type: Optional[str] = None
    diet: Optional[str] = None
    dietary_restrictions: List[str] = Field(default_factory=list)
    mobility_concerns: Optional[str] = None
    vibe: Optional[str] = "chill"
    language: Optional[str] = "en"
    currency: Optional[str] = "INR"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    itinerary: Optional[ItineraryResponse] = None
