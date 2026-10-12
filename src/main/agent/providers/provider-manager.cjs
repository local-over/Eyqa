/**
 * Eyqa Provider Manager & Automatic Fallback Engine
 * Implements Free Claude Code (FCC) priority cascading logic:
 * - Automated Free Pool routing across 19 providers with zero manual model micromanagement.
 * - Rate limit (HTTP 429) & outage detection with automatic 45s cooldown rotation.
 * - Seamless streaming with transparent live fallback reporting.
 */

const { streamOpenAICompatible, testOpenAICompatible } = require('./openai-compatible.cjs');
const { streamGemini, testGemini } = require('./gemini.cjs');
const { streamAnthropic, testAnthropic } = require('./anthropic.cjs');

class ProviderManager {
  constructor(configStore) {
    this.configStore = configStore;
    this.cooldowns = new Map(); // providerId -> timestamp
  }

  getProvider(providerId) {
    const config = this.configStore.get();
    return config.providers[providerId] || null;
  }

  /**
   * Retrieves all ready free pool candidates sorted by FCC priority logic.
   * If any provider is in cooldown from a 429, it is placed at the end.
   */
  getFreePoolCandidates() {
    const config = this.configStore.get();
    const priority = config.freePoolPriority || [];
    const ready = [];
    const coolingDown = [];
    const now = Date.now();

    for (const id of priority) {
      const p = config.providers[id];
      if (!p || !p.enabled) continue;

      const hasKey = Boolean(p.apiKey && p.apiKey.trim() && p.apiKey !== 'fcc');
      const isLocal = id === 'ollama' || id === 'lmstudio' || (id === 'fcc_proxy' && p.apiKey === 'fcc');

      if (hasKey || isLocal) {
        const cdUntil = this.cooldowns.get(id) || 0;
        if (now < cdUntil) {
          coolingDown.push(p);
        } else {
          ready.push(p);
        }
      }
    }

    // Providers not in cooldown come first; cooling down providers come as last resort
    return [...ready, ...coolingDown];
  }

  getOrderedProviders(primaryId, customOrder = null) {
    const config = this.configStore.get();
    const order = customOrder || config.fallbackOrder || [];
    const providers = [];

    // Add primary first if valid and has apiKey or is local
    const primary = config.providers[primaryId];
    if (primary && primary.enabled && (primary.apiKey?.trim() || primary.id === 'ollama' || primary.id === 'lmstudio' || primary.id === 'fcc_proxy')) {
      providers.push(primary);
    }

    // Add other enabled providers in fallback order
    for (const id of order) {
      if (id !== primaryId) {
        const p = config.providers[id];
        if (p && p.enabled && (p.apiKey?.trim() || p.id === 'ollama' || p.id === 'lmstudio' || p.id === 'fcc_proxy')) {
          providers.push(p);
        }
      }
    }

    return providers;
  }

  async streamWithFallback({
    preferredProviderId = null,
    messages,
    systemPrompt,
    enableTools = true,
    customTools = null,
    onToken,
    onThought,
    onToolCall,
    onFallback,
    signal
  }) {
    const config = this.configStore.get();
    const isFreePool = (config.engineMode === 'free_pool' && preferredProviderId !== 'paid') || preferredProviderId === 'free_pool';

    if (isFreePool) {
      // 100% smart auto-handling delegated to Free Claude Code Proxy (Port 8082)
      // FCC natively handles provider routing across 60+ free tiers, automatic fallback,
      // HTTP 429 rate limit failover, thinking token injection, and Anthropic format translation.
      const fccProvider = {
        id: 'fcc_proxy',
        name: 'Free Claude Code',
        type: 'anthropic',
        baseUrl: 'http://127.0.0.1:8082/v1',
        apiKey: 'fcc',
        model: 'claude-3-5-sonnet-20241022'
      };

      try {
        const result = await streamAnthropic({
          provider: fccProvider,
          messages,
          systemPrompt,
          enableTools,
          customTools,
          reasoningEffort: config.reasoningEffort || 'from_client',
          onToken,
          onThought,
          onToolCall,
          signal
        });

        return {
          ...result,
          usedProvider: fccProvider
        };
      } catch (fccErr) {
        if (signal?.aborted) throw fccErr;
        console.warn('[ProviderManager] FCC Proxy error, checking direct fallback silently:', fccErr.message);

        if (fccErr.message?.includes('429') || fccErr.status === 429) {
          this.cooldowns.set('fcc_proxy', Date.now() + 45000);
        }

        // Silent direct backup to direct configured providers without spamming chat
        const directBackups = this.getOrderedProviders(config.activeProviderId || 'gemini');
        for (const candidate of directBackups) {
          if (candidate.id === 'fcc_proxy') continue;
          const cdUntil = this.cooldowns.get(candidate.id) || 0;
          if (Date.now() < cdUntil) continue;

          try {
            if (onFallback) {
              onFallback({
                fromProvider: 'fcc_proxy',
                toProvider: candidate.id,
                reason: fccErr.message
              });
            }
            return await this._streamSingleCandidate(candidate, {
              messages,
              systemPrompt,
              enableTools,
              customTools,
              config,
              onToken,
              onThought,
              onToolCall,
              signal
            });
          } catch (candErr) {
            if (candErr.message?.includes('429') || candErr.status === 429) {
              this.cooldowns.set(candidate.id, Date.now() + 45000);
            }
            continue;
          }
        }
        throw fccErr;
      }
    }

    // Paid mode: stream user-selected paid frontier provider directly
    const candidates = this.getOrderedProviders(preferredProviderId || config.activeProviderId || 'anthropic');
    if (candidates.length === 0) {
      throw new Error('No AI provider configured. Please check your settings.');
    }

    const paidProvider = candidates[0];
    return await this._streamSingleCandidate(paidProvider, {
      messages,
      systemPrompt,
      enableTools,
      customTools,
      config,
      onToken,
      onThought,
      onToolCall,
      signal
    });
  }

  async _streamSingleCandidate(provider, { messages, systemPrompt, enableTools, customTools, config, onToken, onThought, onToolCall, signal }) {
    let result;
    if (provider.type === 'gemini') {
      result = await streamGemini({
        provider,
        messages,
        systemPrompt,
        enableTools,
        customTools,
        onToken,
        onThought,
        onToolCall,
        signal
      });
    } else if (provider.type === 'anthropic' || provider.id === 'fcc_proxy') {
      result = await streamAnthropic({
        provider: {
          ...provider,
          apiKey: provider.apiKey || 'fcc',
          baseUrl: provider.baseUrl || 'http://127.0.0.1:8082/v1'
        },
        messages,
        systemPrompt,
        enableTools,
        customTools,
        reasoningEffort: config.reasoningEffort || 'from_client',
        onToken,
        onThought,
        onToolCall,
        signal
      });
    } else {
      result = await streamOpenAICompatible({
        provider,
        messages,
        systemPrompt,
        enableTools,
        customTools,
        reasoningEffort: config.reasoningEffort || 'from_client',
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
  }

  async testProvider(providerId, customConfig = null) {
    const provider = customConfig || this.getProvider(providerId);
    if (!provider) {
      return { success: false, latency: 0, error: 'Provider not found' };
    }

    if (provider.id === 'fcc_proxy') {
      return await this._testFCCProxy(provider);
    }

    if (provider.type === 'gemini') {
      return await testGemini(provider);
    } else if (provider.type === 'anthropic') {
      return await testAnthropic(provider);
    } else {
      return await testOpenAICompatible(provider);
    }
  }

  async _testFCCProxy(provider) {
    const startTime = Date.now();
    const baseUrl = (provider.baseUrl || 'http://127.0.0.1:8082').replace(/\/v1\/?$/, '').replace(/\/+$/, '');
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(4000) });
      const latency = Date.now() - startTime;
      if (res.ok) {
        let activeModel = 'nemotron-3-super-120b';
        try {
          const rootRes = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(2000) });
          if (rootRes.ok) {
            const rootData = await rootRes.json();
            activeModel = rootData.model || activeModel;
          }
        } catch (_) {}
        return {
          success: true,
          latency,
          reply: `Active & Serving (${activeModel})`,
          model: activeModel
        };
      } else {
        return { success: false, latency, error: `HTTP ${res.status}: ${res.statusText}` };
      }
    } catch (err) {
      return { success: false, latency: Date.now() - startTime, error: err.message };
    }
  }
}

module.exports = {
  ProviderManager
};
