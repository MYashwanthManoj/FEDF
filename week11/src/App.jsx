import BookingForm from "./components/BookingForm";

function App() {
  const airlineName = import.meta.env.VITE_AIRLINE_NAME || "Aura Airlines";

  return (
    <div className="app-container">
      <header className="brand-header">
        <h1>{airlineName}</h1>
      </header>
      <BookingForm />
    </div>
  );
}

export default App;