'use strict';

const {
  json,
  optionsResponse,
  parseBody,
  isValidInstallId
} = require('./_lib/common');
const {
  verifyRazorpaySignature,
  generateActivationToken
} = require('./_lib/payments');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const body = parseBody(event);
    const ext = body.ext || 'pixel-ruler';
    const installId = body.installId || '';
    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;

    if (!isValidInstallId(installId)) {
      return json(400, { verified: false, error: 'Invalid installId' });
    }

    if (!orderId || !paymentId || !signature) {
      return json(400, { verified: false, error: 'Missing Razorpay payment fields' });
    }

    const verified = verifyRazorpaySignature(orderId, paymentId, signature);
    if (!verified) {
      return json(401, { verified: false, error: 'Invalid payment signature' });
    }

    const activationToken = generateActivationToken({
      ext,
      installId,
      gateway: 'razorpay',
      txnId: paymentId
    });

    return json(200, {
      verified: true,
      activationToken,
      paymentId
    });
  } catch (error) {
    return json(error.status || 500, {
      verified: false,
      error: error.message || 'Razorpay verification failed'
    });
  }
};
