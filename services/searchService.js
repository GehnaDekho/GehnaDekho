const searchRepository = require('../repositories/searchRepository');
const searchRanking = require('../utils/searchRanking');

/**
 * Perform a universal search across all entities.
 * Orchestrates repository calls and applies ranking.
 */
exports.performUniversalSearch = async (query, page = 1, limit = 5) => {
  // Prevent empty queries from hitting the DB heavily
  if (!query || query.trim() === '') {
    return {
      categories: [],
      metals: [],
      brands: [],
      outlets: [],
      jewelleries: [],
      metadata: { page, limit, hasMore: false }
    };
  }

  // Use a case-insensitive regex for MongoDB
  // Note: For large scale, this should migrate to Atlas Search or Elasticsearch
  const queryRegex = new RegExp(query.trim(), 'i');

  // Execute all repository fetches in parallel
  // Limits can be adjusted or scaled by pagination later
  const [
    categories,
    metals,
    brands,
    outlets,
    jewelleries
  ] = await Promise.all([
    searchRepository.searchCategories(queryRegex, limit * 2), // Fetch a bit more for ranking
    searchRepository.searchMetals(queryRegex, limit * 2),
    searchRepository.searchBrands(queryRegex, limit * 2),
    searchRepository.searchOutlets(queryRegex, limit * 2),
    searchRepository.searchJewelleries(queryRegex, limit * 3) // More jewelleries typically
  ]);

  // Apply ranking
  const rankedCategories = searchRanking.rankResults(categories, query).slice(0, limit);
  const rankedMetals = searchRanking.rankResults(metals, query).slice(0, limit);
  const rankedBrands = searchRanking.rankResults(brands, query).slice(0, limit);
  const rankedOutlets = searchRanking.rankResults(outlets, query).slice(0, limit);
  const rankedJewelleries = searchRanking.rankResults(jewelleries, query).slice(0, limit * 2);

  // Return unified format
  return {
    categories: rankedCategories,
    metals: rankedMetals,
    brands: rankedBrands,
    outlets: rankedOutlets,
    jewelleries: rankedJewelleries,
    metadata: {
      page,
      limit,
      // If we got exactly our requested buffer limit, there might be more
      hasMore: jewelleries.length >= limit * 3 || categories.length >= limit * 2 
    }
  };
};
