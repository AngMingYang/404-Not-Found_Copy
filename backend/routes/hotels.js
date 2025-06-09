const express = require('express');
const router = express.Router();

// Import controller - now fully implemented
let hotelController;
try {
    hotelController = require('../controllers/hotelController');
} catch (error) {
    console.warn('⚠️  hotelController not found, using placeholder functions');
    // Create placeholder functions
    hotelController = {
        searchHotels: (req, res) => res.status(501).json({ error: 'Hotel search not implemented yet' }),
        getHotelDetails: (req, res) => res.status(501).json({ error: 'Hotel details not implemented yet' }),
        searchHotelsByLocation: (req, res) => res.status(501).json({ error: 'Hotel location search not implemented yet' }),
        getHotelsByCity: (req, res) => res.status(501).json({ error: 'Hotels by city not implemented yet' }),
        getHotelRatings: (req, res) => res.status(501).json({ error: 'Hotel ratings not implemented yet' }),
        createHotelBooking: (req, res) => res.status(501).json({ error: 'Hotel booking not implemented yet' }),
        getHotelChains: (req, res) => res.status(501).json({ error: 'Hotel chains not implemented yet' }),
        getHotelAmenities: (req, res) => res.status(501).json({ error: 'Hotel amenities not implemented yet' })
    };
}

// Search hotels - GET and POST
// GET /api/hotels/search?city=Paris&country=France&checkIn=2025-07-01&checkOut=2025-07-05
router.get('/search', hotelController.searchHotels);
// POST /api/hotels/search
router.post('/search', hotelController.searchHotels);

// Search hotels by location (coordinates)
// GET /api/hotels/location?latitude=40.7128&longitude=-74.0060&radius=50&checkIn=2025-07-01&checkOut=2025-07-05
router.get('/location', hotelController.searchHotelsByLocation);

// Get hotels by city
// GET /api/hotels/city/Paris?country=France&checkIn=2025-07-01&checkOut=2025-07-05
router.get('/city/:city', hotelController.getHotelsByCity);

// Get hotel ratings
// GET /api/hotels/ratings?hotelIds=MCLONGHM,ADNYCCTB
router.get('/ratings', hotelController.getHotelRatings);

// Create hotel booking
// POST /api/hotels/booking
router.post('/booking', hotelController.createHotelBooking);

// Get hotel chains reference data
// GET /api/hotels/chains
router.get('/chains', hotelController.getHotelChains);

// Get hotel amenities reference data
// GET /api/hotels/amenities?category=Recreation
router.get('/amenities', hotelController.getHotelAmenities);

// Get hotel details by ID (this should be LAST to avoid conflicts)
// GET /api/hotels/123?checkIn=2025-07-01&checkOut=2025-07-05&adults=2
router.get('/:id', hotelController.getHotelDetails);

module.exports = router;