// netlify/functions/login.js
// Verifies a stored JWT token is still valid
// Called on page load to check if member is still logged in

const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://getcharteredai.netlify.app',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { token } = body;

  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'No token provided' }) };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        email: decoded.email,
        plan: decoded.plan,
        activatedAt: decoded.activatedAt
      })
    };
  } catch (err) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ valid: false, error: 'Token expired or invalid. Please re-enrol.' })
    };
  }
};
