/**
 * Eyqa Anthropic Claude Provider Driver
 * Direct connection to Anthropic Messages API (Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku).
 * Supports interleaved thinking and tool use.
 */

const { ANTHROPIC_TOOL_DEFINITIONS } = require('./base.cjs');

async function streamAnthropic({
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
  const apiKey = (provider.apiKey || '').trim() || (provider.id === 'fcc_proxy' ? 'fcc' : '');
  if (!apiKey) {
    throw new Error('Anthropic API key is missing. Add your key in Settings.');
  }

  const baseUrl = (provider.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
  const url = `${baseUrl}/messages`;
  const formattedMessages = [];

  for (const m of messages) {
    if (m.role === 'tool') {
      formattedMessages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.tool_call_id,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
          }
        ]
      });
    } else if (m.role === 'assistant') {
      const contentBlocks = [];
      if (m.content) {
        contentBlocks.push({ type: 'text', text: m.content });
      }
      if (m.tool_calls && m.tool_calls.length > 0) {
        for (const tc of m.tool_calls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments || {}
          });
        }
      }
      formattedMessages.push({
        role: 'assistant',
        content: contentBlocks.length > 0 ? contentBlocks : (m.content || '')
      });
    } else {
      formattedMessages.push({
        role: 'user',
        content: m.content
      });
    }
  }

  const payload = {
    model: provider.model || 'claude-3-7-sonnet-20250219',
    messages: formattedMessages,
    max_tokens: 8192,
    stream: true
  };

  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  if (enableTools) {
    if (customTools && Array.isArray(customTools)) {
      payload.tools = customTools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      }));
    } else {
      payload.tools = ANTHROPIC_TOOL_DEFINITIONS;
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    let errText = '';
    try {
      const j = await response.json();
      errText = j.error?.message || JSON.stringify(j);
    } catch {
      errText = await response.text();
    }
    throw new Error(`[Anthropic] HTTP ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  let fullContent = '';
  let fullThought = '';
  const toolCallsMap = {};
  let currentBlockType = null;
  let currentBlockIndex = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        try {
          const event = JSON.parse(jsonStr);

          if (event.type === 'content_block_start') {
            currentBlockIndex = event.index;
            currentBlockType = event.content_block?.type;
            if (currentBlockType === 'tool_use') {
              toolCallsMap[currentBlockIndex] = {
                id: event.content_block.id,
                name: event.content_block.name,
                rawInput: ''
              };
            }
          } else if (event.type === 'content_block_delta') {
            const delta = event.delta;
            if (delta.type === 'text_delta') {
              fullContent += delta.text;
              if (onToken) onToken(delta.text);
            } else if (delta.type === 'thinking_delta') {
              fullThought += delta.thinking;
              if (onThought) onThought(delta.thinking);
            } else if (delta.type === 'input_json_delta') {
              if (toolCallsMap[event.index]) {
                toolCallsMap[event.index].rawInput += delta.partial_json;
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch (_) {}
  }

  const completedToolCalls = Object.values(toolCallsMap).map(tc => {
    let parsed = {};
    try {
      parsed = JSON.parse(tc.rawInput);
    } catch {
      parsed = {};
    }
    return {
      id: tc.id,
      name: tc.name,
      arguments: parsed
    };
  });

  return {
    content: fullContent,
    thought: fullThought,
    toolCalls: completedToolCalls
  };
}

async function testAnthropic(provider) {
  const startTime = Date.now();
  const apiKey = (provider.apiKey || '').trim();

  if (!apiKey) {
    return {
      success: false,
      latency: 0,
      error: 'Please enter an Anthropic API Key to test.'
    };
  }

  const baseUrl = (provider.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
  const url = `${baseUrl}/messages`;
  const payload = {
    model: provider.model || 'claude-3-5-haiku-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Say "Eyqa OK" in 2 words.' }]
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
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
    const reply = data.content?.[0]?.text || 'Connected';

    return {
      success: true,
      latency,
      reply: reply.trim(),
      model: payload.model
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
  streamAnthropic,
  testAnthropic
};
