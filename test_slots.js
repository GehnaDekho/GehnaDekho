const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

// Force test environment configurations
process.env.PORT = 5003;
process.env.NODE_ENV = 'test';

// Require the models for database operations
const Admin = require('./models/Admin');
const Slot = require('./models/Slot');

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
  console.log('--- Starting Core Featured Slots Integration Test Suite ---\n');

  try {
    // Connect to database to clean up test records
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gehnadekho');
    console.log('Connected to MongoDB for pre-test cleanup.');

    // Delete existing test documents to ensure deterministic test runs
    await Admin.deleteMany({ email: 'slotadmin@test.com' });
    await Slot.deleteMany({ slotNumber: { $in: [1, 2, 3] } });
    console.log('Database cleaned. Starting Server...');

    // Boot Express Server
    const server = require('./server');

    // Wait slightly for connections to establish
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let adminToken = '';
    let firstSlotId = '';
    let secondSlotId = '';

    // 1. Register Setup Admin
    console.log('\n[PRE-TEST 1] Registering Admin...');
    const adminRegRes = await request('POST', '/gehnaDekho/admin/register', {
      name: 'Slot Admin',
      email: 'slotadmin@test.com',
      password: 'password123'
    });
    if (adminRegRes.status !== 201) throw new Error('Failed to register Admin');
    adminToken = adminRegRes.body.token;

    // ============================================
    // START CORE SLOTS API TESTS
    // ============================================

    // TEST 1: Admin Create slots
    console.log('\n[TEST 1] Admin configuring Slots...');
    const slotRes1 = await request('POST', '/gehnaDekho/slots', {
      slotNumber: 1,
      price: 15,
      description: 'First spotlight spot on homepage'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Slot 1 Creation status:', slotRes1.status);
    if (slotRes1.status !== 201) throw new Error('Failed to create Slot 1');
    firstSlotId = slotRes1.body._id;

    const slotRes2 = await request('POST', '/gehnaDekho/slots', {
      slotNumber: 2,
      price: 10,
      description: 'Second spotlight spot on homepage'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Slot 2 Creation status:', slotRes2.status);
    if (slotRes2.status !== 201) throw new Error('Failed to create Slot 2');
    secondSlotId = slotRes2.body._id;
    console.log('SUCCESS: Slot configurations stored.');

    // TEST 2: Duplicate Slot Prevention
    console.log('\n[TEST 2] Verifying duplicate slot prevention...');
    const duplicateSlotRes = await request('POST', '/gehnaDekho/slots', {
      slotNumber: 1,
      price: 25
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Duplicate Slot status (Expected 400):', duplicateSlotRes.status);
    if (duplicateSlotRes.status !== 400) {
      throw new Error(`Expected status 400, got ${duplicateSlotRes.status}`);
    }
    console.log('Duplicate Error Message:', duplicateSlotRes.body.message);
    console.log('SUCCESS: Prevented duplicate slot insertion.');

    // TEST 3: Retrieve Slots and assert sorted order
    console.log('\n[TEST 3] Listing configured slots (Assert sorting by slotNumber)...');
    const getSlotsRes = await request('GET', '/gehnaDekho/slots');
    console.log('Get slots status:', getSlotsRes.status);
    if (getSlotsRes.status !== 200) throw new Error('Failed to retrieve slots');
    console.log('Slots configured count:', getSlotsRes.body.length);
    
    if (getSlotsRes.body[0].slotNumber !== 1 || getSlotsRes.body[1].slotNumber !== 2) {
      throw new Error('Slots are not returned in sorted order of slot numbers!');
    }
    console.log('SUCCESS: Confirmed correct sorting order.');

    // TEST 4: Get Slot by ID
    console.log('\n[TEST 4] Fetching Slot 1 details by ID...');
    const getSlotByIdRes = await request('GET', `/gehnaDekho/slots/${firstSlotId}`);
    console.log('Get slot by ID status:', getSlotByIdRes.status);
    if (getSlotByIdRes.status !== 200) throw new Error('Failed to retrieve slot by ID');
    console.log('Fetched slot description:', getSlotByIdRes.body.description);
    if (getSlotByIdRes.body.slotNumber !== 1) throw new Error('Incorrect slot fetched');
    console.log('SUCCESS: Retrieved slot successfully.');

    // TEST 5: Update Slot Configuration
    console.log('\n[TEST 5] Updating Slot 1 price and description...');
    const updateRes = await request('PUT', `/gehnaDekho/slots/${firstSlotId}`, {
      price: 18,
      description: 'Updated Spotlight spot'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Update status:', updateRes.status);
    if (updateRes.status !== 200) throw new Error('Failed to update slot');
    console.log('Updated Price:', updateRes.body.price, 'Updated Description:', updateRes.body.description);
    if (updateRes.body.price !== 18) throw new Error('Price not updated correctly');
    console.log('SUCCESS: Slot updated correctly.');

    // TEST 6: Delete Slot
    console.log('\n[TEST 6] Deleting Slot 1...');
    const deleteRes = await request('DELETE', `/gehnaDekho/slots/${firstSlotId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Delete status:', deleteRes.status);
    if (deleteRes.status !== 200) throw new Error('Failed to delete slot');
    console.log('SUCCESS: Slot deleted successfully.');

    // Assert only slot 2 remains
    const finalSlotsRes = await request('GET', '/gehnaDekho/slots');
    console.log('Remaining slots count:', finalSlotsRes.body.length);
    if (finalSlotsRes.body.length !== 1 || finalSlotsRes.body[0].slotNumber !== 2) {
      throw new Error('Incorrect slots remain after deletion');
    }
    console.log('SUCCESS: Confirmed deletion state.');

    console.log('\n=============================================');
    console.log('🎉 ALL FEATURED SLOTS CRUD TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
