'use strict';

const {
  json,
  optionsResponse,
  parseBody,
  isValidInstallId
} = require('./_lib/common');
const {
  createPaypalOrder,
  createRazorpayOrder
} = require('./_lib/payments');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const body = parseBody(event);
    const gateway = (body.gateway || '').toLowerCase();
    const ext = body.ext || 'pixel-ruler';
    const installId = body.installId || '';

    if (!isValidInstallId(installId)) {
      return json(400, { error: 'Invalid installId' });
    }

    if (gateway === 'paypal') {
      const order = await createPaypalOrder(ext, installId);
      return json(200, order);
    }

    if (gateway === 'razorpay') {
      const order = await createRazorpayOrder(ext, installId);
      return json(200, order);
    }

    return json(400, { error: 'Unsupported gateway' });
  } catch (error) {
    return json(error.status || 500, {
      error: error.message || 'Failed to create order',
      details: error.data || null
    });
  }
};
