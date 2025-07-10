-- Create cities table
CREATE TABLE IF NOT EXISTS cities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  elo INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  comparisons INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create comparisons table
CREATE TABLE IF NOT EXISTS comparisons (
  id SERIAL PRIMARY KEY,
  winner_id INTEGER NOT NULL REFERENCES cities(id),
  loser_id INTEGER NOT NULL REFERENCES cities(id),
  winner_elo_before INTEGER NOT NULL,
  loser_elo_before INTEGER NOT NULL,
  winner_elo_after INTEGER NOT NULL,
  loser_elo_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create city suggestions table
CREATE TABLE IF NOT EXISTS city_suggestions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(name);
CREATE INDEX IF NOT EXISTS idx_cities_elo ON cities(elo DESC);
