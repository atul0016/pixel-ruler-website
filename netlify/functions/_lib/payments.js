'use strict';

const crypto = require('crypto');
const { getProductConfig } = require('./common');

function toMinorUnits(amount) {
  return Math.round(Number(amount) * 100);
}

async function callJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data.message || data.error_description || data.error || `Request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function getPaypalBaseUrl() {
  const mode = (process.env.PAYPAL_MODE || 'live').toLowerCase();
  return mode === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

async function getPaypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are missing.');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const url = `${getPaypalBaseUrl()}/v1/oauth2/token`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || 'Could not get PayPal access token.');
  }

  return data.access_token;
}

async function createPaypalOrder(ext, installId) {
  const token = await getPaypalAccessToken();
  const product = getProductConfig(ext);
  const amountUsd = product.amountUsd;

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: `${ext}:${installId}`,
      description: `${ext} lifetime premium unlock`,
      amount: {
        currency_code: 'USD',
        value: amountUsd
      }
    }]
  };

  const url = `${getPaypalBaseUrl()}/v2/checkout/orders`;
  const data = await callJson(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return {
    orderId: data.id,
    amount: amountUsd,
    currency: 'USD'
  };
}

async function getPaypalOrder(orderId) {
  const token = await getPaypalAccessToken();
  const url = `${getPaypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}`;
  return await callJson(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
}

function getRazorpayAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are missing.');
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  return { keyId, keySecret, auth };
}

async function createRazorpayOrder(ext, installId) {
  const product = getProductConfig(ext);
  const amountInr = product.amountInr;
  const { auth } = getRazorpayAuth();

  const payload = {
    amount: toMinorUnits(amountInr),
    currency: 'INR',
    receipt: `${ext}_${installId}_${Date.now()}`.slice(0, 40),
    notes: {
      ext,
      installId
    }
  };

  const data = await callJson('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return {
    orderId: data.id,
    amount: data.amount,
    currency: data.currency || 'INR'
  };
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
  const { keySecret } = getRazorpayAuth();
  const signedPayload = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
}

function generateActivationToken({ ext, installId, gateway, txnId }) {
  const secret = process.env.LICENSE_SIGNING_SECRET;
  if (!secret) {
    throw new Error('LICENSE_SIGNING_SECRET is missing.');
  }

  const payload = {
    ext,
    installId,
    gateway,
    txnId,
    iat: Date.now()
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

module.exports = {
  getPaypalBaseUrl,
  createPaypalOrder,
  getPaypalOrder,
  createRazorpayOrder,
  verifyRazorpaySignature,
  generateActivationToken,
  getRazorpayAuth,
  getProductConfig
};
