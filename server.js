const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize database
const db = new sqlite3.Database('./city-elo.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Create cities table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      elo INTEGER DEFAULT 1000,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      comparisons INTEGER DEFAULT 0
    )`);

    // Create comparisons table to store user choices
    db.run(`CREATE TABLE IF NOT EXISTS comparisons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      winner_id INTEGER,
      loser_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (winner_id) REFERENCES cities (id),
      FOREIGN KEY (loser_id) REFERENCES cities (id)
    )`);
    
    // Create city suggestions table
    db.run(`CREATE TABLE IF NOT EXISTS city_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      status TEXT DEFAULT 'pending',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert some initial cities if the table is empty
    db.get("SELECT COUNT(*) as count FROM cities", (err, row) => {
      if (err) {
        console.error(err.message);
        return;
      }
    
    if (row.count === 0) {
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
      
      const stmt = db.prepare("INSERT INTO cities (name) VALUES (?)");
      initialCities.forEach(city => {
        stmt.run(city);
      });
      stmt.finalize();
      console.log("Initial cities added to the database");
    }
    });
  });
}

// Calculate ELO rating
function calculateElo(winnerElo, loserElo) {
  const kFactor = 32;
  const expectedScoreWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedScoreLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  
  const newWinnerElo = Math.round(winnerElo + kFactor * (1 - expectedScoreWinner));
  const newLoserElo = Math.round(loserElo + kFactor * (0 - expectedScoreLoser));
  
  return { newWinnerElo, newLoserElo };
}

// API Routes

// Get two random cities for comparison
app.get('/api/cities/random', (req, res) => {
  db.all("SELECT id, name FROM cities ORDER BY RANDOM() LIMIT 2", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Submit a comparison result
app.post('/api/comparison', (req, res) => {
  const { winnerId, loserId } = req.body;
  
  if (!winnerId || !loserId) {
    return res.status(400).json({ error: "Both winner and loser IDs are required" });
  }

  db.serialize(() => {
    // Get current ELO ratings
    db.get("SELECT elo FROM cities WHERE id = ?", [winnerId], (err, winnerRow) => {
      if (err || !winnerRow) {
        return res.status(500).json({ error: "Error retrieving winner data" });
      }
      
      db.get("SELECT elo FROM cities WHERE id = ?", [loserId], (err, loserRow) => {
        if (err || !loserRow) {
          return res.status(500).json({ error: "Error retrieving loser data" });
        }
        
        // Calculate new ELO ratings
        const { newWinnerElo, newLoserElo } = calculateElo(winnerRow.elo, loserRow.elo);
        
        // Update cities table
        db.run("UPDATE cities SET elo = ?, wins = wins + 1, comparisons = comparisons + 1 WHERE id = ?", 
          [newWinnerElo, winnerId]);
        db.run("UPDATE cities SET elo = ?, losses = losses + 1, comparisons = comparisons + 1 WHERE id = ?", 
          [newLoserElo, loserId]);
        
        // Record the comparison
        db.run("INSERT INTO comparisons (winner_id, loser_id) VALUES (?, ?)", 
          [winnerId, loserId], function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            res.json({ 
              success: true, 
              newWinnerElo, 
              newLoserElo, 
              comparisonId: this.lastID 
            });
          });
      });
    });
  });
});

// Get city rankings
app.get('/api/cities/rankings', (req, res) => {
  db.all("SELECT id, name, elo, wins, losses, comparisons FROM cities ORDER BY elo DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Submit a city suggestion
app.post('/api/cities/suggest', (req, res) => {
  const { cityName } = req.body;
  
  if (!cityName || cityName.trim() === '') {
    return res.status(400).json({ error: "City name is required" });
  }
  
  const formattedCityName = cityName.trim();
  
  // Check if city already exists in main cities table
  db.get("SELECT id FROM cities WHERE name = ?", [formattedCityName], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (row) {
      return res.status(400).json({ error: "City already exists in the database" });
    }
    
    // Check if city already exists in suggestions table
    db.get("SELECT id FROM city_suggestions WHERE name = ?", [formattedCityName], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (row) {
        return res.status(400).json({ error: "City has already been suggested" });
      }
      
      // Add the city suggestion
      db.run("INSERT INTO city_suggestions (name) VALUES (?)", [formattedCityName], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({ 
          success: true, 
          message: "City suggestion received", 
          suggestionId: this.lastID 
        });
      });
    });
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Close database connection on process exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
    process.exit(0);
  });
});
