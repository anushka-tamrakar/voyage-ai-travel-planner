from fastapi import APIRouter, Query
from app.schemas.trip import PopularDestinationResponse
from app.services.ai import get_ai_service

router = APIRouter(prefix="/destinations", tags=["destinations"])


@router.get("/popular", response_model=PopularDestinationResponse)
async def get_popular_destinations(
    city: str = Query(..., min_length=2, description="Target destination city name"),
    language: str = Query("en", description="Language code: en, hi, gu, mr, bn, ta, te, kn, pa"),
):
    ai_service = get_ai_service()
    result = await ai_service.get_popular_destinations(city, language)
    return result
