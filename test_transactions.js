const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

// Force test environment configurations
process.env.PORT = 5003;
process.env.NODE_ENV = 'test';

// Require the models for database operations
const User = require('./models/User');
const Admin = require('./models/Admin');
const Outlet = require('./models/Outlet');
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
  console.log('--- Starting Credit Transactions E2E Integration Test Suite ---\n');

  try {
    // Connect to database to clean up test records
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gehnadekho');
    console.log('Connected to MongoDB for pre-test cleanup.');

    // Delete existing test documents to ensure deterministic test runs
    await Admin.deleteMany({ email: 'txadmin@test.com' });
    await User.deleteMany({ email: 'txowner@test.com' });
    await Outlet.deleteMany({ name: 'Test TX Shop' });
    await CreditTransaction.deleteMany({});
    console.log('Database cleaned. Starting Server...');

    // Boot Express Server
    const server = require('./server');

    // Wait slightly for connections to establish
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let adminToken = '';
    let ownerToken = '';
    let outletId = '';
    let firstTxId = '';
    let pendingTxId = '';

    // 1. Register Setup Admin
    console.log('\n[PRE-TEST 1] Registering Admin...');
    const adminRegRes = await request('POST', '/gehnaDekho/admin/register', {
      name: 'TX Admin',
      email: 'txadmin@test.com',
      password: 'password123'
    });
    if (adminRegRes.status !== 201) throw new Error('Failed to register Admin');
    adminToken = adminRegRes.body.token;

    // 2. Register Owner & Provision Approved Outlet with 50 starting credits
    console.log('\n[PRE-TEST 2] Registering User & Outlet Onboarding...');
    const userRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'TX Owner',
      email: 'txowner@test.com',
      phone: '9990001111',
      role: 'customer'
    });
    ownerToken = userRegRes.body.token;

    const outletRes = await request('POST', '/gehnaDekho/outlets', {
      name: 'Test TX Shop',
      address: '777 Emerald Road',
      phone: '6660001111',
      email: 'tx@shop.com'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    outletId = outletRes.body._id;

    // Admin approves outlet
    await request('PUT', `/gehnaDekho/outlets/${outletId}/status`, {
      status: 'approved',
      adminMessage: 'Approved for TX testing.'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Top-up credits to 50
    await request('PUT', `/gehnaDekho/outlets/${outletId}`, {
      creditWallet: { balance: 50 }
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Refresh token role
    const loginRes = await request('POST', '/gehnaDekho/users/login', { phone: '9990001111' });
    const verifyRes = await request('POST', '/gehnaDekho/users/verify-otp', { phone: '9990001111', otp: loginRes.body.otp });
    ownerToken = verifyRes.body.token;

    // ============================================
    // START CREDIT TRANSACTION API TESTS
    // ============================================

    // TEST 1: Admin Create Manual Debit Transaction
    console.log('\n[TEST 1] Admin logging manual debit of 15 credits...');
    const txRes1 = await request('POST', '/gehnaDekho/credit-transactions', {
      outletId,
      credits: 15,
      transactionType: 'debit',
      transactionReason: 'jewellery_upload',
      remark: 'Manual debit for test uploads',
      description: 'Logged manually by admin console'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Debit Creation status (Expected 201):', txRes1.status);
    if (txRes1.status !== 201) throw new Error('Failed to create manual debit transaction');
    firstTxId = txRes1.body.data._id;
    console.log('Deducted Balance logged in TX:', txRes1.body.data.balance);
    if (txRes1.body.data.balance !== 35) throw new Error('Wallet balance not updated correctly in debit');

    // Assert database sync
    const checkOutlet1 = await Outlet.findById(outletId);
    console.log('Outlet Wallet Balance in DB (Expected 35):', checkOutlet1.creditWallet.balance);
    if (checkOutlet1.creditWallet.balance !== 35) throw new Error('Outlet balance not synced in DB');

    // TEST 2: Admin Create Manual Credit Transaction (Top-up)
    console.log('\n[TEST 2] Admin logging manual credit of 20 credits...');
    const txRes2 = await request('POST', '/gehnaDekho/credit-transactions', {
      outletId,
      credits: 20,
      transactionType: 'credit',
      transactionReason: 'recharge',
      remark: 'Manual NEFT Recharge top-up',
      invoiceId: 'INV-2026-001'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Credit Creation status (Expected 201):', txRes2.status);
    if (txRes2.status !== 201) throw new Error('Failed to create manual credit transaction');
    console.log('Added Balance logged in TX:', txRes2.body.data.balance);
    if (txRes2.body.data.balance !== 55) throw new Error('Wallet balance not updated correctly in credit');

    // TEST 3: Block debit transaction on insufficient balance
    console.log('\n[TEST 3] Asserting credit-limit blockage on debits greater than balance...');
    const txRes3 = await request('POST', '/gehnaDekho/credit-transactions', {
      outletId,
      credits: 100, // exceeds 55
      transactionType: 'debit',
      transactionReason: 'service_request'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Limit block status (Expected 400):', txRes3.status);
    if (txRes3.status !== 400) throw new Error('Should block debit when balance is insufficient');
    console.log('Blocked response message:', txRes3.body.message);

    // TEST 4: Create PENDING transaction and update status to SUCCESS
    console.log('\n[TEST 4] Admin logging pending credit of 30 credits...');
    const pendingTx = await request('POST', '/gehnaDekho/credit-transactions', {
      outletId,
      credits: 30,
      transactionType: 'credit',
      transactionReason: 'recharge',
      status: 'pending',
      remark: 'Pending bank clearance'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    pendingTxId = pendingTx.body.data._id;
    console.log('Pending TX created. Initial balance logged (wallet untouched):', pendingTx.body.data.balance);

    // Finalize pending transaction to SUCCESS
    console.log('[TEST 4.2] Finalizing pending transaction to success...');
    const finalizeRes = await request('PUT', `/gehnaDekho/credit-transactions/${pendingTxId}/status`, {
      status: 'success'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Finalize status (Expected 200):', finalizeRes.status);
    if (finalizeRes.status !== 200) throw new Error('Failed to finalize status');
    console.log('Finalized wallet balance (Expected 85):', finalizeRes.body.data.balance);
    if (finalizeRes.body.data.balance !== 85) throw new Error('Balance not top-up adjusted upon success transition');

    // TEST 5: Owner retrieves list of transactions (paginated & searched)
    console.log('\n[TEST 5] Outlet owner retrieving transaction history logs...');
    const listRes = await request('GET', '/gehnaDekho/credit-transactions?limit=2', null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('List status:', listRes.status, 'Total logged count:', listRes.body.pagination.total);
    if (listRes.status !== 200) throw new Error('Failed to retrieve list');
    if (listRes.body.data.length !== 2) throw new Error('Pagination limit filter not applied');
    
    // Check populated details
    const populatedItem = listRes.body.data[0];
    console.log('Populated Outlet Name on Item:', populatedItem.outletId.name);
    if (!populatedItem.outletId.name) throw new Error('Outlet references are not populated correctly');

    // TEST 6: Get Single Transaction detail by ID
    console.log('\n[TEST 6] Fetching single transaction details by ID...');
    const singleRes = await request('GET', `/gehnaDekho/credit-transactions/${firstTxId}`, null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Single fetch status:', singleRes.status, 'Fetched reason:', singleRes.body.data.transactionReason);
    if (singleRes.status !== 200) throw new Error('Failed to fetch transaction by ID');
    if (singleRes.body.data.credits !== 15) throw new Error('Incorrect transaction transacted credits returned');

    // TEST 7: Retrieve Outlet aggregate stats
    console.log('\n[TEST 7] Fetching analytical stats & breakdown logs for the Outlet...');
    const statsRes = await request('GET', `/gehnaDekho/credit-transactions/outlet/${outletId}/stats`, null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Stats status:', statsRes.status, 'Current Wallet Balance:', statsRes.body.currentBalance);
    if (statsRes.status !== 200) throw new Error('Failed to retrieve stats');
    console.log('Aggregated summary breakdown:', JSON.stringify(statsRes.body.summary));
    console.log('Reasons breakdown:', JSON.stringify(statsRes.body.reasonsBreakdown));

    console.log('\n=============================================');
    console.log('🎉 ALL CREDIT TRANSACTION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
