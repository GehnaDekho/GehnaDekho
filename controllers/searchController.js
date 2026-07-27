const searchService = require('../services/searchService');

/**
 * @desc    Universal search across categories, metals, brands, outlets, and jewellery
 * @route   GET /api/search
 * @access  Public
 */
exports.universalSearch = async (req, res) => {
  try {
    const query = req.query.q || '';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;

    // Call the service layer to perform the actual orchestration
    const results = await searchService.performUniversalSearch(query, page, limit);

    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Search API Error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your search request',
      error: error.message
    });
  }
};
