const amadeusService = require('../services/amadeusService');
const cacheService = require('../services/cacheService');

const { DbIataCode } = require('../services/supabaseService');

/**
 * Search hotels
 * POST /api/hotels/search
 * GET /api/hotels/search?city=Paris&country=France&checkIn=2025-07-01&checkOut=2025-07-05
 */
const searchHotels = async (req, res) => {
    try {
        const { 
            city, 
            country, 
            checkIn, 
            checkOut, 
            adults = 1, 
            rooms = 1,
            currency = 'USD',
            max = 20
        } = req.query;

        console.log('🏨 Hotel search request:', { city, country, checkIn, checkOut, adults, rooms });

        // Validation
        if (!city) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: city',
                received: req.query
            });
        }

        if (!checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                error: 'Missing required dates',
                required: ['checkIn', 'checkOut'],
                received: { checkIn, checkOut }
            });
        }

        try {
            // Step 1: Convert city name to proper Amadeus city code
            //const cityCode = getCityCode(city);


            
            let cityCode = null;

            if (city.length === 3 && /^[A-Z]{3}$/i.test(city)) {
                // Assume city param already IATA code (3 letters)
                cityCode = city.toUpperCase();
            } else {
                // Lookup city name in IATA database via DbIataCode
                const matches = await DbIataCode(city);

                if (matches.length === 1) {
                    cityCode = matches[0].IATA;
                    console.log(`[searchHotels] City name "${city}" resolved to IATA code: ${cityCode}`);
                } else if (matches.length > 1) {
                    const matchList = matches
                        .slice(0, 10)
                        .map(m => `${m.Name} (${m.IATA})`)
                        .join(', ');
                    return res.status(400).json({
                        success: false,
                        error: `Ambiguous city name. Matches found: ${matchList}`
                    });
                } else {
                    return res.status(400).json({
                        success: false,
                        error: `No IATA code found for city: ${city}`
                    });
                }
            }








            console.log('🏨 City code mapping:', city, '->', cityCode);
            
            if (!cityCode) {
                return res.status(400).json({
                    success: false,
                    error: `Unsupported city: ${city}`,
                    message: 'Please use major city names like Paris, London, New York, etc.',
                    supportedCities: ['Paris', 'London', 'New York', 'Tokyo', 'Singapore', 'Bangkok']
                });
            }

            // Step 2: Check if amadeusService methods exist
            if (!amadeusService.getHotelsByCity) {
                console.error('❌ getHotelsByCity method not found in amadeusService');
                return res.status(500).json({
                    success: false,
                    error: 'Hotel service not properly configured',
                    message: 'getHotelsByCity method missing'
                });
            }

            if (!amadeusService.searchHotelOffers) {
                console.error('❌ searchHotelOffers method not found in amadeusService');
                return res.status(500).json({
                    success: false,
                    error: 'Hotel service not properly configured', 
                    message: 'searchHotelOffers method missing'
                });
            }

            // Step 3: Get hotels in the city
            console.log('🏨 Calling getHotelsByCity with:', cityCode);
            const hotelListResult = await amadeusService.getHotelsByCity(cityCode);
            console.log('🏨 Hotel list result:', hotelListResult);
            
            if (!hotelListResult) {
                console.error('❌ hotelListResult is undefined');
                return res.status(502).json({
                    success: false,
                    error: 'Hotel search service unavailable',
                    message: 'getHotelsByCity returned undefined'
                });
            }

            if (!hotelListResult.success) {
                console.error('❌ Hotel list search failed:', hotelListResult.error);
                return res.status(502).json({
                    success: false,
                    error: 'Hotel search service unavailable',
                    message: hotelListResult.error || 'Hotel list search failed'
                });
            }

            if (!hotelListResult.data || hotelListResult.data.length === 0) {
                console.log('🏨 No hotels found in city');
                return res.json({
                    success: true,
                    data: {
                        hotels: [],
                        searchParams: { city, cityCode, checkIn, checkOut, adults, rooms },
                        resultCount: 0,
                        message: 'No hotels found in this city'
                    }
                });
            }

            console.log(`🏨 Found ${hotelListResult.data.length} hotels`);

            // Step 4: Get available offers for these hotels
            const hotelIds = hotelListResult.data
                .slice(0, Math.min(parseInt(max), 10)) // Limit to 10 for testing
                .map(hotel => hotel.hotelId);

            console.log('🏨 Getting offers for hotels:', hotelIds);

            const offersParams = {
                hotelIds,
                adults: parseInt(adults),
                checkInDate: checkIn,
                checkOutDate: checkOut,
                roomQuantity: parseInt(rooms),
                currency: currency.toUpperCase()
            };

            console.log('🏨 Offers search params:', offersParams);








            let offersResult = await amadeusService.searchHotelOffers(offersParams);

            // If error, attempt extracting the invalid ids and remove them
            if (!offersResult?.success && offersResult?.error?.code === 10604) {
                console.warn('Invalid hotel ids detected. Attempting to remove and retry...');
                const errorData = offersResult.error?.source?.parameter;

                if (errorData && errorData.includes('hotelIds=')) {
                    const invalidId = errorData.split('hotelIds=')[1];
                    console.log(`Excluding invalid hotel id: ${invalidId}`);

                    // Try again with filtered ids
                    const filteredHotelIds = hotelIds.filter(id => id !== invalidId);
                    offersParams.hotelIds = filteredHotelIds;

                    offersResult = await amadeusService.searchHotelOffers(offersParams);
                }
            }


            





            
            console.log('🏨 Offers result:', offersResult);

            if (!offersResult) {
                console.error('❌ offersResult is undefined');
                return res.status(502).json({
                    success: false,
                    error: 'Hotel offers search failed',
                    message: 'searchHotelOffers returned undefined'
                });
            }

            if (!offersResult.success) {
                console.error('❌ Hotel offers search failed:', offersResult.error);
                return res.status(502).json({
                    success: false,
                    error: 'Hotel offers search failed',
                    message: offersResult.error || 'Offers search failed'
                });
            }

            // Step 5: Process and format results
            const processedHotels = (offersResult.data || []).map(hotelOffer => {
                const hotel = hotelListResult.data.find(h => h.hotelId === hotelOffer.hotel?.hotelId);

                return {
                    id: hotelOffer.hotel?.hotelId || 'unknown',
                    type: 'hotel-offer',
                    hotel: {
                        name: hotelOffer.hotel?.name || 'Unknown Hotel',
                        rating: hotelOffer.hotel?.rating || 3,
                        chainCode: hotelOffer.hotel?.chainCode,
                        address: hotel?.address || {},
                        amenities: hotelOffer.hotel?.amenities || [],
                        geoCode: hotel?.geoCode || {}
                    },
                    offers: (hotelOffer.offers || []).map(offer => ({
                        id: offer.id,
                        checkInDate: offer.checkInDate,
                        checkOutDate: offer.checkOutDate,
                        roomQuantity: offer.roomQuantity,
                        rateCode: offer.rateCode,
                        price: {
                            currency: offer.price?.currency || currency,
                            base: parseFloat(offer.price?.base || 0),
                            total: parseFloat(offer.price?.total || 0),
                            variations: offer.price?.variations
                        },
                        room: offer.room,
                        guests: offer.guests,
                        policies: offer.policies
                    })),
                    available: hotelOffer.available !== false
                };
            });

            // Identify hotels that have NO pricing
            const pricedHotelIds = new Set((offersResult.data || []).map(ho => ho.hotel?.hotelId));

            const noPricingHotels = hotelListResult.data.filter(h => !pricedHotelIds.has(h.hotelId))
                .map(hotel => {
                    return {
                        id: hotel.hotelId,
                        type: 'hotel-offer',
                        hotel: {
                            name: hotel.name,
                            rating: hotel.rating || 3,
                            chainCode: hotel.chainCode,
                            address: hotel.address || {},
                            amenities: [],
                            geoCode: hotel.geoCode || {}
                        },
                        offers: [],
                        available: false
                    };
                });

            // Final combined results
            const finalResults = [
                ...processedHotels,
                ...noPricingHotels
            ];

            console.log(`🏨 Final result contains ${finalResults.length} hotels`);

            return res.json({
                success: true,
                data: {
                    hotels: finalResults,
                    searchParams: { city, cityCode, checkIn, checkOut, adults, rooms },
                    resultCount: finalResults.length
                },
                meta: {
                    searchTime: new Date().toISOString(),
                    cached: false
                }
            });


        } catch (amadeusError) {
            console.error('🏨 Amadeus hotel search error:', amadeusError);
            return res.status(502).json({
                success: false,
                error: 'Hotel search service unavailable',
                message: amadeusError.message || 'Unknown Amadeus error',
                details: process.env.NODE_ENV === 'development' ? amadeusError : undefined
            });
        }

    } catch (error) {
        console.error('🏨 Hotel search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message || 'Unknown error'
        });
    }
};

/*
// Add city code mapping function
function getCityCode(cityName) {
    const cityMappings = {
        'paris': 'PAR',
        'london': 'LON',
        'new york': 'NYC',
        'new york city': 'NYC',
        'nyc': 'NYC',
        'madrid': 'MAD',
        'barcelona': 'BCN',
        'rome': 'ROM',
        'milan': 'MIL',
        'amsterdam': 'AMS',
        'berlin': 'BER',
        'munich': 'MUC',
        'vienna': 'VIE',
        'zurich': 'ZUR',
        'brussels': 'BRU',
        'stockholm': 'STO',
        'oslo': 'OSL',
        'copenhagen': 'CPH',
        'helsinki': 'HEL',
        'prague': 'PRG',
        'budapest': 'BUD',
        'athens': 'ATH',
        'istanbul': 'IST',
        'dubai': 'DXB',
        'singapore': 'SIN',
        'bangkok': 'BKK',
        'tokyo': 'TYO',
        'osaka': 'OSA',
        'seoul': 'SEL',
        'hong kong': 'HKG',
        'mumbai': 'BOM',
        'delhi': 'DEL',
        'sydney': 'SYD',
        'melbourne': 'MEL',
        'toronto': 'YTO',
        'vancouver': 'YVR',
        'los angeles': 'LAX',
        'san francisco': 'SFO',
        'chicago': 'CHI',
        'miami': 'MIA',
        'boston': 'BOS',
        'washington': 'WAS',
        'las vegas': 'LAS'
    };
    
    return cityMappings[cityName.toLowerCase()] || null;
}
*/

/**
 * Get hotel details by ID
 * GET /api/hotels/123?checkIn=2025-07-01&checkOut=2025-07-05&adults=2
 */
const getHotelDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { checkIn, checkOut, adults = 1, rooms = 1, currency = 'USD' } = req.query;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Missing hotel ID'
            });
        }

        if (!checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                error: 'Missing required dates',
                required: ['checkIn', 'checkOut'],
                example: `/api/hotels/${id}?checkIn=2025-07-01&checkOut=2025-07-05`
            });
        }

        try {
            const hotelSearchParams = {
                hotelIds: [id],
                adults: parseInt(adults),
                checkInDate: checkIn,
                checkOutDate: checkOut,
                roomQuantity: parseInt(rooms),
                currency: currency.toUpperCase()
            };

            const result = await amadeusService.searchHotels(hotelSearchParams);
            
            if (!result.success) {
                return res.status(502).json({
                    success: false,
                    error: 'Hotel search service unavailable',
                    message: result.error
                });
            }

            if (result.data.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: `Hotel not found or no availability for ID: ${id}`
                });
            }

            const hotel = result.data[0];
            
            let rating = null;
            try {
                const ratingsResult = await amadeusService.getHotelRatings([id]);
                if (ratingsResult.success && ratingsResult.data.length > 0) {
                    rating = ratingsResult.data[0];
                }
            } catch (ratingsError) {
                console.warn('Could not fetch hotel rating:', ratingsError.message);
            }

            const hotelInfo = hotel.hotel;
            const detailedHotel = {
                id: hotelInfo.hotelId,
                name: hotelInfo.name,
                chainCode: hotelInfo.chainCode,
                dupeId: hotelInfo.dupeId,
                available: hotel.available,
                location: {
                    address: hotelInfo.address,
                    coordinates: {
                        latitude: parseFloat(hotelInfo.latitude),
                        longitude: parseFloat(hotelInfo.longitude)
                    },
                    cityCode: hotelInfo.cityCode,
                    distance: hotelInfo.hotelDistance
                },
                contact: hotelInfo.contact,
                description: hotelInfo.description,
                amenities: hotelInfo.amenities || [],
                media: hotelInfo.media || [],
                rating: rating ? {
                    overall: rating.overallRating,
                    numberOfRatings: rating.numberOfRatings,
                    numberOfReviews: rating.numberOfReviews,
                    sentiments: rating.sentiments
                } : null,
                offers: hotel.offers ? hotel.offers.map(offer => ({
                    id: offer.id,
                    checkIn: offer.checkInDate,
                    checkOut: offer.checkOutDate,
                    rateCode: offer.rateCode,
                    category: offer.category,
                    description: offer.description,
                    room: {
                        type: offer.room?.type,
                        typeEstimated: offer.room?.typeEstimated,
                        description: offer.room?.description
                    },
                    boardType: offer.boardType,
                    guests: offer.guests,
                    pricing: {
                        currency: offer.price.currency,
                        total: parseFloat(offer.price.total),
                        base: parseFloat(offer.price.base),
                        taxes: offer.price.taxes || [],
                        variations: offer.price.variations || []
                    },
                    policies: {
                        cancellation: offer.policies?.cancellation,
                        paymentType: offer.policies?.paymentType,
                        guarantee: offer.policies?.guarantee,
                        deposit: offer.policies?.deposit
                    },
                    commission: offer.commission
                })) : []
            };

            return res.json({
                success: true,
                data: detailedHotel
            });

        } catch (amadeusError) {
            console.error('Amadeus hotel details error:', amadeusError);
            return res.status(502).json({
                success: false,
                error: 'Hotel service unavailable',
                message: amadeusError.message
            });
        }

    } catch (error) {
        console.error('Hotel details error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get hotel details',
            message: error.message
        });
    }
};

/**
 * Search hotels by location (coordinates)
 * GET /api/hotels/location?latitude=40.7128&longitude=-74.0060&radius=50&checkIn=2025-07-01&checkOut=2025-07-05
 */
const searchHotelsByLocation = async (req, res) => {
    try {
        const { latitude, longitude, radius = 5, checkIn, checkOut, adults = 1, rooms = 1 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: latitude and longitude'
            });
        }

        if (!checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                error: 'Missing required dates',
                required: ['checkIn', 'checkOut', 'latitude', 'longitude']
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

        req.query.latitude = lat;
        req.query.longitude = lng;
        req.query.radius = rad;
        delete req.query.city;

        return await searchHotels(req, res);

    } catch (error) {
        console.error('Hotel location search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to search hotels by location',
            message: error.message
        });
    }
};

/**
 * Get hotels by city
 * GET /api/hotels/city/Paris?country=France&checkIn=2025-07-01&checkOut=2025-07-05
 */
const getHotelsByCity = async (req, res) => {
    try {
        const { city } = req.params;
        const { country, checkIn, checkOut, adults = 1, rooms = 1 } = req.query;

        if (!city) {
            return res.status(400).json({
                success: false,
                error: 'Missing city name'
            });
        }

        if (!checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                error: 'Missing required dates',
                required: ['checkIn', 'checkOut']
            });
        }

        const searchParams = {
            city: decodeURIComponent(city),
            country,
            checkIn,
            checkOut,
            adults,
            rooms,
            ...req.query
        };

        const modifiedReq = {
            ...req,
            method: 'GET',
            query: searchParams
        };

        return await searchHotels(modifiedReq, res);

    } catch (error) {
        console.error('Hotel city search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to search hotels by city',
            message: error.message
        });
    }
};

/**
 * Get hotel ratings
 * GET /api/hotels/ratings?hotelIds=MCLONGHM,ADNYCCTB
 */
const getHotelRatings = async (req, res) => {
    try {
        const { hotelIds } = req.query;

        if (!hotelIds) {
            return res.status(400).json({
                success: false,
                error: 'Missing hotel IDs',
                example: '/api/hotels/ratings?hotelIds=MCLONGHM,ADNYCCTB'
            });
        }

        const hotelIdArray = Array.isArray(hotelIds) ? hotelIds : hotelIds.split(',');

        if (hotelIdArray.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid hotel IDs provided'
            });
        }

        try {
            const result = await amadeusService.getHotelRatings(hotelIdArray);
            
            if (!result.success) {
                return res.status(502).json({
                    success: false,
                    error: 'Hotel ratings service unavailable',
                    message: result.error
                });
            }

            const processedRatings = result.data.map(rating => ({
                hotelId: rating.hotelId,
                overall: {
                    rating: rating.overallRating,
                    numberOfRatings: rating.numberOfRatings,
                    numberOfReviews: rating.numberOfReviews
                },
                categories: {
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
            }));

            return res.json({
                success: true,
                data: processedRatings,
                meta: {
                    requestedHotels: hotelIdArray.length,
                    ratingsFound: processedRatings.length
                }
            });

        } catch (amadeusError) {
            console.error('Amadeus ratings error:', amadeusError);
            return res.status(502).json({
                success: false,
                error: 'Hotel ratings service unavailable',
                message: amadeusError.message
            });
        }

    } catch (error) {
        console.error('Hotel ratings error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get hotel ratings',
            message: error.message
        });
    }
};

/**
 * Create hotel booking
 * POST /api/hotels/booking
 */
const createHotelBooking = async (req, res) => {
    try {
        const bookingData = req.body;

        const requiredFields = ['offerId', 'guests', 'payments'];
        const missingFields = requiredFields.filter(field => !bookingData[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required booking information',
                missingFields,
                example: {
                    offerId: 'hotel_offer_id_from_search',
                    guests: [{
                        name: {
                            title: 'MR',
                            firstName: 'John',
                            lastName: 'Doe'
                        },
                        contact: {
                            phone: '+1234567890',
                            email: 'john.doe@example.com'
                        }
                    }],
                    payments: [{
                        method: 'CREDIT_CARD',
                        card: {
                            vendorCode: 'VI',
                            cardNumber: '4111111111111111',
                            expiryDate: '2025-12'
                        }
                    }]
                }
            });
        }

        try {
            const result = await amadeusService.createHotelBooking(bookingData);
            
            if (!result.success) {
                return res.status(502).json({
                    success: false,
                    error: 'Hotel booking service unavailable',
                    message: result.error
                });
            }

            return res.status(201).json({
                success: true,
                data: result.data,
                message: 'Hotel booking created successfully'
            });

        } catch (amadeusError) {
            console.error('Amadeus booking error:', amadeusError);
            return res.status(502).json({
                success: false,
                error: 'Hotel booking failed',
                message: amadeusError.message
            });
        }

    } catch (error) {
        console.error('Hotel booking error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create hotel booking',
            message: error.message
        });
    }
};

/**
 * Get hotel chains reference data
 * GET /api/hotels/chains
 */
const getHotelChains = async (req, res) => {
    try {
        // Sample data - in production, integrate with Amadeus reference data API
        const sampleChains = [
            { code: 'AC', name: 'Marriott Hotels' },
            { code: 'HH', name: 'Hilton Hotels' }
        ];

        return res.json({
            success: true,
            data: sampleChains,
            meta: {
                total: sampleChains.length,
                note: 'Sample data - integrate with Amadeus reference data API for complete list'
            }
        });

    } catch (error) {
        console.error('Hotel chains error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get hotel chains',
            message: error.message
        });
    }
};

/**
 * Get hotel amenities reference data
 * GET /api/hotels/amenities
 */
const getHotelAmenities = async (req, res) => {
    try {
        // Sample data - in production, integrate with Amadeus reference data API
        const sampleAmenities = [
            { code: 'SWIMMING_POOL', name: 'Swimming Pool', category: 'Recreation' },
            { code: 'WIFI', name: 'Free WiFi', category: 'Technology' }
        ];

        const { category } = req.query;

        let filteredAmenities = sampleAmenities;
        if (category) {
            filteredAmenities = sampleAmenities.filter(amenity => 
                amenity.category.toLowerCase() === category.toLowerCase()
            );
        }

        return res.json({
            success: true,
            data: filteredAmenities,
            meta: {
                total: filteredAmenities.length,
                categories: ['Recreation', 'Technology'],
                note: 'Sample data - integrate with Amadeus reference data API for complete list'
            }
        });

    } catch (error) {
        console.error('Hotel amenities error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get hotel amenities',
            message: error.message
        });
    }
};

module.exports = {
    searchHotels,
    getHotelDetails,
    searchHotelsByLocation,
    getHotelsByCity,
    getHotelRatings,
    createHotelBooking,
    getHotelChains,
    getHotelAmenities
};