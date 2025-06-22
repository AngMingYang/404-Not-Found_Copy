// Load environment variables
require('dotenv').config();

// Simple in-memory cache implementation
// If you install node-cache, you can replace this with NodeCache for better features
class SimpleCache {
    constructor() {
        this.cache = new Map();
        this.ttlMap = new Map();
    }

    set(key, value, ttlSeconds = 300) { // Default 5 minutes
        const expiryTime = Date.now() + (ttlSeconds * 1000);
        this.cache.set(key, value);
        this.ttlMap.set(key, expiryTime);

        console.log("[from cacheServices.js : SimpleCache]")
        console.log('Cache contents:', Array.from(this.cache.entries()));
        
        // Clean up expired entries periodically
        this.cleanup();
        
        return true;
    }

    get(key) {
        const expiryTime = this.ttlMap.get(key);
        
        if (!expiryTime || Date.now() > expiryTime) {
            this.delete(key);
            return undefined;
        }
        
        return this.cache.get(key);
    }

    delete(key) {
        this.cache.delete(key);
        this.ttlMap.delete(key);
        return true;
    }

    clear() {
        this.cache.clear();
        this.ttlMap.clear();
        return true;
    }

    size() {
        return this.cache.size;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, expiryTime] of this.ttlMap.entries()) {
            if (now > expiryTime) {
                this.delete(key);
            }
        }
    }

    stats() {
        return {
            size: this.size(),
            keys: Array.from(this.cache.keys())
        };
    }
}

// Initialize cache
const cache = new SimpleCache();

// Cache key generators
const generateCacheKey = (prefix, ...parts) => {
    return `${prefix}:${parts.join(':')}`;
};

// Cache wrapper for functions
const withCache = async (key, fetchFunction, ttlSeconds = 300) => {
    // Try to get from cache first
    const cachedResult = cache.get(key);
    if (cachedResult !== undefined) {
        console.log(`Cache HIT: ${key}`);
        return cachedResult;
    }

    // If not in cache, fetch and store
    console.log(`Cache MISS: ${key}`);
    try {
        const result = await fetchFunction();
        cache.set(key, result, ttlSeconds);
        console.log('fetching and storing catch succes');
        return result;
    } catch (error) {
        console.error(`Cache fetch error for ${key}:`, error);
        throw error;
    }
};

// Specific cache methods for our app
const cacheService = {
    // Hotel search cache
    getHotels: async (city, country, fetchFunction) => {
        const key = generateCacheKey('hotels', city, country || 'all');
        return await withCache(key, fetchFunction, 1800); // 30 minutes
    },

    // Airport search cache
    getAirports: async (filters, fetchFunction) => {
        const key = generateCacheKey('airports', JSON.stringify(filters));
        return await withCache(key, fetchFunction, 3600); // 1 hour
    },

    // Flight search cache (shorter TTL due to dynamic pricing)
    getFlights: async (origin, destination, date, fetchFunction) => {
        const key = generateCacheKey('flights', origin, destination, date);
        return await withCache(key, fetchFunction, 300); // 5 minutes
    },

    // Route calculation cache
    getRoute: async (routeParams, fetchFunction) => {
        const key = generateCacheKey('route', JSON.stringify(routeParams));
        return await withCache(key, fetchFunction, 1800); // 30 minutes
    },

    // Generic cache methods
    set: (key, value, ttlSeconds) => cache.set(key, value, ttlSeconds),
    get: (key) => cache.get(key),
    delete: (key) => cache.delete(key),
    clear: () => cache.clear(),
    stats: () => cache.stats(),

    // Cache management
    invalidatePattern: (pattern) => {
        const keys = Array.from(cache.cache.keys());
        const regex = new RegExp(pattern);
        let deleted = 0;
        
        keys.forEach(key => {
            if (regex.test(key)) {
                cache.delete(key);
                deleted++;
            }
        });
        
        return deleted;
    },

    // Health check for cache
    healthCheck: () => {
        const stats = cache.stats();
        return {
            status: 'healthy',
            type: 'in-memory',
            size: stats.size,
            memoryUsage: process.memoryUsage()
        };
    }
};

// Cleanup expired entries every 5 minutes
setInterval(() => {
    cache.cleanup();
}, 5 * 60 * 1000);

module.exports = cacheService;