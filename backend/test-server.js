// Simple test server to isolate the routing issue
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test the issue step by step
console.log('🔍 Testing route mounting...');

// Test 1: Simple routes first
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Test server is running' });
});

// Test 2: Create simple routers
const testRouter = express.Router();
testRouter.get('/test', (req, res) => {
    res.json({ message: 'Router test successful' });
});

// Test 3: Mount the test router
try {
    app.use('/api', testRouter);
    console.log('✅ Basic router mounted successfully');
} catch (error) {
    console.error('❌ Basic router failed:', error.message);
}

// Test 4: Try to load actual route files one by one
const routes = [
    { name: 'flights', path: './routes/flights' },
    { name: 'hotels', path: './routes/hotels' },
    { name: 'users', path: './routes/users' },
    { name: 'routes', path: './routes/routes' }
];

for (const route of routes) {
    try {
        console.log(`🔍 Testing ${route.name} routes...`);
        const routeModule = require(route.path);
        app.use(`/api/${route.name}`, routeModule);
        console.log(`✅ ${route.name} routes loaded successfully`);
    } catch (error) {
        console.error(`❌ ${route.name} routes failed:`, error.message);
        
        // Create a fallback router
        const fallbackRouter = express.Router();
        fallbackRouter.get('/', (req, res) => {
            res.status(501).json({ 
                error: `${route.name} routes not available`,
                message: error.message 
            });
        });
        
        try {
            app.use(`/api/${route.name}`, fallbackRouter);
            console.log(`⚠️  ${route.name} fallback router created`);
        } catch (fallbackError) {
            console.error(`❌ ${route.name} fallback failed:`, fallbackError.message);
        }
    }
}

// Error handling
app.use((error, req, res, next) => {
    console.error('Express error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Start server
app.listen(PORT, () => {
    console.log('\n🚀 Test Server Status:');
    console.log('====================================');
    console.log(`📊 Server: http://localhost:${PORT}`);
    console.log(`📋 Health: http://localhost:${PORT}/health`);
    console.log(`🧪 Test: http://localhost:${PORT}/api/test`);
    console.log('====================================');
    console.log('\n✅ Test server started successfully!');
}).on('error', (error) => {
    console.error('❌ Server failed to start:', error.message);
    if (error.code === 'EADDRINUSE') {
        console.log(`💡 Port ${PORT} is already in use. Try a different port.`);
    }
});