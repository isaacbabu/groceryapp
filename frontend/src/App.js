import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';
import '@/App.css';

import LoginPage from '@/pages/LoginPage';
import AuthCallback from '@/pages/AuthCallback';
import BillingPage from '@/pages/BillingPage';
import UserProfile from '@/pages/UserProfile';
import PlacedOrders from '@/pages/PlacedOrders';
import AboutPage from '@/pages/AboutPage';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminItems from '@/pages/AdminItems';
import AdminCategories from '@/pages/AdminCategories';
import ProtectedRoute from '@/components/ProtectedRoute';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const axiosInstance = axios.create({
  baseURL: API,
  withCredentials: true,
});

function AppRouter() {
  const location = useLocation();
  
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><PlacedOrders /></ProtectedRoute>} />
      <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/items" element={<ProtectedRoute><AdminItems /></ProtectedRoute>} />
      <Route path="/admin/categories" element={<ProtectedRoute><AdminCategories /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </div>
  );
}

export default App;