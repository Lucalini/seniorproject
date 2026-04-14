import './App.css'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { EducationPage } from './pages/EducationPage'
import { EventsPage } from './pages/EventsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MunicipalCodePage } from './pages/MunicipalCodePage'
import { OrdinanceDraftPage } from './pages/OrdinanceDraftPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OfficialDetailPage } from './pages/OfficialDetailPage'
import { OfficialsPage } from './pages/OfficialsPage'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/officials" element={<OfficialsPage />} />
        <Route path="/officials/:officialId" element={<OfficialDetailPage />} />
        <Route path="/education" element={<EducationPage />} />
        <Route path="/municipal-code" element={<MunicipalCodePage />} />
        <Route path="/ordinance-draft" element={<OrdinanceDraftPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}

export default App
