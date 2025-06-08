// Load environment variables
require('dotenv').config();

const supabaseService = require('./supabaseService');

// Mock Google Maps API calls - replace with actual Google Maps integration
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

const estimateTravelTime = (distanceKm, mode = 'driving') => {
    const speeds = {
        driving: 60,    // km/h average with traffic
        walking: 5,     // km/h
        transit: 30,    // km/h average including stops
        flying: 800     // km/h commercial flight
    };
    
    const speed = speeds[mode] || speeds.driving;
    return Math.round((distanceKm / speed) * 60); // minutes
};

const getLocationCoordinates = async (location) => {
    if (location.coordinates) {
        return {
            latitude: location.coordinates.lat,
            longitude: location.coordinates.lng
        };
    }
    
    try {
        if (location.type === 'airport' && location.id) {
            const airport = await supabaseService.getAirportByCode(location.id.toString(), 'iata');
            if (airport) {
                return {
                    latitude: parseFloat(airport.latitude),
                    longitude: parseFloat(airport.longitude)
                };
            }
        } else if (location.type === 'hotel' && location.id) {
            const hotel = await supabaseService.getHotelById(location.id);
            if (hotel) {
                return {
                    latitude: parseFloat(hotel.latitude),
                    longitude: parseFloat(hotel.longitude)
                };
            }
        }
    } catch (error) {
        console.error('Error getting location coordinates:', error);
    }
    
    throw new Error(`Could not determine coordinates for location: ${JSON.stringify(location)}`);
};

const calculateRoute = async ({ destinations, preferences = {}, startLocation }) => {
    try {
        const mode = preferences.mode || 'driving';
        const optimize = preferences.optimize || 'time'; // 'time' or 'distance'
        
        // Get coordinates for all locations
        const allLocations = startLocation ? [startLocation, ...destinations] : destinations;
        const coordinates = await Promise.all(
            allLocations.map(async (location) => ({
                ...location,
                coords: await getLocationCoordinates(location)
            }))
        );
        
        // Simple nearest neighbor algorithm for route optimization
        let route = [];
        let unvisited = [...coordinates];
        let current = unvisited.shift(); // Start with first location
        route.push(current);
        
        while (unvisited.length > 0) {
            let nearest = null;
            let minValue = Infinity;
            let nearestIndex = -1;
            
            for (let i = 0; i < unvisited.length; i++) {
                const candidate = unvisited[i];
                const distance = calculateDistance(
                    current.coords.latitude, current.coords.longitude,
                    candidate.coords.latitude, candidate.coords.longitude
                );
                const time = estimateTravelTime(distance, mode);
                const value = optimize === 'distance' ? distance : time;
                
                if (value < minValue) {
                    minValue = value;
                    nearest = candidate;
                    nearestIndex = i;
                }
            }
            
            if (nearest) {
                route.push(nearest);
                current = nearest;
                unvisited.splice(nearestIndex, 1);
            }
        }
        
        // Calculate route segments
        const segments = [];
        let totalDistance = 0;
        let totalTime = 0;
        
        for (let i = 0; i < route.length - 1; i++) {
            const from = route[i];
            const to = route[i + 1];
            const distance = calculateDistance(
                from.coords.latitude, from.coords.longitude,
                to.coords.latitude, to.coords.longitude
            );
            const time = estimateTravelTime(distance, mode);
            
            segments.push({
                from: {
                    type: from.type,
                    id: from.id,
                    coordinates: from.coords
                },
                to: {
                    type: to.type,
                    id: to.id,
                    coordinates: to.coords
                },
                distance_km: Math.round(distance * 10) / 10,
                travel_time_minutes: time,
                mode: mode
            });
            
            totalDistance += distance;
            totalTime += time;
        }
        
        return {
            success: true,
            route: route.map(loc => ({
                type: loc.type,
                id: loc.id,
                coordinates: loc.coords
            })),
            segments: segments,
            summary: {
                total_distance_km: Math.round(totalDistance * 10) / 10,
                total_time_minutes: totalTime,
                transportation_mode: mode,
                optimization_method: optimize
            },
            metadata: {
                calculated_at: new Date().toISOString(),
                algorithm: 'nearest_neighbor'
            }
        };
        
    } catch (error) {
        console.error('Route calculation error:', error);
        throw error;
    }
};

const calculateDirectRoute = async ({ origin, destination, mode = 'driving' }) => {
    try {
        const originCoords = await getLocationCoordinates(origin);
        const destCoords = await getLocationCoordinates(destination);
        
        const distance = calculateDistance(
            originCoords.latitude, originCoords.longitude,
            destCoords.latitude, destCoords.longitude
        );
        const travelTime = estimateTravelTime(distance, mode);
        
        return {
            origin: {
                type: origin.type,
                id: origin.id,
                coordinates: originCoords
            },
            destination: {
                type: destination.type,
                id: destination.id,
                coordinates: destCoords
            },
            distance_km: Math.round(distance * 10) / 10,
            travel_time_minutes: travelTime,
            transportation_mode: mode,
            details: {
                calculated_at: new Date().toISOString(),
                straight_line_distance: true // In production, use actual routing
            }
        };
        
    } catch (error) {
        console.error('Direct route calculation error:', error);
        throw error;
    }
};

const optimizeRoute = async ({ waypoints, startPoint, endPoint, preferences = {} }) => {
    try {
        const destinations = [...waypoints];
        if (endPoint) destinations.push(endPoint);
        
        return await calculateRoute({
            destinations,
            preferences,
            startLocation: startPoint
        });
        
    } catch (error) {
        console.error('Route optimization error:', error);
        throw error;
    }
};

const getTravelTimeMatrix = async ({ origins, destinations, mode = 'driving' }) => {
    try {
        const originCoords = await Promise.all(
            origins.map(async (origin) => ({
                ...origin,
                coords: await getLocationCoordinates(origin)
            }))
        );
        
        const destCoords = await Promise.all(
            destinations.map(async (dest) => ({
                ...dest,
                coords: await getLocationCoordinates(dest)
            }))
        );
        
        const matrix = [];
        
        for (let i = 0; i < originCoords.length; i++) {
            const row = [];
            for (let j = 0; j < destCoords.length; j++) {
                const distance = calculateDistance(
                    originCoords[i].coords.latitude, originCoords[i].coords.longitude,
                    destCoords[j].coords.latitude, destCoords[j].coords.longitude
                );
                const time = estimateTravelTime(distance, mode);
                
                row.push({
                    distance_km: Math.round(distance * 10) / 10,
                    travel_time_minutes: time,
                    mode: mode
                });
            }
            matrix.push(row);
        }
        
        return {
            origins: originCoords.map(o => ({ type: o.type, id: o.id })),
            destinations: destCoords.map(d => ({ type: d.type, id: d.id })),
            matrix: matrix,
            transportation_mode: mode,
            calculated_at: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Travel time matrix error:', error);
        throw error;
    }
};

const getRouteStatistics = async ({ origin, destination }) => {
    try {
        // This would typically analyze historical route data
        // For now, return mock statistics
        return {
            route: `${origin.type}:${origin.id} -> ${destination.type}:${destination.id}`,
            statistics: {
                average_distance_km: 45.2,
                average_travel_time_minutes: 52,
                most_common_mode: 'driving',
                peak_traffic_multiplier: 1.4,
                off_peak_travel_time: 38,
                popularity_score: 7.8
            },
            historical_data: {
                searches_last_30_days: 42,
                bookings_last_30_days: 8
            },
            calculated_at: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Route statistics error:', error);
        throw error;
    }
};

const getPopularRoutes = async ({ limit = 10, timeframe = '30days' }) => {
    try {
        // This would typically query actual usage data
        // For now, return mock popular routes
        const mockRoutes = [
            { origin: 'LAX', destination: 'Beverly Hills Hotel', count: 156 },
            { origin: 'JFK', destination: 'Times Square', count: 134 },
            { origin: 'LHR', destination: 'Central London', count: 112 },
            { origin: 'DXB', destination: 'Dubai Marina', count: 98 },
            { origin: 'SIN', destination: 'Marina Bay Sands', count: 87 }
        ];
        
        return {
            timeframe: timeframe,
            routes: mockRoutes.slice(0, limit),
            generated_at: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Popular routes error:', error);
        throw error;
    }
};

// Individual transportation mode functions
const getDrivingDirections = async ({ origin, destination }) => {
    const distance = calculateDistance(
        origin.latitude, origin.longitude,
        destination.latitude, destination.longitude
    );
    
    return {
        mode: 'driving',
        distance_km: Math.round(distance * 10) / 10,
        duration_minutes: estimateTravelTime(distance, 'driving'),
        route_summary: 'Fastest route via main roads',
        steps: [
            { instruction: 'Head towards destination', distance_km: distance }
        ]
    };
};

const getPublicTransitRoute = async ({ origin, destination }) => {
    const distance = calculateDistance(
        origin.latitude, origin.longitude,
        destination.latitude, destination.longitude
    );
    
    return {
        mode: 'transit',
        distance_km: Math.round(distance * 10) / 10,
        duration_minutes: estimateTravelTime(distance, 'transit'),
        route_summary: 'Best public transit route',
        steps: [
            { instruction: 'Take public transit to destination', distance_km: distance }
        ]
    };
};

const getWalkingDirections = async ({ origin, destination }) => {
    const distance = calculateDistance(
        origin.latitude, origin.longitude,
        destination.latitude, destination.longitude
    );
    
    return {
        mode: 'walking',
        distance_km: Math.round(distance * 10) / 10,
        duration_minutes: estimateTravelTime(distance, 'walking'),
        route_summary: 'Walking route',
        steps: [
            { instruction: 'Walk to destination', distance_km: distance }
        ]
    };
};

module.exports = {
    calculateRoute,
    calculateDirectRoute,
    optimizeRoute,
    getTravelTimeMatrix,
    getRouteStatistics,
    getPopularRoutes,
    getDrivingDirections,
    getPublicTransitRoute,
    getWalkingDirections
};