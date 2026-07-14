const express = require('express');
const router = express.Router();
const {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  toggleWishlist
} = require('../controllers/wishlistController');
const { protect } = require('../middleware/authMiddleware');

// All wishlist routes are protected to authenticated users
router.use(protect);

router.route('/')
  .post(addToWishlist)
  .get(getWishlist);

router.post('/toggle', toggleWishlist);

router.route('/:jewelleryId')
  .delete(removeFromWishlist);

module.exports = router;
