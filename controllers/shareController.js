const Jewellery = require('../models/Jewellery');

/**
 * @desc    Render public share preview for jewellery
 * @route   GET /share/jewellery/:id
 * @access  Public
 */
const getJewellerySharePreview = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if ID is valid format
    if (!id || id.length !== 24) {
      return res.status(404).send(getNotFoundHtml('Invalid Jewellery Link.'));
    }

    const jewellery = await Jewellery.findById(id).populate('outlet', 'name city');
    
    if (!jewellery) {
      return res.status(404).send(getNotFoundHtml('This jewellery may have been removed or is no longer available.'));
    }

    const title = jewellery.name || 'Beautiful Jewellery';
    // Format price in Indian Rupee
    const formattedPrice = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(jewellery.price || 0);
    const description = jewellery.description || 'Check out this beautiful piece on GehnaDekho.';
    
    // Fallback image if images array is empty
    const imageUrl = (jewellery.images && jewellery.images.length > 0) 
      ? jewellery.images[0] 
      : 'https://via.placeholder.com/400?text=GehnaDekho';
    
    // Production domain for deep links
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const intentUrl = `intent://${req.get('host')}/share/jewellery/${id}#Intent;scheme=https;package=com.metra.gehnadekho;action=android.intent.action.VIEW;end;`;
    
    // Return standard HTML with OpenGraph tags
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} | GehnaDekho</title>
        
        <!-- Primary Meta Tags -->
        <meta name="title" content="${title} | GehnaDekho">
        <meta name="description" content="${description}">
        
        <!-- Open Graph / Facebook / WhatsApp -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${fullUrl}">
        <meta property="og:title" content="${title} - ${formattedPrice}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="${imageUrl}">
        
        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:url" content="${fullUrl}">
        <meta property="twitter:title" content="${title} - ${formattedPrice}">
        <meta property="twitter:description" content="${description}">
        <meta property="twitter:image" content="${imageUrl}">

        <style>
          :root {
            --primary: #162839;
            --gold: #C9A227;
            --bg: #F8F9FA;
            --text: #1E293B;
            --text-secondary: #64748B;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          body { background-color: var(--bg); display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 20px; }
          .header { display: flex; align-items: center; justify-content: center; margin-bottom: 24px; padding-top: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: var(--primary); letter-spacing: -0.5px; }
          .logo span { color: var(--gold); }
          
          .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 400px; width: 100%; }
          .image-container { width: 100%; aspect-ratio: 1/1; background-color: #f1f5f9; display: flex; align-items: center; justify-content: center; overflow: hidden; }
          .image { width: 100%; height: 100%; object-fit: cover; }
          
          .content { padding: 24px; }
          .title { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
          .price { font-size: 22px; font-weight: 700; color: var(--gold); margin-bottom: 16px; }
          .desc { font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 24px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
          
          .btn-container { display: flex; flex-direction: column; gap: 12px; }
          .btn { display: flex; align-items: center; justify-content: center; width: 100%; padding: 14px; border-radius: 12px; font-size: 16px; font-weight: 600; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; }
          .btn-primary { background-color: var(--primary); color: white; }
          .btn-primary:hover { background-color: #0f1c28; }
          .btn-outline { background-color: transparent; color: var(--primary); border: 1px solid var(--primary); }
          
          .footer { margin-top: auto; padding: 30px 0 10px; font-size: 12px; color: var(--text-secondary); text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Gehna<span>Dekho</span></div>
        </div>
        
        <div class="card">
          <div class="image-container">
            <img src="${imageUrl}" alt="${title}" class="image" onerror="this.src='https://via.placeholder.com/400?text=GehnaDekho'" />
          </div>
          <div class="content">
            <h1 class="title">${title}</h1>
            <div class="price">${formattedPrice}</div>
            <p class="desc">${description}</p>
            
            <div class="btn-container">
              <a href="${intentUrl}" class="btn btn-primary" id="openAppBtn">Open in GehnaDekho App</a>
              <a href="https://play.google.com/store/apps/details?id=com.metra.gehnadekho" class="btn btn-outline" target="_blank">Get it on Google Play</a>
            </div>
          </div>
        </div>
        
        <div class="footer">
          &copy; ${new Date().getFullYear()} GehnaDekho. All rights reserved.
        </div>
      </body>
      </html>
    `;

    res.status(200).send(html);
  } catch (error) {
    console.error("Share Preview Error:", error);
    res.status(500).send(getNotFoundHtml('Unable to load this jewellery. Please try again later.'));
  }
};

const getNotFoundHtml = (message) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Not Found | GehnaDekho</title>
      <style>
        :root { --primary: #162839; --gold: #C9A227; --bg: #F8F9FA; --text: #1E293B; --text-secondary: #64748B; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; margin: 0; text-align: center; }
        .logo { font-size: 28px; font-weight: bold; color: var(--primary); margin-bottom: 24px; }
        .logo span { color: var(--gold); }
        .card { background: white; padding: 40px 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 400px; width: 100%; }
        h1 { font-size: 20px; margin-bottom: 12px; color: var(--text); }
        p { color: var(--text-secondary); line-height: 1.5; margin-bottom: 30px; }
        .btn { display: inline-block; background-color: var(--primary); color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; width: 100%; box-sizing: border-box; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Gehna<span>Dekho</span></div>
        <h1>Jewellery Not Available</h1>
        <p>${message}</p>
        <a href="https://play.google.com/store/apps/details?id=com.metra.gehnadekho" class="btn">Explore GehnaDekho</a>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  getJewellerySharePreview
};
