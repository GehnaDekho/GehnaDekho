const mongoose = require('mongoose');
const Outlet = require('../models/Outlet');
const Jewellery = require('../models/Jewellery');
const FeaturedJewelleryHistory = require('../models/FeaturedJewelleryHistory');
const Reel = require('../models/Reel');
const Feedback = require('../models/Feedback');
const Booking = require('../models/Booking');

/**
 * Calculates the profile completion percentage for an outlet
 * @param {Object} outlet - The outlet document
 * @returns {Number} Completion percentage (0-100)
 */
const calculateProfileCompletion = (outlet) => {
  if (!outlet) return 0;

  const weights = {
    name: 7,
    address: 7,
    phone: 7,
    email: 7,
    city: 5,
    googleMapLink: 12,
    images: 10,
    description: 10,
    businessHours: 7,
    kycDetailsGST: 5,
    kycDetailsPAN: 5,
    specializations: 8,
    establishedYear: 5,
    onlinePresence: 5
  };

  let score = 0;

  if (outlet.name && outlet.name.trim() !== '') score += weights.name;
  if (outlet.address && outlet.address.trim() !== '') score += weights.address;
  if (outlet.phone && outlet.phone.trim() !== '') score += weights.phone;
  if (outlet.email && outlet.email.trim() !== '') score += weights.email;
  if (outlet.city) score += weights.city;
  if (outlet.googleMapLink && outlet.googleMapLink.trim() !== '') score += weights.googleMapLink;
  
  if (outlet.images && outlet.images.length > 0) {
    score += weights.images;
  }

  if (outlet.description && outlet.description.trim() !== '') {
    score += weights.description;
  }

  if (outlet.openingTime && outlet.closingTime && outlet.openingTime.trim() !== '' && outlet.closingTime.trim() !== '') {
    score += weights.businessHours;
  }

  if (outlet.kycDetails) {
    if (outlet.kycDetails.gstNumber && outlet.kycDetails.gstNumber.trim() !== '') score += weights.kycDetailsGST;
    if (outlet.kycDetails.panNumber && outlet.kycDetails.panNumber.trim() !== '') score += weights.kycDetailsPAN;
  }

  if (outlet.specializations && outlet.specializations.length > 0) {
    score += weights.specializations;
  }

  if (outlet.establishedYear) {
    score += weights.establishedYear;
  }

  const hasWebsite = outlet.website && outlet.website.trim() !== '';
  const hasInstagram = outlet.instagram && outlet.instagram.trim() !== '';
  const hasFacebook = outlet.facebook && outlet.facebook.trim() !== '';
  if (hasWebsite || hasInstagram || hasFacebook) {
    score += weights.onlinePresence;
  }

  return Math.min(100, Math.round(score));
};

/**
 * Calculates the Quality Index for a specific outlet
 * @param {ObjectId} outletId 
 * @returns {Number} quality index (0-100)
 */
const calculateQualityIndex = async (outletId) => {
  try {
    const outlet = await Outlet.findById(outletId);
    if (!outlet) return 0;

    // Parallel queries to fetch metrics
    const [
      jewelleryCount,
      featuredCount,
      reelCount,
      unlockedFeedbackCount,
      revealedBookingCount
    ] = await Promise.all([
      Jewellery.countDocuments({ outlet: outletId }),
      FeaturedJewelleryHistory.countDocuments({ outlet: outletId }),
      Reel.countDocuments({ outlet: outletId }),
      Feedback.countDocuments({ outlet: outletId, isUnlocked: true, isDeleted: false }),
      Booking.countDocuments({ outletId: outletId, revealed: true })
    ]);

    // 1. Average Rating (25%)
    // Uses the built-in outlet.rating field (0 to 5)
    // Formula: max(0, (rating - 1) / 4)
    const ratingSubScore = outlet.rating > 1 ? (outlet.rating - 1) / 4 : 0;

    // 2. Jewelleries Uploaded (20%) - Adjusted weights since Review Count is removed
    // Logarithmic saturation. Full score around 20.
    const jewellerySubScore = Math.min(1.0, Math.log2(jewelleryCount + 1) / Math.log2(21));

    // 3. Featured Jewellery History (20%)
    // Logarithmic saturation. Full score around 15.
    const featuredSubScore = Math.min(1.0, Math.log2(featuredCount + 1) / Math.log2(16));

    // 4. Reels Uploaded (10%)
    const reelSubScore = Math.min(1.0, reelCount / 5);

    // 5. Outlet Images (5%)
    const imageCount = outlet.images ? outlet.images.length : 0;
    const imageSubScore = Math.min(1.0, imageCount / 3);

    // 6. Google Map Link (5%)
    const mapSubScore = (outlet.googleMapLink && outlet.googleMapLink.trim() !== '') ? 1.0 : 0.0;

    // 7. Profile Completion (5%)
    const profileCompletionPercentage = calculateProfileCompletion(outlet);
    const profileSubScore = profileCompletionPercentage / 100.0;

    // 8. Unlocked Feedbacks (5%)
    const feedbackSubScore = Math.min(1.0, unlockedFeedbackCount / 10);

    // 9. Bookings Revealed (5%)
    const bookingSubScore = Math.min(1.0, revealedBookingCount / 10);

    // Weights calculation
    const qualityIndex = Math.round(
      (ratingSubScore * 0.25 * 100) +
      (jewellerySubScore * 0.20 * 100) +
      (featuredSubScore * 0.20 * 100) +
      (reelSubScore * 0.10 * 100) +
      (imageSubScore * 0.05 * 100) +
      (mapSubScore * 0.05 * 100) +
      (profileSubScore * 0.05 * 100) +
      (feedbackSubScore * 0.05 * 100) +
      (bookingSubScore * 0.05 * 100)
    );

    return Math.min(100, Math.max(0, qualityIndex));
  } catch (error) {
    console.error('Error calculating quality index for outlet', outletId, error);
    return 0;
  }
};

module.exports = {
  calculateProfileCompletion,
  calculateQualityIndex
};
