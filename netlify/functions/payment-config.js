'use strict';

const {
  json,
  optionsResponse,
  getCountryCode,
  getProductConfig
} = require('./_lib/common');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const params = event.queryStringParameters || {};
    const ext = params.ext || 'pixel-ruler';
    const product = getProductConfig(ext);
    const countryCode = getCountryCode(event.headers || {});

    return json(200, {
      ext,
      countryCode,
      amountInr: product.amountInr,
      amountUsd: product.amountUsd,
      businessName: product.businessName,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
      paypalClientId: process.env.PAYPAL_CLIENT_ID || ''
    });
  } catch (error) {
    return json(500, { error: error.message || 'Unable to get payment config' });
  }
};
