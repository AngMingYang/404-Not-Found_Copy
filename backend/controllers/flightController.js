const amadeusService = require('../services/amadeusService');
const cacheService = require('../services/cacheService');
const { body, query, validationResult } = require('express-validator');

/**
 * Search flights
 * GET /api/flights/search?origin=LAX&destination=JFK&departureDate=2025-07-01&returnDate=2025-07-08&passengers=2
 * POST /api/flights/search
 */
const searchFlights = async (req, res) => {
    try {
        // Handle both GET and POST requests
        const searchParams = req.method === 'GET' ? req.query : req.body;
        
        const {
            origin,
            destination,
            departureDate,
            returnDate,
            adults = 1,
            children = 0,
            infants = 0,
            travelClass = 'ECONOMY',
            nonStop = false,
            maxPrice,
            currency = 'USD',
            airlines, // Include specific airlines
            excludeAirlines, // Exclude specific airlines
            maxResults = 50
        } = searchParams;

        // Validation
        if (!origin || !destination || !departureDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                required: ['origin', 'destination', 'departureDate'],
                received: { origin, destination, departureDate }
            });
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(departureDate)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD',
                departureDate
            });
        }

        if (returnDate && !dateRegex.test(returnDate)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid return date format. Use YYYY-MM-DD',
                returnDate
            });
        }

        // Create cache key
        const cacheKey = `flights:${origin}:${destination}:${departureDate}:${returnDate || 'oneway'}:${adults}:${children}:${infants}:${travelClass}`;

        try {
            // Check cache first
            const cachedResult = await cacheService.getFlights(
                origin,
                destination,
                departureDate,
                async () => {
                    // Prepare search parameters for Amadeus
                    const amadeusParams = {
                        originLocationCode: origin.toUpperCase(),
                        destinationLocationCode: destination.toUpperCase(),
                        departureDate,
                        adults: parseInt(adults),
                        children: parseInt(children),
                        infants: parseInt(infants),
                        travelClass: travelClass.toUpperCase(),
                        nonStop: nonStop === 'true' || nonStop === true,
                        currencyCode: currency.toUpperCase(),
                        max: Math.min(parseInt(maxResults), 250) // Amadeus max is 250
                    };

                    // Add optional parameters
                    if (returnDate) amadeusParams.returnDate = returnDate;
                    if (airlines) amadeusParams.includedAirlineCodes = Array.isArray(airlines) ? airlines : [airlines];
                    if (excludeAirlines) amadeusParams.excludedAirlineCodes = Array.isArray(excludeAirlines) ? excludeAirlines : [excludeAirlines];

                    // Search flights using Amadeus
                    const result = await amadeusService.searchFlightOffers(amadeusParams);
                    
                    if (!result.success) {
                        throw new Error(result.error);
                    }

                    // Process and enhance the data
                    const processedFlights = result.data.map(offer => {
                        const pricing = offer.price;
                        const outbound = offer.itineraries[0];
                        const inbound = offer.itineraries[1]; // May be undefined for one-way

                        return {
                            id: offer.id,
                            type: 'flight-offer',
                            source: offer.source,
                            pricing: {
                                total: parseFloat(pricing.total),
                                base: parseFloat(pricing.base),
                                currency: pricing.currency,
                                grandTotal: parseFloat(pricing.grandTotal),
                                fees: pricing.fees?.map(fee => ({
                                    amount: parseFloat(fee.amount),
                                    type: fee.type
                                })) || []
                            },
                            outboundJourney: {
                                duration: outbound.duration,
                                segments: outbound.segments.map(segment => ({
                                    departure: {
                                        airport: segment.departure.iataCode,
                                        terminal: segment.departure.terminal,
                                        time: segment.departure.at
                                    },
                                    arrival: {
                                        airport: segment.arrival.iataCode,
                                        terminal: segment.arrival.terminal,
                                        time: segment.arrival.at
                                    },
                                    airline: segment.carrierCode,
                                    flightNumber: segment.number,
                                    aircraft: segment.aircraft?.code,
                                    duration: segment.duration,
                                    stops: segment.numberOfStops || 0
                                }))
                            },
                            inboundJourney: inbound ? {
                                duration: inbound.duration,
                                segments: inbound.segments.map(segment => ({
                                    departure: {
                                        airport: segment.departure.iataCode,
                                        terminal: segment.departure.terminal,
                                        time: segment.departure.at
                                    },
                                    arrival: {
                                        airport: segment.arrival.iataCode,
                                        terminal: segment.arrival.terminal,
                                        time: segment.arrival.at
                                    },
                                    airline: segment.carrierCode,
                                    flightNumber: segment.number,
                                    aircraft: segment.aircraft?.code,
                                    duration: segment.duration,
                                    stops: segment.numberOfStops || 0
                                }))
                            } : null,
                            bookingDetails: {
                                seatsAvailable: offer.numberOfBookableSeats,
                                lastTicketingDate: offer.lastTicketingDate,
                                instantTicketing: offer.instantTicketingRequired,
                                validatingAirlines: offer.validatingAirlineCodes
                            },
                            travelerPricing: offer.travelerPricings
                        };
                    });

                    // Apply additional filters if specified
                    let filteredFlights = processedFlights;
                    
                    if (maxPrice) {
                        const maxPriceNum = parseFloat(maxPrice);
                        filteredFlights = filteredFlights.filter(flight => 
                            flight.pricing.total <= maxPriceNum
                        );
                    }

                    // Sort by price (lowest first)
                    filteredFlights.sort((a, b) => a.pricing.total - b.pricing.total);

                    return {
                        flights: filteredFlights,
                        searchParams: amadeusParams,
                        resultCount: filteredFlights.length,
                        dictionaries: result.dictionaries
                    };
                }
            );

            return res.json({
                success: true,
                data: cachedResult,
                meta: {
                    searchTime: new Date().toISOString(),
                    cached: true
                }
            });

        } catch (amadeusError) {
            console.error('Amadeus search error:', amadeusError);
            return res.status(502).json({
                success: false,
                error: 'Flight search service unavailable',
                message: amadeusError.message,
                details: process.env.NODE_ENV === 'development' ? amadeusError : undefined
            });
        }

    } catch (error) {
        console.error('Flight search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
};

/**
 * Get airports
 * GET /api/flights/airports?city=New York&country=USA&keyword=JFK
 */
const getAirports = async (req, res) => {
    try {
        const { keyword, city, country, max = 10 } = req.query;

        if (!keyword && !city) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: keyword or city'
            });
        }

        const searchKeyword = keyword || city;
        const cacheKey = `airports:${searchKeyword}:${country || 'all'}:${max}`;

        const result = await cacheService.getAirports(
            { keyword: searchKeyword, country, max },
            async () => {
                const amadeusResult = await amadeusService.searchAirportsAndCities(searchKeyword, {
                    max: parseInt(max),
                    include: ['AIRPORTS']
                });

                if (!amadeusResult.success) {
                    throw new Error(amadeusResult.error);
                }

                // Filter and format airports
                let airports = amadeusResult.data.filter(location => 
                    location.type === 'location' && location.subType === 'AIRPORT'
                );

                // Additional filtering by country if specified
                if (country) {
                    const countryCode = country.toUpperCase();
                    airports = airports.filter(airport => 
                        airport.address?.countryCode === countryCode ||
                        airport.address?.countryName?.toUpperCase().includes(countryCode)
                    );
                }

                return airports.map(airport => ({
                    id: airport.id,
                    name: airport.name,
                    iataCode: airport.iataCode,
                    type: airport.subType,
                    city: airport.address?.cityName,
                    country: airport.address?.countryName,
                    countryCode: airport.address?.countryCode,
                    state: airport.address?.stateCode,
                    coordinates: {
                        latitude: airport.geoCode?.latitude,
                        longitude: airport.geoCode?.longitude
                    },
                    timeZone: airport.timeZone,
                    popularity: airport.analytics?.travelers?.score || 0
                }));
            }
        );

        return res.json({
            success: true,
            data: result,
            meta: {
                searchKeyword,
                country,
                resultCount: result.length
            }
        });

    } catch (error) {
        console.error('Airport search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to search airports',
            message: error.message
        });
    }
};

/**
 * Search airports by location
 * GET /api/flights/airports/location?latitude=40.7128&longitude=-74.0060&radius=100
 */
const getAirportsByLocation = async (req, res) => {
    try {
        const { latitude, longitude, radius = 50 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: latitude and longitude'
            });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const rad = parseInt(radius);

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({
                success: false,
                error: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180'
            });
        }

        // For location-based airport search, we can use a nearby city search
        // This is a simplified approach - in production you might use a geocoding service
        const result = await amadeusService.searchAirportsAndCities('airport', {
            max: 20,
            include: ['AIRPORTS']
        });

        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: 'Airport search service unavailable',
                message: result.error
            });
        }

        // Calculate distance and filter by radius
        const calculateDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Earth's radius in kilometers
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        };

        const nearbyAirports = result.data
            .filter(airport => airport.geoCode?.latitude && airport.geoCode?.longitude)
            .map(airport => ({
                ...airport,
                distance: calculateDistance(
                    lat, lng,
                    airport.geoCode.latitude,
                    airport.geoCode.longitude
                )
            }))
            .filter(airport => airport.distance <= rad)
            .sort((a, b) => a.distance - b.distance);

        return res.json({
            success: true,
            data: nearbyAirports,
            meta: {
                searchLocation: { latitude: lat, longitude: lng },
                radius: rad,
                resultCount: nearbyAirports.length
            }
        });

    } catch (error) {
        console.error('Airport location search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to search airports by location',
            message: error.message
        });
    }
};

/**
 * Get specific airport by code
 * GET /api/flights/airports/LAX
 * GET /api/flights/airports/KLAX?type=icao
 */
const getAirportByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const { type = 'iata' } = req.query;

        if (!code) {
            return res.status(400).json({
                success: false,
                error: 'Missing airport code'
            });
        }

        const upperCode = code.toUpperCase();
        
        // Search for the specific airport
        const result = await amadeusService.searchAirportsAndCities(upperCode, {
            max: 5,
            include: ['AIRPORTS']
        });

        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: 'Airport search service unavailable',
                message: result.error
            });
        }

        // Find exact match
        const airport = result.data.find(location => 
            location.iataCode === upperCode ||
            (type === 'icao' && location.id === upperCode)
        );

        if (!airport) {
            return res.status(404).json({
                success: false,
                error: `Airport not found for code: ${upperCode}`,
                searchType: type
            });
        }

        return res.json({
            success: true,
            data: {
                id: airport.id,
                name: airport.name,
                iataCode: airport.iataCode,
                type: airport.subType,
                city: airport.address?.cityName,
                country: airport.address?.countryName,
                countryCode: airport.address?.countryCode,
                state: airport.address?.stateCode,
                coordinates: {
                    latitude: airport.geoCode?.latitude,
                    longitude: airport.geoCode?.longitude
                },
                timeZone: airport.timeZone,
                popularity: airport.analytics?.travelers?.score || 0
            }
        });

    } catch (error) {
        console.error('Airport code search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get airport by code',
            message: error.message
        });
    }
};

/**
 * Get airports by city
 * GET /api/flights/airports/city/New York?country=USA
 */
const getAirportsByCity = async (req, res) => {
    try {
        const { city } = req.params;
        const { country } = req.query;

        if (!city) {
            return res.status(400).json({
                success: false,
                error: 'Missing city name'
            });
        }

        const searchTerm = city.replace(/[^a-zA-Z\s]/g, ''); // Clean city name
        const cacheKey = `airports_city:${searchTerm}:${country || 'all'}`;

        const result = await cacheService.getAirports(
            { city: searchTerm, country },
            async () => {
                const amadeusResult = await amadeusService.searchAirportsAndCities(searchTerm, {
                    max: 20,
                    include: ['AIRPORTS']
                });

                if (!amadeusResult.success) {
                    throw new Error(amadeusResult.error);
                }

                let airports = amadeusResult.data.filter(location => {
                    const cityMatch = location.address?.cityName?.toLowerCase().includes(searchTerm.toLowerCase());
                    const countryMatch = !country || 
                        location.address?.countryCode?.toLowerCase() === country.toLowerCase() ||
                        location.address?.countryName?.toLowerCase().includes(country.toLowerCase());
                    
                    return cityMatch && countryMatch;
                });

                return airports.map(airport => ({
                    id: airport.id,
                    name: airport.name,
                    iataCode: airport.iataCode,
                    city: airport.address?.cityName,
                    country: airport.address?.countryName,
                    countryCode: airport.address?.countryCode,
                    coordinates: {
                        latitude: airport.geoCode?.latitude,
                        longitude: airport.geoCode?.longitude
                    },
                    popularity: airport.analytics?.travelers?.score || 0
                }));
            }
        );

        return res.json({
            success: true,
            data: result,
            meta: {
                city: searchTerm,
                country,
                resultCount: result.length
            }
        });

    } catch (error) {
        console.error('Airport city search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to search airports by city',
            message: error.message
        });
    }
};

/**
 * Get flight offer details
 * GET /api/flights/offers/:offerId
 */
const getFlightOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        const { include } = req.query; // 'credit-card-fees', 'detailed-fare-rules', etc.

        if (!offerId) {
            return res.status(400).json({
                success: false,
                error: 'Missing flight offer ID'
            });
        }

        // This would typically come from a previous search
        // For now, we'll return a helpful message
        return res.status(501).json({
            success: false,
            error: 'Flight offer pricing endpoint not fully implemented',
            message: 'This endpoint requires a flight offer object from a previous search',
            offerId,
            nextSteps: [
                'First search for flights using /api/flights/search',
                'Use the flight offer ID and data to price the offer',
                'Implement flight offer storage/session management'
            ]
        });

        // TODO: Implement flight offer pricing
        // const result = await amadeusService.priceFlightOffers(flightOffer, { include });

    } catch (error) {
        console.error('Flight offer error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get flight offer',
            message: error.message
        });
    }
};

/**
 * Get flight status
 * GET /api/flights/status?carrier=AA&flight=100&date=2025-07-01
 */
const getFlightStatus = async (req, res) => {
    try {
        const { carrier, flight, date } = req.query;

        if (!carrier || !flight || !date) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                required: ['carrier', 'flight', 'date'],
                example: '/api/flights/status?carrier=AA&flight=100&date=2025-07-01'
            });
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        const result = await amadeusService.getFlightStatus(
            carrier.toUpperCase(),
            flight,
            date
        );

        if (!result.success) {
            return res.status(502).json({
                success: false,
                error: 'Flight status service unavailable',
                message: result.error
            });
        }

        return res.json({
            success: true,
            data: result.data,
            meta: {
                carrier,
                flight,
                date,
                resultCount: result.data.length
            }
        });

    } catch (error) {
        console.error('Flight status error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get flight status',
            message: error.message
        });
    }
};

// Get the top matching airport's IATA code given a city or airport name
async function getIataCode(cityOrAirportName) {
  try {
    const amadeusResult = await amadeusService.searchAirportsAndCities(cityOrAirportName, {
      max: 1,
      subType: 'AIRPORT' // <- restrict search to airports
    });

    if (amadeusResult.success && Array.isArray(amadeusResult.data) && amadeusResult.data.length > 0) {
      //return amadeusResult.data[0].iataCode;
      return amadeusResult
    }

    return amadeusResult; // No airports found
  } catch (error) {
    console.error(`Error fetching IATA code for "${cityOrAirportName}":`, error.message || error);
    return amadeusResult;
  }
}


module.exports = {
    searchFlights,
    getAirports,
    getAirportsByLocation,
    getAirportByCode,
    getAirportsByCity,
    getFlightOffer,
    getFlightStatus,
    getIataCode
};