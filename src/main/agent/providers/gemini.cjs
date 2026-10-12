/**
 * Eyqa Google Gemini Provider Driver
 * Direct native connection to Google AI Studio Gemini API (Gemini 2.0 Flash, 1.5 Pro, 1.5 Flash).
 * Free tier friendly, ultra-fast streaming SSE, native function calling.
 */

const { GEMINI_FUNCTION_DECLARATIONS } = require('./base.cjs');

async function streamGemini({
  provider,
  messages,
  systemPrompt,
  enableTools = true,
  customTools = null,
  onToken,
  onThought,
  onToolCall,
  signal
}) {
  const apiKey = (provider.apiKey || '').trim();
  if (!apiKey) {
    throw new Error('Google Gemini API key is missing. Add your free key in Settings.');
  }

  const model = provider.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  // Format messages into Gemini contents structure
  const contents = [];

  for (const m of messages) {
    if (m.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: m.name || 'tool_response',
            response: {
              result: m.content
            }
          }
        }]
      });
    } else if (m.role === 'assistant') {
      const parts = [];
      if (m.content) {
        parts.push({ text: m.content });
      }
      if (m.tool_calls && m.tool_calls.length > 0) {
        for (const tc of m.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.name || tc.function?.name,
              args: tc.arguments || {}
            }
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'model', parts });
      }
    } else {
      // user
      contents.push({
        role: 'user',
        parts: [{ text: m.content }]
      });
    }
  }

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  if (systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  if (enableTools) {
    const decls = (customTools && Array.isArray(customTools))
      ? customTools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        }))
      : GEMINI_FUNCTION_DECLARATIONS;
    payload.tools = [{
      functionDeclarations: decls
    }];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    let errDetail = '';
    try {
      const j = await response.json();
      errDetail = j.error?.message || JSON.stringify(j);
    } catch {
      errDetail = await response.text();
    }
    throw new Error(`[Google Gemini] HTTP ${response.status}: ${errDetail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  let fullContent = '';
  let fullThought = '';
  const detectedToolCalls = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const candidate = parsed.candidates?.[0];
            if (!candidate) continue;

            const parts = candidate.content?.parts || [];
            for (const part of parts) {
              // Text chunk
              if (part.text) {
                fullContent += part.text;
                if (onToken) onToken(part.text);
              }

              // Thought chunk if Gemini 2.0 thinking
              if (part.thought) {
                fullThought += part.thought;
                if (onThought) onThought(part.thought);
              }

              // Function Call chunk
              if (part.functionCall) {
                const callId = `call_gemini_${Date.now()}_${detectedToolCalls.length}`;
                const tc = {
                  id: callId,
                  name: part.functionCall.name,
                  arguments: part.functionCall.args || {}
                };
                detectedToolCalls.push(tc);
                if (onToolCall) onToolCall(tc);
              }
            }
          } catch {
            // ignore partial parse error
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch (_) {}
  }

  return {
    content: fullContent,
    thought: fullThought,
    toolCalls: detectedToolCalls
  };
}

async function testGemini(provider) {
  const startTime = Date.now();
  const apiKey = (provider.apiKey || '').trim();

  if (!apiKey) {
    return {
      success: false,
      latency: 0,
      error: 'Please enter a Gemini API Key to test.'
    };
  }

  const model = provider.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: 'Respond with "Eyqa Connected" in 2 words.' }] }],
    generationConfig: { maxOutputTokens: 10, temperature: 0.1 }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const latency = Date.now() - startTime;

    if (!response.ok) {
      let errText = '';
      try {
        const json = await response.json();
        errText = json.error?.message || JSON.stringify(json);
      } catch {
        errText = await response.text();
      }
      return {
        success: false,
        latency,
        error: `HTTP ${response.status}: ${errText}`
      };
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Connected';

    return {
      success: true,
      latency,
      reply: reply.trim(),
      model
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      success: false,
      latency: Date.now() - startTime,
      error: err.name === 'AbortError' ? 'Connection timed out (9s)' : err.message
    };
  }
}

module.exports = {
  streamGemini,
  testGemini
};
