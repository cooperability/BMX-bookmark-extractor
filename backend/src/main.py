import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Remediate.app Backend", version="0.1.0")

# Application state tracking
app_startup_time = None
model_status = {
    "spacy_model": {
        "loaded": False,
        "model_name": "en_core_web_sm",
        "download_time": None,
    },
    "nltk_data": {
        "loaded": False,
        "packages": ["punkt", "stopwords", "wordnet", "averaged_perceptron_tagger"],
        "download_time": None,
    },
}

# CORS Configuration - Support environment variable for production
cors_origins = os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://localhost"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Enhanced response models
class ModelStatus(BaseModel):
    loaded: bool
    model_name: Optional[str] = None
    packages: Optional[list] = None
    download_time: Optional[str] = None


class SystemStatus(BaseModel):
    database: str
    disk_space: str
    memory_usage: str


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    uptime_seconds: float
    startup_time: str
    models: Dict[str, ModelStatus]
    system: SystemStatus
    domain: str


def check_model_status():
    """Check if ML models are available"""
    status = {"spacy": False, "nltk": False}

    try:
        import spacy

        spacy.load("en_core_web_sm")
        status["spacy"] = True
        model_status["spacy_model"]["loaded"] = True
    except (ImportError, OSError):
        pass

    try:
        # Check if NLTK data is available
        nltk_data_path = Path.home() / "nltk_data"
        if nltk_data_path.exists():
            status["nltk"] = True
            model_status["nltk_data"]["loaded"] = True
    except (ImportError, OSError):
        pass

    return status


def get_system_status():
    """Get basic system information"""
    try:
        import psutil

        disk = psutil.disk_usage("/")
        memory = psutil.virtual_memory()

        return SystemStatus(
            database="Connected" if check_database_connection() else "Disconnected",
            disk_space=f"{disk.free // (1024**3)}GB free of {disk.total // (1024**3)}GB",
            memory_usage=f"{memory.percent}% used",
        )
    except ImportError:
        return SystemStatus(
            database="Unknown", disk_space="Unknown", memory_usage="Unknown"
        )


def check_database_connection():
    """Check database connectivity"""
    try:
        # This would check Neo4j connection in a real implementation
        # For now, return True if environment variables are set
        return bool(os.getenv("NEO4J_URI"))
    except Exception:
        return False


# Define API routes
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Comprehensive health status of the application."""
    app_version = os.getenv("APP_VERSION", "0.1.0")
    environment = os.getenv("ENVIRONMENT", "development")
    domain = os.getenv("DOMAIN_NAME", "localhost")

    current_time = time.time()
    uptime = current_time - (app_startup_time or current_time)

    # Convert model status to response format
    models_response = {}
    for model_name, status in model_status.items():
        models_response[model_name] = ModelStatus(**status)

    return HealthResponse(
        status=(
            "healthy"
            if check_model_status()["spacy"] and check_model_status()["nltk"]
            else "degraded"
        ),
        version=app_version,
        environment=environment,
        uptime_seconds=uptime,
        startup_time=(
            datetime.fromtimestamp(app_startup_time or current_time).isoformat()
            if app_startup_time
            else "unknown"
        ),
        models=models_response,
        system=get_system_status(),
        domain=domain,
    )


# Update startup event to track models
@app.on_event("startup")
async def startup_event():
    global app_startup_time
    app_startup_time = time.time()
    print("Remediate.app Backend starting up...")

    # Update model status based on what's actually loaded
    models = check_model_status()
    if models["spacy"]:
        model_status["spacy_model"]["download_time"] = datetime.now().isoformat()
    if models["nltk"]:
        model_status["nltk_data"]["download_time"] = datetime.now().isoformat()


# Placeholder for potential future shutdown events
@app.on_event("shutdown")
async def shutdown_event():
    print("Remediate.app Backend shutting down...")
