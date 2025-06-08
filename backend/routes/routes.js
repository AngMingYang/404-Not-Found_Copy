const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');

// Route calculation and optimization

// Calculate optimal route
// POST /api/routes/calculate
router.post('/calculate', routeController.calculateOptimalRoute);

// Get route between two points
// GET /api/routes/direct?originType=airport&originId=1&destType=hotel&destId=5&mode=driving
router.get('/direct', routeController.getDirectRoute);

// Get cached route
// GET /api/routes/cached/:routeId
router.get('/cached/:routeId', routeController.getCachedRoute);

// Save/update cached route
// POST /api/routes/cached
router.post('/cached', routeController.saveCachedRoute);

// Multi-destination route optimization
// POST /api/routes/optimize
router.post('/optimize', routeController.optimizeMultiDestinationRoute);

// Get travel time matrix
// POST /api/routes/matrix
router.post('/matrix', routeController.getTravelTimeMatrix);

// Route analysis and statistics

// Get route statistics
// GET /api/routes/stats?originType=airport&originId=1&destType=hotel&destId=5
router.get('/stats', routeController.getRouteStatistics);

// Get popular routes
// GET /api/routes/popular?limit=10&timeframe=30days
router.get('/popular', routeController.getPopularRoutes);

// Transportation mode specific routes

// Get driving directions
// GET /api/routes/driving?origin=40.7128,-74.0060&destination=40.7589,-73.9851
router.get('/driving', routeController.getDrivingRoute);

// Get public transit route
// GET /api/routes/transit?origin=40.7128,-74.0060&destination=40.7589,-73.9851
router.get('/transit', routeController.getTransitRoute);

// Get walking route
// GET /api/routes/walking?origin=40.7128,-74.0060&destination=40.7589,-73.9851
router.get('/walking', routeController.getWalkingRoute);

module.exports = router;