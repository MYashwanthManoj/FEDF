import { Link } from "react-router-dom";

const STATS = [
  { icon: "📚", value: "3", label: "Total Books", color: "purple" },
  { icon: "✍️", value: "3", label: "Authors",     color: "gold"   },
  { icon: "🔖", value: "3", label: "Catalogued",  color: "green"  },
  { icon: "🗑", value: "0", label: "Deleted",      color: "red"    },
];

const ACTIONS = [
  {
    to: "/deletebook",
    icon: "🗑",
    iconColor: "red",
    title: "Delete Books",
    desc: "Remove books from the library catalogue.",
  },
  {
    to: "#",
    icon: "➕",
    iconColor: "green",
    title: "Add Books",
    desc: "Catalogue new titles into the system.",
  },
  {
    to: "#",
    icon: "🔍",
    iconColor: "purple",
    title: "Search Catalogue",
    desc: "Find books by title, author, or ISBN.",
  },
  {
    to: "#",
    icon: "📊",
    iconColor: "gold",
    title: "Reports",
    desc: "View borrowing statistics and trends.",
  },
];

function Dashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Sidebar + Main layout */}
      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <span className="sidebar-section-label">Navigation</span>

          <Link to="/dashboard" className="sidebar-link active">
            <div className="sidebar-link-icon">🏠</div>
            Dashboard
          </Link>

          <Link to="/deletebook" className="sidebar-link">
            <div className="sidebar-link-icon">🗑</div>
            Delete Books
          </Link>

          <span className="sidebar-section-label">Catalogue</span>

          <a href="#" className="sidebar-link">
            <div className="sidebar-link-icon">📖</div>
            All Books
          </a>

          <a href="#" className="sidebar-link">
            <div className="sidebar-link-icon">➕</div>
            Add Book
          </a>

          <a href="#" className="sidebar-link">
            <div className="sidebar-link-icon">🔍</div>
            Search
          </a>

          <div className="sidebar-bottom">
            <a href="#" className="sidebar-link">
              <div className="sidebar-link-icon">⚙️</div>
              Settings
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="dashboard-main">
          {/* Page Header */}
          <div className="page-header animate-fade-up">
            <div className="page-header-badge">✦ Librarian Portal</div>
            <h2>Welcome back, Librarian!</h2>
            <p>Here's a snapshot of your library system. Manage your collection below.</p>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            {STATS.map((s, i) => (
              <div key={s.label} className={`stat-card ${s.color} animate-fade-up stagger-${i + 1}`}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="page-header" style={{ marginBottom: "1.25rem" }}>
            <h3 style={{ color: "var(--text-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-primary)", boxShadow: "0 0 8px var(--accent-primary)", display: "inline-block" }}></span>
              Quick Actions
            </h3>
          </div>

          <div className="quick-actions">
            {ACTIONS.map((a, i) => (
              <Link
                key={a.title}
                to={a.to}
                className={`action-card animate-fade-up stagger-${i + 1}`}
              >
                <div className={`action-icon-wrap ${a.iconColor}`}>{a.icon}</div>
                <div className="action-body">
                  <h3>{a.title}</h3>
                  <p>{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Recent Activity placeholder */}
          <div className="page-header" style={{ marginBottom: "1.25rem", marginTop: "1rem" }}>
            <h3 style={{ color: "var(--text-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-green)", boxShadow: "0 0 8px var(--accent-green)", display: "inline-block" }}></span>
              Recent Activity
            </h3>
          </div>

          <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>🕐</div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
              No recent activity to display.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;