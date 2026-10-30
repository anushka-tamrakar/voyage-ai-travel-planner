import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.utils.errors import AppException, NotFoundError, ValidationError, AIGenerationError, UnauthorizedError, ForbiddenError
from app.routes.auth import router as auth_router
from app.routes.trips import router as trips_router
from app.routes.destinations import router as destinations_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Personalized Travel Itinerary Planner SaaS",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https:\/\/voyage-ai-travel-planner.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(trips_router)
app.include_router(destinations_router)


@app.get("/health", tags=["system"])
async def health_check():
    db_status = "unconfigured"
    db_details = None
    try:
        from app.utils.auth import get_supabase
        supabase = get_supabase()
        res = supabase.table("users").select("id").limit(1).execute()
        db_status = "connected"
    except Exception as exc:
        db_status = "error"
        db_details = str(exc)

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": {
            "status": db_status,
            "details": db_details
        }
    }


@app.get("/health/ai", tags=["system"])
async def health_ai_check():
    from app.services.ai import get_ai_service
    ai_service = get_ai_service()
    return await ai_service.check_health()


@app.get("/", tags=["system"])
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs": "/docs",
        "health": "/health"
    }


import re

# CORS response helper to ensure error responses retain CORS headers
def _cors_response(request: Request, content: dict, status_code: int) -> JSONResponse:
    origin = request.headers.get("origin")
    headers = {}
    if origin:
        is_allowed = (
            origin in settings.cors_origins
            or bool(re.match(r"^https:\/\/voyage-ai-travel-planner.*\.vercel\.app$", origin))
        )
        if is_allowed:
            headers["Access-Control-Allow-Origin"] = origin
            headers["Access-Control-Allow-Credentials"] = "true"
            headers["Vary"] = "Origin"
    return JSONResponse(status_code=status_code, content=content, headers=headers)


# Global Exception Handlers
@app.exception_handler(AppException)
async def handle_app_exception(request: Request, exc: AppException):
    logger.warning("Handled AppException [%s]: %s (path: %s)", exc.status_code, exc.message, request.url.path)
    return _cors_response(
        request,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "details": exc.details
        },
        status_code=exc.status_code
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    logger.warning("Request validation failed on %s: %s", request.url.path, exc.errors())
    return _cors_response(
        request,
        content={
            "error": "RequestValidationError",
            "message": "Input validation error",
            "details": exc.errors()
        },
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
    )


@app.exception_handler(Exception)
async def handle_generic_exception(request: Request, exc: Exception):
    logger.exception("Unhandled server exception on %s: %s", request.url.path, exc)
    error_msg = str(exc)
    return _cors_response(
        request,
        content={
            "error": "InternalServerError",
            "message": f"Server error: {error_msg}" if error_msg else "An internal server error occurred. Please try again later.",
            "details": error_msg
        },
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
