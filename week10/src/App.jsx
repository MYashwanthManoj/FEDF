import { useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import BookDeletion from "./components/BookDeletion";
import ProtectedRoute from "./routes/ProtectedRoute";
import "./index.css";

function Navbar({ isLoggedIn, onLogout }) {
  const location = useLocation();
  if (!isLoggedIn) return null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo">📚</div>
        <span className="navbar-name">LibraryOS</span>
      </div>
      <div className="navbar-actions">
        <Link
          to="/dashboard"
          className={`nav-pill ${location.pathname === "/dashboard" ? "active" : ""}`}
        >
          🏠 Dashboard
        </Link>
        <Link
          to="/deletebook"
          className={`nav-pill ${location.pathname === "/deletebook" ? "active" : ""}`}
        >
          🗑 Manage Books
        </Link>
        <div className="user-chip">
          <div className="user-avatar">LB</div>
          Librarian
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>
          ← Logout
        </button>
      </div>
    </nav>
  );
}

function AppInner() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogout = () => setIsLoggedIn(false);

  return (
    <>
      <div className="page-bg" />
      <div className="page-content">
        <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<Login setIsLoggedIn={setIsLoggedIn} />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Dashboard onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deletebook"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <BookDeletion />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

export default App;