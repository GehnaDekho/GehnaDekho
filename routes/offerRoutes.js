const express = require('express');
const router = express.Router();
const {
  createOffer,
  getAllOffers,
  getActiveOffersForCity,
  updateOffer,
  deleteOffer
} = require('../controllers/offerController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public route for mobile app
router.get('/active', getActiveOffersForCity);

// Admin routes
router.use(protect);
router.use(authorize('admin'));

router.route('/')
  .post(createOffer)
  .get(getAllOffers);

router.route('/:id')
  .put(updateOffer)
  .delete(deleteOffer);

module.exports = router;
