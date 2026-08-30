import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './hooks/ThemeProvider.jsx'

import { Amplify } from 'aws-amplify';
import { COGNITO } from './configuration';

const loginWith = COGNITO.DOMAIN ? {
  oauth: {
    domain: COGNITO.DOMAIN,
    scopes: ['email', 'profile', 'openid', 'aws.cognito.signin.user.admin'],
    redirectSignIn: [window.location.origin],
    redirectSignOut: [window.location.origin],
    responseType: 'code'
  }
} : undefined;

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: COGNITO.USER_POOL_ID,
      userPoolClientId: COGNITO.USER_POOL_CLIENT_ID,
      ...(loginWith && { loginWith })
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
