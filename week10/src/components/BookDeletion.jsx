import { useState } from "react";
import { Link } from "react-router-dom";

const INITIAL_BOOKS = [
  { id: 1, title: "Java Programming",    author: "James Gosling",   isbn: "978-0132222204", genre: "Technology" },
  { id: 2, title: "Python Fundamentals", author: "Guido van Rossum", isbn: "978-0135081136", genre: "Technology" },
  { id: 3, title: "React Development",   author: "Jordan Walke",    isbn: "978-1491954621", genre: "Technology" },
];

const GENRE_COLORS = {
  Technology: "purple",
  Fiction:    "gold",
  Science:    "green",
  History:    "red",
};

function BookDeletion() {
  const [books, setBooks]       = useState(INITIAL_BOOKS);
  const [deletingId, setDeletingId] = useState(null);
  const [deleted, setDeleted]   = useState([]);

  const deleteBook = async (id) => {
    setDeletingId(id);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const book = books.find((b) => b.id === id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    setDeleted((prev) => [book, ...prev]);
    setDeletingId(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <span className="sidebar-section-label">Navigation</span>
          <Link to="/dashboard" className="sidebar-link">
            <div className="sidebar-link-icon">🏠</div>
            Dashboard
          </Link>
          <Link to="/deletebook" className="sidebar-link active">
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
          {/* Header */}
          <div className="page-header animate-fade-up">
            <div className="page-header-badge">⚠️ Danger Zone</div>
            <h2>Delete Books</h2>
            <p>
              Permanently remove books from the library catalogue. This action cannot be undone.
            </p>
          </div>

          {/* Warning */}
          <div className="alert alert-warning animate-fade-up">
            <span className="alert-icon">⚠️</span>
            <span>
              Deleting a book is <strong>permanent</strong>. Make sure you want to remove it before proceeding.
            </span>
          </div>

          {/* Loading indicator */}
          {deletingId && (
            <div className="delete-loading">
              <div className="spinner" style={{ borderTopColor: "#f87171", borderColor: "rgba(239,68,68,0.2)" }} />
              Deleting book from catalogue…
            </div>
          )}

          {/* Book count */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-red)", boxShadow: "0 0 8px var(--accent-red)", display: "inline-block" }}></span>
              {books.length} book{books.length !== 1 ? "s" : ""} in catalogue
            </div>
            {deleted.length > 0 && (
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {deleted.length} deleted this session
              </span>
            )}
          </div>

          {/* Book List */}
          {books.length === 0 ? (
            <div className="empty-state animate-scale-in">
              <div className="empty-state-icon">📭</div>
              <h3>All books removed</h3>
              <p>The catalogue is empty. Add new books to get started.</p>
              <Link to="/dashboard" className="btn btn-secondary" style={{ marginTop: "1.25rem", display: "inline-flex" }}>
                ← Back to Dashboard
              </Link>
            </div>
          ) : (
            <div className="book-list">
              {books.map((book, i) => (
                <div
                  key={book.id}
                  className={`book-row animate-fade-up stagger-${Math.min(i + 1, 4)}`}
                  style={{ opacity: deletingId === book.id ? 0.5 : 1 }}
                >
                  <div
                    className="book-row-icon"
                    style={{
                      background: book.genre === "Fiction"
                        ? "linear-gradient(135deg, #f59e0b, #fcd34d)"
                        : "linear-gradient(135deg, #5b5bd6, #a78bfa)"
                    }}
                  >
                    📖
                  </div>
                  <div className="book-row-info">
                    <div className="book-row-title">{book.title}</div>
                    <div className="book-row-meta">
                      by {book.author} &nbsp;·&nbsp; ISBN: {book.isbn}
                    </div>
                  </div>
                  <div className="book-row-actions">
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "99px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        background: "rgba(91,91,214,0.1)",
                        border: "1px solid rgba(91,91,214,0.2)",
                        color: "var(--accent-secondary)",
                      }}
                    >
                      {book.genre}
                    </span>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteBook(book.id)}
                      disabled={deletingId !== null}
                    >
                      {deletingId === book.id ? (
                        <>
                          <div
                            className="spinner"
                            style={{
                              width: 13,
                              height: 13,
                              borderTopColor: "#f87171",
                              borderColor: "rgba(239,68,68,0.2)",
                            }}
                          />
                          Deleting…
                        </>
                      ) : (
                        "🗑 Delete"
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Deleted log */}
          {deleted.length > 0 && (
            <div style={{ marginTop: "2.5rem" }}>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-red)", display: "inline-block" }}></span>
                Deletion log (this session)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {deleted.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "10px 14px",
                      background: "rgba(239,68,68,0.04)",
                      border: "1px solid rgba(239,68,68,0.12)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.85rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>🗑</span>
                    <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{b.title}</span>
                    <span>removed</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default BookDeletion;