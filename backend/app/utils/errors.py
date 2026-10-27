from typing import Any, Optional


class AppException(Exception):
    status_code: int = 500
    default_message: str = "An unexpected error occurred"

    def __init__(self, message: Optional[str] = None, details: Optional[Any] = None):
        super().__init__(message or self.default_message)
        self.message = message or self.default_message
        self.details = details


class NotFoundError(AppException):
    status_code = 404
    default_message = "Resource not found"


class ValidationError(AppException):
    status_code = 400
    default_message = "Validation failed"


class AIGenerationError(AppException):
    status_code = 502
    default_message = "AI service failed to generate itinerary"


class UnauthorizedError(AppException):
    status_code = 401
    default_message = "Authentication required or invalid credentials"


class ForbiddenError(AppException):
    status_code = 403
    default_message = "You do not have permission to access this resource"
