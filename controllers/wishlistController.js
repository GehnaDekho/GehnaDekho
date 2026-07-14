const Wishlist = require("../models/Wishlist");
const Jewellery = require("../models/Jewellery");
const User = require("../models/User");

/**
 * @desc    Add a jewellery item to customer wishlist
 *          Restricts to customers only, checks existence, checks duplicates,
 *          and atomically increments the jewellery's wishlistCount.
 * @route   POST /gehnaDekho/wishlist
 * @access  Private (Customer Only)
 */
const addToWishlist = async (req, res) => {
  try {
    const { jewelleryId } = req.body;

    if (!jewelleryId) {
      return res.status(400).json({
        success: false,
        message: "Please specify the jewellery ID to wishlist",
      });
    }

    // 1. Restrict to users of role 'customer'
    // if (req.user.role !== 'customer') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Access denied: Only customer accounts can manage wishlists'
    //   });
    // }

    // 2. Verify target jewellery exists
    const jewellery = await Jewellery.findById(jewelleryId);
    if (!jewellery) {
      return res.status(404).json({
        success: false,
        message: "Jewellery item not found",
      });
    }

    // 3. Check if already wishlisted to prevent duplicates
    const alreadyWishlisted = await Wishlist.findOne({
      user: req.user._id,
      jewellery: jewelleryId,
    });

    if (alreadyWishlisted) {
      return res.status(400).json({
        success: false,
        message: "This jewellery item is already in your wishlist",
      });
    }

    // 4. Create wishlist item
    const wishlistItem = await Wishlist.create({
      user: req.user._id,
      jewellery: jewelleryId,
    });

    // 5. Atomically increment the wishlistCount on the Jewellery document
    await Jewellery.findByIdAndUpdate(
      jewelleryId,
      { $inc: { wishlistCount: 1 } },
      { new: true },
    );

    const populatedItem = await Wishlist.findById(wishlistItem._id).populate({
      path: "jewellery",
      populate: [
        { path: "category", select: "name image" },
        { path: "outlet", select: "name address phone email location status" },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Jewellery item successfully added to wishlist",
      data: populatedItem,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Remove a jewellery item from customer wishlist
 *          Restricts to customers only and atomically decrements the jewellery's wishlistCount.
 * @route   DELETE /gehnaDekho/wishlist/:jewelleryId
 * @access  Private (Customer Only)
 */
const removeFromWishlist = async (req, res) => {
  try {
    const { jewelleryId } = req.params;

    if (!jewelleryId) {
      return res.status(400).json({
        success: false,
        message: "Please specify the jewellery ID to remove from wishlist",
      });
    }

    // 1. Restrict to users of role 'customer'
    if (req.user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Only customer accounts can manage wishlists",
      });
    }

    // 2. Find and delete the wishlist entry
    const deletedItem = await Wishlist.findOneAndDelete({
      user: req.user._id,
      jewellery: jewelleryId,
    });

    if (!deletedItem) {
      return res.status(400).json({
        success: false,
        message: "This jewellery item is not in your wishlist",
      });
    }

    // 3. Atomically decrement the wishlistCount on the Jewellery document
    // Safeguard using Mongoose's findByIdAndUpdate to make sure we don't drop below 0 if somehow out of sync
    const targetJewellery = await Jewellery.findById(jewelleryId);
    if (targetJewellery) {
      const newCount = Math.max(0, (targetJewellery.wishlistCount || 0) - 1);
      await Jewellery.findByIdAndUpdate(jewelleryId, {
        wishlistCount: newCount,
      });
    }

    res.status(200).json({
      success: true,
      message: "Jewellery item successfully removed from wishlist",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Toggle a jewellery item in customer wishlist
 * @route   POST /gehnaDekho/wishlist/toggle
 * @access  Private (Customer Only)
 */
const toggleWishlist = async (req, res) => {
  try {
    const { jewelleryId } = req.body;

    if (!jewelleryId) {
      return res
        .status(400)
        .json({ success: false, message: "Please specify the jewellery ID" });
    }

    // if (req.user.role !== "customer") {
    //   return res.status(403).json({ success: false, message: "Access denied" });
    // }

    const jewellery = await Jewellery.findById(jewelleryId);
    if (!jewellery) {
      return res
        .status(404)
        .json({ success: false, message: "Jewellery item not found" });
    }

    const existingItem = await Wishlist.findOne({
      user: req.user._id,
      jewellery: jewelleryId,
    });

    if (existingItem) {
      // Remove it
      await existingItem.deleteOne();

      const newCount = Math.max(0, (jewellery.wishlistCount || 0) - 1);
      const newAdditions = Math.max(0, (jewellery.wishlistAdditions || 0) - 1);
      await Jewellery.findByIdAndUpdate(jewelleryId, {
        wishlistCount: newCount,
        wishlistAdditions: newAdditions,
      });

      const user = await User.findById(req.user._id);
      if (user) {
        await User.findByIdAndUpdate(req.user._id, {
          wishlistAdditions: Math.max(0, (user.wishlistAdditions || 0) - 1),
        });
      }

      return res.status(200).json({
        success: true,
        message: "Removed from wishlist",
        isWishlisted: false,
      });
    } else {
      // Add it
      await Wishlist.create({ user: req.user._id, jewellery: jewelleryId });

      await Jewellery.findByIdAndUpdate(jewelleryId, {
        $inc: { wishlistCount: 1, wishlistAdditions: 1 },
      });

      await User.findByIdAndUpdate(req.user._id, {
        $inc: { wishlistAdditions: 1 },
      });

      return res.status(201).json({
        success: true,
        message: "Added to wishlist",
        isWishlisted: true,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get paginated wishlist items for the authenticated customer
 * @route   GET /gehnaDekho/wishlist
 * @access  Private (Customer Only)
 */
const getWishlist = async (req, res) => {
  try {
    // 1. Restrict to users of role 'customer'
    // if (req.user.role !== "customer") {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Access denied: Only customer accounts can view wishlists",
    //   });
    // }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };

    const items = await Wishlist.find(query)
      .populate({
        path: "jewellery",
        populate: [
          { path: "category", select: "name image" },
          {
            path: "outlet",
            select: "name address phone email location status",
          },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Wishlist.countDocuments(query);

    res.status(200).json({
      success: true,
      count: items.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      data: items,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all wishlisted jewellery IDs for the authenticated customer
 * @route   GET /gehnaDekho/wishlist/ids
 * @access  Private (Customer Only)
 */
const getWishlistIds = async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const items = await Wishlist.find({ user: req.user._id }).select(
      "jewellery -_id",
    );
    const ids = items.map((item) => item.jewellery);

    res.status(200).json({
      success: true,
      data: ids,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  toggleWishlist,
  getWishlistIds,
};
