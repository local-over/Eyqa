/**
 * Eyqa Universal Tree Memory Store
 * Stores universal memory as a folder-based tree of compact .me files
 * rooted at ~/.config/eyqa/memory/main.me with hard word and line limits.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const MAX_LINES_PER_FILE = 40;
const MAX_WORDS_PER_FILE = 300;

const DEFAULT_MAIN_ME = `# Eyqa Universal Memory - Root Context

## Identity & Core Context
User: 
Role: 
Tone: natural, sharp, concise

## Global Directives & Workflow Habits
- Direct, action-oriented execution without conversational filler.
- Respect project workspace constraints and keep diffs surgical.

## Memory Tree Index
-> [tech-stack.me]: Programming languages, runtimes, preferred libraries, and tools.
-> [preferences.me]: User communication habits, formatting patterns, and preferences.
-> [projects.me]: Key domains, active products, and business context.
`;

const DEFAULT_TECH_STACK_ME = `# Tech Stack & Development Environment

## Primary Languages & Frameworks
- Preferred languages, runtimes, and build tools.

## Architectural Guidelines
- Production-grade code with strict typing and robust error handling.
`;

const DEFAULT_PREFERENCES_ME = `# User Preferences & Interaction Style

## Workflow & Output Formatting
- Concise, fact-checked answers directly addressing the question.
- Prefer surgical line-level code updates over full rewrites.
`;

const DEFAULT_PROJECTS_ME = `# Projects & Domain Context

## Active Workspaces & Products
- Eyqa: Autonomous AI desktop coworker with local workspace automation.
`;

class TreeMemoryStore {
  constructor(customPath = null) {
    const configDir = customPath || path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
      'eyqa'
    );
    this.memoryDir = path.join(configDir, 'memory');
    this.configDir = configDir;
    this.maxLines = MAX_LINES_PER_FILE;
    this.maxWords = MAX_WORDS_PER_FILE;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.memoryDir)) {
        fs.mkdirSync(this.memoryDir, { recursive: true });
      }

      const mainMePath = path.join(this.memoryDir, 'main.me');
      if (!fs.existsSync(mainMePath)) {
        fs.writeFileSync(mainMePath, DEFAULT_MAIN_ME.trim() + '\n', 'utf8');
      }

      const techStackPath = path.join(this.memoryDir, 'tech-stack.me');
      if (!fs.existsSync(techStackPath)) {
        fs.writeFileSync(techStackPath, DEFAULT_TECH_STACK_ME.trim() + '\n', 'utf8');
      }

      const prefsPath = path.join(this.memoryDir, 'preferences.me');
      if (!fs.existsSync(prefsPath)) {
        fs.writeFileSync(prefsPath, DEFAULT_PREFERENCES_ME.trim() + '\n', 'utf8');
      }

      const projectsPath = path.join(this.memoryDir, 'projects.me');
      if (!fs.existsSync(projectsPath)) {
        fs.writeFileSync(projectsPath, DEFAULT_PROJECTS_ME.trim() + '\n', 'utf8');
      }

      // Safely archive or remove legacy universal_memory.json if it exists
      const legacyJsonPath = path.join(this.configDir, 'universal_memory.json');
      if (fs.existsSync(legacyJsonPath)) {
        try {
          const raw = fs.readFileSync(legacyJsonPath, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed.userProfile && (parsed.userProfile.name || parsed.userProfile.roleOrTitle)) {
            this._migrateLegacyProfile(parsed.userProfile);
          }
          fs.unlinkSync(legacyJsonPath);
        } catch (_) {}
      }
    } catch (err) {
      console.error('[TreeMemoryStore] Initialization error:', err);
    }
  }

  _migrateLegacyProfile(profile) {
    try {
      const mainMePath = path.join(this.memoryDir, 'main.me');
      if (!fs.existsSync(mainMePath)) return;
      let content = fs.readFileSync(mainMePath, 'utf8');
      if (profile.name) {
        content = content.replace(/User:\s*.*/, `User: ${profile.name}`);
      }
      if (profile.roleOrTitle) {
        content = content.replace(/Role:\s*.*/, `Role: ${profile.roleOrTitle}`);
      }
      if (profile.preferredTone) {
        content = content.replace(/Tone:\s*.*/, `Tone: ${profile.preferredTone}`);
      }
      fs.writeFileSync(mainMePath, content, 'utf8');
    } catch (_) {}
  }

  /**
   * Computes line and word count statistics for a .me string
   */
  countStats(text) {
    if (!text || typeof text !== 'string') return { lines: 0, words: 0 };
    const trimmed = text.trim();
    if (!trimmed) return { lines: 0, words: 0 };
    const lines = trimmed.split('\n').length;
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    return { lines, words };
  }

  /**
   * Extracts links to child .me files from a file's content
   * Supported formats:
   * -> [child.me]: Description
   * [Title](child.me)
   */
  extractLinks(content) {
    const links = [];
    if (!content) return links;

    const arrowRegex = /->\s*\[([^\]]+\.me)\](?:\s*:\s*(.*))?/gi;
    let match;
    while ((match = arrowRegex.exec(content)) !== null) {
      links.push({
        target: match[1].trim(),
        description: (match[2] || '').trim()
      });
    }

    const mdRegex = /\[([^\]]+)\]\(([^)]+\.me)\)/gi;
    while ((match = mdRegex.exec(content)) !== null) {
      const target = match[2].trim();
      if (!links.some(l => l.target === target)) {
        links.push({
          target,
          description: match[1].trim()
        });
      }
    }

    return links;
  }

  /**
   * Returns complete memory tree structure with node metrics
   */
  getTree() {
    try {
      if (!fs.existsSync(this.memoryDir)) {
        this.init();
      }

      const files = fs.readdirSync(this.memoryDir).filter(f => f.endsWith('.me'));
      const nodes = [];
      const parentMap = new Map();

      // Read all files and discover link targets
      for (const file of files) {
        const fullPath = path.join(this.memoryDir, file);
        const stat = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const { lines, words } = this.countStats(content);
        const links = this.extractLinks(content);

        // Record child relationships
        links.forEach(l => {
          if (!parentMap.has(l.target)) {
            parentMap.set(l.target, file);
          }
        });

        // Determine title
        let title = file.replace(/\.me$/, '');
        const firstHeader = content.match(/^#\s+(.+)$/m);
        if (firstHeader) {
          title = firstHeader[1].trim();
        }

        nodes.push({
          filename: file,
          title,
          isRoot: file === 'main.me',
          lineCount: lines,
          maxLines: this.maxLines,
          wordCount: words,
          maxWords: this.maxWords,
          isOverBudget: lines > this.maxLines || words > this.maxWords,
          links,
          children: links.map(l => l.target),
          lastModified: stat.mtime.toISOString(),
          content
        });
      }

      // Assign parent pointers
      nodes.forEach(n => {
        n.parent = n.isRoot ? null : (parentMap.get(n.filename) || 'main.me');
      });

      return {
        success: true,
        memoryDir: this.memoryDir,
        rootFile: 'main.me',
        maxLinesPerFile: this.maxLines,
        maxWordsPerFile: this.maxWords,
        totalNodes: nodes.length,
        nodes
      };
    } catch (err) {
      console.error('[TreeMemoryStore] getTree error:', err);
      return { success: false, error: err.message, nodes: [] };
    }
  }

  /**
   * Retrieves a single .me file content and statistics
   */
  getFile(filename) {
    try {
      const sanitized = path.basename(filename);
      if (!sanitized.endsWith('.me')) {
        return { success: false, error: 'File must end with .me extension' };
      }
      const fullPath = path.join(this.memoryDir, sanitized);
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: `Memory node "${sanitized}" not found` };
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      const stat = fs.statSync(fullPath);
      const { lines, words } = this.countStats(content);

      return {
        success: true,
        filename: sanitized,
        content,
        lineCount: lines,
        maxLines: this.maxLines,
        wordCount: words,
        maxWords: this.maxWords,
        isOverBudget: lines > this.maxLines || words > this.maxWords,
        lastModified: stat.mtime.toISOString()
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Saves content to a .me file, enforcing line and word budget
   */
  saveFile(filename, content) {
    try {
      const sanitized = path.basename(filename);
      if (!sanitized.endsWith('.me')) {
        return { success: false, error: 'File must end with .me extension' };
      }
      const fullPath = path.join(this.memoryDir, sanitized);
      const cleanContent = (content || '').trim() + '\n';
      const { lines, words } = this.countStats(cleanContent);

      if (lines > this.maxLines) {
        return {
          success: false,
          error: `Line limit exceeded: ${lines}/${this.maxLines} lines. Please compact or branch into a child .me node.`
        };
      }
      if (words > this.maxWords) {
        return {
          success: false,
          error: `Word limit exceeded: ${words}/${this.maxWords} words. Please compact or branch into a child .me node.`
        };
      }

      fs.writeFileSync(fullPath, cleanContent, 'utf8');
      return {
        success: true,
        filename: sanitized,
        lineCount: lines,
        wordCount: words,
        message: `Saved ${sanitized} successfully (${lines}/${this.maxLines} lines, ${words}/${this.maxWords} words).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Creates a new child .me node in the tree and links it in the parent node
   */
  createNode(name, description = '', parent = 'main.me') {
    try {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
      if (!cleanName) return { success: false, error: 'Valid node name is required' };

      const filename = cleanName.endsWith('.me') ? cleanName : `${cleanName}.me`;
      const fullPath = path.join(this.memoryDir, filename);

      if (fs.existsSync(fullPath)) {
        return { success: false, error: `Memory node "${filename}" already exists.` };
      }

      const initialContent = `# ${name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

## Summary
${description || 'Specialized domain memory node.'}

## Key Facts & Guidelines
- Initial knowledge recorded here.
`;

      fs.writeFileSync(fullPath, initialContent, 'utf8');

      // Link in parent file
      const parentName = path.basename(parent);
      const parentPath = path.join(this.memoryDir, parentName);
      if (fs.existsSync(parentPath)) {
        let parentContent = fs.readFileSync(parentPath, 'utf8');
        const linkLine = `-> [${filename}]: ${description || 'Specialized domain memory.'}\n`;
        if (!parentContent.includes(`[${filename}]`)) {
          if (parentContent.includes('## Memory Tree Index')) {
            parentContent = parentContent.replace('## Memory Tree Index', `## Memory Tree Index\n${linkLine.trim()}`);
          } else {
            parentContent = parentContent.trim() + `\n\n## Sub-branches\n${linkLine}`;
          }
          fs.writeFileSync(parentPath, parentContent, 'utf8');
        }
      }

      return {
        success: true,
        filename,
        parent: parentName,
        message: `Created memory node "${filename}" and linked to ${parentName}.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Deletes a child .me node (root main.me cannot be deleted)
   */
  deleteNode(filename) {
    try {
      const sanitized = path.basename(filename);
      if (sanitized === 'main.me') {
        return { success: false, error: 'The root node "main.me" cannot be deleted.' };
      }
      const fullPath = path.join(this.memoryDir, sanitized);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // Remove link references from all remaining .me files
      const files = fs.readdirSync(this.memoryDir).filter(f => f.endsWith('.me'));
      for (const file of files) {
        const fp = path.join(this.memoryDir, file);
        let content = fs.readFileSync(fp, 'utf8');
        const linkRegex = new RegExp(`^->\\s*\\[${sanitized}\\]:?.*$\\n?`, 'gm');
        if (linkRegex.test(content)) {
          content = content.replace(linkRegex, '');
          fs.writeFileSync(fp, content, 'utf8');
        }
      }

      return { success: true, filename: sanitized, message: `Memory node "${sanitized}" deleted.` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Injected into the main agent's system prompt:
   * Returns ONLY the root main.me content (lightweight, zero token bloat).
   */
  getMainMemorySnippet() {
    try {
      const mainPath = path.join(this.memoryDir, 'main.me');
      if (!fs.existsSync(mainPath)) {
        this.init();
      }
      const content = fs.readFileSync(mainPath, 'utf8').trim();
      return `=== UNIVERSAL TREE MEMORY (Root Context: main.me) ===\n${content}\n(Note: To retrieve deeper specialized memory from child .me files, call recall_memory)\n======================================================`;
    } catch (err) {
      return '';
    }
  }
}

let treeInstance = null;
function getTreeMemoryStore() {
  if (!treeInstance) {
    treeInstance = new TreeMemoryStore();
  }
  return treeInstance;
}

module.exports = {
  TreeMemoryStore,
  getTreeMemoryStore,
  MAX_LINES_PER_FILE,
  MAX_WORDS_PER_FILE
};
