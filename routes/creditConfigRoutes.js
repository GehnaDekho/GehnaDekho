const express = require('express');
const router = express.Router();
const {
  createCreditConfig,
  getCreditConfigs,
  getCreditConfigByAction,
  updateCreditConfig,
  deleteCreditConfig
} = require('../controllers/creditConfigController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Mount CRUD operations with appropriate role authorizations
router.route('/')
  .post(protect, authorize('admin'), createCreditConfig)
  .get(protect, authorize('admin', 'outlet_owner'), getCreditConfigs);

router.route('/:actionName')
  .get(protect, authorize('admin', 'outlet_owner'), getCreditConfigByAction);

router.route('/:id')
  .put(protect, authorize('admin'), updateCreditConfig)
  .delete(protect, authorize('admin'), deleteCreditConfig);

module.exports = router;
