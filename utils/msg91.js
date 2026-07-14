const axios = require('axios').default;

/**
 * Send OTP using MSG91
 * @param {string} mobile - The mobile number with country code (e.g., '919876543210')
 * @param {string} otp - The generated OTP code
 * @returns {Promise<Object>} - Response from MSG91 API
 */
const sendMsg91Otp = async (mobile, otp) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    console.warn('[MSG91] Auth Key or Template ID is missing in .env. Falling back to console log.');
    console.log(`[MSG91 FALLBACK] Mobile: ${mobile} | OTP: ${otp}`);
    return { type: 'success', message: 'Fallback logging active' };
  }

  // Formatting mobile number: ensure country code (assumes 91 if length is 10)
  let formattedMobile = mobile;
  if (formattedMobile.length === 10) {
    formattedMobile = '91' + formattedMobile;
  }

  const options = {
    method: 'POST',
    maxBodyLength: Infinity,
    url: 'https://control.msg91.com/api/v5/flow',
    headers: {
      'authkey': authKey,
      'accept': 'application/json',
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({
      template_id: templateId,
      short_url: "0",
      short_url_expiry: "Seconds (Optional)",
      realTimeResponse: "1",
      recipients: [
        {
          mobiles: formattedMobile,
          var: otp
        }
      ]
    })
  };

  try {
    const { data } = await axios.request(options);
    console.log(`[MSG91] OTP sent to ${formattedMobile}:`, data);
    return data;
  } catch (error) {
    console.error(`[MSG91] Error sending OTP to ${formattedMobile}:`, error.response?.data || error.message);
    throw new Error('Failed to send OTP via MSG91');
  }
};

module.exports = {
  sendMsg91Otp,
};
