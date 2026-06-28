const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

// Force test environment configurations
process.env.PORT = 5006;
process.env.NODE_ENV = 'test';

// Require the models for database operations
const Admin = require('./models/Admin');
const User = require('./models/User');
const Outlet = require('./models/Outlet');
const Service = require('./models/Service');
const ServiceRequest = require('./models/ServiceRequest');
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
      port: 5006,
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
  console.log('--- Starting Support Services & Request Processing E2E Integration Test Suite ---\n');

  try {
    // 1. Connect to database and clean up test records
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gehnadekho');
    console.log('Connected to MongoDB for pre-test cleanup.');

    await Admin.deleteMany({ email: 'srvadmin@test.com' });
    await User.deleteMany({ email: 'srvowner@test.com' });
    await User.deleteMany({ phone: '9991113333' });
    await Outlet.deleteMany({ name: 'Services Emerald Plaza' });
    await Service.deleteMany({});
    await ServiceRequest.deleteMany({});
    await CreditTransaction.deleteMany({});
    
    console.log('Database cleaned. Starting Server...');

    // Boot Express Server
    const server = require('./server');

    // Wait slightly for server to bind
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let adminToken = '';
    let ownerToken = '';
    let outletId = '';
    let serviceId1 = '';
    let serviceId2 = '';
    let requestId1 = '';
    let requestId2 = '';

    // 2. Register Setup Admin
    console.log('\n[PRE-TEST 1] Registering Admin...');
    const adminRegRes = await request('POST', '/gehnaDekho/admin/register', {
      name: 'Services Admin',
      email: 'srvadmin@test.com',
      password: 'password123'
    });
    if (adminRegRes.status !== 201) throw new Error('Failed to register Admin');
    adminToken = adminRegRes.body.token;

    // 3. Register Owner account
    console.log('\n[PRE-TEST 2] Registering User...');
    const ownerRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'Services Owner',
      email: 'srvowner@test.com',
      phone: '9991113333',
      role: 'customer'
    });
    ownerToken = ownerRegRes.body.token;

    // 4. Create and Approve Outlet
    console.log('\n[PRE-TEST 3] Creating and Approving Outlet...');
    const outletRes = await request('POST', '/gehnaDekho/outlets', {
      name: 'Services Emerald Plaza',
      address: '100 Helpdesk Street',
      phone: '5551112222',
      email: 'srv@palace.com'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    outletId = outletRes.body._id;

    await request('PUT', `/gehnaDekho/outlets/${outletId}/status`, {
      status: 'approved',
      adminMessage: 'Approved for services testing.'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Provision 100 starting credits to the outlet wallet
    await request('PUT', `/gehnaDekho/outlets/${outletId}`, {
      creditWallet: { balance: 100 }
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Refresh Owner token to apply 'outlet_owner' role
    const loginRes = await request('POST', '/gehnaDekho/users/login', { phone: '9991113333' });
    const verifyRes = await request('POST', '/gehnaDekho/users/verify-otp', {
      phone: '9991113333',
      otp: loginRes.body.otp
    });
    ownerToken = verifyRes.body.token;
    console.log('Outlet created, approved, funded, and owner session upgraded.');


    // ============================================
    // START CORE SERVICES API TESTS
    // ============================================

    // TEST 1: Admin Creates Services CRUD Configurations
    console.log('\n[TEST 1] Admin configuring Support Services (Credit-Free)...');
    const srvRes1 = await request('POST', '/gehnaDekho/services', {
      name: '3D Try-On Setup',
      description: 'AR assets modeling fee'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Service 1 creation status:', srvRes1.status);
    if (srvRes1.status !== 201) throw new Error('Failed to create Service 1');
    serviceId1 = srvRes1.body.data._id;

    const srvRes2 = await request('POST', '/gehnaDekho/services', {
      name: 'Premium Banner Design',
      description: 'Homepage featured sliding banner layout'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Service 2 creation status:', srvRes2.status);
    if (srvRes2.status !== 201) throw new Error('Failed to create Service 2');
    serviceId2 = srvRes2.body.data._id;

    // Test duplicate configuration block
    const dupRes = await request('POST', '/gehnaDekho/services', {
      name: '3D Try-On Setup'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Duplicate Service status (Expected 400):', dupRes.status);
    if (dupRes.status !== 400) throw new Error('Duplicate service name checks failed');

    // TEST 2: Outlet Owner Requests Service (No Deductions & No Ledger Logs)
    console.log('\n[TEST 2] Owner requesting administrative service (Asserting Credit-Free)...');
    const reqRes1 = await request('POST', '/gehnaDekho/service-requests', {
      serviceId: serviceId1,
      description: 'Please setup 3D try-on for our emerald necklace item.'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Request 1 submission status:', reqRes1.status);
    if (reqRes1.status !== 201) throw new Error('Failed to submit service request');
    requestId1 = reqRes1.body.data._id;

    // Confirm wallet balance remains 100
    const outletCheck1 = await Outlet.findById(outletId);
    console.log('Outlet credit wallet balance (Expected 100):', outletCheck1.creditWallet.balance);
    if (outletCheck1.creditWallet.balance !== 100) {
      throw new Error(`Credits should not be debited: expected 100, got ${outletCheck1.creditWallet.balance}`);
    }

    // Verify no CreditTransaction ledger log exists for this request
    const txRes1 = await request('GET', '/gehnaDekho/credit-transactions', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    const loggedTx1 = txRes1.body.data.find(tx => tx.referenceId === requestId1);
    if (loggedTx1) throw new Error('Ledger log should NOT be created for credit-free service request!');
    console.log('SUCCESS: Service requested, no credits debited, and no transaction logged.');

    // TEST 3: Low/Zero credit balance works perfectly
    console.log('\n[TEST 3] Testing that low/zero credit balance does not block requesting services...');
    // Set wallet balance to 0 for the outlet to ensure free requests are allowed
    await request('PUT', `/gehnaDekho/outlets/${outletId}`, {
      creditWallet: { balance: 0 }
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    console.log('Submitting request with 0 credits in wallet...');
    const reqRes2 = await request('POST', '/gehnaDekho/service-requests', {
      serviceId: serviceId2,
      description: 'Request 2 banner layout'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Request 2 submission status:', reqRes2.status);
    if (reqRes2.status !== 201) throw new Error('Request 2 should succeed even with 0 credits');
    requestId2 = reqRes2.body.data._id;

    // Confirm wallet balance remains 0
    const outletCheck2 = await Outlet.findById(outletId);
    console.log('Outlet credit wallet balance (Expected 0):', outletCheck2.creditWallet.balance);
    if (outletCheck2.creditWallet.balance !== 0) {
      throw new Error(`Credits should remain 0: got ${outletCheck2.creditWallet.balance}`);
    }
    console.log('SUCCESS: Allowed service request with zero credits.');

    // TEST 4: Admin Updates Status (resolving request)
    console.log('\n[TEST 4] Admin updating Request 1 status pipeline (pending -> in_progress -> resolved)...');
    const progressRes = await request('PUT', `/gehnaDekho/service-requests/${requestId1}/status`, {
      status: 'in_progress',
      adminNotes: 'Designing asset file'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (progressRes.status !== 200) throw new Error('Failed to change status to in_progress');

    const resolveRes = await request('PUT', `/gehnaDekho/service-requests/${requestId1}/status`, {
      status: 'resolved',
      adminNotes: 'AR setup completed'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (resolveRes.status !== 200) throw new Error('Failed to change status to resolved');
    if (resolveRes.body.data.status !== 'resolved') throw new Error('Request status mismatch');
    console.log('SUCCESS: Admin resolved support request successfully.');

    // TEST 5: Admin Cancels (Asserting no credits refunded/changed)
    console.log('\n[TEST 5] Admin cancelling Request 2 (Asserting no credit refunding flow)...');
    const cancelRes = await request('PUT', `/gehnaDekho/service-requests/${requestId2}/status`, {
      status: 'cancelled',
      adminNotes: 'Cancelled request.'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Cancel status:', cancelRes.status);
    if (cancelRes.status !== 200) throw new Error('Failed to cancel request');

    // Confirm wallet balance remains 0
    const outletCheckFinal = await Outlet.findById(outletId);
    console.log('Refreshed final outlet wallet balance (Expected 0):', outletCheckFinal.creditWallet.balance);
    if (outletCheckFinal.creditWallet.balance !== 0) {
      throw new Error(`Final balance should still be 0, got ${outletCheckFinal.creditWallet.balance}`);
    }

    // Confirm no refund CreditTransaction exists
    const txRes2 = await request('GET', '/gehnaDekho/credit-transactions', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    const refundTx = txRes2.body.data.find(tx => tx.referenceId === requestId2);
    if (refundTx) throw new Error('No ledger refund transaction should exist!');
    console.log('SUCCESS: Support request cancelled, wallet balance remained unchanged, and no ledger logged.');

    console.log('\n======================================================');
    console.log('🎉 ALL SUPPORT SERVICES & REFUNDING PIPELINE TESTS PASSED! 🎉');
    console.log('======================================================');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
