/**
 * Eyqa Memory Store Adapter
 * Powered by YouMeStore (~/.config/eyqa/you.me) for user context,
 * while project memory is managed strictly per-project in .eyqa/
 */

const { getYouMeStore } = require('./you-me-store.cjs');

class MemoryStoreAdapter {
  constructor() {
    this.store = getYouMeStore();
  }

  getSystemPromptSnippet() {
    return this.store.getPromptSnippet();
  }

  getYouMe() {
    return this.store.get();
  }

  getRaw() {
    return this.store.getRaw();
  }

  saveRaw(content) {
    return this.store.saveRaw(content);
  }

  update(fields) {
    return this.store.update(fields);
  }

  getAll() {
    const data = this.store.get();
    return {
      success: true,
      profile: {
        name: data.name,
        roleOrTitle: data.background,
        preferredTone: 'natural, sharp, concise'
      },
      likes: data.likes,
      notes: data.notes,
      raw: data.raw,
      filePath: data.filePath
    };
  }

  updateProfile(profile) {
    return this.store.update({
      name: profile?.name,
      background: profile?.roleOrTitle || profile?.background,
      likes: profile?.preferredTone ? `Tone: ${profile.preferredTone}` : null
    });
  }

  addFact({ key, value, category }) {
    if (category === 'preference' || /like|pref/i.test(key || '')) {
      return this.store.update({ likes: `${key}: ${value}` });
    }
    return this.store.update({ notes: `${key}: ${value}` });
  }

  deleteFact() {
    // For you.me, direct editing or raw markdown save is preferred
    return { success: true };
  }
}

let adapterInstance = null;

function getMemoryStore() {
  if (!adapterInstance) {
    adapterInstance = new MemoryStoreAdapter();
  }
  return adapterInstance;
}

module.exports = {
  MemoryStoreAdapter,
  getMemoryStore
};
