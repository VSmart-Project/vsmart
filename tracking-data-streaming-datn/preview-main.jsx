import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './src/index.css'
import LandingPage from './src/components/marketing/LandingPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LandingPage onGetStarted={() => {}} />
  </StrictMode>,
)
