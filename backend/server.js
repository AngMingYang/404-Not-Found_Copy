// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to API routes only
app.use('/api', limiter);

// Compression middleware
app.use(compression());

// CORS middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3000', 
            'http://localhost:8080', 
            'http://localhost:3001'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Request logging middleware (custom for development)
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    }
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    try {
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: require('./package.json').version,
            dependencies: {
                supabase: process.env.SUPABASE_URL ? 'configured' : 'not configured',
                amadeus: process.env.AMADEUS_CLIENT_ID ? 'configured' : 'not configured'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// Basic test endpoint
app.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Trippy Backend is running!',
        timestamp: new Date().toISOString(),
        environment: {
            node_version: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: process.memoryUsage()
        }
    });
});

// Database test endpoint
app.get('/test-db', async (req, res) => {
    try {
        // Try to import and test Supabase connection
        let supabaseService;
        try {
            supabaseService = require('./services/supabaseService');
            const result = await supabaseService.testConnection();
            res.json({
                success: true,
                message: 'Database connection test',
                database: result
            });
        } catch (dbError) {
            res.json({
                success: false,
                message: 'Database service not configured',
                error: dbError.message,
                note: 'This is expected if you haven\'t set up Supabase yet'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Database test failed',
            error: error.message
        });
    }
});

// Quick database test (simpler)
app.get('/test-db/quick', (req, res) => {
    const hasSupabaseConfig = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
    
    res.json({
        success: true,
        message: 'Quick database configuration check',
        database: {
            configured: hasSupabaseConfig,
            url: process.env.SUPABASE_URL ? 'set' : 'not set',
            key: process.env.SUPABASE_ANON_KEY ? 'set' : 'not set'
        }
    });
});

// API root endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'Trippy API',
        version: '1.0.0',
        status: 'active',
        endpoints: {
            health: 'GET /health - Server health check',
            test: 'GET /test - Basic server test',
            database: 'GET /test-db - Database connection test',
            flights: {
                search: 'GET|POST /api/flights/search - Search flights',
                airports: 'GET /api/flights/airports - Search airports',
                airportsByLocation: 'GET /api/flights/airports/location - Airports near coordinates',
                airportByCode: 'GET /api/flights/airports/{code} - Get specific airport',
                airportsByCity: 'GET /api/flights/airports/city/{city} - Airports in city',
                flightStatus: 'GET /api/flights/status - Real-time flight status',
                offers: 'GET /api/flights/offers/{id} - Flight offer details'
            },
            hotels: {
                search: 'GET|POST /api/hotels/search - Search hotels',
                details: 'GET /api/hotels/{id} - Get hotel details',
                byLocation: 'GET /api/hotels/location - Hotels near coordinates',
                byCity: 'GET /api/hotels/city/{city} - Hotels in city',
                ratings: 'GET /api/hotels/ratings - Hotel ratings and reviews',
                booking: 'POST /api/hotels/booking - Create hotel booking',
                chains: 'GET /api/hotels/chains - Hotel chain reference data',
                amenities: 'GET /api/hotels/amenities - Hotel amenity reference data'
            },
            routes: {
                calculate: 'POST /api/routes/calculate - Calculate optimal route',
                direct: 'GET /api/routes/direct - Direct route between points',
                cached: 'GET|POST /api/routes/cached - Cached route management',
                optimize: 'POST /api/routes/optimize - Multi-destination optimization',
                matrix: 'POST /api/routes/matrix - Travel time matrix',
                stats: 'GET /api/routes/stats - Route statistics',
                popular: 'GET /api/routes/popular - Popular routes'
            },
            users: {
                locations: 'GET|POST /api/users/{id}/locations - User saved locations',
                favorites: 'GET|POST /api/users/{id}/favorites - User favorites',
                searchHistory: 'GET|POST /api/users/{id}/search-history - Search history',
                profile: 'GET|PUT /api/users/{id}/profile - User profile'
            }
        },
        services: {
            amadeus: process.env.AMADEUS_CLIENT_ID ? 'configured' : 'not configured',
            supabase: process.env.SUPABASE_URL ? 'configured' : 'not configured',
            caching: 'in-memory available',
            routing: 'flight-based via Amadeus'
        },
        examples: {
            flightSearch: 'GET /api/flights/search?origin=LAX&destination=JFK&departureDate=2025-07-01&adults=2',
            hotelSearch: 'GET /api/hotels/search?city=Paris&country=France&checkIn=2025-07-01&checkOut=2025-07-05&adults=2',
            airportSearch: 'GET /api/flights/airports?keyword=New York&max=10',
            routeCalculation: 'POST /api/routes/calculate (with JSON body)'
        }
    });
});

// Import route modules with error handling
console.log('📁 Loading route modules...');

let hotelRoutes, flightRoutes, userRoutes, routeRoutes;

try {
    hotelRoutes = require('./routes/hotels');
    console.log('✅ Hotel routes loaded');
} catch (error) {
    console.warn('⚠️  Hotel routes not found, creating fallback router');
    hotelRoutes = express.Router();
    hotelRoutes.get('/search', (req, res) => res.status(501).json({ error: 'Hotel routes not implemented yet' }));
    hotelRoutes.post('/search', (req, res) => res.status(501).json({ error: 'Hotel routes not implemented yet' }));
    hotelRoutes.get('/chains', (req, res) => res.status(501).json({ error: 'Hotel routes not implemented yet' }));
    hotelRoutes.get('/amenities', (req, res) => res.status(501).json({ error: 'Hotel routes not implemented yet' }));
    hotelRoutes.get('/:id', (req, res) => res.status(501).json({ error: 'Hotel routes not implemented yet' }));
}

try {
    flightRoutes = require('./routes/flights');
    console.log('✅ Flight routes loaded');
} catch (error) {
    console.warn('⚠️  Flight routes not found, creating fallback router');
    flightRoutes = express.Router();
    flightRoutes.get('/search', (req, res) => res.status(501).json({ error: 'Flight routes not implemented yet' }));
    flightRoutes.post('/search', (req, res) => res.status(501).json({ error: 'Flight routes not implemented yet' }));
    flightRoutes.get('/airports', (req, res) => res.status(501).json({ error: 'Flight routes not implemented yet' }));
    flightRoutes.get('/status', (req, res) => res.status(501).json({ error: 'Flight routes not implemented yet' }));
}

try {
    userRoutes = require('./routes/users');
    console.log('✅ User routes loaded');
} catch (error) {
    console.warn('⚠️  User routes not found, creating fallback router');
    userRoutes = express.Router();
    userRoutes.get('/:userId/locations', (req, res) => res.status(501).json({ error: 'User routes not implemented yet' }));
    userRoutes.post('/:userId/locations', (req, res) => res.status(501).json({ error: 'User routes not implemented yet' }));
    userRoutes.get('/:userId/favorites', (req, res) => res.status(501).json({ error: 'User routes not implemented yet' }));
    userRoutes.get('/:userId/profile', (req, res) => res.status(501).json({ error: 'User routes not implemented yet' }));
}

try {
    routeRoutes = require('./routes/routes');
    console.log('✅ Route calculation routes loaded');
} catch (error) {
    console.warn('⚠️  Route calculation routes not found, creating fallback router');
    routeRoutes = express.Router();
    routeRoutes.post('/calculate', (req, res) => res.status(501).json({ error: 'Route calculation not implemented yet' }));
    routeRoutes.get('/direct', (req, res) => res.status(501).json({ error: 'Route calculation not implemented yet' }));
    routeRoutes.post('/optimize', (req, res) => res.status(501).json({ error: 'Route calculation not implemented yet' }));
}

// Use the route modules - mount them safely
console.log('🔗 Mounting API routes...');

try {
    app.use('/api/hotels', hotelRoutes);
    console.log('✅ Hotel routes mounted at /api/hotels');
} catch (error) {
    console.error('❌ Failed to mount hotel routes:', error.message);
}

try {
    app.use('/api/flights', flightRoutes);
    console.log('✅ Flight routes mounted at /api/flights');
} catch (error) {
    console.error('❌ Failed to mount flight routes:', error.message);
}

try {
    app.use('/api/users', userRoutes);
    console.log('✅ User routes mounted at /api/users');
} catch (error) {
    console.error('❌ Failed to mount user routes:', error.message);
}

try {
    app.use('/api/routes', routeRoutes);
    console.log('✅ Route calculation routes mounted at /api/routes');
} catch (error) {
    console.error('❌ Failed to mount route calculation routes:', error.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Handle specific error types
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON in request body',
            error: 'Please check your request format'
        });
    }
    
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('/{*any}', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
        availableRoutes: [
            'GET /health',
            'GET /test',
            'GET /test-db',
            'GET /api',
            'GET /api/hotels/search',
            'GET /api/flights/search',
            'POST /api/routes/calculate'
        ],
        timestamp: new Date().toISOString()
    });
});
const PORT = process.env.PORT || 8080;

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    console.log('✅ Server shutdown complete');
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

app.listen(PORT, () => {
    console.log('🚀 Trippy Backend Starting...');
    console.log('====================================');
    console.log(`📊 Server: http://localhost:${PORT}`);
    console.log(`📋 Health: http://localhost:${PORT}/health`);
    console.log(`🧪 Test: http://localhost:${PORT}/test`);
    console.log(`🗃️  Database: http://localhost:${PORT}/test-db`);
    console.log(`🔧 API: http://localhost:${PORT}/api`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📦 Version: ${require('./package.json').version}`);
    console.log('====================================');
    
    // Environment check
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        console.log('✅ Supabase configuration found');
    } else {
        console.log('⚠️  Supabase not configured (some features will be limited)');
    }
    
    if (process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET) {
        console.log('✅ Amadeus configuration found');
    } else {
        console.log('⚠️  Amadeus not configured (flight/hotel search will be limited)');
        console.log('💡 Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET to enable full functionality');
    }
    
    console.log('====================================');
    console.log('✅ Server is ready and listening!');
});



/*
const { getIataCode } = require('./controllers/flightController');
(async () => {
  const code = await getIataCode("East L");
  console.log('Code:', code); // expecting SIN
})();

*/


module.exports = app;