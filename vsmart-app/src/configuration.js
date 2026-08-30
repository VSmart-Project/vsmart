const configuredBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
if (!configuredBackendUrl) {
  throw new Error('Missing required EXPO_PUBLIC_BACKEND_URL');
}
if (process.env.NODE_ENV === 'production' && !configuredBackendUrl.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_BACKEND_URL must use HTTPS in production');
}

export const BACKEND_URL = configuredBackendUrl.replace(/\/$/, '');

export const COGNITO = {
  USER_POOL_ID: process.env.EXPO_PUBLIC_USER_POOL_ID,
  USER_POOL_CLIENT_ID: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID,
  REGION: process.env.EXPO_PUBLIC_AWS_REGION,
};
