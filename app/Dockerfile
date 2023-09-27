# Use the official Python image as a parent image
FROM python:3.10

# Set the working directory to /app
WORKDIR /app

# Copy the requirements file into the container at /app
COPY app/requirements.txt .

# Install the required packages
RUN pip install --no-cache-dir -r requirements.txt

# Create and activate a virtual environment
RUN python -m venv venv
SHELL ["/bin/bash", "-c"]
RUN source venv/bin/activate

# Copy the entire app directory into the container at /app
COPY app/ .

# Install the spaCy model from PyPI
RUN pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.1.0/en_core_web_sm-3.1.0.tar.gz --no-deps

# Expose port 8080 to allow communication to/from the web server
EXPOSE 8080

# Define environment variable
ENV NAME denser

# Run app.py when the container launches
CMD ["python", "app.py"]
