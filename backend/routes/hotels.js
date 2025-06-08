const express = require('express');
const router = express.Router();

// Import controller - but handle missing controllers gracefully
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
        getHotelsByCity: (req, res) => res.status(501).json({ error: 'Hotels by city not implemented yet' })
    };
}

// Search hotels
// POST /api/hotels/search
router.post('/search', hotelController.searchHotels);

// Alternative GET route for search (query parameters)
// GET /api/hotels/search?city=Paris&country=France&checkIn=2025-07-01&checkOut=2025-07-05
router.get('/search', hotelController.searchHotels);

// Get hotel details by ID
// GET /api/hotels/123
router.get('/:id', hotelController.getHotelDetails);

// Search hotels by location (coordinates)
// GET /api/hotels/location?latitude=40.7128&longitude=-74.0060&radius=50
router.get('/location', hotelController.searchHotelsByLocation);

// Get hotels by city
// GET /api/hotels/city/Paris?country=France
router.get('/city/:city', hotelController.getHotelsByCity);

module.exports = router;