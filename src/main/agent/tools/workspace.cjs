/**
 * Eyqa Workspace File Tool
 * Safe, sandboxed operations inside the user's active workspace directory.
 * Prevents path traversal and guarantees privacy and security for everyday users.
 */
const fs = require('node:fs');
const path = require('node:path');

function resolveSafePath(workspaceRoot, relPath) {
  if (!workspaceRoot) {
    throw new Error('No active workspace configured.');
  }
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, relPath || '.');

  // Security guard: ensure target is inside or is root
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Security Violation: Path "${relPath}" is outside the active workspace directory.`);
  }

  return target;
}

function listWorkspace(workspaceRoot, subDir = '') {
  try {
    const targetDir = resolveSafePath(workspaceRoot, subDir);
    if (!fs.existsSync(targetDir)) {
      return { error: `Directory does not exist: ${subDir || '.'}` };
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      // Skip hidden files/git
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      if (entry.name === 'node_modules') continue;

      const fullPath = path.join(targetDir, entry.name);
      let size = 0;
      let mtime = null;

      try {
        const stat = fs.statSync(fullPath);
        size = stat.size;
        mtime = stat.mtimeMs;
      } catch {
        // ignore
      }

      items.push({
        name: entry.name,
        path: path.relative(workspaceRoot, fullPath),
        isDirectory: entry.isDirectory(),
        size,
        mtime
      });
    }

    return {
      workspace: workspaceRoot,
      directory: subDir || '.',
      count: items.length,
      items: items.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
    };
  } catch (err) {
    return { error: err.message };
  }
}

function readWorkspaceFile(workspaceRoot, relPath, maxChars = 50000) {
  try {
    const fullPath = resolveSafePath(workspaceRoot, relPath);
    if (!fs.existsSync(fullPath)) {
      return { error: `File not found: ${relPath}` };
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return { error: `Path "${relPath}" is a directory, not a file.` };
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const truncated = content.length > maxChars;
    if (truncated) {
      content = content.slice(0, maxChars) + '\n\n... [File content truncated for length]';
    }

    return {
      path: relPath,
      size: stat.size,
      charCount: content.length,
      truncated,
      content
    };
  } catch (err) {
    return { error: err.message };
  }
}

function writeWorkspaceFile(workspaceRoot, relPath, content) {
  try {
    const fullPath = resolveSafePath(workspaceRoot, relPath);
    const parentDir = path.dirname(fullPath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');

    return {
      success: true,
      path: relPath,
      size: Buffer.byteLength(content, 'utf8'),
      message: `File written successfully: ${relPath}`
    };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = {
  resolveSafePath,
  listWorkspace,
  readWorkspaceFile,
  writeWorkspaceFile
};
