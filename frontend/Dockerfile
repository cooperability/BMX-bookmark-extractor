# Stage 1: Development
# Using Alpine for smaller image size and better security
FROM node:20-alpine AS development

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies with clear cache to reduce image size
RUN npm install && \
    npm cache clean --force

# Copy application code
COPY . .

# Set correct permissions
RUN chown -R nextjs:nodejs .

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Use npm script instead of direct command for better maintainability
CMD ["npm", "run", "dev"]

# Stage 2: Production build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS production

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Production-specific settings
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]