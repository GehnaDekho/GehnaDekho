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
const Slot = require('./models/Slot');
const Category = require('./models/Category');
const Jewellery = require('./models/Jewellery');
const FeaturedJewelleryHistory = require('./models/FeaturedJewelleryHistory');

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
  console.log('--- Starting Featured Jewellery History E2E Integration Test Suite ---\n');

  try {
    // Connect to database to clean up test records
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gehnadekho');
    console.log('Connected to MongoDB for pre-test cleanup.');

    // Delete existing test documents to ensure deterministic test runs
    await Admin.deleteMany({ email: 'fhadmin@test.com' });
    await User.deleteMany({ email: 'fhowner@test.com' });
    await Outlet.deleteMany({ name: 'Test FH Shop' });
    await Slot.deleteMany({ slotNumber: { $in: [98, 99] } });
    await Category.deleteMany({ name: 'FHCategory' });
    await Jewellery.deleteMany({ name: /FH Jewel/i });
    await FeaturedJewelleryHistory.deleteMany({});
    console.log('Database cleaned. Starting Server...');

    // Boot Express Server
    const server = require('./server');

    // Wait slightly for connections to establish
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let adminToken = '';
    let ownerToken = '';
    let outletId = '';
    let slotId1 = '';
    let slotId2 = '';
    let categoryId = '';
    let jewelleryId1 = '';
    let jewelleryId2 = '';
    let historyId = '';

    // 1. Register Setup Admin
    console.log('\n[PRE-TEST 1] Registering Admin...');
    const adminRegRes = await request('POST', '/gehnaDekho/admin/register', {
      name: 'FH Admin',
      email: 'fhadmin@test.com',
      password: 'password123'
    });
    if (adminRegRes.status !== 201) throw new Error('Failed to register Admin');
    adminToken = adminRegRes.body.token;

    // 2. Register Owner & Provision Approved Outlet
    console.log('\n[PRE-TEST 2] Registering User & Outlet Onboarding...');
    const userRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'FH Owner',
      email: 'fhowner@test.com',
      phone: '7771112222',
      role: 'customer'
    });
    ownerToken = userRegRes.body.token;

    const outletRes = await request('POST', '/gehnaDekho/outlets', {
      name: 'Test FH Shop',
      address: '888 Platinum Plaza',
      phone: '7771113333',
      email: 'fh@shop.com'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    outletId = outletRes.body._id;

    // Admin approves outlet
    await request('PUT', `/gehnaDekho/outlets/${outletId}/status`, {
      status: 'approved',
      adminMessage: 'Approved for FH testing.'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Refresh token role
    const loginRes = await request('POST', '/gehnaDekho/users/login', { phone: '7771112222' });
    const verifyRes = await request('POST', '/gehnaDekho/users/verify-otp', { phone: '7771112222', otp: loginRes.body.otp });
    ownerToken = verifyRes.body.token;

    // Top-up credits to 100
    const topupRes = await request('PUT', `/gehnaDekho/outlets/${outletId}`, {
      creditWallet: { balance: 100 }
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (topupRes.status !== 200) throw new Error('Failed to topup outlet credits');

    // 3. Admin creates Slot configs (Slot 98 and 99)
    console.log('\n[PRE-TEST 3] Creating Slot configurations...');
    const slotRes1 = await request('POST', '/gehnaDekho/slots', {
      slotNumber: 99,
      price: 25,
      description: 'FH Spotlight 99'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    slotId1 = slotRes1.body._id;

    const slotRes2 = await request('POST', '/gehnaDekho/slots', {
      slotNumber: 98,
      price: 20,
      description: 'FH Spotlight 98'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    slotId2 = slotRes2.body._id;

    // 4. Create Category & Jewellery Items
    console.log('\n[PRE-TEST 4] Creating Test Category & Jewellery Catalogue items...');
    const catRes = await request('POST', '/gehnaDekho/categories', { name: 'FHCategory', image: 'fh.png' }, { 'Authorization': `Bearer ${adminToken}` });
    categoryId = catRes.body._id;

    const jewelRes1 = await request('POST', '/gehnaDekho/jewelleries', {
      name: 'FH Jewel 1',
      category: categoryId,
      images: ['fhjewel1.png'],
      material: 'Platinum',
      weight: 15.0,
      purity: '950',
      price: 99000
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    jewelleryId1 = jewelRes1.body.jewellery._id;

    const jewelRes2 = await request('POST', '/gehnaDekho/jewelleries', {
      name: 'FH Jewel 2',
      category: categoryId,
      images: ['fhjewel2.png'],
      material: 'Platinum',
      weight: 10.0,
      purity: '950',
      price: 75000
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    jewelleryId2 = jewelRes2.body.jewellery._id;

    // ============================================
    // START FEATURED HISTORY API TESTS
    // ============================================

    // TEST 1: Available Slots & Showcase Log Deductions
    console.log('\n[TEST 1] Testing available slots today and showcase credit deductions...');
    
    // Check initial available slots (both Slot 98 and Slot 99 should be available)
    const availRes1 = await request('GET', '/gehnaDekho/slots/available/today', null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    if (availRes1.status !== 200) throw new Error('Failed to get available slots');
    const ids1 = availRes1.body.data.map(s => s._id);
    if (!ids1.includes(slotId1) || !ids1.includes(slotId2)) {
      throw new Error('Both Slot 98 and Slot 99 should be available initially');
    }
    console.log('Initial available slots count:', availRes1.body.count);

    // Feature first jewellery item (Slot 99, cost 25 credits)
    console.log('Logging featured jewellery in Slot 99 (debits 25 credits)...');
    const fhRes1 = await request('POST', '/gehnaDekho/featured-history', {
      slot: slotId1,
      jewellery: jewelleryId1,
      outlet: outletId
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Featured showcase 1 status:', fhRes1.status);
    if (fhRes1.status !== 201) throw new Error('Failed to log featured history for Slot 99');
    historyId = fhRes1.body.data._id;
    
    // Check wallet balance after first feature (started with 100, deducted 25, should be 75)
    const outletCheck1 = await Outlet.findById(outletId);
    console.log('Outlet credit balance after first feature:', outletCheck1.creditWallet.balance);
    if (outletCheck1.creditWallet.balance !== 75) {
      throw new Error(`Expected outlet balance to be 75, got ${outletCheck1.creditWallet.balance}`);
    }

    // Check available slots again (Slot 99 should be gone, Slot 98 should still be available)
    const availRes2 = await request('GET', '/gehnaDekho/slots/available/today', null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    const ids2 = availRes2.body.data.map(s => s._id);
    if (ids2.includes(slotId1)) {
      throw new Error('Slot 99 should NOT be available after being featured today');
    }
    if (!ids2.includes(slotId2)) {
      throw new Error('Slot 98 should still be available');
    }
    console.log('Available slots count after 1st booking:', availRes2.body.count);

    // Feature second jewellery item (Slot 98, cost 20 credits)
    console.log('Logging featured jewellery in Slot 98 (debits 20 credits)...');
    const fhRes2 = await request('POST', '/gehnaDekho/featured-history', {
      slot: slotId2,
      jewellery: jewelleryId2,
      outlet: outletId
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    if (fhRes2.status !== 201) throw new Error('Failed to log featured history for Slot 98');

    // Check wallet balance after second feature (75 - 20 = 55)
    const outletCheck2 = await Outlet.findById(outletId);
    console.log('Outlet credit balance after second feature:', outletCheck2.creditWallet.balance);
    if (outletCheck2.creditWallet.balance !== 55) {
      throw new Error(`Expected outlet balance to be 55, got ${outletCheck2.creditWallet.balance}`);
    }

    // Check available slots today (both should be booked now)
    const availRes3 = await request('GET', '/gehnaDekho/slots/available/today', null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    const ids3 = availRes3.body.data.map(s => s._id);
    if (ids3.includes(slotId1) || ids3.includes(slotId2)) {
      throw new Error('Both Slot 98 and Slot 99 should be unavailable now');
    }
    console.log('Available slots count after both bookings:', availRes3.body.count);
    console.log('SUCCESS: Two history records logged, credits deducted correctly, and slot availability verified.');

    // TEST 2: Dynamic Click Increment (Public Endpoint)
    console.log('\n[TEST 2] Simulating client clicks on featured autoscroll items...');
    const clickRes = await request('POST', `/gehnaDekho/featured-history/${historyId}/click`);
    console.log('Click track status (Expected 200):', clickRes.status);
    if (clickRes.status !== 200) throw new Error('Failed to track/increment click count');
    console.log('Click count after increment (Expected 1):', clickRes.body.clickCount);
    if (clickRes.body.clickCount !== 1) throw new Error('clickCount not atomically incremented');

    // TEST 3: Owner retrieves list of history logs (Assert populations)
    console.log('\n[TEST 3] Owner fetching paginated logs list...');
    const listRes = await request('GET', '/gehnaDekho/featured-history?limit=5', null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('List status:', listRes.status, 'Total logged count:', listRes.body.pagination.total);
    if (listRes.status !== 200) throw new Error('Failed to retrieve history logs');
    if (listRes.body.data.length !== 2) throw new Error('Incorrect history log items returned');
    
    // Check populated details
    const populatedItem = listRes.body.data[0];
    console.log('Populated Slot Number:', populatedItem.slot.slotNumber);
    console.log('Populated Jewellery Name:', populatedItem.jewellery.name);
    console.log('Populated Outlet Name:', populatedItem.outlet.name);
    if (!populatedItem.slot.slotNumber || !populatedItem.jewellery.name || !populatedItem.outlet.name) {
      throw new Error('References are not populated correctly in list fetch');
    }

    // TEST 4: Get Single History Detail
    console.log('\n[TEST 4] Fetching single history detail by ID...');
    const singleRes = await request('GET', `/gehnaDekho/featured-history/${historyId}`, null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Single fetch status:', singleRes.status, 'Logged clickCount:', singleRes.body.data.clickCount);
    if (singleRes.status !== 200) throw new Error('Failed to retrieve detail by ID');
    if (singleRes.body.data.clickCount !== 1) throw new Error('Incorrect clickCount returned');

    // TEST 5: Today's Featured items with timezone compatibility
    console.log('\n[TEST 5] Fetching today\'s featured showcase (IST Timezone agnosticism and sorted slotNumber)...');
    const todayRes = await request('GET', '/gehnaDekho/featured-history/today');
    console.log('Today fetch status (Expected 200):', todayRes.status);
    if (todayRes.status !== 200) throw new Error('Failed to retrieve today\'s featured items');
    console.log('Reported timezone context:', todayRes.body.timezone);
    console.log('Calendar date bounds applied:', JSON.stringify(todayRes.body.dateBounds));
    console.log('Showcase count returned (Expected 2):', todayRes.body.count);
    
    if (todayRes.body.count !== 2) throw new Error('Incorrect today\'s showcase items returned');

    // Assert sorting: Slot 98 must appear first, then Slot 99!
    const firstShowcaseItem = todayRes.body.data[0];
    const secondShowcaseItem = todayRes.body.data[1];
    console.log(`Showcase sorting order verification: [First] Slot #${firstShowcaseItem.slot.slotNumber} -> [Second] Slot #${secondShowcaseItem.slot.slotNumber}`);
    if (firstShowcaseItem.slot.slotNumber !== 98 || secondShowcaseItem.slot.slotNumber !== 99) {
      throw new Error('Active today\'s featured listings are not returned in order of slot numbers!');
    }
    
    // Assert nested populates: Category inside Jewellery must be populated!
    console.log('Nested Category Populated Name:', firstShowcaseItem.jewellery.category.name);
    if (!firstShowcaseItem.jewellery.category.name) {
      throw new Error('Nested category population failed on jewellery items');
    }
    console.log('SUCCESS: Verified today\'s IST-compatible featured slide carousel API.');

    console.log('\n=============================================');
    console.log('🎉 ALL FEATURED HISTORY TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
