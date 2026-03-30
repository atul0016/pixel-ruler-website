'use strict';

const DEFAULT_PRODUCTS = {
  'pixel-ruler': {
    usd: '1.00',
    inr: '99',
    businessName: 'Pixel Ruler Premium'
  },
  'smart-capture': {
    usd: '1.00',
    inr: '99',
    businessName: 'Advanced Smart Capture'
  }
};

function getCorsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: getCorsHeaders(),
    body: JSON.stringify(body)
  };
}

function optionsResponse() {
  return {
    statusCode: 200,
    headers: getCorsHeaders(),
    body: ''
  };
}

function parseBody(event) {
  if (!event || !event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

function isValidInstallId(installId) {
  if (!installId || typeof installId !== 'string') return false;
  if (installId.length < 12 || installId.length > 128) return false;
  return /^[a-zA-Z0-9_-]+$/.test(installId);
}

function getCountryCode(headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return (
    lower['x-country'] ||
    lower['cf-ipcountry'] ||
    lower['cloudfront-viewer-country'] ||
    ''
  ).toString().toUpperCase();
}

function getProductConfig(ext) {
  const product = DEFAULT_PRODUCTS[ext] || DEFAULT_PRODUCTS['pixel-ruler'];

  const envPrefix = ext === 'smart-capture' ? 'SMART_CAPTURE' : 'PIXEL_RULER';
  const amountUsd = process.env[`${envPrefix}_PRICE_USD`] || product.usd;
  const amountInr = process.env[`${envPrefix}_PRICE_INR`] || product.inr;

  return {
    amountUsd,
    amountInr,
    businessName: process.env.BUSINESS_NAME || product.businessName
  };
}

module.exports = {
  json,
  optionsResponse,
  parseBody,
  isValidInstallId,
  getCountryCode,
  getProductConfig
};
