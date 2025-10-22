#!/bin/sh

# Start Gunicorn
# The --preload flag is important for the in-memory task status to work
# across multiple workers, though a shared store like Redis is better for production.

gunicorn --workers 3 --bind 0.0.0.0:8080 --preload app.api:app