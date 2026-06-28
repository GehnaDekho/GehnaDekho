const express = require('express');
const router = express.Router();
const {
  createVoucherConfig,
  getVoucherConfigs,
  updateVoucherConfig,
  deleteVoucherConfig,
} = require('../controllers/voucherConfigController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Mount routes with appropriate auth guards
router.route('/')
  .post(protect, authorize('admin'), createVoucherConfig)
  .get(protect, getVoucherConfigs);

router.route('/:id')
  .put(protect, authorize('admin'), updateVoucherConfig)
  .delete(protect, authorize('admin'), deleteVoucherConfig);

module.exports = router;
