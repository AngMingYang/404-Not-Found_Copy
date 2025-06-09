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
      
      // Always try to get response text first
      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (parseError) {
          errorData = { message: responseText };
        }
        
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        throw new Error(`API Error: ${response.status} - ${errorMessage}`);
      }
      
      // Parse JSON response
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        throw new Error('Invalid JSON response from server');
      }
      
      console.log('Parsed response data:', responseData);
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
        // Build query parameters for GET request with multiple fallback strategies
        let cityName = searchForm.destination.trim();
        let country = '';
        
        // Extract country if user typed "City, Country" format
        if (cityName.includes(',')) {
          const parts = cityName.split(',').map(s => s.trim());
          cityName = parts[0];
          country = parts[1];
        }
        
        // Try multiple search strategies
        const searchStrategies = [];
        
        // Strategy 1: Exact city name
        searchStrategies.push({ city: cityName, country, label: 'exact' });
        
        // Strategy 2: Alternative city names (better for hotels)
        const altName = getAlternativeCityName(cityName);
        if (altName && altName !== cityName) {
          searchStrategies.push({ city: altName, country, label: 'alternative' });
        }
        
        // Strategy 3: Without country (sometimes country filtering causes issues)
        if (country) {
          searchStrategies.push({ city: cityName, country: '', label: 'no country' });
        }
        
        // Strategy 4: Try major city codes (only for cities that work well)
        const cityCode = getBetterCityCode(cityName);
        if (cityCode && cityCode !== cityName) {
          searchStrategies.push({ city: cityCode, country, label: 'city code' });
        }
        
        let lastError = null;
        
        // Try each strategy until one works
        for (let i = 0; i < searchStrategies.length; i++) {
          const strategy = searchStrategies[i];
          
          const params = new URLSearchParams({
            city: strategy.city,
            checkIn: searchForm.departDate,
            checkOut: searchForm.returnDate,
            adults: searchForm.passengers.toString(),
            rooms: searchForm.rooms.toString(),
            currency: 'USD',
            max: '20'
          });
          
          if (strategy.country) {
            params.append('country', strategy.country);
          }
          
          endpoint = `/api/hotels/search?${params.toString()}`;
          
          console.log(`Hotel strategy ${i + 1} (${strategy.label}):`, strategy.city, strategy.country ? `in ${strategy.country}` : '');
          
          try {
            results = await apiCall(endpoint, { method: 'GET' });
            console.log(`✅ Strategy ${i + 1} (${strategy.label}) succeeded!`);
            console.log('Raw API response:', results);
            break; // Success, exit loop
          } catch (error) {
            console.log(`❌ Strategy ${i + 1} (${strategy.label}) failed:`, error);
            console.log('Error type:', typeof error);
            console.log('Error constructor:', error.constructor.name);
            console.log('Error message:', error.message);
            console.log('Error stack:', error.stack);
            
            lastError = error;
            
            // If it's not a "city not found" error, don't try other strategies
            if (!error.message?.includes('City not found') && !error.message?.includes('Hotel search service unavailable')) {
              console.log('Non-recoverable error, stopping strategies');
              throw error;
            }
          }
        }
        
        // If all strategies failed, throw the last error
        if (!results) {
          console.error('All hotel search strategies failed. Last error:', lastError);
          throw lastError || new Error('All hotel search strategies failed');
        }
        
        console.log('Hotel search succeeded with results:', results);
      }
      
      function getBetterCityCode(cityName) {
        // Use official Amadeus city codes for hotel searches (from documentation)
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
          'geneva': 'GVA',
          'brussels': 'BRU',
          'stockholm': 'STO',
          'oslo': 'OSL',
          'copenhagen': 'CPH',
          'helsinki': 'HEL',
          'warsaw': 'WAW',
          'prague': 'PRG',
          'budapest': 'BUD',
          'athens': 'ATH',
          'istanbul': 'IST',
          'moscow': 'MOW',
          'dubai': 'DXB',
          'doha': 'DOH',
          'singapore': 'SIN',
          'bangkok': 'BKK',
          'tokyo': 'TYO',
          'osaka': 'OSA',
          'seoul': 'SEL',
          'beijing': 'BJS',
          'shanghai': 'SHA',
          'hong kong': 'HKG',
          'mumbai': 'BOM',
          'delhi': 'DEL',
          'sydney': 'SYD',
          'melbourne': 'MEL',
          'toronto': 'YTO',
          'vancouver': 'YVR',
          'montreal': 'YMQ',
          'los angeles': 'LAX',
          'san francisco': 'SFO',
          'chicago': 'CHI',
          'miami': 'MIA',
          'boston': 'BOS',
          'washington': 'WAS',
          'las vegas': 'LAS',
          'sao paulo': 'SAO',
          'rio de janeiro': 'RIO',
          'buenos aires': 'BUE',
          'mexico city': 'MEX',
          'cairo': 'CAI',
          'casablanca': 'CAS',
          'johannesburg': 'JNB',
          'cape town': 'CPT'
        };
        return cityMappings[cityName.toLowerCase()] || null;
      }
      
      function getAlternativeCityName(cityName) {
        // Keep alternative names but also try without extra descriptors
        const alternatives = {
          'paris': 'Paris',
          'london': 'London', 
          'singapore': 'Singapore',
          'bangkok': 'Bangkok',
          'tokyo': 'Tokyo',
          'new york': 'New York',
          'new york city': 'New York',
          'san francisco': 'San Francisco',
          'los angeles': 'Los Angeles',
          'miami': 'Miami',
          'chicago': 'Chicago',
          'boston': 'Boston',
          'dubai': 'Dubai',
          'hong kong': 'Hong Kong',
          'sydney': 'Sydney',
          'melbourne': 'Melbourne',
          'toronto': 'Toronto',
          'vancouver': 'Vancouver',
          'madrid': 'Madrid',
          'barcelona': 'Barcelona',
          'rome': 'Rome',
          'milan': 'Milan',
          'amsterdam': 'Amsterdam',
          'berlin': 'Berlin'
        };
        return alternatives[cityName.toLowerCase()] || null;
      }

      console.log('Search results:', results);
      
      // Handle different response formats from backend
      let resultsArray = [];
      if (results) {
        console.log('Results type:', typeof results);
        console.log('Results structure:', {
          success: results.success,
          hasData: !!results.data,
          dataType: typeof results.data,
          dataKeys: results.data ? Object.keys(results.data) : null
        });
        
        if (Array.isArray(results)) {
          resultsArray = results;
          console.log('Using results as direct array');
        } else if (results.data && results.data.hotels && Array.isArray(results.data.hotels)) {
          resultsArray = results.data.hotels;
          console.log('Using results.data.hotels as array');
        } else if (results.data && results.data.flights && Array.isArray(results.data.flights)) {
          resultsArray = results.data.flights;
          console.log('Using results.data.flights as array');
        } else if (results.data && Array.isArray(results.data)) {
          resultsArray = results.data;
          console.log('Using results.data as array');
        } else if (results.flights && Array.isArray(results.flights)) {
          resultsArray = results.flights;
          console.log('Using results.flights as array');
        } else if (results.hotels && Array.isArray(results.hotels)) {
          resultsArray = results.hotels;
          console.log('Using results.hotels as array');
        } else {
          console.warn('Unexpected response format:', results);
          console.warn('Available properties:', Object.keys(results || {}));
          if (results.data) {
            console.warn('Data properties:', Object.keys(results.data || {}));
          }
          resultsArray = [];
        }
      } else {
        console.error('Results is null/undefined:', results);
        resultsArray = [];
      }
      
      console.log('Final processed results array:', resultsArray);
      console.log('Results array length:', resultsArray.length);
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
    <div className="min-h-screen relative">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('data:image/svg+xml,${encodeURIComponent(`
            <svg width="1200" height="600" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#a8e6cf;stop-opacity:1" />
                  <stop offset="50%" style="stop-color:#7fcdcd;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#4a90b5;stop-opacity:1" />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#grad1)"/>
              <!-- Pool/Resort Elements -->
              <rect x="800" y="300" width="300" height="200" fill="#4a9eff" opacity="0.6" rx="20"/>
              <rect x="50" y="400" width="200" height="150" fill="#6b5b95" opacity="0.3" rx="10"/>
              <rect x="300" y="450" width="180" height="120" fill="#88d8b0" opacity="0.4" rx="15"/>
              <circle cx="950" cy="150" r="80" fill="#ffb347" opacity="0.3"/>
              <path d="M100,500 Q200,450 300,500 T500,500" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.4"/>
            </svg>
          `)}`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600/20 via-blue-700/30 to-slate-800/40"></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10 px-6 pt-20 pb-32">
        <div className="max-w-6xl mx-auto">
          {/* Hero Title */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight">
              {searchType === 'hotels' ? 'Find your place to stay' : 'Find your perfect flight'}
            </h1>
          </div>
          
          {/* Search Card */}
          <div className="bg-slate-900/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10">
            {/* Tab Selector */}
            <div className="flex bg-slate-800 rounded-xl p-2 mb-8 max-w-md">
              <button
                onClick={() => setSearchType('flights')}
                className={`flex-1 px-6 py-3 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
                  searchType === 'flights' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-gray-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Plane size={18} />
                <span className="font-medium">Flights</span>
              </button>
              <button
                onClick={() => setSearchType('hotels')}
                className={`flex-1 px-6 py-3 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
                  searchType === 'hotels' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-gray-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Hotel size={18} />
                <span className="font-medium">Hotels</span>
              </button>
            </div>
            
            {searchType === 'hotels' ? (
              // Hotel Search Layout
              <div className="space-y-6">
                {/* Main Search Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Destination */}
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-white mb-2">
                      Where do you want to stay?
                    </label>
                    <div className="relative">
                      <MapPin size={18} className="absolute left-4 top-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Enter destination or hotel name"
                        value={searchForm.destination}
                        onChange={(e) => handleInputChange('destination', e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white/95 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 font-medium"
                      />
                    </div>
                  </div>
                  
                  {/* Check-in */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Check-in</label>
                    <div className="relative">
                      <Calendar size={18} className="absolute left-4 top-4 text-gray-400 z-10" />
                      <input
                        type="date"
                        value={searchForm.departDate}
                        onChange={(e) => handleInputChange('departDate', e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white/95 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
                      />
                    </div>
                  </div>
                  
                  {/* Check-out */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Check-out</label>
                    <div className="relative">
                      <Calendar size={18} className="absolute left-4 top-4 text-gray-400 z-10" />
                      <input
                        type="date"
                        value={searchForm.returnDate}
                        onChange={(e) => handleInputChange('returnDate', e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white/95 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
                      />
                    </div>
                  </div>
                  
                  {/* Guests and Rooms */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Guests and rooms</label>
                    <div className="relative">
                      <Users size={18} className="absolute left-4 top-4 text-gray-400" />
                      <select
                        value={`${searchForm.passengers} adults, ${searchForm.rooms} room`}
                        onChange={(e) => {
                          // Parse the selected value - simplified for demo
                          const adults = parseInt(e.target.value.split(' ')[0]);
                          const rooms = parseInt(e.target.value.split(', ')[1].split(' ')[0]);
                          handleInputChange('passengers', adults);
                          handleInputChange('rooms', rooms);
                        }}
                        className="w-full pl-12 pr-4 py-3 bg-white/95 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium appearance-none"
                      >
                        <option>1 adults, 1 room</option>
                        <option>2 adults, 1 room</option>
                        <option>3 adults, 1 room</option>
                        <option>4 adults, 1 room</option>
                        <option>2 adults, 2 room</option>
                        <option>4 adults, 2 room</option>
                      </select>
                      <div className="absolute right-4 top-4 pointer-events-none">
                        <ChevronRight size={18} className="text-gray-400 rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Popular Filters */}
                <div className="flex items-center space-x-6">
                  <span className="text-white font-medium">Popular filters:</span>
                  <label className="flex items-center space-x-2 text-white hover:text-blue-300 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span>Free cancellation</span>
                  </label>
                  <label className="flex items-center space-x-2 text-white hover:text-blue-300 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span>4 stars</span>
                  </label>
                  <label className="flex items-center space-x-2 text-white hover:text-blue-300 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span>3 stars</span>
                  </label>
                </div>
                
                {/* Search Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <span>Search hotels</span>
                        <ChevronRight size={20} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              // Flight Search Layout (simplified)
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">From</label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-4 top-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Origin city or airport"
                      value={searchForm.origin}
                      onChange={(e) => handleInputChange('origin', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white/95 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 font-medium"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">To</label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-4 top-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Destination city or airport"
                      value={searchForm.destination}
                      onChange={(e) => handleInputChange('destination', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white/95 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 font-medium"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Departure</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-4 top-4 text-gray-400 z-10" />
                    <input
                      type="date"
                      value={searchForm.departDate}
                      onChange={(e) => handleInputChange('departDate', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white/95 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Return</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-4 top-4 text-gray-400 z-10" />
                    <input
                      type="date"
                      value={searchForm.returnDate}
                      onChange={(e) => handleInputChange('returnDate', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white/95 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
                    />
                  </div>
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search size={20} />
                        <span>Search</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ), [searchForm, searchType, isLoading, handleInputChange, handleSearch]);

  // Results component
  const Results = () => {
    // Handle both array and object formats for searchResults
    let results = [];
    
    console.log('Results component - searchResults:', searchResults);
    console.log('Results component - searchResults type:', typeof searchResults);
    
    if (Array.isArray(searchResults)) {
      results = searchResults;
      console.log('Using searchResults as direct array');
    } else if (searchResults && searchResults.flights && Array.isArray(searchResults.flights)) {
      results = searchResults.flights;
      console.log('Using searchResults.flights');
    } else if (searchResults && searchResults.hotels && Array.isArray(searchResults.hotels)) {
      results = searchResults.hotels;
      console.log('Using searchResults.hotels');
    } else if (searchResults && searchResults.data && Array.isArray(searchResults.data)) {
      results = searchResults.data;
      console.log('Using searchResults.data');
    } else if (searchResults && Array.isArray(searchResults.data)) {
      results = searchResults.data;
      console.log('Using searchResults.data (fallback)');
    } else {
      console.warn('Could not extract results array from:', searchResults);
      results = [];
    }
    
    console.log('Final results for display:', results);
    console.log('Results array length:', results.length);
    
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
                      <div className="space-y-6">
                        {/* Main Flight Display - Prominent Layout */}
                        <div className="bg-slate-800 text-white p-6 rounded-xl">
                          {/* Header - Route and Duration */}
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-4">
                              <div className="text-3xl font-bold tracking-wide">
                                {item.outboundJourney?.segments?.[0]?.departure?.airport || searchForm.origin}
                              </div>
                              <Plane size={24} className="text-green-400" />
                              <div className="text-3xl font-bold tracking-wide">
                                {item.outboundJourney?.segments?.[item.outboundJourney?.segments?.length - 1]?.arrival?.airport || searchForm.destination}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg text-gray-300">
                                {item.outboundJourney?.duration || '2h 30m'}
                              </div>
                              <div className={`text-sm px-3 py-1 rounded-full mt-1 ${
                                (item.outboundJourney?.segments?.length || 1) === 1 ? 
                                'bg-green-600 text-green-100' : 'bg-orange-600 text-orange-100'
                              }`}>
                                {(item.outboundJourney?.segments?.length || 1) === 1 ? 
                                  'Direct' : `${(item.outboundJourney?.segments?.length || 1) - 1} stop${(item.outboundJourney?.segments?.length || 1) > 2 ? 's' : ''}`
                                }
                              </div>
                            </div>
                          </div>
                          
                          {/* Flight Details - Large Format */}
                          <div className="grid grid-cols-2 gap-8">
                            {/* Departure */}
                            <div>
                              <div className="text-sm text-gray-400 mb-1">
                                {searchForm.origin === 'LAX' ? 'Los Angeles' : 
                                 searchForm.origin === 'JFK' ? 'New York' : 
                                 searchForm.origin === 'LHR' ? 'London' : 
                                 searchForm.origin || 'Departure City'} • {new Date(searchForm.departDate || Date.now()).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </div>
                              <div className="text-sm text-gray-300 mb-2">Scheduled departure</div>
                              <div className="text-5xl font-bold mb-2">
                                {item.outboundJourney?.segments?.[0]?.departure?.time ? 
                                  new Date(item.outboundJourney.segments[0].departure.time).toLocaleTimeString([], {
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: false
                                  }) : '6:03 pm'
                                }
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-300">
                                <span>Terminal</span>
                                <span className="text-white font-bold text-lg">
                                  {item.outboundJourney?.segments?.[0]?.departure?.terminal || 'E'}
                                </span>
                                <span>Gate</span>
                                <span className="text-white font-bold text-lg">
                                  {item.outboundJourney?.segments?.[0]?.departure?.gate || 'E10'}
                                </span>
                              </div>
                            </div>
                            
                            {/* Arrival */}
                            <div>
                              <div className="text-sm text-gray-400 mb-1">
                                {searchForm.destination === 'LAX' ? 'Los Angeles' : 
                                 searchForm.destination === 'JFK' ? 'New York' : 
                                 searchForm.destination === 'LHR' ? 'London' : 
                                 searchForm.destination || 'Arrival City'} • {new Date(searchForm.departDate || Date.now()).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </div>
                              <div className="text-sm text-gray-300 mb-2">Scheduled arrival</div>
                              <div className="text-5xl font-bold mb-2">
                                {item.outboundJourney?.segments?.[item.outboundJourney?.segments?.length - 1]?.arrival?.time ? 
                                  new Date(item.outboundJourney.segments[item.outboundJourney.segments.length - 1].arrival.time).toLocaleTimeString([], {
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: false
                                  }) : '7:12 pm'
                                }
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-300">
                                <span>Terminal</span>
                                <span className="text-white font-bold text-lg">
                                  {item.outboundJourney?.segments?.[item.outboundJourney?.segments?.length - 1]?.arrival?.terminal || '-'}
                                </span>
                                <span>Gate</span>
                                <span className="text-white font-bold text-lg">
                                  {item.outboundJourney?.segments?.[item.outboundJourney?.segments?.length - 1]?.arrival?.gate || '210'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Flight Info Footer */}
                          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-600">
                            <div className="flex items-center space-x-6">
                              <div>
                                <span className="text-sm text-gray-400">Flight</span>
                                <span className="ml-2 text-white font-bold">
                                  {item.outboundJourney?.segments?.[0]?.airline || 'AA'} {item.outboundJourney?.segments?.[0]?.flightNumber || '1234'}
                                </span>
                              </div>
                              <div>
                                <span className="text-sm text-gray-400">Aircraft</span>
                                <span className="ml-2 text-white">
                                  {item.outboundJourney?.segments?.[0]?.aircraft || 'Boeing 737'}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm text-gray-400">
                              Updated {Math.floor(Math.random() * 3) + 1}h {Math.floor(Math.random() * 60)}m ago
                            </div>
                          </div>
                        </div>
                        
                        {/* Layover Information (if applicable) */}
                        {item.outboundJourney?.segments && item.outboundJourney.segments.length > 1 && (
                          <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg">
                            <div className="flex items-center space-x-2 text-orange-800 font-medium mb-2">
                              <Clock size={16} />
                              <span>Connection Required</span>
                            </div>
                            {item.outboundJourney.segments.slice(0, -1).map((segment, index) => (
                              <div key={index} className="text-sm text-orange-700">
                                Layover in {segment.arrival?.airport} • Terminal {segment.arrival?.terminal || 'TBD'}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Service Information - Compact Cards */}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="text-xs font-medium text-green-800 mb-1">BAGGAGE</div>
                            <div className="text-sm font-bold text-green-900">Carry-on ✓</div>
                            <div className="text-xs text-green-600">Checked extra</div>
                          </div>
                          
                          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-xs font-medium text-blue-800 mb-1">SEATS</div>
                            <div className="text-sm font-bold text-blue-900">Standard ✓</div>
                            <div className="text-xs text-blue-600">Premium extra</div>
                          </div>
                          
                          <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="text-xs font-medium text-purple-800 mb-1">MEALS</div>
                            <div className="text-sm font-bold text-purple-900">
                              {item.outboundJourney?.duration && 
                               parseInt(item.outboundJourney.duration.match(/(\d+)H/)?.[1] || 0) >= 3 ? 
                                'Included ✓' : 'Snacks ✓'
                              }
                            </div>
                            <div className="text-xs text-purple-600">Complimentary</div>
                          </div>
                          
                          <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-xs font-medium text-gray-800 mb-1">CLASS</div>
                            <div className="text-sm font-bold text-gray-900">{item.travelClass || 'Economy'}</div>
                            <div className="text-xs text-gray-600">{item.pricing?.fareType || 'Standard'}</div>
                          </div>
                        </div>
                        
                        {/* Return Flight (if applicable) */}
                        {item.inboundJourney && (
                          <div className="bg-slate-700 text-white p-4 rounded-xl">
                            <div className="text-sm text-gray-300 mb-3">Return Flight</div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="text-2xl font-bold">
                                  {item.inboundJourney.segments?.[0]?.departure?.airport}
                                </div>
                                <Plane size={16} className="text-green-400" />
                                <div className="text-2xl font-bold">
                                  {item.inboundJourney.segments?.[item.inboundJourney.segments.length - 1]?.arrival?.airport}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold">
                                  {item.inboundJourney.segments?.[0]?.departure?.time ? 
                                    new Date(item.inboundJourney.segments[0].departure.time).toLocaleTimeString([], {
                                      hour: '2-digit', 
                                      minute: '2-digit',
                                      hour12: false
                                    }) : '3:45 pm'
                                  }
                                </div>
                                <div className="text-sm text-gray-300">
                                  {item.inboundJourney.segments?.[0]?.airline} {item.inboundJourney.segments?.[0]?.flightNumber}
                                </div>
                              </div>
                            </div>
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