#!/usr/bin/env node
/**
 * Export active Eyqa API keys to a portable .env file for testers.
 * Note: .env is ignored by Git in .gitignore so keys will never be accidentally committed.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const settingsPath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'eyqa',
  'settings.json'
);

if (!fs.existsSync(settingsPath)) {
  console.error('No settings.json found at:', settingsPath);
  process.exit(1);
}

try {
  const cfg = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const providers = cfg.providers || {};

  const mapping = {
    groq: 'GROQ_API_KEY',
    gemini: 'GEMINI_API_KEY',
    nvidia_nim: 'NVIDIA_NIM_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    together: 'TOGETHER_API_KEY',
    deepinfra: 'DEEPINFRA_API_KEY',
    qwen: 'QWENCLOUD_API_KEY',
    cerebras: 'CEREBRAS_API_KEY',
    sambanova: 'SAMBANOVA_API_KEY',
    xai: 'XAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY'
  };

  const lines = [
    '# Eyqa Tester Configuration',
    '# Drop this file into the root of Eyqa to automatically skip setup and use pre-configured providers.',
    ''
  ];

  let exportedCount = 0;
  for (const [providerId, envVar] of Object.entries(mapping)) {
    const prov = providers[providerId];
    if (prov && prov.apiKey && prov.apiKey.trim() && prov.apiKey !== 'fcc') {
      lines.push(`${envVar}=${prov.apiKey.trim()}`);
      exportedCount++;
    }
  }

  const outPath = path.join(process.cwd(), '.env');
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
  console.log(`Successfully exported ${exportedCount} provider keys to .env`);
  console.log('You can now send this .env file to your tester.');
  console.log('When they place it in their Eyqa folder, setup will be automatically skipped!');
} catch (err) {
  console.error('Failed to export .env:', err.message);
  process.exit(1);
}
