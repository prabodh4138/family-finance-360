import time
from collections import defaultdict
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings
from app.api.routes import router

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Production-ready API for Family Finance 360 - Mobile-First Household Finance Application"
)

# -------------------------------------------------------------
# 1. In-memory Rate Limiting Middleware (Sliding Window per IP)
# -------------------------------------------------------------
RATE_LIMIT_WINDOWS: dict[str, list[float]] = defaultdict(list)
AUTH_MAX_REQUESTS_PER_MINUTE = 20

class SecurityAndRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Apply rate limiting on authentication routes
        path = request.url.path
        if request.method == "POST" and (path.endswith("/auth/login") or path.endswith("/auth/register")):
            client_ip = request.client.host if request.client else "127.0.0.1"
            key = f"{client_ip}:{path}"
            now = time.time()
            cutoff = now - 60.0
            
            # Clean old entries
            timestamps = [t for t in RATE_LIMIT_WINDOWS[key] if t > cutoff]
            if len(timestamps) >= AUTH_MAX_REQUESTS_PER_MINUTE:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many requests. Please wait a moment before trying again."},
                    headers={"Retry-After": "60"}
                )
            timestamps.append(now)
            RATE_LIMIT_WINDOWS[key] = timestamps

        response = await call_next(request)

        # ---------------------------------------------------------
        # 2. Production Security Headers
        # ---------------------------------------------------------
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response

app.add_middleware(SecurityAndRateLimitMiddleware)

# -------------------------------------------------------------
# 3. CORS Configuration
# -------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Content-Disposition"]
)

app.include_router(router, prefix=settings.api_prefix)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": "1.0.0",
        "environment": settings.environment
    }
