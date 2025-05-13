# Use an official Node.js runtime
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies
# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define environment variable
ENV NODE_ENV=development

# Run the app when the container launches in development mode
CMD ["npm", "run", "dev"]
