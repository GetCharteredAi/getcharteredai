const { getStore } = require('@netlify/blobs');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { token } = JSON.parse(event.body);
    if (!token) return { statusCode: 400, body: JSON.stringify({ success: false }) };

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const store = getStore('cpd-logs');

    let entries = [];
    try {
      const existing = await store.get(email);
      if (existing) entries = JSON.parse(existing);
    } catch(e) {}

    return { statusCode: 200, body: JSON.stringify({ success: true, entries }) };
  } catch(e) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
