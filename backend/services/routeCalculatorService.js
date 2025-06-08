// Route calculation service using Amadeus APIs
// No Google Maps dependency - pure flight-based routing

const amadeusService = require('./amadeusService');

/**
 * Calculate the most efficient route between multiple destinations
 * Uses flight connections and travel times from Amadeus
 */
class RouteCalculator {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Calculate optimal route through multiple destinations
     * @param {Array} destinations - Array of airport codes
     * @param {Object} options - Route calculation options
     */
    async calculateOptimalRoute(destinations, options = {}) {
        const {
            startDate = new Date().toISOString().split('T')[0],
            stayDuration = 2, // days per destination
            passengers = 1,
            budget = null,
            preferences = {}
        } = options;

        if (destinations.length < 2) {
            throw new Error('At least 2 destinations required for route calculation');
        }

        try {
            // For small numbers of destinations, try all permutations
            if (destinations.length <= 4) {
                return await this.calculateAllPermutations(destinations, options);
            } else {
                // For larger numbers, use nearest neighbor heuristic
                return await this.calculateNearestNeighbor(destinations, options);
            }
        } catch (error) {
            throw new Error(`Route calculation failed: ${error.message}`);
        }
    }

    /**
     * Calculate all possible route permutations (for small destination sets)
     */
    async calculateAllPermutations(destinations, options) {
        const permutations = this.getPermutations(destinations.slice(1), destinations[0]);
        let bestRoute = null;
        let bestScore = Infinity;

        for (const perm of permutations.slice(0, 10)) { // Limit to first 10 permutations
            try {
                const route = await this.calculateRouteSegments(perm, options);
                const score = this.calculateRouteScore(route, options);
                
                if (score < bestScore) {
                    bestScore = score;
                    bestRoute = route;
                }
            } catch (error) {
                console.warn(`Failed to calculate route for permutation:`, error.message);
            }
        }

        if (!bestRoute) {
            throw new Error('No valid routes found');
        }

        return {
            route: bestRoute,
            score: bestScore,
            algorithm: 'exhaustive_permutation',
            alternatives: Math.min(permutations.length, 10)
        };
    }

    /**
     * Calculate route using nearest neighbor heuristic
     */
    async calculateNearestNeighbor(destinations, options) {
        const unvisited = [...destinations.slice(1)];
        const route = [destinations[0]];
        let totalCost = 0;
        let currentDate = new Date(options.startDate || Date.now());

        while (unvisited.length > 0) {
            const currentDestination = route[route.length - 1];
            let nearestDestination = null;
            let nearestCost = Infinity;
            let nearestIndex = -1;

            // Find nearest unvisited destination
            for (let i = 0; i < unvisited.length; i++) {
                const destination = unvisited[i];
                try {
                    const flightCost = await this.getFlightCost(
                        currentDestination,
                        destination,
                        currentDate.toISOString().split('T')[0],
                        options.passengers || 1
                    );

                    if (flightCost < nearestCost) {
                        nearestCost = flightCost;
                        nearestDestination = destination;
                        nearestIndex = i;
                    }
                } catch (error) {
                    console.warn(`Failed to get flight cost from ${currentDestination} to ${destination}`);
                }
            }

            if (nearestDestination) {
                route.push(nearestDestination);
                unvisited.splice(nearestIndex, 1);
                totalCost += nearestCost;
                currentDate.setDate(currentDate.getDate() + (options.stayDuration || 2));
            } else {
                break; // No more reachable destinations
            }
        }

        const routeSegments = await this.calculateRouteSegments(route, options);
        
        return {
            route: routeSegments,
            score: totalCost,
            algorithm: 'nearest_neighbor',
            unvisitedDestinations: unvisited
        };
    }

    /**
     * Calculate detailed route segments with flight information
     */
    async calculateRouteSegments(destinations, options) {
        const segments = [];
        let currentDate = new Date(options.startDate || Date.now());
        let totalCost = 0;

        for (let i = 0; i < destinations.length - 1; i++) {
            const from = destinations[i];
            const to = destinations[i + 1];
            const departureDate = currentDate.toISOString().split('T')[0];

            try {
                const flightData = await this.getFlightDetails(from, to, departureDate, options.passengers || 1);
                
                if (flightData) {
                    segments.push({
                        from: { code: from, type: 'airport' },
                        to: { code: to, type: 'airport' },
                        date: departureDate,
                        flight: flightData,
                        stayDuration: i < destinations.length - 2 ? options.stayDuration || 2 : 0
                    });

                    totalCost += flightData.price;
                    
                    // Add stay duration for next flight
                    if (i < destinations.length - 2) {
                        currentDate.setDate(currentDate.getDate() + (options.stayDuration || 2));
                    }
                } else {
                    segments.push({
                        from: { code: from, type: 'airport' },
                        to: { code: to, type: 'airport' },
                        date: departureDate,
                        error: 'No flights available',
                        stayDuration: 0
                    });
                }
            } catch (error) {
                segments.push({
                    from: { code: from, type: 'airport' },
                    to: { code: to, type: 'airport' },
                    date: departureDate,
                    error: error.message,
                    stayDuration: 0
                });
            }
        }

        return {
            destinations,
            segments,
            totalCost,
            totalDuration: destinations.length * (options.stayDuration || 2),
            currency: segments.find(s => s.flight)?.flight?.currency || 'USD',
            startDate: options.startDate,
            endDate: currentDate.toISOString().split('T')[0]
        };
    }

    /**
     * Get flight cost between two airports
     */
    async getFlightCost(origin, destination, date, passengers = 1) {
        const cacheKey = `${origin}-${destination}-${date}-${passengers}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.cost;
            }
        }

        try {
            const result = await amadeusService.searchFlightOffers({
                originLocationCode: origin,
                destinationLocationCode: destination,
                departureDate: date,
                adults: passengers,
                max: 1
            });

            if (result.success && result.data.length > 0) {
                const cost = parseFloat(result.data[0].price.total);
                
                this.cache.set(cacheKey, {
                    cost,
                    timestamp: Date.now()
                });
                
                return cost;
            } else {
                throw new Error('No flights found');
            }
        } catch (error) {
            throw new Error(`Flight search failed: ${error.message}`);
        }
    }

    /**
     * Get detailed flight information
     */
    async getFlightDetails(origin, destination, date, passengers = 1) {
        try {
            const result = await amadeusService.searchFlightOffers({
                originLocationCode: origin,
                destinationLocationCode: destination,
                departureDate: date,
                adults: passengers,
                max: 1
            });

            if (result.success && result.data.length > 0) {
                const flight = result.data[0];
                const itinerary = flight.itineraries[0];
                
                return {
                    id: flight.id,
                    price: parseFloat(flight.price.total),
                    currency: flight.price.currency,
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
                    stops: itinerary.segments.length - 1
                };
            }
            
            return null;
        } catch (error) {
            throw new Error(`Flight details search failed: ${error.message}`);
        }
    }

    /**
     * Calculate route score (lower is better)
     */
    calculateRouteScore(route, options) {
        let score = route.totalCost;
        
        // Add penalties for various factors
        const errorSegments = route.segments.filter(s => s.error).length;
        score += errorSegments * 1000; // Heavy penalty for unavailable segments
        
        // Budget penalty
        if (options.budget && route.totalCost > options.budget) {
            score += (route.totalCost - options.budget) * 2;
        }
        
        // Duration penalty for very long trips
        if (route.totalDuration > 30) {
            score += (route.totalDuration - 30) * 10;
        }
        
        return score;
    }

    /**
     * Generate all permutations of destinations
     */
    getPermutations(arr, start) {
        if (arr.length <= 1) return [[start, ...arr]];
        
        const permutations = [];
        for (let i = 0; i < arr.length; i++) {
            const current = arr[i];
            const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
            const remainingPerms = this.getPermutations(remaining, start);
            
            for (const perm of remainingPerms) {
                const index = perm.indexOf(start);
                perm.splice(index + 1, 0, current);
                permutations.push([...perm]);
            }
        }
        
        return permutations;
    }

    /**
     * Calculate travel time matrix between airports
     */
    async calculateTravelTimeMatrix(airports, date = new Date().toISOString().split('T')[0]) {
        const matrix = [];
        
        for (const origin of airports) {
            const row = [];
            
            for (const destination of airports) {
                if (origin === destination) {
                    row.push({
                        origin,
                        destination,
                        duration: '0h 0m',
                        cost: 0,
                        available: true
                    });
                } else {
                    try {
                        const flightDetails = await this.getFlightDetails(origin, destination, date, 1);
                        
                        if (flightDetails) {
                            row.push({
                                origin,
                                destination,
                                duration: flightDetails.duration,
                                cost: flightDetails.price,
                                currency: flightDetails.currency,
                                stops: flightDetails.stops,
                                available: true
                            });
                        } else {
                            row.push({
                                origin,
                                destination,
                                available: false,
                                reason: 'No flights available'
                            });
                        }
                    } catch (error) {
                        row.push({
                            origin,
                            destination,
                            available: false,
                            reason: 'Search error'
                        });
                    }
                }
            }
            
            matrix.push(row);
        }
        
        return {
            matrix,
            airports,
            date,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Find shortest path between two airports (with possible connections)
     */
    async findShortestPath(origin, destination, maxConnections = 2) {
        try {
            // Direct flight first
            const directFlight = await this.getFlightDetails(origin, destination, new Date().toISOString().split('T')[0], 1);
            
            if (directFlight) {
                return {
                    path: [origin, destination],
                    totalCost: directFlight.price,
                    totalDuration: directFlight.duration,
                    connections: 0,
                    segments: [directFlight]
                };
            }

            // If no direct flight and connections allowed, implement connection search
            if (maxConnections > 0) {
                // This would require a more complex algorithm to find connecting flights
                // For now, return indication that connection search is needed
                return {
                    path: [origin, destination],
                    totalCost: null,
                    totalDuration: null,
                    connections: 'unknown',
                    note: 'Connection search not implemented - consider implementing flight connection finder'
                };
            }

            throw new Error('No direct flights available');
            
        } catch (error) {
            throw new Error(`Path finding failed: ${error.message}`);
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;

        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp < this.cacheTimeout) {
                validEntries++;
            } else {
                expiredEntries++;
            }
        }

        return {
            totalEntries: this.cache.size,
            validEntries,
            expiredEntries,
            cacheTimeout: this.cacheTimeout
        };
    }
}

// Create singleton instance
const routeCalculator = new RouteCalculator();

module.exports = {
    routeCalculator,
    RouteCalculator
};