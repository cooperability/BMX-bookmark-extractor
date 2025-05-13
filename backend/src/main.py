import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="BMX Backend", version="0.1.0")

# CORS Configuration
origins = [
    "http://localhost:3000",  # Allow Next.js frontend
    "http://localhost",  # Often useful for development
    # Add any other origins you might need for development/production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


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
