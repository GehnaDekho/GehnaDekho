const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const Outlet = require('../models/Outlet');
const Review = require('../models/Review');
const Jewellery = require('../models/Jewellery');
const Reel = require('../models/Reel');
const FeaturedJewelleryHistory = require('../models/FeaturedJewelleryHistory');
const Feedback = require('../models/Feedback');
const Booking = require('../models/Booking');

const createIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB Connected for Index Creation');

    console.log('Creating indexes...');

    // Review indexes
    await Review.collection.createIndex({ outlet: 1, isActive: 1 });
    console.log('Created Review index: { outlet: 1, isActive: 1 }');

    // Jewellery indexes
    await Jewellery.collection.createIndex({ outlet: 1 });
    console.log('Created Jewellery index: { outlet: 1 }');

    // Reel indexes
    await Reel.collection.createIndex({ outlet: 1 });
    console.log('Created Reel index: { outlet: 1 }');

    // FeaturedJewelleryHistory indexes
    await FeaturedJewelleryHistory.collection.createIndex({ outlet: 1 });
    console.log('Created FeaturedJewelleryHistory index: { outlet: 1 }');

    // Feedback indexes
    await Feedback.collection.createIndex({ outlet: 1, isUnlocked: 1, isDeleted: 1 });
    console.log('Created Feedback index: { outlet: 1, isUnlocked: 1, isDeleted: 1 }');

    // Booking indexes
    await Booking.collection.createIndex({ outletId: 1, revealed: 1 });
    console.log('Created Booking index: { outletId: 1, revealed: 1 }');

    // Outlet indexes
    await Outlet.collection.createIndex({ qualityIndex: -1, rating: -1, createdAt: 1 });
    console.log('Created Outlet index: { qualityIndex: -1, rating: -1, createdAt: 1 }');

    console.log('All indexes created successfully.');

    process.exit(0);
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  }
};

createIndexes();
