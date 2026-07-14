const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const Outlet = require('../models/Outlet');
const { calculateQualityIndex } = require('../helpers/outletQualityHelper');

const updateQualityIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB Connected for Quality Index Update');

    // Get all approved outlets
    const outlets = await Outlet.find({ status: 'approved' });
    console.log(`Found ${outlets.length} approved outlets. Calculating quality index...`);

    let updatedCount = 0;
    
    for (const outlet of outlets) {
      const newQualityIndex = await calculateQualityIndex(outlet._id);
      outlet.qualityIndex = newQualityIndex;
      await outlet.save();
      
      console.log(`Updated outlet ${outlet.name} - Quality Index: ${newQualityIndex}`);
      updatedCount++;
    }

    console.log(`Successfully updated quality index for ${updatedCount} outlets.`);

    process.exit(0);
  } catch (error) {
    console.error('Error updating quality indexes:', error);
    process.exit(1);
  }
};

updateQualityIndexes();
