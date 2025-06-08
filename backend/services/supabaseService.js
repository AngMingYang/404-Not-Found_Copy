const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// AIRPORT OPERATIONS
const getAirports = async (filters = {}) => {
    try {
        let query = supabase
            .from('airports')
            .select('*')
            .eq('is_active', true);

        if (filters.city) {
            query = query.ilike('city', `%${filters.city}%`);
        }
        if (filters.country) {
            query = query.ilike('country', `%${filters.country}%`);
        }
        if (filters.iata_code) {
            query = query.eq('iata_code', filters.iata_code.toUpperCase());
        }

        const { data, error } = await query.order('name');
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase airport fetch error:', error);
        throw error;
    }
};

const getAirportByCode = async (code, codeType = 'iata') => {
    try {
        const column = codeType === 'iata' ? 'iata_code' : 'icao_code';
        const { data, error } = await supabase
            .from('airports')
            .select('*')
            .eq(column, code.toUpperCase())
            .eq('is_active', true)
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase airport by code fetch error:', error);
        throw error;
    }
};

const searchAirportsByLocation = async (latitude, longitude, radiusKm = 100) => {
    try {
        // Using PostGIS-style distance calculation
        const { data, error } = await supabase.rpc('airports_within_radius', {
            lat: latitude,
            lng: longitude,
            radius_km: radiusKm
        });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase airport location search error:', error);
        throw error;
    }
};

// HOTEL OPERATIONS
const upsertHotels = async (hotels) => {
    try {
        // Transform Amadeus data to match our schema
        const transformedHotels = hotels.map(hotel => ({
            name: hotel.name,
            address: hotel.address?.lines?.join(', '),
            city: hotel.address?.cityName,
            country: hotel.address?.countryCode,
            latitude: parseFloat(hotel.geoCode?.latitude),
            longitude: parseFloat(hotel.geoCode?.longitude),
            hotel_chain: hotel.chainCode,
            star_rating: hotel.rating ? parseInt(hotel.rating) : null,
            phone: hotel.contact?.phone,
            email: hotel.contact?.email,
            website: hotel.contact?.website,
            is_active: true
        }));

        const { data, error } = await supabase
            .from('hotels')
            .upsert(transformedHotels, { 
                onConflict: 'name,city,country',
                ignoreDuplicates: false 
            })
            .select();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase hotel upsert error:', error);
        throw error;
    }
};

const getHotelsByCity = async (city, country = null) => {
    try {
        let query = supabase
            .from('hotels')
            .select('*')
            .ilike('city', `%${city}%`)
            .eq('is_active', true);

        if (country) {
            query = query.ilike('country', `%${country}%`);
        }

        const { data, error } = await query.order('star_rating', { ascending: false });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase hotels by city fetch error:', error);
        throw error;
    }
};

const getHotelsByLocation = async (latitude, longitude, radiusKm = 50) => {
    try {
        const { data, error } = await supabase.rpc('hotels_within_radius', {
            lat: latitude,
            lng: longitude,
            radius_km: radiusKm
        });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase hotel location search error:', error);
        throw error;
    }
};

const getHotelById = async (id) => {
    try {
        const { data, error } = await supabase
            .from('hotels')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase hotel by ID fetch error:', error);
        throw error;
    }
};

// CACHED ROUTES OPERATIONS
const getCachedRoute = async (originType, originId, destType, destId, transportMode = 'driving') => {
    try {
        const { data, error } = await supabase
            .from('cached_routes')
            .select('*')
            .eq('origin_type', originType)
            .eq('origin_id', originId)
            .eq('destination_type', destType)
            .eq('destination_id', destId)
            .eq('transportation_mode', transportMode)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
        return data;
    } catch (error) {
        console.error('Supabase cached route fetch error:', error);
        return null;
    }
};

const saveCachedRoute = async (routeData) => {
    try {
        const { data, error } = await supabase
            .from('cached_routes')
            .upsert(routeData, { 
                onConflict: 'origin_type,origin_id,destination_type,destination_id,transportation_mode' 
            })
            .select();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase cached route save error:', error);
        throw error;
    }
};

// USER LOCATION OPERATIONS
const getUserLocations = async (userId, includeReferences = true) => {
    try {
        let query = supabase
            .from('user_locations')
            .select(`
                *,
                ${includeReferences ? `
                airport:airports!user_locations_reference_id_fkey(name, iata_code, city, country),
                hotel:hotels!user_locations_reference_id_fkey(name, city, country, star_rating)
                ` : ''}
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        const { data, error } = await query;
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase user locations fetch error:', error);
        throw error;
    }
};

const saveUserLocation = async (locationData) => {
    try {
        const { data, error } = await supabase
            .from('user_locations')
            .insert(locationData)
            .select();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase user location save error:', error);
        throw error;
    }
};

const getUserFavorites = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('user_locations')
            .select(`
                *,
                airport:airports!user_locations_reference_id_fkey(name, iata_code, city, country),
                hotel:hotels!user_locations_reference_id_fkey(name, city, country, star_rating)
            `)
            .eq('user_id', userId)
            .eq('is_favorite', true)
            .order('name');
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase user favorites fetch error:', error);
        throw error;
    }
};

// USER SEARCH HISTORY
const saveUserSearch = async (searchData) => {
    try {
        const { data, error } = await supabase
            .from('user_searches')
            .insert(searchData)
            .select();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase user search save error:', error);
        throw error;
    }
};

const getUserSearchHistory = async (userId, limit = 10) => {
    try {
        const { data, error } = await supabase
            .from('user_searches')
            .select(`
                *,
                departure_airport:airports!user_searches_departure_airport_id_fkey(name, iata_code, city, country),
                arrival_airport:airports!user_searches_arrival_airport_id_fkey(name, iata_code, city, country),
                selected_hotel:hotels!user_searches_selected_hotel_id_fkey(name, city, country, star_rating)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase user search history fetch error:', error);
        throw error;
    }
};

// USER LOCATION MANAGEMENT (additional methods)
const updateUserLocation = async (locationId, userId, updateData) => {
    try {
        const { data, error } = await supabase
            .from('user_locations')
            .update(updateData)
            .eq('id', locationId)
            .eq('user_id', userId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase user location update error:', error);
        throw error;
    }
};

const deleteUserLocation = async (locationId, userId) => {
    try {
        const { data, error } = await supabase
            .from('user_locations')
            .delete()
            .eq('id', locationId)
            .eq('user_id', userId)
            .select();
        
        if (error) throw error;
        return data.length > 0;
    } catch (error) {
        console.error('Supabase user location delete error:', error);
        throw error;
    }
};

const toggleFavorite = async (locationId, userId, isFavorite) => {
    try {
        const { data, error } = await supabase
            .from('user_locations')
            .update({ is_favorite: isFavorite })
            .eq('id', locationId)
            .eq('user_id', userId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Supabase toggle favorite error:', error);
        throw error;
    }
};

// USER SEARCH MANAGEMENT (additional methods)
const deleteUserSearch = async (searchId, userId) => {
    try {
        const { data, error } = await supabase
            .from('user_searches')
            .delete()
            .eq('id', searchId)
            .eq('user_id', userId)
            .select();
        
        if (error) throw error;
        return data.length > 0;
    } catch (error) {
        console.error('Supabase user search delete error:', error);
        throw error;
    }
};

const clearUserSearchHistory = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('user_searches')
            .delete()
            .eq('user_id', userId)
            .select();
        
        if (error) throw error;
        return data.length;
    } catch (error) {
        console.error('Supabase clear search history error:', error);
        throw error;
    }
};

// CACHED ROUTES (additional methods)
const getCachedRouteById = async (routeId) => {
    try {
        const { data, error } = await supabase
            .from('cached_routes')
            .select('*')
            .eq('id', routeId)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    } catch (error) {
        console.error('Supabase cached route by ID fetch error:', error);
        return null;
    }
};

module.exports = {
    // Airport operations
    getAirports,
    getAirportByCode,
    searchAirportsByLocation,
    
    // Hotel operations
    upsertHotels,
    getHotelsByCity,
    getHotelsByLocation,
    getHotelById,
    
    // Cached routes
    getCachedRoute,
    saveCachedRoute,
    
    // User locations
    getUserLocations,
    saveUserLocation,
    getUserFavorites,
    
    // User search history
    saveUserSearch,
    getUserSearchHistory,

    updateUserLocation,
    deleteUserLocation,
    toggleFavorite,
    deleteUserSearch,
    clearUserSearchHistory,
    getCachedRouteById
};