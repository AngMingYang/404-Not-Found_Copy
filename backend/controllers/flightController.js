const amadeusService = require('../services/amadeusService');
const supabaseService = require('../services/supabaseService');

const searchFlights = async (req, res) => {
    try {
        // Support both POST body and GET query parameters
        const params = req.method === 'POST' ? req.body : req.query;
        const { origin, destination, departureDate, returnDate, passengers } = params;
        
        if (!origin || !destination || !departureDate) {
            return res.status(400).json({ 
                error: 'Origin, destination, and departureDate are required',
                example: '/api/flights/search?origin=LAX&destination=JFK&departureDate=2025-07-01&returnDate=2025-07-08&passengers=2'
            });
        }

        // Validate airport codes exist in our database
        const originAirport = await supabaseService.getAirportByCode(origin, 'iata');
        const destAirport = await supabaseService.getAirportByCode(destination, 'iata');
        
        if (!originAirport) {
            return res.status(400).json({ error: `Origin airport ${origin} not found` });
        }
        if (!destAirport) {
            return res.status(400).json({ error: `Destination airport ${destination} not found` });
        }

        // Search flights via Amadeus
        const flights = await amadeusService.searchFlights({
            origin,
            destination,
            departureDate,
            returnDate,
            passengers: passengers || 1
        });

        res.json({
            success: true,
            data: {
                flights,
                originAirport,
                destinationAirport: destAirport,
                searchParams: {
                    origin,
                    destination,
                    departureDate,
                    returnDate,
                    passengers: passengers || 1
                }
            }
        });
    } catch (error) {
        console.error('Flight search error:', error);
        res.status(500).json({ error: 'Failed to search flights' });
    }
};

const getAirports = async (req, res) => {
    try {
        const { city, country, iata_code } = req.query;
        
        const filters = {};
        if (city) filters.city = city;
        if (country) filters.country = country;
        if (iata_code) filters.iata_code = iata_code;

        const airports = await supabaseService.getAirports(filters);
        
        res.json({
            success: true,
            data: airports,
            count: airports.length,
            filters: filters
        });
    } catch (error) {
        console.error('Airport fetch error:', error);
        res.status(500).json({ error: 'Failed to get airports' });
    }
};

const getAirportsByLocation = async (req, res) => {
    try {
        const { latitude, longitude, radius } = req.query;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ 
                error: 'Latitude and longitude are required',
                example: '/api/flights/airports/location?latitude=40.7128&longitude=-74.0060&radius=100'
            });
        }

        const radiusKm = radius ? parseFloat(radius) : 100;
        const airports = await supabaseService.searchAirportsByLocation(
            parseFloat(latitude),
            parseFloat(longitude),
            radiusKm
        );

        res.json({
            success: true,
            data: airports,
            count: airports.length,
            searchCenter: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
            radiusKm
        });
    } catch (error) {
        console.error('Airport location search error:', error);
        res.status(500).json({ error: 'Failed to search airports by location' });
    }
};

const getAirportByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const { type } = req.query; // 'iata' or 'icao'
        
        const codeType = type === 'icao' ? 'icao' : 'iata';
        const airport = await supabaseService.getAirportByCode(code, codeType);
        
        if (!airport) {
            return res.status(404).json({ 
                error: `Airport with ${codeType.toUpperCase()} code '${code}' not found` 
            });
        }

        res.json({
            success: true,
            data: airport
        });
    } catch (error) {
        console.error('Airport by code error:', error);
        res.status(500).json({ error: 'Failed to get airport by code' });
    }
};

const getAirportsByCity = async (req, res) => {
    try {
        const { city } = req.params;
        const { country } = req.query;
        
        const filters = { city };
        if (country) filters.country = country;

        const airports = await supabaseService.getAirports(filters);

        res.json({
            success: true,
            data: airports,
            count: airports.length,
            searchCity: city,
            searchCountry: country || 'all'
        });
    } catch (error) {
        console.error('Airports by city error:', error);
        res.status(500).json({ error: 'Failed to get airports by city' });
    }
};

const getFlightOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        
        // This would typically call Amadeus to get detailed flight offer information
        const flightOffer = await amadeusService.getFlightOffer(offerId);
        
        res.json({
            success: true,
            data: flightOffer
        });
    } catch (error) {
        console.error('Flight offer error:', error);
        res.status(500).json({ error: 'Failed to get flight offer details' });
    }
};

module.exports = {
    searchFlights,
    getAirports,
    getAirportsByLocation,
    getAirportByCode,
    getAirportsByCity,
    getFlightOffer
};