require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('MongoDB connected for migration.');
  
  // Need to require the models first
  require('../models/User');
  require('../models/RatingCriteria');
  const Review = require('../models/Review');
  const Outlet = require('../models/Outlet');

  try {
    const outlets = await Outlet.find({});
    console.log(`Found ${outlets.length} outlets. Recalculating ratings...`);

    for (const outlet of outlets) {
      await Review.calcAverageRating(outlet._id);
    }
    
    console.log('All outlet ratings recalculated successfully!');
  } catch (err) {
    console.error('Error during recalculation:', err);
  } finally {
    process.exit();
  }
}).catch(err => {
  console.error('Failed to connect to MongoDB', err);
  process.exit(1);
});
