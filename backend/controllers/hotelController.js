const amadeusService = require('../services/amadeusService');
const supabaseService = require('../services/supabaseService');

const searchHotels = async (req, res) => {
    try {
        // Support both POST body and GET query parameters
        const params = req.method === 'POST' ? req.body : req.query;
        const { city, country, checkIn, checkOut, guests, latitude, longitude, radius } = params;
        
        let hotels;

        if (latitude && longitude) {
            // Search by location
            const radiusKm = radius ? parseFloat(radius) : 50;
            hotels = await supabaseService.getHotelsByLocation(
                parseFloat(latitude), 
                parseFloat(longitude), 
                radiusKm
            );
        } else if (city) {
            // Search by city
            hotels = await supabaseService.getHotelsByCity(city, country);
        } else {
            return res.status(400).json({ error: 'Either city or coordinates must be provided' });
        }

        // If we have fresh data requirements, also search Amadeus and update our database
        if (checkIn && checkOut) {
            try {
                const amadeusHotels = await amadeusService.searchHotels({
                    city: city || 'unknown',
                    checkIn,
                    checkOut,
                    guests: guests || 1
                });
                
                // Update our database with fresh data
                await supabaseService.upsertHotels(amadeusHotels);
                
                // Return fresh Amadeus data if available
                hotels = amadeusHotels;
            } catch (amadeusError) {
                console.warn('Amadeus search failed, using cached data:', amadeusError.message);
            }
        }

        res.json({
            success: true,
            data: hotels,
            count: hotels.length,
            source: checkIn && checkOut ? 'amadeus_fresh' : 'database_cached'
        });
    } catch (error) {
        console.error('Hotel search error:', error);
        res.status(500).json({ error: 'Failed to search hotels' });
    }
};

const getHotelDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const hotel = await supabaseService.getHotelById(parseInt(id));
        
        if (!hotel) {
            return res.status(404).json({ error: 'Hotel not found' });
        }

        res.json({
            success: true,
            data: hotel
        });
    } catch (error) {
        console.error('Hotel details error:', error);
        res.status(500).json({ error: 'Failed to get hotel details' });
    }
};

const searchHotelsByLocation = async (req, res) => {
    try {
        const { latitude, longitude, radius } = req.query;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ 
                error: 'Latitude and longitude are required',
                example: '/api/hotels/location?latitude=40.7128&longitude=-74.0060&radius=50'
            });
        }

        const radiusKm = radius ? parseFloat(radius) : 50;
        const hotels = await supabaseService.getHotelsByLocation(
            parseFloat(latitude),
            parseFloat(longitude),
            radiusKm
        );

        res.json({
            success: true,
            data: hotels,
            count: hotels.length,
            searchCenter: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
            radiusKm
        });
    } catch (error) {
        console.error('Hotel location search error:', error);
        res.status(500).json({ error: 'Failed to search hotels by location' });
    }
};

const getHotelsByCity = async (req, res) => {
    try {
        const { city } = req.params;
        const { country } = req.query;
        
        const hotels = await supabaseService.getHotelsByCity(city, country);

        res.json({
            success: true,
            data: hotels,
            count: hotels.length,
            searchCity: city,
            searchCountry: country || 'all'
        });
    } catch (error) {
        console.error('Hotels by city error:', error);
        res.status(500).json({ error: 'Failed to get hotels by city' });
    }
};

module.exports = {
    searchHotels,
    getHotelDetails,
    searchHotelsByLocation,
    getHotelsByCity
};