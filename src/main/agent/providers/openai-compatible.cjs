/**
 * Eyqa OpenAI-Compatible Provider Driver
 * Supports Groq, NVIDIA NIM, OpenRouter, Ollama, DeepSeek, OpenAI, etc.
 * Handles SSE streaming, reasoning/thinking tokens (DeepSeek R1/Nemotron), and tool calls.
 */

const { TOOL_SCHEMAS } = require('./base.cjs');

async function streamOpenAICompatible({
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
  const baseUrl = (provider.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const formattedMessages = [];
  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt });
  }

  for (const m of messages) {
    if (m.role === 'tool') {
      formattedMessages.push({
        role: 'tool',
        tool_call_id: m.tool_call_id,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      });
    } else if (m.role === 'assistant') {
      const msg = { role: 'assistant', content: m.content || '' };
      if (m.tool_calls && m.tool_calls.length > 0) {
        msg.tool_calls = m.tool_calls;
      }
      formattedMessages.push(msg);
    } else {
      formattedMessages.push({ role: 'user', content: m.content });
    }
  }

  const payload = {
    model: provider.model,
    messages: formattedMessages,
    stream: true,
    temperature: 0.7
  };

  if (enableTools) {
    payload.tools = customTools || TOOL_SCHEMAS;
    payload.tool_choice = 'auto';
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (provider.apiKey && provider.apiKey.trim() !== '') {
    headers['Authorization'] = `Bearer ${provider.apiKey.trim()}`;
  }

  // OpenRouter requires HTTP-Referer and X-Title for rankings
  if (baseUrl.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = 'https://eyqa.ai';
    headers['X-Title'] = 'Eyqa AI Coworker';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errJson = await response.json();
      errorDetails = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetails = await response.text();
    }
    throw new Error(`[${provider.name}] HTTP ${response.status}: ${errorDetails}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const accumulatedToolCalls = {};
  let fullContent = '';
  let fullThought = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;

      if (trimmed === 'data: [DONE]') {
        continue;
      }

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const choice = parsed.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;
          if (!delta) continue;

          // 1. Check for thinking / reasoning tokens (DeepSeek R1, Nemotron, Groq)
          const reasoning = delta.reasoning_content || delta.reasoning || delta.thought;
          if (reasoning) {
            fullThought += reasoning;
            if (onThought) onThought(reasoning);
          }

          // 2. Check for standard content
          if (delta.content) {
            fullContent += delta.content;
            if (onToken) onToken(delta.content);
          }

          // 3. Check for streaming tool calls
          if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!accumulatedToolCalls[idx]) {
                accumulatedToolCalls[idx] = {
                  id: tc.id || `call_${Date.now()}_${idx}`,
                  type: 'function',
                  function: { name: '', arguments: '' }
                };
              }
              if (tc.id) accumulatedToolCalls[idx].id = tc.id;
              if (tc.function?.name) accumulatedToolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        } catch {
          // Ignore partial chunk decode errors
        }
      }
    }
  }

  // Format completed tool calls
  const completedToolCalls = Object.values(accumulatedToolCalls).map(tc => {
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(tc.function.arguments);
    } catch {
      parsedArgs = {};
    }
    return {
      id: tc.id,
      name: tc.function.name,
      arguments: parsedArgs,
      rawArguments: tc.function.arguments
    };
  });

  return {
    content: fullContent,
    thought: fullThought,
    toolCalls: completedToolCalls
  };
}

async function testOpenAICompatible(provider) {
  const startTime = Date.now();
  const baseUrl = (provider.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const headers = {
    'Content-Type': 'application/json'
  };

  if (provider.apiKey && provider.apiKey.trim() !== '') {
    headers['Authorization'] = `Bearer ${provider.apiKey.trim()}`;
  }

  const payload = {
    model: provider.model,
    messages: [{ role: 'user', content: 'Say "Eyqa OK" in 2 words.' }],
    max_tokens: 10,
    temperature: 0.1
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
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
    const reply = data.choices?.[0]?.message?.content || 'Connected';

    return {
      success: true,
      latency,
      reply: reply.trim(),
      model: provider.model
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
  streamOpenAICompatible,
  testOpenAICompatible
};
