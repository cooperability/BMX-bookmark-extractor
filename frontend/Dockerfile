# Use an official Node.js runtime
FROM node:20-slim

# Set working directory in the container
WORKDIR /app

# Install dependencies
# Copy package.json and package-lock.json (if available) first to leverage Docker cache.
# This step will only re-run if these files change.
COPY package*.json ./

# Install project dependencies. Using npm ci is often preferred in CI/builds for deterministic installs,
# but npm install is fine for development.
RUN npm install

# Copy the rest of the application code from the frontend directory into the container.
# Ensure a comprehensive .dockerignore file exists in the frontend directory to prevent
# copying node_modules, .next, and other unnecessary files into the build context and image.
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define environment variable for Next.js development mode
ENV NODE_ENV=development

# Run the Next.js development server when the container launches
CMD ["npm", "run", "dev"]
