const routeCalculatorService = require('../services/routeCalculatorService');
const supabaseService = require('../services/supabaseService');

const calculateOptimalRoute = async (req, res) => {
    try {
        const { destinations, preferences, startLocation } = req.body;
        
        if (!destinations || !Array.isArray(destinations) || destinations.length < 2) {
            return res.status(400).json({ 
                error: 'At least 2 destinations are required',
                example: {
                    destinations: [
                        { type: 'airport', id: 1 },
                        { type: 'hotel', id: 5 },
                        { type: 'custom', coordinates: { lat: 40.7128, lng: -74.0060 } }
                    ],
                    preferences: { mode: 'driving', optimize: 'time' },
                    startLocation: { type: 'airport', id: 1 }
                }
            });
        }

        const optimalRoute = await routeCalculatorService.calculateRoute({
            destinations,
            preferences: preferences || {},
            startLocation
        });

        res.json({
            success: true,
            data: optimalRoute
        });
        } catch (error) {
            console.error('Route calculation error:', error);
            res.status(500).json({ error: 'Failed to calculate route' });
        }
    };
    
    module.exports = {
        calculateOptimalRoute
    };