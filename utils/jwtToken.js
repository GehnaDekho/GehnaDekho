const crypto = require('crypto');

// Helper to encode buffer/string to base64url
const base64url = (source) => {
  let encoded = source.toString('base64');
  encoded = encoded.replace(/=/g, '');
  encoded = encoded.replace(/\+/g, '-');
  encoded = encoded.replace(/\//g, '_');
  return encoded;
};

/**
 * Generate a JWT token using HMAC SHA256.
 * @param {Object} payload - Data to be encoded in the JWT
 * @param {String} secret - Secret key for encoding
 * @param {Number} [expiresInHours=24] - Token expiry time in hours
 * @returns {String} Signed JWT token
 */
const generateToken = (payload, secret, expiresInHours = 8760) => {
  const expiry = Math.floor(Date.now() / 1000) + (expiresInHours * 60 * 60);
  const fullPayload = {
    ...payload,
    exp: expiry
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerStr = base64url(Buffer.from(JSON.stringify(header)));
  const payloadStr = base64url(Buffer.from(JSON.stringify(fullPayload)));
  
  const unsignedToken = `${headerStr}.${payloadStr}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(unsignedToken)
    .digest();
  const signatureStr = base64url(signature);

  return `${unsignedToken}.${signatureStr}`;
};

/**
 * Verify a JWT token and return the decoded payload if valid.
 * @param {String} token - Signed JWT token
 * @param {String} secret - Secret key to verify against
 * @returns {Object|null} Decoded payload if valid, otherwise null
 */
const verifyToken = (token, secret) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerStr, payloadStr, signatureStr] = parts;
    const unsignedToken = `${headerStr}.${payloadStr}`;

    const signature = crypto
      .createHmac('sha256', secret)
      .update(unsignedToken)
      .digest();
    const expectedSignatureStr = base64url(signature);

    // Timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signatureStr);
    const expectedBuffer = Buffer.from(expectedSignatureStr);
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadStr, 'base64').toString('utf8');
    const decoded = JSON.parse(payloadJson);

    // Check expiration
    if (decoded.exp && Date.now() / 1000 > decoded.exp) {
      return null; // Token expired
    }

    return decoded;
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken
};
