# Use an official Node.js runtime as a parent image (Node 20 on Debian)
FROM node:20

# Set the working directory in the container
WORKDIR /api

# Install system dependencies
RUN apt-get update && \
    apt-get install -y libcups2-dev cups build-essential python3 && \
    rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Clean npm cache, remove node_modules, and install dependencies with rebuild from source
RUN npm cache clean --force && \
    rm -rf node_modules && \
    npm install --build-from-source

# Copy the rest of your application code
COPY . .

# Rebuild all modules
RUN npm rebuild

# Expose the port the app runs on
EXPOSE 9393

# Define the command to run the app
CMD ["npm", "start"]
