# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

## Repository overview

This is a graduation-thesis IoT fleet-tracking system ("Smart Fleet Management" / vsmart), not a single application. It is **not a git repo at the top level** and has **no root package.json** — it's five independent, separately-deployed modules living side by side. Always `cd` into the relevant module before running any install/build/lint/test command; there is no workspace tooling tying them together.

| Module | Stack | Role |
|---|---|---|
| `tracking-data-streaming-infrastructure/` | AWS SAM/CloudFormation (`template.yml`), Python 3.12 Lambdas | IaC for all AWS resources (IoT Core, Location Service, DynamoDB, EventBridge, SQS, SNS, Cognito) |
| `tracking-data-streaming-backend/` | Node.js + Express + Socket.io | REST API, JWT auth, Socket.io WebSocket proxy, anti-theft background worker |
| `tracking-data-streaming-datn/` | React 19 + Vite 8 + Tailwind + MapLibre GL | Web dashboard |
| `vsmart-app/` | React Native (Expo SDK 54, file-based router) | Mobile app |
| `vsmart-iot/` | PlatformIO / Arduino (ESP32) | GPS device firmware (`gps_neo7m.ino`, NEO-6M/7M GPS module) |

`guidance-for-tracking-assets-and-locating-devices-using-aws-iot/` is a vendored AWS reference sample kept for guidance only — treat it as read-only reference material, not part of the app.

Full architecture diagrams (Mermaid), sequence diagrams for each workflow (telemetry ingestion, device registration, geofencing, anti-theft, offline detection), the AWS resource list, deployment steps, and the API reference all live in [README.md](README.md) — read it before making architecture-level changes rather than re-deriving the design from code.

## Commands

### Backend (`tracking-data-streaming-backend/`)
```bash
npm install
npm run dev      # node index.js — plain run, no reload
npm start        # nodemon index.js — auto-reload dev server (despite the name, this is the reload variant)
```
Runs on port 3001. Requires a populated `.env` (see `README.md` §3.2 for all vars: AWS creds, DynamoDB table names, Location tracker/collection names, Cognito pool IDs, `REALTIME_WEBHOOK_KEY`). No test suite is configured (`npm test` is a stub).

GPS simulation for local end-to-end testing (publishes MQTT via AWS IoT Core):
```bash
node scripts/interactive-move.js
# at the prompt: auto <lat> <lng> <intervalSeconds>
```

### Web dashboard (`tracking-data-streaming-datn/`)
```bash
npm install
npm run dev       # Vite dev server on :5173
npm run build
npm run lint      # eslint .
npm run preview
```

### Mobile app (`vsmart-app/`)
```bash
npm install
npm start         # expo start (scan QR with Expo Go)
npm run android
npm run ios
npm run lint       # expo lint
```
Requires editing `src/configuration.js` with the machine's LAN IP for `BACKEND_URL` (not `localhost` — the device connects over LAN).

### Infrastructure (`tracking-data-streaming-infrastructure/`)
```bash
aws cloudformation package --template-file template.yml --s3-bucket <bucket> --output-template-file packaged.yml --region ap-southeast-1
aws cloudformation deploy --template-file packaged.yml --stack-name TrackingDATN-UnifiedStack --capabilities CAPABILITY_NAMED_IAM --parameter-overrides AlertEmail=<email> BackendWebhookUrl=<ngrok-or-render-url> --region ap-southeast-1
```
Lambda functions are Python 3.12 under `lambda/<function-name>/`. A local backend needs to be reachable from AWS (via `ngrok http 3001` in dev) since Lambdas call it as a webhook.

### Firmware (`vsmart-iot/`)
PlatformIO project targeting `esp32doit-devkit-v1`; standard `pio run` / `pio run -t upload` / `pio device monitor` from that directory.

## Architecture notes

- **Dual data pipeline**: device metadata (name, plate, ownership) lives in DynamoDB (`TrackingDATN-Devices`, `TrackingDATN-DeviceState`); live coordinates and geofence evaluation live in Amazon Location Service (Tracker + GeofenceCollection). The backend's `deviceController`/`dynamoService`/`locationService` merge both sources on read.
- **Ingestion never talks to the backend synchronously for storage** — GPS devices publish MQTT to AWS IoT Core, which triggers the `iot-message-processor` Lambda; that Lambda writes to DynamoDB/Location Tracker directly and then calls the backend only via an authenticated HTTP webhook (`POST /api/realtime/event`, guarded by `REALTIME_WEBHOOK_KEY`) purely to fan the event out over Socket.io to connected clients.
- **Geofence breaches and offline detection are event-driven, not polled by the backend**: Location Service → EventBridge → SQS → `geofence-event-consumer` Lambda → webhook; a separate `offline-detector` Lambda runs on an EventBridge cron (1 min) and marks devices offline after 120s of silence.
- **Anti-theft is a hybrid**: enabling it creates a 2m-radius geofence via the backend, but breach detection is polled client-side-adjacent by `antitheftWorker.js` (in-process interval, every 15s) rather than relying on the Lambda geofence pipeline, then disables itself after alerting to avoid spamming.
- **Auth**: Amazon Cognito User Pools issue JWTs verified by backend middleware (`src/middleware/auth.js`); Cognito Identity Pools separately hand out temporary AWS credentials directly to the web/mobile clients so they can fetch Location Service map tiles without proxying through the backend.
- **Ownership checks are mandatory and non-negotiable** (see `.agents/AGENTS.md`): every CRUD/anti-theft/geofencing code path touching a device must resolve `ownerUserId` from the verified Cognito JWT and compare it against the device's owner attribute in DynamoDB, returning `403 Forbidden: "Forbidden: You do not own this device"` on mismatch. Device list queries must use the `ownerUserId-index` GSI with `QueryCommand` — never a broad `ScanCommand` filtered in memory.
