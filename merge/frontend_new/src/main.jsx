import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/index.css'
import QuestPage from './pages/Quest.jsx'
import Learn from './pages/Learn.jsx'
import AuthSwipe from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import Profile from './pages/Profile.jsx'
import Appointments from './pages/Appointments.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<QuestPage />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/login" element={<AuthSwipe />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
