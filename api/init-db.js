const db = require('./db');

// Initialize the database with secret key protection
module.exports = async (req, res) => {
  // Check for secret key in request
  const { secret } = req.query;
  
  // Hardcoded secret for testing - REMOVE THIS IN PRODUCTION
  const expectedSecret = process.env.DB_INIT_SECRET || 'city-elo-db-init-secret-key-2025';
  
  // Log environment variables for debugging
  console.log('Environment variables:', {
    DB_INIT_SECRET: process.env.DB_INIT_SECRET,
    NODE_ENV: process.env.NODE_ENV
  });
  
  // Verify the secret key
  if (secret !== expectedSecret) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Invalid or missing secret key'
    });
  }
  
  try {
    await db.initializeDatabase();
    res.status(200).json({ success: true, message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Error initializing database:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
