const amadeusService = require('../services/amadeusService');
const cacheService = require('../services/cacheService');

/**
 * Search hotels
 * POST /api/hotels/search
 * GET /api/hotels/search?city=Paris&country=France&checkIn=2025-07-01&checkOut=2025-07-05
 */
const searchHotels = async (req, res) => {
    try {
        const searchParams = req.method === 'GET' ? req.query : req.body;
        
        const {
            city,
            country,
            latitude,
            longitude,
            checkIn,
            checkOut,
            adults = 1,
            rooms = 1,
            currency = 'USD',
            chainCodes,
            amenities,
            ratings,
            priceRange,
            radius = 5,
            maxResults = 50
        } = searchParams;

        // Validation
        if (!checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                required: ['checkIn', 'checkOut'],
                example: {
                    checkIn: '2025-07-01',
                    checkOut: '2025-07-05',
                    city: 'Paris',
                    country: 'France'
                }
            });
        }

        if (!city && !latitude && !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Must provide either city or coordinates (latitude/longitude)'
            });
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(checkIn) || !dateRegex.test(checkOut)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        // Validate dates
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const today = new Date();
        
        if (checkInDate <= today) {
            return res.status(400).json({
                success: false,
                error: 'Check-in date must be in the future'
            });
        }

        if (checkOutDate <= checkInDate) {
            return res.status(400).json({
                success: false,
                error: 'Check-out date must be after check-in date'
            });
        }

        try {
            const cacheKey = city 
                ? `hotels:${city}:${country || 'all'}:${checkIn}:${checkOut}:${adults}:${rooms}`
                : `hotels:${latitude},${longitude}:${checkIn}:${checkOut}:${adults}:${rooms}`;

            const result = await cacheService.getHotels(
                city || `${latitude},${longitude}`,
                country,
                async () => {
                    let hotelListParams;
                    
                    if (city) {
                        const citySearch = await amadeusService.searchAirportsAndCities(city, {
                            max: 5,
                            include: ['CITIES']
                        });

                        if (!citySearch.success || citySearch.data.length === 0) {
                            throw new Error(`City not found: ${city}`);
                        }

                        let cityCode;
                        if (country) {
                            const cityMatch = citySearch.data.find(location => 
                                location.address?.countryName?.toLowerCase().includes(country.toLowerCase()) ||
                                location.address?.countryCode?.toLowerCase() === country.toLowerCase()
                            );
                            cityCode = cityMatch ? cityMatch.address?.cityCode : citySearch.data[0].id;
                        } else {
                            cityCode = citySearch.data[0].id;
                        }

                        hotelListParams = {
                            cityCode,
                            chainCodes: Array.isArray(chainCodes) ? chainCodes : chainCodes ? [chainCodes] : undefined,
                            amenities: Array.isArray(amenities) ? amenities : amenities ? [amenities] : undefined,
                            ratings: Array.isArray(ratings) ? ratings : ratings ? [ratings] : undefined
                        };
                    } else {
                        hotelListParams = {
                            latitude: parseFloat(latitude),
                            longitude: parseFloat(longitude),
                            radius: parseInt(radius),
                            chainCodes: Array.isArray(chainCodes) ? chainCodes : chainCodes ? [chainCodes] : undefined,
                            amenities: Array.isArray(amenities) ? amenities : amenities ? [amenities] : undefined,
                            ratings: Array.isArray(ratings) ? ratings : ratings ? [ratings] : undefined
                        };
                    }

                    const hotelListResult = await amadeusService.getHotelList(hotelListParams);
                    
                    if (!hotelListResult.success) {
                        throw new Error(`Hotel list search failed: ${hotelListResult.error}`);
                    }

                    if (hotelListResult.data.length === 0) {
                        return {
                            hotels: [],
                            searchParams: hotelListParams,
                            message: 'No hotels found in the specified area'
                        };
                    }

                    const hotelIds = hotelListResult.data
                        .slice(0, Math.min(parseInt(maxResults), 100))
                        .map(hotel => hotel.hotelId);

                    const hotelSearchParams = {
                        hotelIds,
                        adults: parseInt(adults),
                        checkInDate: checkIn,
                        checkOutDate: checkOut,
                        roomQuantity: parseInt(rooms),
                        currency: currency.toUpperCase(),
                        priceRange
                    };

                    const hotelOffersResult = await amadeusService.searchHotels(hotelSearchParams);
                    
                    if (!hotelOffersResult.success) {
                        throw new Error(`Hotel offers search failed: ${hotelOffersResult.error}`);
                    }

                    const hotelsWithOffers = hotelOffersResult.data.filter(hotel => 
                        hotel.available && hotel.offers && hotel.offers.length > 0
                    );

                    let ratingsData = {};
                    if (hotelsWithOffers.length > 0) {
                        try {
                            const hotelIdsForRatings = hotelsWithOffers.map(hotel => hotel.hotel.hotelId);
                            const ratingsResult = await amadeusService.getHotelRatings(hotelIdsForRatings);
                            
                            if (ratingsResult.success) {
                                ratingsData = ratingsResult.data.reduce((acc, rating) => {
                                    acc[rating.hotelId] = rating;
                                    return acc;
                                }, {});
                            }
                        } catch (ratingsError) {
                            console.warn('Could not fetch hotel ratings:', ratingsError.message);
                        }
                    }

                    const processedHotels = hotelsWithOffers.map(hotel => {
                        const hotelInfo = hotel.hotel;
                        const bestOffer = hotel.offers.reduce((best, current) => 
                            parseFloat(current.price.total) < parseFloat(best.price.total) ? current : best
                        );
                        
                        const rating = ratingsData[hotelInfo.hotelId];

                        return {
                            id: hotelInfo.hotelId,
                            name: hotelInfo.name,
                            chainCode: hotelInfo.chainCode,
                            category: bestOffer.category,
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
                                numberOfReviews: rating.numberOfReviews,
                                sentiments: rating.sentiments
                            } : null,
                            bestOffer: {
                                id: bestOffer.id,
                                checkIn: bestOffer.checkInDate,
                                checkOut: bestOffer.checkOutDate,
                                roomType: bestOffer.room?.type,
                                roomDescription: bestOffer.room?.typeEstimated?.category,
                                bedType: bestOffer.room?.typeEstimated?.beds,
                                boardType: bestOffer.boardType,
                                pricing: {
                                    currency: bestOffer.price.currency,
                                    total: parseFloat(bestOffer.price.total),
                                    base: parseFloat(bestOffer.price.base),
                                    taxes: bestOffer.price.taxes || [],
                                    variations: bestOffer.price.variations || []
                                },
                                policies: {
                                    cancellation: bestOffer.policies?.cancellation,
                                    paymentType: bestOffer.policies?.paymentType,
                                    guarantee: bestOffer.policies?.guarantee
                                },
                                commission: bestOffer.commission
                            },
                            allOffers: hotel.offers.map(offer => ({
                                id: offer.id,
                                roomType: offer.room?.type,
                                boardType: offer.boardType,
                                price: {
                                    currency: offer.price.currency,
                                    total: parseFloat(offer.price.total),
                                    base: parseFloat(offer.price.base)
                                }
                            }))
                        };
                    });

                    processedHotels.sort((a, b) => a.bestOffer.pricing.total - b.bestOffer.pricing.total);

                    return {
                        hotels: processedHotels,
                        searchParams: { ...hotelListParams, ...hotelSearchParams },
                        resultCount: processedHotels.length,
                        totalAvailable: hotelListResult.data.length
                    };
                }
            );

            return res.json({
                success: true,
                data: result,
                meta: {
                    searchTime: new Date().toISOString(),
                    cached: true
                }
            });

        } catch (amadeusError) {
            console.error('Amadeus hotel search error:', amadeusError);
            return res.status(502).json({
                success: false,
                error: 'Hotel search service unavailable',
                message: amadeusError.message
            });
        }

    } catch (error) {
        console.error('Hotel search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
};

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