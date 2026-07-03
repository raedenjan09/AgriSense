import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import Weather from './pages/Weather'
import Admin from './pages/Admin'
import AdminReports from './pages/AdminReports'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['Farmer']}>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/reports" 
        element={
          <ProtectedRoute allowedRoles={['Farmer', 'Extension Worker', 'Admin']}>
            <Reports />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/weather" 
        element={
          <ProtectedRoute allowedRoles={['Farmer']}>
            <Weather />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={['Admin', 'Extension Worker']}>
            <Admin />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin-reports" 
        element={
          <ProtectedRoute allowedRoles={['Admin', 'Extension Worker']}>
            <AdminReports />
          </ProtectedRoute>
        } 
      />
    </Routes>
  )
}

export default App
