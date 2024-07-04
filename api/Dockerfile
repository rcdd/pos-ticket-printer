# Use an official Node.js runtime as a parent image
FROM node:12

# Set the working directory in the container
WORKDIR /api

# Update the sources list to use the archived Debian repositories
RUN sed -i 's|http://deb.debian.org/debian|http://archive.debian.org/debian|g' /etc/apt/sources.list && \
    sed -i 's|http://security.debian.org/debian-security|http://archive.debian.org/debian-security|g' /etc/apt/sources.list && \
    sed -i '/stretch-updates/d' /etc/apt/sources.list && \
    echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99no-check-valid-until

# Install system dependencies
RUN apt-get update && \
    apt-get install -y libcups2-dev cups build-essential python3

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
EXPOSE 3000

# Define the command to run the app
CMD ["npm", "start"]
