import BookingForm from "./components/BookingForm";
import "./App.css";

function App() {
  const airlineName = import.meta.env.VITE_AIRLINE_NAME || "SkyWings Airlines";

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <span className="logo-icon">✈️</span>
          <h1>{airlineName}</h1>
        </div>
        <p className="subtitle">Book your next adventure with ease</p>
      </header>

      <main className="main-content">
        <BookingForm />
      </main>
      
      <div className="background-elements">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
      </div>
    </div>
  );
}

export default App;