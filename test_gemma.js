const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  try {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({
      model: 'gemini-flash-latest',
      systemInstruction: 'You are CIRO, an AI crisis analyst. You MUST NOT explain your reasoning. You MUST NOT use chain of thought. Output ONLY the final valid JSON object. Do not output anything before the JSON.',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });
    const prompt = `Analyze this crisis signal and classify it. Return a single JSON object.

Signal:
- Event type hint: fire
- Location: Downtown
- Confidence: 0.9

Return JSON with these exact fields:
{"type":"fire","severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":0.0}`;
    const result = await model.generateContent(prompt);
    console.log("Success:\n" + result.response.text());
  } catch (err) {
    console.error("Error with gemma:", err.message);
  }
}

test();
