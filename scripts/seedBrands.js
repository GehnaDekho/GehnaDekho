require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Brand = require('../models/Brand');

// Working placeholder images from Unsplash
const IMAGES = {
  logo: 'https://images.unsplash.com/photo-1599643478524-fb66f70a00ef?w=150&q=80',
  heroBg: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80',
  artistryBg: 'https://images.unsplash.com/photo-1599643478524-fb66f70a00ef?w=800&q=80',
  trustBg: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80',
  milestone1: 'https://images.unsplash.com/photo-1584302179602-e4c3d3fd629d?w=400&q=80',
  milestone2: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=400&q=80',
  milestone3: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=400&q=80',
};

const brandDataTemplate = (index, name, tagline) => ({
  name,
  tagline,
  logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=150`, // Fallback text logo
  showOnHomeScreen: true,
  sections: [
    {
      type: 'hero',
      isActive: true,
      order: 1,
      title: `Welcome to ${name}`,
      subtitle: tagline,
      description: `Experience the finest craftsmanship and heritage of ${name}. A legacy built on trust and purity.`,
      backgroundImage: IMAGES.heroBg
    },
    {
      type: 'timeline',
      isActive: true,
      order: 2,
      title: 'Our Heritage',
      milestones: [
        {
          year: '1995',
          title: 'The Beginning',
          description: `The foundation stone of ${name} was laid with a vision to revolutionize the jewellery industry.`,
          image: IMAGES.milestone1
        },
        {
          year: '2005',
          title: 'Expanding Horizons',
          description: 'Opened our first flagship store and introduced our signature diamond collection.',
          image: IMAGES.milestone2
        },
        {
          year: '2023',
          title: 'A Global Presence',
          description: 'Recognized globally for our sustainable practices and unparalleled designs.',
          image: IMAGES.milestone3
        }
      ]
    },
    {
      type: 'artistry',
      isActive: true,
      order: 3,
      title: 'Master Craftsmanship',
      backgroundImage: IMAGES.artistryBg,
      stats: [
        { label: 'Craftsmen', value: 500, suffix: '+' },
        { label: 'Collections', value: 50, suffix: '+' },
        { label: 'Happy Customers', value: 1, suffix: 'M+' }
      ]
    },
    {
      type: 'accolades',
      isActive: true,
      order: 4,
      title: 'Awards & Recognition',
      accolades: [
        { title: 'Best Retailer 2022', description: 'Awarded by National Jewellery Council' },
        { title: 'Innovation in Design', description: 'For our contemporary gold collection' },
        { title: 'Customer Trust Award', description: 'Voted #1 by consumers for purity and transparency' },
        { title: 'Sustainability Champion', description: 'For ethically sourced diamonds' }
      ]
    },
    {
      type: 'trust_banner',
      isActive: true,
      order: 5,
      title: 'Why Choose Us?',
      backgroundImage: IMAGES.trustBg,
      stats: [
        { label: 'Purity', value: 100, suffix: '%' },
        { label: 'Transparency', value: 100, suffix: '%' },
        { label: 'Exchange Value', value: 100, suffix: '%' }
      ]
    }
  ]
});

const brandsList = [
  { name: 'Kalyan Jewellers', tagline: 'Trust Is Everything' },
  { name: 'Tanishq', tagline: 'A Tata Product' },
  { name: 'Malabar Gold & Diamonds', tagline: 'Celebrate the Beauty of Life' },
  { name: 'Senco Gold & Diamonds', tagline: 'Craftsmanship Since 1938' },
  { name: 'Joyalukkas', tagline: 'World\'s Favourite Jeweller' },
  { name: 'Bhima Jewellers', tagline: 'Purity is our Tradition' },
  { name: 'Reliance Jewels', tagline: 'Be the Moment' },
  { name: 'PC Jeweller', tagline: 'Jeweller for Generations' },
  { name: 'CaratLane', tagline: 'Everyday Fine Jewellery' },
  { name: 'BlueStone', tagline: 'Modern Romance' }
];

const seedBrands = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');

    await Brand.deleteMany({});
    console.log('Cleared existing brands');

    const brandsToInsert = brandsList.map((b, index) => brandDataTemplate(index, b.name, b.tagline));

    await Brand.insertMany(brandsToInsert);
    console.log('Successfully inserted 10 brands');

    process.exit();
  } catch (error) {
    console.error('Error seeding brands:', error);
    process.exit(1);
  }
};

seedBrands();
