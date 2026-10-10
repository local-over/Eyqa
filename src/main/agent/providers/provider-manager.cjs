/**
 * Eyqa Provider Manager & Automatic Fallback Engine
 * Adapts Free Claude Code's resilient multi-provider routing into a snappy desktop engine.
 * Automatically fails over to secondary free/paid providers on rate limits (429) or outages.
 */

const { streamOpenAICompatible, testOpenAICompatible } = require('./openai-compatible.cjs');
const { streamGemini, testGemini } = require('./gemini.cjs');
const { streamAnthropic, testAnthropic } = require('./anthropic.cjs');

class ProviderManager {
  constructor(configStore) {
    this.configStore = configStore;
  }

  getProvider(providerId) {
    const config = this.configStore.get();
    return config.providers[providerId] || null;
  }

  getOrderedProviders(primaryId, customOrder = null) {
    const config = this.configStore.get();
    const order = customOrder || config.fallbackOrder || [];
    const providers = [];

    // Add primary first if valid
    const primary = config.providers[primaryId];
    if (primary && primary.enabled) {
      providers.push(primary);
    }

    // Add other enabled providers in fallback order
    for (const id of order) {
      if (id !== primaryId) {
        const p = config.providers[id];
        if (p && p.enabled && (p.apiKey || id === 'ollama')) {
          providers.push(p);
        }
      }
    }

    return providers;
  }

  async streamWithFallback({
    preferredProviderId,
    messages,
    systemPrompt,
    enableTools = true,
    onToken,
    onThought,
    onToolCall,
    onFallback,
    signal
  }) {
    const candidates = this.getOrderedProviders(preferredProviderId);

    if (candidates.length === 0) {
      throw new Error(
        'No AI providers configured. Please open Settings (Ctrl+,) and add an API key for Google Gemini, Groq, NVIDIA NIM, or OpenRouter.'
      );
    }

    let lastError = null;

    for (let i = 0; i < candidates.length; i++) {
      const provider = candidates[i];
      const isFallbackAttempt = i > 0;

      if (isFallbackAttempt && onFallback) {
        onFallback({
          previousProvider: candidates[i - 1].name,
          currentProvider: provider.name,
          reason: lastError?.message || 'Rate limit or outage'
        });
      }

      try {
        let result;
        if (provider.type === 'gemini') {
          result = await streamGemini({
            provider,
            messages,
            systemPrompt,
            enableTools,
            onToken,
            onThought,
            onToolCall,
            signal
          });
        } else if (provider.type === 'anthropic') {
          result = await streamAnthropic({
            provider,
            messages,
            systemPrompt,
            enableTools,
            onToken,
            onThought,
            onToolCall,
            signal
          });
        } else {
          // openai_compatible (Groq, NVIDIA NIM, OpenRouter, Ollama, DeepSeek, OpenAI)
          result = await streamOpenAICompatible({
            provider,
            messages,
            systemPrompt,
            enableTools,
            onToken,
            onThought,
            onToolCall,
            signal
          });
        }

        return {
          ...result,
          usedProvider: provider
        };
      } catch (err) {
        console.warn(`[ProviderManager] Provider ${provider.name} failed:`, err.message);
        lastError = err;

        // If user cancelled, don't fallback
        if (signal?.aborted) {
          throw err;
        }

        // Check if there is another provider to try
        if (i < candidates.length - 1) {
          console.info(`[ProviderManager] Attempting fallback to ${candidates[i + 1].name}...`);
          continue;
        }
      }
    }

    throw lastError || new Error('All configured AI providers failed.');
  }

  async testProvider(providerId, customConfig = null) {
    const provider = customConfig || this.getProvider(providerId);
    if (!provider) {
      return { success: false, latency: 0, error: 'Provider not found' };
    }

    if (provider.type === 'gemini') {
      return await testGemini(provider);
    } else if (provider.type === 'anthropic') {
      return await testAnthropic(provider);
    } else {
      return await testOpenAICompatible(provider);
    }
  }
}

module.exports = {
  ProviderManager
};
