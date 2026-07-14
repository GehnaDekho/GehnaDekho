const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const City = require('../models/City');
const connectDB = require('../config/db');

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const insertCities = async () => {
  try {
    // Connect to database
    await connectDB();

    const citiesData = [
      { name: 'Bengaluru', state: 'Karnataka', isActive: true },
      { name: 'Mumbai', state: 'Maharashtra', isActive: true },
      { name: 'Delhi', state: 'Delhi', isActive: true },
      { name: 'Chennai', state: 'Tamil Nadu', isActive: true },
      { name: 'Kolkata', state: 'West Bengal', isActive: true },
      { name: 'Hyderabad', state: 'Telangana', isActive: true },
      { name: 'Pune', state: 'Maharashtra', isActive: true },
      { name: 'Ahmedabad', state: 'Gujarat', isActive: true },
      { name: 'Jaipur', state: 'Rajasthan', isActive: true },
      { name: 'Lucknow', state: 'Uttar Pradesh', isActive: true },
    ];

    // Check existing cities to avoid duplicates
    for (const city of citiesData) {
      const existingCity = await City.findOne({ name: city.name });
      if (!existingCity) {
        await City.create(city);
        console.log(`Inserted city: ${city.name}`);
      } else {
        console.log(`City already exists: ${city.name}`);
      }
    }

    console.log('City insertion complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error inserting cities:', error);
    process.exit(1);
  }
};

insertCities();
