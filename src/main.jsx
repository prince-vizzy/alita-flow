import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { InventoryProvider } from './context/InventoryContext.jsx'
import { InstallPromptProvider } from './context/InstallPromptContext.jsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <InventoryProvider>
        <InstallPromptProvider>
          <App />
        </InstallPromptProvider>
      </InventoryProvider>
    </BrowserRouter>
  </StrictMode>,
)
