const express = require('express');
const router = express.Router();
const {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestById,
  reviewServiceRequest
} = require('../controllers/serviceRequestController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, authorize('outlet_owner'), createServiceRequest)
  .get(protect, authorize('admin', 'outlet_owner'), getServiceRequests);

router.route('/:id')
  .get(protect, authorize('admin', 'outlet_owner'), getServiceRequestById);

router.route('/:id/status')
  .put(protect, authorize('admin'), reviewServiceRequest);

module.exports = router;
