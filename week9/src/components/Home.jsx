import { useState } from "react";
import { Link } from "react-router-dom";

const BOOK_COLORS = [
  { bg: "linear-gradient(135deg, #6c63ff, #a78bfa)", emoji: "📖" },
  { bg: "linear-gradient(135deg, #f59e0b, #fcd34d)", emoji: "📕" },
  { bg: "linear-gradient(135deg, #10b981, #34d399)", emoji: "📗" },
  { bg: "linear-gradient(135deg, #ef4444, #f87171)", emoji: "📘" },
  { bg: "linear-gradient(135deg, #3b82f6, #60a5fa)", emoji: "📙" },
  { bg: "linear-gradient(135deg, #ec4899, #f9a8d4)", emoji: "📚" },
];

const SAMPLE_BOOKS = [
  { id: 1, title: "The Great Gatsby", author: "F. Scott Fitzgerald", isbn: "978-0743273565", colorIdx: 0 },
  { id: 2, title: "To Kill a Mockingbird", author: "Harper Lee", isbn: "978-0061935466", colorIdx: 2 },
  { id: 3, title: "1984", author: "George Orwell", isbn: "978-0451524935", colorIdx: 3 },
];

function BookCard({ book, onRemove }) {
  const color = BOOK_COLORS[book.colorIdx % BOOK_COLORS.length];
  return (
    <div className="book-card animate-scale-in">
      <div className="book-card-spine" style={{ background: color.bg }}>
        {color.emoji}
      </div>
      <div className="book-title">{book.title}</div>
      <div className="book-author">by {book.author}</div>
      <span className="book-isbn">🔖 {book.isbn}</span>
      <div className="book-card-actions">
        <button
          className="btn btn-danger"
          style={{ flex: 1, padding: "8px 12px", fontSize: "0.8rem" }}
          onClick={() => onRemove(book.id)}
        >
          🗑 Remove
        </button>
      </div>
    </div>
  );
}

function Home() {
  const [books, setBooks] = useState(SAMPLE_BOOKS);
  const [search, setSearch] = useState("");

  const removeBook = (id) => setBooks((prev) => prev.filter((b) => b.id !== id));

  const filtered = books.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="main-content">
      {/* Hero */}
      <section className="home-hero animate-fade-up">
        <div className="home-hero-badge">✦ Library Management System</div>
        <h1>Your Digital Library,<br />Reimagined</h1>
        <p>
          Organize, discover, and manage your entire book collection
          in one beautifully designed space.
        </p>
        <div className="hero-actions">
          <Link to="/addbook" className="btn btn-primary">
            ➕ Add New Book
          </Link>
          <a href="#collection" className="btn btn-secondary">
            📚 View Collection
          </a>
        </div>
      </section>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-value">{books.length}</div>
          <div className="stat-label">Total Books</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✍️</div>
          <div className="stat-value">{new Set(books.map((b) => b.author)).size}</div>
          <div className="stat-label">Authors</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔖</div>
          <div className="stat-value">{books.length}</div>
          <div className="stat-label">Catalogued</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">100%</div>
          <div className="stat-label">Organized</div>
        </div>
      </div>

      {/* Collection */}
      <section id="collection">
        <div className="section-header">
          <div className="section-title">
            <span className="section-title-dot"></span>
            Book Collection
          </div>
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search books or authors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="books-grid">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>{search ? "No books match your search" : "No books yet"}</h3>
              <p>
                {search
                  ? "Try a different search term."
                  : "Start building your collection by adding your first book."}
              </p>
              {!search && (
                <Link to="/addbook" className="btn btn-primary">
                  ➕ Add First Book
                </Link>
              )}
            </div>
          ) : (
            filtered.map((book) => (
              <BookCard key={book.id} book={book} onRemove={removeBook} />
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default Home;