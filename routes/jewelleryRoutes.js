const express = require('express');
const router = express.Router();
const {
  createJewellery,
  getJewelleries,
  getJewelleryById,
  updateJewellery,
  deleteJewellery,
  trackTryOnInteraction,
  trackWishlistAddition
} = require('../controllers/jewelleryController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, createJewellery)
  .get(getJewelleries);

router.route('/:id')
  .get(getJewelleryById)
  .put(protect, updateJewellery)
  .delete(protect, deleteJewellery);

router.route('/:id/tryon')
  .post(trackTryOnInteraction);

router.route('/:id/wishlist')
  .post(trackWishlistAddition);

module.exports = router;
