const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// User location management

// Get all user locations
// GET /api/users/123/locations
router.get('/:userId/locations', userController.getUserLocations);

// Save a new user location
// POST /api/users/123/locations
router.post('/:userId/locations', userController.saveUserLocation);

// Update a user location
// PUT /api/users/123/locations/456
router.put('/:userId/locations/:locationId', userController.updateUserLocation);

// Delete a user location
// DELETE /api/users/123/locations/456
router.delete('/:userId/locations/:locationId', userController.deleteUserLocation);

// Get user favorite locations
// GET /api/users/123/favorites
router.get('/:userId/favorites', userController.getUserFavorites);

// Add location to favorites
// POST /api/users/123/favorites/456
router.post('/:userId/favorites/:locationId', userController.addToFavorites);

// Remove location from favorites
// DELETE /api/users/123/favorites/456
router.delete('/:userId/favorites/:locationId', userController.removeFromFavorites);

// User search history management

// Get user search history
// GET /api/users/123/search-history?limit=10
router.get('/:userId/search-history', userController.getUserSearchHistory);

// Save a new search to history
// POST /api/users/123/search-history
router.post('/:userId/search-history', userController.saveUserSearch);

// Delete a search from history
// DELETE /api/users/123/search-history/789
router.delete('/:userId/search-history/:searchId', userController.deleteUserSearch);

// Clear all search history for user
// DELETE /api/users/123/search-history
router.delete('/:userId/search-history', userController.clearUserSearchHistory);

// User preferences and profile

// Get user profile/preferences
// GET /api/users/123/profile
router.get('/:userId/profile', userController.getUserProfile);

// Update user preferences
// PUT /api/users/123/profile
router.put('/:userId/profile', userController.updateUserProfile);

module.exports = router;