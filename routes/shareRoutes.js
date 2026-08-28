const express = require('express');
const router = express.Router();
const { getJewellerySharePreview } = require('../controllers/shareController');

// Public route for viewing a shared jewellery link
router.get('/jewellery/:id', getJewellerySharePreview);

module.exports = router;
