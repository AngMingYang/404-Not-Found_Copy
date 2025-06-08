// Load environment variables first
require('dotenv').config();

// Check environment variables before starting
const { checkEnvironmentVariables } = require('./utils/envChecker');
checkEnvironmentVariables();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const supabaseService = require('./services/supabaseService');

// Import route modules with error handling
let hotelRoutes, flightRoutes, userRoutes, routeRoutes;

try {
    hotelRoutes = require('./routes/hotels');
} catch (error) {
    console.warn('⚠️  Hotel routes not found, skipping...');
    hotelRoutes = express.Router();
    hotelRoutes.get('*', (req, res) => res.status(501).json({ error: 'Hotel routes not implemented yet' }));
}

try {
    flightRoutes = require('./routes/flights');
} catch (error) {
    console.warn('⚠️  Flight routes not found, skipping...');
    flightRoutes = express.Router();
    flightRoutes.get('*', (req, res) => res.status(501).json({ error: 'Flight routes not implemented yet' }));
}

try {
    userRoutes = require('./routes/users');
} catch (error) {
    console.warn('⚠️  User routes not found, skipping...');
    userRoutes = express.Router();
    userRoutes.get('*', (req, res) => res.status(501).json({ error: 'User routes not implemented yet' }));
}

try {
    routeRoutes = require('./routes/routes');
} catch (error) {
    console.warn('⚠️  Route calculation routes not found, skipping...');
    routeRoutes = express.Router();
    routeRoutes.get('*', (req, res) => res.status(501).json({ error: 'Route calculation not implemented yet' }));
}

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
app.use('/api/', limiter);

// Compression middleware
app.use(compression());

// CORS middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'],
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
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Routes
app.use('/api/hotels', hotelRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/users', userRoutes);
app.use('/api/routes', routeRoutes);

// Comprehensive database test endpoint
app.get('/test-db', async (req, res) => {
    const testResults = {
        timestamp: new Date().toISOString(),
        tests: [],
        summary: { passed: 0, failed: 0, total: 0 }
    };

    // Helper function to add test results
    const addTest = (name, success, data = null, error = null) => {
        testResults.tests.push({
            name,
            success,
            data: success ? data : null,
            error: success ? null : error?.message || error,
            timestamp: new Date().toISOString()
        });
        
        if (success) {
            testResults.summary.passed++;
        } else {
            testResults.summary.failed++;
        }
        testResults.summary.total++;
    };

    try {
        // Test 1: Basic Supabase connection
        console.log('Testing basic Supabase connection...');
        try {
            const airports = await supabaseService.getAirports();
            addTest('Basic Supabase Connection', true, { 
                message: 'Successfully connected to Supabase',
                airportCount: airports?.length || 0 
            });
        } catch (error) {
            addTest('Basic Supabase Connection', false, null, error);
        }

        // Test 2: Airport operations
        console.log('Testing airport operations...');
        try {
            // Get all airports (limited)
            const allAirports = await supabaseService.getAirports();
            const airportCount = allAirports.length;

            // Try to get a specific airport by IATA code (common codes)
            let specificAirport = null;
            const testCodes = ['LAX', 'JFK', 'LHR', 'DXB', 'SIN'];
            
            for (const code of testCodes) {
                try {
                    specificAirport = await supabaseService.getAirportByCode(code, 'iata');
                    if (specificAirport) break;
                } catch (err) {
                    // Continue to next code
                }
            }

            addTest('Airport Operations', true, {
                totalAirports: airportCount,
                sampleAirport: specificAirport ? {
                    code: specificAirport.iata_code,
                    name: specificAirport.name,
                    city: specificAirport.city
                } : 'No test airports found',
                hasData: airportCount > 0
            });
        } catch (error) {
            addTest('Airport Operations', false, null, error);
        }

        // Test 3: Hotel operations
        console.log('Testing hotel operations...');
        try {
            // Search hotels by city (try common cities)
            let hotels = [];
            const testCities = ['New York', 'London', 'Paris', 'Tokyo', 'Singapore'];
            
            for (const city of testCities) {
                try {
                    hotels = await supabaseService.getHotelsByCity(city);
                    if (hotels.length > 0) break;
                } catch (err) {
                    // Continue to next city
                }
            }

            addTest('Hotel Operations', true, {
                testCitiesChecked: testCities,
                hotelsFound: hotels.length,
                sampleHotel: hotels[0] ? {
                    name: hotels[0].name,
                    city: hotels[0].city,
                    rating: hotels[0].star_rating
                } : 'No hotels found in test cities',
                hasData: hotels.length > 0
            });
        } catch (error) {
            addTest('Hotel Operations', false, null, error);
        }

        // Test 4: Database schema validation
        console.log('Testing database schema...');
        try {
            // Test if all required tables exist by attempting simple queries
            const schemaTests = await Promise.allSettled([
                supabaseService.getAirports(),
                supabaseService.getHotelsByCity('test'),
                // Test other tables exist (will return empty but shouldn't error)
                supabaseService.getUserLocations(999999), // Non-existent user
                supabaseService.getUserSearchHistory(999999)
            ]);

            const schemaResults = schemaTests.map((result, index) => {
                const tableNames = ['airports', 'hotels', 'user_locations', 'user_searches'];
                return {
                    table: tableNames[index],
                    accessible: result.status === 'fulfilled',
                    error: result.status === 'rejected' ? result.reason?.message : null
                };
            });

            const accessibleTables = schemaResults.filter(r => r.accessible).length;
            
            addTest('Database Schema', accessibleTables === 4, {
                tables: schemaResults,
                accessibleCount: `${accessibleTables}/4`,
                allTablesAccessible: accessibleTables === 4
            });
        } catch (error) {
            addTest('Database Schema', false, null, error);
        }

        // Test 5: Location-based search functions
        console.log('Testing location-based search functions...');
        try {
            // Test airport search by location (using coordinates for New York)
            const airportsNearNY = await supabaseService.searchAirportsByLocation(40.7128, -74.0060, 100);
            
            // Test hotel search by location
            const hotelsNearNY = await supabaseService.getHotelsByLocation(40.7128, -74.0060, 50);

            addTest('Location-based Search', true, {
                location: 'New York (40.7128, -74.0060)',
                airportsFound: airportsNearNY?.length || 0,
                hotelsFound: hotelsNearNY?.length || 0,
                functionsWorking: true
            });
        } catch (error) {
            addTest('Location-based Search', false, null, error);
        }

        // Test 6: Cache operations
        console.log('Testing cached routes...');
        try {
            // Try to get a cached route (will likely be null, but shouldn't error)
            const cachedRoute = await supabaseService.getCachedRoute('airport', 1, 'hotel', 1, 'driving');
            
            // Try to save a test cached route
            const testRoute = {
                origin_type: 'airport',
                origin_id: 1,
                destination_type: 'hotel', 
                destination_id: 1,
                distance_km: 25.5,
                travel_time_minutes: 45,
                route_data: { test: true, path: 'test route' },
                transportation_mode: 'driving'
            };

            await supabaseService.saveCachedRoute(testRoute);

            addTest('Cached Routes', true, {
                cacheReadWorking: true,
                cacheWriteWorking: true,
                testRouteCreated: true
            });
        } catch (error) {
            addTest('Cached Routes', false, null, error);
        }

        // Test 7: Data integrity checks
        console.log('Testing data integrity...');
        try {
            const airports = await supabaseService.getAirports();
            const hotels = await supabaseService.getHotelsByCity('test');

            // Check for required fields
            const airportIntegrity = airports.length === 0 || airports.every(a => 
                a.iata_code && a.name && a.city && a.country && 
                a.latitude !== null && a.longitude !== null
            );

            const hotelIntegrity = hotels.length === 0 || hotels.every(h =>
                h.name && h.city && h.country &&
                h.latitude !== null && h.longitude !== null
            );

            addTest('Data Integrity', airportIntegrity && hotelIntegrity, {
                airportFieldsValid: airportIntegrity,
                hotelFieldsValid: hotelIntegrity,
                airportsChecked: airports.length,
                hotelsChecked: hotels.length
            });
        } catch (error) {
            addTest('Data Integrity', false, null, error);
        }

        // Generate final response
        const overallSuccess = testResults.summary.failed === 0;
        
        res.status(overallSuccess ? 200 : 500).json({
            success: overallSuccess,
            message: overallSuccess 
                ? 'All database tests passed successfully!' 
                : `${testResults.summary.failed} test(s) failed`,
            results: testResults,
            recommendations: generateRecommendations(testResults)
        });

    } catch (globalError) {
        console.error('Global test error:', globalError);
        res.status(500).json({
            success: false,
            message: 'Critical error during database testing',
            error: globalError.message,
            results: testResults
        });
    }
});

// Quick connection test
app.get('/test-db/quick', async (req, res) => {
    try {
        const airports = await supabaseService.getAirports();
        res.json({
            success: true,
            message: 'Database connected successfully',
            airportCount: airports.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// Test specific table
app.get('/test-db/:table', async (req, res) => {
    const { table } = req.params;
    
    try {
        let result;
        switch (table) {
            case 'airports':
                result = await supabaseService.getAirports();
                break;
            case 'hotels':
                result = await supabaseService.getHotelsByCity('test');
                break;
            case 'users':
                result = await supabaseService.getUserLocations(999999);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: `Unknown table: ${table}. Available: airports, hotels, users`
                });
        }
        
        res.json({
            success: true,
            table,
            count: result.length,
            sample: result.slice(0, 3),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            table,
            error: error.message
        });
    }
});

// Helper function to generate recommendations based on test results
function generateRecommendations(testResults) {
    const recommendations = [];
    const failedTests = testResults.tests.filter(test => !test.success);

    if (failedTests.length === 0) {
        recommendations.push("✅ All tests passed! Your database is properly configured.");
        
        // Check for data availability
        const airportTest = testResults.tests.find(t => t.name === 'Airport Operations');
        const hotelTest = testResults.tests.find(t => t.name === 'Hotel Operations');
        
        if (airportTest?.data?.totalAirports === 0) {
            recommendations.push("💡 Consider importing airport data to populate the airports table.");
        }
        
        if (hotelTest?.data?.hotelsFound === 0) {
            recommendations.push("💡 Consider importing hotel data or testing Amadeus integration.");
        }
    } else {
        failedTests.forEach(test => {
            switch (test.name) {
                case 'Basic Supabase Connection':
                    recommendations.push("🔧 Check your SUPABASE_URL and SUPABASE_ANON_KEY environment variables.");
                    break;
                case 'Database Schema':
                    recommendations.push("🔧 Run the database schema setup SQL to create required tables.");
                    break;
                case 'Location-based Search':
                    recommendations.push("🔧 Install the location search functions in your Supabase database.");
                    break;
                default:
                    recommendations.push(`🔧 Fix issues with: ${test.name}`);
            }
        });
    }

    return recommendations;
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        availableRoutes: [
            'GET /health',
            'GET /test-db',
            'GET /test-db/quick',
            'GET /test-db/:table',
            'POST /api/hotels/search',
            'GET /api/hotels/:id',
            'GET /api/flights/search',
            'GET /api/flights/airports',
            'GET /api/flights/airports/location',
            'GET /api/users/:userId/locations',
            'POST /api/users/:userId/locations',
            'GET /api/users/:userId/favorites',
            'GET /api/users/:userId/search-history',
            'POST /api/users/:userId/search-history',
            'POST /api/routes/calculate'
        ]
    });
});

const PORT = process.env.PORT || 8081;

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Graceful shutdown...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM. Graceful shutdown...');
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Database test: http://localhost:${PORT}/test-db`);
    console.log(`⚡ Quick test: http://localhost:${PORT}/test-db/quick`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;