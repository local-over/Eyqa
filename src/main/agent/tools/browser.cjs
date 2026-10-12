/**
 * Eyqa Agentic Browser Engine
 * Native Chromium offscreen automation engine for live web exploration,
 * client-side SPA rendering, DOM interaction, JavaScript execution,
 * and high-resolution visual capture.
 */

const { BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

class AgentBrowser {
  constructor() {
    this.window = null;
    this.currentUrl = null;
    this.isNavigating = false;
    this.idleTimer = null;
    this.IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes idle shutdown
  }

  /**
   * Initializes or returns the existing offscreen BrowserWindow.
   */
  async getOrCreateWindow() {
    this._resetIdleTimer();

    if (this.window && !this.window.isDestroyed()) {
      return this.window;
    }

    this.window = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      backgroundColor: '#ffffff',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        javascript: true,
        images: true,
        webSecurity: true
      }
    });

    const wc = this.window.webContents;
    wc.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 EyqaCoworker/1.0'
    );

    wc.on('will-prevent-unload', (event) => event.preventDefault());

    this.window.on('closed', () => {
      this.window = null;
      this.currentUrl = null;
    });

    return this.window;
  }

  _resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.close();
    }, this.IDLE_TIMEOUT_MS);
  }

  /**
   * Safely closes the browser window.
   */
  async close() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.window && !this.window.isDestroyed()) {
      try {
        this.window.destroy();
      } catch (_) {}
    }
    this.window = null;
    this.currentUrl = null;
  }

  /**
   * Navigates to a target URL, waiting for DOM readiness and network stabilization.
   */
  async navigate({ url, timeoutMs = 20000 }) {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Target URL is required' };
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    const win = await this.getOrCreateWindow();
    const wc = win.webContents;

    return new Promise((resolve) => {
      let isResolved = false;
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve({
            success: false,
            url: targetUrl,
            error: `Navigation timed out after ${timeoutMs / 1000}s`
          });
        }
      }, timeoutMs);

      const onDidFinishLoad = async () => {
        if (isResolved) return;
        try {
          await wc.executeJavaScript(`
            new Promise((res) => {
              if (document.readyState === 'complete') {
                setTimeout(res, 500);
              } else {
                window.addEventListener('load', () => setTimeout(res, 500), { once: true });
              }
            })
          `);

          const title = await wc.getTitle();
          this.currentUrl = wc.getURL();
          isResolved = true;
          cleanup();
          resolve({
            success: true,
            url: this.currentUrl,
            title: title || this.currentUrl,
            status: 200
          });
        } catch (err) {
          isResolved = true;
          cleanup();
          resolve({
            success: true,
            url: wc.getURL() || targetUrl,
            title: await wc.getTitle().catch(() => targetUrl),
            warning: `DOM settled with warning: ${err.message}`
          });
        }
      };

      const onDidFailLoad = (event, errorCode, errorDescription, validatedURL) => {
        if (errorCode === -3) return; // ignore aborted navigation due to redirects
        if (isResolved) return;
        isResolved = true;
        cleanup();
        resolve({
          success: false,
          url: validatedURL || targetUrl,
          errorCode,
          error: `Failed to load page: ${errorDescription} (${errorCode})`
        });
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        wc.removeListener('did-finish-load', onDidFinishLoad);
        wc.removeListener('did-fail-load', onDidFailLoad);
      };

      wc.once('did-finish-load', onDidFinishLoad);
      wc.once('did-fail-load', onDidFailLoad);

      wc.loadURL(targetUrl).catch((err) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve({ success: false, url: targetUrl, error: err.message });
        }
      });
    });
  }

  /**
   * Performs actions on the live loaded browser page:
   * 'click' | 'type' | 'scroll' | 'evaluate' | 'screenshot'
   */
  async action({ action, selector = null, text = null, script = null, scrollDeltaY = 500 }) {
    const win = await this.getOrCreateWindow();
    const wc = win.webContents;

    if (!wc.getURL() || wc.getURL() === 'about:blank') {
      return { success: false, error: 'No page is currently loaded. Call browser_navigate first.' };
    }

    this._resetIdleTimer();

    try {
      switch (action) {
        case 'click': {
          if (!selector) return { success: false, error: 'selector is required for click action' };

          const clickResult = await wc.executeJavaScript(`
            (() => {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return { found: false };
              el.scrollIntoView({ behavior: 'instant', block: 'center' });
              const rect = el.getBoundingClientRect();
              el.focus?.();
              el.click();
              return {
                found: true,
                tagName: el.tagName,
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
              };
            })()
          `);

          if (!clickResult.found) {
            return { success: false, error: `Element with selector "${selector}" not found.` };
          }

          await new Promise((r) => setTimeout(r, 400));
          const currentUrl = wc.getURL();
          const title = await wc.getTitle();

          return {
            success: true,
            action: 'click',
            selector,
            currentUrl,
            title,
            element: clickResult.tagName
          };
        }

        case 'type': {
          if (!selector) return { success: false, error: 'selector is required for type action' };
          if (text === null || text === undefined) return { success: false, error: 'text is required for type action' };

          const typeResult = await wc.executeJavaScript(`
            (() => {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return { found: false };
              el.scrollIntoView({ behavior: 'instant', block: 'center' });
              el.focus();
              
              if ('value' in el) {
                el.value = ${JSON.stringify(text)};
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                el.textContent = ${JSON.stringify(text)};
              }
              return { found: true, tagName: el.tagName };
            })()
          `);

          if (!typeResult.found) {
            return { success: false, error: `Element with selector "${selector}" not found.` };
          }

          return {
            success: true,
            action: 'type',
            selector,
            textTyped: text
          };
        }

        case 'scroll': {
          const delta = typeof scrollDeltaY === 'number' ? scrollDeltaY : 500;
          await wc.executeJavaScript(`
            window.scrollBy({ top: ${delta}, left: 0, behavior: 'instant' });
          `);
          await new Promise((r) => setTimeout(r, 200));

          const scrollPos = await wc.executeJavaScript(`
            ({ scrollX: window.scrollX, scrollY: window.scrollY, maxScroll: document.documentElement.scrollHeight })
          `);

          return {
            success: true,
            action: 'scroll',
            deltaY: delta,
            position: scrollPos
          };
        }

        case 'evaluate': {
          if (!script) return { success: false, error: 'script is required for evaluate action' };
          const evalResult = await wc.executeJavaScript(script);
          return {
            success: true,
            action: 'evaluate',
            result: evalResult
          };
        }

        case 'screenshot': {
          const image = await wc.capturePage();
          const pngBuffer = image.toPNG();
          const base64 = image.toDataURL();

          return {
            success: true,
            action: 'screenshot',
            dimensions: image.getSize(),
            dataUrl: base64,
            byteSize: pngBuffer.length
          };
        }

        default:
          return { success: false, error: `Unsupported action: "${action}"` };
      }
    } catch (err) {
      return { success: false, error: `Action "${action}" execution failed: ${err.message}` };
    }
  }

  /**
   * Reads a browser page: navigates, waits for DOM execution, extracts
   * clean structured markdown, lists interactive form controls/links,
   * and optionally captures a high-resolution screenshot.
   */
  async readPage({ url, extractMarkdown = true, takeScreenshot = true, maxChars = 20000 }) {
    if (url) {
      const navRes = await this.navigate({ url });
      if (!navRes.success) {
        return navRes;
      }
    }

    const win = await this.getOrCreateWindow();
    const wc = win.webContents;

    const pageData = await wc.executeJavaScript(`
      (() => {
        const title = document.title || '';
        const url = window.location.href;

        const interactive = [];
        const interactiveNodes = document.querySelectorAll('button, a[href], input, textarea, select, [role="button"]');
        interactiveNodes.forEach((node, i) => {
          if (i >= 50) return;
          const text = (node.innerText || node.placeholder || node.getAttribute('aria-label') || node.value || '').trim();
          if (!text && !node.id) return;
          
          let selector = '';
          if (node.id) selector = '#' + node.id;
          else if (node.name) selector = node.tagName.toLowerCase() + '[name="' + node.name + '"]';
          else if (node.className && typeof node.className === 'string') {
            const firstClass = node.className.split(' ').filter(Boolean)[0];
            if (firstClass) selector = node.tagName.toLowerCase() + '.' + firstClass;
          }
          if (!selector) selector = node.tagName.toLowerCase();

          interactive.push({
            tag: node.tagName.toLowerCase(),
            type: node.type || undefined,
            text: text.slice(0, 60),
            selector: selector,
            href: node.href || undefined
          });
        });

        let markdown = '';
        if (${extractMarkdown}) {
          const clone = document.body.cloneNode(true);

          const removeTags = ['script', 'style', 'noscript', 'svg', 'canvas', 'iframe'];
          removeTags.forEach(tag => {
            clone.querySelectorAll(tag).forEach(el => el.remove());
          });

          clone.querySelectorAll('h1').forEach(h => h.replaceWith('\\n# ' + h.innerText.trim() + '\\n'));
          clone.querySelectorAll('h2').forEach(h => h.replaceWith('\\n## ' + h.innerText.trim() + '\\n'));
          clone.querySelectorAll('h3').forEach(h => h.replaceWith('\\n### ' + h.innerText.trim() + '\\n'));
          clone.querySelectorAll('h4, h5, h6').forEach(h => h.replaceWith('\\n#### ' + h.innerText.trim() + '\\n'));
          clone.querySelectorAll('li').forEach(li => li.replaceWith('\\n- ' + li.innerText.trim()));

          clone.querySelectorAll('a').forEach(a => {
            const text = a.innerText.trim();
            const href = a.getAttribute('href');
            if (text && href && !href.startsWith('javascript:')) {
              a.replaceWith('[' + text + '](' + href + ')');
            }
          });

          clone.querySelectorAll('p').forEach(p => p.replaceWith('\\n\\n' + p.innerText.trim() + '\\n\\n'));
          clone.querySelectorAll('br').forEach(br => br.replaceWith('\\n'));

          markdown = (clone.innerText || clone.textContent || '')
            .replace(/\\n\\s*\\n\\s*\\n+/g, '\\n\\n')
            .trim();
        }

        return {
          title,
          url,
          interactiveElements: interactive,
          content: markdown
        };
      })()
    `);

    let truncatedContent = pageData.content || '';
    if (truncatedContent.length > maxChars) {
      truncatedContent = truncatedContent.slice(0, maxChars) + '\n\n... [Page content truncated due to length]';
    }

    let screenshot = null;
    if (takeScreenshot) {
      try {
        const img = await wc.capturePage();
        screenshot = {
          dataUrl: img.toDataURL(),
          dimensions: img.getSize()
        };
      } catch (err) {
        screenshot = { error: `Screenshot failed: ${err.message}` };
      }
    }

    return {
      success: true,
      url: pageData.url,
      title: pageData.title,
      charCount: truncatedContent.length,
      content: truncatedContent,
      interactiveElements: pageData.interactiveElements,
      screenshot
    };
  }

  /**
   * Hands off the browser to the user with a visible window and floating guidance banner.
   * Records user navigation events and resumes once the user hands control back.
   */
  async requestTakeover({ reason, problemDescription, url = null }) {
    const win = await this.getOrCreateWindow();
    const wc = win.webContents;

    if (url && typeof url === 'string') {
      await this.navigate({ url });
    }

    const currentUrl = wc.getURL() || url || 'about:blank';
    const currentTitle = await wc.getTitle().catch(() => '');

    this.takeoverLogs = [
      {
        timestamp: new Date().toISOString(),
        event: 'takeover_initiated',
        url: currentUrl,
        title: currentTitle,
        reason: reason || 'Human assistance required',
        problemDescription: problemDescription || 'Please resolve the prompt or challenge'
      }
    ];

    win.show();
    win.focus();

    // Inject floating guidance banner
    const injectBanner = async () => {
      try {
        await wc.executeJavaScript(`
          (() => {
            const old = document.getElementById('eyqa-handoff-banner');
            if (old) old.remove();

            const banner = document.createElement('div');
            banner.id = 'eyqa-handoff-banner';
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#0d0d0d;color:#ffffff;border-bottom:1px solid rgba(255,255,255,0.2);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 6px 20px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:13px;';
            
            banner.innerHTML = \`
              <div style="display:flex;align-items:center;gap:12px;">
                <span style="background:#ffffff;color:#000000;font-weight:700;font-size:11px;padding:3px 8px;border-radius:12px;letter-spacing:0.5px;">EYQA USER TAKEOVER</span>
                <span style="color:#d4d4d8;">\${${JSON.stringify(reason || 'Human assistance requested')}}</span>
              </div>
              <button id="eyqa-finish-takeover-btn" style="background:#ffffff;color:#000000;border:none;padding:6px 16px;border-radius:10px;font-weight:600;font-size:12px;cursor:pointer;">Hand Back to Eyqa ↩</button>
            \`;

            document.documentElement.appendChild(banner);
            document.body.style.paddingTop = '48px';

            document.getElementById('eyqa-finish-takeover-btn')?.addEventListener('click', () => {
              window.__eyqaHandBackRequested = true;
            });
          })()
        `);
      } catch (_) {}
    };

    await injectBanner();

    // Listen for navigations during user session
    const onDidNavigate = (event, navUrl) => {
      this.takeoverLogs.push({
        timestamp: new Date().toISOString(),
        event: 'user_navigated',
        url: navUrl
      });
      setTimeout(injectBanner, 600);
    };
    wc.on('did-navigate', onDidNavigate);

    let checkInterval = null;
    return new Promise((resolve) => {
      this.activeTakeoverResolver = async (userNotes = null) => {
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        wc.removeListener('did-navigate', onDidNavigate);
        try {
          win.hide();
        } catch (_) {}

        const finalUrl = wc.getURL();
        const finalTitle = await wc.getTitle().catch(() => finalUrl);

        this.takeoverLogs.push({
          timestamp: new Date().toISOString(),
          event: 'handed_back',
          url: finalUrl,
          title: finalTitle,
          notes: userNotes || 'User completed interaction'
        });

        resolve({
          success: true,
          status: 'handed_back',
          reason,
          finalUrl,
          finalTitle,
          logCount: this.takeoverLogs.length,
          interactions: this.takeoverLogs,
          message: `User completed takeover on ${finalUrl}. Eyqa now has full context of the updated session.`
        });
      };

      // Periodic check if button was clicked inside the webpage
      checkInterval = setInterval(async () => {
        if (!win || win.isDestroyed()) {
          if (checkInterval) clearInterval(checkInterval);
          resolve({
            success: true,
            status: 'window_closed',
            finalUrl: currentUrl,
            message: 'Browser window closed by user.'
          });
          return;
        }

        try {
          const clicked = await wc.executeJavaScript('Boolean(window.__eyqaHandBackRequested)');
          if (clicked) {
            clearInterval(checkInterval);
            if (this.activeTakeoverResolver) {
              this.activeTakeoverResolver('User clicked Hand Back button in browser banner');
            }
          }
        } catch (_) {}
      }, 500);
    });
  }

  handBack(notes = null) {
    if (this.activeTakeoverResolver) {
      const resolver = this.activeTakeoverResolver;
      this.activeTakeoverResolver = null;
      resolver(notes);
      return true;
    }
    return false;
  }
}

const defaultBrowser = new AgentBrowser();

module.exports = {
  AgentBrowser,
  browserNavigate: (args) => defaultBrowser.navigate(args),
  browserAction: (args) => defaultBrowser.action(args),
  readBrowserPage: (args) => defaultBrowser.readPage(args),
  requestBrowserTakeover: (args) => defaultBrowser.requestTakeover(args),
  handBackBrowser: (notes) => defaultBrowser.handBack(notes),
  closeBrowser: () => defaultBrowser.close(),
  getDefaultBrowser: () => defaultBrowser
};
