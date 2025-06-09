import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, MapPin, Calendar, Users, Plane, Hotel, Route, Star, Clock, Filter, Menu, X, ChevronRight, Globe, Heart, User, Settings } from 'lucide-react';

const TravelApp = () => {
  const [activeTab, setActiveTab] = useState('search');
  const [searchType, setSearchType] = useState('flights');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // User state with stable reference
  const [user] = useState(() => ({ id: 'user123', name: 'Travel Explorer' }));
  
  // Search form state
  const [searchForm, setSearchForm] = useState(() => ({
    origin: '',
    destination: '',
    departDate: '',
    returnDate: '',
    passengers: 1,
    rooms: 1,
    budget: '',
    preferences: []
  }));

  // Memoize API base URL
  const API_BASE = useMemo(() => {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:8080' 
      : 'https://your-api-domain.com';
  }, []);

  // Fetch API helper
  const apiCall = useCallback(async (endpoint, options = {}) => {
    try {
      console.log('Making request to:', `${API_BASE}${endpoint}`);
      console.log('Request options:', options);
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response body:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('Response data:', responseData);
      return responseData;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }, [API_BASE]);

  // Stable input change handler
  const handleInputChange = useCallback((field, value) => {
    setSearchForm(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Search function
  const handleSearch = useCallback(async () => {
    // Different validation for flights vs hotels
    if (searchType === 'flights') {
      if (!searchForm.origin || !searchForm.destination) {
        alert('Please enter both origin and destination for flight search');
        return;
      }
    } else if (searchType === 'hotels') {
      if (!searchForm.destination) {
        alert('Please enter a destination for hotel search');
        return;
      }
      if (!searchForm.departDate || !searchForm.returnDate) {
        alert('Please select check-in and check-out dates for hotel search');
        return;
      }
    }

    setIsLoading(true);
    try {
      let endpoint = '';
      let searchData = {};

      let results;
      
      if (searchType === 'flights') {
        // Build query parameters for GET request
        const params = new URLSearchParams({
          origin: searchForm.origin,
          destination: searchForm.destination,
          departureDate: searchForm.departDate,
          adults: searchForm.passengers.toString(),
          max: '10'
        });
        
        // Add returnDate if it exists
        if (searchForm.returnDate) {
          params.append('returnDate', searchForm.returnDate);
        }
        
        endpoint = `/api/flights/search?${params.toString()}`;
        
        // Use GET request for flights
        results = await apiCall(endpoint, {
          method: 'GET'
        });
        
      } else if (searchType === 'hotels') {
        // Build query parameters for GET request
        // Try different city name formats to improve success rate
        let cityName = searchForm.destination.trim();
        let country = '';
        
        // Extract country if user typed "City, Country" format
        if (cityName.includes(',')) {
          const parts = cityName.split(',').map(s => s.trim());
          cityName = parts[0];
          country = parts[1];
        }
        
        // Common city name mappings for better Amadeus compatibility
        const cityMappings = {
          'new york': 'NYC',
          'new york city': 'NYC', 
          'nyc': 'NYC',
          'los angeles': 'LAX',
          'la': 'LAX',
          'san francisco': 'SFO',
          'sf': 'SFO',
          'las vegas': 'LAS',
          'vegas': 'LAS',
          'chicago': 'CHI',
          'washington': 'WAS',
          'washington dc': 'WAS',
          'boston': 'BOS',
          'miami': 'MIA',
          'paris': 'PAR',
          'london': 'LON',
          'tokyo': 'TYO',
          'rome': 'ROM'
        };
        
        const cityKey = cityName.toLowerCase();
        const finalCityName = cityMappings[cityKey] || cityName;
        
        const params = new URLSearchParams({
          city: finalCityName,
          checkIn: searchForm.departDate,
          checkOut: searchForm.returnDate,
          adults: searchForm.passengers.toString(),
          rooms: searchForm.rooms.toString(),
          currency: 'USD',
          max: '20'
        });
        
        // Add country if we detected one
        if (country) {
          params.append('country', country);
        }
        
        endpoint = `/api/hotels/search?${params.toString()}`;
        
        console.log('Hotel search - Original:', searchForm.destination);
        console.log('Hotel search - Final city:', finalCityName);
        console.log('Hotel search - Country:', country || 'none');
        console.log('Hotel search URL:', `${API_BASE}${endpoint}`);
        
        // Use GET request for hotels
        results = await apiCall(endpoint, {
          method: 'GET'
        });
      }

      console.log('Search results:', results);
      
      // Handle different response formats from backend
      let resultsArray = [];
      if (results) {
        if (Array.isArray(results)) {
          resultsArray = results;
        } else if (results.data && Array.isArray(results.data)) {
          resultsArray = results.data;
        } else if (results.data && results.data.flights && Array.isArray(results.data.flights)) {
          resultsArray = results.data.flights;
        } else if (results.data && results.data.hotels && Array.isArray(results.data.hotels)) {
          resultsArray = results.data.hotels;
        } else if (results.flights && Array.isArray(results.flights)) {
          resultsArray = results.flights;
        } else if (results.hotels && Array.isArray(results.hotels)) {
          resultsArray = results.hotels;
        } else {
          console.warn('Unexpected response format:', results);
          resultsArray = [];
        }
      }
      
      console.log('Processed results array:', resultsArray);
      setSearchResults(resultsArray);  // Store the array directly, not the whole object
      setActiveTab('results');

      console.log('Search results:', results);
      setSearchResults(results.data || []);
      setActiveTab('results');
    } catch (error) {
      console.error('Search failed:', error);
      alert(`Search failed: ${error.message}. Please check your backend configuration and try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [searchForm, searchType, apiCall, API_BASE]);

  // Toggle favorite function
  const toggleFavorite = useCallback(async (item) => {
    try {
      const isFavorite = favorites.some(fav => fav.id === item.id);
      
      if (isFavorite) {
        setFavorites(prev => prev.filter(fav => fav.id !== item.id));
      } else {
        setFavorites(prev => [...prev, item]);
        
        // Save to backend
        await apiCall(`/api/users/${user.id}/favorites`, {
          method: 'POST',
          body: JSON.stringify({
            type: searchType,
            data: item
          })
        });
      }
    } catch (error) {
      console.error('Failed to update favorites:', error);
    }
  }, [favorites, user.id, searchType, apiCall]);

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const favoritesData = await apiCall(`/api/users/${user.id}/favorites`).catch(() => ({ data: [] }));
        setFavorites(favoritesData.data || []);
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };

    loadUserData();
  }, [apiCall, user.id]);

  // Memoized sidebar component
  const Sidebar = useMemo(() => (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0`}>
      <div className="flex items-center justify-between h-16 px-4 border-b">
        <h1 className="text-xl font-bold text-blue-600">TravelApp</h1>
        <button 
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden"
        >
          <X size={24} />
        </button>
      </div>
      
      <nav className="mt-8">
        <div className="px-4 space-y-2">
          <button
            onClick={() => setActiveTab('search')}
            className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'search' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Search size={20} className="mr-3" />
            Search
          </button>
          
          <button
            onClick={() => setActiveTab('results')}
            className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'results' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Globe size={20} className="mr-3" />
            Results
          </button>
          
          <button
            onClick={() => setActiveTab('favorites')}
            className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'favorites' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Heart size={20} className="mr-3" />
            Favorites
          </button>
          
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'profile' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <User size={20} className="mr-3" />
            Profile
          </button>
        </div>
      </nav>
    </div>
  ), [sidebarOpen, activeTab]);

  // Memoized search form component
  const SearchForm = useMemo(() => (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Plan Your Trip</h2>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSearchType('flights')}
              className={`px-4 py-2 rounded-md transition-colors ${
                searchType === 'flights' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
              }`}
            >
              <Plane size={16} className="inline mr-2" />
              Flights
            </button>
            <button
              onClick={() => setSearchType('hotels')}
              className={`px-4 py-2 rounded-md transition-colors ${
                searchType === 'hotels' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
              }`}
            >
              <Hotel size={16} className="inline mr-2" />
              Hotels
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {searchType === 'flights' ? 'From' : 'From (optional)'}
            </label>
            <div className="relative">
              <MapPin size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder={searchType === 'flights' ? 'Origin city or airport' : 'Origin (optional)'}
                value={searchForm.origin}
                onChange={(e) => handleInputChange('origin', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={searchType === 'hotels'}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {searchType === 'flights' ? 'To' : 'Destination City'}
            </label>
            <div className="relative">
              <MapPin size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder={searchType === 'flights' ? 'Destination city or airport' : 'City name (e.g., NYC, Paris, London, or "Paris, France")'}
                value={searchForm.destination}
                onChange={(e) => handleInputChange('destination', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {searchType === 'flights' ? 'Departure' : 'Check-in'}
            </label>
            <div className="relative">
              <Calendar size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="date"
                value={searchForm.departDate}
                onChange={(e) => handleInputChange('departDate', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {searchType === 'flights' ? 'Return' : 'Check-out'}
            </label>
            <div className="relative">
              <Calendar size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="date"
                value={searchForm.returnDate}
                onChange={(e) => handleInputChange('returnDate', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {searchType === 'flights' ? 'Passengers' : 'Guests'}
            </label>
            <div className="relative">
              <Users size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="number"
                min="1"
                max="9"
                value={searchForm.passengers}
                onChange={(e) => handleInputChange('passengers', parseInt(e.target.value) || 1)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {searchType === 'hotels' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rooms</label>
              <input
                type="number"
                min="1"
                max="5"
                value={searchForm.rooms}
                onChange={(e) => handleInputChange('rooms', parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
        
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Searching...
            </>
          ) : (
            <>
              <Search size={20} className="mr-2" />
              Search {searchType}
            </>
          )}
        </button>
      </div>
    </div>
  ), [searchForm, searchType, isLoading, handleInputChange, handleSearch]);

  // Results component
  const Results = () => {
    // Handle both array and object formats for searchResults
    let results = [];
    
    if (Array.isArray(searchResults)) {
      results = searchResults;
    } else if (searchResults && searchResults.flights && Array.isArray(searchResults.flights)) {
      results = searchResults.flights;
    } else if (searchResults && searchResults.hotels && Array.isArray(searchResults.hotels)) {
      results = searchResults.hotels;
    } else if (searchResults && Array.isArray(searchResults.data)) {
      results = searchResults.data;
    }
    
    console.log('Results component - searchResults type:', typeof searchResults);
    console.log('Results component - searchResults:', searchResults);
    console.log('Results component - results array length:', results.length);
    console.log('Results component - first result:', results[0]);
    
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {searchType === 'flights' ? 'Flight Results' : 'Hotel Results'}
          </h2>
          <div className="flex items-center space-x-4">
            <button className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Filter size={16} className="mr-2" />
              Filter
            </button>
          </div>
        </div>
        
        {results.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              {searchType === 'flights' ? <Plane size={48} /> : <Hotel size={48} />}
            </div>
            <p className="text-gray-600">No results found. Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {results.map((item, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {searchType === 'flights' ? (
                      <div className="flex items-center space-x-4">
                        <div className="text-lg font-semibold">
                          {item.outboundJourney?.segments?.[0]?.departure?.airport || searchForm.origin} → {item.outboundJourney?.segments?.[item.outboundJourney?.segments?.length - 1]?.arrival?.airport || searchForm.destination}
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.outboundJourney?.duration || '2h 30m'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.outboundJourney?.segments?.[0]?.airline || 'Airlines'}
                        </div>
                        {item.outboundJourney?.segments?.[0]?.departure?.time && (
                          <div className="text-sm text-gray-600">
                            Departs: {new Date(item.outboundJourney.segments[0].departure.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-lg font-semibold">{item.hotel?.name || item.name || 'Hotel Name'}</h3>
                        <p className="text-sm text-gray-600">
                          {item.hotel?.address?.lines?.[0] || item.address || searchForm.destination}
                        </p>
                        <div className="flex items-center mt-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={16}
                              className={`${i < (item.hotel?.rating || item.rating || 4) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                            />
                          ))}
                          <span className="ml-2 text-sm text-gray-600">
                            ({item.hotel?.rating || item.rating || 4}.0 stars)
                          </span>
                        </div>
                        {item.hotel?.amenities && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.hotel.amenities.slice(0, 3).map((amenity, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                                {amenity}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        ${item.pricing?.total || item.pricing?.grandTotal || item.price || '299'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {item.pricing?.currency || 'USD'} {searchType === 'flights' ? 'per person' : 'per night'}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleFavorite({ ...item, id: index, type: searchType })}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <Heart
                        size={20}
                        className={`${
                          favorites.some(fav => fav.id === index) 
                            ? 'text-red-500 fill-current' 
                            : 'text-gray-400'
                        }`}
                      />
                    </button>
                    
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                      {searchType === 'flights' ? 'Book Flight' : 'Book Hotel'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Favorites component
  const Favorites = () => (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Your Favorites</h2>
      
      {favorites.length === 0 ? (
        <div className="text-center py-12">
          <Heart size={48} className="text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No favorites yet. Start by searching and adding items to your favorites!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {favorites.map((item, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {item.type === 'flights' ? <Plane size={16} /> : <Hotel size={16} />}
                    <span className="text-sm text-gray-600 capitalize">{item.type}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{item.name || `${item.origin} → ${item.destination}`}</h3>
                  <p className="text-sm text-gray-600">{item.location || item.airline}</p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-600">${item.price}</div>
                  </div>
                  
                  <button
                    onClick={() => toggleFavorite(item)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <Heart size={20} className="text-red-500 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Profile component
  const Profile = () => (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Travel Profile</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  defaultValue={user.name}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Travel Preferences</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Class</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>Economy</option>
                  <option>Premium Economy</option>
                  <option>Business</option>
                  <option>First Class</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Budget Range</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>Under $500</option>
                  <option>$500 - $1000</option>
                  <option>$1000 - $2000</option>
                  <option>$2000+</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t">
          <h3 className="text-lg font-semibold mb-4">Recent Searches</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Plane size={16} />
                <span>Los Angeles → New York</span>
                <span className="text-sm text-gray-600">June 15, 2025</span>
              </div>
              <Clock size={16} className="text-gray-400" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Hotel size={16} />
                <span>Hotels in Paris</span>
                <span className="text-sm text-gray-600">June 10, 2025</span>
              </div>
              <Clock size={16} className="text-gray-400" />
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex space-x-4">
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Save Changes
          </button>
          <button className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-bold text-blue-600">TravelApp</h1>
        <div></div>
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <div className="flex">
        {Sidebar}
        
        <div className="flex-1 lg:ml-0">
          <main className="py-6">
            {activeTab === 'search' && SearchForm}
            {activeTab === 'results' && <Results />}
            {activeTab === 'favorites' && <Favorites />}
            {activeTab === 'profile' && <Profile />}
          </main>
        </div>
      </div>
    </div>
  );
};

export default TravelApp;