from typing import List, Dict, Any
from app.utils.auth import get_supabase
from app.services.trip import TripService


class HistoryService:
    @staticmethod
    def get_trip_itinerary_history(trip_id: str, user_id: str) -> List[Dict[str, Any]]:
        # Verify trip ownership
        TripService.get_trip_by_id(trip_id, user_id)
        supabase = get_supabase()
        res = (
            supabase.table("itineraries")
            .select("id, trip_id, summary, created_at, days")
            .eq("trip_id", trip_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
