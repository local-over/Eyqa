/**
 * Native terminal process execution and task management.
 * 
 * Features:
 * - Cross-platform shell execution (bash / zsh / sh / cmd / powershell)
 * - Synchronous bounded execution (WaitMsBeforeAsync)
 * - Daemon / background tasks for dev servers, watchers, long builds
 * - Streaming output to memory ring buffers & persistent disk logs in .eyqa/tasks/
 * - Interactive stdin piping and graceful SIGTERM -> SIGKILL escalation
 * - Full inspection with manage_task (list, kill, status, send_input)
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');

// In-memory Task Registry
const taskRegistry = new Map();

const DEFAULT_SYNC_TIMEOUT_MS = 30000;
const MAX_BUFFER_LINES = 1000;
const MAX_STDOUT_CAPTURE_CHARS = 100000;

/**
 * Ensures the project task log directory exists inside .eyqa/tasks
 */
function getTaskLogDir(workspaceRoot) {
  const baseDir = workspaceRoot || os.tmpdir();
  const taskLogDir = path.join(baseDir, '.eyqa', 'tasks');
  if (!fs.existsSync(taskLogDir)) {
    try {
      fs.mkdirSync(taskLogDir, { recursive: true });
    } catch (_) {
      return path.join(os.tmpdir(), 'eyqa-tasks');
    }
  }
  return taskLogDir;
}

/**
 * Determines appropriate shell based on the operating system
 */
function getDefaultShellConfig() {
  const isWin = process.platform === 'win32';
  if (isWin) {
    const comSpec = process.env.COMSPEC || 'cmd.exe';
    return { shell: comSpec, args: ['/d', '/s', '/c'] };
  }
  const preferredShell = process.env.SHELL || '/bin/bash';
  const shell = fs.existsSync(preferredShell) ? preferredShell : '/bin/sh';
  return { shell, args: ['-c'] };
}

/**
 * Executes a terminal command in the project workspace or Cwd.
 */
async function runCommand({
  CommandLine,
  Cwd,
  IsDaemon = false,
  WaitMsBeforeAsync,
  workspaceRoot,
  onStreamOutput,
  signal
}) {
  if (!CommandLine || typeof CommandLine !== 'string' || !CommandLine.trim()) {
    return {
      success: false,
      error: 'CommandLine must be a non-empty string.'
    };
  }

  // Prune completed tasks if registry exceeds 50 tasks to protect memory
  if (taskRegistry.size > 50) {
    for (const [oldId, oldRec] of taskRegistry.entries()) {
      if (oldRec.status !== 'running') {
        taskRegistry.delete(oldId);
        if (taskRegistry.size <= 50) break;
      }
    }
  }

  const trimmedCmd = CommandLine.trim();
  const effectiveCwd = Cwd ? path.resolve(Cwd) : (workspaceRoot ? path.resolve(workspaceRoot) : process.cwd());

  if (!fs.existsSync(effectiveCwd)) {
    return {
      success: false,
      error: `Working directory does not exist: ${effectiveCwd}`
    };
  }

  const taskId = 'task_' + crypto.randomUUID().slice(0, 8);
  const logDir = getTaskLogDir(workspaceRoot || effectiveCwd);
  const logFilePath = path.join(logDir, `${taskId}.log`);

  let logStream = null;
  try {
    logStream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf8' });
  } catch (err) {
    console.warn(`[Terminal] Could not create log file at ${logFilePath}:`, err.message);
  }

  const { shell } = getDefaultShellConfig();

  const taskRecord = {
    id: taskId,
    command: trimmedCmd,
    cwd: effectiveCwd,
    isDaemon: Boolean(IsDaemon),
    status: 'running',
    exitCode: null,
    signal: null,
    startTime: Date.now(),
    endTime: null,
    logFilePath,
    outputBuffer: [],
    childProcess: null
  };

  const env = {
    ...process.env,
    PAGER: 'cat',
    CI: '1',
    PYTHONUNBUFFERED: '1',
    FORCE_COLOR: '0',
    TERM: 'dumb'
  };

  const child = spawn(trimmedCmd, {
    shell,
    cwd: effectiveCwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false
  });

  taskRecord.childProcess = child;
  taskRegistry.set(taskId, taskRecord);

  if (signal) {
    const onAbort = () => {
      try {
        if (child && !child.killed) {
          child.kill('SIGTERM');
        }
      } catch (_) {}
    };
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
      child.on('close', () => {
        signal.removeEventListener('abort', onAbort);
      });
    }
  }

  const appendOutput = (data, source = 'stdout') => {
    const text = data.toString('utf8');
    const timestamp = new Date().toISOString();
    
    if (logStream && !logStream.destroyed) {
      logStream.write(`[${timestamp}] [${source}] ${text}`);
    }

    const lines = text.split('\n');
    for (const line of lines) {
      if (taskRecord.outputBuffer.length >= MAX_BUFFER_LINES) {
        taskRecord.outputBuffer.shift();
      }
      taskRecord.outputBuffer.push({ timestamp: Date.now(), source, text: line });
    }

    if (onStreamOutput) {
      onStreamOutput({ taskId, source, text });
    }
  };

  child.stdout.on('data', (data) => appendOutput(data, 'stdout'));
  child.stderr.on('data', (data) => appendOutput(data, 'stderr'));

  const completionPromise = new Promise((resolve) => {
    child.on('error', (err) => {
      taskRecord.status = 'failed';
      taskRecord.endTime = Date.now();
      appendOutput(`Process execution error: ${err.message}\n`, 'stderr');
      if (logStream && !logStream.destroyed) logStream.end();
      resolve({
        success: false,
        taskId,
        error: err.message,
        status: 'failed'
      });
    });

    child.on('close', (code, signal) => {
      taskRecord.exitCode = code;
      taskRecord.signal = signal;
      taskRecord.endTime = Date.now();
      taskRecord.status = code === 0 ? 'completed' : (taskRecord.status === 'killed' ? 'killed' : 'failed');
      
      if (logStream && !logStream.destroyed) {
        logStream.end(`\n[Process exited with code ${code}${signal ? ` (signal ${signal})` : ''}]\n`);
      }

      const allOutput = taskRecord.outputBuffer.map(b => b.text).join('\n');
      resolve({
        success: code === 0,
        taskId,
        command: trimmedCmd,
        cwd: effectiveCwd,
        exitCode: code,
        signal,
        status: taskRecord.status,
        durationMs: taskRecord.endTime - taskRecord.startTime,
        output: allOutput.length > MAX_STDOUT_CAPTURE_CHARS ? allOutput.slice(0, MAX_STDOUT_CAPTURE_CHARS) + '\n... [Output truncated]' : allOutput,
        logFilePath
      });
    });
  });

  let waitMs = typeof WaitMsBeforeAsync === 'number' ? WaitMsBeforeAsync : (IsDaemon ? 1500 : DEFAULT_SYNC_TIMEOUT_MS);

  if (waitMs <= 0 && IsDaemon) {
    return {
      success: true,
      taskId,
      status: 'running',
      command: trimmedCmd,
      cwd: effectiveCwd,
      isDaemon: true,
      message: `Daemon process started in background with Task ID: ${taskId}`,
      logFilePath
    };
  }

  let timeoutId = null;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ isTimeout: true });
    }, waitMs);
  });

  const winner = await Promise.race([completionPromise, timeoutPromise]);
  if (timeoutId) clearTimeout(timeoutId);

  if (winner && !winner.isTimeout) {
    return winner;
  }

  const currentOutput = taskRecord.outputBuffer.map(b => b.text).join('\n');
  return {
    success: true,
    taskId,
    status: 'running',
    command: trimmedCmd,
    cwd: effectiveCwd,
    isDaemon: Boolean(IsDaemon),
    waitedMs: waitMs,
    message: `Command is still executing after ${waitMs}ms. Switched to background task: ${taskId}. Use manage_task to monitor or interact.`,
    partialOutput: currentOutput.slice(-2000),
    logFilePath
  };
}

/**
 * Task Management Tool for background execution
 */
async function manageTask({ Action, TaskId, Input }) {
  if (!Action) {
    return { success: false, error: 'Action parameter is required (list | kill | status | send_input).' };
  }

  switch (Action) {
    case 'list': {
      const tasks = [];
      for (const [id, rec] of taskRegistry.entries()) {
        tasks.push({
          taskId: id,
          command: rec.command,
          cwd: rec.cwd,
          isDaemon: rec.isDaemon,
          status: rec.status,
          exitCode: rec.exitCode,
          startTime: rec.startTime,
          runningDurationMs: (rec.endTime || Date.now()) - rec.startTime,
          logFilePath: rec.logFilePath
        });
      }
      return {
        success: true,
        count: tasks.length,
        tasks
      };
    }

    case 'status': {
      if (!TaskId) return { success: false, error: 'TaskId is required for status.' };
      const rec = taskRegistry.get(TaskId);
      if (!rec) {
        return { success: false, error: `Task not found with ID: ${TaskId}` };
      }

      let recentLogs = rec.outputBuffer.map(b => b.text).join('\n');
      if (fs.existsSync(rec.logFilePath)) {
        try {
          const content = fs.readFileSync(rec.logFilePath, 'utf8');
          recentLogs = content.slice(-5000);
        } catch (_) {}
      }

      return {
        success: true,
        taskId: rec.id,
        command: rec.command,
        cwd: rec.cwd,
        isDaemon: rec.isDaemon,
        status: rec.status,
        exitCode: rec.exitCode,
        signal: rec.signal,
        startTime: rec.startTime,
        endTime: rec.endTime,
        durationMs: (rec.endTime || Date.now()) - rec.startTime,
        logFilePath: rec.logFilePath,
        recentOutput: recentLogs
      };
    }

    case 'kill': {
      if (!TaskId) return { success: false, error: 'TaskId is required for kill.' };
      const rec = taskRegistry.get(TaskId);
      if (!rec) {
        return { success: false, error: `Task not found with ID: ${TaskId}` };
      }

      if (rec.status !== 'running' || !rec.childProcess) {
        return {
          success: true,
          taskId: TaskId,
          status: rec.status,
          message: `Task is already finished (status: ${rec.status}).`
        };
      }

      rec.status = 'killed';
      const pid = rec.childProcess.pid;

      try {
        rec.childProcess.kill('SIGTERM');

        setTimeout(() => {
          if (rec.status === 'killed' && rec.exitCode === null) {
            try {
              rec.childProcess.kill('SIGKILL');
            } catch (_) {}
          }
        }, 2500);

        return {
          success: true,
          taskId: TaskId,
          pid,
          message: `Sent SIGTERM to process ${pid} (Task: ${TaskId}).`
        };
      } catch (err) {
        return {
          success: false,
          taskId: TaskId,
          error: `Failed to terminate task: ${err.message}`
        };
      }
    }

    case 'send_input': {
      if (!TaskId) return { success: false, error: 'TaskId is required for send_input.' };
      if (Input === undefined || Input === null) {
        return { success: false, error: 'Input text is required for send_input.' };
      }

      const rec = taskRegistry.get(TaskId);
      if (!rec) {
        return { success: false, error: `Task not found with ID: ${TaskId}` };
      }

      if (rec.status !== 'running' || !rec.childProcess || !rec.childProcess.stdin) {
        return {
          success: false,
          taskId: TaskId,
          error: `Cannot send input: process is not running or stdin is closed.`
        };
      }

      try {
        const textToSend = Input.endsWith('\n') ? Input : Input + '\n';
        rec.childProcess.stdin.write(textToSend);
        return {
          success: true,
          taskId: TaskId,
          message: `Piped ${Buffer.byteLength(textToSend, 'utf8')} bytes to stdin.`
        };
      } catch (err) {
        return {
          success: false,
          taskId: TaskId,
          error: `Error writing to stdin: ${err.message}`
        };
      }
    }

    default:
      return { success: false, error: `Unknown Action: ${Action}` };
  }
}

/**
 * Clean up active tasks when the application is closing
 */
function cleanupAllTasks() {
  for (const [id, rec] of taskRegistry.entries()) {
    if (rec.status === 'running' && rec.childProcess) {
      try {
        rec.childProcess.kill('SIGTERM');
      } catch (_) {}
    }
  }
}

module.exports = {
  runCommand,
  manageTask,
  cleanupAllTasks,
  taskRegistry
};
