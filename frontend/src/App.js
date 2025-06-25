import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Calendar, Users, Plane, Hotel, Star, Clock, Filter, Menu, X, ChevronRight, Globe, Heart, User, ChevronDown } from 'lucide-react';




const TravelApp = () => {
  const [activeTab, setActiveTab] = useState('search');
  const [searchType, setSearchType] = useState('flights');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortWeight, setSortWeight] = useState(50);

  
  // Filter state
  const [filters, setFilters] = useState({
    priceRange: [0, 5000],
    stops: 'any',
    airlines: [],
    departureTime: 'any',
    duration: 'any'
  });
  
  const [user] = useState({ id: 'user123', name: 'Travel Explorer' });
  
  // Search form state
  const [searchForm, setSearchForm] = useState({
    origin: '',
    destination: '',
    departDate: '',
    returnDate: '',
    passengers: 1,
    rooms: 1,
    budget: '',
    preferences: []
  });

  // API base URL
  const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:8080' 
    : 'https://your-api-domain.com';

  // Helper functions
  const getAirlineName = (code) => {
    const airlines = {
      'AA': 'American Airlines', 'DL': 'Delta Air Lines', 'UA': 'United Airlines',
      'WN': 'Southwest Airlines', 'AS': 'Alaska Airlines', 'B6': 'JetBlue Airways',
      'NK': 'Spirit Airlines', 'F9': 'Frontier Airlines', 'LH': 'Lufthansa',
      'BA': 'British Airways', 'AF': 'Air France', 'KL': 'KLM', 'EK': 'Emirates',
      'QR': 'Qatar Airways', 'TK': 'Turkish Airlines', 'SQ': 'Singapore Airlines'
    };
    return airlines[code] || code;
  };

  const formatDuration = (duration) => {
    if (!duration) return 'Duration TBD';
    const match = duration.match(/PT(\d+H)?(\d+M)?/);
    if (!match) return duration;
    
    const hours = match[1] ? match[1].replace('H', 'h ') : '';
    const minutes = match[2] ? match[2].replace('M', 'm') : '';
    return (hours + minutes).trim() || duration;
  };

  // API call function
  const apiCall = useCallback(async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText };
        }
        throw new Error(`API Error: ${response.status} - ${errorData.message || errorData.error}`);
      }
      
      return JSON.parse(responseText);
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }, [API_BASE]);

  // Input change handler
  const handleInputChange = useCallback((field, value) => {
    setSearchForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // Filter change handler
  const handleFilterChange = useCallback((filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  }, []);

  // Apply filters
  /*
  const filteredResults = searchResults.filter(item => {
    if (searchType === 'flights') {
      const price = parseFloat(item.pricing?.total || item.pricing?.grandTotal || item.price || 0);
      if (price < filters.priceRange[0] || price > filters.priceRange[1]) return false;
      
      const stops = item.outboundJourney?.segments?.length - 1 || 0;
      if (filters.stops === 'direct' && stops > 0) return false;
      if (filters.stops === '1stop' && stops !== 1) return false;
    }
    return true;
  });*/
  const filteredResults = [...searchResults]
  .filter(item => {
    if (searchType !== 'flights') return true;

    const price = parseFloat(item.pricing?.total || item.pricing?.grandTotal || item.price || 0);
    const durationStr = item.outboundJourney?.duration || '';
    const match = durationStr.match(/PT(\d+H)?(\d+M)?/);
    const hours = match?.[1] ? parseInt(match[1]) : 0;
    const minutes = match?.[2] ? parseInt(match[2]) : 0;
    const durationMins = hours * 60 + minutes;

    if (price < filters.priceRange[0] || price > filters.priceRange[1]) return false;
    const stops = item.outboundJourney?.segments?.length - 1 || 0;
    if (filters.stops === 'direct' && stops > 0) return false;
    if (filters.stops === '1stop' && stops !== 1) return false;
    return true;
  })
  .sort((a, b) => {
    if (searchType !== 'flights') return 0;

    const getPrice = (item) => parseFloat(item.pricing?.total || item.pricing?.grandTotal || item.price || 0);
    const getDuration = (item) => {
      const match = item.outboundJourney?.duration?.match(/PT(\d+H)?(\d+M)?/);
      const hours = match?.[1] ? parseInt(match[1]) : 0;
      const minutes = match?.[2] ? parseInt(match[2]) : 0;
      return hours * 60 + minutes;
    };

    const aPrice = getPrice(a), bPrice = getPrice(b);
    const aDur = getDuration(a), bDur = getDuration(b);

    const weight = sortWeight / 100;
    const aScore = aPrice * (1 - weight) + aDur * weight;
    const bScore = bPrice * (1 - weight) + bDur * weight;

    return aScore - bScore;
  });


  // Search function
  const handleSearch = useCallback(async () => {
    if (searchType === 'flights') {
      if (!searchForm.origin || !searchForm.destination) {
        alert('Please enter both origin and destination for flight search');
        return;
      }
    } else if (searchType === 'hotels') {
      if (!searchForm.destination || !searchForm.departDate || !searchForm.returnDate) {
        alert('Please enter destination and dates for hotel search');
        return;
      }
    }

    setIsLoading(true);
    try {
      let endpoint = '';
      let results;
      
      if (searchType === 'flights') {
        const params = new URLSearchParams({
          origin: searchForm.origin,
          destination: searchForm.destination,
          departureDate: searchForm.departDate,
          adults: searchForm.passengers.toString(),
          max: '10'
        });
        
        if (searchForm.returnDate) {
          params.append('returnDate', searchForm.returnDate);
        }
        
        endpoint = `/api/flights/search?${params.toString()}`;
        results = await apiCall(endpoint, { method: 'GET' });
        
      } else if (searchType === 'hotels') {
        let cityName = searchForm.destination.trim();
        let country = '';
        
        if (cityName.includes(',')) {
          const parts = cityName.split(',').map(s => s.trim());
          cityName = parts[0];
          country = parts[1];
        }
        
        const params = new URLSearchParams({
          city: cityName,
          checkIn: searchForm.departDate,
          checkOut: searchForm.returnDate,
          adults: searchForm.passengers.toString(),
          rooms: searchForm.rooms.toString(),
          currency: 'USD',
          max: '20'
        });
        
        if (country) params.append('country', country);
        
        endpoint = `/api/hotels/search?${params.toString()}`;
        results = await apiCall(endpoint, { method: 'GET' });
      }

      // Process results
      let resultsArray = [];
      if (results?.success) {
        if (searchType === 'flights') {
          if (results.data?.flights && Array.isArray(results.data.flights)) {
            resultsArray = results.data.flights;
          } else if (Array.isArray(results.data)) {
            resultsArray = results.data;
          } else if (Array.isArray(results.flights)) {
            resultsArray = results.flights;
          }
        } else if (searchType === 'hotels') {
          if (results.data?.hotels && Array.isArray(results.data.hotels)) {
            resultsArray = results.data.hotels;
          } else if (Array.isArray(results.data)) {
            resultsArray = results.data;
          }
        }
      }
      
      // Add unique IDs
      const resultsWithIds = resultsArray.map((item, index) => ({
        ...item,
        uniqueId: item.id || `${searchType}-${index}-${Date.now()}`
      }));
      
      setSearchResults(resultsWithIds);
      setActiveTab('results');

    } catch (error) {
      console.error('Search failed:', error);
      alert(`Search failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [searchForm, searchType, apiCall]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (item) => {
    try {
      const itemId = item.uniqueId || item.id;
      const isFavorite = favorites.some(fav => fav.id === itemId);
      
      if (isFavorite) {
        setFavorites(prev => prev.filter(fav => fav.id !== itemId));
      } else {
        setFavorites(prev => [...prev, { ...item, id: itemId }]);
      }
    } catch (error) {
      console.error('Failed to update favorites:', error);
    }
  }, [favorites]);

  // Load user data
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

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0`}>
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <h1 className="text-xl font-bold text-blue-600">TravelApp</h1>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X size={24} />
            </button>
          </div>
          
          <nav className="mt-8">
            <div className="px-4 space-y-2">
              {['search', 'results', 'favorites', 'profile'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                    activeTab === tab ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab === 'search' && <Search size={20} className="mr-3" />}
                  {tab === 'results' && <Globe size={20} className="mr-3" />}
                  {tab === 'favorites' && <Heart size={20} className="mr-3" />}
                  {tab === 'profile' && <User size={20} className="mr-3" />}
                  <span className="capitalize">{tab}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>
        
        <div className="flex-1 lg:ml-0">
          <main className="py-6">
            {/* Search Tab */}
            {activeTab === 'search' && (
              <div className="min-h-screen relative">
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
                
                <div className="relative z-10 px-6 pt-20 pb-32">
                  <div className="max-w-6xl mx-auto">
                    <div className="mb-12">
                      <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight">
                        {searchType === 'hotels' ? 'Find your place to stay' : 'Find your perfect flight'}
                      </h1>
                    </div>
                    
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
                      
                      {/* Search Form */}
                      {searchType === 'flights' ? (
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
                      ) : (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1">
                              <label className="block text-sm font-medium text-white mb-2">Where do you want to stay?</label>
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
                            
                            <div>
                              <label className="block text-sm font-medium text-white mb-2">Guests and rooms</label>
                              <div className="relative">
                                <Users size={18} className="absolute left-4 top-4 text-gray-400" />
                                <select
                                  value={`${searchForm.passengers} adults, ${searchForm.rooms} room`}
                                  onChange={(e) => {
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
                              </div>
                            </div>
                          </div>
                          
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
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Tab */}
            {activeTab === 'results' && (
              <div className="max-w-6xl mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {searchType === 'flights' ? 'Flight Results' : 'Hotel Results'} ({filteredResults.length})
                  </h2>
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Filter size={16} className="mr-2" />
                      Filter
                      <ChevronDown size={16} className={`ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
                
                {/* Filter Panel */}

                
                
                {showFilters && (
                  <div className="bg-white rounded-lg shadow-md p-6 mb-6 border">
                    <h3 className="text-lg font-semibold mb-4">Filters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Price Range: ${filters.priceRange[0]} - ${filters.priceRange[1]}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="5000"
                          step="100"
                          value={filters.priceRange[1]}
                          onChange={(e) => handleFilterChange('priceRange', [filters.priceRange[0], parseInt(e.target.value)])}
                          className="w-full"
                        />
                      </div>
                      
                      {searchType === 'flights' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Stops</label>
                              <select
                                value={filters.stops}
                                onChange={(e) => handleFilterChange('stops', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="any">Any number of stops</option>
                                <option value="direct">Direct flights only</option>
                                <option value="1stop">1 stop maximum</option>
                              </select>
                            </div>

                            {/* 👉 New Slider */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Balance (Price vs Duration ): {sortWeight}%
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={sortWeight}
                                onChange={(e) => setSortWeight(parseInt(e.target.value))}
                                className="w-full"
                              />
                              <div className="text-sm text-gray-500 mt-1">
                                {sortWeight < 50
                                  ? `Prioritize Price (${100 - sortWeight}%)`
                                  : sortWeight > 50
                                  ? `Prioritize Duration (${sortWeight}%)`
                                  : 'Equal Priority'}
                              </div>
                            </div>
                          </>
                        )}

                      
                      <div className="flex items-end">
                        <button
                          onClick={() => setFilters({
                            priceRange: [0, 5000],
                            stops: 'any',
                            airlines: [],
                            departureTime: 'any',
                            duration: 'any'
                          })}
                          className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {filteredResults.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4 flex justify-center">
                      {searchType === 'flights' ? <Plane size={48} /> : <Hotel size={48} />}
                    </div>
                    <p className="text-gray-600">No results found. Try adjusting your search criteria or filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredResults.map((item, index) => (
                      <div key={item.uniqueId || `result-${index}`} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {searchType === 'flights' ? (
                              <div className="space-y-4">
                                {/* Flight Header */}
                                <div className="flex items-center justify-between border-b pb-2">
                                  <div className="text-sm text-gray-600">Flight {index + 1} of {filteredResults.length}</div>
                                  <div className="text-sm text-gray-500">ID: {item.id || item.uniqueId}</div>
                                </div>
                                
                                {/* Flight Route */}
                                <div className="bg-slate-800 text-white p-4 rounded-lg">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="text-right">
                                      <div className="text-lg text-gray-300">
                                        {formatDuration(item.outboundJourney?.duration)}
                                      </div>
                                      <div className={`text-sm px-3 py-1 rounded-full mt-1 ${
                                        (item.outboundJourney?.segments?.length || 0) <= 1 ? 
                                        'bg-green-600 text-green-100' : 'bg-orange-600 text-orange-100'
                                      }`}>
                                        {(item.outboundJourney?.segments?.length || 0) <= 1 ? 
                                          'Direct' : `${(item.outboundJourney?.segments?.length || 1) - 1} stop${(item.outboundJourney?.segments?.length || 1) > 2 ? 's' : ''}`
                                        }
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Flight Times */}
                                  <div className="grid grid-cols-2 gap-6">
                                    <div>
                                      <div className="text-sm text-gray-400 mb-1">
                                        {item.outboundJourney?.segments?.[0]?.departure?.airport || 'XXX'} • {
                                          item.outboundJourney?.segments?.[0]?.departure?.time ? 
                                          new Date(item.outboundJourney.segments[0].departure.time).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) :
                                          'Date TBD'
                                        }
                                      </div>
                                      <div className="text-sm text-gray-300 mb-2">Departure</div>
                                      <div className="text-3xl font-bold mb-2">
                                        {item.outboundJourney?.segments?.[0]?.departure?.time ? 
                                          new Date(item.outboundJourney.segments[0].departure.time).toLocaleTimeString([], {
                                            hour: '2-digit', 
                                            minute: '2-digit',
                                            hour12: true
                                          }) : 'Time TBD'
                                        }
                                      </div>
                                      <div className="text-sm text-gray-300">
                                        Terminal {item.outboundJourney?.segments?.[0]?.departure?.terminal || 'TBD'}
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <div className="text-sm text-gray-400 mb-1">
                                        {item.outboundJourney?.segments?.[item.outboundJourney?.segments?.length - 1]?.arrival?.airport || 'XXX'} • {
                                          item.outboundJourney?.segments?.[item.outboundJourney?.segments?.length - 1]?.arrival?.time ? 
                                          new Date(item.outboundJourney.segments[item.outboundJourney.segments.length - 1].arrival.time).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) :
                                          'Date TBD'
                                        }
                                      </div>
                                      <div className="text-sm text-gray-300 mb-2">Arrival</div>
                                      <div className="text-3xl font-bold mb-2">
                                        {item.outboundJourney?.segments?.[item.outboundJourney?.segments?.length - 1]?.arrival?.time ? 
                                          new Date(item.outboundJourney.segments[item.outboundJourney.segments.length - 1].arrival.time).toLocaleTimeString([], {
                                            hour: '2-digit', 
                                            minute: '2-digit',
                                            hour12: true
                                          }) : 'Time TBD'
                                        }
                                      </div>
                                      <div className="text-sm text-gray-300">
                                        Terminal {item.outboundJourney?.segments?.[item.outboundJourney?.segments?.length - 1]?.arrival?.terminal || 'TBD'}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Airline Info */}
                                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-600">
                                    <div className="flex items-center space-x-6">
                                      <div>
                                        <span className="text-sm text-gray-400">Airline</span>
                                        <span className="ml-2 text-white font-bold">
                                          {getAirlineName(item.outboundJourney?.segments?.[0]?.airline)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-sm text-gray-400">Flight</span>
                                        <span className="ml-2 text-white font-bold">
                                          {item.outboundJourney?.segments?.[0]?.airline || 'XX'} {item.outboundJourney?.segments?.[0]?.flightNumber || '0000'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-sm text-gray-400">Aircraft</span>
                                        <span className="ml-2 text-white">
                                          {item.outboundJourney?.segments?.[0]?.aircraft || 'Aircraft TBD'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Service Information */}
                                <div className="grid grid-cols-4 gap-3">
                                  <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                                    <div className="text-xs font-medium text-green-800 mb-1">BAGGAGE</div>
                                    <div className="text-sm font-bold text-green-900">
                                      {item.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.includedCheckedBags?.quantity > 0 ? 
                                        `${item.travelerPricings[0].fareDetailsBySegment[0].includedCheckedBags.quantity} checked ✓` : 
                                        'Carry-on only ✓'
                                      }
                                    </div>
                                    <div className="text-xs text-green-600">
                                      {item.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.includedCheckedBags?.weight ? 
                                        `${item.travelerPricings[0].fareDetailsBySegment[0].includedCheckedBags.weight}kg included` :
                                        'Checked bags extra'
                                      }
                                    </div>
                                  </div>
                                  
                                  <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="text-xs font-medium text-blue-800 mb-1">SEATS</div>
                                    <div className="text-sm font-bold text-blue-900">
                                      {item.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || 'Standard'} ✓
                                    </div>
                                    <div className="text-xs text-blue-600">Premium seats extra</div>
                                  </div>
                                  
                                  <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                                    <div className="text-xs font-medium text-purple-800 mb-1">MEALS</div>
                                    <div className="text-sm font-bold text-purple-900">
                                      {formatDuration(item.outboundJourney?.duration).includes('h') &&
                                       parseInt(formatDuration(item.outboundJourney?.duration).match(/(\d+)h/)?.[1] || 0) >= 3 ? 
                                        'Meal service ✓' : 'Snacks ✓'
                                      }
                                    </div>
                                    <div className="text-xs text-purple-600">Complimentary drinks</div>
                                  </div>
                                  
                                  <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="text-xs font-medium text-gray-800 mb-1">CLASS</div>
                                    <div className="text-sm font-bold text-gray-900">
                                      {item.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || 'Economy'}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {item.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.fareBasis || 'Standard fare'}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Return Flight */}
                                {item.inboundJourney && (
                                  <div className="bg-slate-700 text-white p-4 rounded-lg">
                                    <div className="text-sm text-gray-300 mb-3">Return Flight</div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-4">
                                        <div className="text-xl font-bold">
                                          {item.inboundJourney.segments?.[0]?.departure?.airport || 'XXX'}
                                        </div>
                                        <Plane size={16} className="text-green-400" />
                                        <div className="text-xl font-bold">
                                          {item.inboundJourney.segments?.[item.inboundJourney.segments.length - 1]?.arrival?.airport || 'XXX'}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-xl font-bold">
                                          {item.inboundJourney.segments?.[0]?.departure?.time ? 
                                            new Date(item.inboundJourney.segments[0].departure.time).toLocaleTimeString([], {
                                              hour: '2-digit', 
                                              minute: '2-digit',
                                              hour12: true
                                            }) : 'Time TBD'
                                          }
                                        </div>
                                        <div className="text-sm text-gray-300">
                                          {getAirlineName(item.inboundJourney.segments?.[0]?.airline)} {item.inboundJourney.segments?.[0]?.flightNumber}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              // Hotel display
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
                              onClick={() => toggleFavorite(item)}
                              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                            >
                              <Heart
                                size={20}
                                className={`${
                                  favorites.some(fav => fav.id === (item.uniqueId || item.id)) 
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
            )}

            {/* Favorites Tab */}
            {activeTab === 'favorites' && (
              <div className="max-w-6xl mx-auto p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Your Favorites</h2>
                
                {favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart size={48} className="text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No favorites yet. Start by searching and adding items to your favorites!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {favorites.map((item, index) => (
                      <div key={`fav-${index}`} className="bg-white rounded-lg shadow-md p-6">
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
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
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
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default TravelApp;