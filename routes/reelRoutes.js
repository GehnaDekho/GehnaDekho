const express = require('express');
const router = express.Router();
const { createReel, getReels, trackView, updateReel, deleteReel } = require('../controllers/reelController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, createReel)
  .get(getReels);

router.route('/:id/view')
  .post(protect, trackView);

router.route('/:id')
  .put(protect, updateReel)
  .delete(protect, deleteReel);

module.exports = router;
