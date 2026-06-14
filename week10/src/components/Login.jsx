import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login({ setIsLoggedIn }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loginHandler = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    // Simulate auth delay
    await new Promise((r) => setTimeout(r, 900));
    // Accept any non-empty credentials for demo
    if (username.trim() && password.trim()) {
      setIsLoggedIn(true);
      navigate("/dashboard");
    } else {
      setError("Please enter both username and password.");
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Logo */}
        <div className="login-logo-wrap">
          <div className="login-logo">📚</div>
          <h1>LibraryOS</h1>
          <p>Sign in to access your library dashboard</p>
        </div>

        {/* Card */}
        <div className="login-card animate-fade-up">
          <form onSubmit={loginHandler}>
            {error && (
              <div className="alert alert-warning" style={{ marginBottom: "1.25rem" }}>
                <span className="alert-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="username">
                👤 Username
              </label>
              <div className="input-wrapper">
                <input
                  id="username"
                  type="text"
                  className="form-input"
                  placeholder="e.g. librarian"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                🔒 Password
              </label>
              <div className="input-wrapper" style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontSize: "1rem",
                    padding: "4px",
                  }}
                  aria-label="Toggle password visibility"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading}
              style={{ marginTop: "0.5rem" }}
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Signing in…
                </>
              ) : (
                "→ Sign In"
              )}
            </button>
          </form>

          <div className="login-divider">or</div>

          <button
            type="button"
            className="btn btn-secondary btn-full"
            onClick={() => { setUsername("librarian"); setPassword("demo123"); }}
          >
            🎭 Use Demo Credentials
          </button>

          <p className="login-footer">
            Enter any credentials to continue &nbsp;·&nbsp;
            <a href="#">Forgot password?</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;