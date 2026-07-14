const cron = require('node-cron');
const Outlet = require('../models/Outlet');
const { calculateQualityIndex } = require('../helpers/outletQualityHelper');

/**
 * Initializes cron jobs for the server
 */
const initCronJobs = () => {
  // Run everyday at 12:00 AM (midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Starting daily Quality Index calculation...');
    try {
      const outlets = await Outlet.find({ status: 'approved' });
      let updatedCount = 0;

      for (const outlet of outlets) {
        const newQualityIndex = await calculateQualityIndex(outlet._id);
        outlet.qualityIndex = newQualityIndex;
        await outlet.save();
        updatedCount++;
      }

      console.log(`[CRON] Successfully updated Quality Index for ${updatedCount} outlets.`);
    } catch (error) {
      console.error('[CRON] Error during Quality Index calculation:', error);
    }
  });

  console.log('Cron jobs initialized successfully.');
};

module.exports = {
  initCronJobs
};
