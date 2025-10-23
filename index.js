const express = require('express');
const dotenv = require('dotenv');
const compression = require('compression');
const rateLimit = require("express-rate-limit");
const path = require('path');

// Load environment variables
dotenv.config();

// Local modules
const redisUtils = require('./utils/redis');
const apiRoutes = require('./routes/api'); 
const db = require('./utils/db'); 

// Initialize app  ✅ must come before app.use()
const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiter middleware
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // max 20 requests/minute/IP
  message: { error: "Too many requests, please slow down" }
});
app.use("/api/search", limiter); // ✅ now app exists

// Middleware
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'front')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'front/reservation.html'));
});

// API routes
app.use('/api', apiRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
