/**
 * Eyqa Universal Memory Store Adapter
 * Bridges the legacy API surface to the TreeMemoryStore architecture
 * and MemoryAgent semi-background custodian.
 */

const { getTreeMemoryStore } = require('./tree-memory-store.cjs');
const { getMemoryAgent } = require('../agent/memory-agent.cjs');

class UniversalMemoryStore {
  constructor() {
    this.treeStore = getTreeMemoryStore();
    this.agent = getMemoryAgent();
  }

  getTree() {
    return this.treeStore.getTree();
  }

  getFile(filename) {
    return this.treeStore.getFile(filename);
  }

  saveFile(filename, content) {
    return this.treeStore.saveFile(filename, content);
  }

  createNode(name, description, parent) {
    return this.treeStore.createNode(name, description, parent);
  }

  deleteNode(filename) {
    return this.treeStore.deleteNode(filename);
  }

  getSystemPromptSnippet() {
    return this.treeStore.getMainMemorySnippet();
  }

  async addFact({ key, value, category = 'fact' }) {
    return await this.agent.saveMemory({ topic: key, information: value, category });
  }

  async updateProfile(profile) {
    const mainRes = this.treeStore.getFile('main.me');
    if (!mainRes.success) return profile;

    let content = mainRes.content;
    if (profile.name !== undefined) {
      content = content.replace(/User:\s*.*/, `User: ${profile.name}`);
    }
    if (profile.roleOrTitle !== undefined) {
      content = content.replace(/Role:\s*.*/, `Role: ${profile.roleOrTitle}`);
    }
    if (profile.preferredTone !== undefined) {
      content = content.replace(/Tone:\s*.*/, `Tone: ${profile.preferredTone}`);
    }
    if (profile.customDirectives !== undefined) {
      content = content.replace(/## Global Directives & Workflow Habits[\s\S]*?(?=##|$)/, `## Global Directives & Workflow Habits\n${profile.customDirectives}\n\n`);
    }

    this.treeStore.saveFile('main.me', content);
    return profile;
  }

  getAll() {
    const tree = this.treeStore.getTree();
    const mainRes = this.treeStore.getFile('main.me');
    const content = mainRes.content || '';

    const nameMatch = content.match(/User:\s*(.*)/i);
    const roleMatch = content.match(/Role:\s*(.*)/i);
    const toneMatch = content.match(/Tone:\s*(.*)/i);

    const facts = [];
    (tree.nodes || []).forEach(node => {
      if (node.filename === 'main.me') return;
      const lines = (node.content || '').split('\n');
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('-')) {
          facts.push({
            id: `${node.filename}_${idx}`,
            node: node.filename,
            category: node.filename.replace('.me', ''),
            key: node.title,
            value: trimmed.replace(/^-\s*/, '')
          });
        }
      });
    });

    return {
      version: 2,
      format: 'tree',
      memoryDir: tree.memoryDir,
      tree,
      userProfile: {
        name: nameMatch ? nameMatch[1].trim() : '',
        roleOrTitle: roleMatch ? roleMatch[1].trim() : '',
        preferredTone: toneMatch ? toneMatch[1].trim() : 'natural, sharp, concise'
      },
      learnedFacts: facts
    };
  }

  deleteFact(id) {
    if (!id) return false;
    const parts = id.split('_');
    const nodeFile = parts[0];
    const lineIdx = parseInt(parts[1], 10);

    const fileRes = this.treeStore.getFile(nodeFile);
    if (!fileRes.success) return false;

    const lines = fileRes.content.split('\n');
    if (lineIdx >= 0 && lineIdx < lines.length) {
      lines.splice(lineIdx, 1);
      this.treeStore.saveFile(nodeFile, lines.join('\n'));
      return true;
    }
    return false;
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
