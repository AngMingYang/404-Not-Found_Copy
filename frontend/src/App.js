import "./App.css";
import { useState } from "react";

// Simple city suggestions
const cityOptions = [
  "Singapore (SIN)",
  "Tokyo (HND)",
  "New York (JFK)",
  "London (LHR)",
  "Paris (CDG)",
  "Sydney (SYD)",
  "Bangkok (BKK)",
];

function App() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);
    if (value.length > 0) {
      const filtered = cityOptions.filter((city) =>
        city.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (city) => {
    setInput(city);
    setSuggestions([]);
  };

  return (
    <div className="App" style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ color: "#0A74DA" }}>Flight Finder</h1>
        <p>Find the cheapest flights fast</p>
      </header>

      <div style={{ position: "relative", width: "300px" }}>
        <input
          type="text"
          value={input}
          onChange={handleChange}
          placeholder="Enter a city or airport"
          style={{
            width: "100%",
            padding: "10px",
            fontSize: "16px",
            border: "1px solid #ccc",
            borderRadius: "8px",
          }}
        />
        {suggestions.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "10px",
              border: "1px solid #ccc",
              borderTop: "none",
              position: "absolute",
              width: "100%",
              background: "#fff",
              borderRadius: "0 0 8px 8px",
              maxHeight: "150px",
              overflowY: "auto",
              zIndex: 1000,
            }}
          >
            {suggestions.map((city, idx) => (
              <li
                key={idx}
                onClick={() => handleSuggestionClick(city)}
                style={{
                  padding: "8px",
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                }}
              >
                {city}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
