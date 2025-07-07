const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Initialize express app
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// In-memory data store for demo purposes
// In a real production app, you would use a proper database service
let cities = [];
let comparisons = [];
let citySuggestions = [];

// Initialize with some data if empty
function initializeData() {
  // Always initialize cities in serverless environment to ensure data is available
  if (cities.length === 0) {
    console.log('Initializing cities data...');
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
    
    cities = initialCities.map((cityName, index) => ({
      id: index + 1,
      name: cityName,
      elo: 1000,
      wins: 0,
      losses: 0,
      comparisons: 0
    }));
    
    console.log(`Initialized ${cities.length} cities`);
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

// Initialize data
initializeData();

// API Routes

// Get two random cities for comparison
app.get('/api/cities/random', (req, res) => {
  // Ensure we have data
  initializeData();
  
  // Get two random cities
  const shuffled = [...cities].sort(() => 0.5 - Math.random());
  const randomCities = shuffled.slice(0, 2);
  
  res.json(randomCities);
});

// Submit a comparison result
app.post('/api/comparison', (req, res) => {
  const { winnerId, loserId } = req.body;
  
  if (!winnerId || !loserId) {
    return res.status(400).json({ error: "Both winner and loser IDs are required" });
  }
  
  // Find the cities
  const winner = cities.find(city => city.id === parseInt(winnerId));
  const loser = cities.find(city => city.id === parseInt(loserId));
  
  if (!winner || !loser) {
    return res.status(404).json({ error: "One or both cities not found" });
  }
  
  // Calculate new ELO ratings
  const { newWinnerElo, newLoserElo } = calculateElo(winner.elo, loser.elo);
  
  // Update cities
  winner.elo = newWinnerElo;
  winner.wins += 1;
  winner.comparisons += 1;
  
  loser.elo = newLoserElo;
  loser.losses += 1;
  loser.comparisons += 1;
  
  // Record the comparison
  const comparisonId = comparisons.length + 1;
  comparisons.push({
    id: comparisonId,
    winner_id: winner.id,
    loser_id: loser.id,
    timestamp: new Date().toISOString()
  });
  
  res.json({ 
    success: true, 
    newWinnerElo, 
    newLoserElo, 
    comparisonId 
  });
});

// Get city rankings
app.get('/api/cities/rankings', (req, res) => {
  // Ensure we have data
  initializeData();
  
  // Sort by ELO rating
  const sortedCities = [...cities].sort((a, b) => b.elo - a.elo);
  
  res.json(sortedCities);
});

// Submit a city suggestion
app.post('/api/cities/suggest', (req, res) => {
  const { cityName } = req.body;
  
  if (!cityName || cityName.trim() === '') {
    return res.status(400).json({ error: "City name is required" });
  }
  
  const formattedCityName = cityName.trim();
  
  // Check if city already exists
  const existingCity = cities.find(city => city.name.toLowerCase() === formattedCityName.toLowerCase());
  if (existingCity) {
    return res.status(400).json({ 
      error: "City already exists in the database", 
      message: `${existingCity.name} is already in our city pool with an ELO rating of ${existingCity.elo}`,
      existingCity
    });
  }
  
  // Check if city already suggested
  const existingSuggestion = citySuggestions.find(suggestion => 
    suggestion.name.toLowerCase() === formattedCityName.toLowerCase()
  );
  
  if (existingSuggestion) {
    return res.status(400).json({ 
      error: "City has already been suggested", 
      message: `${existingSuggestion.name} has already been suggested and is pending review`,
      existingSuggestion
    });
  }
  
  // Add the suggestion
  const suggestionId = citySuggestions.length + 1;
  const newSuggestion = {
    id: suggestionId,
    name: formattedCityName,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  citySuggestions.push(newSuggestion);
  
  res.json({ 
    success: true, 
    message: `Thank you! Your suggestion for ${formattedCityName} has been received and is pending review.`, 
    suggestion: newSuggestion
  });
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
