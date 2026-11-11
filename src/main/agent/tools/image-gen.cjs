/**
 * Eyqa Image Generation Engine
 * Supports:
 * 1. Free: Pollinations.ai (Flux, SDXL, Turbo) - 100% free, zero API key, high quality.
 * 2. Paid: OpenAI DALL-E 3 (https://api.openai.com/v1/images/generations).
 * 3. Resilient Fallback: Auto-switches to Pollinations if paid fails or key is missing.
 * 4. Persistence: Saves into project `.eyqa/images/` or app home directory.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

/**
 * Resolve local destination directory for image artifacts
 */
function resolveImageDirectory(workspacePath = null) {
  let baseDir;
  if (workspacePath && fs.existsSync(workspacePath)) {
    baseDir = path.join(workspacePath, '.eyqa', 'images');
  } else {
    baseDir = path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
      'eyqa',
      'images'
    );
  }

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

/**
 * Normalize dimensions from size parameter
 */
function parseDimensions(size = '1024x1024') {
  const matches = (size || '').match(/^(\d+)x(\d+)$/i);
  if (matches) {
    return {
      width: Math.min(2048, Math.max(256, parseInt(matches[1], 10))),
      height: Math.min(2048, Math.max(256, parseInt(matches[2], 10)))
    };
  }
  return { width: 1024, height: 1024 };
}

/**
 * Generate image via Pollinations.ai (Free Flux / SDXL)
 */
async function generateViaPollinations({ prompt, width = 1024, height = 1024, style = 'natural', seed = null }) {
  const activeSeed = seed || Math.floor(Math.random() * 1000000);
  
  let model = 'flux';
  if (style === 'anime') model = 'flux-anime';
  else if (style === '3d' || style === 'render') model = 'flux-3d';
  else if (style === 'photorealistic' || style === 'realism') model = 'flux-realism';

  const encodedPrompt = encodeURIComponent(prompt.trim());
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&seed=${activeSeed}&nologo=true&enhance=true`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Eyqa-AI-Coworker/1.0.0 (Desktop)'
      },
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Pollinations HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());

    return {
      buffer,
      mimeType: contentType.includes('png') ? 'image/png' : 'image/jpeg',
      provider: 'pollinations',
      modelUsed: model,
      urlUsed: url
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate image via OpenAI DALL-E 3 (Paid)
 */
async function generateViaOpenAI({ prompt, apiKey, size = '1024x1024', style = 'vivid', quality = 'standard' }) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('OpenAI API key is missing for DALL-E 3 image generation.');
  }

  const endpoint = 'https://api.openai.com/v1/images/generations';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.trim(),
        n: 1,
        size: ['1024x1024', '1024x1792', '1792x1024'].includes(size) ? size : '1024x1024',
        quality: quality === 'hd' ? 'hd' : 'standard',
        style: style === 'natural' ? 'natural' : 'vivid',
        response_format: 'b64_json'
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      let errText = '';
      try {
        const j = await res.json();
        errText = j.error?.message || JSON.stringify(j);
      } catch (_) {
        errText = await res.text();
      }
      throw new Error(`OpenAI DALL-E 3 HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const item = data.data?.[0];
    if (!item || !item.b64_json) {
      throw new Error('OpenAI did not return b64_json image data.');
    }

    const buffer = Buffer.from(item.b64_json, 'base64');
    return {
      buffer,
      mimeType: 'image/png',
      provider: 'openai_dalle3',
      revisedPrompt: item.revised_prompt || prompt,
      modelUsed: 'dall-e-3'
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Main generateImage function with graceful degradation
 */
async function generateImage({
  prompt,
  imageName = null,
  size = '1024x1024',
  style = 'natural',
  preferredProvider = null,
  configStore = null,
  workspacePath = null
}) {
  if (!prompt || !prompt.trim()) {
    return { error: 'Prompt is required for image generation.' };
  }

  const config = configStore ? configStore.get() : {};
  const imgConfig = config.imageGeneration || {};
  const targetProvider = preferredProvider || imgConfig.provider || 'pollinations';
  const openaiKey = imgConfig.apiKey || config.providers?.openai?.apiKey || '';
  const allowFallback = imgConfig.fallbackToFree !== false;

  const { width, height } = parseDimensions(size);
  let resultBuffer = null;
  let activeMime = 'image/png';
  let usedProvider = targetProvider;
  let fallbackOccurred = false;
  let fallbackReason = null;
  let revisedPrompt = null;

  if (targetProvider === 'openai' || targetProvider === 'dalle3') {
    try {
      const res = await generateViaOpenAI({
        prompt,
        apiKey: openaiKey,
        size,
        style,
        quality: imgConfig.quality || 'standard'
      });
      resultBuffer = res.buffer;
      activeMime = res.mimeType;
      usedProvider = 'openai_dalle3';
      revisedPrompt = res.revisedPrompt;
    } catch (err) {
      if (!allowFallback) {
        return {
          error: `OpenAI DALL-E 3 generation failed: ${err.message}`
        };
      }
      fallbackOccurred = true;
      fallbackReason = err.message;
    }
  }

  if (!resultBuffer) {
    try {
      const res = await generateViaPollinations({
        prompt,
        width,
        height,
        style
      });
      resultBuffer = res.buffer;
      activeMime = res.mimeType;
      usedProvider = fallbackOccurred ? 'pollinations_fallback' : 'pollinations_free';
    } catch (err) {
      return {
        error: `Image generation failed. Error: ${err.message}${fallbackReason ? ` (Primary failure: ${fallbackReason})` : ''}`
      };
    }
  }

  const saveDir = resolveImageDirectory(workspacePath);
  const ext = activeMime === 'image/jpeg' ? '.jpg' : '.png';
  const sanitizedName = imageName
    ? imageName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 50)
    : `gen_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const filename = `${sanitizedName}${ext}`;
  const fullFilePath = path.join(saveDir, filename);

  fs.writeFileSync(fullFilePath, resultBuffer);

  const base64Data = resultBuffer.toString('base64');
  const dataUrl = `data:${activeMime};base64,${base64Data}`;
  const relPath = workspacePath ? path.relative(workspacePath, fullFilePath) : fullFilePath;

  return {
    success: true,
    fileName: filename,
    filePath: fullFilePath,
    relativePath: relPath,
    dataUrl,
    prompt,
    revisedPrompt,
    provider: usedProvider,
    fallbackOccurred,
    fallbackReason,
    dimensions: { width, height },
    markdown: `![${imageName || prompt}](${dataUrl})`
  };
}

module.exports = {
  generateImage,
  generateViaPollinations,
  generateViaOpenAI,
  resolveImageDirectory
};
