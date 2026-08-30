#!/usr/bin/env bash
# One-time setup: download the Vietnam OSM extract, cut out a Ho Chi Minh City
# region bbox from it (a full-country extract needs several GB of RAM to
# preprocess — far more than a laptop-scale Docker VM comfortably has, and
# this project's demo data never leaves the HCMC area anyway), then
# preprocess that smaller extract for OSRM's MLD engine (needed to serve both
# /nearest and /match from one dataset).
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p data

PBF_URL="https://download.geofabrik.de/asia/vietnam-latest.osm.pbf"
PBF_FILE="data/vietnam-latest.osm.pbf"
REGION_FILE="data/hcmc.osm.pbf"
# No single official osmium-tool image exists, so install the Ubuntu-packaged
# binary in a throwaway container instead of trusting a random third-party image.
UBUNTU_IMAGE="ubuntu:24.04"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend"

# Ho Chi Minh City + immediate neighboring provinces (Binh Duong, Dong Nai,
# Long An, Tay Ninh edges) — plenty of margin for realistic demo routes while
# keeping the node/edge count small enough to preprocess on a laptop.
BBOX="106.30,10.30,107.10,11.20"

if [ ! -f "$PBF_FILE" ]; then
  echo "Downloading Vietnam OSM extract..."
  curl -L -o "$PBF_FILE" "$PBF_URL"
else
  echo "Found existing $PBF_FILE, skipping download."
fi

if [ ! -f "$REGION_FILE" ]; then
  echo "Cutting out Ho Chi Minh City region ($BBOX)..."
  docker run --rm -t -v "$(pwd)/data:/data" "$UBUNTU_IMAGE" \
    bash -c "apt-get update -qq && apt-get install -y -qq osmium-tool && osmium extract -b $BBOX -o /data/hcmc.osm.pbf /data/vietnam-latest.osm.pbf"
else
  echo "Found existing $REGION_FILE, skipping extract."
fi

echo "Extracting road network (car profile)..."
docker run --rm -t -v "$(pwd)/data:/data" "$OSRM_IMAGE" \
  osrm-extract -p /opt/car.lua /data/hcmc.osm.pbf

echo "Partitioning graph (MLD)..."
docker run --rm -t -v "$(pwd)/data:/data" "$OSRM_IMAGE" \
  osrm-partition /data/hcmc.osrm

echo "Customizing graph (MLD)..."
docker run --rm -t -v "$(pwd)/data:/data" "$OSRM_IMAGE" \
  osrm-customize /data/hcmc.osrm

echo "Done. Start the server with: docker compose up"
