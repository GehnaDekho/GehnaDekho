const express = require('express');
const router = express.Router();

const userRoutes = require('./userRoutes');
const adminRoutes = require('./adminRoutes');
const outletRoutes = require('./outletRoutes');
const categoryRoutes = require('./categoryRoutes');
const jewelleryRoutes = require('./jewelleryRoutes');
const slotRoutes = require('./slotRoutes');
const creditTransactionRoutes = require('./creditTransactionRoutes');
const featuredJewelleryHistoryRoutes = require('./featuredJewelleryHistoryRoutes');
const creditConfigRoutes = require('./creditConfigRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const serviceRoutes = require('./serviceRoutes');
const serviceRequestRoutes = require('./serviceRequestRoutes');
const wishlistRoutes = require('./wishlistRoutes');
const reviewRoutes = require('./reviewRoutes');
const voucherConfigRoutes = require('./voucherConfigRoutes');
const voucherTransactionRoutes = require('./voucherTransactionRoutes');
const redeemRequestRoutes = require('./redeemRequestRoutes');
const ratingCriteriaRoutes = require('./ratingCriteriaRoutes');

// Mount individual resource routes
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/outlets', outletRoutes);
router.use('/categories', categoryRoutes);
router.use('/jewelleries', jewelleryRoutes);
router.use('/slots', slotRoutes);
router.use('/credit-transactions', creditTransactionRoutes);
router.use('/featured-history', featuredJewelleryHistoryRoutes);
router.use('/credit-configs', creditConfigRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/services', serviceRoutes);
router.use('/service-requests', serviceRequestRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/reviews', reviewRoutes);
router.use('/voucher-configs', voucherConfigRoutes);
router.use('/voucher-transactions', voucherTransactionRoutes);
router.use('/redeem-requests', redeemRequestRoutes);
router.use('/rating-criteria', ratingCriteriaRoutes);

module.exports = router;
