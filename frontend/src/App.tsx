import { Routes, Route } from 'react-router-dom'
import UploadSetupView from './components/UploadSetupView'
import ReadingView from './components/ReadingView'

function App() {
  return (
    <div className='w-dvw justify-center'>
      <Routes>
        <Route path="/" element={<UploadSetupView />} />
        <Route path="/reading" element={<ReadingView />} />
      </Routes>
    </div>
  )
}

export default App