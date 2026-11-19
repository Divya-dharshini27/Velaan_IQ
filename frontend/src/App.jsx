import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import AuthPage from './pages/Auth/AuthPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import AdvisorPage from './pages/Advisor/AdvisorPage';
import ScenariosPage from './pages/Scenarios/ScenariosPage';
import MarketPage from './pages/Market/MarketPage';
import SourcingPage from './pages/Sourcing/SourcingPage';
import DataPage from './pages/Data/DataPage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<AuthPage />} />

            {/* Protected Application Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="advisor" element={<AdvisorPage />} />
              <Route path="scenarios" element={<ScenariosPage />} />
              <Route path="market" element={<MarketPage />} />
              <Route path="sourcing" element={<SourcingPage />} />
              <Route path="data" element={<DataPage />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
