// Load environment variables
require('dotenv').config();

const Amadeus = require('amadeus');

// Initialize Amadeus client
let amadeus;
try {
    amadeus = new Amadeus({
        clientId: process.env.AMADEUS_CLIENT_ID,
        clientSecret: process.env.AMADEUS_CLIENT_SECRET,
        hostname: process.env.AMADEUS_HOSTNAME || 'test' // 'test' or 'production'
    });
} catch (error) {
    console.warn('⚠️  Amadeus client not initialized. Please check your environment variables.');
    amadeus = null;
}

// Helper function to check if Amadeus is configured
const checkAmadeusConfig = () => {
    if (!amadeus) {
        throw new Error('Amadeus service not configured. Please set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET in your environment variables.');
    }
};

// ===============================
// AIRPORT & FLIGHT APIs
// ===============================

/**
 * Airport & City Search
 * Finds airports and cities that match a specific word or string of letters
 * https://developers.amadeus.com/self-service/category/flights/api-doc/airport-and-city-search
 */
const searchAirportsAndCities = async (keyword, options = {}) => {
    checkAmadeusConfig();
    
    try {
        const searchParams = {
            keyword,
            max: options.max || 10,
            include: options.include || ['AIRPORTS'] // ['AIRPORTS', 'CITIES']
        };

        const response = await amadeus.referenceData.locations.get(searchParams);
        
        return {
            success: true,
            data: response.data.map(location => ({
                id: location.id,
                name: location.name,
                iataCode: location.iataCode,
                type: location.type,
                subType: location.subType,
                address: {
                    cityName: location.address?.cityName,
                    countryName: location.address?.countryName,
                    countryCode: location.address?.countryCode,
                    stateCode: location.address?.stateCode
                },
                geoCode: {
                    latitude: location.geoCode?.latitude,
                    longitude: location.geoCode?.longitude
                },
                timeZone: location.timeZoneOffset,
                analytics: {
                    travelers: {
                        score: location.analytics?.travelers?.score
                    }
                }
            })),
            meta: response.meta
        };
    } catch (error) {
        console.error('Error searching airports and cities:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

/**
 * Flight Offers Search
 * Searches over 400 airlines to find the cheapest flights for a given itinerary
 * https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search
 */
const searchFlightOffers = async (searchParams) => {
    checkAmadeusConfig();
    
    try {
        const {
            originLocationCode,
            destinationLocationCode,
            departureDate,
            returnDate, // Optional for round-trip
            adults = 1,
            children = 0,
            infants = 0,
            travelClass = 'ECONOMY', // ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST
            includedAirlineCodes, // Optional array of airline codes
            excludedAirlineCodes, // Optional array of airline codes
            nonStop = false,
            currencyCode = 'USD',
            max = 250
        } = searchParams;

        const flightSearchParams = {
            originLocationCode,
            destinationLocationCode,
            departureDate,
            adults,
            children,
            infants,
            travelClass,
            nonStop,
            currencyCode,
            max
        };

        // Add optional parameters
        if (returnDate) flightSearchParams.returnDate = returnDate;
        if (includedAirlineCodes) flightSearchParams.includedAirlineCodes = includedAirlineCodes.join(',');
        if (excludedAirlineCodes) flightSearchParams.excludedAirlineCodes = excludedAirlineCodes.join(',');

        const response = await amadeus.shopping.flightOffersSearch.get(flightSearchParams);
        
        return {
            success: true,
            data: response.data.map(offer => ({
                id: offer.id,
                type: offer.type,
                source: offer.source,
                instantTicketingRequired: offer.instantTicketingRequired,
                nonHomogeneous: offer.nonHomogeneous,
                oneWay: offer.oneWay,
                lastTicketingDate: offer.lastTicketingDate,
                numberOfBookableSeats: offer.numberOfBookableSeats,
                itineraries: offer.itineraries.map(itinerary => ({
                    duration: itinerary.duration,
                    segments: itinerary.segments.map(segment => ({
                        departure: {
                            iataCode: segment.departure.iataCode,
                            terminal: segment.departure.terminal,
                            at: segment.departure.at
                        },
                        arrival: {
                            iataCode: segment.arrival.iataCode,
                            terminal: segment.arrival.terminal,
                            at: segment.arrival.at
                        },
                        carrierCode: segment.carrierCode,
                        number: segment.number,
                        aircraft: segment.aircraft,
                        operating: segment.operating,
                        duration: segment.duration,
                        id: segment.id,
                        numberOfStops: segment.numberOfStops,
                        blacklistedInEU: segment.blacklistedInEU
                    }))
                })),
                price: {
                    currency: offer.price.currency,
                    total: offer.price.total,
                    base: offer.price.base,
                    fees: offer.price.fees,
                    grandTotal: offer.price.grandTotal
                },
                pricingOptions: offer.pricingOptions,
                validatingAirlineCodes: offer.validatingAirlineCodes,
                travelerPricings: offer.travelerPricings
            })),
            dictionaries: response.dictionaries,
            meta: response.meta
        };
    } catch (error) {
        console.error('Error searching flight offers:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

/**
 * Flight Availabilities Search
 * Provides a list of flights with seats for sale on a given itinerary
 * https://developers.amadeus.com/self-service/category/flights/api-doc/flight-availabilities-search
 */
const searchFlightAvailabilities = async (searchParams) => {
    checkAmadeusConfig();
    
    try {
        const response = await amadeus.shopping.availability.flightAvailabilities.post(
            JSON.stringify(searchParams)
        );
        
        return {
            success: true,
            data: response.data,
            dictionaries: response.dictionaries,
            meta: response.meta
        };
    } catch (error) {
        console.error('Error searching flight availabilities:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

/**
 * Flight Offers Price
 * Confirms the availability and final price of flights
 * https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-price
 */
const priceFlightOffers = async (flightOffers, options = {}) => {
    checkAmadeusConfig();
    
    try {
        const request = {
            data: {
                type: 'flight-offers-pricing',
                flightOffers: Array.isArray(flightOffers) ? flightOffers : [flightOffers]
            }
        };

        // Add optional parameters
        if (options.include) {
            request.data.include = options.include; // ['credit-card-fees', 'detailed-fare-rules', 'other-services']
        }

        const response = await amadeus.shopping.flightOffers.pricing.post(
            JSON.stringify(request)
        );
        
        return {
            success: true,
            data: response.data,
            dictionaries: response.dictionaries,
            meta: response.meta
        };
    } catch (error) {
        console.error('Error pricing flight offers:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

/**
 * Flight Create Orders
 * Performs the final booking for a chosen flight
 * https://developers.amadeus.com/self-service/category/flights/api-doc/flight-create-orders
 */
const createFlightOrder = async (orderData) => {
    checkAmadeusConfig();
    
    try {
        const response = await amadeus.booking.flightOrders.post(
            JSON.stringify(orderData)
        );
        
        return {
            success: true,
            data: response.data,
            dictionaries: response.dictionaries,
            meta: response.meta
        };
    } catch (error) {
        console.error('Error creating flight order:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

/**
 * On Demand Flight Status
 * Provides real-time flight schedule data
 * https://developers.amadeus.com/self-service/category/flights/api-doc/on-demand-flight-status
 */
const getFlightStatus = async (carrierCode, flightNumber, scheduledDepartureDate) => {
    checkAmadeusConfig();
    
    try {
        const response = await amadeus.schedule.flights.get({
            carrierCode,
            flightNumber,
            scheduledDepartureDate
        });
        
        return {
            success: true,
            data: response.data.map(flight => ({
                type: flight.type,
                scheduledDepartureDate: flight.scheduledDepartureDate,
                flightDesignator: flight.flightDesignator,
                flightPoints: flight.flightPoints.map(point => ({
                    iataCode: point.iataCode,
                    departure: point.departure,
                    arrival: point.arrival
                })),
                segments: flight.segments,
                legs: flight.legs
            })),
            meta: response.meta
        };
    } catch (error) {
        console.error('Error getting flight status:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

// ===============================
// HOTEL APIs
// ===============================

/**
 * Hotel List
 * Provides a list of hotels inside a city or an area
 * https://developers.amadeus.com/self-service/category/hotels/api-doc/hotel-list
 */
const getHotelList = async (searchParams) => {
    checkAmadeusConfig();
    
    try {
        const {
            cityCode, // IATA city code
            latitude, // For geocode search
            longitude, // For geocode search
            radius = 5, // Radius in KM for geocode search
            radiusUnit = 'KM',
            chainCodes, // Array of hotel chain codes
            amenities, // Array of amenity codes
            ratings, // Array of ratings (1-5)
            hotelSource = 'ALL'
        } = searchParams;

        let requestParams = {
            hotelSource,
            radius,
            radiusUnit
        };

        // City search
        if (cityCode) {
            requestParams.cityCode = cityCode;
        }
        // Geocode search
        else if (latitude && longitude) {
            requestParams.latitude = latitude;
            requestParams.longitude = longitude;
        }

        // Optional filters
        if (chainCodes) requestParams.chainCodes = chainCodes.join(',');
        if (amenities) requestParams.amenities = amenities.join(',');
        if (ratings) requestParams.ratings = ratings.join(',');

        const response = await amadeus.referenceData.locations.hotels.get(requestParams);
        
        return {
            success: true,
            data: response.data.map(hotel => ({
                type: hotel.type,
                hotelId: hotel.hotelId,
                chainCode: hotel.chainCode,
                dupeId: hotel.dupeId,
                name: hotel.name,
                cityCode: hotel.cityCode,
                geoCode: {
                    latitude: hotel.geoCode?.latitude,
                    longitude: hotel.geoCode?.longitude
                },
                address: {
                    lines: hotel.address?.lines,
                    postalCode: hotel.address?.postalCode,
                    cityName: hotel.address?.cityName,
                    countryCode: hotel.address?.countryCode
                },
                distance: hotel.distance,
                lastUpdate: hotel.lastUpdate
            })),
            meta: response.meta
        };
    } catch (error) {
        console.error('Error getting hotel list:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

/**
 * Hotel Search
 * Delivers the best options from over 150,000 hotels worldwide
 * https://developers.amadeus.com/self-service/category/hotels/api-doc/hotel-search
 */
const searchHotels = async (searchParams) => {
    checkAmadeusConfig();
    
    try {
        const {
            hotelIds, // Array of hotel IDs or single hotel ID
            adults = 1,
            checkInDate,
            checkOutDate,
            countryCode,
            roomQuantity = 1,
            priceRange, // 'min-max' format like '100-500'
            currency = 'USD',
            paymentPolicy = 'NONE', // NONE, GUARANTEE, DEPOSIT
            boardType // Array: ['ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'ALL_INCLUSIVE']
        } = searchParams;

        const requestParams = {
            hotelIds: Array.isArray(hotelIds) ? hotelIds.join(',') : hotelIds,
            adults,
            checkInDate,
            checkOutDate,
            roomQuantity,
            currency,
            paymentPolicy
        };

        // Optional parameters
        if (countryCode) requestParams.countryCode = countryCode;
        if (priceRange) requestParams.priceRange = priceRange;
        if (boardType) requestParams.boardType = Array.isArray(boardType) ? boardType.join(',') : boardType;

        const response = await amadeus.shopping.hotelOffersSearch.get(requestParams);
        
        return {
            success: true,
            data: response.data.map(hotel => ({
                type: hotel.type,
                hotel: {
                    type: hotel.hotel?.type,
                    hotelId: hotel.hotel?.hotelId,
                    chainCode: hotel.hotel?.chainCode,
                    dupeId: hotel.hotel?.dupeId,
                    name: hotel.hotel?.name,
                    cityCode: hotel.hotel?.cityCode,
                    latitude: hotel.hotel?.latitude,
                    longitude: hotel.hotel?.longitude,
                    hotelDistance: hotel.hotel?.hotelDistance,
                    address: hotel.hotel?.address,
                    contact: hotel.hotel?.contact,
                    description: hotel.hotel?.description,
                    amenities: hotel.hotel?.amenities,
                    media: hotel.hotel?.media
                },
                available: hotel.available,
                offers: hotel.offers?.map(offer => ({
                    id: offer.id,
                    checkInDate: offer.checkInDate,
                    checkOutDate: offer.checkOutDate,
                    rateCode: offer.rateCode,
                    rateFamilyEstimated: offer.rateFamilyEstimated,
                    category: offer.category,
                    description: offer.description,
                    commission: offer.commission,
                    boardType: offer.boardType,
                    room: offer.room,
                    guests: offer.guests,
                    price: {
                        currency: offer.price?.currency,
                        base: offer.price?.base,
                        total: offer.price?.total,
                        variations: offer.price?.variations
                    },
                    policies: offer.policies,
                    self: offer.self
                })),
                self: hotel.self
            })),
            meta: response.meta
        };
    } catch (error) {
        console.error('Error searching hotels:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

/**
 * Hotel List by City Code
 * Get list of hotels by city code (like PAR for Paris)
 */
const getHotelsByCity = async (cityCode, options = {}) => {
    checkAmadeusConfig();
    
    try {
        const response = await amadeus.referenceData.locations.hotels.byCity.get({
            cityCode: cityCode.toUpperCase(),
            ...options
        });
        
        return {
            success: true,
            data: response.data.map(hotel => ({
                type: hotel.type,
                hotelId: hotel.hotelId,
                chainCode: hotel.chainCode,
                dupeId: hotel.dupeId,
                name: hotel.name,
                cityCode: hotel.cityCode,
                geoCode: {
                    latitude: hotel.geoCode?.latitude,
                    longitude: hotel.geoCode?.longitude
                },
                address: {
                    lines: hotel.address?.lines,
                    postalCode: hotel.address?.postalCode,
                    cityName: hotel.address?.cityName,
                    countryCode: hotel.address?.countryCode
                },
                distance: hotel.distance,
                lastUpdate: hotel.lastUpdate
            })),
            meta: response.meta
        };
    } catch (error) {
        console.error('Error getting hotels by city:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

/**
 * Hotel Offers Search
 * Get available hotel offers for specific hotels
 */
const searchHotelOffers = async (searchParams) => {
    checkAmadeusConfig();
    
    try {
        const {
            hotelIds, // Array of hotel IDs or single hotel ID
            adults = 1,
            checkInDate,
            checkOutDate,
            roomQuantity = 1,
            currency = 'USD'
        } = searchParams;

        const response = await amadeus.shopping.hotelOffersSearch.get({
            hotelIds: Array.isArray(hotelIds) ? hotelIds.join(',') : hotelIds,
            adults,
            checkInDate,
            checkOutDate,
            roomQuantity,
            currency
        });
        
        return {
            success: true,
            data: response.data,
            meta: response.meta
        };
    } catch (error) {
        console.error('Error searching hotel offers:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};


/**
 * Hotel Ratings
 * Enrich hotel search results with traveler ratings
 * https://developers.amadeus.com/self-service/category/hotels/api-doc/hotel-ratings
 */
const getHotelRatings = async (hotelIds) => {
    checkAmadeusConfig();
    
    try {
        const requestParams = {
            hotelIds: Array.isArray(hotelIds) ? hotelIds.join(',') : hotelIds
        };

        const response = await amadeus.ereputation.hotelSentiments.get(requestParams);
        
        return {
            success: true,
            data: response.data.map(rating => ({
                type: rating.type,
                hotelId: rating.hotelId,
                overallRating: rating.overallRating,
                numberOfRatings: rating.numberOfRatings,
                numberOfReviews: rating.numberOfReviews,
                sentiments: {
                    sleepQuality: rating.sentiments?.sleepQuality,
                    service: rating.sentiments?.service,
                    facilities: rating.sentiments?.facilities,
                    roomComfort: rating.sentiments?.roomComfort,
                    valueForMoney: rating.sentiments?.valueForMoney,
                    catering: rating.sentiments?.catering,
                    swimming: rating.sentiments?.swimming,
                    location: rating.sentiments?.location,
                    internet: rating.sentiments?.internet,
                    pointsOfInterest: rating.sentiments?.pointsOfInterest,
                    staff: rating.sentiments?.staff
                }
            })),
            meta: response.meta
        };
    } catch (error) {
        console.error('Error getting hotel ratings:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

/**
 * Hotel Booking
 * Lets you complete bookings at over 150,000 hotels
 * https://developers.amadeus.com/self-service/category/hotels/api-doc/hotel-booking
 */
const createHotelBooking = async (bookingData) => {
    checkAmadeusConfig();
    
    try {
        const response = await amadeus.booking.hotelBookings.post(
            JSON.stringify(bookingData)
        );
        
        return {
            success: true,
            data: response.data,
            meta: response.meta
        };
    } catch (error) {
        console.error('Error creating hotel booking:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data || null
        };
    }
};

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Health check for Amadeus service
 */
const healthCheck = () => {
    const isConfigured = !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
    
    return {
        service: 'Amadeus',
        configured: isConfigured,
        hostname: process.env.AMADEUS_HOSTNAME || 'test',
        clientId: process.env.AMADEUS_CLIENT_ID ? 'configured' : 'missing',
        clientSecret: process.env.AMADEUS_CLIENT_SECRET ? 'configured' : 'missing',
        status: isConfigured ? 'ready' : 'not configured'
    };
};

module.exports = {
    // Airport & Flight APIs
    searchAirportsAndCities,
    searchFlightOffers,
    searchFlightAvailabilities,
    priceFlightOffers,
    createFlightOrder,
    getFlightStatus,
    
    // Hotel APIs
    getHotelList,
    searchHotels,
    getHotelRatings,
    createHotelBooking,
    getHotelsByCity,
    searchHotelOffers,
    
    // Utility
    healthCheck
};