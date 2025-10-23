const express = require('express');
const dotenv = require('dotenv');
const redisUtils = require('./utils/redis');
const apiRoutes = require('./routes/api'); // Import API routes
const db = require('./utils/db'); // Import database connection


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('Hotel Reservation API is running.');
});

// Use API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});