const { Pool } = require('pg');

// Create a connection pool using DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for some Postgres providers
  }
});

// Test the connection on startup
(async () => {
  try {
    const client = await pool.connect();
    console.log('Database connection successful');
    const result = await client.query('SELECT NOW()');
    console.log('Database time:', result.rows[0]);
    client.release();
  } catch (err) {
    console.error('Database connection error:', err);
    console.log('DATABASE_URL format (redacted):', 
      process.env.DATABASE_URL ? 
      process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@') : 
      'not set');
  }
})();

// Initialize the database with tables and initial data
async function initializeDatabase() {
  try {
    // Read the schema file
    const fs = require('fs');
    const path = require('path');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    console.log('Database schema initialized');
    
    // Check if we need to populate cities
    const { rowCount } = await pool.query('SELECT COUNT(*) FROM cities');
    
    if (rowCount === 0) {
      console.log('Populating initial cities data...');
      await populateInitialCities();
      console.log('Initial cities data populated');
    } else {
      console.log(`Database already contains ${rowCount} cities`);
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

// Populate initial cities
async function populateInitialCities() {
  const initialCities = [
    // Top cities from global livability indices (more Western-centric)
    "Vienna", "Copenhagen", "Zurich", "Calgary", "Vancouver",
    "Geneva", "Frankfurt", "Toronto", "Amsterdam", "Osaka",
    "Melbourne", "Sydney", "Stockholm", "London", "Montreal",
    "Munich", "Helsinki", "Oslo", "Hamburg", "Paris",
    "Tokyo", "Wellington", "Edinburgh", "Perth", "Adelaide",
    "Auckland", "Brisbane", "Berlin", "Dublin", "Luxembourg",
    "Brussels", "Madrid", "Barcelona", "Milan", "Lyon",
    "Singapore", "Hong Kong", "San Francisco", "Boston", "Seattle",
    "New York", "Chicago", "Washington DC", "Portland", "Minneapolis",
    "Honolulu", "Pittsburgh", "Denver", "Los Angeles", "San Diego",
    "Austin", "Philadelphia", "Dallas", "Houston", "Atlanta",
    "Miami", "Seoul", "Taipei", "Kyoto", "Yokohama",
    "Lisbon", "Prague", "Budapest", "Warsaw", "Ljubljana",
    "Tallinn", "Riga", "Vilnius", "Bratislava", "Bucharest",
    "Athens", "Rome", "Florence", "Venice", "Naples",
    "Valencia", "Seville", "Porto", "Bordeaux", "Nice",
    "Marseille", "Rotterdam", "The Hague", "Utrecht", "Antwerp",
    "Ghent", "Basel", "Bern", "Lausanne", "St. Gallen",
    "Gothenburg", "Malmö", "Aarhus", "Odense", "Bergen",
    "Stavanger", "Tampere", "Turku", "Reykjavik", "Quebec City",
    "Ottawa", "Halifax", "Victoria", "Canberra", "Christchurch",
    "Dunedin", "Tel Aviv", "Dubai", "Abu Dhabi", "Doha",
    "Muscat", "Manama", "Kuwait City", "Istanbul", "Cape Town",
    "Johannesburg", "Durban", "Nairobi", "Casablanca", "Tunis",
    "Buenos Aires", "Santiago", "Montevideo", "Rio de Janeiro", "São Paulo",
    "Mexico City", "Monterrey", "Panama City", "San José", "Bogotá",
    "Lima", "Quito", "Bangkok", "Kuala Lumpur", "Manila",
    "Jakarta", "Ho Chi Minh City", "Hanoi", "Shanghai", "Beijing",
    "Guangzhou", "Shenzhen", "Chengdu", "Kyiv", "Moscow"
  ];
  
  // Insert cities in batches to avoid query size limits
  const batchSize = 50;
  for (let i = 0; i < initialCities.length; i += batchSize) {
    const batch = initialCities.slice(i, i + batchSize);
    const values = batch.map((city, index) => `($${index + 1}, 1000, 0, 0, 0)`).join(', ');
    const query = `
      INSERT INTO cities (name, elo, wins, losses, comparisons)
      VALUES ${values}
      ON CONFLICT (name) DO NOTHING
    `;
    await pool.query(query, batch);
  }
  
  console.log(`Inserted ${initialCities.length} cities`);
}

// Get random cities for comparison
async function getRandomCities(count = 2) {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM cities
      ORDER BY RANDOM()
      LIMIT $1
    `, [count]);
    
    return rows;
  } catch (error) {
    console.error('Error getting random cities:', error);
    throw error;
  }
}

// Get city by ID
async function getCityById(id) {
  try {
    const { rows } = await pool.query('SELECT * FROM cities WHERE id = $1', [id]);
    return rows[0] || null;
  } catch (error) {
    console.error('Error getting city by ID:', error);
    throw error;
  }
}

// Calculate ELO rating
function calculateElo(winnerElo, loserElo) {
  const kFactor = 32;
  const expectedWinnerScore = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoserScore = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  
  const newWinnerElo = Math.round(winnerElo + kFactor * (1 - expectedWinnerScore));
  const newLoserElo = Math.round(loserElo + kFactor * (0 - expectedLoserScore));
  
  return { newWinnerElo, newLoserElo };
}

// Record a comparison and update ELO ratings
async function recordComparison(winnerId, loserId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get the cities
    const winnerResult = await client.query('SELECT * FROM cities WHERE id = $1 FOR UPDATE', [winnerId]);
    const loserResult = await client.query('SELECT * FROM cities WHERE id = $1 FOR UPDATE', [loserId]);
    
    if (winnerResult.rows.length === 0 || loserResult.rows.length === 0) {
      throw new Error('One or both cities not found');
    }
    
    const winner = winnerResult.rows[0];
    const loser = loserResult.rows[0];
    
    // Calculate new ELO ratings
    const { newWinnerElo, newLoserElo } = calculateElo(winner.elo, loser.elo);
    
    // Update winner
    await client.query(`
      UPDATE cities 
      SET elo = $1, wins = wins + 1, comparisons = comparisons + 1 
      WHERE id = $2
    `, [newWinnerElo, winnerId]);
    
    // Update loser
    await client.query(`
      UPDATE cities 
      SET elo = $1, losses = losses + 1, comparisons = comparisons + 1 
      WHERE id = $2
    `, [newLoserElo, loserId]);
    
    // Record the comparison
    const comparisonResult = await client.query(`
      INSERT INTO comparisons 
      (winner_id, loser_id, winner_elo_before, loser_elo_before, winner_elo_after, loser_elo_after) 
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [winnerId, loserId, winner.elo, loser.elo, newWinnerElo, newLoserElo]);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      comparisonId: comparisonResult.rows[0].id,
      newWinnerElo,
      newLoserElo
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording comparison:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Get city rankings
async function getCityRankings() {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM cities
      ORDER BY elo DESC
    `);
    
    return rows;
  } catch (error) {
    console.error('Error getting city rankings:', error);
    throw error;
  }
}

// Submit a city suggestion
async function submitCitySuggestion(cityName) {
  try {
    const formattedCityName = cityName.trim();
    
    // Check if city already exists
    const existingCityResult = await pool.query(
      'SELECT * FROM cities WHERE LOWER(name) = LOWER($1)',
      [formattedCityName]
    );
    
    if (existingCityResult.rows.length > 0) {
      const existingCity = existingCityResult.rows[0];
      return {
        success: false,
        error: "City already exists in the database",
        message: `${existingCity.name} is already in our city pool with an ELO rating of ${existingCity.elo}`,
        existingCity
      };
    }
    
    // Check if city already suggested
    const existingSuggestionResult = await pool.query(
      'SELECT * FROM city_suggestions WHERE LOWER(name) = LOWER($1)',
      [formattedCityName]
    );
    
    if (existingSuggestionResult.rows.length > 0) {
      const existingSuggestion = existingSuggestionResult.rows[0];
      return {
        success: false,
        error: "City has already been suggested",
        message: `${existingSuggestion.name} has already been suggested and is pending review`,
        existingSuggestion
      };
    }
    
    // Add the suggestion
    const newSuggestionResult = await pool.query(
      'INSERT INTO city_suggestions (name) VALUES ($1) RETURNING *',
      [formattedCityName]
    );
    
    const newSuggestion = newSuggestionResult.rows[0];
    
    return {
      success: true,
      message: `Thank you! Your suggestion for ${formattedCityName} has been received and is pending review.`,
      suggestion: newSuggestion
    };
  } catch (error) {
    console.error('Error submitting city suggestion:', error);
    throw error;
  }
}

module.exports = {
  pool,
  initializeDatabase,
  getRandomCities,
  getCityById,
  recordComparison,
  getCityRankings,
  submitCitySuggestion,
  calculateElo
};
