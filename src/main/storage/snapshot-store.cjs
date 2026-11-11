/**
 * Eyqa Snapshot Store (src/main/storage/snapshot-store.cjs)
 * Manages timestamped revertible file versions, unified diff logging, and rollbacks.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class SnapshotStore {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
  }

  getEyqaDir() {
    if (!this.workspaceRoot) return null;
    const eyqaDir = path.join(this.workspaceRoot, '.eyqa');
    if (!fs.existsSync(eyqaDir)) {
      fs.mkdirSync(eyqaDir, { recursive: true });
    }
    return eyqaDir;
  }

  getSnapshotsDir() {
    const eyqaDir = this.getEyqaDir();
    if (!eyqaDir) return null;
    const snapshotsDir = path.join(eyqaDir, 'snapshots');
    if (!fs.existsSync(snapshotsDir)) {
      fs.mkdirSync(snapshotsDir, { recursive: true });
    }
    return snapshotsDir;
  }

  /**
   * Computes a unified diff between two text strings without external dependencies.
   */
  static computeUnifiedDiff(fileName, oldContent, newContent, contextLines = 3) {
    const oldLines = oldContent ? oldContent.split(/\r?\n/) : [];
    const newLines = newContent ? newContent.split(/\r?\n/) : [];

    if (oldContent === newContent) {
      return `--- a/${fileName}\n+++ b/${fileName}\n@@ -1,0 +1,0 @@ (no changes)`;
    }

    let prefix = 0;
    while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
      prefix++;
    }

    let suffix = 0;
    while (
      suffix < (oldLines.length - prefix) &&
      suffix < (newLines.length - prefix) &&
      oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
    ) {
      suffix++;
    }

    const oldChanged = oldLines.slice(prefix, oldLines.length - suffix);
    const newChanged = newLines.slice(prefix, newLines.length - suffix);

    const oldStart = Math.max(1, prefix - contextLines + 1);
    const oldContextBefore = oldLines.slice(oldStart - 1, prefix);

    const oldEndContext = oldLines.slice(oldLines.length - suffix, oldLines.length - suffix + contextLines);

    const header = [
      `--- a/${fileName}`,
      `+++ b/${fileName}`,
      `@@ -${oldStart},${oldContextBefore.length + oldChanged.length + oldEndContext.length} +${oldStart},${oldContextBefore.length + newChanged.length + oldEndContext.length} @@`
    ];

    const diffLines = [
      ...header,
      ...oldContextBefore.map(l => ` ${l}`),
      ...oldChanged.map(l => `-${l}`),
      ...newChanged.map(l => `+${l}`),
      ...oldEndContext.map(l => ` ${l}`)
    ];

    return diffLines.join('\n');
  }

  /**
   * Records a snapshot before and after an edit.
   */
  createSnapshot(fileRelPath, previousContent, newContent, messageSummary = 'File Update', metadata = {}) {
    try {
      const snapshotsDir = this.getSnapshotsDir();
      if (!snapshotsDir) return null;

      const id = 'snap_' + crypto.randomUUID().slice(0, 12);
      const timestamp = Date.now();
      const diff = SnapshotStore.computeUnifiedDiff(fileRelPath, previousContent, newContent);

      const snapshot = {
        id,
        fileRelPath,
        timestamp,
        isoTime: new Date(timestamp).toISOString(),
        messageSummary,
        diff,
        metadata,
        previousContent,
        newContent
      };

      const snapshotFile = path.join(snapshotsDir, `${id}.json`);
      fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf8');

      return snapshot;
    } catch (err) {
      console.error('[SnapshotStore] Failed to record snapshot:', err);
      return null;
    }
  }

  getSnapshots(fileRelPath = null) {
    try {
      const snapshotsDir = this.getSnapshotsDir();
      if (!snapshotsDir || !fs.existsSync(snapshotsDir)) return [];

      const files = fs.readdirSync(snapshotsDir);
      const snapshots = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = fs.readFileSync(path.join(snapshotsDir, file), 'utf8');
          const data = JSON.parse(raw);
          if (!fileRelPath || data.fileRelPath === fileRelPath) {
            snapshots.push({
              id: data.id,
              fileRelPath: data.fileRelPath,
              timestamp: data.timestamp,
              isoTime: data.isoTime,
              messageSummary: data.messageSummary,
              diff: data.diff,
              metadata: data.metadata || {}
            });
          }
        } catch (_) {}
      }

      return snapshots.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      return [];
    }
  }

  getSnapshotById(snapshotId) {
    try {
      const snapshotsDir = this.getSnapshotsDir();
      if (!snapshotsDir) return null;
      const snapshotFile = path.join(snapshotsDir, `${snapshotId}.json`);
      if (!fs.existsSync(snapshotFile)) return null;
      return JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    } catch (err) {
      return null;
    }
  }

  revertSnapshot(snapshotId) {
    try {
      const snapshot = this.getSnapshotById(snapshotId);
      if (!snapshot) {
        return { success: false, error: `Snapshot ${snapshotId} not found` };
      }

      const fullPath = path.resolve(this.workspaceRoot, snapshot.fileRelPath);
      let currentContent = '';
      if (fs.existsSync(fullPath)) {
        currentContent = fs.readFileSync(fullPath, 'utf8');
      }

      fs.writeFileSync(fullPath, snapshot.previousContent, 'utf8');

      // Create reverse snapshot documenting the revert
      this.createSnapshot(
        snapshot.fileRelPath,
        currentContent,
        snapshot.previousContent,
        `Reverted to snapshot ${snapshotId}`,
        { revertedSnapshotId: snapshotId }
      );

      return {
        success: true,
        message: `Successfully reverted ${snapshot.fileRelPath} to snapshot ${snapshotId}`,
        revertedSnapshotId: snapshotId
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = {
  SnapshotStore
};
