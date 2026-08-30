#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"

BACKEND_DIR="$ROOT_DIR/vsmart-backend"
WEB_DIR="$ROOT_DIR/vsmart-web"
MOBILE_DIR="$ROOT_DIR/vsmart-mobile"
OSRM_DIR="$ROOT_DIR/vsmart-osrm"

MOBILE_MODE="off"
OSRM_MODE="auto"
INSTALL_ONLY=false
OSRM_STARTED_BY_SCRIPT=false
CLEANING_UP=false
START_BACKEND=true
START_WEB=true
START_MOBILE=false
TAIL_PID=""
SERVICE_PIDS=()
SERVICE_NAMES=()
LOG_FILES=()

usage() {
  cat <<'EOF'
Usage: ./start-system.sh [options]

Options:
  --mobile-only       Start only the Expo mobile app
  --web-only          Start only the React web dashboard
  --backend-only      Start only the Node.js backend
  --with-mobile       Start backend, web, and Expo mobile app
  --with-osrm         Require and start the local OSRM Docker service
  --without-osrm      Do not start OSRM
  --install           Install dependencies for all services and exit
  -h, --help          Show this help

Default behavior starts Backend (port 3001) and Web dashboard (port 5173).
EOF
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

is_port_in_use() {
  port="$1"
  command_exists lsof && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

env_value() {
  env_file="$1"
  env_name="$2"
  sed -n "s/^${env_name}=//p" "$env_file" | tail -n 1 | tr -d '\r'
}

require_env_value() {
  env_file="$1"
  env_name="$2"
  value="$(env_value "$env_file" "$env_name")"
  [ -n "$value" ] || fail "Missing $env_name in $env_file"
}

ensure_dependencies() {
  service_dir="$1"
  service_name="$2"
  if [ -d "$service_dir/node_modules" ]; then
    return
  fi
  fail "$service_name dependencies are missing. Run with --install or execute npm install in $service_dir"
}

start_service() {
  name="$1"
  service_dir="$2"
  command_line="$3"
  log_file="$LOG_DIR/$name.log"

  : > "$log_file"
  (
    cd "$service_dir" || exit 1
    exec /bin/sh -c "$command_line"
  ) >> "$log_file" 2>&1 &

  pid=$!
  SERVICE_NAMES+=("$name")
  SERVICE_PIDS+=("$pid")
  LOG_FILES+=("$log_file")
  printf 'Started %-8s pid=%s log=%s\n' "$name" "$pid" "$log_file"
}

stop_process_tree() {
  pid="$1"
  if kill -0 "$pid" >/dev/null 2>&1; then
    if command_exists pkill; then
      pkill -TERM -P "$pid" >/dev/null 2>&1 || true
    fi
    kill -TERM "$pid" >/dev/null 2>&1 || true
  fi
}

cleanup() {
  status="${1:-0}"
  if [ "$CLEANING_UP" = true ]; then
    return
  fi
  CLEANING_UP=true

  printf '\nStopping local services...\n'
  if [ -n "$TAIL_PID" ]; then
    kill "$TAIL_PID" >/dev/null 2>&1 || true
  fi

  if [ "${#SERVICE_PIDS[@]}" -gt 0 ]; then
    for pid in "${SERVICE_PIDS[@]}"; do
      stop_process_tree "$pid"
    done
  fi

  if [ "$OSRM_STARTED_BY_SCRIPT" = true ]; then
    (cd "$OSRM_DIR" && docker compose down) >/dev/null 2>&1 || true
  fi

  printf 'Stopped. Logs remain in %s\n' "$LOG_DIR"
  trap - EXIT
  exit "$status"
}

trap 'cleanup 130' INT TERM
trap 'cleanup $?' EXIT

while [ "$#" -gt 0 ]; do
  case "$1" in
    --mobile-only)
      START_BACKEND=false
      START_WEB=false
      START_MOBILE=true
      ;;
    --web-only)
      START_BACKEND=false
      START_WEB=true
      START_MOBILE=false
      ;;
    --backend-only)
      START_BACKEND=true
      START_WEB=false
      START_MOBILE=false
      ;;
    --with-mobile)
      START_MOBILE=true
      ;;
    --with-osrm) OSRM_MODE="on" ;;
    --without-osrm) OSRM_MODE="off" ;;
    --install) INSTALL_ONLY=true ;;
    -h|--help) usage; trap - EXIT; exit 0 ;;
    *) usage >&2; fail "Unknown option: $1" ;;
  esac
  shift
done

command_exists node || fail "Node.js is required"
command_exists npm || fail "npm is required"

if [ "$INSTALL_ONLY" = true ]; then
  install_package() {
    name="$1"
    dir="$2"
    printf 'Installing %s dependencies...\n' "$name"
    if [ -f "$dir/package-lock.json" ]; then
      (cd "$dir" && (npm ci || npm install)) || fail "Could not install $name dependencies"
    else
      (cd "$dir" && npm install) || fail "Could not install $name dependencies"
    fi
  }

  install_package "backend" "$BACKEND_DIR"
  install_package "web" "$WEB_DIR"
  if [ -d "$MOBILE_DIR" ]; then
    install_package "mobile" "$MOBILE_DIR"
  fi

  printf '\nAll dependencies installed successfully.\n'
  trap - EXIT
  exit 0
fi

if [ "$START_BACKEND" = true ]; then
  [ -f "$BACKEND_DIR/.env" ] || fail "Missing $BACKEND_DIR/.env"
  for key in COGNITO_USER_POOL_ID COGNITO_CLIENT_ID REALTIME_WEBHOOK_KEY; do
    require_env_value "$BACKEND_DIR/.env" "$key"
  done
  webhook_key="$(env_value "$BACKEND_DIR/.env" REALTIME_WEBHOOK_KEY)"
  if [ "${#webhook_key}" -lt 32 ] || printf '%s' "$webhook_key" | grep -q '^replace-with'; then
    fail "REALTIME_WEBHOOK_KEY must be a non-placeholder secret of at least 32 characters"
  fi
  ensure_dependencies "$BACKEND_DIR" "backend"
fi

if [ "$START_WEB" = true ]; then
  [ -f "$WEB_DIR/.env" ] || fail "Missing $WEB_DIR/.env"
  for key in VITE_BACKEND_URL VITE_AWS_REGION VITE_USER_POOL_ID VITE_USER_POOL_CLIENT_ID VITE_MAP_API_KEY; do
    require_env_value "$WEB_DIR/.env" "$key"
  done
  ensure_dependencies "$WEB_DIR" "web"
fi

if [ "$START_MOBILE" = true ]; then
  [ -f "$MOBILE_DIR/.env" ] || fail "Missing $MOBILE_DIR/.env; copy .env.example and configure it first"
  require_env_value "$MOBILE_DIR/.env" EXPO_PUBLIC_BACKEND_URL
  ensure_dependencies "$MOBILE_DIR" "mobile"
fi

START_OSRM=false
if [ "$OSRM_MODE" != "off" ] && [ "$START_BACKEND" = true ]; then
  if command_exists docker && docker info >/dev/null 2>&1; then
    if [ -f "$OSRM_DIR/data/hcmc.osrm" ] || [ -f "$OSRM_DIR/data/hcmc.osrm.partition" ]; then
      START_OSRM=true
    elif [ "$OSRM_MODE" = "on" ]; then
      fail "OSRM data is missing; run $OSRM_DIR/prepare-data.sh first"
    fi
  elif [ "$OSRM_MODE" = "on" ]; then
    fail "Docker is required for OSRM and must be running"
  fi
fi

mkdir -p "$LOG_DIR"

if [ "$START_OSRM" = true ]; then
  if ! (cd "$OSRM_DIR" && docker compose ps --status running --services 2>/dev/null) | grep -q '^osrm$'; then
    if ! is_port_in_use 5050; then
      printf 'Starting OSRM...\n'
      (cd "$OSRM_DIR" && docker compose up -d) || fail "Could not start OSRM"
      OSRM_STARTED_BY_SCRIPT=true
    fi
  else
    printf 'Using the OSRM container that is already running.\n'
  fi
fi

if [ "$START_BACKEND" = true ]; then
  if is_port_in_use 3001; then
    printf 'Backend is already running on port 3001 (reusing active instance).\n'
  else
    start_service "backend" "$BACKEND_DIR" "npm run dev"
  fi
fi

if [ "$START_WEB" = true ]; then
  if is_port_in_use 5173; then
    printf 'Web is already running on port 5173 (reusing active instance).\n'
  else
    start_service "web" "$WEB_DIR" "npm run dev -- --host 0.0.0.0"
  fi
fi

if [ "$START_MOBILE" = true ]; then
  if is_port_in_use 8081; then
    printf 'Mobile is already running on port 8081 (reusing active instance).\n'
  else
    start_service "mobile" "$MOBILE_DIR" "npm start -- --lan"
  fi
fi

printf '\nSystem endpoints:\n'
if [ "$START_BACKEND" = true ] || is_port_in_use 3001; then
  printf '  Backend: http://localhost:3001\n'
fi
if [ "$START_WEB" = true ] || is_port_in_use 5173; then
  printf '  Web:     http://localhost:5173\n'
fi
if [ "$START_MOBILE" = true ] || is_port_in_use 8081; then
  printf '  Expo:    http://localhost:8081\n'
fi
if [ "$START_OSRM" = true ] || is_port_in_use 5050; then
  printf '  OSRM:    http://localhost:5050\n'
fi
printf '\nPress Ctrl+C to stop services started by this script.\n\n'

if [ "${#LOG_FILES[@]}" -gt 0 ]; then
  tail -n 20 -F "${LOG_FILES[@]}" &
  TAIL_PID=$!
fi

while true; do
  if [ "${#SERVICE_PIDS[@]}" -eq 0 ]; then
    sleep 2
    continue
  fi

  index=0
  while [ "$index" -lt "${#SERVICE_PIDS[@]}" ]; do
    pid="${SERVICE_PIDS[$index]}"
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      set +e
      wait "$pid"
      service_status=$?
      set -e
      printf '\n%s exited with status %s. See %s/%s.log\n' \
        "${SERVICE_NAMES[$index]}" "$service_status" "$LOG_DIR" "${SERVICE_NAMES[$index]}" >&2
      cleanup "$service_status"
    fi
    index=$((index + 1))
  done
  sleep 2
done
