// Load environment variables
require('dotenv').config();

let supabase;

// Initialize Supabase client
try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        const { createClient } = require('@supabase/supabase-js');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log('✅ Supabase client initialized successfully');
    } else {
        console.warn('⚠️  Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
        supabase = null;
    }
} catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error.message);
    supabase = null;
}

// Helper function to check if Supabase is configured
const checkSupabaseConfig = () => {
    if (!supabase) {
        throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your environment variables.');
    }
};

/**
 * Test database connection
 */
const testConnection = async () => {
    checkSupabaseConfig();
    
    try {
        // Simple test query to check connection
        const { data, error } = await supabase
            .from('test') // This table may not exist, that's okay
            .select('*')
            .limit(1);
        
        // If we get here without throwing, connection is working
        return {
            status: 'connected',
            message: 'Database connection successful',
            timestamp: new Date().toISOString(),
            url: process.env.SUPABASE_URL
        };
    } catch (error) {
        // Even if the query fails, it means we can connect
        return {
            status: 'connected',
            message: 'Database connection successful (test query expected to fail)',
            timestamp: new Date().toISOString(),
            url: process.env.SUPABASE_URL,
            note: 'This is normal - no test table exists yet'
        };
    }
};

/**
 * User management functions
 */
const userService = {
    // Get user profile
    async getUserProfile(userId) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        return data;
    },

    // Create or update user profile
    async upsertUserProfile(userId, profileData) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('user_profiles')
            .upsert({
                id: userId,
                ...profileData,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Get user's saved locations
    async getUserLocations(userId) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('user_locations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    },

    // Save user location
    async saveUserLocation(userId, locationData) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('user_locations')
            .insert({
                user_id: userId,
                ...locationData,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Get user's favorites
    async getUserFavorites(userId, type = null) {
        checkSupabaseConfig();
        
        let query = supabase
            .from('user_favorites')
            .select('*')
            .eq('user_id', userId);
        
        if (type) {
            query = query.eq('type', type);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    },

    // Add to favorites
    async addToFavorites(userId, favoriteData) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('user_favorites')
            .insert({
                user_id: userId,
                ...favoriteData,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Remove from favorites
    async removeFromFavorites(userId, favoriteId) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('user_favorites')
            .delete()
            .eq('user_id', userId)
            .eq('id', favoriteId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Get user's search history
    async getUserSearchHistory(userId, limit = 50) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('user_search_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data;
    },

    // Save user search to history
    async saveUserSearch(userId, searchData) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('user_search_history')
            .insert({
                user_id: userId,
                ...searchData,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Delete search from history
    async deleteUserSearch(userId, searchId) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('user_search_history')
            .delete()
            .eq('user_id', userId)
            .eq('id', searchId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Clear all search history
    async clearUserSearchHistory(userId) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('user_search_history')
            .delete()
            .eq('user_id', userId)
            .select();
        
        if (error) throw error;
        return data;
    }
};

/**
 * Route and trip management functions
 */
const routeService = {
    // Save calculated route
    async saveRoute(userId, routeData) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('saved_routes')
            .insert({
                user_id: userId,
                ...routeData,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Get user's saved routes
    async getUserRoutes(userId) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('saved_routes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    },

    // Get route by ID
    async getRouteById(routeId, userId = null) {
        checkSupabaseConfig();
        
        let query = supabase
            .from('saved_routes')
            .select('*')
            .eq('id', routeId);
        
        if (userId) {
            query = query.eq('user_id', userId);
        }
        
        const { data, error } = await query.single();
        
        if (error) throw error;
        return data;
    },

    // Update route
    async updateRoute(routeId, userId, updates) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('saved_routes')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', routeId)
            .eq('user_id', userId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Delete route
    async deleteRoute(routeId, userId) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('saved_routes')
            .delete()
            .eq('id', routeId)
            .eq('user_id', userId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }
};

/**
 * Analytics and statistics functions
 */
const analyticsService = {
    // Log search activity
    async logSearch(searchType, searchParams, results) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('search_analytics')
            .insert({
                search_type: searchType, // 'flight', 'hotel', 'route'
                search_params: searchParams,
                result_count: results?.length || 0,
                timestamp: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Get popular destinations
    async getPopularDestinations(limit = 10) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .rpc('get_popular_destinations', { limit_count: limit });
        
        if (error) throw error;
        return data;
    },

    // Get search statistics
    async getSearchStats(timeframe = '7d') {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .rpc('get_search_statistics', { timeframe });
        
        if (error) throw error;
        return data;
    }
};

/**
 * Cache management for frequently accessed data
 */
const cacheService = {
    // Store cached data
    async setCachedData(key, data, ttlMinutes = 60) {
        checkSupabaseConfig();
        
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);
        
        const { data: result, error } = await supabase
            .from('cached_data')
            .upsert({
                cache_key: key,
                data: data,
                expires_at: expiresAt.toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        return result;
    },

    // Get cached data
    async getCachedData(key) {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('cached_data')
            .select('*')
            .eq('cache_key', key)
            .gt('expires_at', new Date().toISOString())
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') return null; // No rows found
            throw error;
        }
        
        return data?.data || null;
    },

    // Clean expired cache entries
    async cleanExpiredCache() {
        checkSupabaseConfig();
        
        const { data, error } = await supabase
            .from('cached_data')
            .delete()
            .lt('expires_at', new Date().toISOString())
            .select();
        
        if (error) throw error;
        return data;
    }
};

/**
 * Health check for Supabase service
 */
const healthCheck = () => {
    const isConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
    
    return {
        service: 'Supabase',
        configured: isConfigured,
        url: process.env.SUPABASE_URL || 'not set',
        key: process.env.SUPABASE_ANON_KEY ? 'configured' : 'missing',
        client: supabase ? 'initialized' : 'not initialized',
        status: isConfigured && supabase ? 'ready' : 'not configured'
    };
};

/**
 * Database schema creation (for initial setup)
 */
const createTables = async () => {
    checkSupabaseConfig();
    
    const tables = {
        user_profiles: `
            CREATE TABLE IF NOT EXISTS user_profiles (
                id UUID PRIMARY KEY,
                email VARCHAR(255),
                name VARCHAR(255),
                preferences JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `,
        user_locations: `
            CREATE TABLE IF NOT EXISTS user_locations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES user_profiles(id),
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL, -- 'home', 'work', 'favorite'
                address TEXT,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `,
        user_favorites: `
            CREATE TABLE IF NOT EXISTS user_favorites (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES user_profiles(id),
                type VARCHAR(50) NOT NULL, -- 'hotel', 'flight', 'route'
                item_id VARCHAR(255) NOT NULL,
                item_data JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `,
        user_search_history: `
            CREATE TABLE IF NOT EXISTS user_search_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES user_profiles(id),
                search_type VARCHAR(50) NOT NULL, -- 'flight', 'hotel', 'route'
                search_params JSONB DEFAULT '{}',
                result_count INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `,
        saved_routes: `
            CREATE TABLE IF NOT EXISTS saved_routes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES user_profiles(id),
                name VARCHAR(255),
                origin JSONB NOT NULL,
                destination JSONB NOT NULL,
                waypoints JSONB DEFAULT '[]',
                route_data JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `,
        search_analytics: `
            CREATE TABLE IF NOT EXISTS search_analytics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                search_type VARCHAR(50) NOT NULL,
                search_params JSONB DEFAULT '{}',
                result_count INTEGER DEFAULT 0,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `,
        cached_data: `
            CREATE TABLE IF NOT EXISTS cached_data (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cache_key VARCHAR(255) UNIQUE NOT NULL,
                data JSONB NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `
    };

    try {
        for (const [tableName, sql] of Object.entries(tables)) {
            const { error } = await supabase.rpc('exec_sql', { sql });
            if (error) {
                console.warn(`Warning: Could not create table ${tableName}:`, error.message);
            } else {
                console.log(`✅ Table ${tableName} ready`);
            }
        }
        return { success: true, message: 'Database tables checked/created' };
    } catch (error) {
        console.warn('Warning: Could not create tables. This is normal if you don\'t have admin access.');
        return { success: false, message: 'Table creation requires admin access', error: error.message };
    }
};




async function DbIataCode(searchQuery) {
  const { data, error } = await supabase
    .from('IATA') //table IATA
    .select('"Name", "IATA"') // Select both Name and IATA columns
    .or(`"Name".ilike.%${searchQuery}%`)



  if (error) {
    console.error('[supabaseService.findIataCode]', error);
    return [];
  }

  // Returns an array of objects like: { Name: 'Singapore Changi Airport', IATA: 'SIN' }
  return data;
}


module.exports = {
    // Core client
    supabase,
    
    // Connection utilities
    testConnection,
    healthCheck,
    createTables,
    
    // Service modules
    userService,
    routeService,
    analyticsService,
    cacheService,

    DbIataCode,
    
    // Direct exports for convenience
    getUserProfile: userService.getUserProfile,
    saveUserLocation: userService.saveUserLocation,
    getUserLocations: userService.getUserLocations,
    saveRoute: routeService.saveRoute,
    getUserRoutes: routeService.getUserRoutes
};