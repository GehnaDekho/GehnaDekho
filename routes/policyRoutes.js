const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public route to fetch a policy
router.get('/:type', policyController.getPolicy);

// Admin route to update/create a policy
router.put('/:type', protect, authorize('admin'), policyController.updatePolicy);

module.exports = router;
