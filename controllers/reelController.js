const Reel = require('../models/Reel');
const Outlet = require('../models/Outlet');

/**
 * @desc    Add a new reel
 * @route   POST /api/reels
 * @access  Private (Outlet Owner)
 */
const createReel = async (req, res) => {
  try {
    const { title, description, videoUrl } = req.body;

    if (req.user.role !== 'outlet_owner' || !req.user.outletId) {
      return res.status(403).json({ message: 'Only approved outlet owners can upload reels' });
    }

    const outletId = req.user.outletId;
    const targetOutlet = await Outlet.findById(outletId);
    if (!targetOutlet) {
      return res.status(404).json({ message: 'Associated outlet not found' });
    }

    if (targetOutlet.status !== 'approved') {
      return res.status(400).json({ message: 'Associated outlet must be approved before uploading reels' });
    }

    if (!title || !videoUrl) {
      return res.status(400).json({ message: 'Please provide title and videoUrl' });
    }

    const reel = await Reel.create({
      outlet: outletId,
      title,
      description,
      videoUrl,
    });

    res.status(201).json({
      success: true,
      data: reel,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get all reels
 * @route   GET /api/reels
 * @access  Public
 */
const getReels = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const startIndex = (page - 1) * limit;

    const query = {};
    if (req.query.outletId) {
      query.outlet = req.query.outletId;
    }

    const total = await Reel.countDocuments(query);
    const reels = await Reel.find(query)
      .populate('outlet', 'name businessName brandLogoAddress')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    const hasNextPage = startIndex + reels.length < total;

    res.status(200).json({
      success: true,
      count: reels.length,
      pagination: {
        page,
        limit,
        total,
        hasNextPage
      },
      data: reels,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Track a view on a reel
 * @route   POST /api/reels/:id/view
 * @access  Private
 */
const trackView = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const userId = req.user._id;

    // Use $addToSet to only add unique views
    const updatedReel = await Reel.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: { viewedBy: userId },
      },
      { new: true }
    );

    // Update viewsCount based on the size of viewedBy array
    updatedReel.viewsCount = updatedReel.viewedBy.length;
    await updatedReel.save();

    res.status(200).json({
      success: true,
      viewsCount: updatedReel.viewsCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update a reel
 * @route   PUT /api/reels/:id
 * @access  Private (Outlet Owner)
 */
const updateReel = async (req, res) => {
  try {
    let reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    // Make sure user owns this reel
    if (reel.outlet.toString() !== req.user.outletId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this reel' });
    }

    const { title, description } = req.body;
    
    reel = await Reel.findByIdAndUpdate(
      req.params.id,
      { title, description },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: reel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete a reel
 * @route   DELETE /api/reels/:id
 * @access  Private (Outlet Owner)
 */
const deleteReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    if (reel.outlet.toString() !== req.user.outletId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this reel' });
    }

    await reel.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createReel,
  getReels,
  trackView,
  updateReel,
  deleteReel
};
