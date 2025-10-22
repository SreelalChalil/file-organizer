# File Organizer

A web-based application to automatically sort and organize files from a source directory into a structured set of destination folders based on configurable keyword rules. This project is fully containerized for easy and consistent deployment.

## Features

*   **Rule-Based Sorting**: Define categories with associated keywords and target directories.
*   **Disk Management**: Configure multiple source "disks" to be organized.
*   **Automated Scheduling**: Set schedules (e.g., daily, weekly) for each disk to run organization tasks automatically.
*   **Web UI**: A modern React frontend to manage all settings and view status.
*   **File Browser**: A built-in tool to browse, rename, and delete files on the configured mount points.
*   **Maintenance Tools**: Find and delete empty directories to keep your storage tidy.
*   **Run History & Logging**: View a history of past organization runs and stream live logs.
*   **Containerized**: Multi-architecture Docker images for `amd64` and `arm64`.

## Project Structure

```bash
file-organizer/
├── backend/  # Python Flask API
├── ui/       # React (Create React App) Frontend
└── deploy.sh # Deployment script
```

Quick dev run (ui):

```bash
cd file-organizer/ui
npm install
npm run dev
# or build and serve with the provided Dockerfile
podman build -t file-organizer-ui:local .
podman run --rm -p 80:80 file-organizer-ui:local
```

Notes:
- The backend expects to be accessible at the same host as the UI, so the UI fetches `/api/*` relative paths. When serving UI separately, ensure correct CORS or proxying.
- The backend initializes the SQLite DB on first run and will import `keyword_config.json` placed in the backend folder if the DB is empty.
- For production consider switching to a more robust scheduler and persistent job queue; also secure the admin endpoints.

CORS / Dev server notes:

- When running the UI with `npm run dev` (Vite) it uses a different origin (port 5173). You can either:
	- Run the UI build and serve it from the same origin as the backend (recommended for production), or
	- Enable CORS on the backend (the image includes `Flask-Cors` and the API enables CORS for `/api/*` and `/stream_logs`).

Example run (backend with host-mounted data for persistence):

```bash
# build backend image
cd file-organizer/backend
podman build -t file-organizer-backend:local .

# create a host directory for DB and logs
mkdir -p $HOME/file-organizer-data

# run container with env vars pointing into the mount
podman run --rm -p 8080:8080 -v $HOME/file-organizer-data:/data \
	-e CONFIG_DB=/data/config.db -e LOG_FILE=/data/organize.log file-organizer-backend:local
```
