# City ELO Rating System

A simple web application that allows users to choose between two cities. The results are used to calculate ELO ratings for each city.

## Features

- Random city pair selection for comparison
- ELO rating calculation based on user choices
- Leaderboard of city rankings
- City suggestion system

## Local Development Setup

1. Install dependencies:
```
npm install
```

2. Start the development server:
```
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

## Deploying to Vercel

### Prerequisites

1. [Create a Vercel account](https://vercel.com/signup) if you don't have one
2. Install the Vercel CLI:
```
npm install -g vercel
```

### Deployment Steps

1. Login to Vercel from the command line:
```
vercel login
```

2. Deploy your application:
```
vercel
```

3. For subsequent deployments, use:
```
vercel --prod
```

### Important Notes for Vercel Deployment

- The application uses an in-memory data store for the Vercel deployment, which means data will reset periodically when the serverless functions spin down.
- For a production application, consider using a persistent database service like:
  - MongoDB Atlas
  - Supabase (PostgreSQL)
  - Vercel KV (Redis-based key-value store)
  - Vercel Postgres

## Technologies Used

- HTML, CSS, JavaScript
- Express.js for the backend
- SQLite for local development
- In-memory data store for Vercel deployment
