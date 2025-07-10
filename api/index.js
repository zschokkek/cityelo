// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '.env.local' });
}

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');

// Initialize express app
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Initialize database on startup
db.initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

// API Routes

// Get two random cities for comparison
app.get('/api/cities/random', async (req, res) => {
  try {
    console.log('Request received for random cities from:', req.headers.host);
    console.log('Environment:', process.env.NODE_ENV);
    
    // Check if we can connect to the database
    try {
      const testConnection = await db.pool.query('SELECT NOW()');
      console.log('Database connection test:', testConnection.rows[0]);
    } catch (connError) {
      console.error('Database connection test failed:', connError);
      return res.status(500).json({ 
        error: 'Database connection failed', 
        details: connError.message,
        host: req.headers.host,
        dbUrlFormat: process.env.DATABASE_URL ? 
          process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@') : 
          'not set'
      });
    }
    
    // Check if we have cities in the database
    try {
      const cityCount = await db.pool.query('SELECT COUNT(*) FROM cities');
      console.log('City count in database:', cityCount.rows[0]);
      
      if (parseInt(cityCount.rows[0].count) === 0) {
        console.log('No cities found in database. Database may need initialization.');
        return res.status(404).json({ 
          error: 'No cities found in database', 
          message: 'Database may need initialization via /api/init-db endpoint'
        });
      }
    } catch (countError) {
      console.error('Error checking city count:', countError);
      return res.status(500).json({ 
        error: 'Failed to check city count', 
        details: countError.message,
        message: 'Table may not exist. Try initializing the database.'
      });
    }
    
    // Get random cities
    const randomCities = await db.getRandomCities(2);
    console.log('Random cities returned:', randomCities.length);
    
    if (randomCities.length < 2) {
      console.log('Not enough cities returned from database');
      return res.status(404).json({ 
        error: 'Not enough cities available', 
        count: randomCities.length
      });
    }
    
    res.json(randomCities);
  } catch (error) {
    console.error('Error getting random cities:', error);
    res.status(500).json({ 
      error: 'Failed to get random cities', 
      details: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  }
});

// Submit a comparison result
app.post('/api/comparison', async (req, res) => {
  try {
    const { winnerId, loserId } = req.body;
    
    if (!winnerId || !loserId) {
      return res.status(400).json({ error: "Both winner and loser IDs are required" });
    }
    
    const result = await db.recordComparison(parseInt(winnerId), parseInt(loserId));
    res.json(result);
  } catch (error) {
    console.error('Error recording comparison:', error);
    
    if (error.message === 'One or both cities not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to record comparison' });
  }
});

// Get city rankings
app.get('/api/cities/rankings', async (req, res) => {
  try {
    const rankings = await db.getCityRankings();
    res.json(rankings);
  } catch (error) {
    console.error('Error getting rankings:', error);
    res.status(500).json({ error: 'Failed to get rankings' });
  }
});

// Submit a city suggestion
app.post('/api/cities/suggest', async (req, res) => {
  try {
    const { cityName } = req.body;
    
    if (!cityName || cityName.trim() === '') {
      return res.status(400).json({ error: "City name is required" });
    }
    
    const result = await db.submitCitySuggestion(cityName);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error submitting suggestion:', error);
    res.status(500).json({ error: 'Failed to submit suggestion' });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Start the server if running locally
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the Express API for Vercel
module.exports = app;
