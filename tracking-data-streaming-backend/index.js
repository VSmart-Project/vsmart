require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const crypto = require('crypto');

const authRoutes = require('./src/routes/auth');
const deviceRoutes = require('./src/routes/devices');
const antitheftRoutes = require('./src/routes/antitheft');
const geofenceRoutes = require('./src/routes/geofences');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { requireAuth, verifyJwt } = require('./src/middleware/auth');
const mapMatchingService = require('./src/services/mapMatchingService');
const { createPositionEnricher } = require('./src/services/positionEnrichment');
const { realtimeConfig } = require('./src/config/realtime');
const {
    APP_EVENTS_TOPIC_TEMPLATE,
    DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE,
    RAW_TELEMETRY_TOPIC_TEMPLATE,
    REALTIME_EVENT_TYPES,
    REALTIME_SCHEMA_VERSION,
    SAMPLE_REALTIME_EVENTS,
    validateRealtimeEnvelope,
} = require('./src/config/realtimeEventSchema');

const app = express();
const PORT = process.env.PORT || 3001;
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }
});

app.set('io', io);

// Enriches device.position.updated events (serverTs / fixSeq / derived heading)
// so the web + mobile smoothing layer can interpolate the sparse GPS stream.
const positionEnricher = createPositionEnricher();

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token || typeof token !== 'string') {
            return next(new Error('Unauthorized'));
        }
        const user = await verifyJwt(token);
        if (!user.sub) return next(new Error('Unauthorized'));
        socket.data.user = user;
        socket.join(`user:${user.sub}`);
        return next();
    } catch (_error) {
        return next(new Error('Unauthorized'));
    }
});

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────

// Security headers
app.use(helmet());

// CORS — restrict to frontend origin only
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Parse JSON body
app.use(express.json({ limit: '1mb' }));

// ─── ROUTES ───────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
    const sampleValidation = Object.fromEntries(
        Object.entries(SAMPLE_REALTIME_EVENTS).map(([name, event]) => [
            name,
            validateRealtimeEnvelope(event).valid,
        ])
    );

    res.json({
        status: 'ok',
        service: 'tracking-data-streaming-backend',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        rollout: {
            realtimeEnabled: realtimeConfig.enabled,
            realtimePublishEvents: realtimeConfig.publishEvents,
            realtimeAllowClientSubscribe: realtimeConfig.allowClientSubscribe,
            realtimeTransport: realtimeConfig.transport,
            realtimeFallbackPollIntervalMs: realtimeConfig.fallbackPollIntervalMs,
        },
        realtimeSchema: {
            version: REALTIME_SCHEMA_VERSION,
            eventTypes: Object.values(REALTIME_EVENT_TYPES),
            topics: {
                appEvents: APP_EVENTS_TOPIC_TEMPLATE,
                rawTelemetry: RAW_TELEMETRY_TOPIC_TEMPLATE,
                deviceDebug: DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE,
            },
            sampleValidation,
        },
    });
});

// Swagger Documentation API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }', // Ẩn topbar mặc định cho đẹp
    customSiteTitle: 'VSmart API Docs',
}));

// Auth routes (public — no JWT required)
app.use('/api/auth', authRoutes);

// API routes (protected by JWT)
app.use('/api/devices', requireAuth, deviceRoutes);
app.use('/api/antitheft', requireAuth, antitheftRoutes);
app.use('/api/geofences', requireAuth, geofenceRoutes);

// Webhook for AWS Lambda to publish real-time events
app.post('/api/realtime/event', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.REALTIME_WEBHOOK_KEY;
    const suppliedKey = typeof apiKey === 'string' ? Buffer.from(apiKey) : Buffer.alloc(0);
    const configuredKey = typeof expectedKey === 'string' ? Buffer.from(expectedKey) : Buffer.alloc(0);
    const authorized = configuredKey.length >= 32
        && suppliedKey.length === configuredKey.length
        && crypto.timingSafeEqual(suppliedKey, configuredKey);
    if (!authorized) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const event = req.body;
    const validation = validateRealtimeEnvelope(event);
    if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.reason });
    }
    console.log(`Received real-time event from Lambda: ${event.type} for device ${event.deviceId}`);

    const io = req.app.get('io');
    const userId = event.userId;
    const isPositionEvent = event.type === REALTIME_EVENT_TYPES.DEVICE_POSITION_UPDATED;
    const outboundEvent = isPositionEvent ? positionEnricher.enrichRaw(event) : event;
    if (io && userId && userId !== 'unknown') {
        io.to(`user:${userId}`).emit('realtime-event', outboundEvent);
        console.log(`Broadcasted realtime event to user:${userId}`);
    }

    // Respond immediately — road-snapping below must never add latency to ingestion.
    res.json({ success: true });

    // Fire-and-forget: try to snap the raw position onto the road network and
    // push a lightweight follow-up update. Silently does nothing if OSRM_URL
    // is unset or OSRM is unreachable/slow — the raw event above already went out.
    if (io && userId && userId !== 'unknown' && isPositionEvent) {
        const [lng, lat] = event.payload?.position || [];
        const prevPos = positionEnricher.peekPrevPos(event.deviceId);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            mapMatchingService.snapToRoad(event.deviceId, lat, lng)
                .then(async (snapped) => {
                    if (!snapped) return;
                    // Road geometry from the previous fix to this snapped one, so
                    // the client animates the marker ALONG the road for this
                    // interval instead of a straight chord (null ⇒ client splines).
                    const pathFromPrev = prevPos
                        ? await mapMatchingService.routeBetween(prevPos, snapped)
                        : null;
                    // Same fixSeq as the raw fix above + correction:true, so the
                    // client re-targets that fix in place instead of treating the
                    // snapped position as a new jump.
                    const snappedEvent = positionEnricher.enrichCorrection({
                        ...event,
                        eventId: `${event.eventId}-snapped`,
                        timestamp: event.timestamp + 1,
                        payload: {
                            ...event.payload,
                            position: [snapped.lng, snapped.lat],
                        },
                    }, pathFromPrev);
                    io.to(`user:${userId}`).emit('realtime-event', snappedEvent);
                })
                .catch((err) => {
                    console.error('[Realtime] snapToRoad follow-up failed:', err.message);
                });
        }
    }
});

// ─── ERROR HANDLING ───────────────────────────────────────────────────────

// 404 for unmatched routes
app.use(notFoundHandler);

// Central error handler (MUST be last)
app.use(errorHandler);

// ─── START ────────────────────────────────────────────────────────────────

const assertRuntimeConfig = () => {
    const required = ['COGNITO_USER_POOL_ID', 'COGNITO_CLIENT_ID', 'REALTIME_WEBHOOK_KEY'];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    if (process.env.REALTIME_WEBHOOK_KEY.length < 32) {
        throw new Error('REALTIME_WEBHOOK_KEY must contain at least 32 characters');
    }
};

const startServer = () => {
    assertRuntimeConfig();
    return server.listen(PORT, () => {
    console.log(`\nBackend server running on http://localhost:${PORT}`);
    console.log(`   Environment  : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   DynamoDB     : ${process.env.DYNAMODB_DEVICES_TABLE || 'TrackingDATN-Devices'}`);
    console.log(`   Tracker      : ${process.env.LOCATION_TRACKER_NAME || 'TrackingDATN-Tracker'}`);
    console.log(`   SNS Topic    : ${process.env.SNS_ANTITHEFT_TOPIC_ARN || '(not set)'}`);
    console.log(`   CORS origin  : ${process.env.CORS_ORIGIN || 'http://localhost:5173'}\n`);
    console.log(`   Realtime     : authenticated Socket.io server integrated and running`);
    console.log(`   RT Webhook   : POST /api/realtime/event (API Key protected)\n`);

    });
};

if (require.main === module) {
    startServer();
}

module.exports = { app, assertRuntimeConfig, server, startServer };
