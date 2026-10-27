from datetime import datetime, timezone
from typing import Dict, Any, Optional
import uuid

from app.utils.auth import get_supabase
from app.utils.errors import NotFoundError
from app.services.trip import TripService
from app.services.ai import get_ai_service
from app.schemas.trip import RegenerateTripRequest


class ItineraryService:
    @staticmethod
    def _format_itinerary_record(record: Dict[str, Any]) -> Dict[str, Any]:
        raw_days = record.get("days")
        if isinstance(raw_days, dict):
            days = raw_days.get("days", [])
            recommendations = raw_days.get("recommendations", {"hotels": [], "dining": []})
        elif isinstance(raw_days, list):
            days = raw_days
            recommendations = record.get("recommendations", {"hotels": [], "dining": []})
        else:
            days = []
            recommendations = {"hotels": [], "dining": []}

        return {
            "id": record.get("id"),
            "trip_id": record.get("trip_id"),
            "days": days,
            "recommendations": recommendations,
            "summary": record.get("summary", ""),
            "created_at": record.get("created_at"),
        }

    @staticmethod
    async def generate_itinerary(trip_id: str, user_id: str) -> Dict[str, Any]:
        trip = TripService.get_trip_by_id(trip_id, user_id)
        ai_service = get_ai_service()

        generated_data = await ai_service.generate_itinerary(trip)

        supabase = get_supabase()
        itinerary_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # Pack days and recommendations into days JSONB to maintain schema compatibility
        packed_days = {
            "days": generated_data.get("days", []),
            "recommendations": generated_data.get("recommendations", {"hotels": [], "dining": []}),
        }

        record = {
            "id": itinerary_id,
            "trip_id": trip_id,
            "days": packed_days,
            "summary": generated_data.get("summary", f"Itinerary for {trip.get('destination')}"),
            "created_at": now,
        }

        res = supabase.table("itineraries").insert(record).execute()
        if not res.data:
            raise RuntimeError("Failed to persist generated itinerary")
        return ItineraryService._format_itinerary_record(res.data[0])

    @staticmethod
    async def regenerate_itinerary(
        trip_id: str, user_id: str, tweaks: RegenerateTripRequest
    ) -> Dict[str, Any]:
        trip = TripService.get_trip_by_id(trip_id, user_id)
        ai_service = get_ai_service()

        tweak_data = {k: v for k, v in tweaks.model_dump().items() if v is not None}
        generated_data = await ai_service.generate_itinerary(trip, tweaks=tweak_data)

        # Update trip attributes if requested in tweaks
        trip_updates = {}
        if tweaks.pace:
            trip_updates["pace"] = tweaks.pace
        if tweaks.travel_style:
            trip_updates["travel_style"] = tweaks.travel_style
        if tweaks.vibe:
            trip_updates["vibe"] = tweaks.vibe
        if tweaks.language:
            trip_updates["language"] = tweaks.language

        supabase = get_supabase()
        if trip_updates:
            trip_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            supabase.table("trips").update(trip_updates).eq("id", trip_id).execute()

        itinerary_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        packed_days = {
            "days": generated_data.get("days", []),
            "recommendations": generated_data.get("recommendations", {"hotels": [], "dining": []}),
        }

        record = {
            "id": itinerary_id,
            "trip_id": trip_id,
            "days": packed_days,
            "summary": generated_data.get("summary", f"Refreshed itinerary for {trip.get('destination')}"),
            "created_at": now,
        }

        res = supabase.table("itineraries").insert(record).execute()
        if not res.data:
            raise RuntimeError("Failed to persist regenerated itinerary")
        return ItineraryService._format_itinerary_record(res.data[0])

    @staticmethod
    def get_latest_itinerary(trip_id: str, user_id: str) -> Dict[str, Any]:
        TripService.get_trip_by_id(trip_id, user_id)
        supabase = get_supabase()
        res = (
            supabase.table("itineraries")
            .select("*")
            .eq("trip_id", trip_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise NotFoundError(f"No itinerary found for trip {trip_id}. Please generate one first.")
        return ItineraryService._format_itinerary_record(res.data[0])

    @staticmethod
    async def translate_itinerary(trip_id: str, user_id: str, language: str) -> Dict[str, Any]:
        latest = ItineraryService.get_latest_itinerary(trip_id, user_id)
        ai_service = get_ai_service()

        itinerary_payload = {
            "summary": latest.get("summary", ""),
            "days": latest.get("days", []),
            "recommendations": latest.get("recommendations", {"hotels": [], "dining": []}),
        }

        translated = await ai_service.translate_itinerary(itinerary_payload, language)

        return {
            "id": latest.get("id"),
            "trip_id": trip_id,
            "days": translated.get("days", latest.get("days", [])),
            "recommendations": translated.get("recommendations", latest.get("recommendations", {})),
            "summary": translated.get("summary", latest.get("summary", "")),
            "created_at": latest.get("created_at"),
        }

    @staticmethod
    async def update_recommendations(
        trip_id: str, user_id: str, budget_prefs: Dict[str, Any]
    ) -> Dict[str, Any]:
        trip = TripService.get_trip_by_id(trip_id, user_id)
        latest_itin = ItineraryService.get_latest_itinerary(trip_id, user_id)
        ai_service = get_ai_service()

        # Update comfort preferences on trip record
        trip_updates = {}
        for field in ("stay_budget_per_night", "food_budget_per_meal", "stay_type", "diet"):
            val = budget_prefs.get(field)
            if val is not None:
                trip_updates[field] = val
        if trip_updates:
            supabase = get_supabase()
            try:
                supabase.table("trips").update(trip_updates).eq("id", trip_id).execute()
            except Exception:
                pass
            trip.update(trip_updates)

        # Generate fresh comfort recommendations via AI
        recs = await ai_service.generate_recommendations(trip, budget_prefs)

        # Update latest itinerary record in database
        packed_days = {
            "days": latest_itin.get("days", []),
            "recommendations": recs,
        }
        supabase = get_supabase()
        supabase.table("itineraries").update({"days": packed_days}).eq("id", latest_itin["id"]).execute()

        latest_itin["recommendations"] = recs
        return latest_itin

    @staticmethod
    def export_itinerary(trip_id: str, user_id: str, export_format: str = "json") -> Any:
        trip = TripService.get_trip_by_id(trip_id, user_id)
        itinerary = ItineraryService.get_latest_itinerary(trip_id, user_id)

        if export_format.lower() in ("html", "print"):
            days_html = []
            for d in itinerary.get("days", []):
                act_items = []
                for a in d.get("activities", []):
                    place = a.get("place_name") or a.get("title")
                    area = a.get("area") or a.get("location")
                    act_items.append(f"""
                        <div style="margin-bottom: 16px; padding: 12px; border-left: 3px solid #2563eb; background: #f8fafc; border-radius: 4px;">
                            <div style="font-weight: bold; color: #1e293b;">{a.get('time')} - {place}</div>
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">{area}</div>
                            <div style="font-size: 14px; color: #475569; margin: 4px 0;">{a.get('description')}</div>
                            <div style="font-size: 13px; color: #64748b;"><strong>Cost:</strong> {a.get('estimated_cost')}</div>
                            <div style="font-size: 12px; color: #0284c7; margin-top: 4px;"><em>Tip: {a.get('travel_tip')}</em></div>
                        </div>
                    """)
                days_html.append(f"""
                    <div style="margin-bottom: 28px; page-break-inside: avoid;">
                        <h2 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Day {d.get('day')} {f'- {d.get("theme")}' if d.get('theme') else ''}</h2>
                        {''.join(act_items)}
                    </div>
                """)

            return f"""<!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>{trip.get('destination')} Itinerary</title>
                <style>
                    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #0f172a; margin: 40px auto; max-width: 800px; padding: 0 20px; }}
                    h1 {{ color: #1e3a8a; margin-bottom: 4px; }}
                    .meta {{ color: #64748b; font-size: 14px; margin-bottom: 24px; }}
                    @media print {{ body {{ margin: 20px auto; }} }}
                </style>
            </head>
            <body>
                <h1>{trip.get('destination')} Travel Plan</h1>
                <div class="meta">
                    <strong>Dates:</strong> {trip.get('start_date')} to {trip.get('end_date')} | 
                    <strong>Pace:</strong> {trip.get('pace')} | 
                    <strong>Vibe:</strong> {trip.get('vibe')} | 
                    <strong>Budget:</strong> {trip.get('budget_per_day')}
                </div>
                <p style="font-style: italic; color: #334155;">{itinerary.get('summary', '')}</p>
                {''.join(days_html)}
                <script>window.onload = function() {{ window.print(); }}</script>
            </body>
            </html>"""

        return {
            "trip": trip,
            "itinerary": itinerary,
            "exported_at": datetime.now(timezone.utc).isoformat(),
        }
