import { useState } from "react";
import "./BookingForm.css";

function BookingForm() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call for UX
    setTimeout(() => {
      setMessage(
        `Ticket Booked Successfully! ${source} → ${destination} on ${travelDate}`
      );
      setSource("");
      setDestination("");
      setTravelDate("");
      setIsSubmitting(false);
      
      // Clear message after 5 seconds
      setTimeout(() => setMessage(""), 5000);
    }, 1500);
  };

  return (
    <div className="booking-card">
      <div className="card-header">
        <h2>Flight Search</h2>
        <p>Find the best flights for your journey</p>
      </div>

      <form onSubmit={handleSubmit} className="booking-form">
        <div className="input-group">
          <label htmlFor="source">From</label>
          <div className="input-wrapper">
            <span className="input-icon">🛫</span>
            <input
              id="source"
              type="text"
              placeholder="Source City (e.g., New York)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="destination">To</label>
          <div className="input-wrapper">
            <span className="input-icon">🛬</span>
            <input
              id="destination"
              type="text"
              placeholder="Destination City (e.g., London)"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="date">Travel Date</label>
          <div className="input-wrapper">
            <span className="input-icon">📅</span>
            <input
              id="date"
              type="date"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
              required
            />
          </div>
        </div>

        <button 
          type="submit" 
          className={`submit-btn ${isSubmitting ? "loading" : ""}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="loader"></span>
          ) : (
            <>
              Search Flights <span className="btn-icon">→</span>
            </>
          )}
        </button>
      </form>

      {message && (
        <div className="success-message fade-in">
          <span className="success-icon">✅</span>
          <p>{message}</p>
        </div>
      )}
    </div>
  );
}

export default BookingForm;