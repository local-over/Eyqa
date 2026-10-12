/**
 * Eyqa Semi-Background Memory Agent (Memory Custodian)
 * Handles systematic autonomous storage, tree traversal, compacting,
 * and retrieval across the ~/.config/eyqa/memory/ tree.
 */

const path = require('node:path');
const { getTreeMemoryStore } = require('../storage/tree-memory-store.cjs');

class MemoryAgent {
  constructor(customStore = null) {
    this.store = customStore || getTreeMemoryStore();
  }

  /**
   * Systematically saves memory into the appropriate .me node.
   * Dynamically grows the tree, creates new nodes when needed,
   * and enforces strict 40-line / 300-word budgets per file.
   */
  async saveMemory({ topic = null, information = null, category = 'fact', key = null, value = null }) {
    const memoryStore = this.store;
    const infoText = (information || value || '').trim();
    const topicText = (topic || key || 'General').trim();

    if (!infoText) {
      return { success: false, error: 'No memory information provided.' };
    }

    const tree = memoryStore.getTree();
    if (!tree.success) {
      return { success: false, error: tree.error || 'Failed to inspect memory tree.' };
    }

    // Determine target node in tree
    const targetNode = this._classifyTargetNode(topicText, infoText, category, tree.nodes);

    // If updating main.me core identity
    if (targetNode === 'main.me' && (topicText.toLowerCase().includes('identity') || topicText.toLowerCase().includes('user') || topicText.toLowerCase().includes('role'))) {
      return this._updateMainIdentity(infoText);
    }

    // Retrieve or create target file
    let fileRes = memoryStore.getFile(targetNode);
    if (!fileRes.success) {
      const created = memoryStore.createNode(targetNode.replace(/\.me$/, ''), `Specialized memory for ${topicText}`, 'main.me');
      if (!created.success) {
        return { success: false, error: `Could not create memory branch: ${created.error}` };
      }
      fileRes = memoryStore.getFile(targetNode);
    }

    let content = fileRes.content || '';
    const newBullet = `- ${infoText}`;

    // Prevent duplicate entries
    if (content.toLowerCase().includes(infoText.toLowerCase())) {
      return {
        success: true,
        file: targetNode,
        status: 'already_known',
        message: `Information is already recorded in memory node "${targetNode}".`
      };
    }

    // Insert under appropriate section or append
    let updatedContent = this._appendEntry(content, newBullet, topicText);

    // Check budget limits
    const stats = memoryStore.countStats(updatedContent);
    if (stats.lines > memoryStore.maxLines || stats.words > memoryStore.maxWords) {
      // Compact the content
      updatedContent = this._compactNode(updatedContent);
      const recheck = memoryStore.countStats(updatedContent);

      // If still overflowing, branch into a sub-node
      if (recheck.lines > memoryStore.maxLines || recheck.words > memoryStore.maxWords) {
        const branchName = `${targetNode.replace(/\.me$/, '')}-${topicText.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 12)}.me`;
        memoryStore.createNode(branchName.replace(/\.me$/, ''), `Sub-branch for ${topicText}`, targetNode);
        const subSave = memoryStore.saveFile(branchName, `# ${topicText}\n\n## Details\n${newBullet}\n`);
        return {
          success: true,
          file: branchName,
          status: 'branched_overflow',
          message: `Memory node "${targetNode}" reached budget. Branched new node "${branchName}" and recorded entry.`
        };
      }
    }

    const saveRes = memoryStore.saveFile(targetNode, updatedContent);
    if (!saveRes.success) {
      return { success: false, error: saveRes.error };
    }

    return {
      success: true,
      file: targetNode,
      status: 'saved',
      message: `Persisted to memory tree node "${targetNode}": ${infoText}`
    };
  }

  /**
   * Systematically queries the memory tree and returns concise relevant facts
   */
  async queryMemory({ query = '', topic = null }) {
    const memoryStore = this.store;
    const tree = memoryStore.getTree();
    if (!tree.success) return { results: [], error: 'Could not access memory tree' };

    const q = (query || topic || '').toLowerCase().trim();
    if (!q) {
      const mainRes = memoryStore.getFile('main.me');
      return {
        rootContext: mainRes.content || '',
        availableBranches: tree.nodes.map(n => ({ filename: n.filename, title: n.title, words: n.wordCount }))
      };
    }

    const matches = [];

    // Search across all .me nodes
    for (const node of tree.nodes) {
      const content = node.content || '';
      const lines = content.split('\n');
      const nodeMatches = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const words = q.split(/\s+/).filter(w => w.length > 2);
        const hasMatch = words.some(w => trimmed.toLowerCase().includes(w));
        if (hasMatch) {
          nodeMatches.push(trimmed.replace(/^-\s*/, ''));
        }
      }

      if (nodeMatches.length > 0) {
        matches.push({
          sourceNode: node.filename,
          nodeTitle: node.title,
          facts: nodeMatches
        });
      }
    }

    return {
      success: true,
      query: q,
      totalMatchedNodes: matches.length,
      matches
    };
  }

  _classifyTargetNode(topic, info, category = '', existingNodes = []) {
    const t = (topic || '').toLowerCase();
    const inf = (info || '').toLowerCase();
    const cat = (category || '').toLowerCase();

    // Direct category overrides
    if (cat === 'tech-stack' || cat === 'tech' || cat === 'stack') return 'tech-stack.me';
    if (cat === 'preference' || cat === 'preferences' || cat === 'style') return 'preferences.me';
    if (cat === 'project' || cat === 'projects') return 'projects.me';

    // 1. Core Identity & Global direct rules -> main.me
    if (t.includes('identity') || t.includes('name') || t.includes('who is') || t.includes('role')) {
      return 'main.me';
    }

    // 2. Tech stack, programming languages, libraries, frameworks -> tech-stack.me
    const techKeywords = [
      'language', 'rust', 'typescript', 'python', 'go', 'golang', 'javascript', 'bun', 'node',
      'react', 'svelte', 'vue', 'tailwind', 'sql', 'postgres', 'postgresql', 'mysql', 'redis',
      'database', 'sqlite', 'docker', 'api', 'framework', 'library', 'compiler', 'build',
      'orm', 'prisma', 'schema', 'backend', 'frontend', 'ci/cd', 'git'
    ];
    if (techKeywords.some(k => t.includes(k) || inf.includes(k))) {
      return 'tech-stack.me';
    }

    // 3. User communication, formatting, output preferences -> preferences.me
    const prefKeywords = ['preference', 'tone', 'style', 'format', 'concise', 'habit', 'rule', 'always', 'never', 'markdown', 'bullets'];
    if (prefKeywords.some(k => t.includes(k) || inf.includes(k))) {
      return 'preferences.me';
    }

    // 4. Projects, domains, company, codebase -> projects.me
    const projKeywords = ['project', 'repo', 'product', 'company', 'eyqa', 'app', 'business', 'domain'];
    if (projKeywords.some(k => t.includes(k) || inf.includes(k))) {
      return 'projects.me';
    }

    // Check if an existing specialized node matches
    const sanitizedTopic = t.replace(/[^a-z0-9]/g, '-');
    const existing = existingNodes.find(n => n.filename.includes(sanitizedTopic));
    if (existing) {
      return existing.filename;
    }

    // Fallback to preferences.me or new specialized node
    if (topic.length <= 16 && !topic.includes(' ')) {
      return `${sanitizedTopic}.me`;
    }
    return 'preferences.me';
  }

  _updateMainIdentity(infoText) {
    const mainRes = this.store.getFile('main.me');
    if (!mainRes.success) return { success: false, error: 'Cannot read main.me' };

    let content = mainRes.content;
    const nameMatch = infoText.match(/(?:name is|called|call me|i am)\s+([a-zA-Z0-9_-]+)/i);
    if (nameMatch) {
      content = content.replace(/User:\s*.*/, `User: ${nameMatch[1].trim()}`);
    }

    const roleMatch = infoText.match(/(?:role is|work as|i work as a|job is)\s+([a-zA-Z0-9\s_-]+)/i);
    if (roleMatch) {
      content = content.replace(/Role:\s*.*/, `Role: ${roleMatch[1].trim()}`);
    }

    const res = this.store.saveFile('main.me', content);
    return {
      success: true,
      file: 'main.me',
      status: 'updated_identity',
      message: 'Updated user identity in root main.me.'
    };
  }

  _appendEntry(content, bullet, topic) {
    const lines = content.split('\n');
    let lastHeaderIdx = -1;

    // Find the last section header
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('##')) {
        lastHeaderIdx = i;
        break;
      }
    }

    if (lastHeaderIdx !== -1) {
      // Append bullet after the section
      lines.splice(lines.length - 1, 0, bullet);
      return lines.join('\n');
    }

    return content.trim() + `\n\n## Recorded Context\n${bullet}\n`;
  }

  _compactNode(content) {
    const lines = content.split('\n');
    const seen = new Set();
    const compacted = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-')) {
        const norm = trimmed.toLowerCase();
        if (seen.has(norm)) continue;
        seen.add(norm);
      }
      compacted.push(line);
    }

    return compacted.join('\n');
  }
}

let agentInstance = null;
function getMemoryAgent() {
  if (!agentInstance) {
    agentInstance = new MemoryAgent();
  }
  return agentInstance;
}

module.exports = {
  MemoryAgent,
  getMemoryAgent
};
