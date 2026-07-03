import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#10B981', fontWeight: 'bold' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Prevent cross-access by redirecting based on actual role
    return user.role === 'Farmer' ? <Navigate to="/dashboard" /> : <Navigate to="/admin" />;
  }

  return children;
};

export default ProtectedRoute;
