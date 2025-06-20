# TravelApp - Flight & Hotel Search Platform

A modern travel planning application that allows users to search for flights and hotels, save favorites, and manage their travel preferences. Built for Team 404 Not Found's SummerBuild 2025 Hackathon project.

## 🚀 Features

### Core Functionality
- **Flight Search**: Search for flights between airports with departure/return dates
- **Hotel Search**: Find hotels by destination with check-in/check-out dates
- **Favorites System**: Save and manage favorite flights and hotels
- **User Profiles**: Manage travel preferences and personal information
- **Search History**: Track previous searches for easy access
- **Responsive Design**: Works on desktop and mobile devices

### Search Capabilities
- Real-time flight and hotel availability
- Filter by price, stops, airlines, and departure times
- Display detailed flight information (duration, stops, airline details)
- Show hotel ratings, amenities, and pricing

## 🏗️ Architecture

### Frontend (React)
- **Location**: [`frontend/`](frontend/)
- **Main Component**: [`src/App.js`](frontend/src/App.js)
- **Technologies**: React, Tailwind CSS, Lucide Icons
- **Port**: 3000 (development)

### Backend (Node.js/Express)
- **Location**: [`backend/`](backend/)
- **Main Server**: [`server.js`](backend/server.js)
- **Technologies**: Express.js, Supabase, Amadeus API
- **Port**: 8080 (default)

## 📁 Project Structure

```
summerbuild2025/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── App.js           # Main application component
│   │   ├── index.js         # React entry point
│   │   └── App.test.js      # Test file
│   ├── public/              # Static files
│   └── package.json         # Frontend dependencies
│
├── backend/                 # Node.js backend API
│   ├── server.js           # Main server file
│   ├── server-minimal.js   # Minimal server for testing
│   ├── test-server.js      # Test server configuration
│   ├── controllers/        # API controllers
│   │   ├── flightController.js
│   │   ├── hotelController.js
│   │   ├── routeController.js
│   │   └── userController.js
│   ├── routes/             # API routes
│   │   ├── flights.js
│   │   ├── hotels.js
│   │   ├── routes.js
│   │   └── users.js
│   ├── services/           # External service integrations
│   │   ├── amadeusService.js
│   │   ├── supabaseService.js
│   │   ├── cacheService.js
│   │   └── routeCalculatorService.js
│   └── utils/              # Utility functions
│       └── envChecker.js
│
└── README.md               # This file
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Amadeus API credentials (optional, for full functionality)
- Supabase project (optional, for data persistence)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
PORT=8080
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
AMADEUS_CLIENT_ID=your_amadeus_client_id
AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
```

5. Start the backend server:
```bash
npm start
# or for development with auto-reload
npm run dev
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`

## 🌐 API Endpoints

### Flight Routes
- `GET /api/flights/search` - Search for flights
- `GET /api/flights/offers` - Get flight offers
- `GET /api/flights/airports` - Airport reference data

### Hotel Routes
- `GET /api/hotels/search` - Search for hotels
- `GET /api/hotels/location` - Hotels near coordinates
- `GET /api/hotels/city/{city}` - Hotels in specific city

### User Routes
- `GET /api/users/{id}/locations` - User saved locations
- `POST /api/users/{id}/locations` - Save user location
- `GET /api/users/{id}/favorites` - User favorites
- `POST /api/users/{id}/favorites` - Add to favorites
- `GET /api/users/{id}/profile` - User profile
- `PUT /api/users/{id}/profile` - Update user profile

### System Routes
- `GET /health` - Health check
- `GET /api` - API documentation
- `GET /test` - Server test endpoint

## 🔧 Configuration

### Environment Variables

The application uses the following environment variables:

#### Backend ([`backend/.env`](backend/.env))
```env
PORT=8080                    # Server port
NODE_ENV=development         # Environment mode
SUPABASE_URL=               # Supabase project URL
SUPABASE_ANON_KEY=          # Supabase anonymous key
AMADEUS_CLIENT_ID=          # Amadeus API client ID
AMADEUS_CLIENT_SECRET=      # Amadeus API client secret
CORS_ORIGIN=                # CORS allowed origins
```

#### Frontend ([`frontend/.env`](frontend/.env))
```env
REACT_APP_API_URL=http://localhost:8080  # Backend API URL
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Manual Testing
- Health check: `http://localhost:8080/health`
- API documentation: `http://localhost:8080/api`
- Database test: `http://localhost:8080/test-db`

## 🚀 Deployment

### Frontend Deployment
```bash
cd frontend
npm run build
```
The build files will be created in the `build/` directory.

### Backend Deployment
The backend can be deployed to any Node.js hosting platform. Ensure environment variables are properly configured in production.

## 🔌 External Services

### Amadeus API Integration
- **Purpose**: Flight and hotel search functionality
- **Service**: [`amadeusService.js`](backend/services/amadeusService.js)
- **Setup**: Requires API credentials from [Amadeus for Developers](https://developers.amadeus.com/)

### Supabase Integration
- **Purpose**: User data persistence, favorites, search history
- **Service**: [`supabaseService.js`](backend/services/supabaseService.js)
- **Setup**: Requires project setup at [Supabase](https://supabase.com/)

## 🎨 UI Components

The frontend uses a modern design with:
- **Icons**: Lucide React icons
- **Styling**: Tailwind CSS for responsive design
- **Components**: Search forms, result cards, navigation tabs
- **Features**: Dark/light themes, mobile responsiveness

## 📝 Development

### Adding New Features

1. **Backend**: Create controllers in [`controllers/`](backend/controllers/) and routes in [`routes/`](backend/routes/)
2. **Frontend**: Add components in [`src/App.js`](frontend/src/App.js) or create separate component files
3. **API Integration**: Use the [`apiCall`](frontend/src/App.js) function for backend communication

### Code Structure

- **Controllers**: Handle business logic and API responses
- **Services**: External API integrations and data processing
- **Routes**: Express route definitions and middleware
- **Utils**: Helper functions and utilities

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**: Check CORS configuration in [`server.js`](backend/server.js)
2. **API Not Found**: Verify backend server is running on port 8080
3. **Database Errors**: Check Supabase configuration and network connectivity
4. **Search Not Working**: Verify Amadeus API credentials

### Debug Endpoints
- Environment check: Run [`envChecker.js`](backend/utils/envChecker.js)
- Server status: `GET /health`
- Database connectivity: `GET /test-db`

## 👥 Team

**Team 404 Not Found** - SummerBuild 2025 Hackathon

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

For questions or support, please refer to the API documentation at `http://localhost:8080/api` when the backend server is running.