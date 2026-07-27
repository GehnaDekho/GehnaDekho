/**
 * searchRanking.js
 * 
 * Utility to rank search results based on enterprise-grade priorities:
 * 1. Exact Match
 * 2. Starts With
 * 3. Contains
 * 4. Popularity (views, wishlist)
 * 5. Trending
 * 6. Alphabetical
 */

const calculateScore = (item, normalizedQuery) => {
  let score = 0;
  const name = (item.title || item.name || '').toLowerCase();
  
  // 1. Exact Match (Highest Priority)
  if (name === normalizedQuery) {
    score += 1000;
  }
  // 2. Starts With
  else if (name.startsWith(normalizedQuery)) {
    score += 500;
  }
  // 3. Contains
  else if (name.includes(normalizedQuery)) {
    score += 100;
  }

  // 4. Popularity & 5. Trending (using views and wishlistAdditions if available)
  if (item.views) {
    // A small boost for every 10 views to avoid overshadowing text match
    score += Math.min(item.views / 10, 50);
  }
  if (item.wishlistAdditions || item.wishlistCount) {
    score += Math.min((item.wishlistAdditions || item.wishlistCount) * 2, 50);
  }

  return score;
};

exports.rankResults = (results, query) => {
  const normalizedQuery = query.toLowerCase().trim();

  // Apply scores
  const scoredResults = results.map(item => ({
    ...item,
    score: calculateScore(item, normalizedQuery)
  }));

  // Sort by Score (Desc), then Alphabetically (Asc)
  scoredResults.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const nameA = (a.title || a.name || '').toLowerCase();
    const nameB = (b.title || b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return scoredResults;
};
