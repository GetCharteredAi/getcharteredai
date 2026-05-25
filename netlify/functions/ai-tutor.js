// netlify/functions/ai-tutor.js
// Secure proxy for Anthropic Claude API

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'AI service not configured' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { messages, system, max_tokens } = body;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: body.scoring ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001',
        max_tokens: max_tokens || 1000,
        system: system || 'You are a helpful RICS APC tutor.',
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          content: [{ text: `I'm having trouble connecting right now. Please try again in a moment. (Error: ${data.error?.message || 'API error'})` }]
        })
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (err) {
    console.error('ai-tutor error:', err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        content: [{ text: 'Connection error. Please check your internet and try again.' }]
      })
    };
  }
};
