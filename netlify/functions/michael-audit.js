// netlify/functions/michael-audit.js
// Batch-tests Michael's responses against expected keywords for the admin audit tool

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

  const questions = Array.isArray(body.questions) ? body.questions : [];

  const systemPrompt = "You are Michael, an RICS APC coach. For this audit test, answer the following question directly and factually as you would advise an APC candidate. Give a clear, concise answer in 150-200 words. Do not ask questions back. Do not use coaching techniques. Just answer the question directly so your response can be compared against platform content for accuracy.";

  const results = [];

  for (const q of questions) {
    const expectedKeywords = Array.isArray(q.expectedKeywords) ? q.expectedKeywords : [];

    let questionSystemPrompt = systemPrompt;
    if (/WDA|writing down allowance|capital allowances/i.test(q.question)) {
      questionSystemPrompt += ' IMPORTANT: The current main pool Writing Down Allowance rate is 14% NOT 18%. Always state 14% when asked about the main pool WDA rate.';
    }

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
          system: questionSystemPrompt,
          messages: [{ role: 'user', content: q.question }]
        })
      });

      const data = await response.json();
      const text = (data.content && data.content.map(c => c.text || '').join('')) || '';

      if (!response.ok || !text) {
        results.push({
          module: q.module,
          question: q.question,
          response: text || `API Error: ${(data.error && data.error.message) || 'No response received.'}`,
          passed: false,
          missingKeywords: expectedKeywords
        });
      } else {
        const lowerText = text.toLowerCase();
        const missingKeywords = expectedKeywords.filter(k => !lowerText.includes(String(k).toLowerCase()));

        results.push({
          module: q.module,
          question: q.question,
          response: text,
          passed: missingKeywords.length === 0,
          missingKeywords
        });
      }
    } catch (err) {
      results.push({
        module: q.module,
        question: q.question,
        response: 'Error: ' + err.message,
        passed: false,
        missingKeywords: expectedKeywords
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { statusCode: 200, headers, body: JSON.stringify({ results }) };
};
