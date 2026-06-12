// netlify/functions/michael-audit.js
// Tests a single Michael response against expected keywords for the admin audit tool

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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI service not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { question, moduleId } = body;
  const expectedKeywords = Array.isArray(body.expectedKeywords) ? body.expectedKeywords : [];

  let systemPrompt = "You are Michael, an RICS APC coach. For this audit test, answer the following question directly and factually as you would advise an APC candidate. Give a clear, concise answer in 150-200 words. Do not ask questions back. Do not use coaching techniques. Just answer the question directly so your response can be compared against platform content for accuracy. IMPORTANT ACCURACY NOTES: The five RICS ethical standards are exactly: 1. Act with integrity 2. Always provide a high standard of service 3. Act in a way that promotes trust in the profession 4. Treat others with respect 5. Take responsibility. Never substitute these with different standards. The main pool WDA rate is 14% not 18%. For POCA 2002 questions, always mention the tipping off offence — it is a criminal offence under POCA 2002 to tip off a person that a Suspicious Activity Report has been submitted or that an investigation is underway. This is a key obligation surveyors must know.";

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }]
      })
    });

    const data = await response.json();
    const text = (data.content && data.content.map(c => c.text || '').join('')) || '';

    if (!response.ok || !text) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          module: moduleId,
          question,
          response: text || `API Error: ${(data.error && data.error.message) || 'No response received.'}`,
          passed: false,
          missingKeywords: expectedKeywords
        })
      };
    }

    const lowerText = text.toLowerCase();
    const missingKeywords = expectedKeywords.filter(k => !lowerText.includes(String(k).toLowerCase()));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        module: moduleId,
        question,
        response: text,
        passed: missingKeywords.length === 0,
        missingKeywords
      })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        module: moduleId,
        question,
        response: 'Error: ' + err.message,
        passed: false,
        missingKeywords: expectedKeywords
      })
    };
  }
};
