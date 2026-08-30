#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
OSRM_DIR="$ROOT_DIR/osrm"

printf 'Stopping all system services...\n'

# Kill processes listening on ports: 3001 (Backend), 5173 (Web), 8081 (Mobile)
PIDS=$(lsof -ti:3001,5173,8081 2>/dev/null)
if [ -n "$PIDS" ]; then
  printf '%s\n' "$PIDS" | xargs kill -9 2>/dev/null || true
  printf 'Killed processes on ports 3001, 5173, 8081.\n'
else
  printf 'No active processes found on ports 3001, 5173, 8081.\n'
fi

# Stop OSRM Docker container if running
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if [ -d "$OSRM_DIR" ]; then
    (cd "$OSRM_DIR" && docker compose down) >/dev/null 2>&1 || true
    printf 'OSRM container stopped.\n'
  fi
fi

printf 'All services have been stopped.\n'
