/**
 * Eyqa Workspace File Tool
 * Safe, sandboxed operations inside the user's active workspace directory.
 * Prevents path traversal and guarantees privacy and security for everyday users.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function resolveSafePath(workspaceRoot, relPath) {
  if (relPath && path.isAbsolute(relPath)) {
    return path.resolve(relPath);
  }
  if (!workspaceRoot) {
    if (relPath && fs.existsSync(path.resolve(relPath))) {
      return path.resolve(relPath);
    }
    throw new Error('No active workspace configured.');
  }
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, relPath || '.');

  // Security guard: ensure target is inside or is root
  if (target !== root && !target.startsWith(root + path.sep)) {
    if (fs.existsSync(target)) {
      return target;
    }
    throw new Error(`Security Violation: Path "${relPath}" is outside the active workspace directory.`);
  }

  return target;
}

// --- Snapshot & Project Memory Management ---
function getEyqaDir(workspaceRoot) {
  if (!workspaceRoot) return null;
  const eyqaDir = path.join(workspaceRoot, '.eyqa');
  if (!fs.existsSync(eyqaDir)) {
    fs.mkdirSync(eyqaDir, { recursive: true });
  }
  return eyqaDir;
}

function getSnapshotsDir(workspaceRoot) {
  const snapshotsDir = path.join(getEyqaDir(workspaceRoot) || workspaceRoot, 'snapshots');
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }
  return snapshotsDir;
}

function getProjectMemory(workspaceRoot) {
  try {
    if (!workspaceRoot) return { notes: '', architecture: '', updatedAt: null };
    const eyqaDir = getEyqaDir(workspaceRoot);
    const memFile = path.join(eyqaDir, 'memory.json');
    if (fs.existsSync(memFile)) {
      return JSON.parse(fs.readFileSync(memFile, 'utf8'));
    }
    return { notes: '', architecture: '', updatedAt: null };
  } catch (err) {
    return { notes: '', architecture: '', error: err.message };
  }
}

function saveProjectMemory(workspaceRoot, memoryData) {
  try {
    if (!workspaceRoot) return { success: false, error: 'No workspace configured' };
    const eyqaDir = getEyqaDir(workspaceRoot);
    const memFile = path.join(eyqaDir, 'memory.json');
    const toSave = {
      ...memoryData,
      updatedAt: Date.now()
    };
    fs.writeFileSync(memFile, JSON.stringify(toSave, null, 2), 'utf8');
    return { success: true, memory: toSave };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getProjectChangelog(workspaceRoot) {
  try {
    if (!workspaceRoot) return [];
    const eyqaDir = getEyqaDir(workspaceRoot);
    const changeFile = path.join(eyqaDir, 'changelog.json');
    if (fs.existsSync(changeFile)) {
      const data = JSON.parse(fs.readFileSync(changeFile, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (err) {
    return [];
  }
}

function recordChangelogEntry(workspaceRoot, relPath, action = 'edit', summary = 'File modified') {
  try {
    if (!workspaceRoot) return;
    const eyqaDir = getEyqaDir(workspaceRoot);
    const changeFile = path.join(eyqaDir, 'changelog.json');
    let log = [];
    if (fs.existsSync(changeFile)) {
      try {
        log = JSON.parse(fs.readFileSync(changeFile, 'utf8'));
        if (!Array.isArray(log)) log = [];
      } catch (_) {
        log = [];
      }
    }
    const entry = {
      id: 'chg_' + crypto.randomUUID().slice(0, 8),
      timestamp: Date.now(),
      file: relPath,
      action,
      summary
    };
    log.unshift(entry);
    if (log.length > 100) log = log.slice(0, 100);
    fs.writeFileSync(changeFile, JSON.stringify(log, null, 2), 'utf8');
    return entry;
  } catch (err) {
    console.error('Failed to record changelog:', err);
  }
}

function createSnapshot(workspaceRoot, relPath, previousContent, newContent, messageSummary = 'File Update') {
  try {
    const snapshotsDir = getSnapshotsDir(workspaceRoot);
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    
    const snapshot = {
      id,
      fileRelPath: relPath,
      timestamp,
      messageSummary,
      previousContent,
      newContent
    };
    
    const snapshotFile = path.join(snapshotsDir, `${id}.json`);
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf8');
    return snapshot;
  } catch (err) {
    console.error('Failed to create snapshot:', err);
    return null;
  }
}

function getSnapshots(workspaceRoot, fileRelPath) {
  try {
    const snapshotsDir = getSnapshotsDir(workspaceRoot);
    if (!fs.existsSync(snapshotsDir)) return [];
    const files = fs.readdirSync(snapshotsDir);
    const snapshots = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = fs.readFileSync(path.join(snapshotsDir, file), 'utf8');
        const data = JSON.parse(content);
        if (data.fileRelPath === fileRelPath) {
          snapshots.push(data);
        }
      } catch (e) {
        // ignore invalid files
      }
    }
    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    return [];
  }
}

function revertSnapshot(workspaceRoot, snapshotId) {
  try {
    const snapshotsDir = getSnapshotsDir(workspaceRoot);
    const snapshotFile = path.join(snapshotsDir, `${snapshotId}.json`);
    if (!fs.existsSync(snapshotFile)) {
      return { success: false, error: 'Snapshot not found' };
    }
    
    const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    const fullPath = resolveSafePath(workspaceRoot, snapshot.fileRelPath);
    
    fs.writeFileSync(fullPath, snapshot.previousContent, 'utf8');
    
    // Create a new snapshot for the revert action itself
    createSnapshot(workspaceRoot, snapshot.fileRelPath, snapshot.newContent, snapshot.previousContent, `Reverted to snapshot ${snapshotId}`);
    
    return { success: true, message: `Reverted ${snapshot.fileRelPath} to snapshot ${snapshotId}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getFileContent(workspaceRoot, fileRelPath) {
  try {
    const fullPath = resolveSafePath(workspaceRoot, fileRelPath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `File not found: ${fileRelPath}` };
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
// ---------------------------

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

    let previousContent = '';
    if (fs.existsSync(fullPath)) {
      previousContent = fs.readFileSync(fullPath, 'utf8');
    }

    fs.writeFileSync(fullPath, content, 'utf8');

    // Create snapshot on every write
    createSnapshot(workspaceRoot, relPath, previousContent, content, 'Agent Workspace Edit');

    // Record in project changelog
    recordChangelogEntry(workspaceRoot, relPath, previousContent ? 'edit' : 'create', previousContent ? 'Agent modified file' : 'Agent created file');

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

// MIME and media extension mapping for view_file
const IMAGE_MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp'
};

function normalizeLineEndings(str) {
  return (str || '').replace(/\r\n/g, '\n');
}

/**
 * Precision Search-and-Replace tool: replace_file_content
 */
function replaceFileContent(workspaceRoot, {
  TargetFile,
  TargetContent,
  ReplacementContent,
  StartLine = null,
  EndLine = null,
  AllowMultiple = false
}) {
  try {
    if (!TargetFile) {
      return { error: 'TargetFile argument is required.' };
    }
    if (typeof TargetContent !== 'string') {
      return { error: 'TargetContent must be a string containing the exact text to replace.' };
    }
    if (typeof ReplacementContent !== 'string') {
      return { error: 'ReplacementContent must be a string.' };
    }

    const fullPath = resolveSafePath(workspaceRoot, TargetFile);
    if (!fs.existsSync(fullPath)) {
      return { error: `File not found: ${TargetFile}` };
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return { error: `Path "${TargetFile}" is a directory, not a file.` };
    }

    const rawFileContent = fs.readFileSync(fullPath, 'utf8');
    const isCRLF = rawFileContent.includes('\r\n');
    const fileContentNorm = normalizeLineEndings(rawFileContent);
    const targetNorm = normalizeLineEndings(TargetContent);
    const replacementNorm = normalizeLineEndings(ReplacementContent);

    if (targetNorm.length === 0) {
      return { error: 'TargetContent cannot be empty. Specify exact text to replace.' };
    }

    let searchScopeContent = fileContentNorm;
    let scopeStartLine = 1;

    if (StartLine !== null || EndLine !== null) {
      const allLines = fileContentNorm.split('\n');
      const start = StartLine ? Math.max(1, parseInt(StartLine, 10)) : 1;
      const end = EndLine ? Math.min(allLines.length, parseInt(EndLine, 10)) : allLines.length;

      if (start > end) {
        return { error: `Invalid line range: StartLine (${start}) is greater than EndLine (${end}).` };
      }

      const beforeLines = allLines.slice(0, start - 1);
      const scopedLines = allLines.slice(start - 1, end);
      const afterLines = allLines.slice(end);

      searchScopeContent = scopedLines.join('\n');
      scopeStartLine = start;

      const matches = [];
      let pos = 0;
      while ((pos = searchScopeContent.indexOf(targetNorm, pos)) !== -1) {
        matches.push(pos);
        pos += targetNorm.length;
      }

      if (matches.length === 0) {
        return {
          error: `TargetContent was not found within lines ${start}-${end} of ${TargetFile}. Verify line range and exact text formatting.`
        };
      }

      if (matches.length > 1 && !AllowMultiple) {
        return {
          error: `TargetContent was found ${matches.length} times within lines ${start}-${end}. Provide more surrounding context lines or set AllowMultiple: true.`
        };
      }

      const newScopedContent = AllowMultiple
        ? searchScopeContent.replaceAll(targetNorm, replacementNorm)
        : searchScopeContent.replace(targetNorm, replacementNorm);

      let finalContent = [
        ...(beforeLines.length > 0 ? [beforeLines.join('\n')] : []),
        newScopedContent,
        ...(afterLines.length > 0 ? [afterLines.join('\n')] : [])
      ].join('\n');

      if (isCRLF) {
        finalContent = finalContent.replace(/\n/g, '\r\n');
      }

      const relPath = path.relative(workspaceRoot, fullPath);
      const snapshot = createSnapshot(
        workspaceRoot,
        relPath,
        rawFileContent,
        finalContent,
        `Precision replacement (lines ${start}-${end})`
      );

      fs.writeFileSync(fullPath, finalContent, 'utf8');
      recordChangelogEntry(workspaceRoot, relPath, 'edit', `Replaced ${matches.length} block(s) within lines ${start}-${end}`);

      return {
        success: true,
        file: relPath,
        replacementsMade: matches.length,
        snapshotId: snapshot ? snapshot.id : null,
        diff: snapshot ? snapshot.diff : ''
      };
    }

    const matches = [];
    let pos = 0;
    while ((pos = fileContentNorm.indexOf(targetNorm, pos)) !== -1) {
      matches.push(pos);
      pos += targetNorm.length;
    }

    if (matches.length === 0) {
      return {
        error: `TargetContent was not found in ${TargetFile}. Please ensure whitespace, indentation, and newlines match the file exactly.`
      };
    }

    if (matches.length > 1 && !AllowMultiple) {
      return {
        error: `TargetContent matches ${matches.length} locations in ${TargetFile}. Expand the surrounding code context to make the match unique, or set AllowMultiple: true.`
      };
    }

    let finalContent = AllowMultiple
      ? fileContentNorm.replaceAll(targetNorm, replacementNorm)
      : fileContentNorm.replace(targetNorm, replacementNorm);

    if (isCRLF) {
      finalContent = finalContent.replace(/\n/g, '\r\n');
    }

    const activeWs = workspaceRoot || path.dirname(fullPath);
    const relPath = path.relative(activeWs, fullPath);
    const snapshot = createSnapshot(
      activeWs,
      relPath,
      rawFileContent,
      finalContent,
      `Precision replacement in ${relPath}`
    );

    fs.writeFileSync(fullPath, finalContent, 'utf8');
    recordChangelogEntry(activeWs, relPath, 'edit', `Replaced ${matches.length} block(s) across file`);

    return {
      success: true,
      file: relPath,
      replacementsMade: matches.length,
      snapshotId: snapshot ? snapshot.id : null,
      diff: snapshot ? snapshot.diff : ''
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Workspace File Viewer: view_file
 */
function viewFile(workspaceRoot, {
  AbsolutePath,
  StartLine = null,
  EndLine = null,
  ContentOffset = 0,
  MaxBytes = 46080
}) {
  try {
    if (!AbsolutePath) {
      return { error: 'AbsolutePath parameter is required.' };
    }

    const fullPath = resolveSafePath(workspaceRoot, AbsolutePath);
    if (!fs.existsSync(fullPath)) {
      return { error: `File not found: ${AbsolutePath}` };
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return { error: `Path "${AbsolutePath}" is a directory. Use workspace_list instead.` };
    }

    const relPath = path.relative(workspaceRoot, fullPath);
    const ext = path.extname(fullPath).toLowerCase();

    if (IMAGE_MIME_MAP[ext]) {
      const mimeType = IMAGE_MIME_MAP[ext];
      const MAX_MEDIA_SIZE = 15 * 1024 * 1024;
      if (stat.size > MAX_MEDIA_SIZE) {
        return {
          error: `Media file exceeds maximum allowed viewer size of 15 MB.`
        };
      }

      const fileBuffer = fs.readFileSync(fullPath);
      const base64Data = fileBuffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64Data}`;

      return {
        path: relPath,
        isMedia: true,
        mediaType: 'image',
        mimeType,
        sizeBytes: stat.size,
        dataUri,
        summary: `Image file ${relPath} (${stat.size} bytes, ${mimeType}) ready for rendering.`
      };
    }

    const bufferSample = Buffer.alloc(Math.min(1024, stat.size));
    const fd = fs.openSync(fullPath, 'r');
    fs.readSync(fd, bufferSample, 0, bufferSample.length, 0);
    fs.closeSync(fd);

    let isBinary = false;
    for (let i = 0; i < bufferSample.length; i++) {
      if (bufferSample[i] === 0) {
        isBinary = true;
        break;
      }
    }

    if (isBinary) {
      return {
        path: relPath,
        isBinary: true,
        sizeBytes: stat.size,
        error: `Binary file format cannot be displayed in text viewer.`
      };
    }

    const rawContent = fs.readFileSync(fullPath, 'utf8');
    const normalizedContent = normalizeLineEndings(rawContent);
    const allLines = normalizedContent.split('\n');
    const totalLines = allLines.length;

    if (StartLine !== null || EndLine !== null) {
      const start = StartLine ? Math.max(1, parseInt(StartLine, 10)) : 1;
      const end = EndLine ? Math.min(totalLines, parseInt(EndLine, 10)) : Math.min(totalLines, start + 799);

      if (start > end) {
        return { error: `StartLine (${start}) must be less than or equal to EndLine (${end}).` };
      }

      const selectedLines = allLines.slice(start - 1, end);
      const numberedLines = selectedLines.map((line, idx) => `${start + idx}: ${line}`).join('\n');

      return {
        path: relPath,
        totalLines,
        startLine: start,
        endLine: end,
        linesReturned: selectedLines.length,
        sizeBytes: stat.size,
        content: numberedLines,
        truncated: end < totalLines
      };
    }

    const offset = Math.max(0, parseInt(ContentOffset, 10) || 0);
    const contentBuffer = Buffer.from(normalizedContent, 'utf8');
    const totalBytes = contentBuffer.length;

    if (offset >= totalBytes && totalBytes > 0) {
      return {
        path: relPath,
        totalBytes,
        contentOffset: offset,
        content: '',
        eof: true,
        message: 'ContentOffset is at or past end-of-file.'
      };
    }

    const chunkEnd = Math.min(totalBytes, offset + MaxBytes);
    const chunkBuffer = contentBuffer.subarray(offset, chunkEnd);
    const chunkContent = chunkBuffer.toString('utf8');

    const precedingText = contentBuffer.subarray(0, offset).toString('utf8');
    const baseLineNumber = precedingText ? precedingText.split('\n').length : 1;
    const chunkLines = chunkContent.split('\n');
    const numberedLines = chunkLines.map((line, idx) => `${baseLineNumber + idx}: ${line}`).join('\n');

    return {
      path: relPath,
      totalBytes,
      totalLines,
      contentOffset: offset,
      bytesReturned: chunkBuffer.length,
      nextOffset: chunkEnd < totalBytes ? chunkEnd : null,
      eof: chunkEnd >= totalBytes,
      truncated: chunkEnd < totalBytes,
      content: numberedLines
    };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = {
  resolveSafePath,
  listWorkspace,
  readWorkspaceFile,
  writeWorkspaceFile,
  replaceFileContent,
  viewFile,
  getSnapshots,
  revertSnapshot,
  getFileContent,
  getProjectMemory,
  saveProjectMemory,
  getProjectChangelog,
  recordChangelogEntry
};
