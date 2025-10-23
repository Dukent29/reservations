const axios = require('axios');

const BASE = process.env.ETG_ENV === 'sandbox'
  ? process.env.ETG_BASE_SANDBOX
  : process.env.ETG_BASE_PROD;

const auth = Buffer.from(`${process.env.ETG_PARTNER_ID}:${process.env.ETG_API_KEY}`).toString('base64');

const rh = axios.create({
  baseURL: BASE,
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

module.exports = { rh, BASE };
