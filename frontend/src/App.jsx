import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import Placeholder from './pages/Placeholder';
import Calendar from './pages/Calendar';
import Inventory from './pages/Inventory';
import DayClose from './pages/DayClose';
import AddBooking from './pages/AddBooking';
import BookingDetail from './pages/BookingDetail';
import WorkInProgress from './pages/WorkInProgress';
import PaymentEntry from './pages/PaymentEntry';
import JobCompletedSuccess from './pages/JobCompletedSuccess';
import ClientsList from './pages/ClientsList';
import ClientProfile from './pages/ClientProfile';
import Settings from './pages/Settings';
import Reminders from './pages/Reminders';
import WhatsAppInbox from './pages/WhatsAppInbox';
import Analytics from './pages/Analytics';

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main">
        <p className="text-text-muted">Жүктелуде...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <SettingsProvider>
              <AppShell>
                <Routes>
                <Route path="/" element={<Calendar />} />
                <Route path="/booking/add" element={<AddBooking />} />
                <Route path="/booking/:id" element={<BookingDetail />} />
                <Route path="/booking/:id/in-progress" element={<WorkInProgress />} />
                <Route path="/booking/:id/payment" element={<PaymentEntry />} />
                <Route path="/booking/:id/done" element={<JobCompletedSuccess />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/day-close" element={<DayClose />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/clients" element={<ClientsList />} />
                <Route path="/clients/:id" element={<ClientProfile />} />
                <Route path="/reminders" element={<Reminders />} />
                <Route path="/whatsapp" element={<WhatsAppInbox />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
              </AppShell>
            </SettingsProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
