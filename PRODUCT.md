# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Note: this product has a second, separate native surface — `vsmart-app/` (Expo/React Native, targeting iOS + Android). This root record's Platform value describes the web dashboard; scoped design work against `vsmart-app/` should treat platform as native and load iOS/Android guidance as needed.

## Users

Individual vehicle owners tracking and protecting a vehicle (car or motorbike) they personally own — not commercial fleet operators or multi-driver businesses. Each device belongs to exactly one owner (`ownerUserId`), enforced end to end; there is no team, driver, or shared-access role in the system today. Their job: know where their vehicle is right now, and find out immediately if it's moved or tampered with while parked.

## Product Purpose

Give a vehicle owner continuous, real-time visibility into their vehicle's location and automatic protection against theft while it's parked — without them running any infrastructure. Success means the owner trusts that a breach or unauthorized move will reach them within seconds, and that they can always see (live) or replay (history) where the vehicle has been.

## Positioning

Three things a generic consumer GPS-tracker app can't truthfully claim:

1. **Event-driven, not polled** — position updates and alerts push to the client the moment AWS IoT Core receives them (IoT Core → Lambda → DynamoDB/Location Service → webhook → Socket.io), not on a refresh/poll cycle.
2. **Zero-configuration anti-theft** — enabling protection auto-creates a 2m geofence at the vehicle's current parked position and self-disables after one breach alert; the owner never draws a protection zone by hand.
3. **A working, real AWS architecture, not a mockup** — this is a graduation-thesis engineering demonstration. The product truth and any design work must read as an actually-operating serverless system (real IoT Core, real Lambda, real Location Service), because that credibility is the point being evaluated, even though the audience for the *product itself* is a single vehicle owner, not an enterprise buyer. (The README's "Fleet Management" title is the thesis's formal name, not evidence of a multi-vehicle business audience — see Users above.)

## Operating Context

- Owner registers a device (manual entry on web, or camera QR/barcode scan on mobile), views its live position on a map, draws/manages geofences, replays a chosen day's position history, and can enable one-tap anti-theft on a parked vehicle — all from either surface.
- Two UI surfaces share one backend and one user identity: **web dashboard** (`tracking-data-streaming-datn/`, full feature set: Dashboard, Map View, Devices, Geofences, Settings) and **mobile companion app** (`vsmart-app/`, Expo/React Native, iOS + Android; adds camera-based device registration the web dashboard doesn't have).
- Runs on real AWS infrastructure in `ap-southeast-1` (Singapore); demo/simulator GPS data is centered on Ho Chi Minh City.
- Auth via Amazon Cognito (sign up, sign in, email confirmation); device data is a merge of DynamoDB (metadata) and Amazon Location Service (live position, geofences).

## Capabilities and Constraints

- Confirmed: real-time GPS tracking, geofencing (polygon/circle) with enter/exit alerts, automatic anti-theft (auto 2m geofence, self-disabling after one breach), position history replay, device CRUD, Cognito-based auth. A local-dev-only road-snapping (map-matching) feature was just added on the backend to make the live marker and history replay follow roads instead of raw GPS jitter.
- One owner per device is a hard constraint, enforced server-side on every device/anti-theft/geofence code path (see `.agents/AGENTS.md`) — not just a UI convention.
- No multi-driver/team/role model exists; undecided whether one will ever be needed (explicitly out of scope for now — audience is individual owners).
- This is an academic graduation project, not a system currently serving paying customers — evaluated as an engineering demonstration.
- Fully serverless backend/infra (Lambda, DynamoDB, Amazon Location Service, IoT Core, EventBridge, SQS, SNS, Cognito) — no persistent server process holds state other than the stateless Node/Express API + Socket.io proxy.

## Brand Commitments

- Product name: **VSmart Tracking** (full), **VSmart** (short form, used as the web sidebar wordmark).
- Existing color identity (not yet unified into shared tokens — evidence, not a decided system): web dashboard's primary accent is Tailwind indigo (`indigo-600`, ≈ `#4F46E5`); mobile app uses a violet/purple accent (`#7C3AED`) for its notification icon and a dark navy (`#0B0F1A`) adaptive-icon background.
- Existing logo: an abstract three-bar "waveform" glyph in an indigo-tinted rounded tile, used in the web sidebar. The mobile app icon is a separate asset (`vsmart-app/assets/icon.png`), not audited here.
- **Standing visual-world preference (confirmed):** after seeing a first oblique direction (a sewing-pattern-envelope world) built and reviewed, the user pinned the **category-standard consumer tracking/security-app look**, played straight at full craft, over any oblique metaphor — referencing **Life360, Apple Find My, and the Tesla app** as the craft bar. This means: a live map as the product's own visual center (not decorative), dark UI as the default surface, floating status cards/pills for live state, and the existing indigo/violet identity unified rather than replaced. Any future new-work round for this product should treat this as the committed world and skip re-rolling a different aesthetic unless the user asks again.

## Evidence on Hand

- `README.md` at the repo root: full architecture (Mermaid diagrams), AWS resource inventory, per-workflow sequence diagrams, and API reference — treat as the authoritative technical source.
- The described feature set is implemented and running, not a mockup: both UI surfaces have real, working screens (web: Tailwind + Lucide icons; mobile: native Expo components).
- No customer testimonials, case studies, press mentions, benchmarks, or production user base exist. This is pre-launch/academic — future design or copy work must not invent any of these.
- No `DESIGN.md` exists yet; `/impeccable document` is the natural next step to capture the incumbent visual system deliberately.

## Product Principles

1. Every position update and alert reaches the owner within seconds, event-driven end to end — never make the owner poll or refresh to learn something changed.
2. Protecting a parked vehicle takes one tap, not manual setup — anti-theft stays zero-configuration.
3. The product serves one owner and their own vehicle(s) — every device-facing action must be provably scoped to that owner; never assume shared or team access.
4. Credibility rests on a real, running AWS architecture — design and copy should reflect an actually-operating system, not a demo veneer.
5. Web and mobile are two views onto the same live state, not two separate products — parity in what an owner can see and do, aside from mobile's device-registration scanning.
