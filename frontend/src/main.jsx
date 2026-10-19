import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ChatGptProvider } from './contexts/ChatGptContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChatGptProvider><App /></ChatGptProvider>
  </StrictMode>,
)
