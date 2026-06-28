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
const Category = require('./models/Category');
const Jewellery = require('./models/Jewellery');
const Wishlist = require('./models/Wishlist');

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
  console.log('--- Starting Customer Wishlist & Jewellery Analytics E2E Integration Test Suite ---\n');

  try {
    // 1. Connect to database and clean up test records
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gehnadekho');
    console.log('Connected to MongoDB for pre-test cleanup.');

    await Admin.deleteMany({ email: 'wishadmin@test.com' });
    await User.deleteMany({ email: 'wishcustomer@test.com' });
    await User.deleteMany({ phone: '9876543210' });
    await User.deleteMany({ email: 'wishowner@test.com' });
    await User.deleteMany({ phone: '9876543211' });
    await Outlet.deleteMany({ name: 'Wishlist Gold Palace' });
    await Category.deleteMany({ name: 'Wishlist Diamonds' });
    await Jewellery.deleteMany({ name: 'Wishlist Solitaire Ring' });
    await Wishlist.deleteMany({});
    
    console.log('Database cleaned. Starting Server...');

    // Boot Express Server
    const server = require('./server');

    // Wait slightly for server to bind
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let adminToken = '';
    let customerToken = '';
    let ownerToken = '';
    let outletId = '';
    let categoryId = '';
    let jewelleryId = '';

    // 2. Register Setup Admin
    console.log('\n[PRE-TEST 1] Registering Admin...');
    const adminRegRes = await request('POST', '/gehnaDekho/admin/register', {
      name: 'Wishlist Admin',
      email: 'wishadmin@test.com',
      password: 'password123'
    });
    if (adminRegRes.status !== 201) throw new Error('Failed to register Admin');
    adminToken = adminRegRes.body.token;

    // 3. Register Customer account
    console.log('\n[PRE-TEST 2] Registering Customer User...');
    const customerRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'Wishlist Customer',
      email: 'wishcustomer@test.com',
      phone: '9876543210',
      role: 'customer'
    });
    customerToken = customerRegRes.body.token;

    // 4. Register Owner account
    console.log('\n[PRE-TEST 3] Registering Outlet Owner User...');
    const ownerRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'Wishlist Owner',
      email: 'wishowner@test.com',
      phone: '9876543211',
      role: 'customer'
    });
    ownerToken = ownerRegRes.body.token;

    // 5. Create and Approve Outlet for Catalogue management
    console.log('\n[PRE-TEST 4] Creating and Approving Outlet...');
    const outletRes = await request('POST', '/gehnaDekho/outlets', {
      name: 'Wishlist Gold Palace',
      address: '777 Ruby Road',
      phone: '5557778888',
      email: 'wish@palace.com'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    outletId = outletRes.body._id;

    await request('PUT', `/gehnaDekho/outlets/${outletId}/status`, {
      status: 'approved',
      adminMessage: 'Approved for wishlist testing.'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Refresh Owner token to apply 'outlet_owner' role
    const loginRes = await request('POST', '/gehnaDekho/users/login', { phone: '9876543211' });
    const verifyRes = await request('POST', '/gehnaDekho/users/verify-otp', {
      phone: '9876543211',
      otp: loginRes.body.otp
    });
    ownerToken = verifyRes.body.token;

    // 6. Create Category
    console.log('\n[PRE-TEST 5] Admin configuring Category...');
    const catRes = await request('POST', '/gehnaDekho/categories', {
      name: 'Wishlist Diamonds',
      image: 'diamonds_cat.jpg',
      description: 'Diamond rings and accessories'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    categoryId = catRes.body._id;

    // 7. Upload Jewellery Item
    console.log('\n[PRE-TEST 6] Uploading Jewellery Item...');
    const jewRes = await request('POST', '/gehnaDekho/jewelleries', {
      name: 'Wishlist Solitaire Ring',
      category: categoryId,
      images: ['solitaire.jpg'],
      material: 'Platinum',
      weight: 4.5,
      purity: '950 Platinum',
      price: 250000,
      description: 'Stunning 1 carat solitaire diamond ring.'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    if (jewRes.status !== 201) throw new Error('Failed to create Jewellery item');
    jewelleryId = jewRes.body.jewellery._id;
    console.log('Jewellery item created successfully.');


    // ============================================
    // START CORE WISHLIST API TESTS
    // ============================================

    // TEST 1: Assert Initial wishlistCount is 0
    console.log('\n[TEST 1] Verifying initial wishlistCount is 0...');
    const itemCheck1 = await Jewellery.findById(jewelleryId);
    console.log('Initial wishlistCount:', itemCheck1.wishlistCount);
    if (itemCheck1.wishlistCount !== 0) {
      throw new Error(`Expected initial wishlistCount to be 0, got ${itemCheck1.wishlistCount}`);
    }
    console.log('SUCCESS: Initial count is verified as 0.');

    // TEST 2: Customer Adds Item to Wishlist
    console.log('\n[TEST 2] Customer adding item to wishlist...');
    const addRes = await request('POST', '/gehnaDekho/wishlist', {
      jewelleryId
    }, {
      'Authorization': `Bearer ${customerToken}`
    });
    console.log('Add to wishlist status:', addRes.status);
    if (addRes.status !== 201) throw new Error('Failed to add item to wishlist');
    console.log('Response message:', addRes.body.message);

    // Verify wishlistCount on the Jewellery document incremented to 1
    const itemCheck2 = await Jewellery.findById(jewelleryId);
    console.log('wishlistCount after addition:', itemCheck2.wishlistCount);
    if (itemCheck2.wishlistCount !== 1) {
      throw new Error(`Expected wishlistCount to be 1, got ${itemCheck2.wishlistCount}`);
    }
    console.log('SUCCESS: Wishlist item created, and count incremented successfully.');

    // TEST 3: Duplicate Wishlist Addition Blocking
    console.log('\n[TEST 3] Re-attempting duplicate wishlist addition...');
    const addResDup = await request('POST', '/gehnaDekho/wishlist', {
      jewelleryId
    }, {
      'Authorization': `Bearer ${customerToken}`
    });
    console.log('Duplicate add status (Expected 400):', addResDup.status);
    if (addResDup.status !== 400) throw new Error('Duplicate wishlist addition should be blocked with 400');
    console.log('Duplicate error message:', addResDup.body.message);
    
    // Verify count remains 1
    const itemCheckDup = await Jewellery.findById(jewelleryId);
    if (itemCheckDup.wishlistCount !== 1) {
      throw new Error('Count should remain 1 on duplicate addition attempt');
    }
    console.log('SUCCESS: Prevented duplicate wishlist entries.');

    // TEST 4: Non-customer Role Wishlist Blocking (Admin / Outlet Owner)
    console.log('\n[TEST 4] Testing non-customer role access blocks...');
    const addResForbidden = await request('POST', '/gehnaDekho/wishlist', {
      jewelleryId
    }, {
      'Authorization': `Bearer ${ownerToken}` // Outlet Owner
    });
    console.log('Outlet Owner add status (Expected 403):', addResForbidden.status);
    if (addResForbidden.status !== 403) throw new Error('Outlet owner wishlisting should be blocked with 403');
    console.log('SUCCESS: Role restrictions successfully applied.');

    // TEST 5: Fetch Wishlist with Joins and Populates
    console.log('\n[TEST 5] Fetching Customer Wishlist...');
    const fetchRes = await request('GET', '/gehnaDekho/wishlist', null, {
      'Authorization': `Bearer ${customerToken}`
    });
    console.log('Fetch status:', fetchRes.status);
    if (fetchRes.status !== 200) throw new Error('Failed to retrieve customer wishlist');
    console.log('Wishlist items found:', fetchRes.body.count);
    
    const firstItem = fetchRes.body.data[0];
    if (!firstItem || !firstItem.jewellery || !firstItem.jewellery.category || !firstItem.jewellery.outlet) {
      throw new Error('Populate joins failed to resolve categories or outlets details');
    }
    console.log('Populated Jewellery Name:', firstItem.jewellery.name);
    console.log('Populated Category Name:', firstItem.jewellery.category.name);
    console.log('Populated Outlet Name:', firstItem.jewellery.outlet.name);
    console.log('SUCCESS: Wishlist retrieved with complete populated relationships.');

    // TEST 6: Customer Removes Item from Wishlist
    console.log('\n[TEST 6] Customer removing item from wishlist...');
    const removeRes = await request('DELETE', `/gehnaDekho/wishlist/${jewelleryId}`, null, {
      'Authorization': `Bearer ${customerToken}`
    });
    console.log('Remove status:', removeRes.status);
    if (removeRes.status !== 200) throw new Error('Failed to remove item from wishlist');
    console.log('Remove message:', removeRes.body.message);

    // Verify wishlistCount on the Jewellery document decremented back to 0
    const itemCheck3 = await Jewellery.findById(jewelleryId);
    console.log('wishlistCount after removal:', itemCheck3.wishlistCount);
    if (itemCheck3.wishlistCount !== 0) {
      throw new Error(`Expected wishlistCount to be 0, got ${itemCheck3.wishlistCount}`);
    }
    console.log('SUCCESS: Wishlist item deleted, and count decremented successfully.');

    // TEST 7: Duplicate Wishlist Removal Blocking
    console.log('\n[TEST 7] Re-attempting duplicate wishlist removal...');
    const removeResDup = await request('DELETE', `/gehnaDekho/wishlist/${jewelleryId}`, null, {
      'Authorization': `Bearer ${customerToken}`
    });
    console.log('Duplicate remove status (Expected 400):', removeResDup.status);
    if (removeResDup.status !== 400) throw new Error('Duplicate wishlist removal should fail with 400');
    console.log('Duplicate remove message:', removeResDup.body.message);
    console.log('SUCCESS: Duplicate removal blocked and handled cleanly.');

    console.log('\n======================================================');
    console.log('🎉 ALL CUSTOMER WISHLIST & ANALYTICS TESTS PASSED! 🎉');
    console.log('======================================================');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
