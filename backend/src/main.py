import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="BMX Backend", version="0.1.0")


# Basic response model for health check (Simplified)
class HealthResponse(BaseModel):
    status: str
    version: str


# Define API routes FIRST
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Provides health status of the application."""
    app_version = os.getenv("APP_VERSION", "0.1.0")

    return HealthResponse(status="healthy", version=app_version)


# Placeholder for potential future startup events
@app.on_event("startup")
async def startup_event():
    print("BMX Backend starting up...")


# Placeholder for potential future shutdown events
@app.on_event("shutdown")
async def shutdown_event():
    print("BMX Backend shutting down...")


# Mount static files LAST to handle requests that didn't match an API route
# Serve files from the '/app/public' directory inside the container
# at the root URL path '/'.
app.mount("/", StaticFiles(directory="/app/public", html=True), name="public")
