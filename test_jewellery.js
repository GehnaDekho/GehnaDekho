const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

// Force test environment configurations
process.env.PORT = 5002;
process.env.NODE_ENV = 'test';

// Require the models for database operations
const User = require('./models/User');
const Admin = require('./models/Admin');
const Outlet = require('./models/Outlet');
const Category = require('./models/Category');
const Jewellery = require('./models/Jewellery');

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
      port: 5002,
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
  console.log('--- Starting Catalogue & Category Integration Test Suite ---\n');

  try {
    // Connect to database to clean up test records
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gehnadekho');
    console.log('Connected to MongoDB for pre-test cleanup.');

    // Delete existing test documents to ensure deterministic test runs
    await Admin.deleteMany({ email: 'catalogueadmin@test.com' });
    await User.deleteMany({ email: 'catalogueowner@test.com' });
    await Outlet.deleteMany({ name: 'Test Catalogue Shop' });
    await Category.deleteMany({ name: { $in: ['Ring', 'Necklace', 'Earring'] } });
    await Jewellery.deleteMany({ name: { $regex: /Test Jewel/i } });
    console.log('Database cleaned. Starting Server...');

    // Boot Express Server
    const server = require('./server');

    // Wait slightly for connections to establish
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let adminToken = '';
    let ownerToken = '';
    let ownerId = '';
    let outletId = '';
    let categoryId = '';
    let jewelId = '';

    // 1. Register Test Admin
    console.log('\n[TEST 1] Registering Catalogue Admin...');
    const adminRegRes = await request('POST', '/gehnaDekho/admin/register', {
      name: 'Catalogue Admin',
      email: 'catalogueadmin@test.com',
      password: 'password123'
    });
    console.log('Admin Register Status:', adminRegRes.status);
    if (adminRegRes.status !== 201) throw new Error('Failed to register Admin');
    adminToken = adminRegRes.body.token;

    // 2. Register Test User
    console.log('\n[TEST 2] Registering User...');
    const userRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'Catalogue Owner',
      email: 'catalogueowner@test.com',
      phone: '9991112222',
      role: 'customer'
    });
    console.log('User Register Status:', userRegRes.status);
    if (userRegRes.status !== 201) throw new Error('Failed to register User');
    ownerToken = userRegRes.body.token;
    ownerId = userRegRes.body._id;

    // 3. Create Categories (Admin Protected)
    console.log('\n[TEST 3] Admin Creating Categories...');
    
    // Attempt creation without admin token
    const unauthorizedCat = await request('POST', '/gehnaDekho/categories', {
      name: 'Ring',
      image: 'ring_icon.png'
    });
    if (unauthorizedCat.status !== 401) {
      throw new Error(`Expected status 401 for unauthorized creation, got ${unauthorizedCat.status}`);
    }
    console.log('SUCCESS: Prevented unauthorized category creation.');

    // Authorized Category creation
    const categoryRes = await request('POST', '/gehnaDekho/categories', {
      name: 'Necklace',
      image: 'necklace_icon.png',
      description: 'Elegant golden and silver necklaces'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Category Create Status:', categoryRes.status);
    if (categoryRes.status !== 201) throw new Error('Failed to create Category');
    categoryId = categoryRes.body._id;
    console.log('SUCCESS: Necklace Category created. ID:', categoryId);

    // Create a second category for filtering validation
    await request('POST', '/gehnaDekho/categories', {
      name: 'Ring',
      image: 'ring_icon.png'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // 4. Provision and Approve Outlet
    console.log('\n[TEST 4] Admin Provisioning & Approving User\'s Outlet...');
    const outletRes = await request('POST', '/gehnaDekho/outlets', {
      name: 'Test Catalogue Shop',
      address: '777 Ruby Drive',
      phone: '8887776666',
      email: 'catalogue@shop.com'
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });
    outletId = outletRes.body._id;

    // Approve outlet to elevate user role to outlet_owner
    await request('PUT', `/gehnaDekho/outlets/${outletId}/status`, {
      status: 'approved',
      adminMessage: 'Welcome to Catalogue Testing!'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Re-issue owner login to refresh JWT role payload to 'outlet_owner'
    const loginRes = await request('POST', '/gehnaDekho/users/login', {
      phone: '9991112222'
    });
    const otp = loginRes.body.otp;
    const verifyRes = await request('POST', '/gehnaDekho/users/verify-otp', {
      phone: '9991112222',
      otp
    });
    ownerToken = verifyRes.body.token;
    console.log('SUCCESS: Outlet approved and User upgraded to outlet_owner.');

    // 5. Upload Catalogue Jewellery Items (Testing limits and counts)
    console.log('\n[TEST 5] Submitting First Catalogue Jewellery Item...');
    const jewelRes1 = await request('POST', '/gehnaDekho/jewelleries', {
      name: 'Test Jewel Necklace Premium',
      category: categoryId,
      images: ['premium_necklace_front.jpg', 'premium_necklace_back.jpg'],
      description: 'Handcrafted premium 22K gold necklace.',
      material: 'Gold',
      weight: 45.5,
      purity: '22K',
      price: 185000,
      is3DTryOnAvailable: true,
      isFeatured: false
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });

    console.log('First Jewel Upload Status:', jewelRes1.status);
    if (jewelRes1.status !== 201) {
      throw new Error(`Failed to upload first jewellery item: ${JSON.stringify(jewelRes1.body)}`);
    }
    jewelId = jewelRes1.body.jewellery._id;
    console.log('Upload Result message:', jewelRes1.body.info);
    console.log('SUCCESS: First jewellery item uploaded. ID:', jewelId);

    // 6. Test Free upload limits rolling count (Limit is 10 by default)
    console.log('\n[TEST 6] Uploading 9 more items to exhaust the free limit of 10...');
    for (let i = 2; i <= 10; i++) {
      const res = await request('POST', '/gehnaDekho/jewelleries', {
        name: `Test Jewel Ring ${i}`,
        category: categoryId,
        images: [`ring_${i}.jpg`],
        material: 'Gold',
        weight: 6.2,
        purity: '18K',
        price: 32000
      }, {
        'Authorization': `Bearer ${ownerToken}`
      });
      if (res.status !== 201) {
        throw new Error(`Failed to upload free item #${i}: ${JSON.stringify(res.body)}`);
      }
    }
    console.log('SUCCESS: Successfully uploaded all 10 free items.');

    // 7. Try to upload 11th item (No credits)
    console.log('\n[TEST 7] Attempting 11th upload (beyond free limit) with 0 wallet balance...');
    const excessRes = await request('POST', '/gehnaDekho/jewelleries', {
      name: 'Test Jewel Excess Ring',
      category: categoryId,
      images: ['excess_ring.jpg'],
      material: 'Gold',
      weight: 5.5,
      purity: '18K',
      price: 25000
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });

    console.log('Excess Upload Status (Expected 400):', excessRes.status);
    if (excessRes.status !== 400) {
      throw new Error(`Expected status 400 when exceeding limit with 0 balance, got ${excessRes.status}`);
    }
    console.log('Rejection message:', excessRes.body.message);
    console.log('SUCCESS: Successfully blocked upload after exceeding free upload limits.');

    // 8. Purchase/Add credits to the Outlet (Admin update)
    console.log('\n[TEST 8] Adding credits to the Outlet Wallet...');
    const creditUpdate = await request('PUT', `/gehnaDekho/outlets/${outletId}`, {
      creditWallet: {
        balance: 5
      }
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Update Credit Status:', creditUpdate.status);
    if (creditUpdate.status !== 200) throw new Error('Failed to update outlet credits');
    console.log('New Credit Wallet Balance:', creditUpdate.body.creditWallet.balance);
    console.log('SUCCESS: Successfully credited wallet.');

    // 9. Re-attempt 11th upload with credits
    console.log('\n[TEST 9] Re-attempting 11th upload with valid credit balance...');
    const creditRes = await request('POST', '/gehnaDekho/jewelleries', {
      name: 'Test Jewel Excess Ring',
      category: categoryId,
      images: ['excess_ring.jpg'],
      material: 'Gold',
      weight: 5.5,
      purity: '18K',
      price: 25000
    }, {
      'Authorization': `Bearer ${ownerToken}`
    });

    console.log('Excess Upload with Credits Status:', creditRes.status);
    if (creditRes.status !== 201) {
      throw new Error(`Expected success 201, got ${creditRes.status}: ${JSON.stringify(creditRes.body)}`);
    }
    console.log('Response Details:', creditRes.body.info);
    console.log('SUCCESS: Upload allowed with credit deduction.');

    // 10. Paginated list with filtering (Infinite Scroll simulation)
    console.log('\n[TEST 10] Retrieving paginated catalogue with search and filter queries...');
    const getRes = await request('GET', `/gehnaDekho/jewelleries?name=Necklace&category=${categoryId}&limit=2`);
    console.log('Get Catalogue Status:', getRes.status);
    if (getRes.status !== 200) throw new Error('Failed to retrieve jewelleries');
    console.log('Filtered Results count:', getRes.body.jewelleries.length);
    console.log('Pagination Metadata:', JSON.stringify(getRes.body.pagination));

    if (getRes.body.jewelleries.length === 0) {
      throw new Error('Expected to find the Necklace Premium matching search queries!');
    }
    // Verify populated fields
    const checkItem = getRes.body.jewelleries[0];
    console.log('Populated Category Name:', checkItem.category.name);
    console.log('Populated Outlet Name:', checkItem.outlet.name);
    if (!checkItem.category.name || !checkItem.outlet.name) {
      throw new Error('Category and Outlet references should be populated');
    }
    console.log('SUCCESS: Paginated search filter and populated references verified.');

    // 11. Test Analytics Trackers (Views, Try-on, Wishlist)
    console.log('\n[TEST 11] Verifying Catalogue analytics and view counters...');
    
    // 11.1 Check single fetch increments views
    const singleJewelBefore = await request('GET', `/gehnaDekho/jewelleries/${jewelId}`);
    console.log('Views count before second fetch:', singleJewelBefore.body.views);
    
    const singleJewelAfter = await request('GET', `/gehnaDekho/jewelleries/${jewelId}`);
    console.log('Views count after second fetch:', singleJewelAfter.body.views);
    if (singleJewelAfter.body.views !== singleJewelBefore.body.views + 1) {
      throw new Error('Expected views count to increment by 1');
    }

    // 11.2 Check Try-on interaction increment
    const tryOnRes = await request('POST', `/gehnaDekho/jewelleries/${jewelId}/tryon`);
    console.log('Try-On Tracker Status:', tryOnRes.status, 'Try-On Clicks:', tryOnRes.body.tryOnInteractions);
    if (tryOnRes.body.tryOnInteractions !== 1) {
      throw new Error(`Expected tryOnInteractions count to be 1. Got ${tryOnRes.body.tryOnInteractions}`);
    }

    // 11.3 Check Wishlist counter increment
    const wishlistRes = await request('POST', `/gehnaDekho/jewelleries/${jewelId}/wishlist`);
    console.log('Wishlist Tracker Status:', wishlistRes.status, 'Wishlist Additions:', wishlistRes.body.wishlistAdditions);
    if (wishlistRes.body.wishlistAdditions !== 1) {
      throw new Error(`Expected wishlistAdditions count to be 1. Got ${wishlistRes.body.wishlistAdditions}`);
    }
    console.log('SUCCESS: Views, 3D Try-On, and Wishlist trackers verified successfully.');

    // 12. Deletion / Rolling count replenishment
    console.log('\n[TEST 12] Deleting a catalogue item to replenish free upload space...');
    const deleteRes = await request('DELETE', `/gehnaDekho/jewelleries/${jewelId}`, null, {
      'Authorization': `Bearer ${ownerToken}`
    });
    console.log('Delete status:', deleteRes.status);
    if (deleteRes.status !== 200) throw new Error('Failed to delete item');

    // Retrieve active count
    const finalUploadsCount = await Jewellery.countDocuments({ outlet: outletId });
    console.log('Active uploads count after deleting 1 item:', finalUploadsCount);
    if (finalUploadsCount !== 10) {
      throw new Error(`Expected 10 active items remaining in database, got ${finalUploadsCount}`);
    }
    console.log('SUCCESS: Catalogue item successfully deleted and active count restored.');

    console.log('\n=============================================');
    console.log('🎉 ALL CATEGORY & JEWELLERY TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================');

    // Force exit test runner
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
