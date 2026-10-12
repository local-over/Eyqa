/**
 * Eyqa Universal Dynamic Memory Store
 * Persists user habits, preferences, facts, and workflow context
 * across all projects and chats in ~/.config/eyqa/universal_memory.json.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const DEFAULT_MEMORY = {
  version: 1,
  userProfile: {
    name: '',
    roleOrTitle: '',
    preferredTone: 'natural, sharp, concise',
    customDirectives: ''
  },
  learnedFacts: [
    {
      id: 'fact-1',
      key: 'Communication Style',
      value: 'Prefers direct, fact-checked, concise answers. Hate AI slop, fluff, and unnecessary boilerplate.',
      category: 'preference',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'fact-2',
      key: 'Search Synthesis Rule',
      value: 'Always re-read user question before drafting search answers. Never dump raw search snippets.',
      category: 'instruction',
      updatedAt: new Date().toISOString()
    }
  ]
};

class UniversalMemoryStore {
  constructor(customPath = null) {
    const configDir = customPath || path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
      'eyqa'
    );
    this.filePath = path.join(configDir, 'universal_memory.json');
    this.data = null;
    this.init();
  }

  init() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          version: parsed.version || 1,
          userProfile: { ...DEFAULT_MEMORY.userProfile, ...(parsed.userProfile || {}) },
          learnedFacts: Array.isArray(parsed.learnedFacts) ? parsed.learnedFacts : DEFAULT_MEMORY.learnedFacts
        };
      } else {
        this.data = JSON.parse(JSON.stringify(DEFAULT_MEMORY));
        this.save();
      }
    } catch (err) {
      console.error('[MemoryStore] Failed to load memory:', err);
      this.data = JSON.parse(JSON.stringify(DEFAULT_MEMORY));
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('[MemoryStore] Failed to write memory:', err);
      return false;
    }
  }

  getAll() {
    return this.data;
  }

  getLearnedFacts() {
    return this.data.learnedFacts || [];
  }

  updateProfile(profileData) {
    if (!this.data.userProfile) this.data.userProfile = {};
    Object.assign(this.data.userProfile, profileData);
    this.save();
    return this.data.userProfile;
  }

  addFact({ key, value, category = 'fact' }) {
    if (!key || !value) return null;
    const existing = this.data.learnedFacts.find(
      f => f.key.toLowerCase().trim() === key.toLowerCase().trim()
    );

    if (existing) {
      existing.value = value;
      existing.category = category;
      existing.updatedAt = new Date().toISOString();
      this.save();
      return existing;
    }

    const newFact = {
      id: `fact-${crypto.randomBytes(4).toString('hex')}`,
      key: key.trim(),
      value: value.trim(),
      category: category.trim(),
      updatedAt: new Date().toISOString()
    };

    this.data.learnedFacts.push(newFact);
    this.save();
    return newFact;
  }

  getFact(id) {
    return this.data.learnedFacts.find(f => f.id === id) || null;
  }

  updateFact(id, { key, value, category }) {
    const item = this.data.learnedFacts.find(f => f.id === id);
    if (!item) return false;
    if (key !== undefined) item.key = key.trim();
    if (value !== undefined) item.value = value.trim();
    if (category !== undefined) item.category = category.trim();
    item.updatedAt = new Date().toISOString();
    this.save();
    return item;
  }

  deleteFact(id) {
    const initialLen = this.data.learnedFacts.length;
    this.data.learnedFacts = this.data.learnedFacts.filter(f => f.id !== id);
    if (this.data.learnedFacts.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Generates a compact system prompt injection block
   */
  getSystemPromptSnippet() {
    const profile = this.data.userProfile || {};
    const facts = this.data.learnedFacts || [];

    let snippet = '=== UNIVERSAL DYNAMIC MEMORY (Cross-Project Context) ===\n';
    if (profile.name) snippet += `User Name: ${profile.name}\n`;
    if (profile.roleOrTitle) snippet += `User Role/Context: ${profile.roleOrTitle}\n`;
    if (profile.preferredTone) snippet += `Tone Preference: ${profile.preferredTone}\n`;
    if (profile.customDirectives) snippet += `Directives: ${profile.customDirectives}\n`;

    if (facts.length > 0) {
      snippet += 'Learned Facts & Preferences:\n';
      facts.forEach(f => {
        snippet += `- [${f.category.toUpperCase()}] ${f.key}: ${f.value}\n`;
      });
    }

    snippet += '=======================================================';
    return snippet;
  }
}

let instance = null;
function getMemoryStore() {
  if (!instance) {
    instance = new UniversalMemoryStore();
  }
  return instance;
}

module.exports = {
  UniversalMemoryStore,
  getMemoryStore
};
