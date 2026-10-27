from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import uuid

from app.utils.auth import get_supabase
from app.utils.errors import NotFoundError, ForbiddenError
from app.schemas.trip import CreateTripRequest, UpdateTripRequest


class TripService:
    @staticmethod
    def create_trip(user_id: str, trip_in: CreateTripRequest) -> Dict[str, Any]:
        supabase = get_supabase()
        trip_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        trip_record = {
            "id": trip_id,
            "user_id": user_id,
            "destination": trip_in.destination,
            "start_date": trip_in.start_date,
            "end_date": trip_in.end_date,
            "travel_style": trip_in.travel_style,
            "interests": trip_in.interests,
            "group_size": trip_in.group_size,
            "pace": trip_in.pace,
            "budget_per_day": trip_in.budget_per_day,
            "total_budget": getattr(trip_in, "total_budget", None),
            "origin": getattr(trip_in, "origin", None),
            "stay_budget_per_night": getattr(trip_in, "stay_budget_per_night", None),
            "food_budget_per_meal": getattr(trip_in, "food_budget_per_meal", None),
            "stay_type": getattr(trip_in, "stay_type", None),
            "diet": getattr(trip_in, "diet", None),
            "dietary_restrictions": trip_in.dietary_restrictions,
            "mobility_concerns": trip_in.mobility_concerns,
            "vibe": trip_in.vibe or "chill",
            "language": getattr(trip_in, "language", "en") or "en",
            "currency": getattr(trip_in, "currency", "INR") or "INR",
            "created_at": now,
            "updated_at": now
        }

        try:
            res = supabase.table("trips").insert(trip_record).execute()
        except Exception:
            # Fall back to base columns if database migration has not been applied
            base_keys = {
                "id", "user_id", "destination", "start_date", "end_date",
                "travel_style", "interests", "group_size", "pace", "budget_per_day",
                "dietary_restrictions", "mobility_concerns", "vibe", "created_at", "updated_at"
            }
            safe_record = {k: v for k, v in trip_record.items() if k in base_keys}
            res = supabase.table("trips").insert(safe_record).execute()

        if not res.data:
            raise RuntimeError("Failed to create trip in database")
        
        created = res.data[0]
        for k, v in trip_record.items():
            created.setdefault(k, v)
        return created

    @staticmethod
    def get_user_trips(user_id: str) -> List[Dict[str, Any]]:
        supabase = get_supabase()
        res = supabase.table("trips").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        trips = res.data or []
        
        # Attach latest itinerary info if available
        for t in trips:
            t.setdefault("total_budget", None)
            t.setdefault("origin", None)
            t.setdefault("stay_budget_per_night", None)
            t.setdefault("food_budget_per_meal", None)
            t.setdefault("stay_type", None)
            t.setdefault("diet", None)
            t.setdefault("language", "en")
            t.setdefault("currency", "INR")
            itin_res = supabase.table("itineraries").select("*").eq("trip_id", t["id"]).order("created_at", desc=True).limit(1).execute()
            if itin_res.data:
                from app.services.itinerary import ItineraryService
                t["itinerary"] = ItineraryService._format_itinerary_record(itin_res.data[0])
            else:
                t["itinerary"] = None
        return trips

    @staticmethod
    def get_trip_by_id(trip_id: str, user_id: str) -> Dict[str, Any]:
        supabase = get_supabase()
        res = supabase.table("trips").select("*").eq("id", trip_id).execute()
        if not res.data:
            raise NotFoundError(f"Trip with ID {trip_id} not found")
        trip = res.data[0]
        if trip["user_id"] != user_id:
            raise ForbiddenError("You do not have permission to view this trip")
        
        trip.setdefault("total_budget", None)
        trip.setdefault("origin", None)
        trip.setdefault("stay_budget_per_night", None)
        trip.setdefault("food_budget_per_meal", None)
        trip.setdefault("stay_type", None)
        trip.setdefault("diet", None)
        trip.setdefault("language", "en")
        trip.setdefault("currency", "INR")

        # Fetch latest itinerary
        itin_res = supabase.table("itineraries").select("*").eq("trip_id", trip_id).order("created_at", desc=True).limit(1).execute()
        if itin_res.data:
            from app.services.itinerary import ItineraryService
            trip["itinerary"] = ItineraryService._format_itinerary_record(itin_res.data[0])
        else:
            trip["itinerary"] = None
        return trip

    @staticmethod
    def update_trip(trip_id: str, user_id: str, update_in: UpdateTripRequest) -> Dict[str, Any]:
        # Validate existence and ownership
        TripService.get_trip_by_id(trip_id, user_id)
        
        update_dict = {k: v for k, v in update_in.model_dump().items() if v is not None}
        if not update_dict:
            return TripService.get_trip_by_id(trip_id, user_id)

        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase = get_supabase()
        try:
            res = supabase.table("trips").update(update_dict).eq("id", trip_id).execute()
        except Exception:
            base_keys = {
                "destination", "start_date", "end_date", "travel_style", "interests",
                "group_size", "pace", "budget_per_day", "dietary_restrictions",
                "mobility_concerns", "vibe", "updated_at"
            }
            safe_dict = {k: v for k, v in update_dict.items() if k in base_keys}
            res = supabase.table("trips").update(safe_dict).eq("id", trip_id).execute()

        if not res.data:
            raise NotFoundError("Failed to update trip")
        
        updated = res.data[0]
        for k, v in update_dict.items():
            updated.setdefault(k, v)
        itin_res = supabase.table("itineraries").select("*").eq("trip_id", trip_id).order("created_at", desc=True).limit(1).execute()
        updated["itinerary"] = itin_res.data[0] if itin_res.data else None
        return updated

    @staticmethod
    def delete_trip(trip_id: str, user_id: str) -> bool:
        TripService.get_trip_by_id(trip_id, user_id)
        supabase = get_supabase()
        # Delete itineraries first
        supabase.table("itineraries").delete().eq("trip_id", trip_id).execute()
        supabase.table("trips").delete().eq("id", trip_id).execute()
        return True
