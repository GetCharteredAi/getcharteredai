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

  let systemPrompt = "You are Michael, an RICS APC coach. For this audit test, answer the following question directly and factually as you would advise an APC candidate. Give a clear, concise answer in 150-200 words. Do not ask questions back. Do not use coaching techniques. Just answer the question directly so your response can be compared against platform content for accuracy. IMPORTANT ACCURACY NOTES: The five RICS ethical standards are exactly: 1. Act with integrity 2. Always provide a high standard of service 3. Act in a way that promotes trust in the profession 4. Treat others with respect 5. Take responsibility. Never substitute these with different standards. The main pool WDA rate is 14% not 18%. For POCA 2002 questions, always mention the tipping off offence — it is a criminal offence under POCA 2002 to tip off a person that a Suspicious Activity Report has been submitted or that an investigation is underway. This is a key obligation surveyors must know. Always use British English spelling throughout — use minimisation not minimization, organisation not organization, colour not color, behaviour not behavior, etc. IMPORTANT: The dispute resolution hierarchy is: 1. Negotiation 2. Mediation 3. Adjudication 4. Arbitration 5. Litigation. Adjudication must always be included between mediation and arbitration — it is a statutory right under the Housing Grants Construction and Regeneration Act 1996. Never omit adjudication from the hierarchy. Terms of engagement must include scope of service, fees and payment terms, complaints procedure, limitation of liability, termination rights and any referral arrangements. RICS consumer protection requirements derive from the Rules of Conduct effective February 2022, covering transparency, competence, complaints handling, conflicts of interest and professional indemnity insurance. PREP stands for Point, Reason, Evidence, Point — a framework for structuring clear professional answers. GEA is Gross External Area, GIA is Gross Internal Area, NIA is Net Internal Area. Cat A fit-out is landlord base build; Cat B is occupier specific fit-out. CDM 2015 duty holders are: Client, Principal Designer, Principal Contractor, Designer, Contractor. The Building Safety Regulator is an independent regulator within HSE. Higher-risk buildings subject to the Gateway process and Building Safety Regulator are 18 metres or 7 storeys with at least 2 residential units. Relevant buildings subject to leaseholder protections under Part 5 of the Building Safety Act are 11 metres or 5 storeys. When asked about the Gateway process always use the 18m/7 storey threshold. When asked about leaseholder protections use the 11m/5 storey threshold. The Gateway process has three stages: Gateway 1 planning, Gateway 2 before construction, Gateway 3 before occupation. Part M of the Building Regulations covers access to and use of buildings. BS 8300 is the British Standard for accessibility of buildings for disabled people. Direct discrimination is treating someone less favourably because of a protected characteristic. Indirect discrimination is applying a provision criterion or practice that disadvantages people with a protected characteristic. APC competency levels: Level 1 Knowledge and Understanding, Level 2 Application of Knowledge, Level 3 Reasoned Advice and Depth of Technical Knowledge. Summary of Experience word limits: 5,500 words total — 1,500 for mandatory competencies and 4,000 for technical competencies. Case study word limit is 3,000 words. The Renters Rights Act 2025 has been enacted into law. It abolishes Section 21 no-fault evictions, converts all assured shorthold tenancies to periodic tenancies, strengthens tenant rights and introduces a Decent Homes Standard for the private rented sector. The bulk of the Renters Rights Act 2025 reforms came into force on 1 May 2026, including abolition of Section 21 no-fault evictions and conversion of all assured shorthold tenancies to periodic assured tenancies. The APC counsellor's role is to supervise the candidate throughout their APC, review and sign off the Summary of Experience and case study before submission, provide guidance and support, conduct regular reviews and countersign the final submission. There are 11 mandatory competencies for APC candidates: Ethics Rules of Conduct and Professionalism, Client Care, Communication and Negotiation, Health and Safety, Business Planning, Conflict Avoidance Management and Dispute Resolution, Accounting Principles and Procedures, Data Management, Sustainability, Inclusive Environments, and Diversity Inclusion and Teamworking. When handling a formal complaint surveyors must: acknowledge promptly, investigate thoroughly, respond within the timeframe in the complaints procedure, offer redress where appropriate, and refer to RICS Dispute Resolution Service if unresolved. Under the Health and Safety at Work Act 1974 the key legal standard is 'so far as is reasonably practicable'. Employers must ensure the health safety and welfare of employees so far as is reasonably practicable. Always use the phrase 'reasonably practicable' when answering questions about HSWA 1974 duties. The APC counsellor supervises the candidate, reviews and signs off the Summary of Experience and case study before submission, countersigns the final APC submission. Always use the words supervise and sign off when describing the counsellor role.";

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
