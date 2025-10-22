# ---- Builder Stage ----
# This stage installs build tools and compiles Python dependencies into wheels.
FROM docker.io/library/python:3.12-slim as builder

WORKDIR /app

# Install build-time dependencies needed for compiling some Python packages.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential gcc libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only the requirements file first to leverage Docker cache.
COPY requirements.txt .

# Build wheels for all dependencies. This is more efficient for multi-stage builds.
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# ---- Final Stage ----
# This stage creates the final, lean production image.
FROM docker.io/library/python:3.12-slim

WORKDIR /app

# Copy the pre-built wheels from the builder stage and install them.
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/* \
    && rm -rf /wheels

# Ensure entrypoint script is executable
COPY start.sh .
RUN chmod +x ./start.sh

# Copy the application code into the final image.
RUN mkdir -p ./app
COPY api.py ./app/
COPY db.py ./app/
COPY organiser.py ./app/

EXPOSE 8080
CMD ["./start.sh"]
