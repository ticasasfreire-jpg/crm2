# Use Node.js 20 LTS
FROM node:20-slim

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source
COPY . .

# Build the application
RUN npm run build

# Expose the application port
EXPOSE 3000

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["npm", "run", "start"]
