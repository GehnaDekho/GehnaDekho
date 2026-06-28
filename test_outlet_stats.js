const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

// Force test environment configurations
process.env.PORT = 5005;
process.env.NODE_ENV = 'test';

// Require the models for database operations
const Admin = require('./models/Admin');
const User = require('./models/User');
const Outlet = require('./models/Outlet');
const Slot = require('./models/Slot');
const Category = require('./models/Category');
const Jewellery = require('./models/Jewellery');
const FeaturedJewelleryHistory = require('./models/FeaturedJewelleryHistory');
const Feedback = require('./models/Feedback');
const Review = require('./models/Review');
const RatingCriteria = require('./models/RatingCriteria');
const CreditTransaction = require('./models/CreditTransaction');
const CreditConfig = require('./models/CreditConfig');

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
      port: 5005,
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
  console.log('--- Starting Outlet Analytics Stats E2E Integration Test Suite ---\n');

  try {
    // 1. Connect to database and clean up test records
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gehnadekho');
    console.log('Connected to MongoDB for pre-test cleanup.');

    await Admin.deleteMany({ email: 'statsadmin@test.com' });
    await User.deleteMany({ email: { $in: ['statsowner@test.com', 'statscust1@test.com', 'statscust2@test.com'] } });
    await User.deleteMany({ phone: { $in: ['9991118888', '8881119999', '7771110000'] } });
    await Outlet.deleteMany({ name: 'Stats Emerald Palace' });
    await Slot.deleteMany({ slotNumber: 88 });
    await Category.deleteMany({ name: 'StatsCategory' });
    await Jewellery.deleteMany({ name: /Stats Jewel/i });
    await FeaturedJewelleryHistory.deleteMany({});
    await Feedback.deleteMany({});
    await Review.deleteMany({});
    await RatingCriteria.deleteMany({ name: 'Stats Service Quality' });
    await CreditTransaction.deleteMany({});
    await CreditConfig.deleteMany({ actionName: 'feedback_view' });
    
    console.log('Database cleaned. Starting Server...');

    // Boot Express Server
    const server = require('./server');

    // Wait slightly for server to bind
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let adminToken = '';
    let ownerToken = '';
    let cust1Token = '';
    let cust2Token = '';
    let outletId = '';
    let slotId = '';
    let categoryId = '';
    let jewelId1 = '';
    let jewelId2 = '';
    let jewelId3 = '';

    // 2. Register Setup Admin
    console.log('\n[PRE-TEST 1] Registering Admin...');
    const adminRegRes = await request('POST', '/gehnaDekho/admin/register', {
      name: 'Stats Admin',
      email: 'statsadmin@test.com',
      password: 'password123'
    });
    if (adminRegRes.status !== 201) throw new Error('Failed to register Admin');
    adminToken = adminRegRes.body.token;

    // 3. Register Users
    console.log('\n[PRE-TEST 2] Registering Owner & Customer accounts...');
    const ownerRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'Stats Owner',
      email: 'statsowner@test.com',
      phone: '9991118888',
      role: 'customer'
    });
    ownerToken = ownerRegRes.body.token;

    const cust1RegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'Stats Customer 1',
      email: 'statscust1@test.com',
      phone: '8881119999',
      role: 'customer'
    });
    cust1Token = cust1RegRes.body.token;

    const cust2RegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'Stats Customer 2',
      email: 'statscust2@test.com',
      phone: '7771110000',
      role: 'customer'
    });
    cust2Token = cust2RegRes.body.token;

    // 4. Create and Approve Outlet
    console.log('\n[PRE-TEST 3] Creating and Approving Outlet...');
    const outletRes = await request('POST', '/gehnaDekho/outlets', {
      name: 'Stats Emerald Palace',
      address: '123 Analytics Avenue',
      phone: '4441112222',
      email: 'stats@palace.com'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    outletId = outletRes.body._id;

    await request('PUT', `/gehnaDekho/outlets/${outletId}/status`, {
      status: 'approved',
      adminMessage: 'Approved for stats testing.'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Provision 150 starting credits to the outlet wallet
    await request('PUT', `/gehnaDekho/outlets/${outletId}`, {
      creditWallet: { balance: 150 }
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Refresh Owner token to apply 'outlet_owner' role
    const loginRes = await request('POST', '/gehnaDekho/users/login', { phone: '9991118888' });
    const verifyRes = await request('POST', '/gehnaDekho/users/verify-otp', {
      phone: '9991118888',
      otp: loginRes.body.otp
    });
    ownerToken = verifyRes.body.token;
    console.log('Outlet created, approved, funded, and owner session upgraded.');

    // 5. Seed Configurations & Catalogue Items
    console.log('\n[PRE-TEST 4] Seeding Categories, Slots, and Rating Criteria configurations...');
    // Create slot configuration (Slot 88, cost 35 credits)
    const slotRes = await request('POST', '/gehnaDekho/slots', {
      slotNumber: 88,
      price: 35,
      description: 'Stats Premium Spot'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    slotId = slotRes.body._id;

    // Create feedback unlock cost (action feedback_view, cost 5 credits)
    await request('POST', '/gehnaDekho/credit-configs', {
      actionName: 'feedback_view',
      creditsRequired: 5,
      description: 'Stats Feedback Unlock Cost'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Create Rating Criteria (Stats Service Quality, weightage 1)
    const criteriaRes = await RatingCriteria.create({
      name: 'Stats Service Quality',
      category: 'Highly Impacted',
      weightage: 1
    });

    // Create Category
    const catRes = await request('POST', '/gehnaDekho/categories', { name: 'StatsCategory', image: 'stats.png' }, { 'Authorization': `Bearer ${adminToken}` });
    categoryId = catRes.body._id;

    // Upload 3 Jewellery Catalogue Items
    console.log('Uploading 3 jewellery catalogue items...');
    const jewel1 = await request('POST', '/gehnaDekho/jewelleries', { name: 'Stats Jewel Gold', category: categoryId, images: ['g.png'], material: 'Gold', weight: 8, purity: '22K', price: 45000 }, { 'Authorization': `Bearer ${ownerToken}` });
    const jewel2 = await request('POST', '/gehnaDekho/jewelleries', { name: 'Stats Jewel Silver', category: categoryId, images: ['s.png'], material: 'Silver', weight: 12, purity: '925', price: 5000 }, { 'Authorization': `Bearer ${ownerToken}` });
    const jewel3 = await request('POST', '/gehnaDekho/jewelleries', { name: 'Stats Jewel Platinum', category: categoryId, images: ['p.png'], material: 'Platinum', weight: 10, purity: '950', price: 95000 }, { 'Authorization': `Bearer ${ownerToken}` });
    jewelId1 = jewel1.body.jewellery._id;
    jewelId2 = jewel2.body.jewellery._id;
    jewelId3 = jewel3.body.jewellery._id;


    // ============================================
    // SEED STATISTICS ACTIONS
    // ============================================

    // 1. Feature 1 Jewellery Item (Deducts 35 credits)
    console.log('\n[PRE-TEST 5] Seeding showcase log (Deducts 35 credits)...');
    const featRes = await request('POST', '/gehnaDekho/featured-history', {
      slot: slotId,
      jewellery: jewelId1,
      outlet: outletId
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    if (featRes.status !== 201) throw new Error('Failed to feature jewellery');

    // 2. Submit 2 Feedbacks, Unlock 1 (Deducts 5 credits)
    console.log('Seeding private customer feedbacks...');
    const fbRes1 = await request('POST', '/gehnaDekho/feedback', { outletId, feedbackText: 'Feedback text 1' }, { 'Authorization': `Bearer ${cust1Token}` });
    const fbRes2 = await request('POST', '/gehnaDekho/feedback', { outletId, feedbackText: 'Feedback text 2' }, { 'Authorization': `Bearer ${cust2Token}` });
    
    // Unlock feedback 1
    const unlockRes = await request('POST', `/gehnaDekho/feedback/${fbRes1.body.data._id}/unlock`, null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    if (unlockRes.status !== 200) throw new Error('Failed to unlock feedback');

    // 3. Submit 2 Public Reviews (Scores 5 and 4 -> Average 4.5)
    console.log('Seeding public customer reviews...');
    await Review.create({
      user: cust1RegRes.body.user._id,
      outlet: outletId,
      reviewText: 'Great store!',
      ratings: [{ criteria: criteriaRes._id, score: 5 }],
      averageScore: 5
    });

    await Review.create({
      user: cust2RegRes.body.user._id,
      outlet: outletId,
      reviewText: 'Nice items',
      ratings: [{ criteria: criteriaRes._id, score: 4 }],
      averageScore: 4
    });

    // 4. Log 1 Reel Post (Deducts 10 credits) and 1 Service Request (Deducts 15 credits) in ledger
    console.log('Logging dynamic Reel Post and Service Request debit records in ledger...');
    const outletObj = await Outlet.findById(outletId);
    let balance = outletObj.creditWallet.balance; // currently 150 - 35 (feature) - 5 (unlock) = 110

    // Reel Post (10 credits)
    balance -= 10;
    await CreditTransaction.create({
      outletId,
      credits: 10,
      balance,
      transactionType: 'debit',
      transactionReason: 'reel_post',
      status: 'success',
      remark: 'Reel post logging'
    });

    // Service Request (15 credits)
    balance -= 15;
    await CreditTransaction.create({
      outletId,
      credits: 15,
      balance,
      transactionType: 'debit',
      transactionReason: 'service_request',
      status: 'success',
      remark: 'Service request logging'
    });

    // Save updated wallet balance back to outlet
    outletObj.creditWallet.balance = balance;
    await outletObj.save();


    // ============================================
    // START OUTLET STATISTICS API TEST
    // ============================================

    console.log('\n[TEST 1] Retrieving Outlet statistics aggregates...');
    const statsRes = await request('GET', `/gehnaDekho/outlets/${outletId}/stats`, null, {
      'Authorization': `Bearer ${ownerToken}`
    });

    console.log('Stats retrieval status:', statsRes.status);
    if (statsRes.status !== 200) throw new Error('Failed to retrieve stats');
    
    const stats = statsRes.body.data;
    console.log('Outlet Stats Data payload:', JSON.stringify(stats, null, 2));

    // Assert counts
    if (stats.activity.jewelleriesUploaded !== 3) throw new Error('Incorrect jewelleriesUploaded count');
    if (stats.activity.jewelleriesFeatured !== 1) throw new Error('Incorrect jewelleriesFeatured count');
    if (stats.activity.reelsUploaded !== 1) throw new Error('Incorrect reelsUploaded count');
    if (stats.activity.servicesRequested !== 1) throw new Error('Incorrect servicesRequested count');

    // Assert credits
    if (stats.credits.totalCreditsUsed !== 65) {
      // 35 (feature) + 5 (unlock) + 10 (reel) + 15 (service) = 65 credits used
      throw new Error(`Incorrect totalCreditsUsed: expected 65, got ${stats.credits.totalCreditsUsed}`);
    }
    if (stats.credits.creditsUsedToFeature !== 35) throw new Error('Incorrect creditsUsedToFeature cost');
    if (stats.credits.creditsSpentToViewFeedback !== 5) throw new Error('Incorrect creditsSpentToViewFeedback cost');
    if (stats.credits.creditsSpentOther !== 25) {
      // 10 (reel) + 15 (service) = 25 other usage
      throw new Error(`Incorrect creditsSpentOther: expected 25, got ${stats.credits.creditsSpentOther}`);
    }
    if (stats.currentWalletBalance !== 85) {
      // 150 - 65 = 85
      throw new Error(`Incorrect currentWalletBalance: expected 85, got ${stats.currentWalletBalance}`);
    }

    // Assert reviews and feedback
    if (stats.reviewsAndFeedback.reviewsCount !== 2) throw new Error('Incorrect reviewsCount');
    if (stats.reviewsAndFeedback.overallRating !== 4.5) throw new Error('Incorrect overallRating');
    if (stats.reviewsAndFeedback.feedbackCount !== 2) throw new Error('Incorrect feedbackCount');
    if (stats.reviewsAndFeedback.viewedFeedbackCount !== 1) throw new Error('Incorrect viewedFeedbackCount');

    console.log('SUCCESS: All stats assertions passed.');

    // TEST 2: Authorization security checks
    console.log('\n[TEST 2] Verifying that unrelated customers are denied access...');
    const forbiddenRes = await request('GET', `/gehnaDekho/outlets/${outletId}/stats`, null, {
      'Authorization': `Bearer ${cust1Token}`
    });
    console.log('Customer access status (Expected 403):', forbiddenRes.status);
    if (forbiddenRes.status !== 403) throw new Error('Expected 403 Forbidden for unrelated user requests');
    console.log('Customer access error:', forbiddenRes.body.message);
    console.log('SUCCESS: Security checks passed.');

    console.log('\n======================================================');
    console.log('🎉 ALL OUTLET STATISTICS DASHBOARD TESTS PASSED! 🎉');
    console.log('======================================================');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
