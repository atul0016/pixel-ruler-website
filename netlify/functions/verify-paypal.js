'use strict';

const {
  json,
  optionsResponse,
  parseBody,
  isValidInstallId,
  getProductConfig
} = require('./_lib/common');
const {
  getPaypalOrder,
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
    const orderId = body.orderID;

    if (!isValidInstallId(installId)) {
      return json(400, { verified: false, error: 'Invalid installId' });
    }

    if (!orderId) {
      return json(400, { verified: false, error: 'Missing orderID' });
    }

    const order = await getPaypalOrder(orderId);
    if (order.status !== 'COMPLETED') {
      return json(401, { verified: false, error: `Order status is ${order.status}` });
    }

    const expected = getProductConfig(ext).amountUsd;
    const paid = order?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;

    if (!paid || Number(paid) < Number(expected)) {
      return json(401, {
        verified: false,
        error: `Paid amount ${paid || 'N/A'} is lower than required ${expected}`
      });
    }

    const captureId = order?.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderId;
    const activationToken = generateActivationToken({
      ext,
      installId,
      gateway: 'paypal',
      txnId: captureId
    });

    return json(200, {
      verified: true,
      activationToken,
      paymentId: captureId
    });
  } catch (error) {
    return json(error.status || 500, {
      verified: false,
      error: error.message || 'PayPal verification failed',
      details: error.data || null
    });
  }
};
