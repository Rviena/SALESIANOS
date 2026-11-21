"""One API serves both organizer and spectator views."""
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware

from app.api.admin.routes import router as admin_router
from app.api.public.routes import router as public_router

app = FastAPI(title="Salesianos FEST", version="0.1.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.include_router(public_router)
app.include_router(admin_router)


@app.get("/api/health")
def health():
    return {"ok": True}
