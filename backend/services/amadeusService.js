// Load environment variables
require('dotenv').config();

const Amadeus = require('amadeus');

const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID,
    clientSecret: process.env.AMADEUS_CLIENT_SECRET,
    hostname: process.env.AMADEUS_HOSTNAME || 'production' // 'test' or 'production'
});

const searchHotels = async ({ city, checkIn, checkOut, guests }) => {
    try {
        // First get city code if we have city name
        let cityCode = city;
        
        if (city && city.length > 3) {
            // Search for city to get IATA code
            const cityResponse = await amadeus.referenceData.locations.get({
                keyword: city,
                subType: 'CITY'
            });
            
            if (cityResponse.data && cityResponse.data.length > 0) {
                cityCode = cityResponse.data[0].iataCode;
            }
        }

        // Search for hotels in the city
        const hotelsResponse = await amadeus.referenceData.locations.hotels.byCity.get({
            cityCode: cityCode
        });

        if (!hotelsResponse.data || hotelsResponse.data.length === 0) {
            return [];
        }

        // If we have check-in/check-out dates, get hotel offers
        if (checkIn && checkOut) {
            const hotelIds = hotelsResponse.data.slice(0, 20).map(hotel => hotel.hotelId);
            
            try {
                const offersResponse = await amadeus.shopping.hotelOffersSearch.get({
                    hotelIds: hotelIds.join(','),
                    checkInDate: checkIn,
                    checkOutDate: checkOut,
                    adults: guests || 1
                });

                // Merge hotel data with offers
                return offersResponse.data.map(offer => ({
                    hotelId: offer.hotel.hotelId,
                    name: offer.hotel.name,
                    address: offer.hotel.address,
                    geoCode: offer.hotel.geoCode,
                    rating: offer.hotel.rating,
                    contact: offer.hotel.contact,
                    chainCode: offer.hotel.chainCode,
                    offers: offer.offers,
                    available: true
                }));
            } catch (offerError) {
                console.warn('Hotel offers search failed, returning basic hotel data:', offerError.message);
            }
        }

        // Return basic hotel information
        return hotelsResponse.data.map(hotel => ({
            hotelId: hotel.hotelId,
            name: hotel.name,
            address: hotel.address,
            geoCode: hotel.geoCode,
            rating: hotel.rating,
            contact: hotel.contact,
            chainCode: hotel.chainCode,
            available: false
        }));
        
    } catch (error) {
        console.error('Amadeus hotel search error:', error);
        throw new Error(`Hotel search failed: ${error.message}`);
    }
};

const searchFlights = async ({ origin, destination, departureDate, returnDate, passengers }) => {
    try {
        const searchParams = {
            originLocationCode: origin,
            destinationLocationCode: destination,
            departureDate: departureDate,
            adults: passengers || 1,
            nonStop: false,
            max: 250
        };

        if (returnDate) {
            searchParams.returnDate = returnDate;
        }

        const response = await amadeus.shopping.flightOffersSearch.get(searchParams);
        
        if (!response.data || response.data.length === 0) {
            return [];
        }

        return response.data.map(offer => ({
            id: offer.id,
            source: offer.source,
            instantTicketingRequired: offer.instantTicketingRequired,
            nonHomogeneous: offer.nonHomogeneous,
            oneWay: offer.oneWay,
            lastTicketingDate: offer.lastTicketingDate,
            numberOfBookableSeats: offer.numberOfBookableSeats,
            itineraries: offer.itineraries,
            price: offer.price,
            pricingOptions: offer.pricingOptions,
            validatingAirlineCodes: offer.validatingAirlineCodes,
            travelerPricings: offer.travelerPricings
        }));
        
    } catch (error) {
        console.error('Amadeus flight search error:', error);
        throw new Error(`Flight search failed: ${error.message}`);
    }
};

const getFlightOffer = async (offerId) => {
    try {
        const response = await amadeus.shopping.flightOffers.pricing.post(
            JSON.stringify({
                data: {
                    type: 'flight-offers-pricing',
                    flightOffers: [{ id: offerId }]
                }
            })
        );
        
        return response.data;
    } catch (error) {
        console.error('Amadeus flight offer error:', error);
        throw new Error(`Flight offer retrieval failed: ${error.message}`);
    }
};

const searchAirports = async (keyword) => {
    try {
        const response = await amadeus.referenceData.locations.get({
            keyword: keyword,
            subType: 'AIRPORT,CITY'
        });
        
        return response.data.filter(location => 
            location.subType === 'AIRPORT' || location.subType === 'CITY'
        );
    } catch (error) {
        console.error('Amadeus airport search error:', error);
        throw new Error(`Airport search failed: ${error.message}`);
    }
};

const getAirportInfo = async (airportCode) => {
    try {
        const response = await amadeus.referenceData.locations.get({
            keyword: airportCode,
            subType: 'AIRPORT'
        });
        
        return response.data.find(location => 
            location.iataCode === airportCode || location.icaoCode === airportCode
        );
    } catch (error) {
        console.error('Amadeus airport info error:', error);
        throw new Error(`Airport info retrieval failed: ${error.message}`);
    }
};

const getNearbyAirports = async (latitude, longitude, radius = 500) => {
    try {
        const response = await amadeus.referenceData.locations.airports.get({
            latitude: latitude,
            longitude: longitude,
            radius: radius
        });
        
        return response.data;
    } catch (error) {
        console.error('Amadeus nearby airports error:', error);
        throw new Error(`Nearby airports search failed: ${error.message}`);
    }
};

const getFlightDelay = async (airlineCode, flightNumber, scheduledDepartureDate) => {
    try {
        const response = await amadeus.travel.predictions.flightDelay.get({
            originLocationCode: 'JFK', // You'd need to pass this
            destinationLocationCode: 'LAX', // You'd need to pass this
            departureDate: scheduledDepartureDate,
            departureTime: '18:20:00',
            arrivalDate: scheduledDepartureDate,
            arrivalTime: '21:15:00',
            aircraftCode: '321',
            carrierCode: airlineCode,
            flightNumber: flightNumber,
            duration: 'PT6H51M'
        });
        
        return response.data;
    } catch (error) {
        console.error('Amadeus flight delay error:', error);
        throw new Error(`Flight delay prediction failed: ${error.message}`);
    }
};

const searchDestinations = async (origin, departureDate, duration) => {
    try {
        const response = await amadeus.shopping.flightDestinations.get({
            origin: origin,
            departureDate: departureDate,
            duration: duration || '1,15'
        });
        
        return response.data;
    } catch (error) {
        console.error('Amadeus destinations search error:', error);
        throw new Error(`Destinations search failed: ${error.message}`);
    }
};

// Utility function to handle Amadeus API rate limits
const withRetry = async (apiCall, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            if (error.response?.status === 429 && attempt < maxRetries) {
                // Rate limit hit, wait and retry
                const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.warn(`Rate limit hit, retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw error;
        }
    }
};

module.exports = {
    searchHotels,
    searchFlights,
    getFlightOffer,
    searchAirports,
    getAirportInfo,
    getNearbyAirports,
    getFlightDelay,
    searchDestinations,
    withRetry
};