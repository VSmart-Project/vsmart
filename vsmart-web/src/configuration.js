// Use Environment Variables (.env) mapped via Vite (import.meta.env) for smart and secure configuration
const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const isLocalBackend = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(configuredBackendUrl);
if (import.meta.env.PROD && !isLocalBackend && !configuredBackendUrl.startsWith('https://')) {
  throw new Error('VITE_BACKEND_URL must use HTTPS in production');
}
export const BACKEND_URL = configuredBackendUrl.replace(/\/$/, '');

export const COGNITO = {
  USER_POOL_ID: import.meta.env.VITE_USER_POOL_ID,
  USER_POOL_CLIENT_ID: import.meta.env.VITE_USER_POOL_CLIENT_ID,
  DOMAIN: import.meta.env.VITE_COGNITO_DOMAIN,
  REGION: import.meta.env.VITE_AWS_REGION
};

export const REGION = import.meta.env.VITE_AWS_REGION;
export const API_KEY = import.meta.env.VITE_MAP_API_KEY;

export const GEOFENCE = import.meta.env.VITE_GEOFENCE_COLLECTION || "Vsmart-GeofenceCollection";

// Map Configuration
export const MAP = {
  STYLE: import.meta.env.VITE_MAP_STYLE || "Standard", // Try: Standard, Monochrome, Hybrid, Satellite
  COLOR_SCHEME: import.meta.env.VITE_MAP_COLOR_SCHEME || "Light",
};

// Device Position History (in seconds)
export const DEVICE_POSITION_HISTORY_OFFSET = 3600; // 1 hour
