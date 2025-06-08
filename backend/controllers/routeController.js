const amadeusService = require('../services/amadeusService');
const cacheService = require('../services/cacheService');

/**
 * Calculate optimal route between airports and cities
 * POST /api/routes/calculate
 */
const calculateOptimalRoute = async (req, res) => {
    try {
        const {
            origin,
            destination,
            waypoints = [],
            departureDate,
            returnDate,
            travelMode = 'flight', // 'flight' or 'mixed'
            passengers = 1,
            preferences = {}
        } = req.body;

        // Validation
        if (!origin || !destination) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                required: ['origin', 'destination'],
                example: {
                    origin: { type: 'airport', code: 'LAX' },
                    destination: { type: 'airport', code: 'JFK' },
                    departureDate: '2025-07-01',
                    passengers: 2
                }
            });
        }

        if (!departureDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing departure date',
                required: 'departureDate (YYYY-MM-DD format)'
            });
        }

        try {
            const cacheKey = `route:${JSON.stringify({origin, destination, waypoints, departureDate, returnDate, travelMode, passengers})}`;
            
            const result = await cacheService.getRoute(
                { origin, destination, waypoints, departureDate, returnDate, travelMode, passengers },
                async () => {
                    let routeSegments = [];
                    let totalCost = 0;
                    let totalDuration = 0;

                    // Build route segments
                    const allPoints = [origin, ...waypoints, destination];
                    
                    for (let i = 0; i < allPoints.length - 1; i++) {
                        const from = allPoints[i];
                        const to = allPoints[i + 1];
                        
                        // Calculate segment based on travel mode
                        if (travelMode === 'flight' || 
                            (from.type === 'airport' && to.type === 'airport')) {
                            
                            // Flight segment
                            const segmentDate = i === 0 ? departureDate : 
                                new Date(new Date(departureDate).getTime() + i * 24 * 60 * 60 * 1000)
                                    .toISOString().split('T')[0];

                            const flightSearchParams = {
                                originLocationCode: from.code,
                                destinationLocationCode: to.code,
                                departureDate: segmentDate,
                                adults: passengers,
                                max: 5
                            };

                            const flightResult = await amadeusService.searchFlightOffers(flightSearchParams);
                            
                            if (flightResult.success && flightResult.data.length > 0) {
                                const bestFlight = flightResult.data[0];
                                const itinerary = bestFlight.itineraries[0];
                                
                                routeSegments.push({
                                    type: 'flight',
                                    from: {
                                        code: from.code,
                                        name: from.name || from.code,
                                        type: from.type
                                    },
                                    to: {
                                        code: to.code,
                                        name: to.name || to.code,
                                        type: to.type
                                    },
                                    flight: {
                                        id: bestFlight.id,
                                        duration: itinerary.duration,
                                        segments: itinerary.segments.map(segment => ({
                                            departure: {
                                                airport: segment.departure.iataCode,
                                                time: segment.departure.at,
                                                terminal: segment.departure.terminal
                                            },
                                            arrival: {
                                                airport: segment.arrival.iataCode,
                                                time: segment.arrival.at,
                                                terminal: segment.arrival.terminal
                                            },
                                            airline: segment.carrierCode,
                                            flightNumber: segment.number,
                                            duration: segment.duration
                                        })),
                                        price: {
                                            total: parseFloat(bestFlight.price.total),
                                            currency: bestFlight.price.currency
                                        }
                                    }
                                });

                                totalCost += parseFloat(bestFlight.price.total);
                                // Convert duration to minutes for calculation
                                const durationMatch = itinerary.duration.match(/PT(\d+H)?(\d+M)?/);
                                const hours = durationMatch[1] ? parseInt(durationMatch[1]) : 0;
                                const minutes = durationMatch[2] ? parseInt(durationMatch[2]) : 0;
                                totalDuration += hours * 60 + minutes;
                            } else {
                                // No flights found for this segment
                                routeSegments.push({
                                    type: 'unavailable',
                                    from: from,
                                    to: to,
                                    reason: 'No flights available for this route'
                                });
                            }
                        } else {
                            // Ground transportation estimate
                            const groundSegment = await calculateGroundTransport(from, to);
                            routeSegments.push(groundSegment);
                            totalCost += groundSegment.estimatedCost || 0;
                            totalDuration += groundSegment.estimatedDuration || 0;
                        }
                    }

                    // Add return journey if specified
                    if (returnDate && routeSegments.length > 0) {
                        const firstValidSegment = routeSegments.find(s => s.type === 'flight');
                        if (firstValidSegment) {
                            const returnSearchParams = {
                                originLocationCode: destination.code,
                                destinationLocationCode: origin.code,
                                departureDate: returnDate,
                                adults: passengers,
                                max: 5
                            };

                            const returnFlightResult = await amadeusService.searchFlightOffers(returnSearchParams);
                            
                            if (returnFlightResult.success && returnFlightResult.data.length > 0) {
                                const bestReturnFlight = returnFlightResult.data[0];
                                const returnItinerary = bestReturnFlight.itineraries[0];
                                
                                routeSegments.push({
                                    type: 'flight',
                                    isReturn: true,
                                    from: {
                                        code: destination.code,
                                        name: destination.name || destination.code,
                                        type: destination.type
                                    },
                                    to: {
                                        code: origin.code,
                                        name: origin.name || origin.code,
                                        type: origin.type
                                    },
                                    flight: {
                                        id: bestReturnFlight.id,
                                        duration: returnItinerary.duration,
                                        segments: returnItinerary.segments.map(segment => ({
                                            departure: {
                                                airport: segment.departure.iataCode,
                                                time: segment.departure.at,
                                                terminal: segment.departure.terminal
                                            },
                                            arrival: {
                                                airport: segment.arrival.iataCode,
                                                time: segment.arrival.at,
                                                terminal: segment.arrival.terminal
                                            },
                                            airline: segment.carrierCode,
                                            flightNumber: segment.number,
                                            duration: segment.duration
                                        })),
                                        price: {
                                            total: parseFloat(bestReturnFlight.price.total),
                                            currency: bestReturnFlight.price.currency
                                        }
                                    }
                                });

                                totalCost += parseFloat(bestReturnFlight.price.total);
                            }
                        }
                    }

                    return {
                        route: {
                            origin,
                            destination,
                            waypoints,
                            segments: routeSegments,
                            summary: {
                                totalCost,
                                totalDuration: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`,
                                currency: routeSegments.find(s => s.flight)?.flight?.price?.currency || 'USD',
                                validSegments: routeSegments.filter(s => s.type !== 'unavailable').length,
                                totalSegments: routeSegments.length
                            },
                            travelDates: {
                                departure: departureDate,
                                return: returnDate
                            },
                            passengers
                        }
                    };
                }
            );

            return res.json({
                success: true,
                data: result,
                meta: {
                    calculatedAt: new Date().toISOString(),
                    cached: true
                }
            });

        } catch (amadeusError) {
            console.error('Route calculation error:', amadeusError);
            return res.status(502).json({
                success: false,
                error: 'Route calculation service unavailable',
                message: amadeusError.message
            });
        }

    } catch (error) {
        console.error('Route calculation error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to calculate route',
            message: error.message
        });
    }
};

/**
 * Get direct route between two points
 * GET /api/routes/direct?originType=airport&originCode=LAX&destType=airport&destCode=JFK&date=2025-07-01
 */
const getDirectRoute = async (req, res) => {
    try {
        const {
            originType,
            originCode,
            destType,
            destCode,
            date,
            passengers = 1,
            mode = 'flight'
        } = req.query;

        if (!originCode || !destCode || !date) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                required: ['originCode', 'destCode', 'date'],
                example: '/api/routes/direct?originCode=LAX&destCode=JFK&date=2025-07-01'
            });
        }

        try {
            if (mode === 'flight' && originType === 'airport' && destType === 'airport') {
                // Direct flight search
                const flightSearchParams = {
                    originLocationCode: originCode.toUpperCase(),
                    destinationLocationCode: destCode.toUpperCase(),
                    departureDate: date,
                    adults: parseInt(passengers),
                    max: 10
                };

                const result = await amadeusService.searchFlightOffers(flightSearchParams);
                
                if (!result.success) {
                    return res.status(502).json({
                        success: false,
                        error: 'Flight search service unavailable',
                        message: result.error
                    });
                }

                const processedFlights = result.data.map(offer => ({
                    id: offer.id,
                    price: {
                        total: parseFloat(offer.price.total),
                        currency: offer.price.currency
                    },
                    itinerary: offer.itineraries[0],
                    airline: offer.itineraries[0].segments[0].carrierCode,
                    duration: offer.itineraries[0].duration,
                    stops: offer.itineraries[0].segments.length - 1,
                    segments: offer.itineraries[0].segments.map(segment => ({
                        departure: {
                            airport: segment.departure.iataCode,
                            time: segment.departure.at,
                            terminal: segment.departure.terminal
                        },
                        arrival: {
                            airport: segment.arrival.iataCode,
                            time: segment.arrival.at,
                            terminal: segment.arrival.terminal
                        },
                        airline: segment.carrierCode,
                        flightNumber: segment.number,
                        duration: segment.duration
                    }))
                }));

                return res.json({
                    success: true,
                    data: {
                        route: {
                            origin: { code: originCode.toUpperCase(), type: 'airport' },
                            destination: { code: destCode.toUpperCase(), type: 'airport' },
                            date,
                            passengers: parseInt(passengers)
                        },
                        flights: processedFlights,
                        summary: {
                            totalOptions: processedFlights.length,
                            priceRange: processedFlights.length > 0 ? {
                                min: Math.min(...processedFlights.map(f => f.price.total)),
                                max: Math.max(...processedFlights.map(f => f.price.total)),
                                currency: processedFlights[0].price.currency
                            } : null
                        }
                    }
                });

            } else {
                // Non-flight route
                return res.status(501).json({
                    success: false,
                    error: 'Non-flight routes not implemented',
                    message: 'Currently only supporting airport-to-airport flight routes',
                    supportedModes: ['flight (airport to airport)']
                });
            }

        } catch (amadeusError) {
            console.error('Direct route error:', amadeusError);
            return res.status(502).json({
                success: false,
                error: 'Route search service unavailable',
                message: amadeusError.message
            });
        }

    } catch (error) {
        console.error('Direct route error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get direct route',
            message: error.message
        });
    }
};

/**
 * Get cached route by ID
 * GET /api/routes/cached/:routeId
 */
const getCachedRoute = async (req, res) => {
    try {
        const { routeId } = req.params;

        if (!routeId) {
            return res.status(400).json({
                success: false,
                error: 'Missing route ID'
            });
        }

        // This would typically fetch from database
        // For now, return a placeholder response
        return res.status(501).json({
            success: false,
            error: 'Cached route retrieval not implemented',
            message: 'Integrate with database to store and retrieve saved routes',
            routeId
        });

    } catch (error) {
        console.error('Get cached route error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get cached route',
            message: error.message
        });
    }
};

/**
 * Save route to cache
 * POST /api/routes/cached
 */
const saveCachedRoute = async (req, res) => {
    try {
        const routeData = req.body;

        if (!routeData || !routeData.route) {
            return res.status(400).json({
                success: false,
                error: 'Missing route data',
                required: ['route']
            });
        }

        // This would typically save to database
        // For now, return a placeholder response
        return res.status(501).json({
            success: false,
            error: 'Route saving not implemented',
            message: 'Integrate with database to save routes for users',
            received: {
                hasRoute: !!routeData.route,
                routeType: routeData.route?.segments?.[0]?.type
            }
        });

    } catch (error) {
        console.error('Save cached route error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to save route',
            message: error.message
        });
    }
};

/**
 * Multi-destination route optimization
 * POST /api/routes/optimize
 */
const optimizeMultiDestinationRoute = async (req, res) => {
    try {
        const {
            startLocation,
            destinations = [],
            endLocation,
            departureDate,
            stayDuration = 2, // days per destination
            passengers = 1,
            budget
        } = req.body;

        if (!startLocation || destinations.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                required: ['startLocation', 'destinations (array)'],
                example: {
                    startLocation: { code: 'LAX', type: 'airport' },
                    destinations: [
                        { code: 'JFK', type: 'airport' },
                        { code: 'LHR', type: 'airport' }
                    ],
                    endLocation: { code: 'LAX', type: 'airport' },
                    departureDate: '2025-07-01',
                    stayDuration: 3,
                    passengers: 2
                }
            });
        }

        try {
            // Simple optimization: calculate all possible routes and pick the cheapest
            const allLocations = [startLocation, ...destinations];
            if (endLocation && endLocation.code !== startLocation.code) {
                allLocations.push(endLocation);
            }

            let bestRoute = null;
            let bestCost = Infinity;
            let routeOptions = [];

            // For simplicity, try destinations in the order provided
            // In production, implement TSP algorithm for true optimization
            const orderedDestinations = destinations;
            
            let totalCost = 0;
            let routeSegments = [];
            let currentDate = new Date(departureDate);

            for (let i = 0; i < allLocations.length - 1; i++) {
                const from = allLocations[i];
                const to = allLocations[i + 1];
                
                const segmentDate = currentDate.toISOString().split('T')[0];
                
                const flightSearchParams = {
                    originLocationCode: from.code,
                    destinationLocationCode: to.code,
                    departureDate: segmentDate,
                    adults: passengers,
                    max: 3
                };

                const flightResult = await amadeusService.searchFlightOffers(flightSearchParams);
                
                if (flightResult.success && flightResult.data.length > 0) {
                    const cheapestFlight = flightResult.data[0];
                    
                    routeSegments.push({
                        from,
                        to,
                        date: segmentDate,
                        flight: {
                            id: cheapestFlight.id,
                            price: parseFloat(cheapestFlight.price.total),
                            currency: cheapestFlight.price.currency,
                            duration: cheapestFlight.itineraries[0].duration,
                            segments: cheapestFlight.itineraries[0].segments.length
                        }
                    });

                    totalCost += parseFloat(cheapestFlight.price.total);
                    
                    // Add stay duration for next departure
                    if (i < allLocations.length - 2) {
                        currentDate.setDate(currentDate.getDate() + stayDuration);
                    }
                } else {
                    routeSegments.push({
                        from,
                        to,
                        date: segmentDate,
                        error: 'No flights available'
                    });
                }
            }

            const optimizedRoute = {
                itinerary: allLocations,
                segments: routeSegments,
                totalCost,
                currency: routeSegments[0]?.flight?.currency || 'USD',
                totalDuration: allLocations.length * stayDuration,
                departureDate,
                estimatedEndDate: currentDate.toISOString().split('T')[0],
                passengers,
                withinBudget: budget ? totalCost <= budget : true
            };

            return res.json({
                success: true,
                data: {
                    optimizedRoute,
                    summary: {
                        totalDestinations: destinations.length,
                        totalCost,
                        averageCostPerSegment: totalCost / routeSegments.length,
                        feasibleSegments: routeSegments.filter(s => !s.error).length,
                        totalSegments: routeSegments.length
                    }
                },
                meta: {
                    optimizedAt: new Date().toISOString(),
                    algorithm: 'simple_sequential',
                    note: 'Basic optimization - implement TSP algorithm for better route optimization'
                }
            });

        } catch (amadeusError) {
            console.error('Multi-destination optimization error:', amadeusError);
            return res.status(502).json({
                success: false,
                error: 'Route optimization service unavailable',
                message: amadeusError.message
            });
        }

    } catch (error) {
        console.error('Multi-destination optimization error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to optimize route',
            message: error.message
        });
    }
};

/**
 * Get travel time matrix between multiple points
 * POST /api/routes/matrix
 */
const getTravelTimeMatrix = async (req, res) => {
    try {
        const { origins, destinations, date, mode = 'flight' } = req.body;

        if (!origins || !destinations || !Array.isArray(origins) || !Array.isArray(destinations)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid origins or destinations',
                required: ['origins (array)', 'destinations (array)'],
                example: {
                    origins: [{ code: 'LAX', type: 'airport' }],
                    destinations: [{ code: 'JFK', type: 'airport' }, { code: 'LHR', type: 'airport' }],
                    date: '2025-07-01',
                    mode: 'flight'
                }
            });
        }

        try {
            const matrix = [];

            for (const origin of origins) {
                const row = [];
                
                for (const destination of destinations) {
                    if (origin.code === destination.code) {
                        row.push({
                            origin: origin.code,
                            destination: destination.code,
                            duration: '0h 0m',
                            distance: 0,
                            cost: 0,
                            available: true
                        });
                        continue;
                    }

                    if (mode === 'flight') {
                        try {
                            const flightSearchParams = {
                                originLocationCode: origin.code,
                                destinationLocationCode: destination.code,
                                departureDate: date,
                                adults: 1,
                                max: 1
                            };

                            const result = await amadeusService.searchFlightOffers(flightSearchParams);
                            
                            if (result.success && result.data.length > 0) {
                                const flight = result.data[0];
                                const itinerary = flight.itineraries[0];
                                
                                row.push({
                                    origin: origin.code,
                                    destination: destination.code,
                                    duration: itinerary.duration,
                                    cost: parseFloat(flight.price.total),
                                    currency: flight.price.currency,
                                    stops: itinerary.segments.length - 1,
                                    available: true
                                });
                            } else {
                                row.push({
                                    origin: origin.code,
                                    destination: destination.code,
                                    available: false,
                                    reason: 'No flights available'
                                });
                            }
                        } catch (error) {
                            row.push({
                                origin: origin.code,
                                destination: destination.code,
                                available: false,
                                reason: 'Search error'
                            });
                        }
                    } else {
                        row.push({
                            origin: origin.code,
                            destination: destination.code,
                            available: false,
                            reason: 'Only flight mode supported'
                        });
                    }
                }
                
                matrix.push(row);
            }

            return res.json({
                success: true,
                data: {
                    matrix,
                    origins: origins.map(o => o.code),
                    destinations: destinations.map(d => d.code),
                    date,
                    mode
                },
                meta: {
                    generatedAt: new Date().toISOString(),
                    totalCombinations: origins.length * destinations.length
                }
            });

        } catch (error) {
            console.error('Travel time matrix error:', error);
            return res.status(502).json({
                success: false,
                error: 'Travel time matrix service unavailable',
                message: error.message
            });
        }

    } catch (error) {
        console.error('Travel time matrix error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate travel time matrix',
            message: error.message
        });
    }
};

/**
 * Get route statistics
 * GET /api/routes/stats?originCode=LAX&destCode=JFK
 */
const getRouteStatistics = async (req, res) => {
    try {
        const { originCode, destCode, timeframe = '30d' } = req.query;

        if (!originCode || !destCode) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                required: ['originCode', 'destCode'],
                example: '/api/routes/stats?originCode=LAX&destCode=JFK&timeframe=30d'
            });
        }

        // This would typically analyze historical data from your database
        // For now, return sample statistics
        const sampleStats = {
            route: {
                origin: originCode.toUpperCase(),
                destination: destCode.toUpperCase()
            },
            statistics: {
                averagePrice: 450.00,
                priceRange: { min: 320.00, max: 780.00 },
                averageDuration: '5h 30m',
                popularAirlines: ['AA', 'UA', 'DL'],
                averageStops: 0.3,
                bookingTrend: 'increasing',
                bestDaysToBuy: ['Tuesday', 'Wednesday'],
                peakSeason: 'June-August'
            },
            currency: 'USD',
            timeframe,
            sampleSize: 0, // No real data yet
            note: 'Sample data - integrate with analytics database for real statistics'
        };

        return res.json({
            success: true,
            data: sampleStats,
            meta: {
                generatedAt: new Date().toISOString(),
                dataSource: 'sample'
            }
        });

    } catch (error) {
        console.error('Route statistics error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get route statistics',
            message: error.message
        });
    }
};

/**
 * Get popular routes
 * GET /api/routes/popular?limit=10&timeframe=30d
 */
const getPopularRoutes = async (req, res) => {
    try {
        const { limit = 10, timeframe = '30d' } = req.query;

        // This would typically query your analytics database
        // For now, return sample popular routes
        const samplePopularRoutes = [
            {
                route: { origin: 'LAX', destination: 'JFK' },
                searchCount: 1250,
                averagePrice: 450.00,
                priceChange: '+5.2%'
            },
            {
                route: { origin: 'SFO', destination: 'LHR' },
                searchCount: 980,
                averagePrice: 720.00,
                priceChange: '-2.1%'
            }
        ].slice(0, parseInt(limit));

        return res.json({
            success: true,
            data: {
                routes: samplePopularRoutes,
                timeframe,
                totalRoutes: samplePopularRoutes.length,
                note: 'Sample data - integrate with analytics database for real popular routes'
            },
            meta: {
                generatedAt: new Date().toISOString(),
                dataSource: 'sample'
            }
        });

    } catch (error) {
        console.error('Popular routes error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get popular routes',
            message: error.message
        });
    }
};

/**
 * Get driving route (placeholder - not using Google Maps)
 * GET /api/routes/driving?origin=LAX&destination=SFO
 */
const getDrivingRoute = async (req, res) => {
    try {
        return res.status(501).json({
            success: false,
            error: 'Driving routes not implemented',
            message: 'This travel app focuses on flight routes via Amadeus APIs',
            alternative: 'Use flight routes between airports for long-distance travel'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Service error',
            message: error.message
        });
    }
};

/**
 * Get transit route (placeholder - not using Google Maps)
 * GET /api/routes/transit?origin=LAX&destination=SFO
 */
const getTransitRoute = async (req, res) => {
    try {
        return res.status(501).json({
            success: false,
            error: 'Transit routes not implemented',
            message: 'This travel app focuses on flight routes via Amadeus APIs',
            alternative: 'Use flight routes between airports for long-distance travel'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Service error',
            message: error.message
        });
    }
};

/**
 * Get walking route (placeholder - not using Google Maps)
 * GET /api/routes/walking?origin=LAX&destination=SFO
 */
const getWalkingRoute = async (req, res) => {
    try {
        return res.status(501).json({
            success: false,
            error: 'Walking routes not implemented',
            message: 'This travel app focuses on flight routes via Amadeus APIs',
            alternative: 'Use flight routes between airports for long-distance travel'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Service error',
            message: error.message
        });
    }
};

/**
 * Helper function to calculate ground transport estimates
 */
const calculateGroundTransport = async (from, to) => {
    // Simple estimation for ground transport
    // In production, integrate with ground transport APIs or use distance calculations
    
    return {
        type: 'ground_transport',
        from,
        to,
        mode: 'estimated',
        estimatedDuration: 120, // 2 hours default
        estimatedCost: 50, // $50 default
        currency: 'USD',
        note: 'Estimated ground transport - integrate with transport APIs for accurate data'
    };
};

module.exports = {
    calculateOptimalRoute,
    getDirectRoute,
    getCachedRoute,
    saveCachedRoute,
    optimizeMultiDestinationRoute,
    getTravelTimeMatrix,
    getRouteStatistics,
    getPopularRoutes,
    getDrivingRoute,
    getTransitRoute,
    getWalkingRoute
};