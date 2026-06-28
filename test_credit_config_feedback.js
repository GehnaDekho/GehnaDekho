const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

// Force test environment configurations
process.env.PORT = 5004;
process.env.NODE_ENV = 'test';

// Require the models for database operations
const Admin = require('./models/Admin');
const User = require('./models/User');
const Outlet = require('./models/Outlet');
const CreditConfig = require('./models/CreditConfig');
const Feedback = require('./models/Feedback');
const CreditTransaction = require('./models/CreditTransaction');

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
      port: 5004,
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
  console.log('--- Starting Credit Config & Private Feedback View/Unlock Integration Test Suite ---\n');

  try {
    // 1. Connect to database and clean up test records
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gehnadekho');
    console.log('Connected to MongoDB for pre-test cleanup.');

    await Admin.deleteMany({ email: 'feedbackadmin@test.com' });
    await User.deleteMany({ email: { $in: ['feedbackowner@test.com', 'feedbackcustomer@test.com'] } });
    await User.deleteMany({ phone: { $in: ['9990002222', '8880003333'] } });
    await CreditConfig.deleteMany({ actionName: 'feedback_view' });
    await Feedback.deleteMany({});
    await CreditTransaction.deleteMany({ transactionReason: 'feedback_view' });
    
    console.log('Database cleaned. Starting Server...');

    // Boot Express Server
    const server = require('./server');

    // Wait for database and server to bind
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let adminToken = '';
    let ownerToken = '';
    let customerToken = '';
    let outletId = '';
    let feedbackId = '';
    let creditConfigId = '';

    // 2. Register Setup Admin
    console.log('\n[PRE-TEST 1] Registering Admin...');
    const adminRegRes = await request('POST', '/gehnaDekho/admin/register', {
      name: 'Feedback Admin',
      email: 'feedbackadmin@test.com',
      password: 'password123'
    });
    if (adminRegRes.status !== 201) throw new Error('Failed to register Admin');
    adminToken = adminRegRes.body.token;
    console.log('Admin registered successfully.');

    // 3. Register Customer & Outlet Owner Users
    console.log('\n[PRE-TEST 2] Registering Customer & Owner accounts...');
    const ownerRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'Feedback Owner',
      email: 'feedbackowner@test.com',
      phone: '9990002222',
      role: 'customer'
    });
    if (ownerRegRes.status !== 201) throw new Error('Failed to register Owner');
    ownerToken = ownerRegRes.body.token;

    const customerRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'Feedback Customer',
      email: 'feedbackcustomer@test.com',
      phone: '8880003333',
      role: 'customer'
    });
    if (customerRegRes.status !== 201) throw new Error('Failed to register Customer');
    customerToken = customerRegRes.body.token;
    console.log('Users registered successfully.');

    // 4. Create and approve Outlet for the owner
    console.log('\n[PRE-TEST 3] Creating and Approving Outlet...');
    const outletRes = await request('POST', '/gehnaDekho/outlets', {
      name: 'Diamond Feedback Palace',
      address: '999 Ruby Boulevard',
      phone: '7770001111',
      email: 'feedback@palace.com'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    if (outletRes.status !== 201) throw new Error('Failed to create Outlet');
    outletId = outletRes.body._id;

    // Approve outlet to trigger user role upgrade to 'outlet_owner'
    const approvalRes = await request('PUT', `/gehnaDekho/outlets/${outletId}/status`, {
      status: 'approved',
      adminMessage: 'Approved for feedback E2E testing.'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (approvalRes.status !== 200) throw new Error('Failed to approve Outlet');

    // Provision 10 starting credits to the outlet wallet
    const topupRes = await request('PUT', `/gehnaDekho/outlets/${outletId}`, {
      creditWallet: { balance: 10 }
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (topupRes.status !== 200) throw new Error('Failed to provision outlet wallet credits');

    // Refresh Owner token to apply 'outlet_owner' role and outletId
    const loginRes = await request('POST', '/gehnaDekho/users/login', { phone: '9990002222' });
    const verifyRes = await request('POST', '/gehnaDekho/users/verify-otp', {
      phone: '9990002222',
      otp: loginRes.body.otp
    });
    if (verifyRes.status !== 200) throw new Error('Failed to verify Owner OTP login');
    ownerToken = verifyRes.body.token;
    console.log('Outlet created, approved, funded, and owner session upgraded.');


    // ====================================================
    // START CORE CREDIT CONFIG & PRIVATE FEEDBACK TESTS
    // ====================================================

    // TEST 1: Admin Creates Credit Configuration
    console.log('\n[TEST 1] Admin configuring feedback view credit cost...');
    const configRes = await request('POST', '/gehnaDekho/credit-configs', {
      actionName: 'feedback_view',
      creditsRequired: 5,
      description: 'Viewing private direct feedback cost'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Config creation status:', configRes.status);
    if (configRes.status !== 201) throw new Error('Failed to create CreditConfig');
    creditConfigId = configRes.body.data._id;
    if (configRes.body.data.creditsRequired !== 5) throw new Error('CreditConfig credits mismatch');

    // TEST 2: Duplicate Credit Config Prevention
    console.log('\n[TEST 2] Verifying duplicate credit config prevention...');
    const duplicateRes = await request('POST', '/gehnaDekho/credit-configs', {
      actionName: 'feedback_view',
      creditsRequired: 8
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Duplicate Config status (Expected 400):', duplicateRes.status);
    if (duplicateRes.status !== 400) throw new Error('Expected duplicate configuration to fail with 400');
    console.log('Duplicate Config Message:', duplicateRes.body.message);

    // TEST 3: Customer Submits Private Feedback
    console.log('\n[TEST 3] Customer submitting private feedback to the outlet...');
    const submitRes = await request('POST', '/gehnaDekho/feedback', {
      outletId,
      feedbackText: 'Beautiful items but the cashier line was very slow.'
    }, {
      'Authorization': `Bearer ${customerToken}`
    });
    console.log('Feedback submission status:', submitRes.status);
    if (submitRes.status !== 201) throw new Error('Failed to submit feedback');
    feedbackId = submitRes.body.data._id;

    // TEST 4: Outlet Owner Blocked from leaving Feedback
    console.log('\n[TEST 4] Verifying outlet owners are blocked from leaving feedback...');
    const ownerFeedbackRes = await request('POST', '/gehnaDekho/feedback', {
      outletId,
      feedbackText: 'Fraud self feedback attempt.'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Self feedback status (Expected 400):', ownerFeedbackRes.status);
    if (ownerFeedbackRes.status !== 400) throw new Error('Expected owner feedback submission to fail with 400');
    console.log('Owner Feedback Error:', ownerFeedbackRes.body.message);

    // TEST 5: Owner Retrieves Feedback List (Should be Masked)
    console.log('\n[TEST 5] Owner listing feedbacks (Asserting text masking)...');
    const listRes = await request('GET', '/gehnaDekho/feedback/outlet', null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Get feedback list status:', listRes.status);
    if (listRes.status !== 200) throw new Error('Failed to list feedbacks');
    console.log('Feedbacks count:', listRes.body.count);
    
    const feedbackItem = listRes.body.data.find(f => f._id === feedbackId);
    if (!feedbackItem) throw new Error('Submitted feedback not found in owner list');
    console.log('Feedback Text in List:', feedbackItem.feedbackText);
    if (feedbackItem.isUnlocked !== false) throw new Error('Feedback should be locked initially');
    if (!feedbackItem.feedbackText.includes('[LOCKED')) {
      throw new Error('Feedback text was not correctly masked inside listing endpoint!');
    }
    console.log('SUCCESS: Confirmed feedback text is locked and masked.');

    // TEST 6: Unlock Feedback with Insufficient Credits
    console.log('\n[TEST 6] Admin raising unlock cost to 15 (creates insufficient wallet balance condition)...');
    const updateConfigRes = await request('PUT', `/gehnaDekho/credit-configs/${creditConfigId}`, {
      creditsRequired: 15
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (updateConfigRes.status !== 200) throw new Error('Failed to update CreditConfig');

    console.log('Owner attempting to unlock feedback with insufficient balance (10 balance, 15 cost)...');
    const unlockFailRes = await request('POST', `/gehnaDekho/feedback/${feedbackId}/unlock`, null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Unlock status (Expected 400):', unlockFailRes.status);
    if (unlockFailRes.status !== 400) throw new Error('Expected unlock to fail with 400');
    console.log('Unlock fail message:', unlockFailRes.body.message);

    // TEST 7: Unlock Feedback with Sufficient Credits
    console.log('\n[TEST 7] Admin lowering unlock cost to 4 (outlet has 10)...');
    const updateConfigRes2 = await request('PUT', `/gehnaDekho/credit-configs/${creditConfigId}`, {
      creditsRequired: 4
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (updateConfigRes2.status !== 200) throw new Error('Failed to restore CreditConfig cost');

    console.log('Owner unlocking feedback (deducting 4 credits)...');
    const unlockSuccessRes = await request('POST', `/gehnaDekho/feedback/${feedbackId}/unlock`, null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Unlock status:', unlockSuccessRes.status);
    if (unlockSuccessRes.status !== 200) throw new Error('Failed to unlock feedback');
    console.log('Returned Feedback text:', unlockSuccessRes.body.data.feedbackText);
    if (unlockSuccessRes.body.data.isUnlocked !== true) throw new Error('Feedback isUnlocked should be true');
    if (unlockSuccessRes.body.data.feedbackText !== 'Beautiful items but the cashier line was very slow.') {
      throw new Error('Unlocked feedback text mismatch');
    }
    console.log('Credits Deducted:', unlockSuccessRes.body.creditsDeducted);
    console.log('New Wallet Balance:', unlockSuccessRes.body.newWalletBalance);
    if (unlockSuccessRes.body.newWalletBalance !== 6) throw new Error('Outlet balance should be 6');
    console.log('Transaction ID recorded:', unlockSuccessRes.body.transaction.transactionId);
    console.log('SUCCESS: Feedback unlocked, credits deducted, and response matches expectation.');

    // TEST 8: Verify CreditTransaction database ledger log
    console.log('\n[TEST 8] Verifying recorded database Transaction ledger...');
    const txRes = await request('GET', '/gehnaDekho/credit-transactions', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    const loggedTx = txRes.body.data.find(tx => tx.referenceId === feedbackId);
    if (!loggedTx) throw new Error('CreditTransaction ledger record not found for this feedback unlock!');
    console.log('Logged Transaction credits:', loggedTx.credits);
    console.log('Logged Transaction type:', loggedTx.transactionType);
    console.log('Logged Transaction reason:', loggedTx.transactionReason);
    console.log('Logged Transaction balance audit:', loggedTx.balance);
    if (loggedTx.credits !== 4 || loggedTx.transactionType !== 'debit' || loggedTx.transactionReason !== 'feedback_view' || loggedTx.balance !== 6) {
      throw new Error('Transaction ledger properties incorrect');
    }
    console.log('SUCCESS: Confirmed correct transaction ledger record.');

    // TEST 9: Duplicate Unlock charging protection (Fair billing check)
    console.log('\n[TEST 9] Attempting to unlock the same feedback again (should NOT charge again)...');
    const secondUnlockRes = await request('POST', `/gehnaDekho/feedback/${feedbackId}/unlock`, null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Second unlock status:', secondUnlockRes.status);
    if (secondUnlockRes.status !== 200) throw new Error('Failed to call second unlock');
    console.log('Second unlock message:', secondUnlockRes.body.message);
    
    // Fetch outlet again via database to make absolutely sure balance is still 6
    const outletCheck = await Outlet.findById(outletId);
    console.log('Outlet wallet balance after duplicate request:', outletCheck.creditWallet.balance);
    if (outletCheck.creditWallet.balance !== 6) {
      throw new Error('Outlet wallet was double-deducted on redundant unlock requests!');
    }
    console.log('SUCCESS: Double deduction check passed.');

    // TEST 10: Owner Retrieves Feedback List (Should be fully visible/unmasked)
    console.log('\n[TEST 10] Owner listing feedbacks again (Asserting text visibility)...');
    const listRes2 = await request('GET', '/gehnaDekho/feedback/outlet', null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    const feedbackItem2 = listRes2.body.data.find(f => f._id === feedbackId);
    console.log('Feedback Text in List now:', feedbackItem2.feedbackText);
    if (feedbackItem2.isUnlocked !== true) throw new Error('Feedback should be unlocked');
    if (feedbackItem2.feedbackText !== 'Beautiful items but the cashier line was very slow.') {
      throw new Error('Feedback text was incorrectly masked or hidden even after unlocking!');
    }
    console.log('SUCCESS: Confirmed feedback text is fully visible in standard listing after unlock.');

    console.log('\n======================================================');
    console.log('🎉 ALL CREDIT CONFIG & PRIVATE FEEDBACK TESTS PASSED! 🎉');
    console.log('======================================================');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
