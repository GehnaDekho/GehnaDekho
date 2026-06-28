const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

// Force test environment configurations
process.env.PORT = 5001;
process.env.NODE_ENV = 'test';

// Require the models for pre-test database cleanup
const User = require('./models/User');
const Admin = require('./models/Admin');
const Outlet = require('./models/Outlet');

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
      port: 5001,
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
  console.log('--- Starting Status Review Integration Test Suite ---\n');

  try {
    // Connect to database to clean up test records
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gehnadekho');
    console.log('Connected to MongoDB for pre-test cleanup.');

    // Delete existing test documents to ensure deterministic test runs
    await Admin.deleteMany({ email: 'admin@test.com' });
    await User.deleteMany({ $or: [
      { email: 'john@test.com' }, 
      { phone: '9876543210' },
      { email: 'directowner@test.com' },
      { phone: '1112223333' },
      { email: 'rollback@test.com' },
      { phone: '5554443333' }
    ] });
    await Outlet.deleteMany({ name: { $in: [/Golden Glitz/, /Direct Outlet/, /Rollback/ ] } });
    console.log('Database cleaned. Starting Server...');

    // Boot Express Server
    const server = require('./server');

    // Wait slightly for connections to establish
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let adminToken = '';
    let userToken = '';
    let userId = '';
    let firstOutletId = '';
    let secondOutletId = '';

    // 1. Register Admin
    console.log('\n[TEST 1] Registering Admin...');
    const adminRegRes = await request('POST', '/gehnaDekho/admin/register', {
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'password123'
    });
    console.log('Admin Register Status:', adminRegRes.status);
    if (adminRegRes.status !== 201) throw new Error('Failed to register Admin');
    adminToken = adminRegRes.body.token;

    // 2. Register User (Customer)
    console.log('\n[TEST 2] Registering User & checking outletId...');
    const userRegRes = await request('POST', '/gehnaDekho/users/register', {
      name: 'John Doe',
      email: 'john@test.com',
      phone: '9876543210',
      role: 'customer'
    });
    console.log('User Register Status:', userRegRes.status);
    if (userRegRes.status !== 201) throw new Error('Failed to register User');
    userToken = userRegRes.body.token;
    userId = userRegRes.body._id;
    
    // Verify that newly registered user starts with outletId = null
    const checkInitialUser = await request('GET', `/gehnaDekho/users/${userId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (checkInitialUser.body.outletId !== null) {
      throw new Error(`Initial user should have outletId = null. Got ${checkInitialUser.body.outletId}`);
    }
    console.log('SUCCESS: Verified new user starts with outletId = null.');

    // 3. Create First Outlet (Onboarding Submission - starts as pending)
    console.log('\n[TEST 3] Submitting First Outlet Application...');
    const firstOutletRes = await request('POST', '/gehnaDekho/outlets', {
      name: 'Golden Glitz Shop 1',
      address: '123 Jewel Lane',
      phone: '0112233445',
      email: 'info@goldenglitz.com',
      location: { lat: 28.6139, lng: 77.2090 }
    }, {
      'Authorization': `Bearer ${userToken}`
    });
    console.log('First Outlet Submission Status:', firstOutletRes.status);
    if (firstOutletRes.status !== 201) throw new Error('Failed to submit First Outlet application');
    firstOutletId = firstOutletRes.body._id;
    
    // Verify that the default status is 'pending'
    if (firstOutletRes.body.status !== 'pending') {
      throw new Error(`Default status must be 'pending'. Got '${firstOutletRes.body.status}'`);
    }
    console.log(`SUCCESS: First Outlet application created with status '${firstOutletRes.body.status}'`);

    // 4. Test User Single Outlet Limit Constraint while pending
    console.log('\n[TEST 4] Verifying limit constraint while application is pending...');
    const duplicateRes = await request('POST', '/gehnaDekho/outlets', {
      name: 'Golden Glitz Shop 2',
      address: '456 Ruby Lane',
      phone: '0112233446'
    }, {
      'Authorization': `Bearer ${userToken}`
    });
    console.log('Duplicate Outlet Status:', duplicateRes.status);
    if (duplicateRes.status === 400) {
      console.log('SUCCESS: Prevented user from registering multiple outlets while one is active.');
    } else {
      throw new Error(`Duplicate outlet should be blocked with 400. Got ${duplicateRes.status}`);
    }

    // 5. Test Administrative Rejection and Required Message
    console.log('\n[TEST 5] Rejecting First Outlet Request...');
    
    // 5.1 Rejection without reason should be rejected
    const badRejectionRes = await request('PUT', `/gehnaDekho/outlets/${firstOutletId}/status`, {
      status: 'rejected'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Reason-less Rejection Status:', badRejectionRes.status);
    if (badRejectionRes.status !== 400) {
      throw new Error('Rejection without adminMessage should fail with 400.');
    }

    // 5.2 Valid Rejection
    const rejectionRes = await request('PUT', `/gehnaDekho/outlets/${firstOutletId}/status`, {
      status: 'rejected',
      adminMessage: 'GST document uploaded is illegible.'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Valid Rejection Status:', rejectionRes.status);
    if (rejectionRes.status !== 200 || rejectionRes.body.status !== 'rejected') {
      throw new Error('Failed to reject outlet request.');
    }
    if (rejectionRes.body.adminMessage !== 'GST document uploaded is illegible.') {
      throw new Error('adminMessage reason was not stored correctly.');
    }

    // 5.3 Fetch user profile to verify role is customer and outletId is still null
    const checkRejectedUser = await request('GET', `/gehnaDekho/users/${userId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('User Role after Rejection:', checkRejectedUser.body.role);
    if (checkRejectedUser.body.role !== 'customer' || checkRejectedUser.body.outletId !== null) {
      throw new Error('Rejected user must maintain role customer and outletId null.');
    }
    console.log('SUCCESS: Rejection correctly recorded, user role and outletId maintained.');

    // 6. Test re-applying when the previous request was rejected (Non-unique owner constraint verification)
    console.log('\n[TEST 6] Re-applying after previous rejection...');
    const secondOutletRes = await request('POST', '/gehnaDekho/outlets', {
      name: 'Golden Glitz Premium',
      address: '789 Diamond Road',
      phone: '0112233445', // Reusing the phone number should be allowed since previous was rejected!
      email: 'premium@goldenglitz.com',
      location: { lat: 28.6139, lng: 77.2090 }
    }, {
      'Authorization': `Bearer ${userToken}`
    });
    console.log('Second Outlet Submission Status:', secondOutletRes.status);
    if (secondOutletRes.status !== 201) {
      throw new Error(`Re-applying failed with status ${secondOutletRes.status}: ${JSON.stringify(secondOutletRes.body)}`);
    }
    secondOutletId = secondOutletRes.body._id;
    console.log('SUCCESS: User successfully re-applied. New Outlet Request ID:', secondOutletId);

    // 7. Test Administrative Approval, User Role Upgrade, and user.outletId Association
    console.log('\n[TEST 7] Admin Approving Second Outlet Request...');
    const approvalRes = await request('PUT', `/gehnaDekho/outlets/${secondOutletId}/status`, {
      status: 'approved',
      adminMessage: 'Welcome to GehnaDekho platform!'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Approval Status:', approvalRes.status);
    if (approvalRes.status !== 200 || approvalRes.body.status !== 'approved') {
      throw new Error('Admin failed to approve outlet onboarding request.');
    }

    // Fetch user profile again to assert role and outletId
    const checkApprovedUser = await request('GET', `/gehnaDekho/users/${userId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('User Role after Approval:', checkApprovedUser.body.role);
    console.log('User outletId after Approval:', checkApprovedUser.body.outletId);
    
    if (checkApprovedUser.body.role !== 'outlet_owner') {
      throw new Error(`User role should be upgraded to 'outlet_owner'. Got '${checkApprovedUser.body.role}'`);
    }
    if (checkApprovedUser.body.outletId !== secondOutletId) {
      throw new Error(`User outletId should match the approved outlet ID '${secondOutletId}'. Got '${checkApprovedUser.body.outletId}'`);
    }
    console.log('SUCCESS: User role upgraded and associated with the approved outlet ID.');

    // 8. Test Search Queries
    console.log('\n[TEST 8] Searching across collections...');
    const getRes = await request('GET', `/gehnaDekho/outlets?search=John&kycStatus=approved`);
    console.log('Search Status:', getRes.status, 'Results:', getRes.body.outlets.length);
    if (getRes.status !== 200 || getRes.body.outlets.length === 0) {
      throw new Error('Search failed to find the approved outlet under owner name John.');
    }
    console.log('SUCCESS: Search query verified successfully.');

    // 9. Test Deletion Demotion and Clearing outletId
    console.log('\n[TEST 9] Deleting approved Outlet and verifying demotion...');
    const deleteRes = await request('DELETE', `/gehnaDekho/outlets/${secondOutletId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Delete Outlet Status:', deleteRes.status);
    if (deleteRes.status !== 200) throw new Error('Failed to delete outlet.');

    // Fetch user profile again to verify role demoted to 'customer' and outletId reset to null
    const checkDeletedUser = await request('GET', `/gehnaDekho/users/${userId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('User Role after Deletion:', checkDeletedUser.body.role);
    console.log('User outletId after Deletion:', checkDeletedUser.body.outletId);
    
    if (checkDeletedUser.body.role !== 'customer') {
      throw new Error(`User role should be demoted back to 'customer'. Got '${checkDeletedUser.body.role}'`);
    }
    if (checkDeletedUser.body.outletId !== null) {
      throw new Error(`User outletId should be reset to null. Got '${checkDeletedUser.body.outletId}'`);
    }
    console.log('SUCCESS: Verified automatic role demotion to customer and clearing of outletId.');

    // 10. Direct creation of Outlet Owner by Admin
    console.log('\n[TEST 10] Direct creation of Outlet Owner by Admin...');
    const directCreationRes = await request('POST', '/gehnaDekho/outlets/direct', {
      ownerName: 'Direct Owner',
      ownerEmail: 'directowner@test.com',
      ownerPhone: '1112223333',
      name: 'Direct Outlet Shop',
      address: '456 Direct Road',
      phone: '9998887777',
      email: 'directoutlet@test.com'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Direct Creation Status:', directCreationRes.status);
    if (directCreationRes.status !== 201) {
      throw new Error(`Failed direct outlet owner creation. Got status ${directCreationRes.status}: ${JSON.stringify(directCreationRes.body)}`);
    }
    const directOutlet = directCreationRes.body;
    console.log('Direct Outlet Status:', directOutlet.status);
    console.log('Direct Outlet Owner Role:', directOutlet.owner.role);
    console.log('Direct Outlet Owner outletId:', directOutlet.owner.outletId);

    if (directOutlet.status !== 'approved') {
      throw new Error(`Expected outlet status 'approved', got '${directOutlet.status}'`);
    }
    if (directOutlet.owner.role !== 'outlet_owner') {
      throw new Error(`Expected owner role 'outlet_owner', got '${directOutlet.owner.role}'`);
    }
    if (directOutlet.owner.outletId !== directOutlet._id) {
      throw new Error(`Expected owner outletId to match '${directOutlet._id}', got '${directOutlet.owner.outletId}'`);
    }
    console.log('SUCCESS: Verified direct creation of outlet owner and correct linking.');

    // 11. Verification of rollback logic in direct creation
    console.log('\n[TEST 11] Verifying rollback logic when outlet creation fails...');
    const rollbackRes = await request('POST', '/gehnaDekho/outlets/direct', {
      ownerName: 'Rollback User',
      ownerEmail: 'rollback@test.com',
      ownerPhone: '5554443333',
      name: 'Rollback Outlet Shop',
      address: '789 Rollback Road',
      phone: '4443332222',
      email: 'invalid-email-format' // Will trigger schema validation failure on email
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    console.log('Rollback Creation Status (Expected 500):', rollbackRes.status);
    if (rollbackRes.status !== 500) {
      throw new Error(`Expected failure status 500, got ${rollbackRes.status}`);
    }

    // Now query database directly to ensure the User 'rollback@test.com' was deleted (rolled back)
    const rolledBackUser = await User.findOne({ email: 'rollback@test.com' });
    if (rolledBackUser) {
      throw new Error('User was NOT rolled back. Database contains orphaned user record!');
    }
    console.log('SUCCESS: Verified database rollback cleans up orphaned user records.');

    console.log('\n=============================================');
    console.log('🎉 ALL OUTLET STATUS REVIEW & DIRECT CREATION TESTS PASSED SUCCESSFULLY! 🎉');
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
