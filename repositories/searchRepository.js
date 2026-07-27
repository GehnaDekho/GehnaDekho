const Category = require('../models/Category');
const Metal = require('../models/Metal');
const Brand = require('../models/Brand');
const Jewellery = require('../models/Jewellery');
const Outlet = require('../models/Outlet');

/**
 * Returns a normalized object format expected by the frontend
 */
const normalizeResult = (item, type, titleField, subtitleField = null, imageField = null) => {
  return {
    id: item._id.toString(),
    type,
    title: item[titleField] || '',
    subtitle: subtitleField ? item[subtitleField] : '',
    image: imageField ? (Array.isArray(item[imageField]) ? (item[imageField][0]?.url || item[imageField][0]) : item[imageField]) : null,
    slug: item.slug || item.name || item.metalName || '',
    views: item.views || 0,
    wishlistCount: item.wishlistAdditions || item.wishlistCount || 0,
    price: item.price || 0
  };
};

/**
 * Perform a regex match search across categories
 */
exports.searchCategories = async (queryRegex, limit = 5) => {
  const results = await Category.find({ name: { $regex: queryRegex } })
    .limit(limit)
    .lean();
  return results.map(c => normalizeResult(c, 'category', 'name', 'description', 'image'));
};

/**
 * Perform a regex match search across metals
 */
exports.searchMetals = async (queryRegex, limit = 5) => {
  const results = await Metal.find({ metalName: { $regex: queryRegex }, isActive: true })
    .limit(limit)
    .lean();
  return results.map(m => normalizeResult(m, 'metal', 'metalName', 'description', 'image'));
};

/**
 * Perform a regex match search across brands
 */
exports.searchBrands = async (queryRegex, limit = 5) => {
  const results = await Brand.find({ name: { $regex: queryRegex }, isActive: true })
    .limit(limit)
    .lean();
  return results.map(b => normalizeResult(b, 'brand', 'name', 'tagline', 'logo'));
};

/**
 * Perform a regex match search across outlets
 * We also search by address and city/brand using populated fields in a real full-text scenario.
 * For this regex approach, we match on name, address, or email.
 */
exports.searchOutlets = async (queryRegex, limit = 5) => {
  const results = await Outlet.find({
    $or: [
      { name: { $regex: queryRegex } },
      { address: { $regex: queryRegex } }
    ],
    status: 'approved'
  })
    .populate('city', 'name')
    .populate('brand', 'name')
    .limit(limit)
    .lean();
    
  return results.map(o => {
    const subtitle = `${o.city ? o.city.name : ''} ${o.brand ? ' | ' + o.brand.name : ''}`;
    return normalizeResult(o, 'outlet', 'name', null, 'images'); // Using null for subtitleField and applying custom subtitle
  }).map((res, idx) => {
      // Overriding subtitle since it was calculated custom
      res.subtitle = `${results[idx].city ? results[idx].city.name : ''} ${results[idx].brand ? ' | ' + results[idx].brand.name : ''}`.trim();
      return res;
  });
};

/**
 * Perform a regex match search across jewellery items
 */
exports.searchJewelleries = async (queryRegex, limit = 5) => {
  const results = await Jewellery.find({
    $or: [
      { name: { $regex: queryRegex } },
      { material: { $regex: queryRegex } },
      { description: { $regex: queryRegex } }
    ]
  })
    .populate('category', 'name')
    .populate('metal', 'metalName')
    .limit(limit)
    .lean();

  return results.map(j => {
    const res = normalizeResult(j, 'jewellery', 'name', null, 'images');
    res.subtitle = `${j.category ? j.category.name : ''} ${j.material ? ' - ' + j.material : ''}`.trim();
    return res;
  });
};
