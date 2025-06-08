const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');

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