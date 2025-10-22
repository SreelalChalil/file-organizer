# ---- Build Stage ----
# Use a Node.js image to build the React application.
FROM docker.io/library/node:18-alpine as builder

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache.
COPY package*.json ./

# Install dependencies.
RUN npm install

# Copy the rest of the application source code.
COPY . .

# Build the production-ready static files.
RUN npm run build

# ---- Production Stage ----
# Use a lightweight Nginx server to serve the static files.
FROM docker.io/library/nginx:1.25-alpine

# Copy the built static files from the builder stage to the Nginx public directory.
COPY --from=builder /app/build /usr/share/nginx/html

# Copy the custom Nginx configuration.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for the Nginx server.
EXPOSE 80

# The default Nginx command will start the server.
CMD ["nginx", "-g", "daemon off;"]