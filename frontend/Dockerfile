# Use an official Node.js runtime
FROM node:20-slim

# Set working directory in the container
WORKDIR /app

# Install dependencies
# Enable corepack to manage Yarn versions (Node 20+ includes corepack).
# and enable corepack to manage Yarn versions.
RUN corepack enable

# Copy package.json and yarn.lock (if available) first to leverage Docker cache.
# This step will only re-run if these files change.
COPY package.json yarn.lock* ./

# Install project dependencies. Using npm ci is often preferred in CI/builds for deterministic installs,
# but npm install is fine for development.
# Using yarn install --frozen-lockfile is similar to npm ci for reproducible builds.
RUN yarn install --frozen-lockfile

# Copy the rest of the application code from the frontend directory into the container.
# Ensure a comprehensive .dockerignore file exists in the frontend directory to prevent
# copying node_modules, .next, and other unnecessary files into the build context and image.
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define environment variable for SvelteKit development mode
ENV NODE_ENV=development

# Run the SvelteKit development server when the container launches
# Use --host 0.0.0.0 to bind to all interfaces so Docker can access it
CMD ["yarn", "run", "dev", "--host", "0.0.0.0", "--port", "3000"]
