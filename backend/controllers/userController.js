const supabaseService = require('../services/supabaseService');

const getUserLocations = async (req, res) => {
    try {
        const { userId } = req.params;
        const locations = await supabaseService.getUserLocations(parseInt(userId));
        
        res.json({
            success: true,
            data: locations,
            count: locations.length
        });
    } catch (error) {
        console.error('User locations fetch error:', error);
        res.status(500).json({ error: 'Failed to get user locations' });
    }
};

const saveUserLocation = async (req, res) => {
    try {
        const { userId } = req.params;
        const locationData = {
            ...req.body,
            user_id: parseInt(userId)
        };

        // Validate required fields
        if (!locationData.name || !locationData.latitude || !locationData.longitude) {
            return res.status(400).json({ 
                error: 'Name, latitude, and longitude are required' 
            });
        }

        const savedLocation = await supabaseService.saveUserLocation(locationData);
        
        res.json({
            success: true,
            data: savedLocation[0]
        });
    } catch (error) {
        console.error('User location save error:', error);
        res.status(500).json({ error: 'Failed to save user location' });
    }
};

const updateUserLocation = async (req, res) => {
    try {
        const { userId, locationId } = req.params;
        const updateData = req.body;

        const updatedLocation = await supabaseService.updateUserLocation(
            parseInt(locationId),
            parseInt(userId),
            updateData
        );
        
        if (!updatedLocation) {
            return res.status(404).json({ error: 'Location not found or not owned by user' });
        }

        res.json({
            success: true,
            data: updatedLocation
        });
    } catch (error) {
        console.error('User location update error:', error);
        res.status(500).json({ error: 'Failed to update user location' });
    }
};

const deleteUserLocation = async (req, res) => {
    try {
        const { userId, locationId } = req.params;

        const deleted = await supabaseService.deleteUserLocation(
            parseInt(locationId),
            parseInt(userId)
        );
        
        if (!deleted) {
            return res.status(404).json({ error: 'Location not found or not owned by user' });
        }

        res.json({
            success: true,
            message: 'Location deleted successfully'
        });
    } catch (error) {
        console.error('User location delete error:', error);
        res.status(500).json({ error: 'Failed to delete user location' });
    }
};

const getUserFavorites = async (req, res) => {
    try {
        const { userId } = req.params;
        const favorites = await supabaseService.getUserFavorites(parseInt(userId));
        
        res.json({
            success: true,
            data: favorites,
            count: favorites.length
        });
    } catch (error) {
        console.error('User favorites fetch error:', error);
        res.status(500).json({ error: 'Failed to get user favorites' });
    }
};

const addToFavorites = async (req, res) => {
    try {
        const { userId, locationId } = req.params;
        
        const result = await supabaseService.toggleFavorite(
            parseInt(locationId),
            parseInt(userId),
            true
        );
        
        res.json({
            success: true,
            data: result,
            message: 'Location added to favorites'
        });
    } catch (error) {
        console.error('Add to favorites error:', error);
        res.status(500).json({ error: 'Failed to add location to favorites' });
    }
};

const removeFromFavorites = async (req, res) => {
    try {
        const { userId, locationId } = req.params;
        
        const result = await supabaseService.toggleFavorite(
            parseInt(locationId),
            parseInt(userId),
            false
        );
        
        res.json({
            success: true,
            data: result,
            message: 'Location removed from favorites'
        });
    } catch (error) {
        console.error('Remove from favorites error:', error);
        res.status(500).json({ error: 'Failed to remove location from favorites' });
    }
};

const getUserSearchHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit } = req.query;
        
        const searchHistory = await supabaseService.getUserSearchHistory(
            parseInt(userId),
            limit ? parseInt(limit) : 10
        );
        
        res.json({
            success: true,
            data: searchHistory,
            count: searchHistory.length
        });
    } catch (error) {
        console.error('User search history fetch error:', error);
        res.status(500).json({ error: 'Failed to get user search history' });
    }
};

const saveUserSearch = async (req, res) => {
    try {
        const { userId } = req.params;
        const searchData = {
            ...req.body,
            user_id: parseInt(userId)
        };

        const savedSearch = await supabaseService.saveUserSearch(searchData);
        
        res.json({
            success: true,
            data: savedSearch[0]
        });
    } catch (error) {
        console.error('User search save error:', error);
        res.status(500).json({ error: 'Failed to save user search' });
    }
};

const deleteUserSearch = async (req, res) => {
    try {
        const { userId, searchId } = req.params;

        const deleted = await supabaseService.deleteUserSearch(
            parseInt(searchId),
            parseInt(userId)
        );
        
        if (!deleted) {
            return res.status(404).json({ error: 'Search not found or not owned by user' });
        }

        res.json({
            success: true,
            message: 'Search deleted successfully'
        });
    } catch (error) {
        console.error('User search delete error:', error);
        res.status(500).json({ error: 'Failed to delete user search' });
    }
};

const clearUserSearchHistory = async (req, res) => {
    try {
        const { userId } = req.params;

        const deletedCount = await supabaseService.clearUserSearchHistory(parseInt(userId));
        
        res.json({
            success: true,
            message: `Cleared ${deletedCount} search records`,
            deletedCount
        });
    } catch (error) {
        console.error('Clear search history error:', error);
        res.status(500).json({ error: 'Failed to clear user search history' });
    }
};

const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // This would typically get user profile from a users table
        // For now, return aggregated user data
        const [locations, favorites, searchHistory] = await Promise.all([
            supabaseService.getUserLocations(parseInt(userId)),
            supabaseService.getUserFavorites(parseInt(userId)),
            supabaseService.getUserSearchHistory(parseInt(userId), 5)
        ]);

        res.json({
            success: true,
            data: {
                userId: parseInt(userId),
                locationCount: locations.length,
                favoriteCount: favorites.length,
                recentSearches: searchHistory.length,
                lastActivity: searchHistory[0]?.created_at || null
            }
        });
    } catch (error) {
        console.error('User profile fetch error:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
};

const updateUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const profileData = req.body;

        // This would typically update a users table
        // For now, return success message
        res.json({
            success: true,
            message: 'User profile updated successfully',
            data: {
                userId: parseInt(userId),
                ...profileData,
                updatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('User profile update error:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
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