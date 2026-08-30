# Local OSRM (road-snapping)

Self-hosted [OSRM](https://project-osrm.org/) instance used by the backend to snap noisy
GPS points onto the road network — the live vehicle marker (`/nearest`) and the
Position History replay line (`/match`). Runs locally via Docker for development/demo
only; production deploys (Render/S3) work fine without it and simply fall back to raw,
unsnapped positions when `OSRM_URL` isn't set or the service isn't reachable.

The preprocessed dataset covers Ho Chi Minh City + neighboring provinces only (not all
of Vietnam) — a full-country extract has ~26M nodes and needs several GB of RAM just to
build the edge-expanded graph, which reliably OOM-kills a laptop-scale Docker VM. Since
this project's demo/simulator data never leaves the HCMC area, `prepare-data.sh` cuts a
bounding box out of the Vietnam extract with `osmium extract` before handing it to OSRM.

## Quick start

```bash
./prepare-data.sh   # one-time: downloads the Vietnam extract and builds the MLD graph
docker compose up   # starts OSRM on http://localhost:5050
```

Then in `vsmart-backend/.env`:

```env
OSRM_URL=http://localhost:5050
OSRM_TIMEOUT_MS=800
```

## Sanity check

```bash
curl "http://localhost:5050/nearest/v1/driving/106.7864,10.8481"
```

Should return a JSON body with a `waypoints[0].location` snapped onto the nearest road.

## Notes

- `prepare-data.sh` only needs to run once (or again if you delete `data/`); the
  preprocessed graph is reused across `docker compose up` restarts.
- `data/` is gitignored — it contains a ~110MB `.osm.pbf` download plus several hundred
  MB of generated `.osrm*` graph files.
- Requires Docker to be installed and running.
