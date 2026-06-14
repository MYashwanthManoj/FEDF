import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./components/Home";
import AddBook from "./components/AddBook";
import "./index.css";

function Navbar() {
  const location = useLocation();
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo-icon">📚</div>
        <span>LibraryOS</span>
      </div>
      <div className="navbar-links">
        <Link to="/" className={`nav-link ${location.pathname === "/" ? "active" : ""}`}>
          🏠 Home
        </Link>
        <Link to="/addbook" className={`nav-link ${location.pathname === "/addbook" ? "active" : ""}`}>
          ➕ Add Book
        </Link>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/addbook" element={<AddBook />} />
      </Routes>
      <footer className="footer">
        Built with ❤️ — <span>vite</span> © {new Date().getFullYear()}
      </footer>
    </BrowserRouter>
  );
}

export default App;