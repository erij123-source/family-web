import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import RevenusListe from './pages/Revenus/RevenusListe';
import ChargeListe from './pages/Charges/ChargeListe';
import Register from './pages/Auth/Register';
import Factures from './pages/Factures/Factures';
import AssistantIA from './pages/AI/AssistantIA';
import Profile from './pages/Profile/Profile';
import EditProfile from './pages/Profile/EditProfile';
import StatsBudget   from './pages/Stats/StatsBudget';
import StatsRevenus  from './pages/Stats/StatsRevenus';
import StatsCharges  from './pages/Stats/StatsCharges';
import StatsFactures from './pages/Stats/StatsFactures';
import ForgotPassword from './pages/Auth/ForgotPassword';
import Notifications from './pages/Notifications/Notifications';


function App() {
  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />


        <Route path="/"         element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/revenus"  element={<PrivateRoute><RevenusListe /></PrivateRoute>} />
        <Route path="/charges"  element={<PrivateRoute><ChargeListe /></PrivateRoute>} />
        <Route path="/factures" element={<PrivateRoute><Factures /></PrivateRoute>} />
        <Route path="/chat"     element={<PrivateRoute><AssistantIA /></PrivateRoute>} />
        <Route path="/profile"  element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/profile/edit" element={<PrivateRoute><EditProfile /></PrivateRoute>} />
        <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />

        {/* ── Statistiques ── */}
        <Route path="/stats-budget"   element={<PrivateRoute><StatsBudget /></PrivateRoute>} />
        <Route path="/stats-revenus"  element={<PrivateRoute><StatsRevenus /></PrivateRoute>} />
        <Route path="/stats-charges"  element={<PrivateRoute><StatsCharges /></PrivateRoute>} />
        <Route path="/stats-factures" element={<PrivateRoute><StatsFactures /></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;