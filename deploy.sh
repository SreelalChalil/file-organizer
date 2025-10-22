#!/usr/bin/env sh
set -e

# deploy.sh - build & deploy both backend and UI for file-organizer
# - prefers podman, falls back to docker
# - builds images from backend/ and ui/
# - mounts persistent data dir for the backend DB/logs

REPO_ROOT=$(cd "$(dirname "$0")" && pwd)

# Backend settings
BACKEND_DIR="$REPO_ROOT/backend"
BACKEND_IMAGE="file-organizer-backend:local"
BACKEND_CONTAINER="file-organizer-backend"
HOST_DATA_DIR="$HOME/file-organizer-data"
CONTAINER_DATA_DIR="/data"
CONFIG_DB="$CONTAINER_DATA_DIR/db/config.db"
LOG_DIR="$CONTAINER_DATA_DIR/logs"

# UI settings
UI_DIR="$REPO_ROOT/ui"
UI_IMAGE="file-organizer-ui:local"
UI_CONTAINER="file-organizer-ui"

# Prefer podman if available, otherwise try docker
if command -v podman >/dev/null 2>&1; then
  CMD_BUILDER=podman
else
  CMD_BUILDER=docker
fi

echo "Using builder: $CMD_BUILDER"

################################################################################
# Backend
################################################################################

echo "Stopping any existing backend container named $BACKEND_CONTAINER (if running)"
if $CMD_BUILDER ps -a --format "{{.Names}}" | grep -w $BACKEND_CONTAINER >/dev/null 2>&1; then
  $CMD_BUILDER stop $BACKEND_CONTAINER >/dev/null 2>&1 || true
  $CMD_BUILDER rm $BACKEND_CONTAINER >/dev/null 2>&1 || true
fi

echo "Ensuring host data dir exists: $HOST_DATA_DIR"
mkdir -p "$HOST_DATA_DIR"

echo "Building backend image $BACKEND_IMAGE from $BACKEND_DIR"
cd "$BACKEND_DIR"
$CMD_BUILDER build -t $BACKEND_IMAGE .

echo "Running backend container $BACKEND_CONTAINER"
$CMD_BUILDER run -d --name $BACKEND_CONTAINER -p 8081:8080 \
  -v "$HOST_DATA_DIR:$CONTAINER_DATA_DIR" \
  -v "/mnt:/mnt" \
  -e CONFIG_DB=$CONFIG_DB \
  -e LOG_DIR=$LOG_DIR \
  -e ADMIN_PASSWORD=ubuntu \
  $BACKEND_IMAGE

echo "Backend deployed: http://localhost:8081"

################################################################################
# UI
################################################################################
echo "\n----- UI build/deploy -----"
if [ -d "$UI_DIR" ]; then  
  echo "Building UI image $UI_IMAGE from $UI_DIR"
  cd "$UI_DIR"
  $CMD_BUILDER build -t $UI_IMAGE .

  echo "Stopping any existing UI container named $UI_CONTAINER (if running)"
  if $CMD_BUILDER ps -a --format "{{.Names}}" | grep -w $UI_CONTAINER >/dev/null 2>&1; then
    $CMD_BUILDER stop $UI_CONTAINER >/dev/null 2>&1 || true
    $CMD_BUILDER rm $UI_CONTAINER >/dev/null 2>&1 || true
  fi

  echo "Running UI container $UI_CONTAINER"
  if [ "$CMD_BUILDER" = "podman" ]; then
    $CMD_BUILDER run -d --restart always --name $UI_CONTAINER -p 8082:80 --add-host=host.docker.internal:host-gateway $UI_IMAGE
  else # docker
    $CMD_BUILDER run -d --restart always --name $UI_CONTAINER -p 8082:80 --add-host=host.docker.internal:host-gateway $UI_IMAGE
  fi
  echo "UI deployed: http://localhost"
else
  echo "UI directory $UI_DIR not found; skipping UI deploy"
fi
