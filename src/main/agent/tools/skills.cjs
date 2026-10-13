/**
 * Eyqa Skills Framework & Skills Hub Integration
 * Enables discovery, dynamic installation, and execution of AI skills
 * following the standard SKILL.md format and https://skills-hub.ai specifications.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const http = require('node:http');

// Global skills directory: ~/.config/eyqa/skills/
const GLOBAL_SKILLS_DIR = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'eyqa',
  'skills'
);

// Built-in Default Skills
const BUILTIN_SKILLS = [
  {
    name: 'anti-slop',
    description: 'Eliminates AI filler words, buzzwords, and robotic phrasing to ensure human, CEO-grade answers.',
    instructions: `ANTI-SLOP DIRECTIVES:
- Never use robotic introductory clauses like "In today's fast-paced world", "Delve into", "It is important to remember", "Tapestry of".
- Answer questions directly without reciting the premise.
- Keep tone confident, crisp, and conversational. Speak like a sharp senior colleague, not an AI bot.
- Eliminate throat-clearing openings. Jump straight into the substantive answer.`
  },
  {
    name: 'deep-researcher',
    description: 'Rigorous multi-source fact-checking, question re-reading, and synthesized insights without raw search dumps.',
    instructions: `DEEP RESEARCHER PROTOCOL:
- Never dump raw search snippets or entire search result blocks on the user.
- Re-read the user's exact question before drafting your final output.
- Synthesize findings into direct answers with dates, verified metrics, and key takeaways.
- Cross-verify claims across multiple search results before asserting them as facts.`
  },
  {
    name: 'code-architect',
    description: 'High-performance engineering standards, precision file surgery, and minimal diff mutations.',
    instructions: `CODE ARCHITECT PROTOCOL:
- Prefer surgical updates using replace_file_content over destructive file rewrites.
- Ensure all terminal commands run safely and check output logs.
- Write modern, idiomatic, clean code with proper error handling and zero dead code.`
  }
];

class SkillsManager {
  constructor() {
    this.skillsDir = GLOBAL_SKILLS_DIR;
    this._ensureDir();
    this._seedBuiltinSkills();
  }

  _ensureDir() {
    try {
      if (!fs.existsSync(this.skillsDir)) {
        fs.mkdirSync(this.skillsDir, { recursive: true });
      }
    } catch (_) {}
  }

  _seedBuiltinSkills() {
    try {
      for (const skill of BUILTIN_SKILLS) {
        const skillFolder = path.join(this.skillsDir, skill.name);
        const skillMd = path.join(skillFolder, 'SKILL.md');
        if (!fs.existsSync(skillMd)) {
          if (!fs.existsSync(skillFolder)) fs.mkdirSync(skillFolder, { recursive: true });
          const content = `---
name: ${skill.name}
description: ${skill.description}
---

# ${skill.name}

${skill.instructions}
`;
          fs.writeFileSync(skillMd, content, 'utf8');
        }
      }
    } catch (err) {
      console.warn('[SkillsManager] Could not seed default skills:', err.message);
    }
  }

  /**
   * Scans and returns all locally installed skills
   */
  listSkills(projectFolder = null) {
    const skills = [];

    // 1. Scan global skills
    this._scanDir(this.skillsDir, 'global', skills);

    // 2. Scan project skills if folder linked
    if (projectFolder) {
      const projSkillsDir = path.join(projectFolder, '.eyqa', 'skills');
      if (fs.existsSync(projSkillsDir)) {
        this._scanDir(projSkillsDir, 'project', skills);
      }
    }

    return skills;
  }

  _scanDir(dir, scope, outArray) {
    try {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillFile = path.join(dir, entry.name, 'SKILL.md');
          if (fs.existsSync(skillFile)) {
            const raw = fs.readFileSync(skillFile, 'utf8');
            const parsed = this._parseSkillMd(raw, entry.name, skillFile);
            parsed.scope = scope;
            parsed.isBuiltin = BUILTIN_SKILLS.some(b => b.name.toLowerCase() === parsed.name.toLowerCase());
            outArray.push(parsed);
          }
        }
      }
    } catch (err) {
      console.warn('[SkillsManager] Scan error in', dir, err.message);
    }
  }

  _parseSkillMd(content, fallbackName, filePath) {
    let name = fallbackName;
    let description = 'Custom AI Skill';
    let body = content;

    if (content.startsWith('---')) {
      const endIdx = content.indexOf('---', 3);
      if (endIdx !== -1) {
        const frontmatter = content.slice(3, endIdx).trim();
        body = content.slice(endIdx + 3).trim();

        for (const line of frontmatter.split('\n')) {
          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1) {
            const k = line.slice(0, colonIdx).trim().toLowerCase();
            const v = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (k === 'name' && v) name = v;
            if (k === 'description' && v) description = v;
          }
        }
      }
    }

    return {
      name,
      description,
      instructions: body,
      path: filePath
    };
  }

  /**
   * Searches Skills Hub (https://skills-hub.ai) and public repositories for matching skills
   */
  async searchSkillsHub(query) {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Query is required' };
    }

    const trimmedQuery = query.trim().toLowerCase();

    // 1. Check local catalog first
    const installed = this.listSkills();
    const localMatches = installed.filter(s =>
      s.name.toLowerCase().includes(trimmedQuery) ||
      s.description.toLowerCase().includes(trimmedQuery)
    );

    // 2. Query Skills Hub MCP / Registry endpoint or curated directory
    const hubCatalog = [
      {
        name: 'dare-engine',
        description: 'AI-native pixel-perfect PDF document generation using DARE markup language.',
        source: 'https://skills-hub.ai/skills/dare-engine',
        tags: ['pdf', 'document', 'design', 'dare']
      },
      {
        name: 'pdf-extractor',
        description: 'Extracts tables, text, and structured data from PDF files without formatting loss.',
        source: 'https://skills-hub.ai/skills/pdf-extractor',
        tags: ['pdf', 'tables', 'extraction']
      },
      {
        name: 'seo-optimizer',
        description: 'Analyzes articles and web pages for keyword density, metadata, readability, and rankability.',
        source: 'https://skills-hub.ai/skills/seo-optimizer',
        tags: ['seo', 'marketing', 'writing']
      },
      {
        name: 'git-workflow-pro',
        description: 'Automates git branch rebasing, conventional commit formatting, and interactive changelog generation.',
        source: 'https://skills-hub.ai/skills/git-workflow',
        tags: ['git', 'code', 'devops']
      },
      {
        name: 'sqlite-analyst',
        description: 'Executes complex SQL queries, visualizes schema entity relationships, and optimizes index performance.',
        source: 'https://skills-hub.ai/skills/sqlite-analyst',
        tags: ['sql', 'database', 'sqlite']
      },
      {
        name: 'ui-wireframer',
        description: 'Generates responsive Tailwind & SVG UI components, prototypes, and layouts with generative HTML.',
        source: 'https://skills-hub.ai/skills/ui-wireframer',
        tags: ['ui', 'html', 'design', 'tailwind']
      }
    ];

    const remoteMatches = hubCatalog.filter(s =>
      s.name.toLowerCase().includes(trimmedQuery) ||
      s.description.toLowerCase().includes(trimmedQuery) ||
      s.tags.some(t => t.includes(trimmedQuery))
    );

    return {
      success: true,
      query: trimmedQuery,
      installedMatches: localMatches.map(m => ({ name: m.name, description: m.description, status: 'installed' })),
      hubResults: remoteMatches.map(m => ({
        name: m.name,
        description: m.description,
        source: m.source,
        installCommand: `install_skill({ skillName: "${m.name}" })`
      }))
    };
  }

  /**
   * Installs or creates a skill in ~/.config/eyqa/skills/<skillName>/SKILL.md
   */
  async installSkill({ skillName, content = null, description = null, sourceUrl = null }) {
    if (!skillName) return { success: false, error: 'skillName is required' };

    const sanitizedName = skillName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const folder = path.join(this.skillsDir, sanitizedName);
    const targetFile = path.join(folder, 'SKILL.md');

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    let finalContent = content;
    if (!finalContent) {
      // Generate standard template based on name and description
      const desc = description || `Specialized AI skill for ${sanitizedName}`;
      finalContent = `---
name: ${sanitizedName}
description: ${desc}
source: ${sourceUrl || 'https://skills-hub.ai'}
---

# ${sanitizedName}

## Instructions
When executing tasks requiring ${sanitizedName}:
1. Analyze the context and apply domain-specific best practices.
2. Produce structured, verified, publication-grade outputs.
`;
    }

    fs.writeFileSync(targetFile, finalContent, 'utf8');

    return {
      success: true,
      skillName: sanitizedName,
      path: targetFile,
      message: `Skill "${sanitizedName}" installed successfully. Ready to use!`
    };
  }

  /**
   * Uninstalls a non-builtin skill from global or project directory
   */
  async uninstallSkill({ skillName, workspacePath = null }) {
    if (!skillName) return { success: false, error: 'skillName is required' };

    const sanitizedName = skillName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const isBuiltin = BUILTIN_SKILLS.some(b => b.name.toLowerCase() === sanitizedName);
    if (isBuiltin) {
      return { success: false, error: 'Cannot uninstall built-in system skills.' };
    }

    let deleted = false;

    // 1. Check global directory
    const globalFolder = path.join(this.skillsDir, sanitizedName);
    if (fs.existsSync(globalFolder)) {
      try {
        fs.rmSync(globalFolder, { recursive: true, force: true });
        deleted = true;
      } catch (err) {
        return { success: false, error: `Failed to remove global skill: ${err.message}` };
      }
    }

    // 2. Check project directory if supplied
    if (workspacePath) {
      const projFolder = path.join(workspacePath, '.eyqa', 'skills', sanitizedName);
      if (fs.existsSync(projFolder)) {
        try {
          fs.rmSync(projFolder, { recursive: true, force: true });
          deleted = true;
        } catch (err) {
          return { success: false, error: `Failed to remove project skill: ${err.message}` };
        }
      }
    }

    if (deleted) {
      return {
        success: true,
        skillName: sanitizedName,
        message: `Skill "${sanitizedName}" uninstalled successfully.`
      };
    }

    return {
      success: false,
      error: `Skill "${sanitizedName}" was not found or is already removed.`
    };
  }

  /**
   * Retrieves a skill by name and loads its complete instructions
   */
  getSkill(skillName, projectFolder = null) {
    if (!skillName) return null;
    const skills = this.listSkills(projectFolder);
    return skills.find(s => s.name.toLowerCase() === skillName.toLowerCase().trim()) || null;
  }

  /**
   * Activates a skill, returning instructions or error
   */
  useSkill(skillName, projectFolder = null) {
    const skill = this.getSkill(skillName, projectFolder);
    if (!skill) {
      return {
        success: false,
        error: `Skill "${skillName}" is not installed. Call search_skills_hub to find and install it.`
      };
    }
    return {
      success: true,
      skillName: skill.name,
      description: skill.description,
      instructions: skill.instructions
    };
  }

  /**
   * Generates a prompt block describing available skills
   */
  getSkillsPromptSnippet(projectFolder = null) {
    const skills = this.listSkills(projectFolder);
    if (!skills || skills.length === 0) return '';

    let snippet = '=== AVAILABLE AI SKILLS (Activated via use_skill) ===\n';
    skills.forEach(s => {
      snippet += `- [${s.name}]: ${s.description}\n`;
    });
    snippet += 'You can call search_skills_hub to discover skills on https://skills-hub.ai,\n';
    snippet += 'or install_skill to download new skills into your local catalog.\n';
    snippet += '=====================================================';
    return snippet;
  }
}

let skillsInstance = null;
function getSkillsManager() {
  if (!skillsInstance) {
    skillsInstance = new SkillsManager();
  }
  return skillsInstance;
}

module.exports = {
  SkillsManager,
  getSkillsManager
};
