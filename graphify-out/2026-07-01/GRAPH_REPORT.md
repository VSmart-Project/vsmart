# Graph Report - .  (2026-07-01)

## Corpus Check
- Large corpus: 146 files · ~1,093,101 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 626 nodes · 866 edges · 50 communities (42 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Backend Auth & Middleware|Backend Auth & Middleware]]
- [[_COMMUNITY_Mobile App Device & Scan|Mobile App Device & Scan]]
- [[_COMMUNITY_Web Frontend Project Config|Web Frontend Project Config]]
- [[_COMMUNITY_Mobile App Dependencies|Mobile App Dependencies]]
- [[_COMMUNITY_Backend Config & Packages|Backend Config & Packages]]
- [[_COMMUNITY_Mobile App Android Resources|Mobile App Android Resources]]
- [[_COMMUNITY_Web Geofencing UI|Web Geofencing UI]]
- [[_COMMUNITY_IoT Message Processor Lambda|IoT Message Processor Lambda]]
- [[_COMMUNITY_Mobile App Geofence Screens|Mobile App Geofence Screens]]
- [[_COMMUNITY_Backend UtilitySimulation Scripts|Backend Utility/Simulation Scripts]]
- [[_COMMUNITY_Backend Anti-Theft Logic|Backend Anti-Theft Logic]]
- [[_COMMUNITY_Web Map Interface Components|Web Map Interface Components]]
- [[_COMMUNITY_Backend Device Controller|Backend Device Controller]]
- [[_COMMUNITY_Web Device Management UI|Web Device Management UI]]
- [[_COMMUNITY_Mobile App Project Config|Mobile App Project Config]]
- [[_COMMUNITY_Mobile App Component|Mobile App Component]]
- [[_COMMUNITY_Backend DynamoDB Services|Backend DynamoDB Services]]
- [[_COMMUNITY_Web Map Interface Components|Web Map Interface Components]]
- [[_COMMUNITY_Mobile App Component|Mobile App Component]]
- [[_COMMUNITY_Web Frontend Component|Web Frontend Component]]
- [[_COMMUNITY_Geofence Event Consumer Lambda|Geofence Event Consumer Lambda]]
- [[_COMMUNITY_Backend UtilitySimulation Scripts|Backend Utility/Simulation Scripts]]
- [[_COMMUNITY_Mobile App Geofence Screens|Mobile App Geofence Screens]]
- [[_COMMUNITY_Mobile App Auth Screens|Mobile App Auth Screens]]
- [[_COMMUNITY_Mobile App Auth Screens|Mobile App Auth Screens]]
- [[_COMMUNITY_Mobile App Navigation Tabs|Mobile App Navigation Tabs]]
- [[_COMMUNITY_Backend Auth & Middleware|Backend Auth & Middleware]]
- [[_COMMUNITY_Offline Detector Lambda|Offline Detector Lambda]]
- [[_COMMUNITY_Backend Location & Geo Services|Backend Location & Geo Services]]
- [[_COMMUNITY_Web Geofencing UI|Web Geofencing UI]]
- [[_COMMUNITY_Backend Location & Geo Services|Backend Location & Geo Services]]
- [[_COMMUNITY_Mobile App Navigation Tabs|Mobile App Navigation Tabs]]
- [[_COMMUNITY_Mobile App Component|Mobile App Component]]
- [[_COMMUNITY_Web Layout & Common UI|Web Layout & Common UI]]
- [[_COMMUNITY_Web Map Interface Components|Web Map Interface Components]]
- [[_COMMUNITY_Mobile App Component|Mobile App Component]]
- [[_COMMUNITY_Backend SNS Notifications|Backend SNS Notifications]]
- [[_COMMUNITY_Web Device Management UI|Web Device Management UI]]
- [[_COMMUNITY_Backend UtilitySimulation Scripts|Backend Utility/Simulation Scripts]]
- [[_COMMUNITY_Backend UtilitySimulation Scripts|Backend Utility/Simulation Scripts]]
- [[_COMMUNITY_Realtime Event Publisher Lambda|Realtime Event Publisher Lambda]]
- [[_COMMUNITY_Mobile App Component|Mobile App Component]]
- [[_COMMUNITY_Mobile App Component|Mobile App Component]]

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 22 edges
2. `expo` - 15 edges
3. `lambda_handler()` - 12 edges
4. `lambda_handler()` - 10 edges
5. `useLiveDevices()` - 9 edges
6. `lambda_handler()` - 8 edges
7. `getOwnerUserIdFromRequest()` - 7 edges
8. `App()` - 6 edges
9. `android` - 6 edges
10. `scripts` - 6 edges

## Surprising Connections (you probably didn't know these)
- `GeofencesScreen()` --calls--> `useToast()`  [EXTRACTED]
  vsmart-mobile/app/(tabs)/geofences.jsx → vsmart-mobile/src/components/ui/Toast.jsx
- `RootLayout()` --calls--> `useAuth()`  [EXTRACTED]
  vsmart-mobile/app/_layout.jsx → vsmart-mobile/src/hooks/useAuth.js
- `App()` --calls--> `useDeviceManager()`  [EXTRACTED]
  vsmart-web/src/App.jsx → vsmart-web/src/hooks/useDeviceManager.js
- `App()` --calls--> `useDevicePolling()`  [EXTRACTED]
  vsmart-web/src/App.jsx → vsmart-web/src/hooks/useDevicePolling.js
- `DevicesScreen()` --calls--> `useToast()`  [EXTRACTED]
  vsmart-mobile/app/(tabs)/devices.jsx → vsmart-mobile/src/components/ui/Toast.jsx

## Import Cycles
- 1-file cycle: `vsmart-mobile/metro.config.js -> vsmart-mobile/metro.config.js`

## Communities (50 total, 8 thin omitted)

### Community 0 - "Backend Auth & Middleware"
Cohesion: 0.06
Nodes (31): antitheftRoutes, app, {
    APP_EVENTS_TOPIC_TEMPLATE,
    DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE,
    RAW_TELEMETRY_TOPIC_TEMPLATE,
    REALTIME_EVENT_TYPES,
    REALTIME_SCHEMA_VERSION,
    SAMPLE_REALTIME_EVENTS,
    validateRealtimeEnvelope,
}, authRoutes, cors, deviceRoutes, { errorHandler, notFoundHandler }, express (+23 more)

### Community 1 - "Mobile App Device & Scan"
Cohesion: 0.09
Nodes (30): DeviceMarker, mapDarkStyle, MapScreen(), s, { width, height }, DevicesScreen(), FORM_TYPES, s (+22 more)

### Community 2 - "Web Frontend Project Config"
Cohesion: 0.05
Nodes (37): dependencies, @aws/amazon-location-utilities-auth-helper, aws-amplify, @aws-sdk/client-location, @aws-sdk/client-sqs, @aws-sdk/credential-providers, clsx, lucide-react (+29 more)

### Community 3 - "Mobile App Dependencies"
Cohesion: 0.05
Nodes (37): dependencies, @aws/amazon-location-utilities-auth-helper, @aws-sdk/client-location, @aws-sdk/credential-providers, babel-preset-expo, buffer, expo, expo-camera (+29 more)

### Community 4 - "Backend Config & Packages"
Cohesion: 0.06
Nodes (35): author, dependencies, aws-jwt-verify, @aws-sdk/client-cognito-identity-provider, @aws-sdk/client-dynamodb, @aws-sdk/client-iot, @aws-sdk/client-iot-data-plane, @aws-sdk/client-location (+27 more)

### Community 5 - "Mobile App Android Resources"
Cohesion: 0.06
Nodes (35): backgroundColor, foregroundImage, adaptiveIcon, edgeToEdgeEnabled, package, permissions, predictiveBackGestureEnabled, reactCompiler (+27 more)

### Community 6 - "Web Geofencing UI"
Cohesion: 0.12
Nodes (10): DrawControl(), DrawnGeofences(), polygons, polygonsBorders, polygonsBreached, polygonsBreachedBorders, CIRCLE_STEPS, draw (+2 more)

### Community 7 - "IoT Message Processor Lambda"
Cohesion: 0.19
Nodes (19): batch_update_multiple_devices(), build_location_update(), _call_webhook(), _debug_topic(), _get_device_metadata(), _get_device_state(), _get_iot_data_client(), lambda_handler() (+11 more)

### Community 8 - "Mobile App Geofence Screens"
Cohesion: 0.17
Nodes (9): MODE, s, GeofencesScreen(), s, TEMPLATES, GeofenceDataContext, authHelpers, createLocationClient() (+1 more)

### Community 9 - "Backend Utility/Simulation Scripts"
Cohesion: 0.13
Nodes (11): getIotDataClient(), iotClient, { IoTClient, DescribeEndpointCommand }, { IoTDataPlaneClient, PublishCommand }, publishTelemetry(), readline, rl, sqsClient (+3 more)

### Community 10 - "Backend Anti-Theft Logic"
Cohesion: 0.15
Nodes (14): disableAntitheft(), dynamoService, enableAntitheft(), { generateCirclePolygon }, { GEOFENCE }, { LOCATION_TRACKER_NAME }, { locationClient }, locationService (+6 more)

### Community 11 - "Web Map Interface Components"
Cohesion: 0.16
Nodes (9): AuthLayout(), Toast(), Header(), menuItems, Sidebar(), DevicesMapOverlay(), STATUS_CONFIG, TYPE_CONFIG (+1 more)

### Community 12 - "Backend Device Controller"
Cohesion: 0.21
Nodes (14): createDevice(), deleteDevice(), { DEVICE_TYPES, DEVICE_STATUSES }, dynamoService, getAllDevices(), getDeviceById(), getDeviceHistory(), getOwnerUserIdFromRequest() (+6 more)

### Community 13 - "Web Device Management UI"
Cohesion: 0.15
Nodes (9): ConfirmAntiTheftModal(), DeleteDeviceModal(), DEFAULT_FORM, DEVICE_STATUSES, DEVICE_TYPES, DeviceFormModal(), DeviceList(), STATUS_CONFIG (+1 more)

### Community 14 - "Mobile App Project Config"
Cohesion: 0.12
Nodes (15): devDependencies, eslint, eslint-config-expo, @types/react, typescript, main, name, private (+7 more)

### Community 15 - "Mobile App Component"
Cohesion: 0.22
Nodes (6): requestNotificationPermissions(), showAntitheftAlert(), showDeviceOfflineAlert(), showDeviceOnlineAlert(), showGeofenceAlert(), showLocalNotification()

### Community 16 - "Backend DynamoDB Services"
Cohesion: 0.14
Nodes (3): { DYNAMODB_DEVICES_TABLE }, { dynamoDBDocumentClient }, {
    PutCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
    ScanCommand,
}

### Community 17 - "Web Map Interface Components"
Cohesion: 0.18
Nodes (7): antitheftApi, deviceApi, DashboardView(), PRESET_ROUTES, DeviceDetailPanel(), EVENT_ICONS, MAP

### Community 18 - "Mobile App Component"
Cohesion: 0.17
Nodes (6): s, s, styles, ToastContext, ToastProvider(), VARIANTS

### Community 19 - "Web Frontend Component"
Cohesion: 0.30
Nodes (10): useDeviceManager(), applyRealtimeEventToDevices(), createRealtimeEventTracker(), getRealtimeNotificationDescriptor(), isObject(), REALTIME_EVENT_SAMPLES, REALTIME_EVENT_TYPES, shouldProcessRealtimeEvent() (+2 more)

### Community 20 - "Geofence Event Consumer Lambda"
Cohesion: 0.36
Nodes (11): _call_webhook(), _debug_topic(), _decode_record_body(), _get_iot_data_client(), _get_owner_user_id(), lambda_handler(), _now_ms(), _parse_geofence_event() (+3 more)

### Community 21 - "Backend Utility/Simulation Scripts"
Cohesion: 0.20
Nodes (7): { DYNAMODB_DEVICES_TABLE }, { dynamoDBDocumentClient }, { ScanCommand, UpdateCommand }, awsConfig, { DynamoDBClient }, { DynamoDBDocumentClient }, { LocationClient }

### Community 22 - "Mobile App Geofence Screens"
Cohesion: 0.22
Nodes (7): GeofenceDrawScreen(), LoginScreen(), NotificationTestScreen(), s, s, ScanScreen(), useToast()

### Community 23 - "Mobile App Auth Screens"
Cohesion: 0.22
Nodes (8): markOnboardingDone(), NotificationEffects(), RootLayout(), s, SLIDES, { width }, GeofenceDataProvider(), useSystemNotifications()

### Community 24 - "Mobile App Auth Screens"
Cohesion: 0.35
Nodes (9): s, { width, height }, AuthEvents, authFetch(), cognitoConfirmSignUp(), cognitoResendCode(), cognitoSignIn(), cognitoSignUp() (+1 more)

### Community 25 - "Mobile App Navigation Tabs"
Cohesion: 0.24
Nodes (8): s, SettingsScreen(), ConfirmModal(), ICON_PRESETS, s, COGNITO, useAuth(), cognitoSignOut()

### Community 26 - "Backend Auth & Middleware"
Cohesion: 0.20
Nodes (4): client, {
    CognitoIdentityProviderClient,
    AdminInitiateAuthCommand,
    SignUpCommand,
    ConfirmSignUpCommand,
    ResendConfirmationCodeCommand,
}, auth, { Router }

### Community 27 - "Offline Detector Lambda"
Cohesion: 0.38
Nodes (9): _debug_topic(), _get_device_owner(), _get_iot_data_client(), _iso_now(), lambda_handler(), _now_ms(), _publish(), Any (+1 more)

### Community 28 - "Backend Location & Geo Services"
Cohesion: 0.28
Nodes (7): dynamoService, { haversineDistanceM }, locationService, runAntitheftCheck(), snsService, startAntitheftWorker(), haversineDistanceM()

### Community 30 - "Backend Location & Geo Services"
Cohesion: 0.25
Nodes (3): {
    ListDevicePositionsCommand,
    BatchDeleteDevicePositionHistoryCommand,
    GetDevicePositionHistoryCommand,
}, { LOCATION_TRACKER_NAME }, { locationClient }

### Community 31 - "Mobile App Navigation Tabs"
Cohesion: 0.29
Nodes (3): CustomTabBar(), s, TABS

### Community 32 - "Mobile App Component"
Cohesion: 0.29
Nodes (6): compilerOptions, paths, strict, extends, include, @/*

### Community 33 - "Web Layout & Common UI"
Cohesion: 0.40
Nodes (4): App(), authHelpers, createLocationClient(), getAuthHelpers()

### Community 34 - "Web Map Interface Components"
Cohesion: 0.50
Nodes (4): DeviceHistoryPathLayer(), getDistanceKm(), historyLineLayer, historyPointsLayer

### Community 35 - "Mobile App Component"
Cohesion: 0.40
Nodes (4): Colors, FontSize, Radius, Spacing

## Knowledge Gaps
- **276 isolated node(s):** `express`, `cors`, `morgan`, `helmet`, `authRoutes` (+271 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useToast()` connect `Mobile App Geofence Screens` to `Mobile App Device & Scan`, `Mobile App Geofence Screens`, `Mobile App Component`, `Mobile App Auth Screens`, `Mobile App Auth Screens`, `Mobile App Navigation Tabs`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Mobile App Dependencies` to `Mobile App Project Config`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `express`, `cors`, `morgan` to the rest of the system?**
  _281 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Auth & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.05807200929152149 - nodes in this community are weakly interconnected._
- **Should `Mobile App Device & Scan` be split into smaller, more focused modules?**
  _Cohesion score 0.08906882591093117 - nodes in this community are weakly interconnected._
- **Should `Web Frontend Project Config` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Mobile App Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._