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
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT
    }


@app.get("/", tags=["system"])
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs": "/docs",
        "health": "/health"
    }


# Global Exception Handlers
@app.exception_handler(AppException)
async def handle_app_exception(request: Request, exc: AppException):
    logger.warning("Handled AppException [%s]: %s (path: %s)", exc.status_code, exc.message, request.url.path)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "details": exc.details
        }
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    logger.warning("Request validation failed on %s: %s", request.url.path, exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "RequestValidationError",
            "message": "Input validation error",
            "details": exc.errors()
        }
    )


@app.exception_handler(Exception)
async def handle_generic_exception(request: Request, exc: Exception):
    logger.exception("Unhandled server exception on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An internal server error occurred. Please try again later."
        }
    )
