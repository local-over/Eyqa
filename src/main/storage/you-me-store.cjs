/**
 * you.me - Simple User Profile & Preferences Store
 * 
 * Manages the single ~/.config/eyqa/you.me file.
 * Strictly stores information about the human user:
 * - Name
 * - Background & Role
 * - What they like & preferences
 * - Personal notes
 * 
 * General project/codebase memory is kept strictly per-project in .eyqa/
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DEFAULT_YOU_ME_TEMPLATE = `# you.me - User Profile

Name: 
Background: 

Likes & Preferences:
- Direct, action-oriented responses without conversational fluff
- Clean, surgical code updates

Notes:
`;

function parseYouMeContent(content) {
  const lines = (content || '').split(/\r?\n/);
  let name = '';
  let background = '';
  const likes = [];
  const notes = [];
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^Name:[ \t]*/i.test(trimmed)) {
      name = trimmed.replace(/^Name:[ \t]*/i, '').trim();
      currentSection = null;
      continue;
    }

    if (/^Background:[ \t]*/i.test(trimmed)) {
      background = trimmed.replace(/^Background:[ \t]*/i, '').trim();
      currentSection = null;
      continue;
    }

    if (/^Likes & Preferences:/i.test(trimmed) || /^Preferences:/i.test(trimmed) || /^Likes:/i.test(trimmed)) {
      currentSection = 'likes';
      continue;
    }

    if (/^Notes:/i.test(trimmed)) {
      currentSection = 'notes';
      continue;
    }

    if (currentSection === 'likes') {
      const cleanItem = trimmed.replace(/^[-*•][ \t]*/, '').trim();
      if (cleanItem && !likes.includes(cleanItem)) {
        likes.push(cleanItem);
      }
    } else if (currentSection === 'notes') {
      const cleanItem = trimmed.replace(/^[-*•][ \t]*/, '').trim();
      if (cleanItem && !notes.includes(cleanItem)) {
        notes.push(cleanItem);
      }
    }
  }

  return { name, background, likes, notes };
}

function serializeYouMeContent({ name = '', background = '', likes = [], notes = [] }) {
  let md = '# you.me - User Profile\n\n';
  md += `Name: ${name || ''}\n`;
  md += `Background: ${background || ''}\n\n`;
  md += 'Likes & Preferences:\n';
  if (likes && likes.length > 0) {
    md += likes.map(l => `- ${String(l).replace(/^[-*•][ \t]*/, '').trim()}`).join('\n') + '\n';
  } else {
    md += '- Direct, action-oriented responses without conversational fluff\n- Clean, surgical code updates\n';
  }
  md += '\nNotes:\n';
  if (notes && notes.length > 0) {
    md += notes.map(n => `- ${String(n).replace(/^[-*•][ \t]*/, '').trim()}`).join('\n') + '\n';
  }
  return md;
}

class YouMeStore {
  constructor(customPath = null) {
    this.configDir = customPath || path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
      'eyqa'
    );
    this.filePath = path.join(this.configDir, 'you.me');
    this._init();
  }

  _init() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        // Check for legacy main.me to migrate user name/role if available
        let initialContent = DEFAULT_YOU_ME_TEMPLATE;
        const legacyMainMe = path.join(this.configDir, 'memory', 'main.me');
        if (fs.existsSync(legacyMainMe)) {
          try {
            const legacy = fs.readFileSync(legacyMainMe, 'utf8');
            const nameMatch = legacy.match(/User:[ \t]*([^\r\n]+)/i);
            const roleMatch = legacy.match(/Role:[ \t]*([^\r\n]+)/i);
            const initialParsed = parseYouMeContent(initialContent);
            if (nameMatch && nameMatch[1].trim()) {
              initialParsed.name = nameMatch[1].trim();
            }
            if (roleMatch && roleMatch[1].trim()) {
              initialParsed.background = roleMatch[1].trim();
            }
            initialContent = serializeYouMeContent(initialParsed);
          } catch (_) {}
        }
        fs.writeFileSync(this.filePath, initialContent, 'utf8');
      }

      // Clean up legacy multi-node memory folder to eliminate confusion
      const legacyMemoryDir = path.join(this.configDir, 'memory');
      if (fs.existsSync(legacyMemoryDir)) {
        try {
          fs.rmSync(legacyMemoryDir, { recursive: true, force: true });
        } catch (_) {}
      }
      const legacyJson = path.join(this.configDir, 'universal_memory.json');
      if (fs.existsSync(legacyJson)) {
        try {
          fs.unlinkSync(legacyJson);
        } catch (_) {}
      }
    } catch (err) {
      console.error('[YouMeStore] Init error:', err);
    }
  }

  getFilePath() {
    return this.filePath;
  }

  getRaw() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this._init();
      }
      return fs.readFileSync(this.filePath, 'utf8');
    } catch (err) {
      console.error('[YouMeStore] Read error:', err);
      return DEFAULT_YOU_ME_TEMPLATE;
    }
  }

  saveRaw(content) {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      const cleanContent = (content || '').trim() + '\n';
      fs.writeFileSync(this.filePath, cleanContent, 'utf8');
      return { success: true, filePath: this.filePath };
    } catch (err) {
      console.error('[YouMeStore] Save error:', err);
      return { success: false, error: err.message };
    }
  }

  get() {
    const raw = this.getRaw();
    const parsed = parseYouMeContent(raw);

    return {
      success: true,
      name: parsed.name,
      background: parsed.background,
      likes: parsed.likes,
      notes: parsed.notes,
      raw,
      filePath: this.filePath
    };
  }

  update({ name = null, background = null, likes = null, notes = null, fact = null }) {
    try {
      const current = this.get();
      const updated = {
        name: current.name,
        background: current.background,
        likes: [...current.likes],
        notes: [...current.notes]
      };

      if (name && typeof name === 'string' && name.trim()) {
        updated.name = name.trim();
      }

      if (background && typeof background === 'string' && background.trim()) {
        updated.background = background.trim();
      }

      const appendItems = (targetList, items) => {
        if (!items) return;
        const arr = Array.isArray(items) ? items : [items];
        for (const item of arr) {
          if (!item || typeof item !== 'string') continue;
          const clean = item.trim().replace(/^[-*•][ \t]*/, '');
          if (!clean) continue;
          const exists = targetList.some(existing => existing.toLowerCase() === clean.toLowerCase());
          if (!exists) {
            targetList.push(clean);
          }
        }
      };

      if (likes) {
        appendItems(updated.likes, likes);
      }

      const noteItem = notes || fact;
      if (noteItem) {
        appendItems(updated.notes, noteItem);
      }

      const newContent = serializeYouMeContent(updated);
      this.saveRaw(newContent);

      return {
        success: true,
        message: 'Updated you.me successfully.',
        data: this.get()
      };
    } catch (err) {
      console.error('[YouMeStore] Update error:', err);
      return { success: false, error: err.message };
    }
  }

  getPromptSnippet() {
    const data = this.get();
    const hasName = Boolean(data.name);
    const hasBg = Boolean(data.background);
    const hasLikes = data.likes && data.likes.length > 0;
    const hasNotes = data.notes && data.notes.length > 0;

    if (!hasName && !hasBg && !hasLikes && !hasNotes) {
      return `[About the User (you.me)]: Not configured yet. When the user shares their name, background, or personal preferences, call update_user_memory.`;
    }

    let snippet = `[About the User (from you.me)]:\n`;
    if (hasName) snippet += `User Name: ${data.name}\n`;
    if (hasBg) snippet += `Background / Role: ${data.background}\n`;
    if (hasLikes) {
      snippet += `What they like & Preferences:\n${data.likes.map(l => `- ${l}`).join('\n')}\n`;
    }
    if (hasNotes) {
      snippet += `Personal Notes:\n${data.notes.map(n => `- ${n}`).join('\n')}\n`;
    }
    return snippet.trim();
  }
}

let storeInstance = null;

function getYouMeStore(customPath = null) {
  if (!storeInstance || customPath) {
    storeInstance = new YouMeStore(customPath);
  }
  return storeInstance;
}

module.exports = {
  YouMeStore,
  getYouMeStore,
  parseYouMeContent,
  serializeYouMeContent
};
