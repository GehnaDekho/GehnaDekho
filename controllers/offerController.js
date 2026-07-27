const Offer = require('../models/Offer');
const City = require('../models/City');
const notificationService = require('../services/notification.service');

exports.createOffer = async (req, res) => {
  try {
    const offer = new Offer(req.body);
    await offer.save();

    // Broadcast New Offer Notification to all users
    await notificationService.createAndSend({
      title: 'New Offer Alert! 🎁',
      message: `Check out our latest offer: ${offer.title}`,
      topic: 'general',
      receiverType: 'topic',
      targetMode: 'user',
      notificationType: 'PROMOTIONAL',
      eventId: offer._id,
      image: offer.image || null,
    }).catch(err => console.error('Notification Error:', err));

    res.status(201).json({ success: true, data: offer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.city) query.city = req.query.city;
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';

    const total = await Offer.countDocuments(query);
    const offers = await Offer.find(query)
      .populate('city', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: offers,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActiveOffersForCity = async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) {
      return res.status(400).json({ success: false, message: 'City is required' });
    }

    const today = new Date();
    
    const offers = await Offer.find({
      city,
      isActive: true,
      startDate: { $lte: today },
      endDate: { $gte: today }
    })
    .sort({ priority: -1, createdAt: -1 });

    res.status(200).json({ success: true, data: offers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('city', 'name');

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    res.status(200).json({ success: true, data: offer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    res.status(200).json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
