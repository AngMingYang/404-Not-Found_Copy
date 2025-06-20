// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const app = express();

// Basic middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: require('./package.json').version
    });
});

// Basic test endpoint
app.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Travel App Backend is running!',
        timestamp: new Date().toISOString(),
        environment: {
            node_version: process.version,
            platform: process.platform,
            arch: process.arch
        }
    });
});

// Placeholder API routes
app.get('/api', (req, res) => {
    res.json({
        message: 'Travel App API',
        version: '1.0.0',
        endpoints: {
            health: 'GET /health',
            test: 'GET /test',
            hotels: 'GET /api/hotels (coming soon)',
            flights: 'GET /api/flights (coming soon)',
            users: 'GET /api/users (coming soon)',
            routes: 'GET /api/routes (coming soon)'
        }
    });
});

// Placeholder route handlers
app.get('/api/hotels', (req, res) => {
    res.status(501).json({ 
        error: 'Hotel routes not implemented yet',
        message: 'This endpoint is coming soon!'
    });
});

app.get('/api/flights', (req, res) => {
    res.status(501).json({ 
        error: 'Flight routes not implemented yet',
        message: 'This endpoint is coming soon!'
    });
});

app.get('/api/users', (req, res) => {
    res.status(501).json({ 
        error: 'User routes not implemented yet',
        message: 'This endpoint is coming soon!'
    });
});

app.get('/api/routes', (req, res) => {
    res.status(501).json({ 
        error: 'Route calculation not implemented yet',
        message: 'This endpoint is coming soon!'
    });
});

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
            'GET /test',
            'GET /api',
            'GET /api/hotels',
            'GET /api/flights',
            'GET /api/users',
            'GET /api/routes'
        ]
    });
});

const PORT = process.env.PORT || 3001;

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
    console.log('🚀 Travel App Backend Starting...');
    console.log('================================');
    console.log(`📊 Server: http://localhost:${PORT}`);
    console.log(`📋 Health: http://localhost:${PORT}/health`);
    console.log(`🧪 Test: http://localhost:${PORT}/test`);
    console.log(`🔧 API: http://localhost:${PORT}/api`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📦 Version: ${require('./package.json').version}`);
    console.log('================================');
    console.log('✅ Server is ready!');
});

module.exports = app;