# Use the official Python image as the base image
FROM python:3.10

# Set the working directory within the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY app/requirements.txt /app/

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire app directory into the container at /app
COPY app /app/

# Copy the spaCy model from the local directory into the container at /app
COPY en_core_web_sm-3.1.0-py3-none-any.whl /app/

# Install the spaCy model
RUN pip install en_core_web_sm-3.1.0-py3-none-any.whl

# Specify the command to run on container start
CMD [ "python", "app.py" ]
