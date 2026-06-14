import { useState } from "react";

function BookingForm() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [bookingData, setBookingData] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    setBookingData({
      source,
      destination,
      travelDate
    });

    setSource("");
    setDestination("");
    setTravelDate("");
  };

  return (
    <div className="booking-card">
      <h2>Book Your Flight</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="source">From</label>
          <input
            id="source"
            type="text"
            placeholder="e.g. New York (JFK)"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="destination">To</label>
          <input
            id="destination"
            type="text"
            placeholder="e.g. London (LHR)"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="travelDate">Departure Date</label>
          <input
            id="travelDate"
            type="date"
            value={travelDate}
            onChange={(e) => setTravelDate(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="submit-btn">
          Confirm Booking
        </button>
      </form>

      {bookingData && (
        <div className="ticket-success">
          <h3>Ticket Confirmed! ✨</h3>
          <div className="ticket-details">
            <div className="flight-path">
              <span>{bookingData.source}</span>
              <span className="flight-icon">✈️</span>
              <span>{bookingData.destination}</span>
            </div>
          </div>
          <div className="ticket-date">
            Departure: {new Date(bookingData.travelDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      )}
    </div>
  );
}

export default BookingForm;