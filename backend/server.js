const express = require('express');
const cors = require('cors');
const {createClient} = require('@supabase/supabase-js')
const {createClient} = require('@supabase/supabase-js')
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'App is running!' });
});

// Test Supabase connection
app.get('/test-db', async (req, res) => {
    try {
        const [airportsResult, hotelsResult] = await Promise.all([
            supabase.from('airports').select('*'),
            supabase.from('hotels').select('*')
        ]);

        if (airportsResult.error) throw airportsResult.error;
        if (hotelsResult.error) throw hotelsResult.error;

        res.json({
            message: 'Supabase connected successfully!',
            airports: airportsResult.data,
            hotels: hotelsResult.data
        });
    } catch (error) {
        console.error('Supabase connection error:', error);
        res.status(500).json({ error: 'Failed to connect to Supabase' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});