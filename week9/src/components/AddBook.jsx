import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const BOOK_COLORS = [
  { bg: "linear-gradient(135deg, #6c63ff, #a78bfa)" },
  { bg: "linear-gradient(135deg, #f59e0b, #fcd34d)" },
  { bg: "linear-gradient(135deg, #10b981, #34d399)" },
  { bg: "linear-gradient(135deg, #ef4444, #f87171)" },
  { bg: "linear-gradient(135deg, #3b82f6, #60a5fa)" },
  { bg: "linear-gradient(135deg, #ec4899, #f9a8d4)" },
];

function Toast({ book, onDone }) {
  return (
    <div className="toast-container">
      <div className="toast">
        <div className="toast-icon">✅</div>
        <div className="toast-content">
          <strong>Book Added!</strong>
          <span>"{book.title}" by {book.author}</span>
        </div>
      </div>
    </div>
  );
}

function AddBook() {
  const [bookTitle, setBookTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [toast, setToast] = useState(null);
  const [colorIdx, setColorIdx] = useState(0);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const newBook = { title: bookTitle, author, isbn };
    setToast(newBook);
    setBookTitle("");
    setAuthor("");
    setIsbn("");
    setColorIdx((prev) => (prev + 1) % BOOK_COLORS.length);
    setTimeout(() => setToast(null), 4000);
  };

  const handleReset = () => {
    setBookTitle("");
    setAuthor("");
    setIsbn("");
  };

  const currentColor = BOOK_COLORS[colorIdx];

  return (
    <main className="main-content">
      <div className="form-page animate-fade-up">
        {/* Header */}
        <div className="form-header">
          <h2>Add New Book</h2>
          <p>Fill in the details below to catalogue a new book in your library.</p>
        </div>

        {/* Preview + Form side layout */}
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          {/* Book Preview Card */}
          <div
            style={{
              flex: "0 0 160px",
              background: currentColor.bg,
              borderRadius: "var(--radius-md)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.5rem 1rem",
              minHeight: "200px",
              textAlign: "center",
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
              transition: "var(--transition)",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📖</div>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "rgba(255,255,255,0.95)",
                lineHeight: 1.3,
                marginBottom: "0.4rem",
                wordBreak: "break-word",
              }}
            >
              {bookTitle || "Book Title"}
            </div>
            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)" }}>
              {author || "Author"}
            </div>
          </div>

          {/* Form */}
          <div className="form-card" style={{ flex: 1, minWidth: "280px" }}>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title" className="form-label">
                  <span className="form-label-icon">📖</span> Book Title
                </label>
                <input
                  id="title"
                  type="text"
                  className="form-input"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="e.g. The Great Gatsby"
                  required
                  aria-label="Book Title"
                />
              </div>

              <div className="form-group">
                <label htmlFor="author" className="form-label">
                  <span className="form-label-icon">✍️</span> Author
                </label>
                <input
                  id="author"
                  type="text"
                  className="form-input"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g. F. Scott Fitzgerald"
                  required
                  aria-label="Author Name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="isbn" className="form-label">
                  <span className="form-label-icon">🔖</span> ISBN
                </label>
                <input
                  id="isbn"
                  type="text"
                  className="form-input"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="e.g. 978-0743273565"
                  required
                  aria-label="ISBN Number"
                />
              </div>

              {/* Color picker */}
              <div className="form-group">
                <label className="form-label">
                  <span className="form-label-icon">🎨</span> Spine Color
                </label>
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  {BOOK_COLORS.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setColorIdx(i)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: c.bg,
                        border: colorIdx === i ? "3px solid white" : "3px solid transparent",
                        cursor: "pointer",
                        outline: colorIdx === i ? "2px solid var(--accent-primary)" : "none",
                        outlineOffset: "2px",
                        transition: "var(--transition)",
                      }}
                      aria-label={`Color option ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  ➕ Add to Library
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleReset}
                >
                  ↺ Reset
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Back link */}
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <Link to="/" className="btn btn-secondary" style={{ display: "inline-flex" }}>
            ← Back to Library
          </Link>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && <Toast book={toast} onDone={() => setToast(null)} />}
    </main>
  );
}

export default AddBook;