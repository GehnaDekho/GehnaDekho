const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the server root
dotenv.config({ path: path.join(__dirname, '../.env') });

// Models
const Admin = require('../models/Admin');
const Category = require('../models/Category');
const CreditConfig = require('../models/CreditConfig');
const CreditTransaction = require('../models/CreditTransaction');
const FeaturedJewelleryHistory = require('../models/FeaturedJewelleryHistory');
const Feedback = require('../models/Feedback');
const Jewellery = require('../models/Jewellery');
const OtpSession = require('../models/OtpSession');
const Outlet = require('../models/Outlet');
const PurchaseHistory = require('../models/PurchaseHistory');
const RatingCriteria = require('../models/RatingCriteria');
const RedeemRequest = require('../models/RedeemRequest');
const Review = require('../models/Review');
const Service = require('../models/Service');
const ServiceRequest = require('../models/ServiceRequest');
const Slot = require('../models/Slot');
const User = require('../models/User');
const VoucherConfig = require('../models/VoucherConfig');
const Wishlist = require('../models/Wishlist');

const connectDB = async () => {
  try {
    console.log(`Connecting to MongoDB...`);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

const clearData = async () => {
  console.log('--- STARTING DATABASE CLEANUP ---');
  await Admin.deleteMany({});
  await Category.deleteMany({});
  await CreditConfig.deleteMany({});
  await CreditTransaction.deleteMany({});
  await FeaturedJewelleryHistory.deleteMany({});
  await Feedback.deleteMany({});
  await Jewellery.deleteMany({});
  await OtpSession.deleteMany({});
  await Outlet.deleteMany({});
  await PurchaseHistory.deleteMany({});
  await RatingCriteria.deleteMany({});
  await RedeemRequest.deleteMany({});
  await Review.deleteMany({});
  await Service.deleteMany({});
  await ServiceRequest.deleteMany({});
  await Slot.deleteMany({});
  await User.deleteMany({});
  await VoucherConfig.deleteMany({});
  await Wishlist.deleteMany({});
  console.log('SUCCESS: All application and user data removed completely.');
};

const seedData = async () => {
  console.log('--- STARTING FRESH SEEDING ---');

  // 1. Create Super Admin
  const adminPassword = 'GehnaDekho@123';
  const superAdmin = await Admin.create({
    name: 'Super Admin',
    email: 'admin@gehnadekho.com',
    password: Admin.hashPassword(adminPassword),
    role: 'admin',
  });
  console.log('\n=============================================');
  console.log('Admin Account Created Successfully!');
  console.log(`Email:    admin@gehnadekho.com`);
  console.log(`Password: ${adminPassword}`);
  console.log('=============================================\n');

  // 2. Master Data: Categories
  const categories = [
    { name: 'Ring', image: 'https://images.unsplash.com/photo-1605100804763-247f52b2fa21', description: 'Premium finger rings' },
    { name: 'Necklace', image: 'https://images.unsplash.com/photo-1599643478514-4a413550e50f', description: 'Elegant necklaces' },
    { name: 'Bracelet', image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a', description: 'Wristwear and bangles' },
    { name: 'Earring', image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908', description: 'Designer earrings' },
    { name: 'Mangalsutra', image: 'https://images.unsplash.com/photo-1620138933454-d8edb94e3343', description: 'Bridal wear' },
    { name: 'Bangles', image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a', description: 'Traditional bangles' },
  ];
  await Category.insertMany(categories);
  console.log('-> Categories seeded.');

  // 3. Master Data: Rating Criteria
  const ratingCriterias = [
    { name: 'Product Variety', category: 'Highly Impacted', weightage: 2 },
    { name: 'Customer Service', category: 'Highly Impacted', weightage: 2 },
    { name: 'Store Ambience', category: 'Manageable', weightage: 1 },
    { name: 'Pricing', category: 'Highly Impacted', weightage: 2 },
    { name: 'Trustworthiness', category: 'Highly Impacted', weightage: 3 },
  ];
  await RatingCriteria.insertMany(ratingCriterias);
  console.log('-> Rating Criteria seeded.');

  // 4. Master Data: Credit Config
  const creditConfigs = [
    { actionName: 'service_request_fee', creditsRequired: 5, description: 'Base fee for administrative service requests' },
    { actionName: 'product_upload_fee', creditsRequired: 1, description: 'Fee per jewellery upload beyond the free limit' },
    { actionName: 'featured_listing_fee', creditsRequired: 10, description: 'Daily cost to feature a product' },
  ];
  await CreditConfig.insertMany(creditConfigs);
  console.log('-> Credit Configs seeded.');

  // 5. Master Data: Voucher Config
  const voucherConfigs = [
    { actionName: 'rating', pointsAwarded: 10, description: 'Points awarded for rating an outlet' },
    { actionName: 'review', pointsAwarded: 50, description: 'Points awarded for writing a detailed review' },
    { actionName: 'feedback', pointsAwarded: 20, description: 'Points awarded for providing app feedback' },
  ];
  await VoucherConfig.insertMany(voucherConfigs);
  console.log('-> Voucher Configs seeded.');

  // 6. Master Data: Services
  const services = [
    { name: 'Premium Banner Design', description: 'Homepage featured sliding banner layout for your outlet' },
    { name: '3D Try-On Setup', description: 'AR assets modeling fee for premium outlet items' },
    { name: 'Professional Photography', description: 'Store and jewellery photoshoot session' },
  ];
  await Service.insertMany(services);
  console.log('-> Services seeded.');

  console.log('\nSUCCESS: Master data configured perfectly.');
};

const run = async () => {
  await connectDB();
  try {
    await clearData();
    await seedData();
    console.log('\n--- SETUP COMPLETED SECURELY ---');
    process.exit(0);
  } catch (error) {
    console.error(`\nProcess Failed: ${error.message}`);
    process.exit(1);
  }
};

run();
