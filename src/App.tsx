import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import PublicDashboard from './pages/PublicDashboard';
import FormBuilder from './pages/FormBuilder';
import PublicForm from './pages/PublicForm';
import ResponseAnalytics from './pages/ResponseAnalytics';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<PublicDashboard />} />
          <Route path="/administrator/login" element={<AdminLogin />} />
          <Route
            path="/administrator/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/administrator/forms/:formId/edit"
            element={
              <ProtectedRoute>
                <FormBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/administrator/forms/:formId/responses"
            element={
              <ProtectedRoute>
                <ResponseAnalytics />
              </ProtectedRoute>
            }
          />
          <Route path="/form/:formId" element={<PublicForm />} />
          <Route path="/form/:formId/edit/:responseId" element={<PublicForm />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
