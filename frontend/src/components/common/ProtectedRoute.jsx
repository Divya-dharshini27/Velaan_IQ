import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Skeleton from './Skeleton';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-soybean flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-card border border-stone-200 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-100 animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-stone-200 rounded w-1/2 animate-pulse" />
              <div className="h-3 bg-stone-100 rounded w-3/4 animate-pulse" />
            </div>
          </div>
          <div className="h-24 bg-stone-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;
