const supabaseService = require('../services/supabaseService');

/**
 * Get user's saved locations
 * GET /api/users/:userId/locations
 */
const getUserLocations = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID'
            });
        }

        try {
            const locations = await supabaseService.getUserLocations(userId);
            
            return res.json({
                success: true,
                data: {
                    userId,
                    locations: locations || [],
                    count: locations?.length || 0
                },
                meta: {
                    retrievedAt: new Date().toISOString()
                }
            });

        } catch (dbError) {
            console.error('Database error getting user locations:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not retrieve user locations'
            });
        }

    } catch (error) {
        console.error('Get user locations error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get user locations',
            message: error.message
        });
    }
};

/**
 * Save a new user location
 * POST /api/users/:userId/locations
 */
const saveUserLocation = async (req, res) => {
    try {
        const { userId } = req.params;
        const locationData = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID'
            });
        }

        // Validate location data
        const requiredFields = ['name', 'type'];
        const missingFields = requiredFields.filter(field => !locationData[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required location data',
                missingFields,
                example: {
                    name: 'Home',
                    type: 'home', // 'home', 'work', 'favorite'
                    address: '123 Main St, City, State',
                    latitude: 40.7128,
                    longitude: -74.0060
                }
            });
        }

        // Validate location type
        const validTypes = ['home', 'work', 'favorite'];
        if (!validTypes.includes(locationData.type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid location type',
                validTypes,
                received: locationData.type
            });
        }

        try {
            const savedLocation = await supabaseService.saveUserLocation(userId, locationData);
            
            return res.status(201).json({
                success: true,
                data: savedLocation,
                message: 'Location saved successfully'
            });

        } catch (dbError) {
            console.error('Database error saving user location:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not save user location'
            });
        }

    } catch (error) {
        console.error('Save user location error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to save user location',
            message: error.message
        });
    }
};

/**
 * Update a user location
 * PUT /api/users/:userId/locations/:locationId
 */
const updateUserLocation = async (req, res) => {
    try {
        const { userId, locationId } = req.params;
        const updates = req.body;

        if (!userId || !locationId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID or location ID'
            });
        }

        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No update data provided'
            });
        }

        // Validate location type if being updated
        if (updates.type) {
            const validTypes = ['home', 'work', 'favorite'];
            if (!validTypes.includes(updates.type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid location type',
                    validTypes,
                    received: updates.type
                });
            }
        }

        return res.status(501).json({
            success: false,
            error: 'Update location not implemented',
            message: 'Integrate with database update functionality',
            userId,
            locationId,
            updates
        });

    } catch (error) {
        console.error('Update user location error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update user location',
            message: error.message
        });
    }
};

/**
 * Delete a user location
 * DELETE /api/users/:userId/locations/:locationId
 */
const deleteUserLocation = async (req, res) => {
    try {
        const { userId, locationId } = req.params;

        if (!userId || !locationId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID or location ID'
            });
        }

        return res.status(501).json({
            success: false,
            error: 'Delete location not implemented',
            message: 'Integrate with database delete functionality',
            userId,
            locationId
        });

    } catch (error) {
        console.error('Delete user location error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete user location',
            message: error.message
        });
    }
};

/**
 * Get user's favorite locations
 * GET /api/users/:userId/favorites
 */
const getUserFavorites = async (req, res) => {
    try {
        const { userId } = req.params;
        const { type } = req.query; // 'hotel', 'flight', 'route'

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID'
            });
        }

        try {
            const favorites = await supabaseService.getUserFavorites(userId, type);
            
            return res.json({
                success: true,
                data: {
                    userId,
                    favorites: favorites || [],
                    count: favorites?.length || 0,
                    filterType: type || 'all'
                },
                meta: {
                    retrievedAt: new Date().toISOString()
                }
            });

        } catch (dbError) {
            console.error('Database error getting user favorites:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not retrieve user favorites'
            });
        }

    } catch (error) {
        console.error('Get user favorites error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get user favorites',
            message: error.message
        });
    }
};

/**
 * Add location to favorites
 * POST /api/users/:userId/favorites
 */
const addToFavorites = async (req, res) => {
    try {
        const { userId } = req.params;
        const favoriteData = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID'
            });
        }

        // Validate favorite data
        const requiredFields = ['type', 'item_id'];
        const missingFields = requiredFields.filter(field => !favoriteData[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required favorite data',
                missingFields,
                example: {
                    type: 'hotel', // 'hotel', 'flight', 'route'
                    item_id: 'HOTEL_ID_123',
                    item_data: {
                        name: 'Hotel Name',
                        price: 150.00,
                        currency: 'USD'
                    }
                }
            });
        }

        // Validate favorite type
        const validTypes = ['hotel', 'flight', 'route'];
        if (!validTypes.includes(favoriteData.type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid favorite type',
                validTypes,
                received: favoriteData.type
            });
        }

        try {
            const savedFavorite = await supabaseService.addToFavorites(userId, favoriteData);
            
            return res.status(201).json({
                success: true,
                data: savedFavorite,
                message: 'Added to favorites successfully'
            });

        } catch (dbError) {
            console.error('Database error adding to favorites:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not add to favorites'
            });
        }

    } catch (error) {
        console.error('Add to favorites error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to add to favorites',
            message: error.message
        });
    }
};

/**
 * Remove location from favorites
 * DELETE /api/users/:userId/favorites/:favoriteId
 */
const removeFromFavorites = async (req, res) => {
    try {
        const { userId, favoriteId } = req.params;

        if (!userId || !favoriteId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID or favorite ID'
            });
        }

        try {
            const removedFavorite = await supabaseService.removeFromFavorites(userId, favoriteId);
            
            return res.json({
                success: true,
                data: removedFavorite,
                message: 'Removed from favorites successfully'
            });

        } catch (dbError) {
            console.error('Database error removing from favorites:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not remove from favorites'
            });
        }

    } catch (error) {
        console.error('Remove from favorites error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to remove from favorites',
            message: error.message
        });
    }
};

/**
 * Get user search history
 * GET /api/users/:userId/search-history?limit=50
 */
const getUserSearchHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50 } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID'
            });
        }

        try {
            const searchHistory = await supabaseService.getUserSearchHistory(userId, parseInt(limit));
            
            return res.json({
                success: true,
                data: {
                    userId,
                    searchHistory: searchHistory || [],
                    count: searchHistory?.length || 0,
                    limit: parseInt(limit)
                },
                meta: {
                    retrievedAt: new Date().toISOString()
                }
            });

        } catch (dbError) {
            console.error('Database error getting search history:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not retrieve search history'
            });
        }

    } catch (error) {
        console.error('Get search history error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get search history',
            message: error.message
        });
    }
};

/**
 * Save a new search to history
 * POST /api/users/:userId/search-history
 */
const saveUserSearch = async (req, res) => {
    try {
        const { userId } = req.params;
        const searchData = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID'
            });
        }

        // Validate search data
        const requiredFields = ['search_type'];
        const missingFields = requiredFields.filter(field => !searchData[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required search data',
                missingFields,
                example: {
                    search_type: 'flight', // 'flight', 'hotel', 'route'
                    search_params: {
                        origin: 'LAX',
                        destination: 'JFK',
                        date: '2025-07-01'
                    },
                    result_count: 25
                }
            });
        }

        // Validate search type
        const validTypes = ['flight', 'hotel', 'route'];
        if (!validTypes.includes(searchData.search_type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid search type',
                validTypes,
                received: searchData.search_type
            });
        }

        try {
            const savedSearch = await supabaseService.saveUserSearch(userId, searchData);
            
            return res.status(201).json({
                success: true,
                data: savedSearch,
                message: 'Search saved to history successfully'
            });

        } catch (dbError) {
            console.error('Database error saving search:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not save search to history'
            });
        }

    } catch (error) {
        console.error('Save search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to save search to history',
            message: error.message
        });
    }
};

/**
 * Delete a search from history
 * DELETE /api/users/:userId/search-history/:searchId
 */
const deleteUserSearch = async (req, res) => {
    try {
        const { userId, searchId } = req.params;

        if (!userId || !searchId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID or search ID'
            });
        }

        try {
            const deletedSearch = await supabaseService.deleteUserSearch(userId, searchId);
            
            return res.json({
                success: true,
                data: deletedSearch,
                message: 'Search deleted from history successfully'
            });

        } catch (dbError) {
            console.error('Database error deleting search:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not delete search from history'
            });
        }

    } catch (error) {
        console.error('Delete search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete search from history',
            message: error.message
        });
    }
};

/**
 * Clear all search history for user
 * DELETE /api/users/:userId/search-history
 */
const clearUserSearchHistory = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID'
            });
        }

        try {
            const clearedSearches = await supabaseService.clearUserSearchHistory(userId);
            
            return res.json({
                success: true,
                data: {
                    deletedCount: clearedSearches?.length || 0
                },
                message: 'Search history cleared successfully'
            });

        } catch (dbError) {
            console.error('Database error clearing search history:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not clear search history'
            });
        }

    } catch (error) {
        console.error('Clear search history error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to clear search history',
            message: error.message
        });
    }
};

/**
 * Get user profile/preferences
 * GET /api/users/:userId/profile
 */
const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID'
            });
        }

        try {
            const profile = await supabaseService.getUserProfile(userId);
            
            return res.json({
                success: true,
                data: profile || {
                    id: userId,
                    preferences: {},
                    created_at: new Date().toISOString(),
                    note: 'Profile not found - create one with PUT request'
                },
                meta: {
                    retrievedAt: new Date().toISOString()
                }
            });

        } catch (dbError) {
            if (dbError.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'User profile not found',
                    userId,
                    suggestion: 'Create profile with PUT /api/users/:userId/profile'
                });
            }

            console.error('Database error getting user profile:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not retrieve user profile'
            });
        }

    } catch (error) {
        console.error('Get user profile error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get user profile',
            message: error.message
        });
    }
};

/**
 * Update user preferences
 * PUT /api/users/:userId/profile
 */
const updateUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const profileData = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing user ID'
            });
        }

        if (!profileData || Object.keys(profileData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No profile data provided',
                example: {
                    name: 'John Doe',
                    email: 'john@example.com',
                    preferences: {
                        currency: 'USD',
                        seatPreference: 'aisle',
                        mealPreference: 'vegetarian',
                        notifications: {
                            email: true,
                            priceAlerts: true
                        }
                    }
                }
            });
        }

        try {
            const updatedProfile = await supabaseService.upsertUserProfile(userId, profileData);
            
            return res.json({
                success: true,
                data: updatedProfile,
                message: 'User profile updated successfully'
            });

        } catch (dbError) {
            console.error('Database error updating user profile:', dbError);
            return res.status(502).json({
                success: false,
                error: 'Database service unavailable',
                message: 'Could not update user profile'
            });
        }

    } catch (error) {
        console.error('Update user profile error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update user profile',
            message: error.message
        });
    }
};

module.exports = {
    getUserLocations,
    saveUserLocation,
    updateUserLocation,
    deleteUserLocation,
    getUserFavorites,
    addToFavorites,
    removeFromFavorites,
    getUserSearchHistory,
    saveUserSearch,
    deleteUserSearch,
    clearUserSearchHistory,
    getUserProfile,
    updateUserProfile
};