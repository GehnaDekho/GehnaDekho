const Jewellery = require('../models/Jewellery');
const Outlet = require('../models/Outlet');
const User = require('../models/User');

/**
 * @desc    Add a new jewellery item to the catalogue
 * @route   POST /api/jewelleries
 * @access  Private (Outlet Owner or Admin)
 */
const createJewellery = async (req, res) => {
  try {
    const {
      name,
      category,
      images,
      description,
      material,
      weight,
      purity,
      price,
      outlet, // For Admin override
      is3DTryOnAvailable,
      isFeatured
    } = req.body;

    // Determine target outlet
    let outletId = outlet;
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin) {
      // If not admin, the user must be an outlet owner with an associated approved outlet
      if (req.user.role !== 'outlet_owner' || !req.user.outletId) {
        return res.status(403).json({ message: 'Only approved outlet owners or admins can upload jewellery items' });
      }
      outletId = req.user.outletId;
    } else {
      // If admin, outlet is required
      if (!outletId) {
        return res.status(400).json({ message: 'Please provide an outlet ID to associate with this jewellery item' });
      }
    }

    // Verify outlet exists and is approved
    const targetOutlet = await Outlet.findById(outletId);
    if (!targetOutlet) {
      return res.status(404).json({ message: 'Associated outlet not found' });
    }

    if (targetOutlet.status !== 'approved') {
      return res.status(400).json({ message: 'Associated outlet must be approved before managing its catalogue' });
    }

    // Validate required fields
    if (!name || !category || !images || !material || !weight || !purity || !price) {
      return res.status(400).json({ message: 'Please fill all required fields (name, category, images, material, weight, purity, price)' });
    }

    // Business Logic: Rolling Count Limit & Credits enforcement
    // Count existing active jewellery uploads for this outlet
    const currentUploadsCount = await Jewellery.countDocuments({ outlet: outletId });
    const freeLimit = targetOutlet.freeUploadsLimit || 10;

    let creditDeducted = false;

    if (currentUploadsCount >= freeLimit) {
      // Free limit reached. Must deduct 1 credit to proceed.
      const currentBalance = (targetOutlet.creditWallet && targetOutlet.creditWallet.balance) || 0;
      if (currentBalance <= 0) {
        return res.status(400).json({
          message: `Free upload limit of ${freeLimit} items reached for this outlet. Additional uploads require credits. Please purchase credits by contacting support/admin.`
        });
      }

      // Deduct 1 credit
      targetOutlet.creditWallet.balance = currentBalance - 1;
      targetOutlet.creditWallet.lastUpdated = Date.now();
      await targetOutlet.save();
      creditDeducted = true;
    }

    const jewellery = await Jewellery.create({
      outlet: outletId,
      name,
      category,
      images,
      description: description || '',
      material,
      weight,
      purity,
      price,
      is3DTryOnAvailable: is3DTryOnAvailable || false,
      isFeatured: isFeatured || false
    });

    const populatedJewellery = await Jewellery.findById(jewellery._id)
      .populate('category', 'name image')
      .populate('outlet', 'name address phone email location status');

    res.status(201).json({
      jewellery: populatedJewellery,
      info: creditDeducted
        ? `1 upload credit was deducted from your wallet. Remaining balance: ${targetOutlet.creditWallet.balance}`
        : `Free tier upload successful. Upload ${currentUploadsCount + 1}/${freeLimit}`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get all jewellery items (Paginated, filterable by name, outlet, category, material, featured status)
 * @route   GET /api/jewelleries
 * @access  Public
 */
const getJewelleries = async (req, res) => {
  try {
    // Pagination parameters for Infinite Scroll / Admin lists
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    // Filters
    // 1. Search by name (case-insensitive regex)
    if (req.query.name) {
      query.name = new RegExp(req.query.name, 'i');
    }

    // 2. Filter by Category ID
    if (req.query.category) {
      query.category = req.query.category;
    }

    // 3. Filter by Outlet ID
    if (req.query.outlet) {
      query.outlet = req.query.outlet;
    }

    // 4. Filter by Material
    if (req.query.material) {
      query.material = new RegExp(req.query.material, 'i');
    }

    // 5. Filter by 3D Try-On Availability
    if (req.query.is3DTryOnAvailable !== undefined) {
      query.is3DTryOnAvailable = req.query.is3DTryOnAvailable === 'true';
    }

    // 6. Filter by Featured status
    if (req.query.isFeatured !== undefined) {
      query.isFeatured = req.query.isFeatured === 'true';
    }

    const totalCount = await Jewellery.countDocuments(query);
    const jewelleries = await Jewellery.find(query)
      .populate('category', 'name image')
      .populate('outlet', 'name address phone email location status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      jewelleries,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get details of a single jewellery item (Increments view counter on retrieval)
 * @route   GET /api/jewelleries/:id
 * @access  Public
 */
const getJewelleryById = async (req, res) => {
  try {
    // Dynamically increment views counter to track popular listings
    const jewellery = await Jewellery.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    )
      .populate('category', 'name image description')
      .populate('outlet', 'name address phone email location status freeUploadsLimit');

    if (!jewellery) {
      return res.status(404).json({ message: 'Jewellery item not found' });
    }

    res.status(200).json(jewellery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update details of a jewellery item
 * @route   PUT /api/jewelleries/:id
 * @access  Private (Owner or Admin Only)
 */
const updateJewellery = async (req, res) => {
  try {
    const jewellery = await Jewellery.findById(req.params.id);

    if (!jewellery) {
      return res.status(404).json({ message: 'Jewellery item not found' });
    }

    // Authorize: Admin or the Owner of the associated Outlet
    const associatedOutlet = await Outlet.findById(jewellery.outlet);
    const isOwner = associatedOutlet && req.user._id.toString() === associatedOutlet.owner.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to modify this catalogue item' });
    }

    const {
      name,
      category,
      images,
      description,
      material,
      weight,
      purity,
      price,
      is3DTryOnAvailable,
      isFeatured
    } = req.body;

    if (name) jewellery.name = name;
    if (category) jewellery.category = category;
    if (images) jewellery.images = images;
    if (description !== undefined) jewellery.description = description;
    if (material) jewellery.material = material;
    if (weight) jewellery.weight = weight;
    if (purity) jewellery.purity = purity;
    if (price) jewellery.price = price;
    if (is3DTryOnAvailable !== undefined) jewellery.is3DTryOnAvailable = is3DTryOnAvailable;
    if (isFeatured !== undefined) jewellery.isFeatured = isFeatured;

    const updatedJewellery = await jewellery.save();

    const populatedUpdated = await Jewellery.findById(updatedJewellery._id)
      .populate('category', 'name image')
      .populate('outlet', 'name address phone email location status');

    res.status(200).json(populatedUpdated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete a jewellery item from the catalogue (Freeing up rolling free slots)
 * @route   DELETE /api/jewelleries/:id
 * @access  Private (Owner or Admin Only)
 */
const deleteJewellery = async (req, res) => {
  try {
    const jewellery = await Jewellery.findById(req.params.id);

    if (!jewellery) {
      return res.status(404).json({ message: 'Jewellery item not found' });
    }

    // Authorize: Admin or the Owner of the associated Outlet
    const associatedOutlet = await Outlet.findById(jewellery.outlet);
    const isOwner = associatedOutlet && req.user._id.toString() === associatedOutlet.owner.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this catalogue item' });
    }

    await Jewellery.deleteOne({ _id: req.params.id });

    res.status(200).json({ message: 'Jewellery item successfully removed from catalogue' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Increment the 3D Try-On interaction counter (For analytics tracking)
 * @route   POST /api/jewelleries/:id/tryon
 * @access  Public
 */
const trackTryOnInteraction = async (req, res) => {
  try {
    const jewellery = await Jewellery.findByIdAndUpdate(
      req.params.id,
      { $inc: { tryOnInteractions: 1 } },
      { new: true }
    );

    if (!jewellery) {
      return res.status(404).json({ message: 'Jewellery item not found' });
    }

    res.status(200).json({
      message: '3D Try-On interaction recorded successfully',
      tryOnInteractions: jewellery.tryOnInteractions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Increment the wishlist additions counter (For analytics tracking)
 * @route   POST /api/jewelleries/:id/wishlist
 * @access  Public
 */
const trackWishlistAddition = async (req, res) => {
  try {
    const jewellery = await Jewellery.findByIdAndUpdate(
      req.params.id,
      { $inc: { wishlistAdditions: 1 } },
      { new: true }
    );

    if (!jewellery) {
      return res.status(404).json({ message: 'Jewellery item not found' });
    }

    res.status(200).json({
      message: 'Wishlist addition recorded successfully',
      wishlistAdditions: jewellery.wishlistAdditions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createJewellery,
  getJewelleries,
  getJewelleryById,
  updateJewellery,
  deleteJewellery,
  trackTryOnInteraction,
  trackWishlistAddition
};
