#!/bin/bash
set -e

# Directory for model cache
MODEL_CACHE_DIR="/app/model_cache"
mkdir -p "$MODEL_CACHE_DIR"

# Function to check if SpaCy model is installed
check_spacy_model() {
    poetry run python -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null
}

# Function to check if NLTK data is available
check_nltk_data() {
    poetry run python -c "import nltk; nltk.data.find('tokenizers/punkt')" 2>/dev/null
}

echo "🚀 Starting BMX Backend..."

# Download SpaCy model if not available
if ! check_spacy_model; then
    echo "📥 Downloading SpaCy English model (this may take a few minutes on first run)..."
    poetry run python -m spacy download en_core_web_sm
    echo "✅ SpaCy model downloaded"
else
    echo "✅ SpaCy model already available"
fi

# Download NLTK data if not available
if ! check_nltk_data; then
    echo "📥 Downloading NLTK data..."
    poetry run python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('averaged_perceptron_tagger')"
    echo "✅ NLTK data downloaded"
else
    echo "✅ NLTK data already available"
fi

echo "🎯 All models ready! Starting application..."

# Start the FastAPI application
exec /app/.venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 8000
