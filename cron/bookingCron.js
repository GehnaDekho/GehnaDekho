const cron = require('node-cron');
const Booking = require('../models/Booking');

/**
 * Initializes cron jobs for booking statuses
 */
const initBookingCron = () => {
  // Run everyday at 12:00 AM (midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Starting daily Booking status update...');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await Booking.updateMany(
        { 
          status: 'scheduled', 
          preferredDate: { $lt: today } 
        },
        { 
          $set: { status: 'not_visited' } 
        }
      );

      console.log(`[CRON] Successfully updated ${result.modifiedCount} bookings to 'not_visited'.`);
    } catch (error) {
      console.error('[CRON] Error during Booking status update:', error);
    }
  });

  console.log('Booking cron jobs initialized successfully.');
};

module.exports = {
  initBookingCron
};
