require('dotenv').config();

const fs = require('fs');
const { IoTClient, DescribeEndpointCommand } = require('@aws-sdk/client-iot');
const { IoTDataPlaneClient, PublishCommand } = require('@aws-sdk/client-iot-data-plane');

/**
 * drive-route.js — simulate a device driving ALONG A REAL ROAD and publish the
 * telemetry into the tracking pipeline (AWS IoT -> Lambda -> Socket.io), so you
 * can watch the web / app marker and check it hugs the road.
 *
 * Route source (first match wins):
 *   --from "lat,lng" --to "lat,lng"   → fetch a driving route from OSRM
 *   --geojson <file>                  → a GeoJSON LineString / Feature / {coordinates}
 *   --gpx <file>                      → a GPX track (<trkpt lat lon>)
 *
 * Options:
 *   --device <id>       device id in the payload         (default: TEST_DEVICE_ID or Vehicle-001)
 *   --speed <kmh>       driving speed                     (default: 30)
 *   --interval <sec>    telemetry publish cadence         (default: 3)
 *   --jitter <m>        random offset per point, metres   (default: 0 — set ~8 to fake GPS noise)
 *   --osrm <url>        OSRM base url                      (default: OSRM_URL env, else public OSRM)
 *   --loop             restart at the end
 *   --pingpong         reverse direction at the end
 *   --max <n>          stop after n published points (handy for a quick test)
 *   --dry-run          print points, do not publish to IoT
 *   --report           after the run, score the published track against OSRM /match
 *
 * Examples:
 *   node scripts/drive-route.js --from "10.7769,106.7009" --to "10.8231,106.6297" --speed 35
 *   node scripts/drive-route.js --gpx my-commute.gpx --device Vehicle-002 --jitter 8 --report
 *   node scripts/drive-route.js --geojson route.json --loop
 */

// ─── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getFlag = (name) => args.includes(`--${name}`);
const getOpt = (name, def) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

const REGION = process.env.AWS_REGION || 'us-east-1';
const MQTT_TOPIC = process.env.IOT_LOCATION_TOPIC || 'location';
const DEVICE_ID = getOpt('device', process.env.TEST_DEVICE_ID || 'Vehicle-001');
const SPEED_KMH = Number(getOpt('speed', 30));
const INTERVAL_S = Number(getOpt('interval', 3));
const JITTER_M = Number(getOpt('jitter', 0));
const OSRM_URL = (getOpt('osrm', process.env.OSRM_URL) || 'https://router.project-osrm.org').replace(/\/$/, '');
const LOOP = getFlag('loop');
const PINGPONG = getFlag('pingpong');
const MAX_POINTS = Number(getOpt('max', 0)) || Infinity;
const DRY_RUN = getFlag('dry-run');
const REPORT = getFlag('report');

if (![SPEED_KMH, INTERVAL_S].every((n) => Number.isFinite(n) && n > 0)) {
    console.error('❌ --speed and --interval must be positive numbers');
    process.exit(1);
}

// ─── geo helpers ──────────────────────────────────────────────────────────────
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function metres([lng1, lat1], [lng2, lat2]) {
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing([lng1, lat1], [lng2, lat2]) {
    const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
    const x =
        Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
        Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
    return (deg(Math.atan2(y, x)) + 360) % 360;
}

// offset a point by dx/dy metres (small-distance flat-earth approximation)
function jitter([lng, lat]) {
    if (!JITTER_M) return [lng, lat];
    const dN = (Math.random() * 2 - 1) * JITTER_M;
    const dE = (Math.random() * 2 - 1) * JITTER_M;
    return [
        lng + (dE / (R * Math.cos(rad(lat)))) * (180 / Math.PI),
        lat + (dN / R) * (180 / Math.PI),
    ];
}

async function fetchWithTimeout(url, ms = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { signal: ctrl.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ─── route loading ────────────────────────────────────────────────────────────
async function loadRoute() {
    const geojsonFile = getOpt('geojson');
    const gpxFile = getOpt('gpx');
    const from = getOpt('from');
    const to = getOpt('to');

    if (geojsonFile) return { coords: fromGeoJSON(JSON.parse(fs.readFileSync(geojsonFile, 'utf8'))), src: geojsonFile };
    if (gpxFile) return { coords: fromGPX(fs.readFileSync(gpxFile, 'utf8')), src: gpxFile };
    if (from && to) return { coords: await fromOSRM(from, to), src: `OSRM ${from} → ${to}` };

    console.error('❌ Provide a route: --from "lat,lng" --to "lat,lng"  |  --geojson <file>  |  --gpx <file>');
    process.exit(1);
}

function parseLatLng(text) {
    const [lat, lng] = String(text).split(',').map((n) => Number(n.trim()));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.error(`❌ Bad coordinate "${text}" — expected "lat,lng"`);
        process.exit(1);
    }
    return [lng, lat];
}

async function fromOSRM(from, to) {
    const a = parseLatLng(from);
    const b = parseLatLng(to);
    const url = `${OSRM_URL}/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson`;
    console.log(`🌐 Fetching route from ${url}`);
    const res = await fetchWithTimeout(url).catch((err) => {
        console.error(`❌ Could not reach OSRM at ${OSRM_URL} (${err.message}).`);
        console.error('   Start the local one with  ./start-system.sh --with-osrm  or pass');
        console.error('   --osrm https://router.project-osrm.org  to use the public server.');
        process.exit(1);
    });
    if (!res.ok) {
        console.error(`❌ OSRM route request failed: ${res.status} ${res.statusText}`);
        process.exit(1);
    }
    const json = await res.json();
    const coords = json?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
        console.error('❌ OSRM returned no route geometry');
        process.exit(1);
    }
    return coords;
}

function fromGeoJSON(obj) {
    const findLine = (g) => {
        if (!g) return null;
        if (g.type === 'FeatureCollection') return g.features.map((f) => findLine(f.geometry)).find(Boolean);
        if (g.type === 'Feature') return findLine(g.geometry);
        if (g.type === 'LineString') return g.coordinates;
        if (g.type === 'MultiLineString') return g.coordinates.flat();
        if (Array.isArray(g.coordinates)) return g.coordinates;
        return null;
    };
    const coords = findLine(obj);
    if (!Array.isArray(coords) || coords.length < 2) {
        console.error('❌ No LineString coordinates found in the GeoJSON');
        process.exit(1);
    }
    return coords.map(([lng, lat]) => [lng, lat]);
}

function fromGPX(xml) {
    const pts = [];
    const re = /<(?:trkpt|rtept|wpt)\b([^>]*)>/g;
    let m;
    while ((m = re.exec(xml))) {
        const lat = /\blat="([-\d.]+)"/.exec(m[1]);
        const lon = /\blon="([-\d.]+)"/.exec(m[1]);
        if (lat && lon) pts.push([Number(lon[1]), Number(lat[1])]);
    }
    if (pts.length < 2) {
        console.error('❌ No <trkpt>/<rtept>/<wpt> points found in the GPX');
        process.exit(1);
    }
    return pts;
}

// ─── build a distance-parameterised polyline ──────────────────────────────────
function cumulative(coords) {
    const cum = [0];
    for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + metres(coords[i - 1], coords[i]));
    return cum;
}

// position + heading at `d` metres along the polyline (clamped at the ends)
function at(coords, cum, d) {
    const total = cum[cum.length - 1];
    if (d <= 0) return { pos: coords[0], hdg: bearing(coords[0], coords[1]) };
    if (d >= total) {
        const n = coords.length - 1;
        return { pos: coords[n], hdg: bearing(coords[n - 1], coords[n]) };
    }
    let i = 1;
    while (cum[i] < d) i++;
    const segLen = cum[i] - cum[i - 1] || 1;
    const f = (d - cum[i - 1]) / segLen;
    const [x1, y1] = coords[i - 1];
    const [x2, y2] = coords[i];
    return { pos: [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f], hdg: bearing(coords[i - 1], coords[i]) };
}

// ─── IoT publish ──────────────────────────────────────────────────────────────
let iotDataClient = null;
async function getIot() {
    if (iotDataClient) return iotDataClient;
    const iot = new IoTClient({ region: REGION });
    const { endpointAddress } = await iot.send(new DescribeEndpointCommand({ endpointType: 'iot:Data-ATS' }));
    iotDataClient = new IoTDataPlaneClient({ region: REGION, endpoint: `https://${endpointAddress}` });
    return iotDataClient;
}

async function publish(pos, hdg) {
    const payload = {
        payload: {
            deviceid: DEVICE_ID,
            timestamp: Math.floor(Date.now() / 1000),
            location: { lat: pos[1], long: pos[0] },
            positionProperties: {
                speed: String(Math.round(SPEED_KMH)),
                heading: String(Math.round(hdg)),
            },
        },
    };
    if (DRY_RUN) return;
    const client = await getIot();
    await client.send(new PublishCommand({
        topic: MQTT_TOPIC,
        payload: Buffer.from(JSON.stringify(payload)),
        qos: 0,
    }));
}

// ─── /match report ────────────────────────────────────────────────────────────
async function report(published) {
    if (published.length < 2) return;
    console.log(`\n📊 Scoring ${published.length} published points against ${OSRM_URL}/match ...`);
    // keep points at least ~5 m apart with strictly increasing whole-second
    // timestamps — OSRM /match rejects duplicates / non-monotonic time
    const chunk = [];
    let lastSec = -1;
    for (const p of published.slice(0, 300)) {
        const sec = Math.round(p.t / 1000);
        if (chunk.length && metres(chunk[chunk.length - 1].pos, p.pos) < 5) continue;
        if (sec <= lastSec) continue;
        lastSec = sec;
        chunk.push({ pos: p.pos, sec });
        if (chunk.length >= 100) break;
    }
    if (chunk.length < 2) {
        console.log('   ⚠️  not enough spread-out points to score (use a realistic --interval)');
        return;
    }
    const coords = chunk.map((p) => `${p.pos[0]},${p.pos[1]}`).join(';');
    const ts = chunk.map((p) => p.sec).join(';');
    const url = `${OSRM_URL}/match/v1/driving/${coords}?timestamps=${ts}&geometries=geojson&overview=full&radiuses=${chunk.map(() => 25).join(';')}`;
    const res = await fetchWithTimeout(url, 12000).catch(() => null);
    const json = res && res.ok ? await res.json() : null;
    if (!json || json.code !== 'Ok') {
        console.log(`   ⚠️  OSRM /match unavailable (${json?.code || res?.status || 'no response'})`);
        return;
    }
    const confidences = (json.matchings || []).map((m) => m.confidence);
    const offsets = (json.tracepoints || [])
        .map((tp, i) => (tp && tp.location ? metres(tp.location, chunk[i].pos) : null))
        .filter((n) => n != null);
    const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
    console.log(`   matchings           : ${json.matchings?.length ?? 0}`);
    console.log(`   confidence (avg)    : ${avg(confidences).toFixed(3)}  [${confidences.map((c) => c.toFixed(2)).join(', ')}]`);
    console.log(`   raw→road offset avg : ${avg(offsets).toFixed(1)} m   max ${Math.max(...offsets).toFixed(1)} m`);
    console.log('   (low offset + confidence ~1.0 ⇒ the track rides the road)');
}

// ─── drive ────────────────────────────────────────────────────────────────────
async function main() {
    const { coords, src } = await loadRoute();
    const cum = cumulative(coords);
    const total = cum[cum.length - 1];
    const stepM = (SPEED_KMH / 3.6) * INTERVAL_S;
    const etaMin = total / 1000 / SPEED_KMH * 60;

    console.log('──────────────────────────────────────────────────────────────');
    console.log(` 🚗 DRIVE ROUTE`);
    console.log(`  route      : ${src}`);
    console.log(`  points     : ${coords.length}  ·  length ${(total / 1000).toFixed(2)} km`);
    console.log(`  device     : ${DEVICE_ID}   topic "${MQTT_TOPIC}"   region ${REGION}`);
    console.log(`  speed      : ${SPEED_KMH} km/h  →  ${stepM.toFixed(stepM < 10 ? 1 : 0)} m every ${INTERVAL_S}s  ·  ETA ${etaMin.toFixed(1)} min`);
    console.log(`  jitter     : ${JITTER_M ? JITTER_M + ' m' : 'off'}`);
    console.log(`  mode       : ${DRY_RUN ? 'DRY-RUN (no publish)' : 'publishing'}${LOOP ? ' · loop' : ''}${PINGPONG ? ' · pingpong' : ''}`);
    console.log(`  start      : https://www.google.com/maps?q=${coords[0][1]},${coords[0][0]}`);
    console.log('──────────────────────────────────────────────────────────────\n');

    const published = [];
    let d = 0;
    let dir = 1;
    let n = 0;
    let stopped = false;
    process.on('SIGINT', () => { stopped = true; });

    while (!stopped) {
        const { pos, hdg } = at(coords, cum, d);
        const out = jitter(pos);
        const t = Date.now();
        try {
            await publish(out, hdg);
            published.push({ pos: out, t });
            n++;
            const line = `#${String(n).padStart(4)}  ${out[1].toFixed(6)}, ${out[0].toFixed(6)}  hdg ${String(Math.round(hdg)).padStart(3)}°  ${(d / 1000).toFixed(2)}/${(total / 1000).toFixed(2)} km`;
            if (process.stdout.isTTY) process.stdout.write(`\r${line}   `);
            else if (n % 10 === 1) console.log(line);
        } catch (err) {
            console.error(`\n❌ publish failed: ${err.message}`);
            break;
        }

        if (n >= MAX_POINTS) break;

        d += stepM * dir;
        if (d >= total || d <= 0) {
            if (PINGPONG) { dir *= -1; d = Math.max(0, Math.min(total, d)); }
            else if (LOOP) { d = 0; }
            else break;
        }

        await new Promise((r) => setTimeout(r, INTERVAL_S * 1000));
    }

    console.log(`\n\n✅ Done — ${n} points published for ${DEVICE_ID}.`);
    if (REPORT && !DRY_RUN) await report(published);
    else if (REPORT) await report(published);
}

main().catch((err) => {
    console.error('❌', err);
    process.exit(1);
});
