const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

// Force test environment configurations
process.env.PORT = 5003;
process.env.NODE_ENV = 'test';

// Require the models for database operations and cleanup
const User = require('./models/User');
const Admin = require('./models/Admin');
const Outlet = require('./models/Outlet');
const RatingCriteria = require('./models/RatingCriteria');
const Review = require('./models/Review');
const Feedback = require('./models/Feedback');
const VoucherConfig = require('./models/VoucherConfig');
const VoucherTransaction = require('./models/VoucherTransaction');
const RedeemRequest = require('./models/RedeemRequest');

// Helper function to perform HTTP Requests using native Node.js 'http'
const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };
    if (body) {
      defaultHeaders['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }
    const options = {
      hostname: 'localhost',
      port: 5003,
      path,
      method,
      headers: { ...defaultHeaders, ...headers }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: { raw: data } });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runTests() {
  console.log('--- Starting Voucher & Redemption System Integration Test Suite ---\n');

  try {
    // 1. Connect to database and perform cleanups
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gehnadekho');
    console.log('Connected to MongoDB for pre-test cleanup.');

    await Admin.deleteMany({ email: 'voucheradmin@test.com' });
    await User.deleteMany({ email: 'vouchercustomer@test.com' });
    await Outlet.deleteMany({ email: 'voucheroutlet@test.com' });
    await RatingCriteria.deleteMany({ name: { $in: ['Voucher Ambience', 'Voucher Staff'] } });
    await Review.deleteMany({});
    await Feedback.deleteMany({});
    await VoucherConfig.deleteMany({});
    await VoucherTransaction.deleteMany({});
    await RedeemRequest.deleteMany({});
    console.log('Database cleaned. Starting Server...');

    // Boot Express Server
    const server = require('./server');

    // Wait slightly for connections to establish
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let adminToken = '';
    let customerToken = '';
    let customerId = '';
    let outletId = '';
    let criteriaId = '';

    // ============================================
    // SEED INITIAL USERS & OUTLET AND CRITERIA
    // ============================================
    
    // 1. Register Admin
    console.log('\n[SETUP] Registering admin account...');
    const adminRegRes = await request('POST', '/gehnaDekho/admin/register', {
      name: 'Voucher Admin',
      email: 'voucheradmin@test.com',
      password: 'password123'
    });
    if (adminRegRes.status !== 201) throw new Error('Failed to register Admin');
    adminToken = adminRegRes.body.token;

    // 2. Register Customer
    console.log('[SETUP] Registering customer account...');
    const customerRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'Voucher Customer',
      email: 'vouchercustomer@test.com',
      phone: '9988776655'
    });
    if (customerRegRes.status !== 201) throw new Error('Failed to register Customer');
    customerToken = customerRegRes.body.token;
    customerId = customerRegRes.body.user._id;

    // 3. Create active Outlet (for review submissions)
    console.log('[SETUP] Registering active outlet...');
    const outlet = await Outlet.create({
      name: 'Voucher Test Outlet',
      address: 'Gold Street, Bangalore',
      phone: '9112233445',
      email: 'voucheroutlet@test.com',
      kycStatus: 'approved',
      status: 'approved'
    });
    outletId = outlet._id;

    // 4. Create rating criteria
    console.log('[SETUP] Seeding rating criteria...');
    const criteria = await RatingCriteria.create({
      name: 'Voucher Ambience',
      category: 'Highly Impacted',
      weightage: 2
    });
    criteriaId = criteria._id;

    // ============================================
    // TEST 1: ADMIN CONFIGURE VOUCHER ACTIONS POINTS
    // ============================================
    console.log('\n[TEST 1] Admin configuring Voucher Point allocations...');
    
    const configRatingRes = await request('POST', '/gehnaDekho/voucher-configs', {
      actionName: 'rating',
      pointsAwarded: 50,
      description: 'Points awarded for rating'
    }, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Rating config status:', configRatingRes.status);
    if (configRatingRes.status !== 201) throw new Error('Failed to create config for rating');

    const configReviewRes = await request('POST', '/gehnaDekho/voucher-configs', {
      actionName: 'review',
      pointsAwarded: 100,
      description: 'Points awarded for writing a review'
    }, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Review config status:', configReviewRes.status);
    if (configReviewRes.status !== 201) throw new Error('Failed to create config for review');

    const configFeedbackRes = await request('POST', '/gehnaDekho/voucher-configs', {
      actionName: 'feedback',
      pointsAwarded: 150,
      description: 'Points awarded for giving feedback'
    }, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Feedback config status:', configFeedbackRes.status);
    if (configFeedbackRes.status !== 201) throw new Error('Failed to create config for feedback');

    console.log('SUCCESS: Points configs saved.');

    // ============================================
    // TEST 2: REVIEW SUBMISSION (WITH TEXT) -> REWARD REVIEW POINTS
    // ============================================
    console.log('\n[TEST 2] Submitting Review with text content (Expected action: "review" -> 100 pts)...');
    const reviewRes = await request('POST', '/gehnaDekho/reviews', {
      outletId,
      reviewText: 'Stunning emerald collection and clean showroom!',
      ratings: [{ criteria: criteriaId, score: 5 }]
    }, { 'Authorization': `Bearer ${customerToken}` });

    console.log('Review submission status:', reviewRes.status);
    if (reviewRes.status !== 201) throw new Error('Failed to submit review');
    console.log('Points Awarded:', reviewRes.body.pointsAwarded);
    console.log('Vault points balance:', reviewRes.body.newPointsBalance);
    if (reviewRes.body.pointsAwarded !== 100) throw new Error('Incorrect review points awarded');
    if (reviewRes.body.newPointsBalance !== 100) throw new Error('User points balance did not update');

    // Confirm transaction is recorded
    const reviewTx = await VoucherTransaction.findOne({ user: customerId, transactionReason: 'review' });
    if (!reviewTx) throw new Error('No transaction ledger logged for review points credit');
    console.log('Voucher Transaction recorded:', reviewTx.transactionId, 'Points:', reviewTx.points, 'Balance:', reviewTx.balance);
    console.log('SUCCESS: Review text points awarded and logged.');

    // ============================================
    // TEST 3: RATING SUBMISSION (NO TEXT) -> REWARD RATING POINTS
    // ============================================
    console.log('\n[TEST 3] Submitting Review without text (Expected action: "rating" -> 50 pts)...');
    
    // We will register a second customer since the Review model has a unique index { user, outlet } and only allows one review per outlet per user.
    const customer2Reg = await request('POST', '/gehnaDekho/users/register', {
      name: 'Voucher Customer 2',
      email: 'vouchercustomer2@test.com',
      phone: '9988776644'
    });
    const customer2Token = customer2Reg.body.token;
    const customer2Id = customer2Reg.body.user._id;

    const ratingRes = await request('POST', '/gehnaDekho/reviews', {
      outletId,
      reviewText: '', // Empty text triggers action "rating"
      ratings: [{ criteria: criteriaId, score: 4 }]
    }, { 'Authorization': `Bearer ${customer2Token}` });

    console.log('Rating-only submission status:', ratingRes.status);
    if (ratingRes.status !== 201) throw new Error('Failed to submit rating-only review');
    console.log('Points Awarded:', ratingRes.body.pointsAwarded);
    console.log('Vault points balance:', ratingRes.body.newPointsBalance);
    if (ratingRes.body.pointsAwarded !== 50) throw new Error('Incorrect rating points awarded');
    if (ratingRes.body.newPointsBalance !== 50) throw new Error('User points balance did not update');

    const ratingTx = await VoucherTransaction.findOne({ user: customer2Id, transactionReason: 'rating' });
    if (!ratingTx) throw new Error('No transaction ledger logged for rating points credit');
    console.log('SUCCESS: Rating-only points awarded and logged.');

    // Cleanup customer 2 review so it doesn't conflict if run again
    await User.deleteMany({ email: 'vouchercustomer2@test.com' });

    // ============================================
    // TEST 4: FEEDBACK SUBMISSION -> REWARD FEEDBACK POINTS
    // ============================================
    console.log('\n[TEST 4] Submitting Private Feedback (Expected action: "feedback" -> 150 pts)...');
    const feedbackRes = await request('POST', '/gehnaDekho/feedback', {
      outletId,
      feedbackText: 'Private suggestions on packaging'
    }, { 'Authorization': `Bearer ${customerToken}` });

    console.log('Feedback submission status:', feedbackRes.status);
    if (feedbackRes.status !== 201) throw new Error('Failed to submit private feedback');
    console.log('Points Awarded:', feedbackRes.body.pointsAwarded);
    console.log('Vault points balance:', feedbackRes.body.newPointsBalance);
    if (feedbackRes.body.pointsAwarded !== 150) throw new Error('Incorrect feedback points awarded');
    // Previous balance was 100 + 150 = 250
    if (feedbackRes.body.newPointsBalance !== 250) throw new Error('User points balance did not update');

    const feedbackTx = await VoucherTransaction.findOne({ user: customerId, transactionReason: 'feedback' });
    if (!feedbackTx) throw new Error('No transaction ledger logged for feedback points');
    console.log('SUCCESS: Feedback points awarded and logged.');

    // ============================================
    // TEST 5: REDEMPTION LIMITS VALIDATION
    // ============================================
    console.log('\n[TEST 5] Testing redemption amount and sufficiency validations...');
    
    // Test 5A: Validate non-500 multiples
    const invalidAmountRes = await request('POST', '/gehnaDekho/redeem-requests', {
      points: 350 // Invalid amount
    }, { 'Authorization': `Bearer ${customerToken}` });
    console.log('Non-500 Multiple request status (Expected 400):', invalidAmountRes.status);
    if (invalidAmountRes.status !== 400) throw new Error('Allowed invalid redemption points amount');

    // Test 5B: Validate points sufficiency (User only has 250, request 500)
    const insufficientRes = await request('POST', '/gehnaDekho/redeem-requests', {
      points: 500 // Insufficient balance
    }, { 'Authorization': `Bearer ${customerToken}` });
    console.log('Insufficient balance request status (Expected 400):', insufficientRes.status);
    if (insufficientRes.status !== 400) throw new Error('Allowed redemption request despite insufficient balance');

    console.log('SUCCESS: Verified redemption limitations.');

    // ============================================
    // SETUP USER POINTS FOR REDEMPTION TESTS
    // ============================================
    // We will update the customer points directly in the DB to 1200 points to support redemptions
    const user = await User.findById(customerId);
    user.rewardPoints = 1200;
    await user.save();
    console.log('\nDirectly updated customer points to 1200 for redemption tests.');

    // ============================================
    // TEST 6: REDEEM REQUEST SUBMISSION -> IMMEDIATE DEDUCTION & HOLD
    // ============================================
    console.log('\n[TEST 6] Customer submitting valid redemption request for 500 points...');
    const redeemRes1 = await request('POST', '/gehnaDekho/redeem-requests', {
      points: 500
    }, { 'Authorization': `Bearer ${customerToken}` });

    console.log('Redeem request status:', redeemRes1.status);
    if (redeemRes1.status !== 201) throw new Error('Failed to submit redeem request');
    console.log('New User points balance (Expected 700):', redeemRes1.body.transaction.newPointsBalance);
    if (redeemRes1.body.transaction.newPointsBalance !== 700) throw new Error('Points not deducted immediately');

    const firstRequestId = redeemRes1.body.data._id;

    // Confirm VoucherTransaction is recorded as HOLD
    const holdTx = await VoucherTransaction.findOne({ referenceId: firstRequestId, status: 'hold' });
    if (!holdTx) throw new Error('Redemption transaction not placed on HOLD');
    console.log('SUCCESS: Redeem request registered on HOLD, balance deducted.');

    // ============================================
    // TEST 7: ADMIN APPROVE REDEEM REQUEST -> HOLD TO SUCCESS + MOCK MAIL
    // ============================================
    console.log('\n[TEST 7] Admin approving the 500-point redemption request...');
    const approveRes = await request('PUT', `/gehnaDekho/redeem-requests/${firstRequestId}/review`, {
      status: 'approved',
      adminMessage: 'Voucher code generated: DIALUXE500'
    }, { 'Authorization': `Bearer ${adminToken}` });

    console.log('Approval response status:', approveRes.status);
    if (approveRes.status !== 200) throw new Error('Admin failed to approve request');
    console.log('Updated Request Status:', approveRes.body.data.status);
    if (approveRes.body.data.status !== 'approved') throw new Error('Status not set to approved');

    // Confirm hold transaction transitioned to success
    const successTx = await VoucherTransaction.findById(holdTx._id);
    if (successTx.status !== 'success') throw new Error('Transaction status did not transition from HOLD to SUCCESS');
    console.log('SUCCESS: Redemption approved, transaction successfully closed.');

    // ============================================
    // TEST 8: ADMIN REJECT REDEEM REQUEST -> CANCELLED + COMPENSATION REFUND
    // ============================================
    console.log('\n[TEST 8] Customer submitting second request for 500 points...');
    
    // Balance is 700. Deduced to 200 on submit.
    const redeemRes2 = await request('POST', '/gehnaDekho/redeem-requests', {
      points: 500
    }, { 'Authorization': `Bearer ${customerToken}` });
    
    if (redeemRes2.status !== 201) throw new Error('Failed to submit second redeem request');
    const secondRequestId = redeemRes2.body.data._id;

    console.log('Admin rejecting the second redemption request (Expected refund of 500 pts)...');
    
    // Test rejection block without message
    const failRejectRes = await request('PUT', `/gehnaDekho/redeem-requests/${secondRequestId}/review`, {
      status: 'rejected'
      // Missing adminMessage
    }, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Rejection without explanation status (Expected 400):', failRejectRes.status);
    if (failRejectRes.status !== 400) throw new Error('Allowed rejection without explanation text');

    // Execute valid rejection
    const rejectRes = await request('PUT', `/gehnaDekho/redeem-requests/${secondRequestId}/review`, {
      status: 'rejected',
      adminMessage: 'Suspicious bot activity detected on your account'
    }, { 'Authorization': `Bearer ${adminToken}` });

    console.log('Rejection status:', rejectRes.status);
    if (rejectRes.status !== 200) throw new Error('Admin failed to reject request');
    console.log('Refund Transaction Balance (Expected 700):', rejectRes.body.refund.newPointsBalance);
    if (rejectRes.body.refund.newPointsBalance !== 700) throw new Error('Points not refunded back to user');

    // Confirm second transaction marked as cancelled
    const cancelledTx = await VoucherTransaction.findOne({ referenceId: secondRequestId });
    if (cancelledTx.status !== 'cancelled') throw new Error('Transaction status did not set to cancelled');

    // Confirm refund ledger logged
    const refundTx = await VoucherTransaction.findOne({ user: customerId, transactionReason: 'refund' });
    if (!refundTx) throw new Error('Compensation refund ledger not logged');
    console.log('Refund Transaction Logged:', refundTx.transactionId, 'Points:', refundTx.points, 'Balance:', refundTx.balance);
    console.log('SUCCESS: Redemption rejected, transaction cancelled, and points refunded.');

    console.log('\n=============================================');
    console.log('🎉 ALL VOUCHER POINTS & REDEMPTION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
