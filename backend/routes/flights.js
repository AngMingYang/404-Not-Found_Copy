const express = require('express');
const router = express.Router();
const flightController = require('../controllers/flightController');

// Search flights
// GET /api/flights/search?origin=LAX&destination=JFK&departureDate=2025-07-01&returnDate=2025-07-08&passengers=2
router.get('/search', flightController.searchFlights);

// Alternative POST route for complex flight searches
// POST /api/flights/search
router.post('/search', flightController.searchFlights);

// Get all airports (with optional filters)
// GET /api/flights/airports?city=New York&country=USA&iata_code=JFK
router.get('/airports', flightController.getAirports);

// Search airports by location
// GET /api/flights/airports/location?latitude=40.7128&longitude=-74.0060&radius=100
router.get('/airports/location', flightController.getAirportsByLocation);

// Get specific airport by IATA/ICAO code
// GET /api/flights/airports/LAX
// GET /api/flights/airports/KLAX?type=icao
router.get('/airports/:code', flightController.getAirportByCode);

// Get airports by city
// GET /api/flights/airports/city/New York?country=USA
router.get('/airports/city/:city', flightController.getAirportsByCity);

// Get flight offers (if using Amadeus flight offers)
// GET /api/flights/offers/:offerId
router.get('/offers/:offerId', flightController.getFlightOffer);

module.exports = router;