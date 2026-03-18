import { Routes, Route } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import HomePage from './components/HomePage'
import UploadSetupView from './components/UploadSetupView'
import ReadingView from './components/ReadingView'

function App() {
  return (
    <Routes>
      {/* Pages with sidebar */}
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/reading" element={<ReadingView />} />
      </Route>

      {/* Full-screen pages (no sidebar) */}
      <Route path="/upload" element={<UploadSetupView />} />
    </Routes>
  )
}

export default App