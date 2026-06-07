const { getStore } = require('@netlify/blobs');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { token, entry } = JSON.parse(event.body);
    if (!token || !entry) return { statusCode: 400, body: JSON.stringify({ success: false }) };

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const store = getStore('cpd-logs');

    let entries = [];
    try {
      const existing = await store.get(email);
      if (existing) entries = JSON.parse(existing);
    } catch(e) {}

    const newEntry = {
      id: Date.now().toString(),
      date: entry.date,
      activity: entry.activity,
      hours: entry.hours,
      competency: entry.competency,
      type: entry.type,
      createdAt: new Date().toISOString()
    };

    entries.unshift(newEntry);
    await store.set(email, JSON.stringify(entries));

    return { statusCode: 200, body: JSON.stringify({ success: true, entry: newEntry }) };
  } catch(e) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
