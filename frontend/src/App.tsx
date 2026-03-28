import { Routes, Route } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import HomePage from './components/HomePage'
import UploadSetupView from './components/UploadSetupView'
import ReadingView from './components/ReadingView'
import SettingsPage from './components/SettingsPage'
import ProfilePage from './components/ProfilePage'

function App() {
  return (
    <Routes>
      {/* Pages with sidebar */}
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/reading" element={<ReadingView />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Full-screen pages (no sidebar) */}
      <Route path="/upload" element={<UploadSetupView />} />
    </Routes>
  )
}

export default App