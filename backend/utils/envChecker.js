// Load environment variables
require('dotenv').config();

const checkEnvironmentVariables = () => {
    const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY'
    ];

    const optionalVars = [
        'AMADEUS_CLIENT_ID',
        'AMADEUS_CLIENT_SECRET',
        'GOOGLE_MAPS_API_KEY',
        'PORT',
        'NODE_ENV',
        'CORS_ORIGIN',
        'JWT_SECRET'
    ];

    const missing = [];
    const warnings = [];

    // Check required variables
    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    });

    // Check optional but recommended variables
    optionalVars.forEach(varName => {
        if (!process.env[varName]) {
            warnings.push(varName);
        }
    });

    // Display results
    console.log('🔧 Environment Variable Check:');
    console.log('================================');

    if (missing.length === 0) {
        console.log('✅ All required environment variables are set');
    } else {
        console.log('❌ Missing required environment variables:');
        missing.forEach(varName => {
            console.log(`   - ${varName}`);
        });
    }

    if (warnings.length > 0) {
        console.log('\n⚠️  Missing optional environment variables:');
        warnings.forEach(varName => {
            console.log(`   - ${varName}`);
        });
    }

    // Show current configuration
    console.log('\n📋 Current Configuration:');
    console.log(`   PORT: ${process.env.PORT || '3001 (default)'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development (default)'}`);
    console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
    console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   AMADEUS_CLIENT_ID: ${process.env.AMADEUS_CLIENT_ID ? '✅ Set' : '⚠️  Not set'}`);
    console.log(`   AMADEUS_CLIENT_SECRET: ${process.env.AMADEUS_CLIENT_SECRET ? '✅ Set' : '⚠️  Not set'}`);
    console.log(`   GOOGLE_MAPS_API_KEY: ${process.env.GOOGLE_MAPS_API_KEY ? '✅ Set' : '⚠️  Not set'}`);
    console.log(`   CORS_ORIGIN: ${process.env.CORS_ORIGIN || 'default (localhost:8080, 8081)'}`);

    // Show package information
    console.log('\n📦 Package Information:');
    try {
        const packageJson = require('../package.json');
        console.log(`   App Name: ${packageJson.name}`);
        console.log(`   Version: ${packageJson.version}`);
        console.log(`   Node Version: ${process.version}`);
        
        // Show key dependencies
        const keyDeps = ['express', '@supabase/supabase-js', 'amadeus', 'helmet', 'morgan'];
        keyDeps.forEach(dep => {
            const version = packageJson.dependencies[dep];
            console.log(`   ${dep}: ${version || 'not installed'}`);
        });
    } catch (error) {
        console.log('   ⚠️  Could not read package.json');
    }

    console.log('\n================================\n');

    if (missing.length > 0) {
        console.log('❌ Cannot start server: Missing required environment variables');
        console.log('💡 Please create a .env file based on .env.example');
        process.exit(1);
    }

    if (warnings.length > 0) {
        console.log('⚠️  Server will start but some features may be limited');
        console.log('💡 Consider adding optional environment variables for full functionality\n');
    }

    return {
        hasRequired: missing.length === 0,
        missing,
        warnings
    };
};

module.exports = {
    checkEnvironmentVariables
};