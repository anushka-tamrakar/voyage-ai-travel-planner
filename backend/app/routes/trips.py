from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import HTMLResponse, JSONResponse

from app.schemas.trip import (
    CreateTripRequest,
    UpdateTripRequest,
    RegenerateTripRequest,
    TranslateTripRequest,
    RecommendationsRequest,
    TripResponse,
    ItineraryResponse,
)
from app.services.trip import TripService
from app.services.itinerary import ItineraryService
from app.services.history import HistoryService
from app.utils.auth import get_current_user

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(payload: CreateTripRequest, current_user: dict = Depends(get_current_user)):
    trip = TripService.create_trip(current_user["id"], payload)
    return trip


@router.get("", response_model=List[TripResponse])
async def list_trips(current_user: dict = Depends(get_current_user)):
    trips = TripService.get_user_trips(current_user["id"])
    return trips


@router.get("/{id}", response_model=TripResponse)
async def get_trip(id: str, current_user: dict = Depends(get_current_user)):
    trip = TripService.get_trip_by_id(id, current_user["id"])
    return trip


@router.put("/{id}", response_model=TripResponse)
async def update_trip(id: str, payload: UpdateTripRequest, current_user: dict = Depends(get_current_user)):
    trip = TripService.update_trip(id, current_user["id"], payload)
    return trip


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(id: str, current_user: dict = Depends(get_current_user)):
    TripService.delete_trip(id, current_user["id"])
    return None


@router.post("/{id}/generate", response_model=ItineraryResponse)
async def generate_itinerary(id: str, current_user: dict = Depends(get_current_user)):
    itinerary = await ItineraryService.generate_itinerary(id, current_user["id"])
    return itinerary


@router.post("/{id}/regenerate", response_model=ItineraryResponse)
async def regenerate_itinerary(
    id: str,
    payload: RegenerateTripRequest,
    current_user: dict = Depends(get_current_user),
):
    itinerary = await ItineraryService.regenerate_itinerary(id, current_user["id"], payload)
    return itinerary


@router.post("/{id}/translate", response_model=ItineraryResponse)
async def translate_itinerary(
    id: str,
    payload: TranslateTripRequest,
    current_user: dict = Depends(get_current_user),
):
    itinerary = await ItineraryService.translate_itinerary(id, current_user["id"], payload.language)
    return itinerary


@router.post("/{id}/recommendations", response_model=ItineraryResponse)
async def update_recommendations(
    id: str,
    payload: RecommendationsRequest,
    current_user: dict = Depends(get_current_user),
):
    itinerary = await ItineraryService.update_recommendations(
        id, current_user["id"], payload.model_dump()
    )
    return itinerary


@router.get("/{id}/export")
async def export_itinerary(
    id: str,
    format: str = Query("json", description="Export format: 'json' or 'print'/'html'"),
    current_user: dict = Depends(get_current_user),
):
    result = ItineraryService.export_itinerary(id, current_user["id"], export_format=format)
    if format.lower() in ("print", "html"):
        return HTMLResponse(content=result)
    return JSONResponse(content=result)


@router.get("/{id}/history")
async def get_itinerary_history(id: str, current_user: dict = Depends(get_current_user)):
    history = HistoryService.get_trip_itinerary_history(id, current_user["id"])
    return history
