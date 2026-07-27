const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const apiRoutes = require('./routes');
const { initCronJobs } = require('./cron/qualityIndexCron');
const firebaseService = require('./services/firebase.service');

// Load env variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve static uploads folder at /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/gehnaDekho', apiRoutes);

// Basic route for health check
app.get('/', (req, res) => {
  res.send('GehnaDekho API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  
  // Initialize background tasks
  initCronJobs();

  // Initialize Firebase Admin SDK
  firebaseService.initialize();
});
