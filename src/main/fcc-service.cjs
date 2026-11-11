/**
 * Eyqa Embedded Free Claude Code (FCC) Background Service
 * Supervises the embedded FCC background library (src/fcc/server.py).
 * Automatically boots on startup, monitors health, captures live logs,
 * and handles graceful lifecycle termination.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

class FCCService {
  constructor() {
    this.process = null;
    this.port = 8082;
    this.status = 'stopped'; // 'stopped' | 'starting' | 'running' | 'error'
    this.startTime = null;
    this.lastError = null;
    this.logs = [];
    this.maxLogs = 200;
    this.serverScript = path.join(__dirname, '../fcc/server.py');
    this.pythonBin = this._resolvePython();
  }

  _resolvePython() {
    // 1. Check existing dedicated uv venv with full dependencies
    const uvVenvPython = path.join(process.env.HOME || '', '.local/share/uv/tools/free-claude-code/bin/python');
    if (fs.existsSync(uvVenvPython)) {
      return uvVenvPython;
    }

    // 2. Fallback to standard python3
    return 'python3';
  }

  _log(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const line = `[${timestamp}] ${msg}`;
    this.logs.push(line);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    console.log(`[FCCService] ${msg}`);
  }

  async checkPortAlive() {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/`, { timeout: 1500 }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async start() {
    if (this.status === 'running' || this.status === 'starting') {
      return { success: true, status: this.status, port: this.port };
    }

    this.status = 'starting';
    this.lastError = null;
    this._log(`Starting embedded FCC background service on port ${this.port}...`);

    // Check if port is already running
    const alreadyAlive = await this.checkPortAlive();
    if (alreadyAlive) {
      this.status = 'running';
      this.startTime = Date.now();
      this._log(`FCC server is already active on port ${this.port}. Hooked into existing instance.`);
      return { success: true, status: this.status, port: this.port, existing: true };
    }

    try {
      const eyqaRoot = path.join(__dirname, '../..');
      const srcDir = path.join(__dirname, '..');

      this._log(`Spawning Python process with ${this.pythonBin}...`);

      this.process = spawn(this.pythonBin, [this.serverScript], {
        cwd: eyqaRoot,
        env: {
          ...process.env,
          PYTHONPATH: srcDir,
          PYTHONUNBUFFERED: '1',
          PORT: String(this.port)
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.startTime = Date.now();

      this.process.stdout.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          text.split('\n').forEach(line => this._log(`[stdout] ${line}`));
        }
      });

      this.process.stderr.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          text.split('\n').forEach(line => this._log(`[stderr] ${line}`));
        }
      });

      this.process.on('error', (err) => {
        this.status = 'error';
        this.lastError = err.message;
        this._log(`Process error: ${err.message}`);
      });

      this.process.on('close', (code, signal) => {
        this._log(`Process exited with code ${code}, signal ${signal}`);
        this.status = 'stopped';
        this.process = null;
      });

      // Poll port until ready (up to 12 seconds)
      const maxRetries = 24;
      for (let i = 0; i < maxRetries; i++) {
        await new Promise(r => setTimeout(r, 500));
        const ready = await this.checkPortAlive();
        if (ready) {
          this.status = 'running';
          this._log(`Embedded FCC background library is healthy and serving on http://127.0.0.1:${this.port}/`);
          return { success: true, status: this.status, port: this.port, pid: this.process?.pid };
        }
      }

      this.status = 'running'; // Process was launched, might still be warming up
      return { success: true, status: this.status, port: this.port, pid: this.process?.pid };
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message;
      this._log(`Failed to launch FCC server: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async stop() {
    this._log('Stopping embedded FCC background service...');
    if (!this.process) {
      this.status = 'stopped';
      return { success: true };
    }

    return new Promise((resolve) => {
      const proc = this.process;
      this.status = 'stopping';

      const timeout = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch (_) {}
        this.status = 'stopped';
        this.process = null;
        resolve({ success: true, forced: true });
      }, 2500);

      proc.once('close', () => {
        clearTimeout(timeout);
        this.status = 'stopped';
        this.process = null;
        resolve({ success: true });
      });

      try {
        proc.kill('SIGTERM');
      } catch (err) {
        clearTimeout(timeout);
        this.status = 'stopped';
        this.process = null;
        resolve({ success: false, error: err.message });
      }
    });
  }

  async restart() {
    this._log('Restarting embedded FCC background library...');
    await this.stop();
    await new Promise(r => setTimeout(r, 600));
    return await this.start();
  }

  getStatus() {
    const uptimeSec = this.startTime && this.status === 'running' 
      ? Math.floor((Date.now() - this.startTime) / 1000) 
      : 0;

    return {
      status: this.status,
      running: this.status === 'running',
      port: this.port,
      pid: this.process ? this.process.pid : null,
      uptime: uptimeSec,
      lastError: this.lastError,
      isEmbedded: true,
      pythonBin: this.pythonBin,
      scriptPath: this.serverScript,
      logCount: this.logs.length
    };
  }

  getLogs() {
    return this.logs;
  }
}

// Singleton instance
const fccService = new FCCService();

module.exports = {
  fccService,
  FCCService
};
